import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Label } from '../ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Plus, Trash2, X } from 'lucide-react'
import ToastMessage from '../ToastMessage'
import { normalizeObjectiveAnswerJson } from '../../utils/problemDrafts'

const DEFAULT_TIME_LIMIT_MS = 1000
const DEFAULT_MEMORY_LIMIT_MIB = 256
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const PROBLEM_TYPE_LABELS = { programming: '编程题', single_choice: '单选题', true_false: '判断题' }

function blankCase() { return { input: '', output: '' } }

function defaultStarterCode() {
  return {
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}',
    python: 'print("hello")',
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
  }
}

function normalizeCaseList(list) {
  if (!Array.isArray(list) || list.length === 0) return [blankCase()]
  return list.map((item) => ({ input: String(item?.input || ''), output: String(item?.output || '') }))
}

function normalizeOptions(options) {
  const next = Array.isArray(options) ? options.map((item) => String(item ?? '')) : []
  if (next.length >= 2) return next.slice(0, OPTION_LABELS.length)
  return ['A', 'B', 'C', 'D']
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return []
  const seen = new Set()
  return tags.map((item) => String(item || '').trim()).filter((item) => {
    if (!item) return false
    const key = item.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseTagInput(raw) { return String(raw || '').split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean) }

function normalizePositiveInteger(value, fallback) { const parsed = Number(value); return parsed > 0 ? parsed : fallback }

function resolveSingleChoiceAnswerIndex(options, answerJson) {
  const normalizedAnswerJson = normalizeObjectiveAnswerJson('single_choice', { options }, answerJson)
  const raw = String(normalizedAnswerJson?.answer ?? '').trim()
  if (!raw) return 0
  const exactIndex = options.findIndex((item) => String(item) === raw)
  if (exactIndex >= 0) return exactIndex
  const normalizedIndex = options.findIndex((item) => String(item).trim().toLowerCase() === raw.toLowerCase())
  return normalizedIndex >= 0 ? normalizedIndex : 0
}

function buildProblemDataFromForm(form, options = {}) {
  const strict = options.strict !== false
  let bodyJson = {}, answerJson = {}

  if (form.type === 'programming') {
    bodyJson = {
      inputFormat: form.programming.inputFormat, outputFormat: form.programming.outputFormat,
      samples: form.programming.samples.filter((item) => item.input || item.output),
      testCases: form.programming.testCases.filter((item) => item.input || item.output),
      starterCode: { cpp: form.programming.starterCode.cpp, python: form.programming.starterCode.python, go: form.programming.starterCode.go }
    }
    return { bodyJson, answerJson }
  }

  if (form.type === 'single_choice') {
    const optionsList = strict ? form.singleChoice.options.map((item) => item.trim()) : form.singleChoice.options.map((item) => String(item ?? ''))
    if (strict) {
      if (optionsList.length < 2 || optionsList.some((item) => !item)) throw new Error('单选题至少需要两个非空选项')
      if (new Set(optionsList.map((item) => item.toLowerCase())).size !== optionsList.length) throw new Error('单选题选项不能重复')
    }
    bodyJson = { options: optionsList }
    answerJson = { answer: optionsList[form.singleChoice.answerIndex] || optionsList[0] || '' }
    return { bodyJson, answerJson }
  }

  if (form.type === 'true_false') { answerJson = { answer: form.trueFalse.answer === 'true' } }
  return { bodyJson, answerJson }
}

function buildInitialForm(problem) {
  const type = problem?.type || 'programming'
  const body = problem?.bodyJson || {}
  const answer = problem?.answerJson || {}
  const options = normalizeOptions(body.options)
  const answerIndex = resolveSingleChoiceAnswerIndex(options, answer)

  return {
    type, title: problem?.title || '', tags: normalizeTagList(problem?.tags),
    statementMd: problem?.statementMd || '',
    timeLimitMs: String(problem?.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS),
    memoryLimitMiB: String(problem?.memoryLimitMiB ?? DEFAULT_MEMORY_LIMIT_MIB),
    programming: {
      inputFormat: String(body.inputFormat || ''), outputFormat: String(body.outputFormat || ''),
      samples: normalizeCaseList(body.samples), testCases: normalizeCaseList(body.testCases),
      starterCode: { ...defaultStarterCode(), ...(body.starterCode || {}) }
    },
    singleChoice: { options, answerIndex },
    trueFalse: { answer: answer.answer === false ? 'false' : 'true' }
  }
}

function buildStorageDraftFromForm(form, options = {}) {
  const { bodyJson, answerJson } = buildProblemDataFromForm(form, { strict: false })
  const draft = {
    type: options.lockedProblemType || form.type, title: form.title, tags: normalizeTagList(form.tags),
    statementMd: form.statementMd, bodyJson, answerJson,
    timeLimitMs: normalizePositiveInteger(form.timeLimitMs, DEFAULT_TIME_LIMIT_MS),
    memoryLimitMiB: normalizePositiveInteger(form.memoryLimitMiB, DEFAULT_MEMORY_LIMIT_MIB)
  }
  return JSON.stringify(draft ?? {}, null, 2)
}

function parseJSONText(raw, fieldLabel) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return {}
  try { return JSON.parse(trimmed) } catch { throw new Error(`${fieldLabel} 不是合法 JSON`) }
}

function normalizeProblemTypeValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'single_choice' || normalized === 'single-choice') return 'single_choice'
  if (normalized === 'true_false' || normalized === 'true-false') return 'true_false'
  if (normalized === 'programming') return 'programming'
  return ''
}

