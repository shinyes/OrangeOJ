import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical, ChevronRight, ChevronDown } from 'lucide-react'
import ToastMessage from '../ToastMessage'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Label } from '../ui/label'
import { parseProblemDraftArray } from '../../utils/problemDrafts'

function blankChapter(index) {
  return { title: `第 ${index + 1} 章`, problemIds: [], problemSourceMode: 'manual', problemDraftsJSON: '' }
}

function normalizeProblemIds(chapter) {
  if (Array.isArray(chapter?.problemIds)) return chapter.problemIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
  if (Array.isArray(chapter?.items)) return chapter.items.map((item) => Number(item?.problemId)).filter((item) => Number.isInteger(item) && item > 0)
  return []
}

function buildInitialForm(plan) {
  const chapters = Array.isArray(plan?.chapters)
    ? plan.chapters.map((chapter, index) => ({
        title: String(chapter?.title || `第 ${index + 1} 章`), problemIds: normalizeProblemIds(chapter),
        problemSourceMode: 'manual', problemDraftsJSON: ''
      }))
    : [blankChapter(0)]
  return { title: String(plan?.title || ''), allowSelfJoin: plan?.allowSelfJoin !== false, isPublic: plan?.isPublic !== false, published: Boolean(plan?.published ?? plan?.publishedAt), chapters }
}

