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
import { Upload } from 'lucide-react'
import { api } from '../../api'

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

function parseTags(rawTags) {
  if (Array.isArray(rawTags)) return rawTags.filter(Boolean)
  if (typeof rawTags === 'string') return rawTags.split(',').map(t => t.trim()).filter(Boolean)
  return []
}

function tagsToString(tags) {
  return Array.isArray(tags) ? tags.join(', ') : ''
}

function buildInitialForm(practice) {
  const rawItems = Array.isArray(practice?.items) ? practice.items : []
  return {
    title: String(practice?.title || ''), description: String(practice?.description || ''),
    dueAt: formatDatetimeLocal(practice?.dueAt), displayMode: String(practice?.displayMode || 'exam'),
    published: Boolean(practice?.published),
    tags: parseTags(practice?.tags),
    items: rawItems.length > 0 ? rawItems.map((item) => ({ problemId: Number(item?.problemId) || null })) : [blankItem()]
  }
}

export default function PracticeEditor({ open, mode = 'create', practice = null, spaceId, problemOptions = [], onClose, onSubmit }) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(practice))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const itemRefs = useRef({})
  const [dragState, setDragState] = useState({ active: false, index: null })
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [problemSourceMode, setProblemSourceMode] = useState('manual')
  const [zipFile, setZipFile] = useState(null)
  const [searchPerItem, setSearchPerItem] = useState({})
  const descRef = useRef(null)

  const autoGrowTextarea = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    if (descRef.current) autoGrowTextarea(descRef.current)
  }, [form.description])

  useEffect(() => {
    if (!open) return
    setForm(buildInitialForm(practice)); setSubmitting(false); setSubmitError('')
    setDragState({ active: false, index: null }); setDragOverIndex(null); setProblemSourceMode('manual'); setZipFile(null); setSearchPerItem({})
  }, [open, practice, mode])

  const handleImportZip = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubmitError('')
    setZipFile(file)
    e.target.value = ''
  }

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
    if (!title) { setSubmitError('练习标题不能为空'); return }

    let problemDrafts = []
    let normalizedItems

    try { setSubmitting(true); setSubmitError('')

    if (problemSourceMode === 'import') {
      if (!zipFile) { setSubmitError('请先选择题目 ZIP 文件'); return }
      const result = await api.importProblems(spaceId, zipFile)
      const problems = result?.problems || []
      if (problems.length === 0) { setSubmitError('ZIP 中未找到有效题目'); return }
      normalizedItems = problems.map((p, index) => ({ problemId: Number(p.id), orderNo: index + 1, score: 100 }))
    } else {
      normalizedItems = form.items.map((item, index) => ({ problemId: Number(item.problemId), orderNo: index + 1, score: 100 }))
      if (normalizedItems.some((item) => !Number.isInteger(item.problemId) || item.problemId <= 0)) { setSubmitError('请为每一道练习题选择有效题目'); return }
      if (new Set(normalizedItems.map((item) => item.problemId)).size !== normalizedItems.length) { setSubmitError('练习中不能重复添加同一道题'); return }
    }

    await onSubmit({ title, description: form.description.trim(), dueAt: toDueAtISO(form.dueAt), displayMode: form.displayMode || 'exam', published: form.published, tags: form.tags, items: normalizedItems, problemDrafts })
    onClose()
    } catch (err) { setSubmitError(err.message || '保存失败') }
    finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>{isEditMode ? '编辑练习' : '创建练习'}</DialogTitle></DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-4 pt-2 pr-4">
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <Input placeholder="练习标题" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
          <textarea ref={descRef} placeholder="练习说明" value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            onInput={(e) => autoGrowTextarea(e.target)}
            rows={1}
            className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />

          <div>
            <Input placeholder="标签（用逗号分隔）" value={tagsToString(form.tags)}
              onChange={(e) => updateField('tags', parseTags(e.target.value))} />
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[11px]">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

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
                  <TabsTrigger value="import" className="flex-1">导入题目 ZIP</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {problemSourceMode === 'import' && !isEditMode ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">上传题目 ZIP 文件（含 problems.json 和 images/ 目录），导入后自动创建题目。</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => document.getElementById('hw-zip-input')?.click()}>
                  <Upload className="h-4 w-4 mr-1" />
                  选择 ZIP 文件
                </Button>
                <input type="file" id="hw-zip-input" accept=".zip" className="hidden" onChange={handleImportZip} />
              </div>
              {zipFile && (
                <div className="mt-2">
                  <p className="text-sm font-medium">已选择文件：{zipFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">点击"创建练习"时将自动导入题目。</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">练习题目</h4>
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

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : (isEditMode ? '保存修改' : '创建练习')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
