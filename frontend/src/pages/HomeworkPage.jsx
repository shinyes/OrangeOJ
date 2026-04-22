import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { MarkdownWithMarker } from '../components/MarkdownContent'
import ToastMessage from '../components/ToastMessage'

const sectionTitleMap = {
  single_choice: '一、单选题',
  true_false: '二、判断题',
  programming: '三、编程题'
}

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) {
    return path
  }
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
  return 'cpp'
}

function pickStarter(body, language) {
  if (!body?.starterCode) {
    if (language === 'python') return 'print("hello")'
    if (language === 'go') {
      return 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
    }
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
  if (type === 'true_false') {
    return value === 'false' ? 'false' : value === 'true' ? 'true' : ''
  }
  return String(value || '')
}

function loadStoredDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return {
        objectiveAnswers: {},
        flags: {},
        programming: {},
        lastSavedAt: ''
      }
    }
    const parsed = JSON.parse(raw)
    return {
      objectiveAnswers: parsed?.objectiveAnswers && typeof parsed.objectiveAnswers === 'object' ? parsed.objectiveAnswers : {},
      flags: parsed?.flags && typeof parsed.flags === 'object' ? parsed.flags : {},
      programming: parsed?.programming && typeof parsed.programming === 'object' ? parsed.programming : {},
      lastSavedAt: String(parsed?.lastSavedAt || '')
    }
  } catch {
    return {
      objectiveAnswers: {},
      flags: {},
      programming: {},
      lastSavedAt: ''
    }
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
  const nextDraft = {
    objectiveAnswers: {},
    flags: {},
    programming: {},
    lastSavedAt: ''
  }

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

function getProblemPromptText(problem, fallback = '暂无题面') {
  const statement = String(problem?.statementMd || '').trim()
  if (statement) return statement
  const title = String(problem?.title || '').trim()
  return title || fallback
}

function renderChoiceOptionLabel(index, option) {
  return (
    <MarkdownWithMarker
      marker={`${alphaOptionLabel(index)}.`}
      content={String(option || '')}
      sx={{
        columnGap: 0.35
      }}
      markerSx={{
        minWidth: '1.8ch'
      }}
      contentSx={{
        fontSize: '0.98rem',
        '& p': {
          my: 0.2
        },
        '& ul, & ol': {
          my: 0.3
        },
        '& pre': {
          my: 0.6,
          fontSize: '0.82rem'
        }
      }}
    />
  )
}

function objectiveOptionRowSx(selected) {
  return {
    my: 0,
    mr: 0,
    ml: 0,
    width: '100%',
    alignItems: 'flex-start',
    borderRadius: 1,
    px: 0.75,
    py: 0.15,
    bgcolor: 'transparent',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      bgcolor: 'rgba(15, 23, 42, 0.03)'
    },
    '.MuiFormControlLabel-label': {
      flexGrow: 1,
      minWidth: 0
    },
    '.MuiButtonBase-root': {
      p: 0.35,
      mt: 0.1,
      mr: 0.85
    }
  }
}

function recordStatusChipColor(statusText) {
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
    if (isPending || !isWrong) {
      return
    }
    if (item?.problemType === 'programming') {
      programmingWrongCount += 1
      return
    }
    objectiveWrongCount += 1
  })

  return { objectiveWrongCount, programmingWrongCount }
}

function isSubmissionRecordRouteUnavailable(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('405') || message.includes('method not allowed') || message.includes('404')
}

