import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { cn } from '../lib/utils'
import { Flag, Save, Pencil, LayoutGrid, X } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '../components/ui/alert'
import { Label } from '../components/ui/label'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from '../components/ui/sheet'
import { MarkdownWithMarker } from '../components/MarkdownContent'
import ToastMessage from '../components/ToastMessage'
import ProblemEditor from '../components/dashboard/ProblemEditor'
import { useAuth } from '../hooks/useAuth'
import { homeworkDraftStorageKey } from '../utils/userScopedStorage'

const sectionTitleMap = {
  single_choice: '一、单选题',
  true_false: '二、判断题',
  programming: '三、编程题'
}

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) return path
  return fallback
}

function buildInternalPathWithQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const queryText = query.toString()
  return queryText ? `${path}?${queryText}` : path
}

function normalizeDefaultLanguage(language) {
  if (language === 'python') return 'python'
  if (language === 'go') return 'go'
  if (language === 'turtle') return 'turtle'
  return 'cpp'
}

function pickStarter(body, language) {
  if (!body?.starterCode) {
    if (language === 'python') return 'print("hello")'
    if (language === 'go') return 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
    if (language === 'turtle') return 'import turtle\n\nt = turtle.Turtle()\nt.speed(3)\n\n# 在这里编写你的绘图代码\n# 示例：画一个正方形\nfor _ in range(4):\n    t.forward(100)\n    t.left(90)\n\nturtle.done()'
    return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}'
  }
  return body.starterCode[language] || body.starterCode.cpp || ''
}

function formatDateTime(value) {
  if (!value) return '未设置'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未设置'
  return date.toLocaleString()
}

function formatCountdown(target, now) {
  if (!target) return '未设置截止时间'
  const endAt = new Date(target).getTime()
  if (Number.isNaN(endAt)) return '未设置截止时间'
  const diff = endAt - now
  if (diff <= 0) return '已截止'
  const totalSeconds = Math.floor(diff / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function problemTypeText(type) {
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  if (type === 'programming') return '编程题'
  return type || '未知题型'
}

function homeworkDisplayModeText(mode) {
  return mode === 'list' ? '题单模式' : '试卷模式'
}

function alphaOptionLabel(index) {
  return String.fromCharCode(65 + index)
}

function normalizeObjectiveAnswer(type, value) {
  if (type === 'true_false') return value === 'false' ? 'false' : value === 'true' ? 'true' : ''
  return String(value || '')
}

function loadStoredDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { objectiveAnswers: {}, flags: {}, programming: {}, lastSavedAt: '' }
    const parsed = JSON.parse(raw)
    return {
      objectiveAnswers: parsed?.objectiveAnswers && typeof parsed.objectiveAnswers === 'object' ? parsed.objectiveAnswers : {},
      flags: parsed?.flags && typeof parsed.flags === 'object' ? parsed.flags : {},
      programming: parsed?.programming && typeof parsed.programming === 'object' ? parsed.programming : {},
      lastSavedAt: String(parsed?.lastSavedAt || '')
    }
  } catch {
    return { objectiveAnswers: {}, flags: {}, programming: {}, lastSavedAt: '' }
  }
}

function buildInitialDraft(homeworkItems, problemsById, submissionsByProblemId, storedDraft, defaultLanguage) {
  const nextDraft = {
    objectiveAnswers: { ...storedDraft.objectiveAnswers },
    flags: { ...storedDraft.flags },
    programming: {},
    lastSavedAt: storedDraft.lastSavedAt || ''
  }
  homeworkItems.forEach((item) => {
    const problemId = Number(item.problemId)
    const problem = problemsById[problemId]
    const submissions = submissionsByProblemId[problemId] || []
    const problemType = problem?.type || item.type
    if (problemType === 'programming') {
      const savedProgramming = storedDraft.programming?.[problemId] || {}
      const latestSubmission = submissions.find((submission) => submission.questionType === 'programming')
      const language = normalizeDefaultLanguage(savedProgramming.language || latestSubmission?.language || defaultLanguage)
      nextDraft.programming[problemId] = {
        language,
        code: savedProgramming.code ?? latestSubmission?.sourceCode ?? pickStarter(problem?.bodyJson || {}, language),
        customInput: savedProgramming.customInput ?? latestSubmission?.inputData ?? '',
        touched: Boolean(savedProgramming.touched),
        lastSavedAt: savedProgramming.lastSavedAt || ''
      }
      return
    }
    if (!nextDraft.objectiveAnswers[problemId]) {
      const latestObjective = submissions.find((submission) => submission.questionType !== 'programming')
      if (latestObjective?.inputData) {
        nextDraft.objectiveAnswers[problemId] = normalizeObjectiveAnswer(problemType, latestObjective.inputData)
      }
    }
  })
  return nextDraft
}

function buildRecordReviewDraft(homeworkItems, problemsById, submissionDetailsByProblemId, defaultLanguage) {
  const nextDraft = { objectiveAnswers: {}, flags: {}, programming: {}, lastSavedAt: '' }
  homeworkItems.forEach((item) => {
    const problemId = Number(item.problemId)
    const problem = problemsById[problemId]
    const submission = submissionDetailsByProblemId[problemId] || null
    const problemType = problem?.type || item.type
    if (problemType === 'programming') {
      const language = normalizeDefaultLanguage(submission?.language || defaultLanguage)
      nextDraft.programming[problemId] = {
        language,
        code: submission?.sourceCode || '',
        customInput: submission?.inputData || '',
        touched: false,
        lastSavedAt: submission?.createdAt || '',
        submissionId: Number(submission?.id || 0)
      }
      return
    }
    nextDraft.objectiveAnswers[problemId] = normalizeObjectiveAnswer(problemType, submission?.inputData)
  })
  return nextDraft
}