export default function TrainingPlanEditor({ open, mode = 'create', plan = null, problemOptions = [], onClose, onSubmit }) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(plan))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!open) return
    const initialForm = buildInitialForm(plan)
    setForm(initialForm); setSubmitting(false); setSubmitError(''); setDrag({ type: null, chapterIndex: null, index: null }); setDragOver({ chapterIndex: null, index: null })
    setCollapsedChapters(new Set(initialForm.chapters.map((_, i) => i)))
    setNewChapterIndices(new Set())
  }, [open, plan, mode])

  const problemMap = useMemo(() => {
    const map = new Map()
    problemOptions.forEach((problem) => { map.set(problem.id, problem) })
    return map
  }, [problemOptions])

  const resolveProblemOption = (problemId) => {
    const matched = problemMap.get(problemId)
    return matched || { id: problemId, title: `题目 ${problemId}` }
  }

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const updateChapter = (index, patch) => setForm((current) => ({ ...current, chapters: current.chapters.map((chapter, i) => i !== index ? chapter : { ...chapter, ...patch }) }))
  const addChapter = () => setForm((current) => {
    const newIdx = current.chapters.length
    setNewChapterIndices((prev) => { const next = new Set(prev); next.add(newIdx); return next })
    setCollapsedChapters((prev) => { const next = new Set(prev); next.add(newIdx); return next })
    return { ...current, chapters: [...current.chapters, blankChapter(newIdx)] }
  })
  const removeChapter = (index) => setForm((current) => ({ ...current, chapters: current.chapters.filter((_, i) => i !== index) }))
  const moveProblem = (chapterIndex, index, dir) => reorderProblems(chapterIndex, index, index + dir)
  const removeProblem = (chapterIndex, index) => setForm((c) => ({ ...c, chapters: c.chapters.map((ch, i) => i !== chapterIndex ? ch : { ...ch, problemIds: ch.problemIds.filter((_, j) => j !== index) }) }))

  const handleClose = () => { if (submitting) return; setSubmitError(''); onClose() }

  const handleSubmit = async () => {
    const title = form.title.trim()
    if (!title) { setSubmitError('训练标题不能为空'); return }

    let chapters
    try {
      chapters = form.chapters.map((chapter, index) => {
        const normalizedChapter = { title: String(chapter.title || '').trim() || `第 ${index + 1} 章`, orderNo: index + 1, problemIds: [], problemDrafts: [] }
        if (!isEditMode && chapter.problemSourceMode === 'import') { normalizedChapter.problemDrafts = parseProblemDraftArray(chapter.problemDraftsJSON); return normalizedChapter }
        normalizedChapter.problemIds = normalizeProblemIds(chapter)
        return normalizedChapter
      })
    } catch (err) { setSubmitError(err.message || '题目 JSON 数组不合法'); return }

    try { setSubmitting(true); setSubmitError(''); await onSubmit({ title, allowSelfJoin: form.allowSelfJoin, isPublic: form.isPublic, published: form.published, chapters }); onClose() }
    catch (err) { setSubmitError(err.message || '保存失败') }
    finally { setSubmitting(false) }
  }

  // Helper for searchable problem select
  const [collapsedChapters, setCollapsedChapters] = useState(() => new Set())
  const [newChapterIndices, setNewChapterIndices] = useState(() => new Set())
  const [searchInputs, setSearchInputs] = useState({})
  const itemRefs = useRef({})
  const chapterRefs = useRef({})
  const [drag, setDrag] = useState({ type: null, chapterIndex: null, index: null })
  const [dragOver, setDragOver] = useState({ chapterIndex: null, index: null })

  const reorderChapters = (from, to) => {
    setForm((c) => {
      if (from === to || from < 0 || to < 0 || from >= c.chapters.length || to >= c.chapters.length) return c
      const next = [...c.chapters]
      next.splice(to, 0, ...next.splice(from, 1))
      return { ...c, chapters: next }
    })
  }

  const reorderProblems = (chapterIndex, from, to) => {
    setForm((c) => {
      const chapter = c.chapters[chapterIndex]
      if (!chapter || from === to || from < 0 || to < 0 || from >= chapter.problemIds.length || to >= chapter.problemIds.length) return c
      const nextIds = [...chapter.problemIds]
      nextIds.splice(to, 0, ...nextIds.splice(from, 1))
      return { ...c, chapters: c.chapters.map((ch, i) => i !== chapterIndex ? ch : { ...ch, problemIds: nextIds }) }
    })
  }

  const reorderChapterRef = useRef(reorderChapters)
  reorderChapterRef.current = reorderChapters
  const reorderProblemRef = useRef(reorderProblems)
  reorderProblemRef.current = reorderProblems

  useEffect(() => {
    if (!drag.type) return

    const handleMouseMove = (e) => {
      if (drag.type === 'chapter') {
        for (const [idx, el] of Object.entries(chapterRefs.current)) {
          if (!el) continue
          const rect = el.getBoundingClientRect()
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            if (dragOver.index !== Number(idx)) setDragOver({ chapterIndex: Number(idx), index: Number(idx) })
            break
          }
        }
      } else if (drag.type === 'problem') {
        const refs = itemRefs.current[drag.chapterIndex]
        if (!refs) return
        for (const [idx, el] of Object.entries(refs)) {
          if (!el) continue
          const rect = el.getBoundingClientRect()
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            if (dragOver.index !== Number(idx)) setDragOver({ chapterIndex: drag.chapterIndex, index: Number(idx) })
            break
          }
        }
      }
    }

    const handleMouseUp = () => {
      if (drag.type === 'chapter' && dragOver.index !== null && drag.index !== dragOver.index) {
        reorderChapterRef.current(drag.index, dragOver.index)
      } else if (drag.type === 'problem' && dragOver.index !== null && drag.index !== dragOver.index) {
        reorderProblemRef.current(drag.chapterIndex, drag.index, dragOver.index)
      }
      setDrag({ type: null, chapterIndex: null, index: null })
      setDragOver({ chapterIndex: null, index: null })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, dragOver])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>{isEditMode ? '编辑训练计划' : '创建训练计划'}</DialogTitle></DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-4 pt-2 pr-4">
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <Input placeholder="训练标题" value={form.title} onChange={(e) => updateField('title', e.target.value)} />

          <div className="flex gap-4 flex-wrap">
            <Label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.allowSelfJoin} onCheckedChange={(checked) => updateField('allowSelfJoin', checked)} />
              允许成员自行加入
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.isPublic} onCheckedChange={(checked) => updateField('isPublic', checked)} />
              公开训练（普通成员可见）
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.published} onCheckedChange={(checked) => updateField('published', checked)} />
              立即发布
            </Label>
          </div>

          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">章节</h4>
            <Button size="sm" variant="outline" onClick={addChapter}><Plus className="h-4 w-4 mr-1" />添加章节</Button>
          </div>

          {form.chapters.length === 0 && (
            <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">当前没有章节，点击"添加章节"开始配置。</CardContent></Card>
          )}

          {form.chapters.map((chapter, chapterIndex) => (
            <div key={chapterIndex}
              ref={(el) => { chapterRefs.current[chapterIndex] = el }}
              className={`rounded-lg border bg-card ${drag.type === 'chapter' && dragOver.index === chapterIndex ? 'border-primary shadow-sm' : ''} ${drag.type === 'chapter' && drag.index === chapterIndex ? 'opacity-70' : ''}`}>

              <div className="flex items-center gap-1 px-2 py-1.5">
                <Button size="icon" variant="ghost"
                  onMouseDown={(e) => { e.preventDefault(); setDrag({ type: 'chapter', chapterIndex, index: chapterIndex }); setDragOver({ chapterIndex, index: chapterIndex }) }}
                  className="shrink-0 cursor-grab">
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="shrink-0 h-6 w-6"
                  onClick={() => setCollapsedChapters((prev) => { const next = new Set(prev); if (next.has(chapterIndex)) next.delete(chapterIndex); else next.add(chapterIndex); return next })}>
                  {collapsedChapters.has(chapterIndex) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
                <span className="text-xs text-muted-foreground shrink-0 w-14 text-center">章节 {chapterIndex + 1}</span>
                <Input className="h-7 text-xs flex-1" placeholder="章节标题" value={chapter.title} onChange={(e) => updateChapter(chapterIndex, { title: e.target.value })} />
                <Badge variant="outline" className="text-[10px] h-5">{chapter.problemIds.length} 题</Badge>
                <Button size="icon" variant="ghost" onClick={() => removeChapter(chapterIndex)} className="shrink-0 h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>

              {collapsedChapters.has(chapterIndex) ? null : (
              <>
              {(!isEditMode || newChapterIndices.has(chapterIndex)) && (
                <div className="px-2 pb-1.5">
                  <Tabs value={chapter.problemSourceMode || 'manual'} onValueChange={(v) => { if (v) updateChapter(chapterIndex, { problemSourceMode: v }); setSubmitError('') }}>
                    <TabsList className="w-full">
                      <TabsTrigger value="manual" className="flex-1">从题库选题</TabsTrigger>
                      <TabsTrigger value="import" className="flex-1">导入题目 JSON 数组</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {(!isEditMode || newChapterIndices.has(chapterIndex)) && chapter.problemSourceMode === 'import' ? (
                <div className="px-2 pb-2">
                  <p className="text-xs text-muted-foreground mb-2">这里接收本章节题目的 JSON 数组。每一项对应一题，字段与题目编辑器 JSON 模式一致。</p>
                  <Textarea className="font-mono min-h-[200px]" value={chapter.problemDraftsJSON || ''}
                    onChange={(e) => updateChapter(chapterIndex, { problemDraftsJSON: e.target.value })}
                    placeholder={'[ { "type": "single_choice", ... }, { "type": "programming", ... } ]'} />
                </div>
              ) : (
                <div className="px-2 pb-2">
                  <div className="relative">
                    <Input className="h-7 text-xs" placeholder="搜索题号、标题或标签..."
                      value={searchInputs[chapterIndex] || ''}
                      onChange={(e) => { setSearchInputs({ ...searchInputs, [chapterIndex]: e.target.value }) }} />
                    {searchInputs[chapterIndex]?.trim() && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-0.5 border rounded-md max-h-36 overflow-y-auto bg-popover shadow-lg">
                        {problemOptions.filter((p) => {
                          const kw = searchInputs[chapterIndex].trim().toLowerCase()
                          const tagsText = (p.tags || []).join(' ').toLowerCase()
                          return String(p.id).includes(kw) || p.title.toLowerCase().includes(kw) || tagsText.includes(kw)
                        }).slice(0, 15).map((p) => (
                          <div key={p.id} className="px-2 py-1 text-xs cursor-pointer hover:bg-accent"
                            onClick={() => {
                              updateChapter(chapterIndex, { problemIds: [...chapter.problemIds, p.id].filter((id, i, arr) => arr.indexOf(id) === i) })
                              setSearchInputs({ ...searchInputs, [chapterIndex]: '' })
                            }}>
                            #{p.id} {p.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 mt-1.5">
                    {chapter.problemIds.map((problemId, problemIndex) => {
                      const p = resolveProblemOption(problemId)
                      return (
                        <div key={problemId}
                          ref={(el) => {
                            if (!itemRefs.current[chapterIndex]) itemRefs.current[chapterIndex] = {}
                            itemRefs.current[chapterIndex][problemIndex] = el
                          }}
                          className={`flex items-center gap-1 rounded border bg-background ${drag.type === 'problem' && drag.chapterIndex === chapterIndex && dragOver.index === problemIndex ? 'border-primary shadow-sm' : ''} ${drag.type === 'problem' && drag.chapterIndex === chapterIndex && drag.index === problemIndex ? 'opacity-70' : ''}`}>
                          <Button size="icon" variant="ghost"
                            onMouseDown={(e) => { e.preventDefault(); setDrag({ type: 'problem', chapterIndex, index: problemIndex }); setDragOver({ chapterIndex, index: problemIndex }) }}
                            className="shrink-0 cursor-grab h-7 w-7">
                            <GripVertical className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-xs flex-1 min-w-0 truncate">#{p.id} {p.title}</span>
                          <Button size="icon" variant="ghost" onClick={() => moveProblem(chapterIndex, problemIndex, -1)} disabled={problemIndex === 0} className="shrink-0 h-6 w-6"><ArrowUp className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => moveProblem(chapterIndex, problemIndex, 1)} disabled={problemIndex === chapter.problemIds.length - 1} className="shrink-0 h-6 w-6"><ArrowDown className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => removeProblem(chapterIndex, problemIndex)} className="shrink-0 h-6 w-6"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      )
                    })}
                    {chapter.problemIds.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">暂无题目，通过上方搜索添加</p>
                    )}
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          ))}
        </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : (isEditMode ? '保存修改' : '创建计划')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
