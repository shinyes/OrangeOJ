import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
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
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
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

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return []
  const seen = new Set()
  return tags
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item) return false
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function parseTagInput(raw) {
  return String(raw || '')
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatJSON(value) {
  return JSON.stringify(value ?? {}, null, 2)
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value)
  return parsed > 0 ? parsed : fallback
}

function buildProblemDataFromForm(form, options = {}) {
  const strict = options.strict !== false
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
    return { bodyJson, answerJson }
  }

  if (form.type === 'single_choice') {
    const optionsList = strict
      ? form.singleChoice.options.map((item) => item.trim())
      : form.singleChoice.options.map((item) => String(item ?? ''))
    if (strict) {
      if (optionsList.length < 2 || optionsList.some((item) => !item)) {
        throw new Error('单选题至少需要两个非空选项')
      }
      const optionSet = new Set(optionsList.map((item) => item.toLowerCase()))
      if (optionSet.size !== optionsList.length) {
        throw new Error('单选题选项不能重复')
      }
    }
    bodyJson = { options: optionsList }
    answerJson = { answer: optionsList[form.singleChoice.answerIndex] || optionsList[0] || '' }
    return { bodyJson, answerJson }
  }

  if (form.type === 'true_false') {
    answerJson = { answer: form.trueFalse.answer === 'true' }
  }

  return { bodyJson, answerJson }
}

function buildStorageDraftFromForm(form, options = {}) {
  const { bodyJson, answerJson } = buildProblemDataFromForm(form, { strict: false })
  const draft = {
    type: options.lockedProblemType || form.type,
    title: form.title,
    tags: normalizeTagList(form.tags),
    statementMd: form.statementMd,
    bodyJson,
    answerJson,
    timeLimitMs: normalizePositiveInteger(form.timeLimitMs, DEFAULT_TIME_LIMIT_MS),
    memoryLimitMiB: normalizePositiveInteger(form.memoryLimitMiB, DEFAULT_MEMORY_LIMIT_MIB)
  }
  return formatJSON(draft)
}

function parseJSONText(raw, fieldLabel) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`${fieldLabel} 不是合法 JSON`)
  }
}

function parseStorageDraft(raw, options = {}) {
  const draft = parseJSONText(raw, '题目 JSON')
  if (!draft || Array.isArray(draft) || typeof draft !== 'object') {
    throw new Error('题目 JSON 必须是对象')
  }

  const requestedType = normalizeProblemTypeValue(draft.type)
  const type = options.lockedProblemType || requestedType || 'programming'
  if (!PROBLEM_TYPE_LABELS[type]) {
    throw new Error('题目 JSON 中的 type 不合法')
  }

  return {
    type,
    title: String(draft.title || ''),
    tags: normalizeTagList(draft.tags),
    statementMd: String(draft.statementMd || ''),
    bodyJson: draft.bodyJson && typeof draft.bodyJson === 'object' && !Array.isArray(draft.bodyJson) ? draft.bodyJson : {},
    answerJson: draft.answerJson && typeof draft.answerJson === 'object' && !Array.isArray(draft.answerJson) ? draft.answerJson : {},
    timeLimitMs: normalizePositiveInteger(draft.timeLimitMs, DEFAULT_TIME_LIMIT_MS),
    memoryLimitMiB: normalizePositiveInteger(draft.memoryLimitMiB, DEFAULT_MEMORY_LIMIT_MIB)
  }
}

function normalizeProblemTypeValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'single_choice' || normalized === 'single-choice' || normalized === 'singlechoice') {
    return 'single_choice'
  }
  if (normalized === 'true_false' || normalized === 'true-false' || normalized === 'truefalse') {
    return 'true_false'
  }
  if (normalized === 'programming') {
    return 'programming'
  }
  return ''
}

