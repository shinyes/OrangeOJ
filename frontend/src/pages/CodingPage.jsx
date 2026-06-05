import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { Label } from '../components/ui/label'
import { Alert } from '../components/ui/alert'
import { Textarea } from '../components/ui/textarea'
import { cn } from '../lib/utils'
import { toast } from 'sonner'
import { X, History, Copy, Play, Save, Pencil, CheckCircle2, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import MarkdownContent, { MarkdownWithMarker } from '../components/MarkdownContent'
import ToastMessage from '../components/ToastMessage'
import { useAuth } from '../hooks/useAuth'
import { codeDraftStorageKey } from '../utils/userScopedStorage'
import ProblemEditor from '../components/dashboard/ProblemEditor'

const editorLang = {
  cpp: 'cpp',
  python: 'python',
  go: 'go',
  turtle: 'python'
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
    if (language === 'go') {
      return 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
    }
    if (language === 'turtle') {
      return 'import turtle\n\nt = turtle.Turtle()\nt.speed(3)\n\n# 在这里编写你的绘图代码\n# 示例：画一个正方形\nfor _ in range(4):\n    t.forward(100)\n    t.left(90)\n\nturtle.done()'
    }
    return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}'
  }
  return body.starterCode[language] || body.starterCode.cpp || ''
}

function problemTypeText(type) {
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type
}

function alphaOptionLabel(index) {
  return String.fromCharCode(65 + index)
}

function nowTimeText() {
  return new Date().toLocaleTimeString()
}

