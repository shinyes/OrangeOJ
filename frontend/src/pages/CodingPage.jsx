import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { api } from '../api'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import HistoryIcon from '@mui/icons-material/History'
import ContentCopy from '@mui/icons-material/ContentCopy'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Slide from '@mui/material/Slide'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Snackbar from '@mui/material/Snackbar'
import MarkdownContent, { MarkdownWithMarker } from '../components/MarkdownContent'
import ToastMessage from '../components/ToastMessage'
import { useAuth } from '../hooks/useAuth'

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
  return {
    totalCaseCount,
    passedCaseCount,
    failedCaseCount
  }
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
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const [objectiveAnswer, setObjectiveAnswer] = useState('')

  const body = useMemo(() => problem?.bodyJson || {}, [problem])
  const backTo = safeInternalPath(searchParams.get('returnTo'))
  const backLabel = searchParams.get('returnLabel') || '返回首页'
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

  // Auto-close snackbar after 2 seconds, unaffected by mouse interaction
  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        setSnackbar({ ...snackbar, open: false })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [snackbar.open])

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        let data, space
        if (spaceId) {
          // Space problem
          ;[data, space] = await Promise.all([
            api.getProblem(spaceId, problemId),
            api.getSpace(spaceId)
          ])
        } else {
          // Root problem
          data = await api.getRootProblem(problemId)
        }
        const defaultLanguage = normalizeDefaultLanguage(space?.defaultProgrammingLanguage)
        setLanguage(defaultLanguage)
        setProblem(data)
        if (data.type === 'programming') {
          const key = spaceId
            ? `orangeoj:code:${spaceId}:${problemId}:${defaultLanguage}`
            : `orangeoj:code:root:${problemId}:${defaultLanguage}`
          const cached = localStorage.getItem(key)
          setCode(cached || pickStarter(data.bodyJson, defaultLanguage))
        }
        
        // Fetch submission history for this problem (all problem types)
        if (spaceId) {
          try {
            const result = await api.listSubmissions(spaceId, problemId, { all: true })
            const submissions = result?.submissions || []
            setSubmissions(submissions)
          } catch (subErr) {
            // Silently ignore - submission history is optional
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, problemId])

  useEffect(() => {
    if (!problem || problem.type !== 'programming') return
    const key = spaceId
      ? `orangeoj:code:${spaceId}:${problemId}:${language}`
      : `orangeoj:code:root:${problemId}:${language}`
    const cached = localStorage.getItem(key)
    setCode(cached || pickStarter(problem.bodyJson, language))
  }, [language, problem, spaceId, problemId])

  const handleRunClick = () => {
    setShowCustomInputDialog(true)
    setTempCustomInput(customInput)
  }

  const handleTestClick = () => {
    handleCodeSubmit('test')
  }

  const saveDraft = () => {
    const key = spaceId
      ? `orangeoj:code:${spaceId}:${problemId}:${language}`
      : `orangeoj:code:root:${problemId}:${language}`
    localStorage.setItem(key, code)
    setConsoleText((prev) => `${prev}\n[${nowTimeText()}] 草稿已保存到本地`)
  }

  const pollSubmission = async (submissionId) => {
    for (let i = 0; i < 180; i += 1) {
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

  const handleCodeSubmit = async (mode) => {
    if (!problem || problem.type !== 'programming') return

    setRunning(true)
    setError('')
    const actionText = mode === 'run' ? '运行' : '测试'
    setConsoleText(`[${nowTimeText()}] 开始${actionText}...`)

    try {
      const payload = {
        language,
        sourceCode: code,
        inputData: customInput
      }

      const created = spaceId
        ? mode === 'run'
          ? await api.run(spaceId, problemId, payload)
          : await api.test(spaceId, problemId, payload)
        : mode === 'run'
          ? await api.runRoot(problemId, payload)
          : await api.testRoot(problemId, payload)

      const result = await pollSubmission(created.submissionId)
      setConsoleText(
        (prev) => `${prev}\n\n最终结果：${result.verdict || '-'} | ${(result.timeMs || 0)}ms | ${(result.memoryKiB || 0)}KiB`
      )
      
      // Reload submission history after successful submission
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
      setConsoleText(`判定结果：${result.verdict} | 得分：${result.score}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="screen-center">题目加载中...</div>
  }

  if (error && !problem) {
    return (
      <div className="page-shell">
        <div className="error-box">{error}</div>
        <Link className="ghost-btn" to={backTo}>{backLabel}</Link>
      </div>
    )
  }

  if (!problem) {
    return <div className="screen-center">题目不存在</div>
  }

  if (problem.type !== 'programming') {
    return (
      <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{problem.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {problemTypeText(problem.type)}
              </Typography>
            </Box>
            <Button color="inherit" component={Link} to={backTo}>
              {backLabel}
            </Button>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}

          <Card>
            <CardContent>
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

              {problem.type === 'single_choice' ? (
                <FormControl component="fieldset" sx={{ mb: 2.5, width: '100%' }}>
                  <FormLabel component="legend">选项</FormLabel>
                  <RadioGroup value={objectiveAnswer} onChange={(e) => setObjectiveAnswer(e.target.value)}>
                    {(body.options || []).map((opt, index) => (
                      <FormControlLabel
                        key={`${String(opt)}-${index}`}
                        value={String(opt)}
                        control={<Radio />}
                        disableTypography
                        label={renderChoiceOptionLabel(index, opt)}
                        sx={{
                          alignItems: 'flex-start',
                          mr: 0,
                          '.MuiFormControlLabel-label': {
                            flexGrow: 1
                          }
                        }}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              ) : (
                <FormControl component="fieldset" sx={{ mb: 2.5, width: '100%' }}>
                  <FormLabel component="legend">答案</FormLabel>
                  <RadioGroup row value={objectiveAnswer} onChange={(e) => setObjectiveAnswer(e.target.value)}>
                    <FormControlLabel value="true" control={<Radio />} label="正确" />
                    <FormControlLabel value="false" control={<Radio />} label="错误" />
                  </RadioGroup>
                </FormControl>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: consoleText ? 0 : 0 }}>
                <Button
                  variant="contained"
                  disabled={running || !objectiveAnswer}
                  onClick={handleObjectiveSubmit}
                >
                  {running ? '提交中...' : '提交答案'}
                </Button>
              </Box>

              {consoleText && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {consoleText}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    )
  }

  const samples = body.samples || []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ minHeight: '48px !important', py: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: '600', flexGrow: 1 }}>{problem.title}</Typography>
          <IconButton 
            color="inherit" 
            component={Link} 
            to={backTo}
            sx={{ ml: 1 }}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', p: 2, gap: 2 }}>
        {/* Left Panel - Problem Description */}
        <Card sx={{ 
          width: '40%', 
          minWidth: 400,
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <CardContent sx={{ 
            flexGrow: 1, 
            overflow: 'auto',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }
          }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>题目描述</Typography>
            
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

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: '600', mt: 2 }}>输入格式</Typography>
            <Box sx={{ ml: 1, mb: 2 }}>
              <MarkdownContent content={body.inputFormat || '见题目描述'} />
            </Box>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: '600', mt: 2 }}>输出格式</Typography>
            <Box sx={{ ml: 1, mb: 2 }}>
              <MarkdownContent content={body.outputFormat || '见题目描述'} />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: '600', mt: 2 }}>样例</Typography>
            {samples.length === 0 ? (
              <Typography variant="body2" color="text.secondary" paragraph>暂无样例</Typography>
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
                        <Typography variant="subtitle2" sx={{ fontWeight: '600', color: 'primary.main' }}>
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
                        <Typography variant="subtitle2" sx={{ fontWeight: '600', color: 'success.main' }}>
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

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: '600', mt: 2 }}>限制</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography variant="body2">时间限制：<strong>{problem.timeLimitMs}ms</strong></Typography>
              <Typography variant="body2">内存限制：<strong>{problem.memoryLimitMiB}MiB</strong></Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Right Panel - Code Editor */}
        <Card sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <CardContent sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            p: 2
          }}>
            {/* Toolbar */}
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>语言</InputLabel>
                <Select
                  value={language}
                  label="语言"
                  onChange={(e) => setLanguage(e.target.value)}
                  sx={{ bgcolor: 'background.paper' }}
                >
                  <MenuItem value="cpp">C++17</MenuItem>
                  <MenuItem value="python">Python 3.8</MenuItem>
                  <MenuItem value="go">Go 1.25</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" color="success" disabled={running} onClick={() => handleRunClick()} sx={{ minWidth: 80 }}>
                运行
              </Button>
              <Button variant="contained" disabled={running} onClick={() => handleTestClick()} sx={{ minWidth: 80 }}>
                测试
              </Button>
              <Button variant="contained" color="info" onClick={saveDraft} sx={{ minWidth: 80 }}>
                保存
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button 
                variant="outlined" 
                endIcon={<HistoryIcon />}
                onClick={() => setShowSubmissionHistory(true)}
              >
                测评记录 {submissions.length > 0 && `(${submissions.length})`}
              </Button>
            </Stack>

            {/* Code Editor */}
            <Box sx={{ 
              flexGrow: 1, 
              border: 1, 
              borderColor: 'divider', 
              borderRadius: 1, 
              mb: 2,
              overflow: 'hidden',
              minHeight: 200
            }}>
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
            </Box>

            {/* Console Output */}
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: '600', mb: 1 }}>控制台输出</Typography>
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

      {/* Custom Input Dialog */}
      <Dialog
        open={showCustomInputDialog}
        onClose={() => setShowCustomInputDialog(false)}
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
            value={tempCustomInput}
            onChange={(e) => setTempCustomInput(e.target.value)}
            placeholder="请输入测试数据"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomInputDialog(false)}>取消</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setCustomInput(tempCustomInput);
              setShowCustomInputDialog(false);
              handleCodeSubmit('run');
            }}
          >
            运行
          </Button>
        </DialogActions>
      </Dialog>

      {/* Submission History Dialog */}
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
            /* Detail View */
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
                    <InputLabel id="coding-submission-case-select-label">测试点</InputLabel>
                    <Select
                      labelId="coding-submission-case-select-label"
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
                <Tabs value={submissionDetailTab} onChange={(e, newValue) => setSubmissionDetailTab(newValue)}>
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
                      <Typography variant="subtitle2" sx={{ fontWeight: '600' }}>代码</Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => copyToClipboard(selectedSubmission.code, '代码')}
                      >
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
            /* Empty State */
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">
                暂无测评记录
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                点击"测试"或"运行"按钮提交代码后，测评记录将在这里显示
              </Typography>
            </Box>
          ) : (
            /* List View */
            <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
              {submissions.map((sub, index) => {
                const summary = getSubmissionCaseSummary(sub)
                return (
                  <ListItem
                    key={sub.id || index}
                    divider
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
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <HistoryIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`提交 #${sub.id} - ${sub.verdict || sub.status}`}
                      secondary={`${sub.userId && sub.userId !== user?.id ? `用户：${sub.username || `#${sub.userId}`} | ` : ''}${new Date(sub.createdAt).toLocaleString()} | ${(sub.timeMs || 0)}ms | ${(sub.memoryKiB || 0)}KiB${summary.totalCaseCount > 0 ? ` | 测试点 ${summary.passedCaseCount}/${summary.totalCaseCount}` : ''}`}
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
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