function parseStorageDraft(raw, options = {}) {
  const draft = parseJSONText(raw, '题目 JSON')
  if (!draft || Array.isArray(draft) || typeof draft !== 'object') throw new Error('题目 JSON 必须是对象')
  const requestedType = normalizeProblemTypeValue(draft.type)
  const type = options.lockedProblemType || requestedType || 'programming'
  if (!PROBLEM_TYPE_LABELS[type]) throw new Error('题目 JSON 中的 type 不合法')
  const bodyJson = draft.bodyJson && typeof draft.bodyJson === 'object' && !Array.isArray(draft.bodyJson) ? draft.bodyJson : {}
  const rawAnswerJson = draft.answerJson && typeof draft.answerJson === 'object' && !Array.isArray(draft.answerJson) ? draft.answerJson : {}
  const answerJson = normalizeObjectiveAnswerJson(type, bodyJson, rawAnswerJson)
  return { type, title: String(draft.title || ''), tags: normalizeTagList(draft.tags), statementMd: String(draft.statementMd || ''), bodyJson, answerJson, timeLimitMs: normalizePositiveInteger(draft.timeLimitMs, DEFAULT_TIME_LIMIT_MS), memoryLimitMiB: normalizePositiveInteger(draft.memoryLimitMiB, DEFAULT_MEMORY_LIMIT_MIB) }
}

function buildFormFromStorageDraft(draft) {
  return buildInitialForm({ type: draft.type, title: draft.title, tags: draft.tags, statementMd: draft.statementMd, bodyJson: draft.bodyJson, answerJson: draft.answerJson, timeLimitMs: draft.timeLimitMs, memoryLimitMiB: draft.memoryLimitMiB })
}

function formsEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right) }

