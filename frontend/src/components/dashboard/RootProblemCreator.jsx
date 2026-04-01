import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

function ResetProblemForm() {
  return {
    title: '',
    difficulty: 3,
    statement: '',
    timeLimitMs: 1000,
    memoryLimitMiB: 256,
    inputFormat: '请在此填写输入格式',
    outputFormat: '请在此填写输出格式',
    samples: [{ input: '', output: '' }],
    testCases: [{ input: '', output: '' }],
    options: ['A', 'B', 'C', 'D'],
    answer: ''
  }
}

export default function RootProblemCreator({ open, onClose, onCreate }) {
  const [problemType, setProblemType] = useState('programming')
  const [problemTitle, setProblemTitle] = useState('')
  const [problemDifficulty, setProblemDifficulty] = useState(3)
  const [problemStatement, setProblemStatement] = useState('')
  const [problemTimeLimit, setProblemTimeLimit] = useState(1000)
  const [problemMemoryLimit, setProblemMemoryLimit] = useState(256)
  const [problemInputFormat, setProblemInputFormat] = useState('请在此填写输入格式')
  const [problemOutputFormat, setProblemOutputFormat] = useState('请在此填写输出格式')
  const [problemSamples, setProblemSamples] = useState([{ input: '', output: '' }])
  const [problemTestCases, setProblemTestCases] = useState([{ input: '', output: '' }])
  const [problemOptions, setProblemOptions] = useState(['A', 'B', 'C', 'D'])
  const [problemAnswer, setProblemAnswer] = useState('')

  const resetProblemForm = () => {
    const reset = ResetProblemForm()
    setProblemTitle(reset.title)
    setProblemDifficulty(reset.difficulty)
    setProblemStatement(reset.statement)
    setProblemTimeLimit(reset.timeLimitMs)
    setProblemMemoryLimit(reset.memoryLimitMiB)
    setProblemInputFormat(reset.inputFormat)
    setProblemOutputFormat(reset.outputFormat)
    setProblemSamples(reset.samples)
    setProblemTestCases(reset.testCases)
    setProblemOptions(reset.options)
    setProblemAnswer(reset.answer)
  }

  const handleTypeChange = (event) => {
    const nextType = event.target.value
    setProblemType(nextType)
    resetProblemForm()
  }

  const addSample = () => {
    setProblemSamples([...problemSamples, { input: '', output: '' }])
  }

  const removeSample = (index) => {
    if (problemSamples.length === 1) return
    setProblemSamples(problemSamples.filter((_, i) => i !== index))
  }

  const updateSample = (index, field, value) => {
    const newSamples = [...problemSamples]
    newSamples[index][field] = value
    setProblemSamples(newSamples)
  }

  const addTestCase = () => {
    setProblemTestCases([...problemTestCases, { input: '', output: '' }])
  }

  const removeTestCase = (index) => {
    if (problemTestCases.length === 1) return
    setProblemTestCases(problemTestCases.filter((_, i) => i !== index))
  }

  const updateTestCase = (index, field, value) => {
    const newTestCases = [...problemTestCases]
    newTestCases[index][field] = value
    setProblemTestCases(newTestCases)
  }

  const addOption = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F']
    if (problemOptions.length >= letters.length) return
    setProblemOptions([...problemOptions, letters[problemOptions.length]])
  }

  const removeOption = (index) => {
    if (problemOptions.length <= 2) return
    setProblemOptions(problemOptions.filter((_, i) => i !== index))
  }

  const updateOption = (index, value) => {
    const newOptions = [...problemOptions]
    newOptions[index] = value
    setProblemOptions(newOptions)
  }

  const handleSubmit = () => {
    if (!problemTitle.trim()) {
      alert('题目标题不能为空')
      return
    }

    let bodyJson
    if (problemType === 'programming') {
      bodyJson = {
        statement: problemStatement,
        timeLimitMs: problemTimeLimit,
        memoryLimitMiB: problemMemoryLimit,
        inputFormat: problemInputFormat,
        outputFormat: problemOutputFormat,
        samples: problemSamples.filter(s => s.input || s.output),
        testCases: problemTestCases.filter(t => t.input || t.output)
      }
    } else if (problemType === 'single_choice') {
      bodyJson = {
        options: problemOptions,
        answer: problemAnswer
      }
    } else if (problemType === 'true_false') {
      bodyJson = {
        answer: problemAnswer
      }
    }

    onCreate({
      type: problemType,
      title: problemTitle.trim(),
      difficulty: problemDifficulty,
      bodyJson
    })

    resetProblemForm()
    setProblemType('programming')
  }

  const handleClose = () => {
    resetProblemForm()
    setProblemType('programming')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>创建根题目</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Basic Info */}
          <FormControl fullWidth>
            <InputLabel>题目类型</InputLabel>
            <Select
              value={problemType}
              label="题目类型"
              onChange={handleTypeChange}
            >
              <MenuItem value="programming">编程题</MenuItem>
              <MenuItem value="single_choice">单选题</MenuItem>
              <MenuItem value="true_false">判断题</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="题目标题"
            value={problemTitle}
            onChange={(event) => setProblemTitle(event.target.value)}
            placeholder="请输入题目标题"
          />

          <TextField
            fullWidth
            label="难度等级（1-5，3 为中等）"
            type="number"
            inputProps={{ min: 1, max: 5 }}
            value={problemDifficulty}
            onChange={(event) => setProblemDifficulty(Number(event.target.value))}
          />

          {/* Programming Problem Fields */}
          {problemType === 'programming' && (
            <>
              <TextField
                fullWidth
                label="题目正文"
                value={problemStatement}
                onChange={(event) => setProblemStatement(event.target.value)}
                multiline
                rows={6}
                placeholder="请详细描述题目要求、背景故事等"
                helperText="题目的主要描述内容"
              />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="时间限制 (ms)"
                    type="number"
                    value={problemTimeLimit}
                    onChange={(event) => setProblemTimeLimit(Number(event.target.value))}
                    inputProps={{ min: 100, step: 100 }}
                    helperText="程序运行的最大时间"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="内存限制 (MiB)"
                    type="number"
                    value={problemMemoryLimit}
                    onChange={(event) => setProblemMemoryLimit(Number(event.target.value))}
                    inputProps={{ min: 16, step: 16 }}
                    helperText="程序运行的最大内存"
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                label="输入格式"
                value={problemInputFormat}
                onChange={(event) => setProblemInputFormat(event.target.value)}
                multiline
                rows={2}
                helperText="描述程序的输入格式要求"
              />

              <TextField
                fullWidth
                label="输出格式"
                value={problemOutputFormat}
                onChange={(event) => setProblemOutputFormat(event.target.value)}
                multiline
                rows={2}
                helperText="描述程序的输出格式要求"
              />

              {/* Sample Cases */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">样例输入输出</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addSample}>
                    添加样例
                  </Button>
                </Box>
                <Stack spacing={2}>
                  {problemSamples.map((sample, index) => (
                    <Paper key={index} sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="textSecondary">样例 {index + 1}</Typography>
                        <IconButton size="small" onClick={() => removeSample(index)} disabled={problemSamples.length === 1}>
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="样例输入"
                            value={sample.input}
                            onChange={(e) => updateSample(index, 'input', e.target.value)}
                            multiline
                            rows={2}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="样例输出"
                            value={sample.output}
                            onChange={(e) => updateSample(index, 'output', e.target.value)}
                            multiline
                            rows={2}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              </Box>

              {/* Test Cases */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">测试用例（用于自动评测）</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addTestCase}>
                    添加测试用例
                  </Button>
                </Box>
                <Stack spacing={2}>
                  {problemTestCases.map((testCase, index) => (
                    <Paper key={index} sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="textSecondary">测试用例 {index + 1}</Typography>
                        <IconButton size="small" onClick={() => removeTestCase(index)} disabled={problemTestCases.length === 1}>
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="输入"
                            value={testCase.input}
                            onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                            multiline
                            rows={2}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="输出"
                            value={testCase.output}
                            onChange={(e) => updateTestCase(index, 'output', e.target.value)}
                            multiline
                            rows={2}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {/* Single Choice Problem Fields */}
          {problemType === 'single_choice' && (
            <>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">选项</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addOption} disabled={problemOptions.length >= 6}>
                    添加选项
                  </Button>
                </Box>
                <Stack spacing={1}>
                  {problemOptions.map((option, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip label={String.fromCharCode(65 + index)} size="small" sx={{ width: 40 }} />
                      <TextField
                        fullWidth
                        size="small"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`选项${String.fromCharCode(65 + index)}的内容`}
                      />
                      <IconButton size="small" onClick={() => removeOption(index)} disabled={problemOptions.length <= 2}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <FormControl fullWidth>
                <InputLabel>正确答案</InputLabel>
                <Select
                  value={problemAnswer}
                  label="正确答案"
                  onChange={(event) => setProblemAnswer(event.target.value)}
                >
                  {problemOptions.map((_, index) => (
                    <MenuItem key={index} value={String.fromCharCode(65 + index)}>
                      {String.fromCharCode(65 + index)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          {/* True/False Problem Fields */}
          {problemType === 'true_false' && (
            <FormControl fullWidth>
              <InputLabel>正确答案</InputLabel>
              <Select
                value={problemAnswer}
                label="正确答案"
                onChange={(event) => setProblemAnswer(event.target.value)}
              >
                <MenuItem value="true">正确（True）</MenuItem>
                <MenuItem value="false">错误（False）</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>创建</Button>
      </DialogActions>
    </Dialog>
  )
}
