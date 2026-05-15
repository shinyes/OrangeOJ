import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { DatePicker } from '../ui/date-picker'
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import ToastMessage from '../ToastMessage'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'
import { parseProblemDraftArray } from '../../utils/problemDrafts'

function blankItem() { return { problemId: null } }

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
    title: String(homework?.title || ''), description: String(homework?.description || ''),
    dueAt: formatDatetimeLocal(homework?.dueAt), displayMode: String(homework?.displayMode || 'exam'),
    published: Boolean(homework?.published),
    items: rawItems.length > 0 ? rawItems.map((item) => ({ problemId: Number(item?.problemId) || null })) : [blankItem()]
  }
}

export default function HomeworkEditor({ open, mode = 'create', homework = null, problemOptions = [], onClose, onSubmit }) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(homework))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const itemRefs = useRef({})
  const [dragState, setDragState] = useState({ active: false, index: null })
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [problemSourceMode, setProblemSourceMode] = useState('manual')
  const [problemDraftsJSON, setProblemDraftsJSON] = useState('')
  const [searchPerItem, setSearchPerItem] = useState({})

  useEffect(() => {
    if (!open) return
    setForm(buildInitialForm(homework)); setSubmitting(false); setSubmitError('')
    setDragState({ active: false, index: null }); setDragOverIndex(null); setProblemSourceMode('manual'); setProblemDraftsJSON(''); setSearchPerItem({})
  }, [open, homework, mode])

  const problemMap = useMemo(() => {
    const map = new Map()
    problemOptions.forEach((p) => map.set(p.id, p))
    return map
  }, [problemOptions])

  const resolveProblem = (problemId) => {
    const matched = problemMap.get(problemId)
    return matched || (problemId ? { id: problemId, title: `题目 ${problemId}` } : null)
  }

  const updateField = (field, value) => setForm((c) => ({ ...c, [field]: value }))
  const updateItem = (index, patch) => setForm((c) => ({ ...c, items: c.items.map((item, i) => i !== index ? item : { ...item, ...patch }) }))
  const addItem = () => setForm((c) => ({ ...c, items: [...c.items, blankItem()] }))

  const reorderItems = (from, to) => {
    setForm((c) => {
      if (from === to || from < 0 || to < 0 || from >= c.items.length || to >= c.items.length) return c
      const next = [...c.items]; next.splice(to, 0, ...next.splice(from, 1)); return { ...c, items: next }
    })
  }

  const reorderRef = useRef(reorderItems)
  reorderRef.current = reorderItems

  useEffect(() => {
    if (!dragState.active) return

    const handleMouseMove = (e) => {
      for (const [idx, el] of Object.entries(itemRefs.current)) {
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          setDragOverIndex(Number(idx))
          break
        }
      }
    }

    const handleMouseUp = () => {
      if (dragOverIndex !== null && dragState.index !== null && dragOverIndex !== dragState.index) {
        reorderRef.current(dragState.index, dragOverIndex)
      }
      setDragState({ active: false, index: null })
      setDragOverIndex(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.active, dragState.index, dragOverIndex])

  const moveItem = (index, dir) => reorderItems(index, index + dir)

  const removeItem = (index) => setForm((c) => {
    if (c.items.length === 1) return c
    return { ...c, items: c.items.filter((_, i) => i !== index) }
  })

  const handleClose = () => { if (submitting) return; setSubmitError(''); onClose() }

  const handleSubmit = async () => {
    const title = form.title.trim()
    if (!title) { setSubmitError('作业标题不能为空'); return }

    let problemDrafts = []
    const normalizedItems = problemSourceMode === 'import' ? [] : form.items.map((item, index) => ({ problemId: Number(item.problemId), orderNo: index + 1, score: 100 }))

    if (problemSourceMode === 'import') {
      try { problemDrafts = parseProblemDraftArray(problemDraftsJSON) }
      catch (err) { setSubmitError(err.message || '题目 JSON 数组不合法'); return }
    } else {
      if (normalizedItems.some((item) => !Number.isInteger(item.problemId) || item.problemId <= 0)) { setSubmitError('请为每一道作业题选择有效题目'); return }
      if (new Set(normalizedItems.map((item) => item.problemId)).size !== normalizedItems.length) { setSubmitError('作业中不能重复添加同一道题'); return }
    }

    try {
      setSubmitting(true); setSubmitError('')
      await onSubmit({ title, description: form.description.trim(), dueAt: toDueAtISO(form.dueAt), displayMode: form.displayMode || 'exam', published: form.published, items: normalizedItems, problemDrafts })
      onClose()
    } catch (err) { setSubmitError(err.message || '保存失败') }
    finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>{isEditMode ? '编辑作业' : '创建作业'}</DialogTitle></DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-4 pt-2 pr-4">
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <Input placeholder="作业标题" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
          <Textarea placeholder="作业说明" value={form.description} onChange={(e) => updateField('description', e.target.value)} className="min-h-[80px]" />

          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <Label className="text-xs mb-1 block">截止时间</Label>
              <DatePicker value={form.dueAt} onChange={(v) => updateField('dueAt', v)} placeholder="未设置截止时间" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">页面模式</Label>
              <Select value={form.displayMode} onValueChange={(v) => updateField('displayMode', v)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">试卷模式</SelectItem>
                  <SelectItem value="list">题单模式</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Label className="flex items-center gap-2 pb-1.5 cursor-pointer">
              <Checkbox checked={form.published} onCheckedChange={(c) => updateField('published', c)} />
              立即发布
            </Label>
          </div>

          {!isEditMode && (
            <div>
              <h4 className="text-sm font-medium mb-2">题目来源</h4>
              <Tabs value={problemSourceMode} onValueChange={(v) => { if (v) { setProblemSourceMode(v); setSubmitError('') } }}>
                <TabsList className="w-full">
                  <TabsTrigger value="manual" className="flex-1">从题库选题</TabsTrigger>
                  <TabsTrigger value="import" className="flex-1">导入题目 JSON 数组</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {problemSourceMode === 'import' && !isEditMode ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">这里接收题目存储对象的 JSON 数组。每一项对应一题。</p>
              <Textarea className="font-mono min-h-[300px]" value={problemDraftsJSON} onChange={(e) => setProblemDraftsJSON(e.target.value)} placeholder={'[ { "type": "single_choice", ... }, { "type": "programming", ... } ]'} />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">作业题目</h4>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" />添加题目</Button>
              </div>

              {form.displayMode === 'list' && (
                <ToastMessage message="题单模式会严格按下面的题目顺序展示。可以直接拖拽手柄调整顺序。" severity="info" />
              )}

              <div className="flex flex-col gap-1">
                {form.items.map((item, index) => (
                  <div key={index}
                    ref={(el) => { itemRefs.current[index] = el }}
                    className={`flex items-center gap-1 rounded-lg border bg-card ${form.displayMode === 'list' && dragOverIndex === index ? 'border-primary shadow-sm' : ''} ${dragState.index === index ? 'opacity-70' : ''}`}>

                    <Button size="icon" variant="ghost"
                      onMouseDown={(e) => {
                        if (form.displayMode !== 'list') return
                        e.preventDefault()
                        setDragState({ active: true, index })
                        setDragOverIndex(index)
                      }}
                      className={`shrink-0 ${form.displayMode === 'list' ? 'cursor-grab' : 'cursor-default'}`}>
                      <GripVertical className="h-4 w-4" />
                    </Button>

                    <span className="text-xs text-muted-foreground shrink-0 w-14 text-center">第 {index + 1} 题</span>

                    <div className="flex-1 min-w-0 relative py-1">
                      {item.problemId ? (
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => updateItem(index, { problemId: null })}>
                          #{item.problemId} {resolveProblem(item.problemId)?.title || `题目 ${item.problemId}`} ×
                        </Badge>
                      ) : (
                        <>
                          <Input className="h-7 text-xs" placeholder="搜索题号、标题或标签..."
                            value={searchPerItem[index] || ''}
                            onChange={(e) => setSearchPerItem({ ...searchPerItem, [index]: e.target.value })} />
                          {searchPerItem[index]?.trim() && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-0.5 border rounded-md max-h-36 overflow-y-auto bg-popover shadow-lg">
                              {problemOptions.filter((p) => {
                                const kw = searchPerItem[index].trim().toLowerCase()
                                const tagsText = (p.tags || []).join(' ').toLowerCase()
                                return String(p.id).includes(kw) || p.title.toLowerCase().includes(kw) || tagsText.includes(kw)
                              }).slice(0, 15).map((p) => (
                                <div key={p.id} className="px-2 py-1 text-xs cursor-pointer hover:bg-accent"
                                  onClick={() => {
                                    updateItem(index, { problemId: p.id })
                                    setSearchPerItem({ ...searchPerItem, [index]: '' })
                                  }}>
                                  #{p.id} {p.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <Button size="icon" variant="ghost" onClick={() => moveItem(index, -1)} disabled={index === 0} className="shrink-0 h-7 w-7"><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1} className="shrink-0 h-7 w-7"><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(index)} disabled={form.items.length <= 1} className="shrink-0 h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : (isEditMode ? '保存修改' : '创建作业')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