export default function HomeworkPage() {
  const { spaceId, homeworkId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [space, setSpace] = useState(null)
  const [homework, setHomework] = useState(null)
  const [problemsById, setProblemsById] = useState({})
  const [submissionsByProblemId, setSubmissionsByProblemId] = useState({})
  const [submissionRecords, setSubmissionRecords] = useState([])
  const [submissionRecordUnavailable, setSubmissionRecordUnavailable] = useState(false)
  const [reviewRecord, setReviewRecord] = useState(null)
  const [draft, setDraft] = useState({
    objectiveAnswers: {},
    flags: {},
    programming: {},
    lastSavedAt: ''
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  const [activeProblemId, setActiveProblemId] = useState(null)
  const [submittingAll, setSubmittingAll] = useState(false)
  const questionRefs = useRef({})

  const draftStorageKey = `orangeoj:homework:${spaceId}:${homeworkId}:draft`
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
    return items.map((item, index) => ({
      ...item,
      displayOrder: index + 1,
      problem: problemsById[item.problemId] || null
    }))
  }, [homework, problemsById])

  const groupedItems = useMemo(() => {
    return ['single_choice', 'true_false', 'programming']
      .map((type) => ({
        type,
        title: sectionTitleMap[type] || problemTypeText(type),
        items: orderedItems.filter((item) => (item.problem?.type || item.type) === type)
      }))
      .filter((group) => group.items.length > 0)
  }, [orderedItems])

  const reviewRecordItemMap = useMemo(() => {
    const map = new Map()
    ;(reviewRecord?.items || []).forEach((item) => {
      map.set(Number(item.problemId), item)
    })
    return map
  }, [reviewRecord])

  const currentHomeworkPath = useMemo(() => {
    if (!isReviewMode || !reviewRecordId) {
      return `/spaces/${spaceId}/homeworks/${homeworkId}`
    }
    return buildInternalPathWithQuery(`/spaces/${spaceId}/homeworks/${homeworkId}`, {
      recordId: reviewRecordId
    })
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
        if (programmingDraft?.submissionId || programmingDraft?.lastSavedAt) {
          ids.add(problemId)
        }
        return
      }

      const answer = normalizeObjectiveAnswer(problemType, draft.objectiveAnswers[problemId])
      const hasSubmission = submissions.some((submission) => submission.questionType !== 'programming')
      if (answer || hasSubmission) {
        ids.add(problemId)
      }
    })
    return ids
  }, [draft, orderedItems, submissionsByProblemId])

  const flaggedProblemIds = useMemo(() => {
    return new Set(
      Object.entries(draft.flags)
        .filter(([, value]) => value)
        .map(([problemId]) => Number(problemId))
    )
  }, [draft.flags])

  const countdownText = useMemo(() => formatCountdown(homework?.dueAt, now), [homework?.dueAt, now])
  const isExpired = countdownText === '已截止'

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const persistDraft = (updater, message = '') => {
    setDraft((current) => {
      const nextDraft = typeof updater === 'function' ? updater(current) : updater
      localStorage.setItem(draftStorageKey, JSON.stringify(nextDraft))
      return nextDraft
    })
    if (message) {
      setActionMessage(message)
    }
  }

  const refreshHomeworkSubmissionRecords = async (preferredRecordId = null) => {
    try {
      const result = await api.listHomeworkSubmissionRecords(spaceId, homeworkId)
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
    const [spaceData, homeworkData, homeworkRecordData] = await Promise.all([
      api.getSpace(spaceId),
      api.getHomework(spaceId, homeworkId),
      api.listHomeworkSubmissionRecords(spaceId, homeworkId).catch((err) => {
        if (isSubmissionRecordRouteUnavailable(err)) {
          return { records: [], unavailable: true }
        }
        return { records: [] }
      })
    ])

    const uniqueProblemIds = Array.from(
      new Set(
        (homeworkData?.items || [])
          .map((item) => Number(item.problemId))
          .filter((problemId) => Number.isInteger(problemId) && problemId > 0)
      )
    )

    const problemList = await Promise.all(uniqueProblemIds.map((problemId) => api.getProblem(spaceId, problemId)))

    const nextProblemsById = {}
    problemList.forEach((problem) => {
      nextProblemsById[problem.id] = problem
    })

    const nextSubmissionsByProblemId = {}
    let initialDraft = null
    let nextReviewRecord = null

    if (isReviewMode) {
      nextReviewRecord = (homeworkRecordData?.records || []).find((record) => Number(record.id) === reviewRecordId) || null
      if (!nextReviewRecord) {
        throw new Error('当前作业记录不存在')
      }

      uniqueProblemIds.forEach((problemId) => {
        nextSubmissionsByProblemId[problemId] = []
      })

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

      initialDraft = buildRecordReviewDraft(
        homeworkData?.items || [],
        nextProblemsById,
        submissionDetailsByProblemId,
        normalizeDefaultLanguage(spaceData?.defaultProgrammingLanguage)
      )
    } else {
      const submissionPairs = await Promise.all(uniqueProblemIds.map(async (problemId) => {
        try {
          const result = await api.listSubmissions(spaceId, problemId)
          return [problemId, result?.submissions || []]
        } catch {
          return [problemId, []]
        }
      }))

      submissionPairs.forEach(([problemId, submissions]) => {
        nextSubmissionsByProblemId[problemId] = submissions
      })

      const storedDraft = loadStoredDraft(draftStorageKey)
      initialDraft = buildInitialDraft(
        homeworkData?.items || [],
        nextProblemsById,
        nextSubmissionsByProblemId,
        storedDraft,
        normalizeDefaultLanguage(spaceData?.defaultProgrammingLanguage)
      )
    }

    setSpace(spaceData)
    setHomework(homeworkData)
    setProblemsById(nextProblemsById)
    setSubmissionsByProblemId(nextSubmissionsByProblemId)
    setSubmissionRecords(homeworkRecordData?.records || [])
    setSubmissionRecordUnavailable(Boolean(homeworkRecordData?.unavailable))
    setReviewRecord(nextReviewRecord)
    setDraft(initialDraft)

    if (!activeProblemId && homeworkData?.items?.length) {
      setActiveProblemId(Number(homeworkData.items[0].problemId))
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        setActionMessage('')
        await loadData()
      } catch (err) {
        setError(err.message || '作业加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, homeworkId, reviewRecordId])

  const updateObjectiveAnswer = (problemId, type, value) => {
    if (isReviewMode) return
    persistDraft((current) => ({
      ...current,
      objectiveAnswers: {
        ...current.objectiveAnswers,
        [problemId]: normalizeObjectiveAnswer(type, value)
      }
    }))
  }

  const toggleFlag = (problemId) => {
    if (isReviewMode) return
    persistDraft((current) => ({
      ...current,
      flags: {
        ...current.flags,
        [problemId]: !current.flags[problemId]
      }
    }))
  }

  const markDraftSaved = (message = '作业草稿已保存到本地') => {
    if (isReviewMode) return
    const savedAt = new Date().toISOString()
    persistDraft((current) => ({
      ...current,
      lastSavedAt: savedAt
    }), message)
  }

  const scrollToProblem = (problemId) => {
    setActiveProblemId(problemId)
    questionRefs.current[problemId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmitAll = async () => {
    if (isReviewMode) {
      return
    }
    if (isExpired) {
      setError('作业已截止，不能继续提交')
      return
    }

    let objectiveCount = 0
    let programmingCount = 0

    try {
      setSubmittingAll(true)
      setError('')
      setActionMessage('')

      for (const item of orderedItems) {
        const problemId = Number(item.problemId)
        const problem = item.problem
        const problemType = problem?.type || item.type

        if (problemType === 'programming') {
          const programmingDraft = draft.programming[problemId]
          const starter = pickStarter(problem?.bodyJson || {}, programmingDraft?.language || 'cpp')
          const hasDraftCode = Boolean(programmingDraft?.code?.trim()) && programmingDraft.code.trim() !== starter.trim()
          const shouldSubmitProgramming = hasDraftCode && Boolean(programmingDraft?.touched || programmingDraft?.lastSavedAt)
          if (!shouldSubmitProgramming) {
            continue
          }
          await api.submit(spaceId, problemId, {
            language: programmingDraft.language,
            sourceCode: programmingDraft.code,
            inputData: programmingDraft.customInput || ''
          })
          programmingCount += 1
          continue
        }

        const answer = normalizeObjectiveAnswer(problemType, draft.objectiveAnswers[problemId])
        if (!answer) {
          continue
        }
        await api.objectiveSubmit(
          spaceId,
          problemId,
          problemType === 'true_false' ? answer === 'true' : answer
        )
        objectiveCount += 1
      }

      const refreshedSubmissionPairs = await Promise.all(orderedItems.map(async (item) => {
        const problemId = Number(item.problemId)
        try {
          const result = await api.listSubmissions(spaceId, problemId)
          return [problemId, result?.submissions || []]
        } catch {
          return [problemId, submissionsByProblemId[problemId] || []]
        }
      }))

      const nextSubmissionsByProblemId = {}
      refreshedSubmissionPairs.forEach(([problemId, submissions]) => {
        nextSubmissionsByProblemId[problemId] = submissions
      })
      setSubmissionsByProblemId(nextSubmissionsByProblemId)

      const recordItems = orderedItems
        .map((item) => {
          const problemId = Number(item.problemId)
          const latestSubmission = nextSubmissionsByProblemId[problemId]?.[0]
          if (!latestSubmission?.id) {
            return null
          }
          return {
            problemId,
            submissionId: Number(latestSubmission.id)
          }
        })
        .filter(Boolean)

      if (recordItems.length === 0) {
        setActionMessage('当前没有可提交或可记录的作答内容')
        return
      }

      try {
        const createdRecord = await api.createHomeworkSubmissionRecord(spaceId, homeworkId, {
          items: recordItems
        })
        await refreshHomeworkSubmissionRecords(createdRecord?.id)
        markDraftSaved(`已提交 ${objectiveCount} 道客观题，${programmingCount} 道编程题已进入判题队列，并生成 1 条作业提交记录`)
      } catch (recordErr) {
        if (!isSubmissionRecordRouteUnavailable(recordErr)) {
          throw recordErr
        }
        console.warn('作业提交记录接口暂不可用，已跳过记录创建:', recordErr)
        setSubmissionRecordUnavailable(true)
        markDraftSaved(`已提交 ${objectiveCount} 道客观题，${programmingCount} 道编程题已进入判题队列；当前后端未启用作业提交记录接口，所以这次不会出现在左侧记录列表中`)
      }
    } catch (err) {
      setError(err.message || '提交作业失败')
    } finally {
      setSubmittingAll(false)
    }
  }

  if (loading) {
    return <div className="screen-center">作业加载中...</div>
  }

  if (error && !homework) {
    return (
      <div className="page-shell">
        <div className="error-box">{error}</div>
        <Link className="ghost-btn" to={backTo}>{backLabel}</Link>
      </div>
    )
  }

  if (!homework) {
    return <div className="screen-center">作业不存在</div>
  }

  const homeworkDisplayMode = homework.displayMode === 'list' ? 'list' : 'exam'

  const openRecordReview = (record) => {
    if (!record?.id) return
    navigate(
      buildInternalPathWithQuery(`/spaces/${spaceId}/homeworks/${homeworkId}`, {
        recordId: record.id,
        returnTo: `/spaces/${spaceId}/homeworks/${homeworkId}`,
        returnLabel: '返回作业'
      })
    )
  }

  const renderCurrentRecordPanel = () => {
    if (!reviewRecord) return null
    const { objectiveWrongCount, programmingWrongCount } = getRecordWrongCounts(reviewRecord)
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Stack spacing={1.1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            当前作答记录
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" color={recordStatusChipColor(reviewRecord.statusText)} label={reviewRecord.statusText || '已提交'} />
            <Chip size="small" variant="outlined" label={formatDateTime(reviewRecord.createdAt)} />
            {reviewRecord.username ? <Chip size="small" variant="outlined" label={`用户 ${reviewRecord.username}`} /> : null}
          </Stack>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" variant="outlined" label={`客观错 ${objectiveWrongCount} 道`} />
            <Chip size="small" variant="outlined" label={`编程错 ${programmingWrongCount} 道`} />
            <Chip size="small" variant="outlined" label={`待判题 ${reviewRecord.pendingCount || 0}`} />
          </Stack>
          <Button
            size="small"
            variant="outlined"
            component={Link}
            to={`/spaces/${spaceId}/homeworks/${homeworkId}`}
            sx={{ alignSelf: 'flex-start' }}
          >
            返回当前作业
          </Button>
        </Stack>
      </Paper>
    )
  }

  const renderSubmissionRecordsPanel = () => (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          我的提交记录
        </Typography>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent="flex-end">
          <Chip size="small" label={`${submissionRecords.length} 条`} variant="outlined" />
          {space?.canManage ? (
            <Button
              size="small"
              variant="outlined"
              component={Link}
              to={`/spaces/${spaceId}/homeworks/${homeworkId}/submission-records?returnTo=${allRecordsReturnTo}&returnLabel=${allRecordsReturnLabel}`}
            >
              全部记录
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {submissionRecords.length === 0 ? (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {submissionRecordUnavailable
              ? '当前后端还没有启用作业提交记录接口，所以这里暂时不会生成记录。'
              : '还没有你的整卷提交记录。点击右上角“提交”后，这里会保存你的每次作业提交快照。'}
          </Typography>
          {submissionRecordUnavailable ? (
            <Typography variant="caption" color="warning.main">
              题目提交本身已正常完成；要让左侧记录列表生效，需要重启到最新后端版本。
            </Typography>
          ) : null}
        </Stack>
      ) : (
        <Stack spacing={1.25} sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}>
          {submissionRecords.map((record) => {
            const { objectiveWrongCount, programmingWrongCount } = getRecordWrongCounts(record)
            return (
              <Paper
                key={record.id}
                variant="outlined"
                onClick={() => openRecordReview(record)}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 2,
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  {formatDateTime(record.createdAt)}
                </Typography>

                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  <Chip size="small" variant="outlined" label={`客观错 ${objectiveWrongCount} 道`} />
                  <Chip size="small" variant="outlined" label={`编程错 ${programmingWrongCount} 道`} />
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Paper>
  )

  const renderQuestionNavigatorGrid = () => (
    <Stack spacing={2}>
      {groupedItems.map((group) => (
        <Box key={group.type}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {group.title}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 1 }}>
            {group.items.map((item) => {
              const problemId = Number(item.problemId)
              const answered = answeredProblemIds.has(problemId)
              const active = Number(activeProblemId) === problemId
              return (
                <Button
                  key={`${group.type}-${problemId}`}
                  variant="outlined"
                  onClick={() => scrollToProblem(problemId)}
                  sx={{
                    minWidth: 0,
                    px: 0,
                    py: 0,
                    height: 32,
                    borderRadius: 0.5,
                    borderColor: active ? 'primary.main' : answered ? '#8ecdf5' : 'divider',
                    bgcolor: answered ? '#bfe9ff' : '#fff',
                    color: answered ? '#1565c0' : 'text.primary',
                    fontWeight: 700,
                    boxShadow: active ? 'inset 0 0 0 1px rgba(25, 118, 210, 0.16)' : 'none',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: answered ? '#b3e5fc' : '#f8fbff'
                    }
                  }}
                >
                  {item.displayOrder}
                </Button>
              )
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  )

  const renderQuestionNavigatorPanel = () => (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      {renderQuestionNavigatorGrid()}
    </Paper>
  )

  const renderQuestionStatusPanel = () => (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          完成情况
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 1 }}>
          {orderedItems.map((item) => {
            const problemId = Number(item.problemId)
            const answered = answeredProblemIds.has(problemId)
            const active = Number(activeProblemId) === problemId
            return (
              <Button
                key={`list-status-${problemId}`}
                variant="outlined"
                onClick={() => scrollToProblem(problemId)}
                sx={{
                  minWidth: 0,
                  px: 0,
                  py: 0,
                  height: 32,
                  borderRadius: 0.5,
                  borderColor: active ? 'primary.main' : answered ? '#8ecdf5' : 'divider',
                  bgcolor: answered ? '#bfe9ff' : '#fff',
                  color: answered ? '#1565c0' : 'text.primary',
                  fontWeight: 700,
                  boxShadow: active ? 'inset 0 0 0 1px rgba(25, 118, 210, 0.16)' : 'none',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: answered ? '#b3e5fc' : '#f8fbff'
                  }
                }}
              >
                {item.displayOrder}
              </Button>
            )
          })}
        </Box>
      </Stack>
    </Paper>
  )

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
          submissionId: reviewRecordItem.submissionId,
          recordId: reviewRecordId,
          returnTo: currentHomeworkPath,
          returnLabel: '返回作答记录'
        })
      : ''
    const programmingNormalPath = `/spaces/${spaceId}/homeworks/${homeworkId}/problems/${problemId}?returnTo=${programmingReturnTo}&returnLabel=${programmingReturnLabel}`

    return (
      <Box
        key={problemId}
        ref={(node) => {
          questionRefs.current[problemId] = node
        }}
        sx={{
          px: standalone ? { xs: 1.75, md: 2.25 } : { xs: 2, md: 2.5 },
          py: standalone ? 1.5 : 1.65,
          borderBottom: standalone ? 'none' : '1px solid',
          borderColor: 'divider',
          bgcolor: Number(activeProblemId) === problemId ? 'rgba(227, 242, 253, 0.35)' : '#fff',
          scrollMarginTop: 84
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.85 }}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            {problemType === 'programming' ? (
              <Typography
                variant="h6"
                sx={{
                  fontSize: standalone ? '0.98rem' : '1rem',
                  fontWeight: 600,
                  mb: 0.35,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {programmingTitle}
              </Typography>
            ) : (
              <MarkdownWithMarker
                marker={`${item.displayOrder}.`}
                content={promptMarkdown}
                sx={{
                  mb: 0.35,
                  columnGap: 0.4
                }}
                markerSx={{
                  minWidth: '2.4ch',
                  fontSize: standalone ? '0.98rem' : '1rem',
                  fontWeight: 600,
                  lineHeight: 1.5
                }}
                contentSx={{
                  fontSize: standalone ? '0.98rem' : '1rem',
                  fontWeight: 600,
                  lineHeight: 1.5,
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    mt: 0.15,
                    mb: 0.25,
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    lineHeight: 'inherit'
                  },
                  '& p': {
                    my: 0.1
                  },
                  '& ul, & ol': {
                    my: 0.3
                  },
                  '& pre': {
                    my: 0.5
                  }
                }}
              />
            )}
          </Box>

          <Tooltip title={isFlagged ? '取消标记' : '标记本题'}>
            <IconButton
              size="small"
              color={isFlagged ? 'warning' : 'default'}
              disabled={isReviewMode}
              onClick={() => {
                setActiveProblemId(problemId)
                toggleFlag(problemId)
              }}
              sx={{
                mt: -0.2,
                color: isFlagged ? 'warning.main' : 'text.disabled'
              }}
            >
              {isFlagged ? <OutlinedFlagIcon fontSize="small" /> : <FlagOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <Box onMouseEnter={() => setActiveProblemId(problemId)}>
          {problemType === 'programming' ? (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', pt: 0.15 }}>
              <Typography variant="body2" color="text.secondary">
                时间限制：{problem?.timeLimitMs || '-'}ms | 内存限制：{problem?.memoryLimitMiB || '-'}MiB
              </Typography>
              <Button
                size="small"
                variant="contained"
                component={Link}
                to={isReviewMode ? programmingReviewPath : programmingNormalPath}
                disabled={isReviewMode && !reviewRecordItem?.submissionId}
              >
                {isReviewMode ? (reviewRecordItem?.submissionId ? '查看提交代码' : '本次未提交') : '进入编程'}
              </Button>
            </Box>
          ) : (
            <Stack spacing={0.35}>
              {problemType === 'single_choice' ? (
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <RadioGroup
                    value={objectiveValue}
                    disabled={isReviewMode}
                    onChange={(event) => updateObjectiveAnswer(problemId, problemType, event.target.value)}
                    sx={{ gap: 0.15 }}
                  >
                    {(body.options || []).map((option, index) => (
                      <FormControlLabel
                        key={`${problemId}-${index}`}
                        value={String(option)}
                        control={<Radio size="small" />}
                        disableTypography
                        label={renderChoiceOptionLabel(index, option)}
                        sx={objectiveOptionRowSx(objectiveValue === String(option))}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              ) : (
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <RadioGroup
                    value={objectiveValue}
                    disabled={isReviewMode}
                    onChange={(event) => updateObjectiveAnswer(problemId, problemType, event.target.value)}
                    sx={{ gap: 0.15 }}
                  >
                    <FormControlLabel
                      value="true"
                      control={<Radio size="small" />}
                      label="正确"
                      sx={{
                        ...objectiveOptionRowSx(objectiveValue === 'true'),
                        '.MuiFormControlLabel-label': {
                          flexGrow: 1,
                          minWidth: 0,
                          fontSize: '0.98rem'
                        }
                      }}
                    />
                    <FormControlLabel
                      value="false"
                      control={<Radio size="small" />}
                      label="错误"
                      sx={{
                        ...objectiveOptionRowSx(objectiveValue === 'false'),
                        '.MuiFormControlLabel-label': {
                          flexGrow: 1,
                          minWidth: 0,
                          fontSize: '0.98rem'
                        }
                      }}
                    />
                  </RadioGroup>
                </FormControl>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#eef2f7' }}>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar
          sx={{
            minHeight: '56px !important',
            px: { xs: 1.5, md: 2.5 },
            py: 0.5,
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 220 }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                {homework.title}
              </Typography>
              <Chip size="small" variant="outlined" label={`当前模式：${homeworkDisplayModeText(homeworkDisplayMode)}`} />
              {isReviewMode ? <Chip size="small" color="primary" variant="outlined" label="作答记录回看" /> : null}
            </Stack>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ minWidth: 180 }}
          >
            <Typography variant="body2" color="text.secondary">截止日期：{formatDateTime(homework.dueAt)}</Typography>
            <Typography variant="body2" color="text.secondary">当前时间：{new Date(now).toLocaleString()}</Typography>
            <Typography variant="body2" color="primary.main">
              {isReviewMode
                ? `记录时间：${formatDateTime(reviewRecord?.createdAt)}`
                : (draft.lastSavedAt ? `最近保存：${formatDateTime(draft.lastSavedAt)}` : '尚未手动保存')}
            </Typography>
          </Stack>

          <Stack spacing={0} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ minWidth: 140 }}>
            <Typography variant="caption" color="text.secondary">
              已答 {answeredProblemIds.size} 题，未答 {orderedItems.length - answeredProblemIds.size} 题，标记 {flaggedProblemIds.size} 题
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Button variant="outlined" component={Link} to={backTo}>
              {backLabel}
            </Button>
            {space?.canManage ? (
              <Button
                variant="outlined"
                component={Link}
                to={`/spaces/${spaceId}/homeworks/${homeworkId}/submission-records?returnTo=${allRecordsReturnTo}&returnLabel=${allRecordsReturnLabel}`}
              >
                全部提交记录
              </Button>
            ) : null}
            {!isReviewMode ? (
              <>
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<SaveRoundedIcon />}
                  onClick={() => markDraftSaved()}
                >
                  保存
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={submittingAll || isExpired}
                  onClick={handleSubmitAll}
                >
                  {submittingAll ? '提交中...' : '提交'}
                </Button>
              </>
            ) : null}
          </Stack>
        </Toolbar>
      </AppBar>

      {homeworkDisplayMode === 'exam' ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', p: { xs: 1.25, md: 1.5 }, gap: 1.5, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ width: { xs: '100%', md: 250 }, position: { md: 'sticky' }, top: { md: 72 }, alignSelf: 'flex-start' }}>
            {isReviewMode ? renderCurrentRecordPanel() : renderSubmissionRecordsPanel()}
            {renderQuestionNavigatorPanel()}
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
            {actionMessage && <ToastMessage message={actionMessage} severity="success" onShown={() => setActionMessage('')} />}

            <Stack spacing={1.5}>
              {groupedItems.map((group) => (
                <Paper key={group.type} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
                  <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 1.35, pb: 0.45 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      {group.title}
                    </Typography>
                  </Box>

                  <Stack spacing={0}>
                    {group.items.map((item) => renderProblemCard(item))}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' },
            alignItems: 'flex-start',
            p: { xs: 1.25, md: 1.5 },
            gap: 1.5
          }}
        >
          <Box sx={{ position: { md: 'sticky' }, top: { md: 72 }, alignSelf: 'flex-start' }}>
            {isReviewMode ? renderCurrentRecordPanel() : renderSubmissionRecordsPanel()}
            {renderQuestionStatusPanel()}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
            {actionMessage && <ToastMessage message={actionMessage} severity="success" onShown={() => setActionMessage('')} />}

            <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 3 }}>
              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  题目列表
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  当前按题单形式展示，题目按作业顺序依次排列；保存和提交逻辑与试卷模式一致。
                </Typography>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
              <Stack spacing={0}>
                {orderedItems.map((item, index) => (
                  <Box
                    key={item.problemId}
                    sx={{
                      borderBottom: index === orderedItems.length - 1 ? 'none' : '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {renderProblemCard(item, true)}
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Box>
        </Box>
      )}

    </Box>
  )
}
