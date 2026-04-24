import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import RemoveIcon from '@mui/icons-material/Remove'
import ToastMessage from '../ToastMessage'

function blankItem() {
  return {
    problemId: null
  }
}

function formatDatetimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (input) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toDueAtISO(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function buildInitialForm(homework) {
  const rawItems = Array.isArray(homework?.items) ? homework.items : []
  return {
    title: String(homework?.title || ''),
    description: String(homework?.description || ''),
    dueAt: formatDatetimeLocal(homework?.dueAt),
    displayMode: String(homework?.displayMode || 'exam'),
    published: Boolean(homework?.published),
    items: rawItems.length > 0
      ? rawItems.map((item) => ({
          problemId: Number(item?.problemId) || null
        }))
      : [blankItem()]
  }
}

export default function HomeworkEditor({
  open,
  mode = 'create',
  homework = null,
  problemOptions = [],
  onClose,
  onSubmit
}) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(homework))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [draggingItemIndex, setDraggingItemIndex] = useState(null)
  const [dragOverItemIndex, setDragOverItemIndex] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(buildInitialForm(homework))
    setSubmitting(false)
    setSubmitError('')
    setDraggingItemIndex(null)
    setDragOverItemIndex(null)
  }, [open, homework, mode])

  const problemMap = useMemo(() => {
    const map = new Map()
    problemOptions.forEach((problem) => {
      map.set(problem.id, problem)
    })
    return map
  }, [problemOptions])

  const resolveProblem = (problemId) => {
    const matched = problemMap.get(problemId)
    if (matched) return matched
    return problemId ? { id: problemId, title: `题目 ${problemId}` } : null
  }

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }))
  }

  const updateItem = (index, patch) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return {
          ...item,
          ...patch
        }
      })
    }))
  }

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, blankItem()]
    }))
  }

  const reorderItems = (fromIndex, toIndex) => {
    setForm((current) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= current.items.length || toIndex >= current.items.length) {
        return current
      }
      const nextItems = [...current.items]
      const [movedItem] = nextItems.splice(fromIndex, 1)
      nextItems.splice(toIndex, 0, movedItem)
      return {
        ...current,
        items: nextItems
      }
    })
  }

  const moveItem = (index, direction) => {
    reorderItems(index, index + direction)
  }

  const removeItem = (index) => {
    setForm((current) => {
      if (current.items.length === 1) {
        return current
      }
      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index)
      }
    })
  }

  const handleClose = () => {
    if (submitting) return
    setSubmitError('')
    onClose()
  }

  const handleSubmit = async () => {
    const title = form.title.trim()
    if (!title) {
      setSubmitError('作业标题不能为空')
      return
    }

    const normalizedItems = form.items.map((item, index) => ({
      problemId: Number(item.problemId),
      orderNo: index + 1,
      score: 100
    }))

    if (normalizedItems.some((item) => !Number.isInteger(item.problemId) || item.problemId <= 0)) {
      setSubmitError('请为每一道作业题选择有效题目')
      return
    }

    const uniqueProblemIds = new Set(normalizedItems.map((item) => item.problemId))
    if (uniqueProblemIds.size !== normalizedItems.length) {
      setSubmitError('作业中不能重复添加同一道题')
      return
    }

    try {
      setSubmitting(true)
      setSubmitError('')
      await onSubmit({
        title,
        description: form.description.trim(),
        dueAt: toDueAtISO(form.dueAt),
        displayMode: form.displayMode || 'exam',
        published: form.published,
        items: normalizedItems
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
      <DialogTitle>{isEditMode ? '编辑作业' : '创建作业'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <TextField
            fullWidth
            size="small"
            label="作业标题"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
          />

          <TextField
            fullWidth
            size="small"
            label="作业说明"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            multiline
            minRows={3}
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              type="datetime-local"
              label="截止时间"
              value={form.dueAt}
              onChange={(event) => updateField('dueAt', event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="homework-display-mode-label">页面模式</InputLabel>
              <Select
                labelId="homework-display-mode-label"
                label="页面模式"
                value={form.displayMode}
                onChange={(event) => updateField('displayMode', event.target.value)}
              >
                <MenuItem value="exam">试卷模式</MenuItem>
                <MenuItem value="list">题单模式</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={form.published}
                  onChange={(event) => updateField('published', event.target.checked)}
                />
              )}
              label="立即发布"
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">作业题目</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
              添加题目
            </Button>
          </Box>

          {form.displayMode === 'list' && (
            <ToastMessage
              message="题单模式会严格按下面的题目顺序展示。可以直接拖拽每道题右上角的手柄调整顺序，也可以继续使用上移、下移按钮。"
              severity="info"
            />
          )}

          {form.items.map((item, index) => (
            <Paper
              key={index}
              variant="outlined"
              onDragOver={(event) => {
                if (form.displayMode !== 'list' || draggingItemIndex === null) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                if (dragOverItemIndex !== index) {
                  setDragOverItemIndex(index)
                }
              }}
              onDrop={(event) => {
                if (form.displayMode !== 'list' || draggingItemIndex === null) return
                event.preventDefault()
                reorderItems(draggingItemIndex, index)
                setDraggingItemIndex(null)
                setDragOverItemIndex(null)
              }}
              sx={{
                p: 2,
                borderColor: form.displayMode === 'list' && dragOverItemIndex === index ? 'primary.main' : undefined,
                boxShadow: form.displayMode === 'list' && dragOverItemIndex === index ? 1 : 'none',
                opacity: draggingItemIndex === index ? 0.7 : 1
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">第 {index + 1} 题</Typography>
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    draggable={form.displayMode === 'list'}
                    onDragStart={(event) => {
                      if (form.displayMode !== 'list') return
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', String(index))
                      setDraggingItemIndex(index)
                      setDragOverItemIndex(index)
                    }}
                    onDragEnd={() => {
                      setDraggingItemIndex(null)
                      setDragOverItemIndex(null)
                    }}
                    aria-label="拖拽排序"
                    sx={{ cursor: form.displayMode === 'list' ? 'grab' : 'default' }}
                  >
                    <DragIndicatorIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label="上移题目"
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === form.items.length - 1}
                    aria-label="下移题目"
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => removeItem(index)} disabled={form.items.length <= 1}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>

              <Stack spacing={2}>
                <Autocomplete
                  size="small"
                  options={problemOptions}
                  value={resolveProblem(item.problemId)}
                  onChange={(event, value) => updateItem(index, { problemId: value?.id || null })}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => `#${option.id} ${option.title}`}
                  filterOptions={(options, state) => {
                    const keyword = state.inputValue.trim().toLowerCase()
                    if (!keyword) return []
                    return options.filter((option) => {
                      const tagsText = Array.isArray(option.tags) ? option.tags.join(' ').toLowerCase() : ''
                      return (
                        String(option.id).includes(keyword) ||
                        String(option.title || '').toLowerCase().includes(keyword) ||
                        tagsText.includes(keyword)
                      )
                    })
                  }}
                  noOptionsText={problemOptions.length === 0 ? '当前空间题库为空' : '请输入题号、标题或标签搜索'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="选择题目"
                      placeholder="输入题号、标题或标签搜索"
                    />
                  )}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '保存中...' : isEditMode ? '保存修改' : '创建作业'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
