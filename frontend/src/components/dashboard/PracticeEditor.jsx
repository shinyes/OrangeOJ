import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { DatePicker } from '../ui/date-picker'
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical, X, Search } from 'lucide-react'
import ToastMessage from '../ToastMessage'
import { Badge } from '../ui/badge'
import TagInput from '../ui/tag-input'
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

export default function PracticeEditor({ open, mode = 'create', practice = null, spaceId, problemOptions = [], tagSuggestions = [], onClose, onSubmit }) {
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
  const [assignInput, setAssignInput] = useState('')
  const [assignCandidates, setAssignCandidates] = useState([])
  const [assignSelected, setAssignSelected] = useState([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignFocused, setAssignFocused] = useState(false)
  const assignWrapRef = useRef(null)
  const [existingTargets, setExistingTargets] = useState([])

  useEffect(() => {
    if (!isEditMode || !open || !practice?.id || !spaceId) { setExistingTargets([]); return }
    api.getPractice(spaceId, practice.id).then((detail) => {
      setExistingTargets(Array.isArray(detail?.targets) ? detail.targets : [])
    }).catch(() => setExistingTargets([]))
  }, [isEditMode, open, practice?.id, spaceId])

  useEffect(() => {
    const handler = (e) => { if (assignWrapRef.current && !assignWrapRef.current.contains(e.target)) setAssignFocused(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!isEditMode) { setAssignCandidates([]); setAssignLoading(false); return undefined }
    const keyword = assignInput.trim()
    if (!keyword) { setAssignCandidates([]); setAssignLoading(false); return undefined }
    const practiceId = practice?.id
    if (!practiceId || !spaceId) { setAssignCandidates([]); return undefined }
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setAssignLoading(true)
        const list = await api.searchPracticeTargetCandidates(spaceId, practiceId, keyword)
        if (!active) return
        setAssignCandidates(Array.isArray(list) ? list : [])
      } catch { if (active) setAssignCandidates([]) }
      finally { if (active) setAssignLoading(false) }
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [isEditMode, assignInput, practice?.id, spaceId])

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
    setAssignInput(''); setAssignCandidates([]); setAssignSelected([]); setAssignLoading(false)
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
  const dragOverIndexRef = useRef(null)

  useEffect(() => {
    if (!dragState.active) return

    const handleMouseMove = (e) => {
      for (const [idx, el] of Object.entries(itemRefs.current)) {
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          setDragOverIndex(Number(idx))
          dragOverIndexRef.current = Number(idx)
          break
        }
      }
    }

    const handleMouseUp = () => {
      const src = dragState.index
      const dst = dragOverIndexRef.current
      if (dst !== null && src !== null && dst !== src) {
        reorderRef.current(src, dst)
      }
      setDragState({ active: false, index: null })
      setDragOverIndex(null)
      dragOverIndexRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.active])

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
    if (isEditMode && practice?.id && spaceId && assignSelected.length > 0) {
      const userIds = assignSelected.map((u) => Number(u.id)).filter((id) => Number.isInteger(id) && id > 0)
      if (userIds.length > 0) {
        await Promise.all(userIds.map((userId) => api.addPracticeTarget(spaceId, practice.id, userId)))
      }
    }
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
            <label className="text-xs mb-1 block text-muted-foreground">标签</label>
            <TagInput tags={form.tags} onChange={(v) => updateField('tags', v)} suggestions={tagSuggestions} />
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

          {isEditMode && (
            <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
              <h4 className="text-sm font-medium">分配成员</h4>
              <p className="text-xs text-muted-foreground">在编辑练习时可直接分配成员，保存时会一并提交。</p>
              <div ref={assignWrapRef} className="relative">
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {assignSelected.map((user) => (
                    <Badge key={user.id} variant="secondary" className="gap-1 shrink-0 cursor-default">
                      <span className="truncate max-w-[120px]">{user.username}</span>
                      <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setAssignSelected((prev) => prev.filter((u) => u.id !== user.id))} />
                    </Badge>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="搜索用户 ID 或用户名..." value={assignInput}
                    onChange={(e) => setAssignInput(e.target.value)} onFocus={() => setAssignFocused(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const first = assignCandidates.find((u) => !assignSelected.some((s) => s.id === u.id))
                        if (first) { e.preventDefault(); setAssignSelected((prev) => prev.some((u) => u.id === first.id) ? prev : [...prev, first]); setAssignInput('') }
                      }
                    }} className="pl-8" />
                  {assignFocused && (!!assignInput.trim() || assignCandidates.length > 0 || assignLoading) && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 border rounded-lg bg-popover shadow-lg max-h-52 overflow-y-auto">
                      {assignLoading && <p className="text-center text-sm text-muted-foreground py-6">搜索中...</p>}
                      {!assignLoading && assignCandidates.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-6">{assignInput.trim() ? '未找到匹配用户' : '输入用户 ID 或用户名开始搜索'}</p>
                      )}
                      {assignCandidates.map((user) => {
                        const checked = assignSelected.some((u) => u.id === user.id)
                        const userLabel = [`#${user.id || user.userId}`, user.username].filter(Boolean).join(' · ')
                        return (
                          <div key={user.id} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent ${!checked && user.id === assignCandidates.find((x) => !assignSelected.some((s) => s.id === x.id))?.id ? 'bg-accent/50' : ''}`}
                            onClick={() => {
                              setAssignSelected((prev) => prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user])
                              setAssignInput('')
                            }}>
                            <Checkbox checked={checked} />
                            <span>{userLabel}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              {existingTargets.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">已分配 {existingTargets.length} 名成员</Label>
                  <div className="flex flex-wrap gap-1">
                    {existingTargets.map((t) => (
                      <Badge key={t.userId} variant="secondary" className="gap-1">#{t.userId} {t.username}
                        <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={async () => {
                          if (!practice?.id || !spaceId) return
                          try { await api.removePracticeTarget(spaceId, practice.id, t.userId); setExistingTargets((prev) => prev.filter((x) => x.userId !== t.userId)) } catch {}
                        }} />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
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



              <div className="flex flex-col gap-1">
                {form.items.map((item, index) => (
                  <div key={index}
                    ref={(el) => { itemRefs.current[index] = el }}
                    className={`flex items-center gap-1 rounded-lg border bg-card ${dragOverIndex === index ? 'border-primary shadow-sm' : ''} ${dragState.index === index ? 'opacity-70' : ''}`}>

                    <Button size="icon" variant="ghost"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setDragState({ active: true, index })
                        setDragOverIndex(index)
                        dragOverIndexRef.current = index
                      }}
                      className="shrink-0 cursor-grab">
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
