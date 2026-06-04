import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { Alert } from '../components/ui/alert'
import { toast } from 'sonner'
import { X, History, Copy, Play, Save } from 'lucide-react'
import MarkdownContent from '../components/MarkdownContent'
import ToastMessage from '../components/ToastMessage'
import { useAuth } from '../hooks/useAuth'
import { homeworkDraftStorageKey } from '../utils/userScopedStorage'

const editorLang = { cpp: 'cpp', python: 'python', go: 'go' }

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) return path
  return fallback
}

function normalizeDefaultLanguage(language) {
  if (language === 'python') return 'python'
  if (language === 'go') return 'go'
  return 'cpp'
}

function pickStarter(body, language) {
  if (!body?.starterCode) {
    if (language === 'python') return 'print("hello")'
    if (language === 'go') return 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
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

function normalizeSubmissionCaseDetails(caseDetails) {
  if (!Array.isArray(caseDetails)) return []
  return caseDetails.map((item, index) => ({
    caseNo: Number(item?.caseNo || index + 1),
    verdict: item?.verdict || '',
    input: item?.input || '',
    output: item?.output || '',
    expectedOutput: item?.expectedOutput || '',
    error: item?.error || '',
    timeMs: Number(item?.timeMs || 0),
    memoryKiB: Number(item?.memoryKiB || 0)
  }))
}

function getSubmissionCaseSummary(submission) {
  const caseDetails = normalizeSubmissionCaseDetails(submission?.caseDetails)
  const totalCaseCount = caseDetails.length
  const passedCaseCount = caseDetails.filter((item) => item.verdict === 'AC' || item.verdict === 'OK').length
  const failedCaseCount = caseDetails.filter((item) => item.verdict && item.verdict !== 'AC' && item.verdict !== 'OK').length
  return { totalCaseCount, passedCaseCount, failedCaseCount }
}

export default function HomeworkProgrammingPage() {
  const { user } = useAuth()
  const { spaceId, homeworkId, problemId } = useParams()
  const [searchParams] = useSearchParams()
  const [space, setSpace] = useState(null)
  const [homework, setHomework] = useState(null)
  const [problem, setProblem] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [consoleText, setConsoleText] = useState('控制台已就绪')
  const [consoleVariant, setConsoleVariant] = useState('')
  const [runInputDialog, setRunInputDialog] = useState({ open: false, value: '' })
  const [submissions, setSubmissions] = useState([])
  const [showSubmissionHistory, setShowSubmissionHistory] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [selectedSubmissionCaseIndex, setSelectedSubmissionCaseIndex] = useState(0)
  const [submissionDetailTab, setSubmissionDetailTab] = useState('code')

  const numericProblemId = Number(problemId)
  const draftStorageKey = homeworkDraftStorageKey(user, spaceId, homeworkId)
  const defaultBackTo = `/spaces/${spaceId}/homeworks/${homeworkId}`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回作业'
  const reviewSubmissionId = Number(searchParams.get('submissionId') || 0)
  const isReviewMode = Number.isInteger(reviewSubmissionId) && reviewSubmissionId > 0
  const selectedSubmissionCaseDetails = selectedSubmission?.caseDetails || []
  const selectedSubmissionCase = selectedSubmissionCaseDetails[selectedSubmissionCaseIndex] || null
  const selectedSubmissionInput = selectedSubmissionCase?.input ?? selectedSubmission?.input ?? ''
  const selectedSubmissionOutput = selectedSubmissionCase?.output ?? selectedSubmission?.output ?? ''
  const selectedSubmissionExpectedOutput = selectedSubmissionCase?.expectedOutput ?? selectedSubmission?.expectedOutput ?? ''
  const selectedSubmissionError = selectedSubmissionCase?.error ?? selectedSubmission?.error ?? ''

  async function copyToClipboard(text, message) {
    try {
      await navigator.clipboard.writeText(text || '')
      toast.success(`${message}已复制`)
    } catch (err) {
      console.error('复制失败:', err)
      toast.error('复制失败')
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const persistProgrammingDraft = (updater, message = '') => {
    if (isReviewMode) return
    setDraft((current) => {
      const nextDraft = typeof updater === 'function' ? updater(current) : updater
      const stored = loadStoredDraft(draftStorageKey)
      const merged = {
        ...stored,
        lastSavedAt: nextDraft.lastSavedAt || stored.lastSavedAt || '',
        programming: { ...stored.programming, [numericProblemId]: nextDraft }
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(merged))
      api.saveHomeworkDraft(spaceId, homeworkId, { draft: JSON.stringify(merged) }).catch(() => {})
      return nextDraft
    })
    if (message) setActionMessage(message)
  }

  const refreshSubmissionHistory = async () => {
    try {
      const result = await api.listSubmissions(spaceId, numericProblemId, { all: true })
      setSubmissions(result?.submissions || [])
    } catch { /* non-blocking */ }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true); setError(''); setActionMessage('')
        const [spaceData, homeworkData, problemData] = await Promise.all([
          api.getSpace(spaceId),
          api.getHomework(spaceId, homeworkId),
          api.getProblem(spaceId, problemId)
        ])
        const homeworkHasProblem = (homeworkData?.items || []).some((item) => Number(item.problemId) === numericProblemId)
        if (!homeworkHasProblem) throw new Error('当前作业不包含这道编程题')
        if (problemData?.type !== 'programming') throw new Error('当前题目不是编程题')

        let nextDraft = null
        let nextSubmissions = []
        let nextSelectedSubmission = null
        let nextConsoleText = '控制台已就绪'

        if (isReviewMode) {
          const submissionDetail = await api.getSubmission(reviewSubmissionId)
          if (Number(submissionDetail?.problemId) !== numericProblemId) throw new Error('当前提交记录不属于这道编程题')
          const language = normalizeDefaultLanguage(submissionDetail?.language || spaceData?.defaultProgrammingLanguage)
          nextDraft = {
            language,
            code: submissionDetail?.sourceCode || '',
            customInput: submissionDetail?.inputData || '',
            touched: false,
            lastSavedAt: submissionDetail?.createdAt || '',
            submissionId: Number(submissionDetail?.id || 0)
          }
          nextSelectedSubmission = {
            ...submissionDetail,
            code: submissionDetail?.sourceCode || '',
            input: submissionDetail?.inputData || '',
            output: submissionDetail?.stdout || '',
            expectedOutput: submissionDetail?.expectedOutput || '',
            error: submissionDetail?.stderr || '',
            status: submissionDetail?.verdict || submissionDetail?.status || '',
            caseDetails: normalizeSubmissionCaseDetails(submissionDetail?.caseDetails)
          }
          nextSubmissions = [submissionDetail]
          nextConsoleText = `正在回看提交 #${submissionDetail?.id || '-'}\n结果：${submissionDetail?.verdict || submissionDetail?.status || '未知'}`
        } else {
          const submissionResult = await api.listSubmissions(spaceId, problemId, { all: true }).catch(() => ({ submissions: [] }))
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
          } catch { /* skip cloud merge */ }
          const savedProgramming = storedDraft.programming?.[numericProblemId] || {}
          const latestSubmission = (submissionResult?.submissions || []).find((item) => item.questionType === 'programming' && Number(item.userId) === Number(user?.id)) || null
          const language = normalizeDefaultLanguage(savedProgramming.language || latestSubmission?.language || spaceData?.defaultProgrammingLanguage)
          nextDraft = {
            language,
            code: savedProgramming.code ?? latestSubmission?.sourceCode ?? pickStarter(problemData?.bodyJson || {}, language),
            customInput: savedProgramming.customInput ?? latestSubmission?.inputData ?? '',
            touched: Boolean(savedProgramming.touched),
            lastSavedAt: savedProgramming.lastSavedAt || ''
          }
          nextSubmissions = submissionResult?.submissions || []
        }

        setSpace(spaceData)
        setHomework(homeworkData)
        setProblem(problemData)
        setDraft(nextDraft)
        setSubmissions(nextSubmissions)
        setSelectedSubmission(nextSelectedSubmission)
        setConsoleText(nextConsoleText)
      } catch (err) {
        setError(err.message || '编程题加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, homeworkId, problemId, reviewSubmissionId, draftStorageKey, user?.id, user?.userId, user?.username])

  const updateDraft = (patch) => {
    if (isReviewMode) return
    persistProgrammingDraft((current) => ({ ...current, ...patch, touched: true }))
  }

  const saveDraft = () => {
    if (isReviewMode) return
    const savedAt = new Date().toISOString()
    persistProgrammingDraft((current) => ({ ...current, lastSavedAt: savedAt }), '代码草稿已保存到云端')
  }

  const pollSubmission = async (submissionId, mode) => {
    for (let round = 0; round < 180; round += 1) {
      const snapshot = await api.pollSubmission(submissionId)
      if (mode === 'run') {
        setConsoleText(`${snapshot.stdout || ''}\n${snapshot.stderr || ''}`)
      } else {
        setConsoleText(`判题中... (${snapshot.verdict || '等待'})`)
      }
      if (snapshot.status === 'done' || snapshot.status === 'failed') return snapshot
      await new Promise((resolve) => setTimeout(resolve, snapshot.pollAfterMs || 1000))
    }
    throw new Error('判题等待超时，请稍后再试')
  }

  const handleProgrammingRunOrTest = async (mode, programmingOverride = null) => {
    if (isReviewMode) return
    const nextDraft = programmingOverride || draft
    if (!nextDraft) return
    try {
      setRunning(true); setError(''); setActionMessage('')
      setConsoleText(`[${new Date().toLocaleTimeString()}] 开始${mode === 'run' ? '运行' : '测试'}...`)
      setConsoleVariant('')
      const payload = { language: nextDraft.language, sourceCode: nextDraft.code, inputData: nextDraft.customInput || '' }
      const created = mode === 'run'
        ? await api.run(spaceId, numericProblemId, payload)
        : await api.test(spaceId, numericProblemId, payload)
      const result = await pollSubmission(created.submissionId, mode)
      if (mode === 'test') {
        if (result.verdict === 'CE') {
          setConsoleText(`测试结果 编译失败\n\n${result.stderr || result.error || ''}`)
          setConsoleVariant('error')
        } else if (result.verdict === 'AC') {
          setConsoleText(`测试结果 通过`)
          setConsoleVariant('success')
        } else {
          setConsoleText(`测试结果 未通过`)
          setConsoleVariant('error')
        }
      } else {
        if (result.exitCode === 0) {
          setConsoleText(`运行结束，返回码：0`)
          setConsoleVariant('success')
        }
      }
      await refreshSubmissionHistory()
    } catch (err) {
      setError(err.message || '运行失败')
      setConsoleVariant('error')
      if (mode === 'run') {
        setConsoleText((current) => `${current}\n${err.message || '运行失败'}`)
      } else {
        setConsoleText(`错误：${err.message || '运行失败'}`)
      }
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">编程题加载中...</div>

  if (error && (!problem || !draft)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <Alert variant="destructive" className="max-w-lg">{error}</Alert>
        <Button variant="outline" asChild><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    )
  }

  if (!problem || !draft) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">编程题不存在</div>

  const samples = problem.bodyJson?.samples || []

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
        <div className="flex items-center min-h-8 md:min-h-10 px-2 md:px-4 py-1 gap-1 md:gap-2 flex-wrap">
          <div className="flex-1 min-w-0 flex items-center gap-1 md:gap-2">
            <h1 className="text-xs md:text-sm font-semibold truncate shrink-0">{problem.title}</h1>
            {homework?.dueAt && (
              <span className="text-[10px] md:text-xs text-muted-foreground truncate min-w-0">
                {homework?.title ? `${homework.title} | ` : ''}剩余时间：{formatCountdown(homework.dueAt, now)} | 截止：{formatDateTime(homework.dueAt)}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8" asChild>
            <Link to={backTo} aria-label={backLabel}><X className="h-3.5 w-3.5 md:h-4 md:w-4" /></Link>
          </Button>
        </div>
      </header>

      {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
      {actionMessage && <ToastMessage message={actionMessage} severity="success" onShown={() => setActionMessage('')} />}

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden p-3 gap-3">
        {/* Left Panel */}
        <Card className="w-full md:w-[40%] md:min-w-[400px] flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-auto p-4 scrollbar-thin">
            <h2 className="text-lg font-bold mb-3">题目描述</h2>

            <div className="p-3 bg-muted/50 rounded-lg mb-4">
              <MarkdownContent content={problem.statementMd} />
            </div>

            <Separator className="my-3" />

            <h3 className="text-sm font-semibold mt-3">输入格式</h3>
            <div className="ml-1 mb-3">
              <MarkdownContent content={problem.bodyJson?.inputFormat || '见题目描述'} />
            </div>

            <h3 className="text-sm font-semibold mt-3">输出格式</h3>
            <div className="ml-1 mb-3">
              <MarkdownContent content={problem.bodyJson?.outputFormat || '见题目描述'} />
            </div>

            <Separator className="my-3" />

            <h3 className="text-sm font-semibold mt-3">样例</h3>
            {samples.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无样例</p>
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                {samples.map((sample, index) => (
                  <div key={index}>
                    <div className="border rounded-lg p-3 mb-1.5 bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-primary">输入样例 {index + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(sample.input, '输入样例')}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <pre className="m-0 font-mono text-sm p-2 bg-background rounded border whitespace-pre-wrap break-all overflow-x-auto">
                        {sample.input || '(空)'}
                      </pre>
                    </div>
                    <div className="border rounded-lg p-3 bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-green-600">输出样例 {index + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(sample.output, '输出样例')}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <pre className="m-0 font-mono text-sm p-2 bg-background rounded border whitespace-pre-wrap break-all overflow-x-auto">
                        {sample.output || '(空)'}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-3" />

            <h3 className="text-sm font-semibold mt-3">限制</h3>
            <div className="flex flex-col gap-1 mt-1">
              <p className="text-sm">时间限制：<strong>{problem.timeLimitMs}ms</strong></p>
              <p className="text-sm">内存限制：<strong>{problem.memoryLimitMiB}MiB</strong></p>
              <p className="text-sm">
                {isReviewMode ? '提交时间：' : '最近保存：'}
                <strong>{draft.lastSavedAt ? formatDateTime(draft.lastSavedAt) : (isReviewMode ? '未记录' : '尚未保存')}</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-3 overflow-auto">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Select value={draft.language} onValueChange={(value) => updateDraft({ language: value, code: pickStarter(problem.bodyJson || {}, value) })} disabled={isReviewMode}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpp">C++11</SelectItem>
                  <SelectItem value="python">Python 3.8</SelectItem>
                  <SelectItem value="go">Go 1.25</SelectItem>
                </SelectContent>
              </Select>
              {!isReviewMode ? (
                <>
                  <Button variant="default" className="bg-green-600 hover:bg-green-700" size="sm" disabled={running}
                    onClick={() => setRunInputDialog({ open: true, value: draft.customInput || '' })}>
                    <Play className="h-3.5 w-3.5 mr-1" />运行
                  </Button>
                  <Button size="sm" disabled={running} onClick={() => handleProgrammingRunOrTest('test')}>测试</Button>
                  <Button variant="secondary" size="sm" onClick={saveDraft}>
                    <Save className="h-3.5 w-3.5 mr-1" />保存
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">正在查看提交 #{reviewSubmissionId} 的代码</p>
              )}
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setShowSubmissionHistory(true)}>
                <History className="h-3.5 w-3.5 mr-1" />
                {isReviewMode ? '查看测评详情' : `测评记录 ${submissions.length > 0 ? `(${submissions.length})` : ''}`}
              </Button>
            </div>

            {/* Editor */}
            <div className="flex-1 border rounded-md mb-3 overflow-hidden min-h-[200px]">
              <Editor
                theme="vs"
                language={editorLang[draft.language]}
                value={draft.code}
                onChange={(value) => updateDraft({ code: value || '' })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 15,
                  lineHeight: 24,
                  tabSize: 4,
                  insertSpaces: true,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 10 },
                  lineNumbersMinChars: 3,
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 8,
                  renderSideBySide: false,
                  diffWordWrap: 'off',
                  readOnly: isReviewMode
                }}
              />
            </div>

            {/* Console */}
            <div className="flex flex-col min-h-0">
              <h3 className="text-xs font-semibold mb-1 shrink-0">控制台输出</h3>
              <div className={`overflow-auto max-h-[200px] min-h-[120px] rounded-lg border p-3 font-mono text-sm whitespace-pre-wrap ${consoleVariant === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-muted'}`}>
                {consoleText || '暂无输出'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Run Input Dialog */}
      <Dialog open={runInputDialog.open} onOpenChange={(v) => setRunInputDialog({ open: v, value: v ? runInputDialog.value : '' })}>
        <DialogContent>
          <DialogHeader><DialogTitle>自定义输入</DialogTitle></DialogHeader>
          <Textarea
            rows={6}
            value={runInputDialog.value}
            onChange={(e) => setRunInputDialog({ open: true, value: e.target.value })}
            placeholder="请输入测试数据"
            className="mt-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunInputDialog({ open: false, value: '' })}>取消</Button>
            <Button onClick={() => {
              const nextDraft = { ...draft, customInput: runInputDialog.value, touched: true }
              persistProgrammingDraft(nextDraft)
              setRunInputDialog({ open: false, value: '' })
              setTimeout(() => { handleProgrammingRunOrTest('run', nextDraft) }, 0)
            }}>运行</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission History Dialog */}
      <Dialog open={showSubmissionHistory} onOpenChange={setShowSubmissionHistory}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>测评记录</DialogTitle></DialogHeader>

          <div className="flex-1 overflow-hidden">
            {selectedSubmission ? (
              <div>
                {selectedSubmissionCaseDetails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1 pt-1">
                    <Badge variant="outline">测试点 {selectedSubmissionCaseDetails.length} 个</Badge>
                    <Badge variant="success">
                      通过 {selectedSubmissionCaseDetails.filter((item) => item.verdict === 'AC' || item.verdict === 'OK').length} 个
                    </Badge>
                    <Badge variant="destructive">
                      未通过 {selectedSubmissionCaseDetails.filter((item) => item.verdict && item.verdict !== 'AC' && item.verdict !== 'OK').length} 个
                    </Badge>
                  </div>
                )}
                {selectedSubmissionCaseDetails.length > 0 && (
                  <div className="px-1 pt-3 pb-2">
                    <Select value={String(selectedSubmissionCaseIndex)} onValueChange={(v) => setSelectedSubmissionCaseIndex(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedSubmissionCaseDetails.map((item, index) => (
                          <SelectItem key={`${item.caseNo}-${index}`} value={String(index)}>
                            {`测试点 ${item.caseNo}${item.verdict ? ` · ${item.verdict}` : ''}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Tabs value={submissionDetailTab} onValueChange={setSubmissionDetailTab}>
                  <TabsList className="w-full overflow-x-auto flex-nowrap">
                    <TabsTrigger value="code" className="flex-1 whitespace-nowrap">代码</TabsTrigger>
                    <TabsTrigger value="input" className="flex-1 whitespace-nowrap">输入</TabsTrigger>
                    <TabsTrigger value="output" className="flex-1 whitespace-nowrap">输出</TabsTrigger>
                    <TabsTrigger value="expected" className="flex-1 whitespace-nowrap">预期输出</TabsTrigger>
                    <TabsTrigger value="error" className="flex-1 whitespace-nowrap">错误</TabsTrigger>
                  </TabsList>
                  <div className="p-3">
                    {submissionDetailTab === 'code' && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-semibold">代码</h4>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(selectedSubmission.code, '代码')}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <pre className="p-3 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap border overflow-auto max-h-[40vh]">
                          {selectedSubmission.code || '无代码'}
                        </pre>
                      </div>
                    )}
                    {submissionDetailTab === 'input' && (
                      <pre className="p-3 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap border overflow-auto max-h-[40vh]">
                        {selectedSubmissionInput || '(空)'}
                      </pre>
                    )}
                    {submissionDetailTab === 'output' && (
                      <pre className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap border overflow-auto max-h-[40vh] ${selectedSubmissionError ? 'bg-red-50' : 'bg-muted/50'}`}>
                        {selectedSubmissionOutput || '(无输出)'}
                      </pre>
                    )}
                    {submissionDetailTab === 'expected' && (
                      <pre className="p-3 bg-green-50 rounded-lg font-mono text-sm whitespace-pre-wrap border overflow-auto max-h-[40vh]">
                        {selectedSubmissionExpectedOutput || '(无预期输出)'}
                      </pre>
                    )}
                    {submissionDetailTab === 'error' && (
                      <pre className="p-3 bg-red-50 rounded-lg font-mono text-sm whitespace-pre-wrap border overflow-auto max-h-[40vh]">
                        {selectedSubmissionError || '(无错误)'}
                      </pre>
                    )}
                  </div>
                </Tabs>
              </div>
            ) : submissions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <p className="text-sm">暂无测评记录</p>
                <p className="text-xs mt-1">点击"测试"或"运行"后，测评记录会显示在这里</p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-auto">
                {submissions.map((submission, index) => {
                  const summary = getSubmissionCaseSummary(submission)
                  return (
                    <div
                      key={submission.id || index}
                      className="flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => {
                        const caseDetails = normalizeSubmissionCaseDetails(submission.caseDetails)
                        setSelectedSubmission({
                          ...submission,
                          code: submission.sourceCode,
                          input: submission.inputData,
                          output: submission.stdout,
                          expectedOutput: submission.expectedOutput,
                          error: submission.stderr,
                          status: submission.verdict,
                          caseDetails
                        })
                        setSelectedSubmissionCaseIndex(0)
                        setSubmissionDetailTab('code')
                      }}
                    >
                      <History className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">提交 #{submission.id} - {submission.verdict || submission.status}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {submission.userId && submission.userId !== user?.id ? `用户：${submission.username || `#${submission.userId}`} | ` : ''}
                          {new Date(submission.createdAt).toLocaleString()} | {(submission.timeMs || 0)}ms | {(submission.memoryKiB || 0)}KiB
                          {summary.totalCaseCount > 0 ? ` | 测试点 ${summary.passedCaseCount}/${summary.totalCaseCount}` : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            {selectedSubmission ? (
              <Button variant="outline" onClick={() => { setSelectedSubmission(null); setSelectedSubmissionCaseIndex(0) }}>
                返回列表
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setShowSubmissionHistory(false)}>关闭</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