function renderCaseRows(title, rows, onAdd, onRemove, onChange) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />添加</Button>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((item, index) => (
          <Card key={index}><CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">{title} {index + 1}</span>
              <Button size="sm" variant="ghost" onClick={() => onRemove(index)} disabled={rows.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">输入</Label>
                <Textarea className="mt-1 min-h-[80px]" value={item.input} onChange={(e) => onChange(index, 'input', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">输出</Label>
                <Textarea className="mt-1 min-h-[80px]" value={item.output} onChange={(e) => onChange(index, 'output', e.target.value)} />
              </div>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  )
}

export default function ProblemEditor({ open, mode = 'create', problem = null, createTitle = '创建题目', editTitle = null, createSubmitText = '创建题目', editSubmitText = '保存修改', tagSuggestions = [], onClose, onSubmit }) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState(() => buildInitialForm(problem))
  const lockedProblemType = isEditMode && problem?.type ? problem.type : form.type
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [tagInputValue, setTagInputValue] = useState('')
  const [editorMode, setEditorMode] = useState('ui')
  const [jsonDraft, setJSONDraft] = useState(() => buildStorageDraftFromForm(buildInitialForm(problem), { lockedProblemType: isEditMode && problem?.type ? problem.type : undefined }))
  const [jsonSyncError, setJSONSyncError] = useState('')

  useEffect(() => {
    if (!open) return
    const nextForm = buildInitialForm(problem)
    setForm(nextForm)
    setJSONDraft(buildStorageDraftFromForm(nextForm, { lockedProblemType: isEditMode && problem?.type ? problem.type : undefined }))
    setEditorMode('ui'); setSubmitting(false); setSubmitError(''); setJSONSyncError(''); setTagInputValue('')
  }, [open, problem, mode])

  useEffect(() => {
    if (!open || editorMode !== 'ui') return
    const nextDraft = buildStorageDraftFromForm(form, { lockedProblemType })
    setJSONDraft((current) => (current === nextDraft ? current : nextDraft))
    setJSONSyncError('')
  }, [open, editorMode, form, lockedProblemType])

  useEffect(() => {
    if (!open || editorMode !== 'json') return
    try {
      const draft = parseStorageDraft(jsonDraft, { lockedProblemType })
      const nextForm = buildFormFromStorageDraft(draft)
      setForm((current) => (formsEqual(current, nextForm) ? current : nextForm))
      setJSONSyncError('')
    } catch (err) { setJSONSyncError(err.message || 'JSON 模式内容有误') }
  }, [open, editorMode, jsonDraft, lockedProblemType])

  const dialogTitle = useMemo(() => {
    if (isEditMode) return editTitle || (problem?.id ? `编辑题目 #${problem.id}` : '编辑题目')
    return createTitle
  }, [createTitle, editTitle, isEditMode, problem])

  const normalizedTagSuggestions = useMemo(() => normalizeTagList(tagSuggestions), [tagSuggestions])

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const mergePendingTags = (rawInput = tagInputValue) => {
    const nextTags = normalizeTagList([...form.tags, ...parseTagInput(rawInput)])
    if (nextTags.length !== form.tags.length || nextTags.some((tag, index) => tag !== form.tags[index])) {
      setForm((current) => ({ ...current, tags: nextTags }))
    }
    setTagInputValue('')
    return nextTags
  }

  const handleEditorModeChange = (nextMode) => {
    if (!nextMode || nextMode === editorMode) return
    if (nextMode === 'json') {
      const nextTags = normalizeTagList([...form.tags, ...parseTagInput(tagInputValue)])
      const snapshot = { ...form, tags: nextTags }
      setForm(snapshot); setTagInputValue('')
      setJSONDraft(buildStorageDraftFromForm(snapshot, { lockedProblemType }))
      setEditorMode('json'); setSubmitError('')
      return
    }
    try { parseStorageDraft(jsonDraft, { lockedProblemType }); setEditorMode('ui'); setSubmitError(''); setJSONSyncError('') }
    catch (err) { const message = err.message || 'JSON 模式内容有误'; setSubmitError(message); setJSONSyncError(message) }
  }

  const updateNestedField = (section, field, value) => setForm((current) => ({ ...current, [section]: { ...current[section], [field]: value } }))
  const updateProgrammingField = (field, value) => setForm((current) => ({ ...current, programming: { ...current.programming, [field]: value } }))
  const updateStarterCode = (language, value) => setForm((current) => ({ ...current, programming: { ...current.programming, starterCode: { ...current.programming.starterCode, [language]: value } } }))

  const updateCaseList = (field, updater) => setForm((current) => ({ ...current, programming: { ...current.programming, [field]: updater(current.programming[field]) } }))
  const addCase = (field) => updateCaseList(field, (items) => [...items, blankCase()])
  const removeCase = (field, index) => updateCaseList(field, (items) => { if (items.length === 1) return items; return items.filter((_, itemIndex) => itemIndex !== index) })
  const updateCase = (field, index, key, value) => updateCaseList(field, (items) => items.map((item, itemIndex) => { if (itemIndex !== index) return item; return { ...item, [key]: value } }))

  const handleTypeChange = (nextType) => {
    if (isEditMode) return
    const blankForm = buildInitialForm({ type: nextType })
    setForm((current) => ({ ...current, type: nextType, programming: blankForm.programming, singleChoice: blankForm.singleChoice, trueFalse: blankForm.trueFalse }))
  }

  const addOption = () => setForm((current) => { if (current.singleChoice.options.length >= OPTION_LABELS.length) return current; return { ...current, singleChoice: { ...current.singleChoice, options: [...current.singleChoice.options, ''] } } })
  const removeOption = (index) => setForm((current) => {
    if (current.singleChoice.options.length <= 2) return current
    const nextOptions = current.singleChoice.options.filter((_, itemIndex) => itemIndex !== index)
    return { ...current, singleChoice: { ...current.singleChoice, options: nextOptions, answerIndex: Math.min(current.singleChoice.answerIndex, nextOptions.length - 1) } }
  })
  const updateOption = (index, value) => setForm((current) => ({ ...current, singleChoice: { ...current.singleChoice, options: current.singleChoice.options.map((item, itemIndex) => (itemIndex === index ? value : item)) } }))

  const handleClose = () => { if (submitting) return; setSubmitError(''); onClose() }

  const handleSubmit = async () => {
    let problemType = lockedProblemType, title = form.title.trim()
    let mergedTags = normalizeTagList([...form.tags, ...parseTagInput(tagInputValue)])
    let statementMd = form.statementMd
    let timeLimitMs = Number(form.timeLimitMs) > 0 ? Number(form.timeLimitMs) : DEFAULT_TIME_LIMIT_MS
    let memoryLimitMiB = Number(form.memoryLimitMiB) > 0 ? Number(form.memoryLimitMiB) : DEFAULT_MEMORY_LIMIT_MIB
    let bodyJson = {}, answerJson = {}

    try {
      if (editorMode === 'json') {
        const draft = parseStorageDraft(jsonDraft, { lockedProblemType })
        problemType = draft.type; title = draft.title.trim(); mergedTags = draft.tags; statementMd = draft.statementMd
        timeLimitMs = draft.timeLimitMs; memoryLimitMiB = draft.memoryLimitMiB; bodyJson = draft.bodyJson; answerJson = draft.answerJson
      } else { const payload = buildProblemDataFromForm(form, { strict: true }); bodyJson = payload.bodyJson; answerJson = payload.answerJson }
    } catch (err) { setSubmitError(err.message || '题目内容格式不正确'); return }
    if (!title) { setSubmitError('题目标题不能为空'); return }

    try {
      setSubmitting(true); setSubmitError('')
      await onSubmit({ type: problemType, title, tags: mergedTags, statementMd, bodyJson, answerJson, timeLimitMs, memoryLimitMiB })
      setTagInputValue(''); onClose()
    } catch (err) { setSubmitError(err.message || '保存失败') }
    finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {submitError && <ToastMessage message={submitError} severity="error" onShown={() => setSubmitError('')} />}

          <div>
            <Tabs value={editorMode} onValueChange={handleEditorModeChange}>
              <TabsList className="w-full">
                <TabsTrigger value="ui" className="flex-1">UI 模式</TabsTrigger>
                <TabsTrigger value="json" className="flex-1">JSON 模式</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground mt-2">UI 模式适合常规录题；JSON 模式直接编辑整道题提交给后端的完整结构。</p>
          </div>

          {editorMode === 'json' ? (
            <>
              {jsonSyncError && <ToastMessage message={`JSON 未同步到 UI：${jsonSyncError}`} severity="warning" />}
              <div>
                <Label className="mb-1 block">题目存储 JSON</Label>
                <Textarea className="font-mono min-h-[400px]" value={jsonDraft}
                  onChange={(e) => setJSONDraft(e.target.value)} />
                {jsonSyncError && <p className="text-xs text-destructive mt-1">{jsonSyncError}</p>}
                <p className="text-xs text-muted-foreground mt-1">{jsonSyncError || 'JSON 合法时会实时同步到 UI 模式；切回 UI 模式前必须先修正 JSON。'}</p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-3">
                  {isEditMode ? (
                    <Input disabled value={PROBLEM_TYPE_LABELS[lockedProblemType] || lockedProblemType} />
                  ) : (
                    <Select value={form.type} onValueChange={handleTypeChange}>
                      <SelectTrigger><SelectValue placeholder="题目类型" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="programming">编程题</SelectItem>
                        <SelectItem value="single_choice">单选题</SelectItem>
                        <SelectItem value="true_false">判断题</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="col-span-12 md:col-span-5">
                  <Input placeholder="题目标题" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Input type="number" placeholder="时间限制 (ms)" value={form.timeLimitMs} onChange={(e) => updateField('timeLimitMs', e.target.value)} min={1} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Input type="number" placeholder="内存限制 (MiB)" value={form.memoryLimitMiB} onChange={(e) => updateField('memoryLimitMiB', e.target.value)} min={1} />
                </div>
              </div>

              <div>
                <Label className="mb-1 block">题目标签</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => {
                        setForm((current) => ({ ...current, tags: current.tags.filter((_, i) => i !== index) }))
                      }} />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="输入标签后按回车" value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); mergePendingTags() } }}
                    onBlur={(e) => { mergePendingTags(e.target.value) }} />
                  {normalizedTagSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {normalizedTagSuggestions.filter((t) => !form.tags.includes(t)).slice(0, 5).map((tag) => (
                        <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-accent"
                          onClick={() => { setForm((c) => ({ ...c, tags: [...c.tags, tag] })) }}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-1 block">题面 Markdown</Label>
                <Textarea className="min-h-[160px]" value={form.statementMd} onChange={(e) => updateField('statementMd', e.target.value)} />
              </div>
            </>
          )}

          {editorMode === 'ui' && form.type === 'programming' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block">输入格式</Label>
                  <Textarea className="min-h-[80px]" value={form.programming.inputFormat} onChange={(e) => updateProgrammingField('inputFormat', e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block">输出格式</Label>
                  <Textarea className="min-h-[80px]" value={form.programming.outputFormat} onChange={(e) => updateProgrammingField('outputFormat', e.target.value)} />
                </div>
              </div>
              {renderCaseRows('样例', form.programming.samples, () => addCase('samples'), (index) => removeCase('samples', index), (index, field, value) => updateCase('samples', index, field, value))}
              {renderCaseRows('测试用例', form.programming.testCases, () => addCase('testCases'), (index) => removeCase('testCases', index), (index, field, value) => updateCase('testCases', index, field, value))}
              <div>
                <h4 className="text-sm font-medium mb-2">默认代码模板</h4>
                <div className="flex flex-col gap-2">
                  {['cpp', 'python', 'go'].map((lang) => (
                    <div key={lang}>
                      <Label className="text-xs mb-1 block">{lang === 'cpp' ? 'C++' : lang === 'python' ? 'Python' : 'Go'}</Label>
                      <Textarea className="font-mono min-h-[100px]" value={form.programming.starterCode[lang]} onChange={(e) => updateStarterCode(lang, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {editorMode === 'ui' && form.type === 'single_choice' && (
            <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium">选项</h4>
                  <Button size="sm" variant="outline" onClick={addOption} disabled={form.singleChoice.options.length >= OPTION_LABELS.length}>
                    <Plus className="h-4 w-4 mr-1" />添加选项
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {form.singleChoice.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="outline" className="min-w-[42px] justify-center">{OPTION_LABELS[index]}</Badge>
                      <Input placeholder={`选项 ${OPTION_LABELS[index]}`} value={option} onChange={(e) => updateOption(index, e.target.value)} />
                      <Button size="sm" variant="ghost" onClick={() => removeOption(index)} disabled={form.singleChoice.options.length <= 2}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1 block">正确答案</Label>
                <Select value={String(form.singleChoice.answerIndex)} onValueChange={(v) => updateNestedField('singleChoice', 'answerIndex', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {form.singleChoice.options.map((_, index) => (
                      <SelectItem key={index} value={String(index)}>{OPTION_LABELS[index]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {editorMode === 'ui' && form.type === 'true_false' && (
            <div>
              <Label className="mb-1 block">正确答案</Label>
              <Select value={form.trueFalse.answer} onValueChange={(v) => updateNestedField('trueFalse', 'answer', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">正确</SelectItem>
                  <SelectItem value="false">错误</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : (isEditMode ? editSubmitText : createSubmitText)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
