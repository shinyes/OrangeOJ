import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Plus, Trash2 } from 'lucide-react'
import ToastMessage from '../ToastMessage'
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
    setForm(buildInitialForm(plan)); setSubmitting(false); setSubmitError('')
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
  const addChapter = () => setForm((current) => ({ ...current, chapters: [...current.chapters, blankChapter(current.chapters.length)] }))
  const removeChapter = (index) => setForm((current) => ({ ...current, chapters: current.chapters.filter((_, i) => i !== index) }))

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
  const [searchInputs, setSearchInputs] = useState({})

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditMode ? '编辑训练计划' : '创建训练计划'}</DialogTitle></DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <Input placeholder="训练标题" value={form.title} onChange={(e) => updateField('title', e.target.value)} />

          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.allowSelfJoin} onCheckedChange={(checked) => updateField('allowSelfJoin', checked)} />
              允许成员自行加入
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.isPublic} onCheckedChange={(checked) => updateField('isPublic', checked)} />
              公开训练（普通成员可见）
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.published} onCheckedChange={(checked) => updateField('published', checked)} />
              立即发布
            </label>
          </div>

          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">章节</h4>
            <Button size="sm" variant="outline" onClick={addChapter}><Plus className="h-4 w-4 mr-1" />添加章节</Button>
          </div>

          {form.chapters.length === 0 && (
            <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">当前没有章节，点击"添加章节"开始配置。</div>
          )}

          {form.chapters.map((chapter, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium">章节 {index + 1}</h4>
                <Button size="sm" variant="ghost" onClick={() => removeChapter(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="flex flex-col gap-3">
                <Input placeholder="章节标题" value={chapter.title} onChange={(e) => updateChapter(index, { title: e.target.value })} />

                {!isEditMode && (
                  <div>
                    <Tabs value={chapter.problemSourceMode || 'manual'} onValueChange={(v) => { if (v) updateChapter(index, { problemSourceMode: v }); setSubmitError('') }}>
                      <TabsList className="w-full">
                        <TabsTrigger value="manual" className="flex-1">从题库选题</TabsTrigger>
                        <TabsTrigger value="import" className="flex-1">导入题目 JSON 数组</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}

                {!isEditMode && chapter.problemSourceMode === 'import' ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">这里接收本章节题目的 JSON 数组。每一项对应一题，字段与题目编辑器 JSON 模式一致。</p>
                    <Textarea className="font-mono min-h-[200px]" value={chapter.problemDraftsJSON || ''}
                      onChange={(e) => updateChapter(index, { problemDraftsJSON: e.target.value })}
                      placeholder={'[ { "type": "single_choice", ... }, { "type": "programming", ... } ]'} />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium mb-1 block">章节题目</label>
                    <Input placeholder="输入题号、标题或标签搜索" className="mb-2"
                      value={searchInputs[index] || ''}
                      onChange={(e) => { setSearchInputs({ ...searchInputs, [index]: e.target.value }) }} />
                    {searchInputs[index]?.trim() && (
                      <div className="border rounded-lg max-h-40 overflow-y-auto mb-2">
                        {problemOptions.filter((p) => {
                          const kw = searchInputs[index].trim().toLowerCase()
                          const tagsText = (p.tags || []).join(' ').toLowerCase()
                          return String(p.id).includes(kw) || p.title.toLowerCase().includes(kw) || tagsText.includes(kw)
                        }).slice(0, 20).map((p) => (
                          <div key={p.id} className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                            onClick={() => {
                              updateChapter(index, { problemIds: [...chapter.problemIds, p.id].filter((id, i, arr) => arr.indexOf(id) === i) })
                              setSearchInputs({ ...searchInputs, [index]: '' })
                            }}>
                            #{p.id} {p.title}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {chapter.problemIds.map((problemId, itemIndex) => {
                        const p = resolveProblemOption(problemId)
                        return (
                          <span key={problemId} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs cursor-pointer"
                            onClick={() => updateChapter(index, { problemIds: chapter.problemIds.filter((id) => id !== problemId) })}>
                            #{p.id} {p.title} ×
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : (isEditMode ? '保存修改' : '创建计划')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