function buildEmptyDraft(homeworkItems, problemsById, defaultLanguage) {
  const draft = { objectiveAnswers: {}, flags: {}, programming: {}, lastSavedAt: '' }
  homeworkItems.forEach((item) => {
    const problemId = Number(item.problemId)
    const problem = problemsById[problemId]
    if ((problem?.type || item.type) === 'programming') {
      draft.programming[problemId] = {
        language: normalizeDefaultLanguage(defaultLanguage),
        code: pickStarter(problem?.bodyJson || {}, normalizeDefaultLanguage(defaultLanguage)),
        customInput: '',
        touched: false,
        lastSavedAt: ''
      }
    }
  })
  return draft
}

function getProblemPromptText(problem, fallback = '暂无题面') {
  const statement = String(problem?.statementMd || '').trim()
  if (statement) return statement
  const title = String(problem?.title || '').trim()
  return title || fallback
}

function recordStatusBadgeVariant(statusText) {
  if (statusText === '判题中') return 'warning'
  if (statusText === '全部通过') return 'success'
  if (statusText === '部分提交') return 'info'
  return 'default'
}

function getRecordWrongCounts(record) {
  const items = Array.isArray(record?.items) ? record.items : []
  let objectiveWrongCount = 0
  let programmingWrongCount = 0
  items.forEach((item) => {
    const status = String(item?.status || '').trim()
    const verdict = String(item?.verdict || '').trim()
    const isPending = status && status !== 'done' && status !== 'failed'
    const isWrong = status === 'failed' || (status === 'done' && verdict && verdict !== 'AC' && verdict !== 'OK')
    if (isPending || !isWrong) return
    if (item?.problemType === 'programming') { programmingWrongCount += 1; return }
    objectiveWrongCount += 1
  })
  return { objectiveWrongCount, programmingWrongCount }
}

function isAcceptedRecordItem(item) {
  const status = String(item?.status || '').trim()
  const verdict = String(item?.verdict || '').trim()
  return status === 'done' && (verdict === 'AC' || verdict === 'OK')
}

function countObjectiveVerdicts(orderedItems, submissionsByProblemId) {
  let correct = 0
  let wrong = 0
  orderedItems.forEach((item) => {
    const problemId = Number(item.problemId)
    const problem = item.problem
    const problemType = problem?.type || item.type
    if (problemType === 'programming') return
    const submissions = submissionsByProblemId[problemId] || []
    const latest = submissions[0]
    if (!latest || latest.questionType === 'programming') return
    const verdict = latest.verdict
    if (verdict === 'AC' || verdict === 'OK') { correct += 1; return }
    if (verdict) { wrong += 1 }
  })
  return { correct, wrong }
}

function questionNavigatorClass({ active, answered, reviewState }) {
  const isWrongOrMissing = reviewState === 'wrong-or-missing'
  const isCorrectReview = reviewState === 'correct'
  if (isWrongOrMissing) {
    return cn(
      'h-8 min-w-0 px-0 py-0 rounded font-bold text-xs border',
      'border-orange-400 bg-orange-50 text-orange-700',
      'hover:border-orange-400 hover:bg-orange-100',
      active && 'shadow-[inset_0_0_0_1px_rgba(25,118,210,0.16)]'
    )
  }
  if (answered || isCorrectReview) {
    return cn(
      'h-8 min-w-0 px-0 py-0 rounded font-bold text-xs border',
      'border-sky-300 bg-sky-100 text-blue-700',
      'hover:border-primary hover:bg-sky-200',
      active && 'shadow-[inset_0_0_0_1px_rgba(25,118,210,0.16)]'
    )
  }
  return cn(
    'h-8 min-w-0 px-0 py-0 rounded font-bold text-xs border',
    'border-border bg-white',
    'hover:border-primary hover:bg-slate-50',
    active && 'shadow-[inset_0_0_0_1px_rgba(25,118,210,0.16)]'
  )
}

function isSubmissionRecordRouteUnavailable(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('405') || message.includes('method not allowed') || message.includes('404')
}

