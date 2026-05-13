import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import ToastMessage from '../ToastMessage'
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
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [problemSourceMode, setProblemSourceMode] = useState('manual')
  const [problemDraftsJSON, setProblemDraftsJSON] = useState('')
  const [searchPerItem, setSearchPerItem] = useState({})

  useEffect(() => {
    if (!open) return
    setForm(buildInitialForm(homework)); setSubmitting(false); setSubmitError('')
    setDraggingIndex(null); setDragOverIndex(null); setProblemSourceMode('manual'); setProblemDraftsJSON(''); setSearchPerItem({})
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditMode ? '编辑作业' : '创建作业'}</DialogTitle></DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <Input placeholder="作业标题" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
          <Textarea placeholder="作业说明" value={form.description} onChange={(e) => updateField('description', e.target.value)} className="min-h-[80px]" />

          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs font-medium mb-1 block">截止时间</label>
              <Input type="datetime-local" value={form.dueAt} onChange={(e) => updateField('dueAt', e.target.value)} className="min-w-[240px]" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">页面模式</label>
              <Select value={form.displayMode} onValueChange={(v) => updateField('displayMode', v)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">试卷模式</SelectItem>
                  <SelectItem value="list">题单模式</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm pb-1.5">
              <Checkbox checked={form.published} onCheckedChange={(c) => updateField('published', c)} />
              立即发布
            </label>
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

              {form.items.map((item, index) => (
                <div key={index} className={`border rounded-lg p-4 ${form.displayMode === 'list' && dragOverIndex === index ? 'border-primary shadow-sm' : ''} ${draggingIndex === index ? 'opacity-70' : ''}`}
                  onDragOver={(e) => {
                    if (form.displayMode !== 'list' || draggingIndex === null) return
                    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
                    if (dragOverIndex !== index) setDragOverIndex(index)
                  }}
                  onDrop={(e) => {
                    if (form.displayMode !== 'list' || draggingIndex === null) return
                    e.preventDefault(); reorderItems(draggingIndex, index); setDraggingIndex(null); setDragOverIndex(null)
                  }}>
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="text-sm font-medium">第 {index + 1} 题</h5>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost"
                        draggable={form.displayMode === 'list'}
                        onDragStart={(e) => {
                          if (form.displayMode !== 'list') return
                          e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index))
                          setDraggingIndex(index); setDragOverIndex(index)
                        }}
                        onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null) }}
                        className={`cursor-${form.displayMode === 'list' ? 'grab' : 'default'}`}>
                        <GripVertical className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => moveItem(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeItem(index)} disabled={form.items.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>

                  <div>
                    <Input placeholder="输入题号、标题或标签搜索" className="mb-2"
                      value={searchPerItem[index] || ''}
                      onChange={(e) => setSearchPerItem({ ...searchPerItem, [index]: e.target.value })} />
                    {searchPerItem[index]?.trim() && (
                      <div className="border rounded-lg max-h-40 overflow-y-auto mb-2">
                        {problemOptions.filter((p) => {
                          const kw = searchPerItem[index].trim().toLowerCase()
                          const tagsText = (p.tags || []).join(' ').toLowerCase()
                          return String(p.id).includes(kw) || p.title.toLowerCase().includes(kw) || tagsText.includes(kw)
                        }).slice(0, 20).map((p) => (
                          <div key={p.id} className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                            onClick={() => {
                              updateItem(index, { problemId: p.id })
                              setSearchPerItem({ ...searchPerItem, [index]: '' })
                            }}>
                            #{p.id} {p.title}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.problemId && (
                      <div className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs cursor-pointer"
                        onClick={() => updateItem(index, { problemId: null })}>
                        #{item.problemId} {resolveProblem(item.problemId)?.title || `题目 ${item.problemId}`} ×
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
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
