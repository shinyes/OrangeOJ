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
import Grid from '@mui/material/Grid'
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

function nowTimeText() {
  return new Date().toLocaleTimeString()
}

export default function CodingPage() {
  const { spaceId, problemId } = useParams()
  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [language, setLanguage] = useState('cpp')
  const [code, setCode] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [consoleText, setConsoleText] = useState('控制台已就绪')
  const [running, setRunning] = useState(false)

  const [objectiveAnswer, setObjectiveAnswer] = useState('')

  const body = useMemo(() => problem?.bodyJson || {}, [problem])

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
    const actionText = mode === 'run' ? '运行' : mode === 'test' ? '测试' : '提交'
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
          : mode === 'test'
            ? await api.test(spaceId, problemId, payload)
            : await api.submit(spaceId, problemId, payload)
        : mode === 'run'
          ? await api.runRoot(problemId, payload)
          : mode === 'test'
            ? await api.testRoot(problemId, payload)
            : await api.submitRoot(problemId, payload)

      const result = await pollSubmission(created.submissionId)
      setConsoleText(
        (prev) => `${prev}\n\n最终结果：${result.verdict || '-'} | ${(result.timeMs || 0)}ms | ${(result.memoryKiB || 0)}KiB`
      )
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
        <Link className="ghost-btn" to="/">返回首页</Link>
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
            <Button color="inherit" component={Link} to="/">
              返回首页
            </Button>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Card>
            <CardContent>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  mb: 3
                }}
              >
                {problem.statementMd}
              </Box>

              {problem.type === 'single_choice' ? (
                <FormControl component="fieldset" sx={{ mb: 3 }}>
                  <FormLabel component="legend">选项</FormLabel>
                  <RadioGroup value={objectiveAnswer} onChange={(e) => setObjectiveAnswer(e.target.value)}>
                    {(body.options || []).map((opt) => (
                      <FormControlLabel
                        key={String(opt)}
                        value={String(opt)}
                        control={<Radio />}
                        label={String(opt)}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              ) : (
                <FormControl component="fieldset" sx={{ mb: 3 }}>
                  <FormLabel component="legend">答案</FormLabel>
                  <RadioGroup row value={objectiveAnswer} onChange={(e) => setObjectiveAnswer(e.target.value)}>
                    <FormControlLabel value="true" control={<Radio />} label="正确" />
                    <FormControlLabel value="false" control={<Radio />} label="错误" />
                  </RadioGroup>
                </FormControl>
              )}

              <Button
                variant="contained"
                disabled={running || !objectiveAnswer}
                onClick={handleObjectiveSubmit}
              >
                {running ? '提交中...' : '提交答案'}
              </Button>

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
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{problem.title}</Typography>
          </Box>
          <Button color="inherit" component={Link} to="/">
            返回首页
          </Button>
        </Toolbar>
      </AppBar>

      {error && <Alert severity="error" sx={{ mx: 2, mt: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ p: 2 }}>
        <Grid item xs={12} lg={5}>
          <Card sx={{ maxHeight: 'calc(100vh - 140px)', overflow: 'auto' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>题目描述</Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  mb: 2
                }}
              >
                {problem.statementMd}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>输入格式</Typography>
              <Typography variant="body2" paragraph>
                {body.inputFormat || '见题目描述'}
              </Typography>

              <Typography variant="subtitle1" gutterBottom>输出格式</Typography>
              <Typography variant="body2" paragraph>
                {body.outputFormat || '见题目描述'}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>样例</Typography>
              {samples.length === 0 ? (
                <Typography variant="body2" color="text.secondary" paragraph>暂无样例</Typography>
              ) : (
                samples.map((sample, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Paper variant="outlined" sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" gutterBottom>输入样例 {index + 1}</Typography>
                      <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {sample.input || '(空)'}
                      </Box>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" gutterBottom>输出样例 {index + 1}</Typography>
                      <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {sample.output || '(空)'}
                      </Box>
                    </Paper>
                  </Box>
                ))
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>限制</Typography>
              <Typography variant="body2">时间限制：{problem.timeLimitMs}ms</Typography>
              <Typography variant="body2">内存限制：{problem.memoryLimitMiB}MiB</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Card sx={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>语言</InputLabel>
                  <Select
                    value={language}
                    label="语言"
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <MenuItem value="cpp">C++17</MenuItem>
                    <MenuItem value="python">Python 3.8</MenuItem>
                    <MenuItem value="go">Go 1.25</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="contained" color="success" disabled={running} onClick={() => handleCodeSubmit('run')}>
                  运行
                </Button>
                <Button variant="outlined" disabled={running} onClick={() => handleCodeSubmit('test')}>
                  测试
                </Button>
                <Button variant="outlined" onClick={saveDraft}>
                  保存
                </Button>
                <Button variant="contained" disabled={running} onClick={() => handleCodeSubmit('submit')}>
                  提交
                </Button>
              </Stack>

              <Box sx={{ flexGrow: 1, border: 1, borderColor: 'divider', borderRadius: 1, mb: 2, minHeight: 300 }}>
                <Editor
                  theme="vs"
                  language={editorLang[language]}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 15,
                    tabSize: 2,
                    automaticLayout: true
                  }}
                />
              </Box>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="自定义输入（运行模式）"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="请输入运行模式的输入内容"
                sx={{ mb: 2 }}
              />

              <Typography variant="subtitle2" gutterBottom>控制台输出</Typography>
              <Box
                sx={{
                  flexGrow: 1,
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                  minHeight: 150
                }}
              >
                {consoleText || '暂无输出'}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