function safeInternalPath(path, fallback = '/') {
  if (typeof path === 'string' && path.startsWith('/')) {
    return path
  }
  return fallback
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

export default function CodingPage() {
  const { user } = useAuth()
  const { spaceId, problemId } = useParams()
  const [searchParams] = useSearchParams()
  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [language, setLanguage] = useState('cpp')
  const [code, setCode] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [showCustomInputDialog, setShowCustomInputDialog] = useState(false)
  const [tempCustomInput, setTempCustomInput] = useState('')
  const [consoleText, setConsoleText] = useState('控制台已就绪')
  const [consoleVariant, setConsoleVariant] = useState('')
  const [running, setRunning] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [showSubmissionHistory, setShowSubmissionHistory] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [selectedSubmissionCaseIndex, setSelectedSubmissionCaseIndex] = useState(0)
  const [submissionDetailTab, setSubmissionDetailTab] = useState('code')

  const [objectiveAnswer, setObjectiveAnswer] = useState('')
  const [spaceMyRole, setSpaceMyRole] = useState('')
  const [showProblemEditor, setShowProblemEditor] = useState(false)
  const [savingProblem, setSavingProblem] = useState(false)

  const planId = searchParams.get('planId') ? Number(searchParams.get('planId')) : null
  const [trainingPlan, setTrainingPlan] = useState(null)

  const body = useMemo(() => problem?.bodyJson || {}, [problem])
  const backTo = safeInternalPath(searchParams.get('returnTo'))
  const backLabel = searchParams.get('returnLabel') || '返回首页'
  const solveReturnTo = planId ? `/spaces/${spaceId}/training-plans/${planId}` : backTo || '/'
  const solveReturnLabel = encodeURIComponent('返回训练')
  const canEditProblem = user?.globalRole === 'system_admin' || spaceMyRole === 'space_admin'
  const tagSuggestions = useMemo(() => (Array.isArray(problem?.tags) ? problem.tags : []), [problem])

  const trainingProblems = useMemo(() => {
    const result = []
    ;(trainingPlan?.chapters || []).forEach((chapter) => {
      ;(chapter.items || []).forEach((item) => {
        result.push({ problemId: item.problemId, title: item.title, type: item.type, completed: item.completed, chapterTitle: chapter.title })
      })
    })
    return result
  }, [trainingPlan])

  const currentTrainingIndex = useMemo(() => {
    if (!problemId || trainingProblems.length === 0) return -1
    return trainingProblems.findIndex((p) => Number(p.problemId) === Number(problemId))
  }, [trainingProblems, problemId])

  const prevTrainingProblem = currentTrainingIndex > 0 ? trainingProblems[currentTrainingIndex - 1] : null
  const nextTrainingProblem = currentTrainingIndex >= 0 && currentTrainingIndex < trainingProblems.length - 1 ? trainingProblems[currentTrainingIndex + 1] : null

  const handleProblemEdit = async (problemData) => {
    setSavingProblem(true)
    try {
      setError('')
      await api.updateSpaceProblem(spaceId, problemId, problemData)
      const updated = await api.getProblem(spaceId, problemId, { includeAnswer: true })
      setProblem(updated)
      setShowProblemEditor(false)
      toast.success('题目已保存')
    } catch (err) {
      setError(err.message || '保存题目失败')
      throw err
    } finally {
      setSavingProblem(false)
    }
  }
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
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        if (!spaceId) throw new Error('缺少空间信息')
        const promises = [api.getProblem(spaceId, problemId, { includeAnswer: true }), api.getSpace(spaceId)]
        if (planId) promises.push(api.getTrainingPlan(spaceId, planId))
        const results = await Promise.all(promises)
        const [data, space] = results
        const defaultLanguage = normalizeDefaultLanguage(space?.defaultProgrammingLanguage)
        setLanguage(defaultLanguage)
        setProblem(data)
        setSpaceMyRole(space?.myRole || '')
        if (data.type === 'programming') {
          const key = codeDraftStorageKey(user, spaceId, problemId, defaultLanguage)
          const cached = localStorage.getItem(key)
          setCode(cached || pickStarter(data.bodyJson, defaultLanguage))
        }
        if (planId) setTrainingPlan(results[2] || null)
        if (spaceId) {
          try {
            const result = await api.listSubmissions(spaceId, problemId, { all: true })
            setSubmissions(result?.submissions || [])
          } catch (subErr) { /* silent */ }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, problemId, planId, user?.id, user?.userId, user?.username])

  useEffect(() => {
    if (!problem || problem.type !== 'programming') return
    const key = codeDraftStorageKey(user, spaceId, problemId, language)
    const cached = localStorage.getItem(key)
    setCode(cached || pickStarter(problem.bodyJson, language))
  }, [language, problem, spaceId, problemId, user?.id, user?.userId, user?.username])

  const handleRunClick = () => {
    setShowCustomInputDialog(true)
    setTempCustomInput(customInput)
  }

  const handleTestClick = () => {
    handleCodeSubmit('test')
  }

  const saveDraft = () => {
    const key = codeDraftStorageKey(user, spaceId, problemId, language)
    localStorage.setItem(key, code)
    setConsoleText((prev) => `${prev}\n[${nowTimeText()}] 草稿已保存到本地`)
  }

  const pollSubmission = async (submissionId, mode) => {
    for (let i = 0; i < 180; i += 1) {
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

  const handleCodeSubmit = async (mode, inputDataOverride) => {
    if (!problem || problem.type !== 'programming') return
    setRunning(true)
    setError('')
    const actionText = mode === 'run' ? '运行' : '测试'
    setConsoleText(`[${nowTimeText()}] 开始${actionText}...`)
    setConsoleVariant('')
    try {
      const payload = { language, sourceCode: code, inputData: inputDataOverride ?? customInput }
      const created = spaceId
        ? mode === 'run'
          ? await api.run(spaceId, problemId, payload)
          : await api.test(spaceId, problemId, payload)
        : mode === 'run'
          ? await api.runRoot(problemId, payload)
          : await api.testRoot(problemId, payload)
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
      if (spaceId) {
        const historyResult = await api.listSubmissions(spaceId, problemId, { all: true })
        setSubmissions(historyResult?.submissions || [])
      }
    } catch (err) {
      setError(err.message)
      setConsoleVariant('error')
      if (mode === 'run') {
        setConsoleText((prev) => `${prev}\n${err.message}`)
      } else {
        setConsoleText(`错误：${err.message}`)
      }
    } finally {
      setRunning(false)
    }
  }

  const handleObjectiveSubmit = async () => {
    try {
      setRunning(true)
      setError('')
      const answer = problem.type === 'true_false' ? objectiveAnswer === 'true' : objectiveAnswer
      const result = spaceId
        ? await api.objectiveSubmit(spaceId, problemId, answer)
        : await api.objectiveSubmitRoot(problemId, answer)
      const isCorrect = result.verdict === 'AC' || result.verdict === 'OK'
      if (isCorrect) {
        toast.success('回答正确！', { duration: 1000 })
      } else {
        toast.error('回答错误，再想想看', { duration: 1000 })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">题目加载中...</div>

  if (error && !problem) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <Alert variant="destructive" className="max-w-lg">{error}</Alert>
        <Button variant="outline" asChild><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    )
  }

  if (!problem) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">题目不存在</div>

  return (
    <>
      {canEditProblem && (
        <ProblemEditor
          open={showProblemEditor}
          mode="edit"
          problem={problem}
          editTitle="编辑题目"
          editSubmitText="保存修改"
          tagSuggestions={tagSuggestions}
          onClose={() => setShowProblemEditor(false)}
          onSubmit={handleProblemEdit}
        />
      )}

      <CodingPageContent
        problem={problem}
        body={body}
        backTo={backTo}
        backLabel={backLabel}
        canEditProblem={canEditProblem}
        showProblemEditor={showProblemEditor}
        setShowProblemEditor={setShowProblemEditor}
        error={error}
        setError={setError}
        language={language}
        setLanguage={setLanguage}
        code={code}
        setCode={setCode}
        customInput={customInput}
        setCustomInput={setCustomInput}
        showCustomInputDialog={showCustomInputDialog}
        setShowCustomInputDialog={setShowCustomInputDialog}
        tempCustomInput={tempCustomInput}
        setTempCustomInput={setTempCustomInput}
        consoleText={consoleText}
        setConsoleText={setConsoleText}
        consoleVariant={consoleVariant}
        setConsoleVariant={setConsoleVariant}
        running={running}
        setRunning={setRunning}
        submissions={submissions}
        setSubmissions={setSubmissions}
        showSubmissionHistory={showSubmissionHistory}
        setShowSubmissionHistory={setShowSubmissionHistory}
        selectedSubmission={selectedSubmission}
        setSelectedSubmission={setSelectedSubmission}
        selectedSubmissionCaseIndex={selectedSubmissionCaseIndex}
        setSelectedSubmissionCaseIndex={setSelectedSubmissionCaseIndex}
        submissionDetailTab={submissionDetailTab}
        setSubmissionDetailTab={setSubmissionDetailTab}
        objectiveAnswer={objectiveAnswer}
        setObjectiveAnswer={setObjectiveAnswer}
        handleRunClick={handleRunClick}
        handleTestClick={handleTestClick}
        saveDraft={saveDraft}
        handleCodeSubmit={handleCodeSubmit}
        handleObjectiveSubmit={handleObjectiveSubmit}
        copyToClipboard={copyToClipboard}
        user={user}
        planId={planId}
        spaceId={spaceId}
        problemId={problemId}
        trainingProblems={trainingProblems}
        currentTrainingIndex={currentTrainingIndex}
        prevTrainingProblem={prevTrainingProblem}
        nextTrainingProblem={nextTrainingProblem}
        solveReturnTo={solveReturnTo}
        solveReturnLabel={solveReturnLabel}
        trainingPlan={trainingPlan}
      />
    </>
  )
}

function CodingPageContent({
  problem, body, backTo, backLabel, canEditProblem, showProblemEditor, setShowProblemEditor,
  error, setError, language, setLanguage, code, setCode,
  customInput, setCustomInput, showCustomInputDialog, setShowCustomInputDialog,
  tempCustomInput, setTempCustomInput, consoleText, setConsoleText, consoleVariant, setConsoleVariant,
  running, submissions, showSubmissionHistory, setShowSubmissionHistory,
  selectedSubmission, setSelectedSubmission, selectedSubmissionCaseIndex, setSelectedSubmissionCaseIndex,
  submissionDetailTab, setSubmissionDetailTab,
  objectiveAnswer, setObjectiveAnswer,
  handleRunClick, handleTestClick, saveDraft, handleCodeSubmit, handleObjectiveSubmit, copyToClipboard, user,
  planId, spaceId, problemId, trainingProblems, currentTrainingIndex, prevTrainingProblem, nextTrainingProblem,
  solveReturnTo, solveReturnLabel, trainingPlan }) {
  const samples = body.samples || []
  const showTrainingNav = planId != null && trainingProblems.length > 0

  const selectedSubmissionCaseDetails = selectedSubmission?.caseDetails || []
  const selectedSubmissionCase = selectedSubmissionCaseDetails[selectedSubmissionCaseIndex] || null
  const selectedSubmissionInput = selectedSubmissionCase?.input ?? selectedSubmission?.input ?? ''
  const selectedSubmissionOutput = selectedSubmissionCase?.output ?? selectedSubmission?.output ?? ''
  const selectedSubmissionExpectedOutput = selectedSubmissionCase?.expectedOutput ?? selectedSubmission?.expectedOutput ?? ''
  const selectedSubmissionError = selectedSubmissionCase?.error ?? selectedSubmission?.error ?? ''

  const trainingNavTargetUrl = (targetProblemId) =>
    `/spaces/${spaceId}/problems/${targetProblemId}/solve?planId=${planId}&returnTo=${encodeURIComponent(solveReturnTo)}&returnLabel=${solveReturnLabel}`

  // ---- Turtle mode ----
  const isTurtleMode = language === 'turtle'
  const [turtleImage, setTurtleImage] = useState('')
  const [turtleFrames, setTurtleFrames] = useState(null)
  const [turtleFrameIndex, setTurtleFrameIndex] = useState(0)
  const [turtleError, setTurtleError] = useState('')
  const [turtleRunning, setTurtleRunning] = useState(false)
  const turtleTimerRef = useRef(null)

  // Animate frames when available
  useEffect(() => {
    if (turtleFrames && turtleFrames.length > 1) {
      turtleTimerRef.current = setInterval(() => {
        setTurtleFrameIndex(prev => {
          const next = prev + 1
          if (next >= turtleFrames.length) {
            clearInterval(turtleTimerRef.current)
            return prev  // Stay on last frame
          }
          return next
        })
      }, 180)  // ~5.5 FPS
      return () => clearInterval(turtleTimerRef.current)
    }
  }, [turtleFrames])

  const currentDisplayImage = turtleFrames ? turtleFrames[turtleFrameIndex] : turtleImage

  const handleTurtleRun = async () => {
    if (!problem || problem.type !== 'programming') return
    setTurtleRunning(true)
    setError('')
    setTurtleImage('')
    setTurtleFrames(null)
    setTurtleFrameIndex(0)
    setTurtleError('')
    setConsoleText(`[${nowTimeText()}] Turtle 运行中...`)
    try {
      const result = await api.turtleRun(spaceId, problemId, { sourceCode: code })
      if (result.frames && result.frames.length > 0) {
        setTurtleFrames(result.frames)
        setTurtleImage(result.frames[result.frames.length - 1])
        setConsoleText(`[${nowTimeText()}] Turtle 运行成功 (${result.frames.length} 帧)`)
        setConsoleVariant('success')
      } else if (result.image) {
        setTurtleImage(result.image)
        setConsoleText(`[${nowTimeText()}] Turtle 运行成功`)
        setConsoleVariant('success')
      } else if (result.error) {
        setTurtleError(result.error)
        setConsoleText(`[${nowTimeText()}] Turtle 错误: ${result.error}`)
        setConsoleVariant('error')
        if (result.stderr) setTurtleError(result.stderr || result.error)
      }
    } catch (err) {
      const msg = err.message || 'Turtle 运行失败'
      setTurtleError(msg)
      setConsoleText(`[${nowTimeText()}] ${msg}`)
      setConsoleVariant('error')
    } finally {
      setTurtleRunning(false)
    }
  }

  // ---- Training navigation helpers ----
  const renderTrainingNavGrid = () => (
    <div className="flex flex-col gap-3">
      {(trainingPlan?.chapters || []).map((chapter, chIdx) => {
        const items = chapter.items || []
        if (items.length === 0) return null
        return (
          <div key={chIdx}>
            <h5 className="text-[11px] font-semibold text-muted-foreground mb-1.5 tracking-wide uppercase">
              {chapter.title || `第 ${chIdx + 1} 章`}
            </h5>
            <div className="grid grid-cols-5 gap-1">
              {items.map((item, itemIdx) => {
                const isCurrent = Number(item.problemId) === Number(problemId)
                const cls = cn(
                  'h-7 w-full min-w-0 px-0 py-0 rounded text-xs font-medium border transition-colors',
                  item.completed && 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100',
                  !item.completed && 'border-border bg-white hover:border-primary hover:bg-slate-50',
                  isCurrent && 'ring-2 ring-primary ring-offset-1'
                )
                return (
                  <Link key={item.problemId} to={trainingNavTargetUrl(item.problemId)} className="no-underline">
                    <Button variant="outline" className={cls} title={`${item.title}`}>
                      {item.completed ? <CheckCircle2 className="h-3 w-3" /> : itemIdx + 1}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderTrainingBottomNav = () => (
    <div className="flex items-center justify-center gap-4 px-4 py-2 border-t bg-background">
      {prevTrainingProblem ? (
        <Button variant="outline" size="sm" asChild>
          <Link to={trainingNavTargetUrl(prevTrainingProblem.problemId)}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />上一题
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled><ChevronLeft className="h-3.5 w-3.5 mr-1" />上一题</Button>
      )}
      <span className="text-xs text-muted-foreground">{currentTrainingIndex + 1} / {trainingProblems.length}</span>
      {nextTrainingProblem ? (
        <Button variant="outline" size="sm" asChild>
          <Link to={trainingNavTargetUrl(nextTrainingProblem.problemId)}>
            下一题<ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>下一题<ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
      )}
    </div>
  )

  // ---- Non-programming (objective) layout ----
  if (problem.type !== 'programming') {
    return (
      <div className="h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
          <div className="flex items-center justify-between min-h-10 md:min-h-12 px-2 md:px-4 py-1 gap-1 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-base font-semibold truncate">{problem.title}</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground">{problemTypeText(problem.type)}</p>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {canEditProblem && (
                <Button variant="ghost" size="sm" className="h-7 md:h-8 px-1 md:px-3 text-[10px] md:text-xs" onClick={() => setShowProblemEditor(true)}>
                  <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />编辑
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 md:h-8 px-1 md:px-3 text-[10px] md:text-xs" asChild><Link to={backTo}>{backLabel}</Link></Button>
            </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {showTrainingNav && (
            <aside className="w-full md:w-44 shrink-0 border-b md:border-b-0 md:border-r bg-muted/20 overflow-y-auto p-1.5 md:p-2 max-h-[8rem] md:max-h-none">
              {renderTrainingNavGrid()}
            </aside>
          )}

          <div className="flex-1 overflow-y-auto p-2 md:p-4">
            <div className="max-w-3xl mx-auto">
              {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}

              <Card>
                <CardContent className="p-3 md:p-4">
                  <div className="p-2 md:p-3 bg-muted/50 rounded-lg mb-3 md:mb-4 text-sm md:text-base">
                    <MarkdownContent content={problem.statementMd} />
                  </div>

                  {problem.type === 'single_choice' ? (
                    <fieldset className="mb-3 w-full">
                      <legend className="text-sm font-medium mb-2">选项</legend>
                      <RadioGroup value={objectiveAnswer} onValueChange={setObjectiveAnswer} className="gap-0.5">
                        {(body.options || []).map((opt, index) => (
                          <Label
                            key={`${String(opt)}-${index}`}
                            htmlFor={`opt-${index}`}
                            className="flex items-start gap-1.5 md:gap-2 py-1.5 md:py-0.5 px-1.5 md:px-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
                          >
                            <RadioGroupItem value={String(opt)} id={`opt-${index}`} className="mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <MarkdownWithMarker
                                marker={`${alphaOptionLabel(index)}.`}
                                content={String(opt || '')}
                                className="gap-x-[0.35rem]"
                                markerClassName="min-w-[1.8ch]"
                                contentClassName="text-[0.92rem] md:text-[0.98rem] [&_p]:my-[0.2rem] [&_ul]:my-[0.3rem] [&_ol]:my-[0.3rem] [&_pre]:my-[0.5rem] [&_pre]:text-[0.78rem] md:[&_pre]:text-[0.82rem]"
                              />
                            </div>
                          </Label>
                        ))}
                      </RadioGroup>
                    </fieldset>
                  ) : (
                    <fieldset className="mb-3 w-full">
                      <legend className="text-sm font-medium mb-2">答案</legend>
                      <RadioGroup value={objectiveAnswer} onValueChange={setObjectiveAnswer} className="flex gap-4">
                        <Label htmlFor="opt-true" className="flex items-center gap-2 cursor-pointer">
                          <RadioGroupItem value="true" id="opt-true" />
                          <span className="text-sm">正确</span>
                        </Label>
                        <Label htmlFor="opt-false" className="flex items-center gap-2 cursor-pointer">
                          <RadioGroupItem value="false" id="opt-false" />
                          <span className="text-sm">错误</span>
                        </Label>
                      </RadioGroup>
                    </fieldset>
                  )}

                  <div className="flex justify-start">
                    <Button className="w-full md:w-auto" disabled={running || !objectiveAnswer} onClick={handleObjectiveSubmit}>
                      {running ? '提交中...' : '提交答案'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {showTrainingNav && renderTrainingBottomNav()}
      </div>
    )
  }

  // ---- Programming layout ----
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
        <div className="flex items-center justify-between min-h-8 md:min-h-10 px-2 md:px-4 py-0.5 gap-1 flex-wrap">
          <h1 className="text-xs md:text-sm font-semibold flex-1 truncate">{problem.title}</h1>
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            {canEditProblem && (
              <Button variant="ghost" size="sm" className="h-7 md:h-8 px-1 md:px-2 text-[10px] md:text-xs" onClick={() => setShowProblemEditor(true)}>
                <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />编辑
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8" asChild>
              <Link to={backTo}><X className="h-3.5 w-3.5 md:h-4 md:w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden p-1.5 md:p-3 gap-1.5 md:gap-3">
        {/* Training Nav Sidebar */}
        {showTrainingNav && (
          <aside className="hidden md:block w-44 shrink-0 border-r bg-muted/20 rounded-lg overflow-y-auto p-2">
            {renderTrainingNavGrid()}
          </aside>
        )}

        {/* Left Panel - Problem Description */}
        <Card className={`${showTrainingNav ? 'md:w-[38%] md:min-w-[350px]' : 'md:w-[40%] md:min-w-[400px]'} w-full flex flex-col overflow-hidden`}>
          <CardContent className="flex-1 overflow-auto p-4 scrollbar-thin">
            <h2 className="text-lg font-bold mb-3">题目描述</h2>

            <div className="p-3 bg-muted/50 rounded-lg mb-4">
              <MarkdownContent content={problem.statementMd} />
            </div>

            <Separator className="my-3" />

            <h3 className="text-sm font-semibold mt-3">输入格式</h3>
            <div className="ml-1 mb-3">
              <MarkdownContent content={body.inputFormat || '见题目描述'} />
            </div>

            <h3 className="text-sm font-semibold mt-3">输出格式</h3>
            <div className="ml-1 mb-3">
              <MarkdownContent content={body.outputFormat || '见题目描述'} />
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
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Code Editor */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-3 overflow-auto">
            {/* Toolbar */}
            <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3 flex-wrap">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[100px] md:w-[130px] h-7 md:h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpp">C++11</SelectItem>
                  <SelectItem value="python">Python 3.8</SelectItem>
                  <SelectItem value="go">Go 1.25</SelectItem>
                  <SelectItem value="turtle">Python Turtle</SelectItem>
                </SelectContent>
              </Select>
              {isTurtleMode ? (
                <>
                  <Button variant="default" className="bg-green-600 hover:bg-green-700 h-7 md:h-8 text-xs px-1.5 md:px-3" size="sm" disabled={turtleRunning} onClick={handleTurtleRun}>
                    <Play className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />运行
                  </Button>
                  <Button variant="secondary" size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" onClick={saveDraft}>
                    <Save className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />保存
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="default" className="bg-green-600 hover:bg-green-700 h-7 md:h-8 text-xs px-1.5 md:px-3" size="sm" disabled={running} onClick={handleRunClick}>
                    <Play className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />运行
                  </Button>
                  <Button size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" disabled={running} onClick={handleTestClick}>测试</Button>
                  <Button variant="secondary" size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" onClick={saveDraft}>
                    <Save className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />保存
                  </Button>
                </>
              )}
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs px-1.5 md:px-3" onClick={() => setShowSubmissionHistory(true)}>
                <History className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />
                <span className="hidden sm:inline">测评记录</span> {submissions.length > 0 && `(${submissions.length})`}
              </Button>
            </div>

            {/* Editor */}
            <div className="flex-1 border rounded-md mb-3 overflow-hidden min-h-[200px]">
              <Editor
                theme="vs"
                language={editorLang[language]}
                value={code}
                onChange={(value) => setCode(value || '')}
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
                  diffWordWrap: 'off'
                }}
              />
            </div>

            {/* Console / Turtle Canvas */}
            {isTurtleMode ? (
              <div className="flex flex-col min-h-0">
                <h3 className="text-xs font-semibold mb-1 shrink-0">🐢 Turtle 绘图输出</h3>
                <div className="overflow-auto max-h-[420px] min-h-[200px] rounded-lg border p-3 bg-white flex items-center justify-center">
                  {turtleRunning ? (
                    <div className="text-center text-muted-foreground">
                      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                      <p className="text-sm">Turtle 运行中...</p>
                    </div>
                  ) : currentDisplayImage ? (
                    <div className="w-full">
                      {turtleFrames && turtleFrames.length > 1 && (
                        <div className="text-center text-xs text-muted-foreground mb-2">
                          绘制过程 ({turtleFrameIndex + 1}/{turtleFrames.length})
                        </div>
                      )}
                      <img src={`data:image/png;base64,${currentDisplayImage}`} alt="Turtle 绘图" className="max-w-full h-auto rounded mx-auto" />
                    </div>
                  ) : turtleError ? (
                    <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono w-full">{turtleError}</pre>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">点击"运行"查看 Turtle 绘图结果</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col min-h-0">
                <h3 className="text-xs font-semibold mb-1 shrink-0">控制台输出</h3>
                <div className={cn(
                  "overflow-auto max-h-[200px] min-h-[120px] rounded-lg border p-3 font-mono text-sm whitespace-pre-wrap",
                  consoleVariant === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-muted'
                )}>
                  {consoleText || '暂无输出'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showTrainingNav && renderTrainingBottomNav()}

      {/* Custom Input Dialog */}
      <Dialog open={showCustomInputDialog} onOpenChange={setShowCustomInputDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>自定义输入</DialogTitle></DialogHeader>
          <Textarea
            rows={6}
            value={tempCustomInput}
            onChange={(e) => setTempCustomInput(e.target.value)}
            placeholder="请输入测试数据"
            className="mt-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomInputDialog(false)}>取消</Button>
            <Button onClick={() => {
              setCustomInput(tempCustomInput)
              setShowCustomInputDialog(false)
              handleCodeSubmit('run', tempCustomInput)
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
                <p className="text-xs mt-1">点击"测试"或"运行"按钮提交代码后，测评记录将在这里显示</p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-auto">
                {submissions.map((sub, index) => {
                  const summary = getSubmissionCaseSummary(sub)
                  return (
                    <div
                      key={sub.id || index}
                      className="flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => {
                        const caseDetails = normalizeSubmissionCaseDetails(sub.caseDetails)
                        setSelectedSubmission({
                          ...sub,
                          code: sub.sourceCode,
                          input: sub.inputData,
                          output: sub.stdout,
                          expectedOutput: sub.expectedOutput,
                          error: sub.stderr,
                          status: sub.verdict,
                          caseDetails
                        })
                        setSelectedSubmissionCaseIndex(0)
                        setSubmissionDetailTab('code')
                      }}
                    >
                      <History className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">提交 #{sub.id} - {sub.verdict || sub.status}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sub.userId && sub.userId !== user?.id ? `用户：${sub.username || `#${sub.userId}`} | ` : ''}
                          {new Date(sub.createdAt).toLocaleString()} | {(sub.timeMs || 0)}ms | {(sub.memoryKiB || 0)}KiB
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