export default function HomeworkPage() {
  const { user } = useAuth()
  const { spaceId, homeworkId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [space, setSpace] = useState(null)
  const [homework, setHomework] = useState(null)
  const [problemsById, setProblemsById] = useState({})
  const [submissionsByProblemId, setSubmissionsByProblemId] = useState({})
  const [submissionRecords, setSubmissionRecords] = useState([])
  const [submissionRecordUnavailable, setSubmissionRecordUnavailable] = useState(false)
  const [editingProblemId, setEditingProblemId] = useState(null)
  const [editingProblem, setEditingProblem] = useState(null)
  const [reviewRecord, setReviewRecord] = useState(null)
  const [draft, setDraft] = useState({ objectiveAnswers: {}, flags: {}, programming: {}, lastSavedAt: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  const [activeProblemId, setActiveProblemId] = useState(null)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const questionRefs = useRef({})

  const draftStorageKey = homeworkDraftStorageKey(user, spaceId, homeworkId)
  const defaultBackTo = `/?spaceId=${spaceId}&tab=homework`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回作业列表'
  const reviewRecordId = Number(searchParams.get('recordId') || 0)
  const isReviewMode = Number.isInteger(reviewRecordId) && reviewRecordId > 0
  const allRecordsReturnTo = encodeURIComponent(`/spaces/${spaceId}/homeworks/${homeworkId}`)
  const allRecordsReturnLabel = encodeURIComponent('返回作业')

  const orderedItems = useMemo(() => {
    const items = Array.isArray(homework?.items) ? [...homework.items] : []
    items.sort((left, right) => Number(left.orderNo || 0) - Number(right.orderNo || 0))
    return items.map((item, index) => ({ ...item, displayOrder: index + 1, problem: problemsById[item.problemId] || null }))
  }, [homework, problemsById])

  const groupedItems = useMemo(() => {
    let nextDisplayOrder = 1
    return ['single_choice', 'true_false', 'programming']
      .map((type) => ({
        type,
        title: sectionTitleMap[type] || problemTypeText(type),
        items: orderedItems
          .filter((item) => (item.problem?.type || item.type) === type)
          .map((item) => ({ ...item, displayOrder: nextDisplayOrder++ }))
      }))
      .filter((group) => group.items.length > 0)
  }, [orderedItems])

  const reviewRecordItemMap = useMemo(() => {
    const map = new Map()
    ;(reviewRecord?.items || []).forEach((item) => { map.set(Number(item.problemId), item) })
    return map
  }, [reviewRecord])

  const currentHomeworkPath = useMemo(() => {
    if (!isReviewMode || !reviewRecordId) return `/spaces/${spaceId}/homeworks/${homeworkId}`
    return buildInternalPathWithQuery(`/spaces/${spaceId}/homeworks/${homeworkId}`, { recordId: reviewRecordId })
  }, [spaceId, homeworkId, isReviewMode, reviewRecordId])

  const programmingReturnTo = encodeURIComponent(currentHomeworkPath)
  const programmingReturnLabel = encodeURIComponent(isReviewMode ? '返回作答记录' : '返回作业')

  const answeredProblemIds = useMemo(() => {
    const ids = new Set()
    orderedItems.forEach((item) => {
      const problemId = Number(item.problemId)
      const problem = item.problem
      const problemType = problem?.type || item.type
      const submissions = submissionsByProblemId[problemId] || []
      if (problemType === 'programming') {
        const programmingDraft = draft.programming[problemId]
        if (programmingDraft?.submissionId || programmingDraft?.lastSavedAt) ids.add(problemId)
        return
      }
      const answer = normalizeObjectiveAnswer(problemType, draft.objectiveAnswers[problemId])
      const hasSubmission = submissions.some((submission) => submission.questionType !== 'programming')
      if (answer || hasSubmission) ids.add(problemId)
    })
    return ids
  }, [draft, orderedItems, submissionsByProblemId])

  const flaggedProblemIds = useMemo(() => {
    return new Set(Object.entries(draft.flags).filter(([, value]) => value).map(([problemId]) => Number(problemId)))
  }, [draft.flags])

  const getReviewProblemState = (problemId) => {
    if (!isReviewMode || !reviewRecord) return 'normal'
    const recordItem = reviewRecordItemMap.get(Number(problemId))
    if (!recordItem) return 'wrong-or-missing'
    return isAcceptedRecordItem(recordItem) ? 'correct' : 'wrong-or-missing'
  }

  const countdownText = useMemo(() => formatCountdown(homework?.dueAt, now), [homework?.dueAt, now])
  const isExpired = countdownText === '已截止'

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const persistDraft = (updater, message = '') => {
    setDraft((current) => {
      const nextDraft = typeof updater === 'function' ? updater(current) : updater
      localStorage.setItem(draftStorageKey, JSON.stringify(nextDraft))
      return nextDraft
    })
    if (message) setActionMessage(message)
  }

  const refreshHomeworkSubmissionRecords = async (preferredRecordId = null) => {
    try {
      const result = await api.listHomeworkSubmissionRecords(spaceId, homeworkId, space?.canManage ? { all: true } : undefined)
      const records = result?.records || []
      setSubmissionRecordUnavailable(false)
      setSubmissionRecords(records)
      if (isReviewMode) {
        const targetId = preferredRecordId || reviewRecordId
        setReviewRecord(targetId ? (records.find((record) => Number(record.id) === Number(targetId)) || null) : null)
      }
      return records
    } catch (err) {
      if (isSubmissionRecordRouteUnavailable(err)) {
        setSubmissionRecordUnavailable(true)
        setSubmissionRecords([])
        setReviewRecord(null)
      }
      return []
    }
  }

  const loadData = async () => {
    const spaceData = await api.getSpace(spaceId)
    const [homeworkData, homeworkRecordData] = await Promise.all([
      api.getHomework(spaceId, homeworkId),
      api.listHomeworkSubmissionRecords(spaceId, homeworkId, spaceData?.canManage ? { all: true } : undefined).catch((err) => {
        if (isSubmissionRecordRouteUnavailable(err)) return { records: [], unavailable: true }
        return { records: [] }
      })
    ])
    const uniqueProblemIds = Array.from(
      new Set((homeworkData?.items || []).map((item) => Number(item.problemId)).filter((problemId) => Number.isInteger(problemId) && problemId > 0))
    )
    const includeAnswer = spaceData?.canManage === true
    const problemList = await Promise.all(uniqueProblemIds.map((problemId) => api.getProblem(spaceId, problemId, { includeAnswer })))
    const nextProblemsById = {}
    problemList.forEach((problem) => { nextProblemsById[problem.id] = problem })
    const nextSubmissionsByProblemId = {}
    let initialDraft = null
    let nextReviewRecord = null

    if (isReviewMode) {
      nextReviewRecord = (homeworkRecordData?.records || []).find((record) => Number(record.id) === reviewRecordId) || null
      if (!nextReviewRecord) throw new Error('当前作业记录不存在')
      uniqueProblemIds.forEach((problemId) => { nextSubmissionsByProblemId[problemId] = [] })
      const submissionDetailsByProblemId = {}
      const detailPairs = await Promise.all(
        (nextReviewRecord.items || []).map(async (item) => {
          const detail = await api.getSubmission(item.submissionId)
          return [Number(item.problemId), detail]
        })
      )
      detailPairs.forEach(([problemId, detail]) => {
        submissionDetailsByProblemId[problemId] = detail
        nextSubmissionsByProblemId[problemId] = detail ? [detail] : []
      })
      initialDraft = buildRecordReviewDraft(homeworkData?.items || [], nextProblemsById, submissionDetailsByProblemId, normalizeDefaultLanguage(spaceData?.defaultProgrammingLanguage))
    } else {
      const submissionPairs = await Promise.all(uniqueProblemIds.map(async (problemId) => {
        try { const result = await api.listSubmissions(spaceId, problemId); return [problemId, result?.submissions || []] }
        catch { return [problemId, []] }
      }))
      submissionPairs.forEach(([problemId, submissions]) => { nextSubmissionsByProblemId[problemId] = submissions })
      let storedDraft = loadStoredDraft(draftStorageKey)
      try {
        const cloudDraft = await api.getHomeworkDraft(spaceId, homeworkId)
        if (cloudDraft?.draft) {
          const cloudParsed = JSON.parse(cloudDraft.draft)
          const cloudTime = cloudParsed?.lastSavedAt || cloudDraft?.updatedAt || ''
          const localTime = storedDraft?.lastSavedAt || ''
          if (cloudTime && (!localTime || cloudTime >= localTime)) {
            storedDraft = cloudParsed
          }
        }
      } catch { /* cloud draft unavailable, use localStorage */ }
      initialDraft = buildInitialDraft(homeworkData?.items || [], nextProblemsById, nextSubmissionsByProblemId, storedDraft, normalizeDefaultLanguage(spaceData?.defaultProgrammingLanguage))
    }

    setSpace(spaceData)
    setHomework(homeworkData)
    setProblemsById(nextProblemsById)
    setSubmissionsByProblemId(nextSubmissionsByProblemId)
    setSubmissionRecords(homeworkRecordData?.records || [])
    setSubmissionRecordUnavailable(Boolean(homeworkRecordData?.unavailable))
    setReviewRecord(nextReviewRecord)
    setDraft(initialDraft)
    if (!activeProblemId && homeworkData?.items?.length) setActiveProblemId(Number(homeworkData.items[0].problemId))
  }

  useEffect(() => {
    ;(async () => {
      try { setLoading(true); setError(''); setActionMessage(''); await loadData() }
      catch (err) { setError(err.message || '作业加载失败') }
      finally { setLoading(false) }
    })()
  }, [spaceId, homeworkId, reviewRecordId, draftStorageKey])

  const updateObjectiveAnswer = (problemId, type, value) => {
    if (isReviewMode) return
    persistDraft((current) => ({ ...current, objectiveAnswers: { ...current.objectiveAnswers, [problemId]: normalizeObjectiveAnswer(type, value) } }))
  }

  const toggleFlag = (problemId) => {
    if (isReviewMode) return
    persistDraft((current) => ({ ...current, flags: { ...current.flags, [problemId]: !current.flags[problemId] } }))
  }

  const markDraftSaved = (message = '作业进度已保存到云端') => {
    if (isReviewMode) return
    const savedAt = new Date().toISOString()
    persistDraft((current) => {
      const nextDraft = { ...current, lastSavedAt: savedAt }
      api.saveHomeworkDraft(spaceId, homeworkId, { draft: JSON.stringify(nextDraft) }).catch(() => {})
      return nextDraft
    }, message)
  }

  const scrollToProblem = (problemId) => {
    setActiveProblemId(problemId)
    questionRefs.current[problemId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmitAll = async () => {
    if (isReviewMode) return
    if (isExpired) { setError('作业已截止，不能继续提交'); return }
    let objectiveCount = 0
    let programmingCount = 0
    try {
      setSubmittingAll(true); setError(''); setActionMessage('')
      for (const item of orderedItems) {
        const problemId = Number(item.problemId)
        const problem = item.problem
        const problemType = problem?.type || item.type
        if (problemType === 'programming') {
          const programmingDraft = draft.programming[problemId]
          const starter = pickStarter(problem?.bodyJson || {}, programmingDraft?.language || 'cpp')
          const hasDraftCode = Boolean(programmingDraft?.code?.trim()) && programmingDraft.code.trim() !== starter.trim()
          const shouldSubmitProgramming = hasDraftCode && Boolean(programmingDraft?.touched || programmingDraft?.lastSavedAt)
          if (!shouldSubmitProgramming) continue
          await api.submit(spaceId, problemId, { language: programmingDraft.language, sourceCode: programmingDraft.code, inputData: programmingDraft.customInput || '' })
          programmingCount += 1
          continue
        }
        const answer = normalizeObjectiveAnswer(problemType, draft.objectiveAnswers[problemId])
        if (!answer) continue
        await api.objectiveSubmit(spaceId, problemId, problemType === 'true_false' ? answer === 'true' : answer)
        objectiveCount += 1
      }
      const refreshedSubmissionPairs = await Promise.all(orderedItems.map(async (item) => {
        const problemId = Number(item.problemId)
        try { const result = await api.listSubmissions(spaceId, problemId); return [problemId, result?.submissions || []] }
        catch { return [problemId, submissionsByProblemId[problemId] || []] }
      }))
      const nextSubmissionsByProblemId = {}
      refreshedSubmissionPairs.forEach(([problemId, submissions]) => { nextSubmissionsByProblemId[problemId] = submissions })
      setSubmissionsByProblemId(nextSubmissionsByProblemId)
      const objectiveCounts = countObjectiveVerdicts(orderedItems, nextSubmissionsByProblemId)
      if (objectiveCount > 0 && (objectiveCounts.correct > 0 || objectiveCounts.wrong > 0)) {
        if (objectiveCounts.wrong > 0) {
          toast(`客观题：${objectiveCounts.correct} 道正确，${objectiveCounts.wrong} 道错误`, { description: '可重新作答后再提交', duration: 1000 })
        } else {
          toast.success(`客观题全部正确！(共 ${objectiveCounts.correct} 道)`, { duration: 1000 })
        }
      }
      const recordItems = orderedItems.map((item) => {
        const problemId = Number(item.problemId)
        const latestSubmission = nextSubmissionsByProblemId[problemId]?.[0]
        if (!latestSubmission?.id) return null
        return { problemId, submissionId: Number(latestSubmission.id) }
      }).filter(Boolean)
      if (recordItems.length === 0) { setActionMessage('当前没有可提交或可记录的作答内容'); return }
      try {
        const createdRecord = await api.createHomeworkSubmissionRecord(spaceId, homeworkId, { items: recordItems })
        await refreshHomeworkSubmissionRecords(createdRecord?.id)
        setActionMessage(`已提交 ${objectiveCount} 道客观题，${programmingCount} 道编程题已进入判题队列，并生成 1 条作业提交记录`)
      } catch (recordErr) {
        if (!isSubmissionRecordRouteUnavailable(recordErr)) throw recordErr
        console.warn('作业提交记录接口暂不可用，已跳过记录创建:', recordErr)
        setSubmissionRecordUnavailable(true)
        setActionMessage(`已提交 ${objectiveCount} 道客观题，${programmingCount} 道编程题已进入判题队列；当前后端未启用作业提交记录接口，所以这次不会出现在左侧记录列表中`)
      }
      localStorage.removeItem(draftStorageKey)
      api.deleteHomeworkDraft(spaceId, homeworkId).catch(() => {})
      const freshDraft = buildEmptyDraft(homework?.items || [], problemsById, normalizeDefaultLanguage(space?.defaultProgrammingLanguage))
      setDraft(freshDraft)
    } catch (err) { setError(err.message || '提交作业失败') }
    finally { setSubmittingAll(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">作业加载中...</div>

  if (error && !homework) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <Alert variant="destructive" className="max-w-lg">{error}</Alert>
        <Button variant="outline" asChild><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    )
  }

  if (!homework) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">作业不存在</div>

  const homeworkDisplayMode = homework.displayMode === 'list' ? 'list' : 'exam'

  const openRecordReview = (record) => {
    if (!record?.id) return
    navigate(buildInternalPathWithQuery(`/spaces/${spaceId}/homeworks/${homeworkId}`, { recordId: record.id, returnTo: `/spaces/${spaceId}/homeworks/${homeworkId}`, returnLabel: '返回作业' }))
  }

  // ---- Shared sub-renderers ----

  const renderCurrentRecordPanel = () => {
    if (!reviewRecord) return null
    const { objectiveWrongCount, programmingWrongCount } = getRecordWrongCounts(reviewRecord)
    return (
      <Card className="mb-3">
        <CardContent className="p-3">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold">当前作答记录</h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={recordStatusBadgeVariant(reviewRecord.statusText)}>{reviewRecord.statusText || '已提交'}</Badge>
            <Badge variant="outline">{formatDateTime(reviewRecord.createdAt)}</Badge>
            {reviewRecord.username ? <Badge variant="outline">用户 {reviewRecord.username}</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">客观错 {objectiveWrongCount} 道</Badge>
            <Badge variant="outline">编程错 {programmingWrongCount} 道</Badge>
            <Badge variant="outline">待判题 {reviewRecord.pendingCount || 0}</Badge>
          </div>
          <Button size="sm" variant="outline" asChild className="self-start">
            <Link to={`/spaces/${spaceId}/homeworks/${homeworkId}`}>返回当前作业</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
    )
  }

  const renderSubmissionRecordsPanel = () => (
    <Card className="mb-3">
      <CardContent className="p-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold">我的提交记录</h3>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <Badge variant="outline">{submissionRecords.length} 条</Badge>
          {space?.canManage ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/spaces/${spaceId}/homeworks/${homeworkId}/submission-records?returnTo=${allRecordsReturnTo}&returnLabel=${allRecordsReturnLabel}`}>全部记录</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {submissionRecords.length === 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {submissionRecordUnavailable ? '当前后端还没有启用作业提交记录接口，所以这里暂时不会生成记录。' : '还没有你的整卷提交记录。点击右上角"提交"后，这里会保存你的每次作业提交快照。'}
          </p>
          {submissionRecordUnavailable ? (
            <p className="text-xs text-amber-600">题目提交本身已正常完成；要让左侧记录列表生效，需要重启到最新后端版本。</p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto pr-0.5">
          {submissionRecords.map((record) => {
            const { objectiveWrongCount, programmingWrongCount } = getRecordWrongCounts(record)
            return (
              <Card key={record.id} className="p-2 cursor-pointer transition-colors hover:border-primary hover:shadow-md hover:-translate-y-px"
                onClick={() => openRecordReview(record)}>
                <p className="text-sm font-bold mb-1">{formatDateTime(record.createdAt)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">客观错 {objectiveWrongCount} 道</Badge>
                  <Badge variant="outline">编程错 {programmingWrongCount} 道</Badge>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      </CardContent>
    </Card>
  )

  const renderQuestionNavigatorGrid = () => (
    <div className="flex flex-col gap-2">
      {groupedItems.map((group) => (
        <div key={group.type}>
          <h4 className="text-xs font-bold mb-1">{group.title}</h4>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
            {group.items.map((item) => {
              const problemId = Number(item.problemId)
              const answered = answeredProblemIds.has(problemId)
              const active = Number(activeProblemId) === problemId
              const reviewState = getReviewProblemState(problemId)
              const isFlagged = flaggedProblemIds.has(problemId)
              return (
                <Button key={`${group.type}-${problemId}`} variant="outline"
                  className={cn(questionNavigatorClass({ active, answered, reviewState }), 'relative')}
                  onClick={() => scrollToProblem(problemId)}>
                  {item.displayOrder}
                  {isFlagged && <Flag className="absolute -bottom-0.5 -left-0.5 h-3 w-3 text-red-500 fill-red-500" />}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  const renderQuestionNavigatorPanel = () => (
    <Card><CardContent className="p-3">{renderQuestionNavigatorGrid()}</CardContent></Card>
  )

  const renderQuestionStatusPanel = () => (
    <Card>
      <CardContent className="p-2">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-bold">完成情况</h3>
        <div className="grid grid-cols-5 gap-1">
          {orderedItems.map((item) => {
            const problemId = Number(item.problemId)
            const answered = answeredProblemIds.has(problemId)
            const active = Number(activeProblemId) === problemId
            const reviewState = getReviewProblemState(problemId)
            const isFlagged = flaggedProblemIds.has(problemId)
            return (
              <Button key={`list-status-${problemId}`} variant="outline"
                className={cn(questionNavigatorClass({ active, answered, reviewState }), 'relative')}
                onClick={() => scrollToProblem(problemId)}>
                {item.displayOrder}
                {isFlagged && <Flag className="absolute -bottom-0.5 -left-0.5 h-3 w-3 text-red-500 fill-red-500" />}
              </Button>
            )
          })}
        </div>
      </div>
      </CardContent>
    </Card>
  )

  const openEditProblemFromHomework = async (problemId) => {
    try {
      const detail = await api.getProblem(spaceId, problemId, { includeAnswer: true })
      setEditingProblemId(problemId)
      setEditingProblem(detail)
    } catch (err) {
      setError(err.message || '加载题目失败')
    }
  }

  const renderProblemCard = (item, standalone = false) => {
    const problemId = Number(item.problemId)
    const problem = item.problem
    const problemType = problem?.type || item.type
    const body = problem?.bodyJson || {}
    const promptMarkdown = getProblemPromptText(problem, item.problemTitle || item.title || `题目 #${problemId}`)
    const programmingTitle = `${item.displayOrder}. ${problem?.title || item.problemTitle || item.title || `题目 #${problemId}`}`
    const objectiveValue = normalizeObjectiveAnswer(problemType, draft.objectiveAnswers[problemId])
    const isFlagged = Boolean(draft.flags[problemId])
    const reviewRecordItem = reviewRecordItemMap.get(problemId) || null
    const programmingReviewPath = reviewRecordItem?.submissionId
      ? buildInternalPathWithQuery(`/spaces/${spaceId}/homeworks/${homeworkId}/problems/${problemId}`, {
          submissionId: reviewRecordItem.submissionId, recordId: reviewRecordId, returnTo: currentHomeworkPath, returnLabel: '返回作答记录'
        })
      : ''
    const programmingNormalPath = `/spaces/${spaceId}/homeworks/${homeworkId}/problems/${problemId}?returnTo=${programmingReturnTo}&returnLabel=${programmingReturnLabel}`

    return (
      <div
        key={problemId}
        ref={(node) => { questionRefs.current[problemId] = node }}
        className={cn(
          standalone ? 'px-2 md:px-6 py-1 md:py-1.5' : 'px-2 md:px-5 py-[0.65rem]',
          !standalone && 'border-b',
          Number(activeProblemId) === problemId ? 'bg-sky-50/40' : 'bg-white'
        )}
        style={{ scrollMarginTop: 84 }}
      >
        <div className="flex justify-between items-start gap-1 mb-1">
          <div className="min-w-0 flex-1 flex items-start gap-1">
            {!isReviewMode && (
              <Button variant="ghost" size="icon"
                className={cn('h-5 w-5 -ml-0.5 shrink-0', isFlagged ? 'text-red-500' : 'text-muted-foreground/40 hover:text-red-400')}
                title={isFlagged ? '取消标记' : '标记本题'}
                onClick={() => { setActiveProblemId(problemId); toggleFlag(problemId) }}>
                <Flag className={cn('h-3.5 w-3.5', isFlagged && 'fill-red-500')} />
              </Button>
            )}
            {problemType === 'programming' ? (
              <h3 className={cn('font-semibold leading-relaxed whitespace-pre-wrap break-words', standalone ? 'text-sm md:text-[0.98rem]' : 'text-sm md:text-base')}>
                {programmingTitle}
              </h3>
            ) : (
              <MarkdownWithMarker
                marker={`${item.displayOrder}.`}
                content={promptMarkdown}
                className="gap-x-[0.4rem] mb-[0.35rem]"
                markerClassName={cn('font-semibold leading-relaxed', standalone ? 'text-sm md:text-[0.98rem] min-w-[2.4ch]' : 'text-sm md:text-base min-w-[2.4ch]')}
                contentClassName={cn(
                  'font-semibold leading-relaxed',
                  standalone ? 'text-sm md:text-[0.98rem]' : 'text-sm md:text-base',
                  '[&_h1]:mt-[0.15rem] [&_h1]:mb-[0.25rem] [&_h1]:text-inherit [&_h1]:font-inherit [&_h1]:leading-inherit',
                  '[&_h2]:mt-[0.15rem] [&_h2]:mb-[0.25rem] [&_h2]:text-inherit [&_h2]:font-inherit [&_h2]:leading-inherit',
                  '[&_h3]:mt-[0.15rem] [&_h3]:mb-[0.25rem] [&_h3]:text-inherit [&_h3]:font-inherit [&_h3]:leading-inherit',
                  '[&_h4]:mt-[0.15rem] [&_h4]:mb-[0.25rem] [&_h4]:text-inherit [&_h4]:font-inherit [&_h4]:leading-inherit',
                  '[&_p]:my-[0.1rem] [&_ul]:my-[0.3rem] [&_ol]:my-[0.3rem] [&_pre]:my-[0.5rem]'
                )}
              />
            )}
          </div>

          {!isReviewMode && space?.canManage && (
            <Button variant="ghost" size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
              title="编辑本题"
              onClick={() => openEditProblemFromHomework(problemId)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div onMouseEnter={() => setActiveProblemId(problemId)}>
          {problemType === 'programming' ? (
            <div className="flex justify-between items-center gap-1.5 flex-wrap pt-0.5">
              <p className="text-sm text-muted-foreground">
                时间限制：{problem?.timeLimitMs || '-'}ms | 内存限制：{problem?.memoryLimitMiB || '-'}MiB
              </p>
              <Button size="sm" asChild disabled={isReviewMode && !reviewRecordItem?.submissionId}>
                <Link to={isReviewMode ? programmingReviewPath : programmingNormalPath}>
                  {isReviewMode ? (reviewRecordItem?.submissionId ? '查看提交代码' : '本次未提交') : '进入编程'}
                </Link>
              </Button>
            </div>
          ) : (() => {
              const answerJson = problem?.answerJson || {}
              const correctAnswer = problemType === 'single_choice' && typeof answerJson.answerIndex === 'number'
                ? (body.options || [])[answerJson.answerIndex]
                : answerJson.answer
              const userAnswer = objectiveValue
              let isCorrect = false
              if (problemType === 'single_choice') {
                isCorrect = correctAnswer !== undefined && correctAnswer !== null && userAnswer === String(correctAnswer)
              } else if (problemType === 'true_false') {
                isCorrect = (userAnswer === 'true') === Boolean(correctAnswer)
              }
              const correctLabel = problemType === 'true_false'
                ? (correctAnswer === true || correctAnswer === 'true' ? '正确' : '错误')
                : null
              const correctIndex = problemType === 'single_choice' ? answerJson.answerIndex : -1
              const showCorrectHint = isReviewMode && !isCorrect && correctAnswer !== undefined && correctAnswer !== null

              return (
            <div className="flex flex-col gap-0.5">
              {showCorrectHint && (
                <div className="mb-1 text-xs">
                  {problemType === 'single_choice' && (
                    <span className="text-green-700 font-medium">
                      正确答案：{correctIndex >= 0 ? alphaOptionLabel(correctIndex) : String(correctAnswer)}
                    </span>
                  )}
                  {problemType === 'true_false' && (
                    <span className="text-green-700 font-medium">正确答案：{correctLabel}</span>
                  )}
                </div>
              )}
              {problemType === 'single_choice' ? (
                <fieldset className="w-full">
                  <RadioGroup
                    value={objectiveValue}
                    disabled={isReviewMode}
                    onValueChange={(value) => updateObjectiveAnswer(problemId, problemType, value)}
                    className="gap-0.5"
                  >
                    {(body.options || []).map((option, index) => {
                      const isUserSelection = isReviewMode && String(option) === userAnswer
                      return (
                      <Label
                        key={`${problemId}-${index}`}
                        htmlFor={`hw-opt-${problemId}-${index}`}
                        className={cn(
                          'flex items-start gap-2 py-0.5 px-2 rounded cursor-pointer transition-colors',
                          !isReviewMode && 'hover:bg-slate-50',
                          !isReviewMode && objectiveValue === String(option) && 'bg-slate-50'
                        )}
                      >
                        <RadioGroupItem
                          value={String(option)}
                          id={`hw-opt-${problemId}-${index}`}
                          className={cn(
                            'mt-0.5',
                            isUserSelection && isCorrect && 'border-green-600 text-green-600 opacity-100',
                            isUserSelection && !isCorrect && 'border-red-600 text-red-600 opacity-100'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <MarkdownWithMarker
                            marker={`${alphaOptionLabel(index)}.`}
                            content={String(option || '')}
                            className="gap-x-[0.35rem]"
                            markerClassName="min-w-[1.8ch]"
                            contentClassName="text-[0.92rem] md:text-[0.98rem] [&_p]:my-[0.2rem] [&_ul]:my-[0.3rem] [&_ol]:my-[0.3rem] [&_pre]:my-[0.5rem] [&_pre]:text-[0.78rem] md:[&_pre]:text-[0.82rem]"
                          />
                        </div>
                      </Label>
                      )
                    })}
                  </RadioGroup>
                </fieldset>
              ) : (
                <fieldset className="w-full">
                  <RadioGroup
                    value={objectiveValue}
                    disabled={isReviewMode}
                    onValueChange={(value) => updateObjectiveAnswer(problemId, problemType, value)}
                    className="gap-0.5"
                  >
                    <Label
                      htmlFor={`hw-opt-${problemId}-true`}
                      className={cn(
                        'flex items-center gap-2 py-0.5 px-2 rounded cursor-pointer transition-colors',
                        !isReviewMode && 'hover:bg-slate-50',
                        !isReviewMode && objectiveValue === 'true' && 'bg-slate-50'
                      )}
                    >
                      <RadioGroupItem
                        value="true"
                        id={`hw-opt-${problemId}-true`}
                        className={cn(
                          'mt-0.5',
                          isReviewMode && isCorrect && objectiveValue === 'true' && 'border-green-600 text-green-600 opacity-100',
                          isReviewMode && !isCorrect && objectiveValue === 'true' && 'border-red-600 text-red-600 opacity-100'
                        )}
                      />
                      <span className="text-sm md:text-[0.98rem]">正确</span>
                    </Label>
                    <Label
                      htmlFor={`hw-opt-${problemId}-false`}
                      className={cn(
                        'flex items-center gap-2 py-0.5 px-2 rounded cursor-pointer transition-colors',
                        !isReviewMode && 'hover:bg-slate-50',
                        !isReviewMode && objectiveValue === 'false' && 'bg-slate-50'
                      )}
                    >
                      <RadioGroupItem
                        value="false"
                        id={`hw-opt-${problemId}-false`}
                        className={cn(
                          'mt-0.5',
                          isReviewMode && isCorrect && objectiveValue === 'false' && 'border-green-600 text-green-600 opacity-100',
                          isReviewMode && !isCorrect && objectiveValue === 'false' && 'border-red-600 text-red-600 opacity-100'
                        )}
                      />
                      <span className="text-sm md:text-[0.98rem]">错误</span>
                    </Label>
                  </RadioGroup>
                </fieldset>
              )}
            </div>
              )})()}
        </div>
      </div>
    )
  }

  // ---- Main render ----

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
        <div className="flex items-center min-h-10 md:min-h-14 px-2 md:px-6 py-1 gap-1 md:gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 md:gap-2 min-w-0">
              <h1 className="text-xs md:text-sm font-extrabold leading-tight truncate">{homework.title}</h1>
              <Badge variant="outline" className="text-[10px] md:text-xs">{homeworkDisplayModeText(homeworkDisplayMode)}</Badge>
              {isReviewMode ? <Badge variant="outline" className="border-primary text-primary text-[10px] md:text-xs">作答记录回看</Badge> : null}
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
            {/* Mobile: question navigator toggle */}
            <Button variant="outline" size="sm" className="md:hidden h-7 w-7 p-0" onClick={() => setShowMobileSidebar(true)} title="题目导航">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" asChild><Link to={backTo}>{backLabel}</Link></Button>
            {!isReviewMode && space?.canManage ? (
              <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" asChild>
                <Link to={`/spaces/${spaceId}/homeworks/${homeworkId}/submission-records?returnTo=${allRecordsReturnTo}&returnLabel=${allRecordsReturnLabel}`}>
                  全部提交记录
                </Link>
              </Button>
            ) : null}
            {!isReviewMode ? (
              <>
                <Button variant="secondary" size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" onClick={() => markDraftSaved()}>
                  <Save className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />保存
                </Button>
                <Button size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" disabled={submittingAll || isExpired} onClick={handleSubmitAll}>
                  {submittingAll ? '提交中...' : '提交'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {homeworkDisplayMode === 'exam' ? (
        <div className="flex items-start p-3 md:p-4 gap-3 flex-col md:flex-row">
          {/* Mobile: question navigator drawer */}
          <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-left text-base">题目导航</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto max-h-[calc(100vh-100px)]">
                {renderQuestionNavigatorGrid()}
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop sidebar: sticky on scroll */}
          <aside className="w-full md:w-[250px] shrink-0 md:sticky md:top-[60px]">
            {isReviewMode ? renderCurrentRecordPanel() : renderSubmissionRecordsPanel()}
            <div className="hidden md:block">{renderQuestionNavigatorPanel()}</div>
          </aside>

          <div className="flex-1 min-w-0">
            {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
            {actionMessage && <ToastMessage message={actionMessage} severity="success" onShown={() => setActionMessage('')} />}

            <div className="flex flex-col gap-2">
              {groupedItems.map((group) => (
                <Card key={group.type} className="overflow-hidden">
                  <div className="px-4 md:px-5 pt-[0.55rem] pb-[0.2rem]">
                    <h3 className="text-xs font-bold text-muted-foreground">{group.title}</h3>
                  </div>
                  <div className="flex flex-col">
                    {group.items.map((item) => renderProblemCard(item))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] items-start p-3 md:p-4 gap-3">
          <aside className="md:sticky md:top-[60px]">
            {isReviewMode ? renderCurrentRecordPanel() : renderSubmissionRecordsPanel()}
            <div className="hidden md:block">{renderQuestionStatusPanel()}</div>
          </aside>

          <div className="min-w-0">
            {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
            {actionMessage && <ToastMessage message={actionMessage} severity="success" onShown={() => setActionMessage('')} />}

            <Card className="mb-2">
              <CardContent className="p-2">
              <h2 className="text-base font-bold mb-1">题目列表</h2>
              <p className="text-sm text-muted-foreground">
                当前按题单形式展示，题目按作业顺序依次排列；保存和提交逻辑与试卷模式一致。
              </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-col">
                {orderedItems.map((item, index) => (
                  <div key={item.problemId} className={index === orderedItems.length - 1 ? '' : 'border-b'}>
                    {renderProblemCard(item, true)}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
      {editingProblem && (
        <ProblemEditor
          open={editingProblemId != null}
          mode="edit"
          problem={editingProblem}
          spaceId={spaceId}
          problemOptions={[]}
          onClose={() => { setEditingProblemId(null); setEditingProblem(null) }}
          onSubmit={async (problemData) => {
            await api.updateSpaceProblem(spaceId, editingProblemId, problemData)
            const updated = await api.getProblem(spaceId, editingProblemId, { includeAnswer: true })
            const nextProblemsById = { ...problemsById, [editingProblemId]: updated }
            setProblemsById(nextProblemsById)
            setEditingProblemId(null)
            setEditingProblem(null)
            toast.success('题目已保存')
          }}
        />
      )}
    </div>
  )
}
