import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ToastMessage from '../ToastMessage'
import RemoveIcon from '@mui/icons-material/Remove'

const DEFAULT_TIME_LIMIT_MS = 1000
const DEFAULT_MEMORY_LIMIT_MIB = 256
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const PROBLEM_TYPE_LABELS = {
  programming: '编程题',
  single_choice: '单选题',
  true_false: '判断题'
}

function blankCase() {
  return { input: '', output: '' }
}

function defaultStarterCode() {
  return {
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}',
    python: 'print("hello")',
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
  }
}

function normalizeCaseList(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return [blankCase()]
  }
  return list.map((item) => ({
    input: String(item?.input || ''),
    output: String(item?.output || '')
  }))
}

function normalizeOptions(options) {
  const next = Array.isArray(options) ? options.map((item) => String(item ?? '')) : []
  if (next.length >= 2) return next.slice(0, OPTION_LABELS.length)
  return ['A', 'B', 'C', 'D']
}

function buildInitialForm(problem) {
  const type = problem?.type || 'programming'
  const body = problem?.bodyJson || {}
  const answer = problem?.answerJson || {}
  const options = normalizeOptions(body.options)
  const answerIndex = Math.max(0, options.findIndex((item) => item === String(answer.answer ?? '')))

  return {
    type,
    title: problem?.title || '',
    statementMd: problem?.statementMd || '',
    timeLimitMs: String(problem?.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS),
    memoryLimitMiB: String(problem?.memoryLimitMiB ?? DEFAULT_MEMORY_LIMIT_MIB),
    programming: {
      inputFormat: String(body.inputFormat || ''),
      outputFormat: String(body.outputFormat || ''),
      samples: normalizeCaseList(body.samples),
      testCases: normalizeCaseList(body.testCases),
      starterCode: {
        ...defaultStarterCode(),
        ...(body.starterCode || {})
      }
    },
    singleChoice: {
      options,
      answerIndex
    },
    trueFalse: {
      answer: answer.answer === false ? 'false' : 'true'
    }
  }
}

