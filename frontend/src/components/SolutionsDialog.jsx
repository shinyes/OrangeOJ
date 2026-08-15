import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Plus, Trash2, Copy, PencilLine, ChevronDown, ChevronRight } from 'lucide-react'
import MarkdownContent from './MarkdownContent'
import { toast } from 'sonner'

const SOLUTION_LANGUAGE_LABELS = { cpp: 'C++', python: 'Python', go: 'Go', turtle: 'Python Turtle' }

function normalizeSolutionLanguage(language) {
  const normalized = String(language || '').trim().toLowerCase()
  if (['c++', 'cpp', 'c'].includes(normalized)) return 'cpp'
  if (['python', 'python3', 'py', 'python 3'].includes(normalized)) return 'python'
  if (['go', 'golang'].includes(normalized)) return 'go'
  if (['turtle', 'python turtle', 'pythonturtle'].includes(normalized)) return 'turtle'
  return normalized
}

export function normalizeSolutions(list) {
  if (!Array.isArray(list)) return []
  const result = []
  list.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    const language = normalizeSolutionLanguage(item.language)
    if (!language) return
    result.push({
      language,
      code: String(item.code ?? ''),
      markdown: String(item.markdown ?? '')
    })
  })
  return result
}

async function copyToClipboardFallback(text, message) {
  try {
    await navigator.clipboard.writeText(text || '')
    toast.success(`${message}已复制`)
  } catch (err) {
    toast.error('复制失败')
  }
}

// 取 markdown 文本中第一个非空行，作为题解折叠时显示的摘要文字
function firstMarkdownLine(markdown) {
  return String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || ''
}

/**
 * 新增 / 编辑题解的表单浮窗（单独弹窗操作）。
 * mode="create" 打开空表单；mode="edit" 预填 initial 的内容。
 * onSubmit 为异步：成功后自动关闭浮窗；失败（抛出异常）则保持打开、由父组件提示错误。
 */
