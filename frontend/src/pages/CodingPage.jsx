import { useEffect, useMemo, useState } from 'react'
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
import { Textarea } from '../components/ui/textarea'
import { toast } from 'sonner'
import { X, History, Copy, Play, Save } from 'lucide-react'
import MarkdownContent, { MarkdownWithMarker } from '../components/MarkdownContent'
import ToastMessage from '../components/ToastMessage'
import { useAuth } from '../hooks/useAuth'
import { codeDraftStorageKey } from '../utils/userScopedStorage'

const editorLang = {
  cpp: 'cpp',
  python: 'python',
  go: 'go'
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
  const [running, setRunning] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [showSubmissionHistory, setShowSubmissionHistory] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [selectedSubmissionCaseIndex, setSelectedSubmissionCaseIndex] = useState(0)
  const [submissionDetailTab, setSubmissionDetailTab] = useState('code')

  const [objectiveAnswer, setObjectiveAnswer] = useState('')

  const body = useMemo(() => problem?.bodyJson || {}, [problem])
  const backTo = safeInternalPath(searchParams.get('returnTo'))
  const backLabel = searchParams.get('returnLabel') || '返回首页'
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
        const [data, space] = await Promise.all([
          api.getProblem(spaceId, problemId),
          api.getSpace(spaceId)
        ])
        const defaultLanguage = normalizeDefaultLanguage(space?.defaultProgrammingLanguage)
        setLanguage(defaultLanguage)
        setProblem(data)
        if (data.type === 'programming') {
          const key = codeDraftStorageKey(user, spaceId, problemId, defaultLanguage)
          const cached = localStorage.getItem(key)
          setCode(cached || pickStarter(data.bodyJson, defaultLanguage))
        }
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
  }, [spaceId, problemId, user?.id, user?.userId, user?.username])

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

  const pollSubmission = async (submissionId) => {
    for (let i = 0; i < 180; i += 1) {
      const snapshot = await api.pollSubmission(submissionId)
      setConsoleText(`${snapshot.stdout || ''}\n${snapshot.stderr || ''}\n状态：${snapshot.status} / ${snapshot.verdict || ''}`)
      if (snapshot.status === 'done' || snapshot.status === 'failed') return snapshot
      await new Promise((resolve) => setTimeout(resolve, snapshot.pollAfterMs || 1000))
    }
    throw new Error('判题等待超时，请稍后再试')
  }

  const handleCodeSubmit = async (mode) => {
    if (!problem || problem.type !== 'programming') return
    setRunning(true)
    setError('')
    const actionText = mode === 'run' ? '运行' : '测试'
    setConsoleText(`[${nowTimeText()}] 开始${actionText}...`)
    try {
      const payload = { language, sourceCode: code, inputData: customInput }
      const created = spaceId
        ? mode === 'run'
          ? await api.run(spaceId, problemId, payload)
          : await api.test(spaceId, problemId, payload)
        : mode === 'run'
          ? await api.runRoot(problemId, payload)
          : await api.testRoot(problemId, payload)
      const result = await pollSubmission(created.submissionId)
      setConsoleText((prev) => `${prev}\n\n最终结果：${result.verdict || '-'} | ${(result.timeMs || 0)}ms | ${(result.memoryKiB || 0)}KiB`)
      if (spaceId) {
        const historyResult = await api.listSubmissions(spaceId, problemId, { all: true })
        setSubmissions(historyResult?.submissions || [])
      }
    } catch (err) {
      setError(err.message)
      setConsoleText((prev) => `${prev}\n错误：${err.message}`)
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
        <div className="border border-destructive/30 bg-destructive/10 text-destructive rounded-lg px-5 py-3 text-sm max-w-lg">{error}</div>
        <Button variant="outline" asChild><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    )
  }

  if (!problem) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">题目不存在</div>

  const samples = body.samples || []

  // ---- Non-programming (objective) layout ----
  if (problem.type !== 'programming') {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
          <div className="flex items-center justify-between h-12 px-4">
            <div>
              <h1 className="text-base font-semibold">{problem.title}</h1>
              <p className="text-xs text-muted-foreground">{problemTypeText(problem.type)}</p>
            </div>
            <Button variant="ghost" asChild><Link to={backTo}>{backLabel}</Link></Button>
          </div>
        </header>

        <div className="p-4 max-w-3xl mx-auto">
          {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}

          <Card>
            <CardContent className="p-4">
              <div className="p-3 bg-muted/50 rounded-lg mb-4">
                <MarkdownContent content={problem.statementMd} />
              </div>

              {problem.type === 'single_choice' ? (
                <fieldset className="mb-3 w-full">
                  <legend className="text-sm font-medium mb-2">选项</legend>
                  <RadioGroup value={objectiveAnswer} onValueChange={setObjectiveAnswer} className="gap-0.5">
                    {(body.options || []).map((opt, index) => (
                      <label
                        key={`${String(opt)}-${index}`}
                        htmlFor={`opt-${index}`}
                        className="flex items-start gap-2 py-0.5 px-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        <RadioGroupItem value={String(opt)} id={`opt-${index}`} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <MarkdownWithMarker
                            marker={`${alphaOptionLabel(index)}.`}
                            content={String(opt || '')}
                            className="gap-x-[0.35rem]"
                            markerClassName="min-w-[1.8ch]"
                            contentClassName="text-[0.98rem] [&_p]:my-[0.2rem] [&_ul]:my-[0.3rem] [&_ol]:my-[0.3rem] [&_pre]:my-[0.6rem] [&_pre]:text-[0.82rem]"
                          />
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
              ) : (
                <fieldset className="mb-3 w-full">
                  <legend className="text-sm font-medium mb-2">答案</legend>
                  <RadioGroup value={objectiveAnswer} onValueChange={setObjectiveAnswer} className="flex gap-4">
                    <label htmlFor="opt-true" className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="true" id="opt-true" />
                      <span className="text-sm">正确</span>
                    </label>
                    <label htmlFor="opt-false" className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="false" id="opt-false" />
                      <span className="text-sm">错误</span>
                    </label>
                  </RadioGroup>
                </fieldset>
              )}

              <div className="flex justify-start">
                <Button disabled={running || !objectiveAnswer} onClick={handleObjectiveSubmit}>
                  {running ? '提交中...' : '提交答案'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Programming layout ----
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
        <div className="flex items-center justify-between h-10 px-4">
          <h1 className="text-sm font-semibold flex-1 truncate">{problem.title}</h1>
          <Button variant="ghost" size="icon" asChild className="ml-2">
            <Link to={backTo}><X className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}

      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left Panel - Problem Description */}
        <Card className="w-[40%] min-w-[400px] flex flex-col overflow-hidden">
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
          <CardContent className="flex-1 flex flex-col p-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpp">C++11</SelectItem>
                  <SelectItem value="python">Python 3.8</SelectItem>
                  <SelectItem value="go">Go 1.25</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="default" className="bg-green-600 hover:bg-green-700" size="sm" disabled={running} onClick={handleRunClick}>
                <Play className="h-3.5 w-3.5 mr-1" />运行
              </Button>
              <Button size="sm" disabled={running} onClick={handleTestClick}>测试</Button>
              <Button variant="secondary" size="sm" onClick={saveDraft}>
                <Save className="h-3.5 w-3.5 mr-1" />保存
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setShowSubmissionHistory(true)}>
                <History className="h-3.5 w-3.5 mr-1" />
                测评记录 {submissions.length > 0 && `(${submissions.length})`}
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
                  tabSize: 2,
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

            {/* Console */}
            <div>
              <h3 className="text-xs font-semibold mb-1">控制台输出</h3>
              <div className="p-3 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto min-h-[120px] max-h-[200px] border">
                {consoleText || '暂无输出'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              handleCodeSubmit('run')
            }}>运行</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission History Dialog */}
      <Dialog open={showSubmissionHistory} onOpenChange={setShowSubmissionHistory}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>测评记录</DialogTitle></DialogHeader>

          <div className="flex-1 overflow-auto">
            {selectedSubmission ? (
              <div>
                {selectedSubmissionCaseDetails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1 pt-1">
                    <Badge variant="outline">测试点 {selectedSubmissionCaseDetails.length} 个</Badge>
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      通过 {selectedSubmissionCaseDetails.filter((item) => item.verdict === 'AC' || item.verdict === 'OK').length} 个
                    </Badge>
                    <Badge variant="outline" className="border-red-500 text-red-600">
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
                  <TabsList className="w-full">
                    <TabsTrigger value="code" className="flex-1">代码</TabsTrigger>
                    <TabsTrigger value="input" className="flex-1">输入</TabsTrigger>
                    <TabsTrigger value="output" className="flex-1">输出</TabsTrigger>
                    <TabsTrigger value="expected" className="flex-1">预期输出</TabsTrigger>
                    <TabsTrigger value="error" className="flex-1">错误</TabsTrigger>
                  </TabsList>
                  <div className="p-3 max-h-[50vh] overflow-auto">
                    {submissionDetailTab === 'code' && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-semibold">代码</h4>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(selectedSubmission.code, '代码')}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <pre className="p-3 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap border">
                          {selectedSubmission.code || '无代码'}
                        </pre>
                      </div>
                    )}
                    {submissionDetailTab === 'input' && (
                      <pre className="p-3 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap border">
                        {selectedSubmissionInput || '(空)'}
                      </pre>
                    )}
                    {submissionDetailTab === 'output' && (
                      <pre className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap border ${selectedSubmissionError ? 'bg-red-50' : 'bg-muted/50'}`}>
                        {selectedSubmissionOutput || '(无输出)'}
                      </pre>
                    )}
                    {submissionDetailTab === 'expected' && (
                      <pre className="p-3 bg-green-50 rounded-lg font-mono text-sm whitespace-pre-wrap border">
                        {selectedSubmissionExpectedOutput || '(无预期输出)'}
                      </pre>
                    )}
                    {submissionDetailTab === 'error' && (
                      <pre className="p-3 bg-red-50 rounded-lg font-mono text-sm whitespace-pre-wrap border">
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
