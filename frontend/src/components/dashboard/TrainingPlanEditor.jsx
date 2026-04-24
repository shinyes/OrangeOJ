import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ToastMessage from '../ToastMessage'

function blankChapter(index) {
  return {
    title: `第 ${index + 1} 章`,
    problemIds: []
  }
}

function normalizeProblemIds(chapter) {
  if (Array.isArray(chapter?.problemIds)) {
    return chapter.problemIds
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  }
  if (Array.isArray(chapter?.items)) {
    return chapter.items
      .map((item) => Number(item?.problemId))
      .filter((item) => Number.isInteger(item) && item > 0)
  }
  return []
}

function buildInitialForm(plan) {
  const chapters = Array.isArray(plan?.chapters)
    ? plan.chapters.map((chapter, index) => ({
        title: String(chapter?.title || `第 ${index + 1} 章`),
        problemIds: normalizeProblemIds(chapter)
      }))
    : [blankChapter(0)]

  return {
    title: String(plan?.title || ''),
    allowSelfJoin: plan?.allowSelfJoin !== false,
    isPublic: plan?.isPublic !== false,
    published: Boolean(plan?.published ?? plan?.publishedAt),
    chapters
  }
}

export default function TrainingPlanEditor({
  open,
  mode = 'create',
  plan = null,
  problemOptions = [],
  onClose,
  onSubmit
}) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(plan))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(buildInitialForm(plan))
    setSubmitting(false)
    setSubmitError('')
  }, [open, plan, mode])

  const problemMap = useMemo(() => {
    const map = new Map()
    problemOptions.forEach((problem) => {
      map.set(problem.id, problem)
    })
    return map
  }, [problemOptions])

  const resolveProblemOption = (problemId) => {
    const matched = problemMap.get(problemId)
    if (matched) {
      return matched
    }
    return {
      id: problemId,
      title: `题目 ${problemId}`
    }
  }

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }))
  }

  const updateChapter = (index, patch) => {
    setForm((current) => ({
      ...current,
      chapters: current.chapters.map((chapter, chapterIndex) => {
        if (chapterIndex !== index) return chapter
        return {
          ...chapter,
          ...patch
        }
      })
    }))
  }

  const addChapter = () => {
    setForm((current) => ({
      ...current,
      chapters: [...current.chapters, blankChapter(current.chapters.length)]
    }))
  }

  const removeChapter = (index) => {
    setForm((current) => ({
      ...current,
      chapters: current.chapters.filter((_, chapterIndex) => chapterIndex !== index)
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
      setSubmitError('训练标题不能为空')
      return
    }

    const chapters = form.chapters.map((chapter, index) => ({
      title: String(chapter.title || '').trim() || `第 ${index + 1} 章`,
      orderNo: index + 1,
      problemIds: normalizeProblemIds(chapter)
    }))

    try {
      setSubmitting(true)
      setSubmitError('')
      await onSubmit({
        title,
        allowSelfJoin: form.allowSelfJoin,
        isPublic: form.isPublic,
        published: form.published,
        chapters
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
      <DialogTitle>{isEditMode ? '编辑训练计划' : '创建训练计划'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <TextField
            fullWidth
            size="small"
            label="训练标题"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={form.allowSelfJoin}
                  onChange={(event) => updateField('allowSelfJoin', event.target.checked)}
                />
              )}
              label="允许成员自行加入"
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={form.isPublic}
                  onChange={(event) => updateField('isPublic', event.target.checked)}
                />
              )}
              label="公开训练（普通成员可见）"
            />
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
            <Typography variant="subtitle2">章节</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addChapter}>
              添加章节
            </Button>
          </Box>

          {form.chapters.length === 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography color="text.secondary">当前没有章节，点击“添加章节”开始配置。</Typography>
            </Paper>
          )}

          {form.chapters.map((chapter, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">章节 {index + 1}</Typography>
                <IconButton size="small" color="error" onClick={() => removeChapter(index)}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </Box>

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="章节标题"
                  value={chapter.title}
                  onChange={(event) => updateChapter(index, { title: event.target.value })}
                />

                <Autocomplete
                  multiple
                  size="small"
                  options={problemOptions}
                  value={chapter.problemIds.map((problemId) => resolveProblemOption(problemId))}
                  onChange={(event, value) => updateChapter(index, { problemIds: value.map((item) => item.id) })}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => `#${option.id} ${option.title}`}
                  filterSelectedOptions
                  filterOptions={(options, state) => {
                    const keyword = state.inputValue.trim().toLowerCase()
                    if (!keyword) {
                      return []
                    }
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
                  renderTags={(value, getTagProps) => value.map((option, itemIndex) => {
                    const { key, ...tagProps } = getTagProps({ index: itemIndex })
                    return (
                      <Chip
                        key={key || option.id}
                        size="small"
                        label={`#${option.id} ${option.title}`}
                        {...tagProps}
                      />
                    )
                  })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="章节题目"
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
          {submitting ? '保存中...' : (isEditMode ? '保存修改' : '创建计划')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
