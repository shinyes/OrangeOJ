import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { api } from '../api'
import Alert from '@mui/material/Alert'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopy from '@mui/icons-material/ContentCopy'
import HistoryIcon from '@mui/icons-material/History'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import MarkdownContent from '../components/MarkdownContent'
import ToastMessage from '../components/ToastMessage'
import { useAuth } from '../hooks/useAuth'

const editorLang = {
  cpp: 'cpp',
  python: 'python',
  go: 'go'
}

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) {
    return path
  }
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
  return {
    totalCaseCount,
    passedCaseCount,
    failedCaseCount
  }
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
  const [runInputDialog, setRunInputDialog] = useState({ open: false, value: '' })
  const [submissions, setSubmissions] = useState([])
  const [showSubmissionHistory, setShowSubmissionHistory] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [selectedSubmissionCaseIndex, setSelectedSubmissionCaseIndex] = useState(0)
  const [submissionDetailTab, setSubmissionDetailTab] = useState('code')
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const numericProblemId = Number(problemId)
  const draftStorageKey = `orangeoj:homework:${spaceId}:${homeworkId}:draft`
  const defaultBackTo = `/spaces/${spaceId}/homeworks/${homeworkId}`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回作业'
  const reviewSubmissionId = Number(searchParams.get('submissionId') || 0)
  const isReviewMode = Number.isInteger(reviewSubmissionId) && reviewSubmissionId > 0
  const selectedSubmissionCaseDetails = selectedSubmission?.caseDetails || []
  const selectedSubmissionCase = selectedSubmissionCaseDetails[selectedSubmissionCaseIndex] || null
  const selectedSubmissionInput = selectedSubmissionCase?.input ?? selectedSubmission?.input ?? ''
  const selectedSubmissionOutput = selectedSubmissionCase?.output ?? selectedSubmission?.output ?? ''
  const selectedSubmissionExpectedOutput =
    selectedSubmissionCase?.expectedOutput ?? selectedSubmission?.expectedOutput ?? ''
  const selectedSubmissionError = selectedSubmissionCase?.error ?? selectedSubmission?.error ?? ''

  async function copyToClipboard(text, message) {
    try {
      await navigator.clipboard.writeText(text || '')
      setSnackbar({ open: true, message: `${message}已复制`, severity: 'success' })
    } catch (err) {
      console.error('复制失败:', err)
      setSnackbar({ open: true, message: '复制失败', severity: 'error' })
    }
  }

  useEffect(() => {
    if (!snackbar.open) return undefined
    const timer = window.setTimeout(() => {
      setSnackbar((current) => ({ ...current, open: false }))
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [snackbar.open])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
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
        programming: {
          ...stored.programming,
          [numericProblemId]: nextDraft
        }
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(merged))
      return nextDraft
    })
    if (message) {
      setActionMessage(message)
    }
  }

  const refreshSubmissionHistory = async () => {
    try {
      const result = await api.listSubmissions(spaceId, numericProblemId, { all: true })
      setSubmissions(result?.submissions || [])
    } catch {
      // 测评记录不是阻塞链路
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        setActionMessage('')

        const [spaceData, homeworkData, problemData] = await Promise.all([
          api.getSpace(spaceId),
          api.getHomework(spaceId, homeworkId),
          api.getProblem(spaceId, problemId)
        ])

        const homeworkHasProblem = (homeworkData?.items || []).some((item) => Number(item.problemId) === numericProblemId)
        if (!homeworkHasProblem) {
          throw new Error('当前作业不包含这道编程题')
        }
        if (problemData?.type !== 'programming') {
          throw new Error('当前题目不是编程题')
        }

        let nextDraft = null
        let nextSubmissions = []
        let nextSelectedSubmission = null
        let nextConsoleText = '控制台已就绪'

        if (isReviewMode) {
          const submissionDetail = await api.getSubmission(reviewSubmissionId)
          if (Number(submissionDetail?.problemId) !== numericProblemId) {
            throw new Error('当前提交记录不属于这道编程题')
          }
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
          const storedDraft = loadStoredDraft(draftStorageKey)
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
  }, [spaceId, homeworkId, problemId, reviewSubmissionId])

  const updateDraft = (patch) => {
    if (isReviewMode) return
    persistProgrammingDraft((current) => ({
      ...current,
      ...patch,
      touched: true
    }))
  }

  const saveDraft = () => {
    if (isReviewMode) return
    const savedAt = new Date().toISOString()
    persistProgrammingDraft((current) => ({
      ...current,
      lastSavedAt: savedAt
    }), '代码草稿已保存到本地')
  }

  const pollSubmission = async (submissionId) => {
    for (let round = 0; round < 180; round += 1) {
      const snapshot = await api.pollSubmission(submissionId)
      setConsoleText(
        `${snapshot.stdout || ''}\n${snapshot.stderr || ''}\n状态：${snapshot.status} / ${snapshot.verdict || ''}`
      )
      if (snapshot.status === 'done' || snapshot.status === 'failed') {
        return snapshot
      }
      await new Promise((resolve) => setTimeout(resolve, snapshot.pollAfterMs || 1000))
    }
    throw new Error('判题等待超时，请稍后再试')
  }

  const handleProgrammingRunOrTest = async (mode, programmingOverride = null) => {
    if (isReviewMode) return
    const nextDraft = programmingOverride || draft
    if (!nextDraft) return

    try {
      setRunning(true)
      setError('')
      setActionMessage('')
      setConsoleText(`[${new Date().toLocaleTimeString()}] 开始${mode === 'run' ? '运行' : '测试'}...`)

      const payload = {
        language: nextDraft.language,
        sourceCode: nextDraft.code,
        inputData: nextDraft.customInput || ''
      }

      const created = mode === 'run'
        ? await api.run(spaceId, numericProblemId, payload)
        : await api.test(spaceId, numericProblemId, payload)

      const result = await pollSubmission(created.submissionId)
      setConsoleText(
        (current) => `${current}\n\n最终结果：${result.verdict || '-'} | ${(result.timeMs || 0)}ms | ${(result.memoryKiB || 0)}KiB`
      )
      await refreshSubmissionHistory()
    } catch (err) {
      setError(err.message || '运行失败')
      setConsoleText((current) => `${current}\n错误：${err.message || '运行失败'}`)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="screen-center">编程题加载中...</div>
  }

  if (error && (!problem || !draft)) {
    return (
      <div className="page-shell">
        <div className="error-box">{error}</div>
        <Link className="ghost-btn" to={backTo}>{backLabel}</Link>
      </div>
    )
  }

  if (!problem || !draft) {
    return <div className="screen-center">编程题不存在</div>
  }

  const samples = problem.bodyJson?.samples || []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ minHeight: '40px !important', py: 0.5, gap: 1.5 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, flexShrink: 0 }} noWrap>
              {problem.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {homework?.title ? `${homework.title} | ` : ''}剩余时间：{formatCountdown(homework?.dueAt, now)} | 截止：{formatDateTime(homework?.dueAt)}
            </Typography>
          </Box>
          <IconButton
            color="inherit"
            component={Link}
            to={backTo}
            aria-label={backLabel}
            sx={{ ml: 1 }}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
      {actionMessage && <ToastMessage message={actionMessage} severity="success" onShown={() => setActionMessage('')} />}

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', p: 2, gap: 2 }}>
        <Card
          sx={{
            width: '40%',
            minWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <CardContent
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              '&::-webkit-scrollbar': { width: '8px' },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
              题目描述
            </Typography>

            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                mb: 3
              }}
            >
              <MarkdownContent content={problem.statementMd} />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
              输入格式
            </Typography>
            <Box sx={{ ml: 1, mb: 2 }}>
              <MarkdownContent content={problem.bodyJson?.inputFormat || '见题目描述'} />
            </Box>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
              输出格式
            </Typography>
            <Box sx={{ ml: 1, mb: 2 }}>
              <MarkdownContent content={problem.bodyJson?.outputFormat || '见题目描述'} />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
              样例
            </Typography>
            {samples.length === 0 ? (
              <Typography variant="body2" color="text.secondary" paragraph>
                暂无样例
              </Typography>
            ) : (
              <Stack spacing={2} sx={{ mt: 1 }}>
                {samples.map((sample, index) => (
                  <Box key={index}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 1,
                        bgcolor: 'grey.50',
                        borderRadius: 2,
                        '&:hover': { bgcolor: 'grey.100' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          输入样例 {index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(sample.input, '输入样例')}
                          sx={{ color: 'primary.main' }}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          p: 1,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowX: 'auto'
                        }}
                      >
                        {sample.input || '(空)'}
                      </Box>
                    </Paper>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: 'grey.50',
                        borderRadius: 2,
                        '&:hover': { bgcolor: 'grey.100' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'success.main' }}>
                          输出样例 {index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(sample.output, '输出样例')}
                          sx={{ color: 'success.main' }}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          p: 1,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowX: 'auto'
                        }}
                      >
                        {sample.output || '(空)'}
                      </Box>
                    </Paper>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
              限制
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography variant="body2">时间限制：<strong>{problem.timeLimitMs}ms</strong></Typography>
              <Typography variant="body2">内存限制：<strong>{problem.memoryLimitMiB}MiB</strong></Typography>
              <Typography variant="body2">
                {isReviewMode ? '提交时间：' : '最近保存：'}
                <strong>{draft.lastSavedAt ? formatDateTime(draft.lastSavedAt) : (isReviewMode ? '未记录' : '尚未保存')}</strong>
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <CardContent
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              p: 2
            }}
          >
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 130 }} disabled={isReviewMode}>
                <InputLabel>语言</InputLabel>
                <Select
                  value={draft.language}
                  label="语言"
                  onChange={(event) => updateDraft({
                    language: event.target.value,
                    code: pickStarter(problem.bodyJson || {}, event.target.value)
                  })}
                  sx={{ bgcolor: 'background.paper' }}
                >
                  <MenuItem value="cpp">C++17</MenuItem>
                  <MenuItem value="python">Python 3.8</MenuItem>
                  <MenuItem value="go">Go 1.25</MenuItem>
                </Select>
              </FormControl>
              {!isReviewMode ? (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={running}
                    onClick={() => setRunInputDialog({ open: true, value: draft.customInput || '' })}
                    startIcon={<PlayArrowRoundedIcon />}
                    sx={{ minWidth: 80 }}
                  >
                    运行
                  </Button>
                  <Button
                    variant="contained"
                    disabled={running}
                    onClick={() => handleProgrammingRunOrTest('test')}
                    sx={{ minWidth: 80 }}
                  >
                    测试
                  </Button>
                  <Button
                    variant="contained"
                    color="info"
                    onClick={saveDraft}
                    startIcon={<SaveRoundedIcon />}
                    sx={{ minWidth: 80 }}
                  >
                    保存
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  正在查看提交 #{reviewSubmissionId} 的代码
                </Typography>
              )}
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="outlined"
                endIcon={<HistoryIcon />}
                onClick={() => setShowSubmissionHistory(true)}
              >
                {isReviewMode ? '查看测评详情' : `测评记录 ${submissions.length > 0 ? `(${submissions.length})` : ''}`}
              </Button>
            </Stack>

            <Box
              sx={{
                flexGrow: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 2,
                overflow: 'hidden',
                minHeight: 200
              }}
            >
              <Editor
                theme="vs"
                language={editorLang[draft.language]}
                value={draft.code}
                onChange={(value) => updateDraft({ code: value || '' })}
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
                  diffWordWrap: 'off',
                  readOnly: isReviewMode
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                控制台输出
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 2,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                  minHeight: 120,
                  maxHeight: 200,
                  border: 1,
                  borderColor: 'divider'
                }}
              >
                {consoleText || '暂无输出'}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Dialog
        open={runInputDialog.open}
        onClose={() => setRunInputDialog({ open: false, value: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>自定义输入</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={6}
            value={runInputDialog.value}
            onChange={(event) => setRunInputDialog({ open: true, value: event.target.value })}
            placeholder="请输入测试数据"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunInputDialog({ open: false, value: '' })}>取消</Button>
          <Button
            variant="contained"
            onClick={() => {
              const nextDraft = {
                ...draft,
                customInput: runInputDialog.value,
                touched: true
              }
              persistProgrammingDraft(nextDraft)
              setRunInputDialog({ open: false, value: '' })
              setTimeout(() => {
                handleProgrammingRunOrTest('run', nextDraft)
              }, 0)
            }}
          >
            运行
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showSubmissionHistory}
        onClose={() => setShowSubmissionHistory(false)}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            maxHeight: '85vh',
            width: '80%'
          }
        }}
      >
        <DialogTitle>测评记录</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedSubmission ? (
            <Box sx={{ width: '100%' }}>
              {selectedSubmissionCaseDetails.length > 0 && (
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ px: 2, pt: 2 }}>
                  <Chip size="small" variant="outlined" label={`测试点 ${selectedSubmissionCaseDetails.length} 个`} />
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={`通过 ${selectedSubmissionCaseDetails.filter((item) => item.verdict === 'AC' || item.verdict === 'OK').length} 个`}
                  />
                  <Chip
                    size="small"
                    color="error"
                    variant="outlined"
                    label={`未通过 ${selectedSubmissionCaseDetails.filter((item) => item.verdict && item.verdict !== 'AC' && item.verdict !== 'OK').length} 个`}
                  />
                </Stack>
              )}
              {selectedSubmissionCaseDetails.length > 0 && (
                <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="homework-submission-case-select-label">测试点</InputLabel>
                    <Select
                      labelId="homework-submission-case-select-label"
                      label="测试点"
                      value={selectedSubmissionCaseIndex}
                      onChange={(event) => setSelectedSubmissionCaseIndex(Number(event.target.value))}
                    >
                      {selectedSubmissionCaseDetails.map((item, index) => (
                        <MenuItem key={`${item.caseNo}-${index}`} value={index}>
                          {`测试点 ${item.caseNo}${item.verdict ? ` · ${item.verdict}` : ''}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={submissionDetailTab} onChange={(event, value) => setSubmissionDetailTab(value)}>
                  <Tab label="代码" value="code" />
                  <Tab label="输入" value="input" />
                  <Tab label="输出" value="output" />
                  <Tab label="预期输出" value="expected" />
                  <Tab label="错误" value="error" />
                </Tabs>
              </Box>
              <Box sx={{ p: 2, maxHeight: '50vh', overflow: 'auto' }}>
                {submissionDetailTab === 'code' && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>代码</Typography>
                      <IconButton size="small" onClick={() => copyToClipboard(selectedSubmission.code, '代码')}>
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.875rem',
                        border: 1,
                        borderColor: 'divider'
                      }}
                    >
                      {selectedSubmission.code || '无代码'}
                    </Box>
                  </Box>
                )}
                {submissionDetailTab === 'input' && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      border: 1,
                      borderColor: 'divider'
                    }}
                  >
                    {selectedSubmissionInput || '(空)'}
                  </Box>
                )}
                {submissionDetailTab === 'output' && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: selectedSubmissionError ? 'error.light' : 'grey.50',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      border: 1,
                      borderColor: 'divider'
                    }}
                  >
                    {selectedSubmissionOutput || '(无输出)'}
                  </Box>
                )}
                {submissionDetailTab === 'expected' && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'success.light',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      border: 1,
                      borderColor: 'divider'
                    }}
                  >
                    {selectedSubmissionExpectedOutput || '(无预期输出)'}
                  </Box>
                )}
                {submissionDetailTab === 'error' && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'error.light',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      border: 1,
                      borderColor: 'divider'
                    }}
                  >
                    {selectedSubmissionError || '(无错误)'}
                  </Box>
                )}
              </Box>
            </Box>
          ) : submissions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">
                暂无测评记录
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                点击“测试”或“运行”后，测评记录会显示在这里
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
              {submissions.map((submission, index) => {
                const summary = getSubmissionCaseSummary(submission)
                return (
                  <ListItem
                    key={submission.id || index}
                    divider
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
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <HistoryIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`提交 #${submission.id} - ${submission.verdict || submission.status}`}
                      secondary={`${submission.userId && submission.userId !== user?.id ? `用户：${submission.username || `#${submission.userId}`} | ` : ''}${new Date(submission.createdAt).toLocaleString()} | ${(submission.timeMs || 0)}ms | ${(submission.memoryKiB || 0)}KiB${summary.totalCaseCount > 0 ? ` | 测试点 ${summary.passedCaseCount}/${summary.totalCaseCount}` : ''}`}
                    />
                  </ListItem>
                )
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          {selectedSubmission ? (
            <Button
              onClick={() => {
                setSelectedSubmission(null)
                setSelectedSubmissionCaseIndex(0)
              }}
            >
              返回列表
            </Button>
          ) : (
            <Button onClick={() => setShowSubmissionHistory(false)}>关闭</Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