function buildFormFromStorageDraft(draft) {
  return buildInitialForm({
    type: draft.type,
    title: draft.title,
    tags: draft.tags,
    statementMd: draft.statementMd,
    bodyJson: draft.bodyJson,
    answerJson: draft.answerJson,
    timeLimitMs: draft.timeLimitMs,
    memoryLimitMiB: draft.memoryLimitMiB
  })
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
    tags: normalizeTagList(problem?.tags),
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
  tagSuggestions = [],
  onClose,
  onSubmit
}) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(problem))
  const lockedProblemType = isEditMode && problem?.type ? problem.type : form.type
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [tagInputValue, setTagInputValue] = useState('')
  const [editorMode, setEditorMode] = useState('ui')
  const [jsonDraft, setJSONDraft] = useState(() => buildStorageDraftFromForm(buildInitialForm(problem), { lockedProblemType: isEditMode && problem?.type ? problem.type : undefined }))

  useEffect(() => {
    if (!open) return
    const nextForm = buildInitialForm(problem)
    setForm(nextForm)
    setJSONDraft(buildStorageDraftFromForm(nextForm, { lockedProblemType: isEditMode && problem?.type ? problem.type : undefined }))
    setEditorMode('ui')
    setSubmitting(false)
    setSubmitError('')
    setTagInputValue('')
  }, [open, problem, mode])

  const dialogTitle = useMemo(() => {
    if (isEditMode) {
      if (editTitle) return editTitle
      return problem?.id ? `编辑题目 #${problem.id}` : '编辑题目'
    }
    return createTitle
  }, [createTitle, editTitle, isEditMode, problem])
  const normalizedTagSuggestions = useMemo(
    () => normalizeTagList(tagSuggestions),
    [tagSuggestions]
  )

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }))
  }

  const mergePendingTags = (rawInput = tagInputValue) => {
    const nextTags = normalizeTagList([...form.tags, ...parseTagInput(rawInput)])
    if (nextTags.length !== form.tags.length || nextTags.some((tag, index) => tag !== form.tags[index])) {
      setForm((current) => ({
        ...current,
        tags: nextTags
      }))
    }
    setTagInputValue('')
    return nextTags
  }

  const handleEditorModeChange = (event, nextMode) => {
    if (!nextMode || nextMode === editorMode) return
    if (nextMode === 'json') {
      const nextTags = normalizeTagList([...form.tags, ...parseTagInput(tagInputValue)])
      const snapshot = {
        ...form,
        tags: nextTags
      }
      setForm(snapshot)
      setTagInputValue('')
      setJSONDraft(buildStorageDraftFromForm(snapshot, { lockedProblemType }))
      setEditorMode('json')
      setSubmitError('')
      return
    }

    try {
      const draft = parseStorageDraft(jsonDraft, { lockedProblemType })
      setForm(buildFormFromStorageDraft(draft))
      setEditorMode('ui')
      setSubmitError('')
    } catch (err) {
      setSubmitError(err.message || 'JSON 模式内容有误')
    }
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
    const blankForm = buildInitialForm({ type: nextType })
    setForm((current) => ({
      ...current,
      type: nextType,
      programming: blankForm.programming,
      singleChoice: blankForm.singleChoice,
      trueFalse: blankForm.trueFalse
    }))
    if (editorMode === 'json') {
      setJSONDraft(buildStorageDraftFromForm({
        ...form,
        type: nextType,
        programming: blankForm.programming,
        singleChoice: blankForm.singleChoice,
        trueFalse: blankForm.trueFalse
      }, { lockedProblemType }))
    }
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
    let problemType = lockedProblemType
    let title = form.title.trim()
    let mergedTags = normalizeTagList([...form.tags, ...parseTagInput(tagInputValue)])
    let statementMd = form.statementMd
    let timeLimitMs = Number(form.timeLimitMs) > 0 ? Number(form.timeLimitMs) : DEFAULT_TIME_LIMIT_MS
    let memoryLimitMiB = Number(form.memoryLimitMiB) > 0 ? Number(form.memoryLimitMiB) : DEFAULT_MEMORY_LIMIT_MIB
    let bodyJson = {}
    let answerJson = {}

    try {
      if (editorMode === 'json') {
        const draft = parseStorageDraft(jsonDraft, { lockedProblemType })
        problemType = draft.type
        title = draft.title.trim()
        mergedTags = draft.tags
        statementMd = draft.statementMd
        timeLimitMs = draft.timeLimitMs
        memoryLimitMiB = draft.memoryLimitMiB
        bodyJson = draft.bodyJson
        answerJson = draft.answerJson
      } else {
        const payload = buildProblemDataFromForm(form, { strict: true })
        bodyJson = payload.bodyJson
        answerJson = payload.answerJson
      }
    } catch (err) {
      setSubmitError(err.message || '题目内容格式不正确')
      return
    }

    if (!title) {
      setSubmitError('题目标题不能为空')
      return
    }

    try {
      setSubmitting(true)
      setSubmitError('')
      await onSubmit({
        type: problemType,
        title,
        tags: mergedTags,
        statementMd,
        bodyJson,
        answerJson,
        timeLimitMs,
        memoryLimitMiB
      })
      setTagInputValue('')
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

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              编辑模式
            </Typography>
            <Tabs
              value={editorMode}
              onChange={handleEditorModeChange}
              variant="fullWidth"
              sx={{
                minHeight: 36,
                '& .MuiTab-root': {
                  minHeight: 36
                }
              }}
            >
              <Tab label="UI 模式" value="ui" />
              <Tab label="JSON 模式" value="json" />
            </Tabs>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              UI 模式适合常规录题；JSON 模式直接编辑整道题提交给后端的完整结构，字段和落库内容一一对应。
            </Typography>
          </Box>

          {editorMode === 'json' ? (
            <>
              <Typography variant="caption" color="text.secondary">
                当前 JSON 对应题库接口 payload：`type / title / tags / statementMd / bodyJson / answerJson / timeLimitMs / memoryLimitMiB`。
                编辑态会强制沿用原题型，不会因为 JSON 里的 `type` 改变题型。
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="题目存储 JSON"
                value={jsonDraft}
                onChange={(event) => setJSONDraft(event.target.value)}
                multiline
                minRows={24}
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
            </>
          ) : (
            <>
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

              <Autocomplete
                multiple
                freeSolo
                options={normalizedTagSuggestions}
                value={form.tags}
                onChange={(event, value) => updateField('tags', normalizeTagList(value))}
                inputValue={tagInputValue}
                onInputChange={(event, value, reason) => {
                  if (reason === 'reset') {
                    setTagInputValue('')
                    return
                  }
                  setTagInputValue(value)
                }}
                filterSelectedOptions
                renderTags={(value, getTagProps) => value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index })
                  return (
                    <Chip
                      key={key || `${option}-${index}`}
                      size="small"
                      label={option}
                      {...tagProps}
                    />
                  )
                })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="题目标签"
                    placeholder="输入标签后按回车"
                    helperText="可选。用于按主题、难度、知识点检索题目。"
                    onBlur={(event) => {
                      mergePendingTags(event.target.value)
                    }}
                  />
                )}
              />

              <TextField
                fullWidth
                size="small"
                label="题面 Markdown"
                value={form.statementMd}
                onChange={(event) => updateField('statementMd', event.target.value)}
                multiline
                minRows={6}
              />
            </>
          )}

          {editorMode === 'ui' && form.type === 'programming' ? (
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
          ) : null}

          {editorMode === 'ui' && form.type === 'single_choice' && (
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

          {editorMode === 'ui' && form.type === 'true_false' && (
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