function renderCaseRows(title, rows, onAdd, onRemove, onChange) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>
          添加
        </Button>
      </Box>
      <Stack spacing={1.5}>
        {rows.map((item, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">{title} {index + 1}</Typography>
              <IconButton size="small" onClick={() => onRemove(index)} disabled={rows.length === 1}>
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Box>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="输入"
                  value={item.input}
                  onChange={(event) => onChange(index, 'input', event.target.value)}
                  multiline
                  minRows={3}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="输出"
                  value={item.output}
                  onChange={(event) => onChange(index, 'output', event.target.value)}
                  multiline
                  minRows={3}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}

export default function RootProblemCreator({
  open,
  mode = 'create',
  problem = null,
  createTitle = '创建根题目',
  editTitle = null,
  createSubmitText = '创建题目',
  editSubmitText = '保存修改',
  onClose,
  onSubmit
}) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(problem))
  const lockedProblemType = isEditMode && problem?.type ? problem.type : form.type
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(buildInitialForm(problem))
    setSubmitting(false)
    setSubmitError('')
  }, [open, problem, mode])

  const dialogTitle = useMemo(() => {
    if (isEditMode) {
      if (editTitle) return editTitle
      return problem?.id ? `编辑题目 #${problem.id}` : '编辑题目'
    }
    return createTitle
  }, [createTitle, editTitle, isEditMode, problem])

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }))
  }

  const updateNestedField = (section, field, value) => {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value
      }
    }))
  }

  const updateProgrammingField = (field, value) => {
    setForm((current) => ({
      ...current,
      programming: {
        ...current.programming,
        [field]: value
      }
    }))
  }

  const updateStarterCode = (language, value) => {
    setForm((current) => ({
      ...current,
      programming: {
        ...current.programming,
        starterCode: {
          ...current.programming.starterCode,
          [language]: value
        }
      }
    }))
  }

  const updateCaseList = (field, updater) => {
    setForm((current) => ({
      ...current,
      programming: {
        ...current.programming,
        [field]: updater(current.programming[field])
      }
    }))
  }

  const addCase = (field) => {
    updateCaseList(field, (items) => [...items, blankCase()])
  }

  const removeCase = (field, index) => {
    updateCaseList(field, (items) => {
      if (items.length === 1) return items
      return items.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const updateCase = (field, index, key, value) => {
    updateCaseList(field, (items) => items.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      return {
        ...item,
        [key]: value
      }
    }))
  }

  const handleTypeChange = (event) => {
    if (isEditMode) {
      return
    }
    const nextType = event.target.value
    setForm((current) => ({
      ...current,
      type: nextType,
      programming: buildInitialForm(null).programming,
      singleChoice: buildInitialForm(null).singleChoice,
      trueFalse: buildInitialForm(null).trueFalse
    }))
  }

  const addOption = () => {
    setForm((current) => {
      if (current.singleChoice.options.length >= OPTION_LABELS.length) {
        return current
      }
      return {
        ...current,
        singleChoice: {
          ...current.singleChoice,
          options: [...current.singleChoice.options, '']
        }
      }
    })
  }

  const removeOption = (index) => {
    setForm((current) => {
      if (current.singleChoice.options.length <= 2) {
        return current
      }
      const nextOptions = current.singleChoice.options.filter((_, itemIndex) => itemIndex !== index)
      const nextAnswerIndex = Math.min(current.singleChoice.answerIndex, nextOptions.length - 1)
      return {
        ...current,
        singleChoice: {
          ...current.singleChoice,
          options: nextOptions,
          answerIndex: nextAnswerIndex
        }
      }
    })
  }

  const updateOption = (index, value) => {
    setForm((current) => ({
      ...current,
      singleChoice: {
        ...current.singleChoice,
        options: current.singleChoice.options.map((item, itemIndex) => (itemIndex === index ? value : item))
      }
    }))
  }

  const handleClose = () => {
    if (submitting) return
    setSubmitError('')
    onClose()
  }

  const handleSubmit = async () => {
    const title = form.title.trim()
    if (!title) {
      setSubmitError('题目标题不能为空')
      return
    }

    const timeLimitMs = Number(form.timeLimitMs) > 0 ? Number(form.timeLimitMs) : DEFAULT_TIME_LIMIT_MS
    const memoryLimitMiB = Number(form.memoryLimitMiB) > 0 ? Number(form.memoryLimitMiB) : DEFAULT_MEMORY_LIMIT_MIB

    let bodyJson = {}
    let answerJson = {}

    if (form.type === 'programming') {
      bodyJson = {
        inputFormat: form.programming.inputFormat,
        outputFormat: form.programming.outputFormat,
        samples: form.programming.samples.filter((item) => item.input || item.output),
        testCases: form.programming.testCases.filter((item) => item.input || item.output),
        starterCode: {
          cpp: form.programming.starterCode.cpp,
          python: form.programming.starterCode.python,
          go: form.programming.starterCode.go
        }
      }
    }

    if (form.type === 'single_choice') {
      const options = form.singleChoice.options.map((item) => item.trim())
      if (options.length < 2 || options.some((item) => !item)) {
        setSubmitError('单选题至少需要两个非空选项')
        return
      }
      const optionSet = new Set(options.map((item) => item.toLowerCase()))
      if (optionSet.size !== options.length) {
        setSubmitError('单选题选项不能重复')
        return
      }
      bodyJson = { options }
      answerJson = { answer: options[form.singleChoice.answerIndex] || options[0] }
    }

    if (form.type === 'true_false') {
      answerJson = { answer: form.trueFalse.answer === 'true' }
    }

    try {
      setSubmitting(true)
      setSubmitError('')
      await onSubmit({
        type: lockedProblemType,
        title,
        statementMd: form.statementMd,
        bodyJson,
        answerJson,
        timeLimitMs,
        memoryLimitMiB
      })
      onClose()
    } catch (err) {
      setSubmitError(err.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              {isEditMode ? (
                <TextField
                  fullWidth
                  size="small"
                  label="题目类型"
                  value={PROBLEM_TYPE_LABELS[lockedProblemType] || lockedProblemType}
                  disabled
                />
              ) : (
                <FormControl fullWidth size="small">
                  <InputLabel>题目类型</InputLabel>
                  <Select value={form.type} label="题目类型" onChange={handleTypeChange}>
                    <MenuItem value="programming">编程题</MenuItem>
                    <MenuItem value="single_choice">单选题</MenuItem>
                    <MenuItem value="true_false">判断题</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                size="small"
                label="题目标题"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="时间限制 (ms)"
                type="number"
                value={form.timeLimitMs}
                onChange={(event) => updateField('timeLimitMs', event.target.value)}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="内存限制 (MiB)"
                type="number"
                value={form.memoryLimitMiB}
                onChange={(event) => updateField('memoryLimitMiB', event.target.value)}
                inputProps={{ min: 1 }}
              />
            </Grid>
          </Grid>

          <TextField
            fullWidth
            size="small"
            label="题面 Markdown"
            value={form.statementMd}
            onChange={(event) => updateField('statementMd', event.target.value)}
            multiline
            minRows={6}
          />

          {form.type === 'programming' && (
            <>
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="输入格式"
                    value={form.programming.inputFormat}
                    onChange={(event) => updateProgrammingField('inputFormat', event.target.value)}
                    multiline
                    minRows={3}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="输出格式"
                    value={form.programming.outputFormat}
                    onChange={(event) => updateProgrammingField('outputFormat', event.target.value)}
                    multiline
                    minRows={3}
                  />
                </Grid>
              </Grid>

              {renderCaseRows(
                '样例',
                form.programming.samples,
                () => addCase('samples'),
                (index) => removeCase('samples', index),
                (index, field, value) => updateCase('samples', index, field, value)
              )}

              {renderCaseRows(
                '测试用例',
                form.programming.testCases,
                () => addCase('testCases'),
                (index) => removeCase('testCases', index),
                (index, field, value) => updateCase('testCases', index, field, value)
              )}

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>默认代码模板</Typography>
                <Stack spacing={1.5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="C++"
                    value={form.programming.starterCode.cpp}
                    onChange={(event) => updateStarterCode('cpp', event.target.value)}
                    multiline
                    minRows={5}
                    InputProps={{ sx: { fontFamily: 'monospace' } }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Python"
                    value={form.programming.starterCode.python}
                    onChange={(event) => updateStarterCode('python', event.target.value)}
                    multiline
                    minRows={4}
                    InputProps={{ sx: { fontFamily: 'monospace' } }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Go"
                    value={form.programming.starterCode.go}
                    onChange={(event) => updateStarterCode('go', event.target.value)}
                    multiline
                    minRows={5}
                    InputProps={{ sx: { fontFamily: 'monospace' } }}
                  />
                </Stack>
              </Box>
            </>
          )}

          {form.type === 'single_choice' && (
            <>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">选项</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addOption}
                    disabled={form.singleChoice.options.length >= OPTION_LABELS.length}
                  >
                    添加选项
                  </Button>
                </Box>
                <Stack spacing={1}>
                  {form.singleChoice.options.map((option, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={OPTION_LABELS[index]} size="small" sx={{ minWidth: 42 }} />
                      <TextField
                        fullWidth
                        size="small"
                        label={`选项 ${OPTION_LABELS[index]}`}
                        value={option}
                        onChange={(event) => updateOption(index, event.target.value)}
                      />
                      <IconButton
                        size="small"
                        onClick={() => removeOption(index)}
                        disabled={form.singleChoice.options.length <= 2}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <FormControl fullWidth size="small">
                <InputLabel>正确答案</InputLabel>
                <Select
                  value={String(form.singleChoice.answerIndex)}
                  label="正确答案"
                  onChange={(event) => updateNestedField('singleChoice', 'answerIndex', Number(event.target.value))}
                >
                  {form.singleChoice.options.map((_, index) => (
                    <MenuItem key={index} value={String(index)}>
                      {OPTION_LABELS[index]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          {form.type === 'true_false' && (
            <FormControl fullWidth size="small">
              <InputLabel>正确答案</InputLabel>
              <Select
                value={form.trueFalse.answer}
                label="正确答案"
                onChange={(event) => updateNestedField('trueFalse', 'answer', event.target.value)}
              >
                <MenuItem value="true">正确</MenuItem>
                <MenuItem value="false">错误</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '保存中...' : isEditMode ? editSubmitText : createSubmitText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