function SolutionFormDialog({ open, mode = 'create', initial = null, onClose, onSubmit }) {
  const [language, setLanguage] = useState('cpp')
  const [code, setCode] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    const base = mode === 'edit' && initial && typeof initial === 'object' ? initial : {}
    setLanguage(normalizeSolutionLanguage(base.language) || 'cpp')
    setCode(String(base.code ?? ''))
    setMarkdown(String(base.markdown ?? ''))
    setSubmitting(false)
  }, [open, mode, initial])

  const handleSubmit = async () => {
    if (submitting) return
    const normalized = normalizeSolutionLanguage(language)
    if (!normalized) return
    setSubmitting(true)
    try {
      await onSubmit({ language: normalized, code: code.trim(), markdown: markdown.trim() })
      onClose()
    } catch (err) {
      // 保存失败：保持浮窗打开，错误提示由父组件负责
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '编辑题解' : '新增题解'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 py-1">
          <div>
            <Label className="mb-1 block">语言</Label>
            <Select value={language} onValueChange={setLanguage} disabled={submitting}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SOLUTION_LANGUAGE_LABELS).map(([lang, label]) => (
                  <SelectItem key={lang} value={lang}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">参考代码</Label>
            <Textarea className="font-mono min-h-[140px]" placeholder="// 填写该语言的参考代码"
              value={code} onChange={(e) => setCode(e.target.value)} disabled={submitting} />
          </div>
          <div>
            <Label className="mb-1 block">解读（Markdown）</Label>
            <Textarea className="min-h-[120px]"
              value={markdown} onChange={(e) => setMarkdown(e.target.value)} disabled={submitting} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : (mode === 'edit' ? '保存修改' : '添加')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 题解列表浮窗：以预览模式展示所有题解。
 * 「添加题解」与每张卡片的「编辑」都会打开独立的 SolutionFormDialog 浮窗；
 * 新增 / 编辑 / 删除都是即改即存（立即调用 onSave 提交），因此不再需要"保存题解"按钮，
 * 右上角 X 或点击遮罩即可关闭。
 */
export default function SolutionsDialog({ open, onClose, solutions, onSave, saving = false, copyToClipboard = copyToClipboardFallback }) {
  const [items, setItems] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [editingIndex, setEditingIndex] = useState(-1)
  const [expanded, setExpanded] = useState(new Set())
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(-1)

  useEffect(() => {
    if (!open) return
    setItems(normalizeSolutions(solutions))
    setFormOpen(false)
    setEditingIndex(-1)
    setExpanded(new Set())
    setConfirmDeleteIndex(-1)
  }, [open, solutions])

  const toggleExpanded = (index) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const openCreateForm = () => {
    setFormMode('create')
    setEditingIndex(-1)
    setFormOpen(true)
  }

  const openEditForm = (index) => {
    setFormMode('edit')
    setEditingIndex(index)
    setFormOpen(true)
  }

  // 新增 / 编辑：即改即存。onSave 抛错则浮窗保持打开。
  const handleFormSubmit = async (solution) => {
    const next = formMode === 'edit' && editingIndex >= 0
      ? items.map((item, index) => (index === editingIndex ? solution : item))
      : [...items, solution]
    await onSave(normalizeSolutions(next))
    setItems(next)
  }

  // 删除：先确认，确认后即改即存
  const handleConfirmDelete = async () => {
    if (saving || confirmDeleteIndex < 0) return
    const next = items.filter((_, itemIndex) => itemIndex !== confirmDeleteIndex)
    try {
      await onSave(normalizeSolutions(next))
      setItems(next)
      setConfirmDeleteIndex(-1)
    } catch (err) {
      // 错误提示由父组件负责
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>题解</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs text-muted-foreground">
              共 {items.length} 个题解 · 新增 / 编辑 / 删除后立即保存 · 仅管理员可见
            </p>
            <Button size="sm" variant="outline" onClick={openCreateForm} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />添加题解
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">暂无题解</p>
                <p className="text-xs text-muted-foreground mt-1">点击"添加题解"为这道题添加题解</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-1">
                {items.map((solution, index) => {
                  const isExpanded = expanded.has(index)
                  const summary = firstMarkdownLine(solution.markdown)
                  return (
                    <div key={index} className="border rounded-lg">
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 rounded-t-lg">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Badge variant="secondary" className="shrink-0">题解 {index + 1}</Badge>
                          <Badge variant="outline" className="shrink-0">{SOLUTION_LANGUAGE_LABELS[solution.language] || solution.language || '未知语言'}</Badge>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7" onClick={() => toggleExpanded(index)} title={isExpanded ? '折叠' : '展开'}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => openEditForm(index)} disabled={saving}>
                            <PencilLine className="h-3.5 w-3.5 mr-1" />编辑
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDeleteIndex(index)} disabled={saving} title="删除此题解">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-3">
                        {isExpanded ? (
                          <div className="flex flex-col gap-3">
                            {solution.markdown ? (
                              <div className="text-sm">
                                <MarkdownContent content={solution.markdown} />
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">（无解读）</p>
                            )}
                            {solution.code ? (
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-semibold text-muted-foreground">参考代码</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(solution.code, '参考代码')}>
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <pre className="m-0 p-3 bg-muted/50 rounded-lg font-mono text-sm whitespace-pre-wrap break-all border overflow-x-auto max-h-[40vh]">
                                  {solution.code}
                                </pre>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">（无参考代码）</p>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="w-full text-left text-sm truncate text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => toggleExpanded(index)}
                            title={summary ? '点击展开' : '暂无解读'}
                          >
                            {summary || '（无解读）'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认浮窗 */}
      <Dialog open={confirmDeleteIndex >= 0} onOpenChange={(o) => { if (!o) setConfirmDeleteIndex(-1) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除题解</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              确定删除第 <strong className="text-foreground">{confirmDeleteIndex >= 0 ? confirmDeleteIndex + 1 : ''}</strong> 个题解吗？删除后立即保存，不可恢复。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteIndex(-1)} disabled={saving}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? '删除中...' : '删除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 新增 / 编辑题解的表单浮窗 */}
      <SolutionFormDialog
        open={formOpen}
        mode={formMode}
        initial={formMode === 'edit' && editingIndex >= 0 ? items[editingIndex] : null}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </>
  )
}
