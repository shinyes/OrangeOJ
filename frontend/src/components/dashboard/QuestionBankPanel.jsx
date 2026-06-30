import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { api } from '../../api'
import ToastMessage from '../ToastMessage'
import {
  Folder, FolderOpen, FileText, Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  Search, Upload, MoreHorizontal, X, Check, RefreshCw, Home
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '../ui/command'

function problemTypeText(type) {
  if (type === 'programming') return '编程题'
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type
}

function buildTree(dirs) {
  const map = new Map()
  const roots = []
  dirs.forEach(d => map.set(d.id, { ...d, children: [] }))
  dirs.forEach(d => {
    const node = map.get(d.id)
    if (d.parentId && map.has(d.parentId)) {
      map.get(d.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function findPath(dirId, dirs) {
  const path = []
  let current = dirs.find(d => d.id === dirId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? dirs.find(d => d.id === current.parentId) : null
  }
  return path
}

function DirTreeNode({ node, depth, selectedId, onSelect, onContextMenu, expandedIds, onToggle, problemCount, allProblems, onAddSub, onRename, onMove, onDelete }) {
  // Compute total problems in this subtree
  const totalCount = problemCount != null ? problemCount : (() => {
    let c = (allProblems || []).filter(p => p.directoryId === node.id).length
    for (const child of node.children || []) {
      c += (allProblems || []).filter(p => p.directoryId === child.id).length
    }
    return c
  })()
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const hasChildren = node.children && node.children.length > 0

  return (
    <>
      <div
        className={`flex items-center gap-x-0.5 py-1.5 rounded-md cursor-pointer text-sm group select-none ${
          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node.id) }}
      >
        <span
          className="w-4 h-4 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onToggle(node.id) }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : <span className="w-3.5" />}
        </span>
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isExpanded ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />}
        </span>
        <span className="truncate flex-1 min-w-0">{node.name}</span>
        {totalCount > 0 && (
          <span className="text-[11px] text-muted-foreground shrink-0 mr-1">{totalCount}</span>
        )}
        <div className="opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              <DropdownMenuItem onClick={() => onAddSub(node.id)}>
                <Plus className="h-3.5 w-3.5 mr-2" />新建子目录
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(node.id)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />重命名
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(node.id)}>
                <Folder className="h-3.5 w-3.5 mr-2" />移动到
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(node.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="relative">
          {node.children.map((child, idx) => (
            <DirTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              expandedIds={expandedIds}
              onToggle={onToggle}
              allProblems={allProblems}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function QuestionBankPanel({
  selectedSpaceId, selectedSpace, canManageSelectedSpace,
  spaceProblems, onRefreshProblems, problemTypeText: ptText
}) {
  const [directories, setDirectories] = useState([])
  const [selectedDirId, setSelectedDirId] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [searchText, setSearchText] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageSeverity, setMessageSeverity] = useState('success')

  // Dialog states
  const [showNewDirDialog, setShowNewDirDialog] = useState(false)
  const [showRenameDirDialog, setShowRenameDirDialog] = useState(false)
  const [showDeleteDirDialog, setShowDeleteDirDialog] = useState(false)
  const [showMoveProblemDialog, setShowMoveProblemDialog] = useState(false)
  const [showMoveDirDialog, setShowMoveDirDialog] = useState(false)
  const [dirNameInput, setDirNameInput] = useState('')
  const [contextDirId, setContextDirId] = useState(null)
  const [moveProblemId, setMoveProblemId] = useState(null)
  const [moveTargetDirId, setMoveTargetDirId] = useState(null)
  const [dirSubmitting, setDirSubmitting] = useState(false)
  const [zipImporting, setZipImporting] = useState(false)

  // Context menu
  const [contextMenu, setContextMenu] = useState(null)
  const contextMenuRef = useRef(null)

  const showMessage = useCallback((msg, severity = 'success') => {
    setMessage(msg)
    setMessageSeverity(severity)
  }, [])

  const loadDirectories = useCallback(async () => {
    if (!selectedSpaceId) return
    try {
      const dirs = await api.listProblemDirectories(selectedSpaceId)
      setDirectories(dirs || [])
    } catch (err) {
      showMessage(err.message || '加载目录失败', 'error')
    }
  }, [selectedSpaceId, showMessage])

  useEffect(() => {
    loadDirectories()
  }, [loadDirectories])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  const treeRoots = buildTree(directories)

  // Multi-stage filtering: directory → tags → text search
  const dirFilteredProblems = selectedDirId === -1
    ? spaceProblems.filter(p => !p.directoryId)
    : selectedDirId != null
      ? spaceProblems.filter(p => p.directoryId === selectedDirId)
      : spaceProblems

  const allAvailableTags = [...new Set(
    dirFilteredProblems.flatMap(p => p.tags || [])
  )].sort((a, b) => a.localeCompare(b))

  const filteredProblems = dirFilteredProblems
    .filter(p => selectedTags.length === 0 || selectedTags.every(tag => (p.tags || []).includes(tag)))
    .filter(p => {
      const kw = searchText.trim().toLowerCase()
      if (!kw) return true
      return String(p.id).includes(kw) ||
        String(p.title || '').toLowerCase().includes(kw)
    })
    .sort((a, b) => b.id - a.id)

  // Breadcrumb path
  const breadcrumbPath = selectedDirId != null && selectedDirId !== -1 ? findPath(selectedDirId, directories) : []

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([onRefreshProblems(), loadDirectories()])
    } finally {
      setLoading(false)
    }
  }, [onRefreshProblems, loadDirectories])

  // --- Directory CRUD ---

  const handleCreateDir = async () => {
    if (!dirNameInput.trim()) return
    setDirSubmitting(true)
    try {
      await api.createProblemDirectory(selectedSpaceId, {
        name: dirNameInput.trim(),
        parentId: contextDirId || null
      })
      setShowNewDirDialog(false)
      setDirNameInput('')
      if (contextDirId) {
        setExpandedIds(prev => new Set([...prev, contextDirId]))
      }
      setContextDirId(null)
      await loadDirectories()
      showMessage('目录创建成功')
    } catch (err) {
      showMessage(err.message || '创建目录失败', 'error')
    } finally {
      setDirSubmitting(false)
    }
  }

  const handleRenameDir = async () => {
    if (!dirNameInput.trim() || !contextDirId) return
    setDirSubmitting(true)
    try {
      await api.updateProblemDirectory(selectedSpaceId, contextDirId, { name: dirNameInput.trim() })
      setShowRenameDirDialog(false)
      setDirNameInput('')
      setContextDirId(null)
      await loadDirectories()
      showMessage('目录重命名成功')
    } catch (err) {
      showMessage(err.message || '重命名失败', 'error')
    } finally {
      setDirSubmitting(false)
    }
  }

  const handleDeleteDir = async () => {
    if (!contextDirId) return
    setDirSubmitting(true)
    try {
      await api.deleteProblemDirectory(selectedSpaceId, contextDirId)
      setShowDeleteDirDialog(false)
      setContextDirId(null)
      if (selectedDirId === contextDirId) setSelectedDirId(-1)
      await Promise.all([loadDirectories(), onRefreshProblems()])
      showMessage('目录已删除')
    } catch (err) {
      showMessage(err.message || '删除目录失败', 'error')
    } finally {
      setDirSubmitting(false)
    }
  }

  const handleMoveProblem = async () => {
    if (!moveProblemId) return
    setDirSubmitting(true)
    try {
      await api.moveProblemToDirectory(selectedSpaceId, moveProblemId, moveTargetDirId || null)
      setShowMoveProblemDialog(false)
      setMoveProblemId(null)
      setMoveTargetDirId(null)
      await onRefreshProblems()
      showMessage('题目移动成功')
    } catch (err) {
      showMessage(err.message || '移动题目失败', 'error')
    } finally {
      setDirSubmitting(false)
    }
  }

  const openCreateSubdir = (parentId) => {
    setContextDirId(parentId)
    setDirNameInput('')
    setShowNewDirDialog(true)
  }

  const openRename = (dirId) => {
    const dir = directories.find(d => d.id === dirId)
    setContextDirId(dirId)
    setDirNameInput(dir?.name || '')
    setShowRenameDirDialog(true)
  }

  const openDelete = (dirId) => {
    setContextDirId(dirId)
    setShowDeleteDirDialog(true)
  }

  const openMoveDir = (dirId) => {
    setContextDirId(dirId)
    setMoveTargetDirId(null)
    setShowMoveDirDialog(true)
  }

  // Get all descendant IDs to prevent circular moves
  const getDescendantIds = useCallback((dirId, dirs) => {
    const ids = new Set()
    const children = dirs.filter(d => d.parentId === dirId)
    for (const child of children) {
      ids.add(child.id)
      for (const id of getDescendantIds(child.id, dirs)) ids.add(id)
    }
    return ids
  }, [])

  const handleMoveDir = async () => {
    if (!contextDirId || moveTargetDirId === undefined) return
    setDirSubmitting(true)
    try {
      await api.updateProblemDirectory(selectedSpaceId, contextDirId, {
        parentId: moveTargetDirId || null
      })
      setShowMoveDirDialog(false)
      setContextDirId(null)
      setMoveTargetDirId(null)
      await loadDirectories()
      showMessage('目录移动成功')
    } catch (err) {
      showMessage(err.message || '移动目录失败', 'error')
    } finally {
      setDirSubmitting(false)
    }
  }

  const handleContextMenu = (e, dirId) => {
    setContextMenu({ x: e.clientX, y: e.clientY, dirId })
  }

  const handleImportZip = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedSpaceId) return
    setZipImporting(true)
    try {
      const result = await api.importProblems(selectedSpaceId, file)
      showMessage(`已从 ZIP 导入 ${result?.problems?.length || 0} 道题目`)
      await onRefreshProblems()
    } catch (err) {
      showMessage(err.message || 'ZIP 导入失败', 'error')
    } finally {
      setZipImporting(false)
      e.target.value = ''
    }
  }

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!selectedSpace) {
    return (
      <Card><CardContent className="p-6 text-center">
        <p className="text-muted-foreground">请选择一个空间。</p>
      </CardContent></Card>
    )
  }

  if (!canManageSelectedSpace) {
    return (
      <Card><CardContent className="p-6">
        <h2 className="text-lg font-bold mb-2">题库管理</h2>
        <p className="text-muted-foreground">当前账号无空间管理权限，不能管理题库。</p>
      </CardContent></Card>
    )
  }

  const totalRootProblems = spaceProblems.filter(p => !p.directoryId).length

  return (
    <div>
      {message && (
        <div className="mb-3">
          <ToastMessage message={message} severity={messageSeverity} onShown={() => setMessage('')} />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ========= Left: Directory Tree ========= */}
        <div className="w-full lg:w-72 shrink-0">
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center justify-between px-2 py-1 border-b mb-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">题目目录</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openCreateSubdir(null)} title="新建根目录">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ScrollArea className="h-[65vh]">
                <div className="space-y-0.5 pr-2">
                {/* Uncat */}
                <div
                  className={`flex items-center gap-x-0.5 py-1.5 rounded-md cursor-pointer text-sm ${
                    selectedDirId === -1 ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
                  }`}
                  onClick={() => setSelectedDirId(-1)}
                >
                  <span className="w-4 h-4 shrink-0" />
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">未分类</span>
                  {totalRootProblems > 0 && (
                    <span className="text-[11px] text-muted-foreground">{totalRootProblems}</span>
                  )}
                </div>
                {/* Tree */}
                {treeRoots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">暂无目录，点 + 创建</p>
                ) : (
                  treeRoots.map((root, idx) => (
                    <DirTreeNode
                      key={root.id}
                      node={root}
                      depth={0}
                      selectedId={selectedDirId}
                      onSelect={setSelectedDirId}
                      onContextMenu={handleContextMenu}
                      expandedIds={expandedIds}
                      onToggle={toggleExpand}
                      allProblems={spaceProblems}
                      onAddSub={openCreateSubdir}
                      onRename={openRename}
                      onMove={openMoveDir}
                      onDelete={openDelete}
                    />
                  ))
                )}
              </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ========= Right: Problem List ========= */}
        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-3 text-sm text-muted-foreground flex-wrap">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedDirId(null)}>
              <Home className="h-3.5 w-3.5 mr-1" />
              全部
            </Button>
            {breadcrumbPath.map((dir, idx) => (
              <span key={dir.id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 text-xs ${idx === breadcrumbPath.length - 1 ? 'font-medium text-foreground' : ''}`}
                  onClick={() => setSelectedDirId(dir.id)}
                >
                  {dir.name}
                </Button>
              </span>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold">
                    {selectedDirId === -1 ? '未分类' : selectedDirId != null ? breadcrumbPath.map(d => d.name).join(' / ') : '全部题目'}
                  </span>
                  <Badge variant="secondary" className="text-[11px]">{filteredProblems.length}</Badge>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {selectedDirId != null && selectedDirId !== -1 && (
                    <Button variant="outline" size="sm" onClick={() => openCreateSubdir(selectedDirId)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />子目录
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />新建</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.openCreateProblem?.(selectedDirId != null && selectedDirId !== -1 ? selectedDirId : null)}>
                        <FileText className="h-4 w-4 mr-2" />新建题目
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openCreateSubdir(selectedDirId != null && selectedDirId !== -1 ? selectedDirId : null)}>
                        <Folder className="h-4 w-4 mr-2" />新建目录
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" disabled={zipImporting} onClick={() => document.getElementById('qb-zip-input')?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" />{zipImporting ? '导入中...' : '导入'}
                  </Button>
                  <input type="file" id="qb-zip-input" accept=".zip" className="hidden" onChange={handleImportZip} />
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Tags */}
              {allAvailableTags.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {allAvailableTags.map(tag => (
                    <Badge key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs select-none"
                      onClick={() => setSelectedTags(prev =>
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      )}
                    >
                      {tag}
                      {selectedTags.includes(tag) && (
                        <X className="h-3 w-3 ml-1" onClick={(e) => {
                          e.stopPropagation()
                          setSelectedTags(prev => prev.filter(t => t !== tag))
                        }} />
                      )}
                    </Badge>
                  ))}
                  {selectedTags.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-1.5 text-muted-foreground"
                      onClick={() => setSelectedTags([])}>
                      清除筛选
                    </Button>
                  )}
                </div>
              )}

              {/* Search */}
              <div className="relative mb-3">
                <Input placeholder="搜索题目（ID/标题）" value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-9 h-9 text-sm" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                {searchText && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchText('')}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Problem list */}
              <ScrollArea className="h-[55vh]">
                {filteredProblems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    {searchText ? '没有匹配题目' : selectedTags.length > 0 ? '该筛选条件下没有匹配题目' : '该目录下暂无题目，点击"新建"或"导入"添加'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 pr-1">
                    {filteredProblems.map((problem) => (
                      <div key={problem.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-accent/50 transition-colors group">
                        <span className="font-bold text-sm text-primary shrink-0 tabular-nums w-[3.5ch]">#{problem.id}</span>
                        <span className="text-sm font-medium truncate flex-1 min-w-0">{problem.title}</span>
                        <Badge variant="outline" className="text-[11px] shrink-0">{ptText ? ptText(problem.type) : problemTypeText(problem.type)}</Badge>
                        {(problem.tags || []).slice(0, 2).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[11px] shrink-0 hidden sm:inline-flex">{tag}</Badge>
                        ))}
                        <div className="flex gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" asChild>
                            <Link to={`/spaces/${selectedSpaceId}/problems/${problem.id}/solve`} target="_blank">做题</Link>
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                            onClick={() => window.openEditProblem?.(problem.id)}>编辑</Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => api.exportProblems(selectedSpaceId, [problem.id])}>
                                导出
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setMoveProblemId(problem.id)
                                setMoveTargetDirId(problem.directoryId || null)
                                setShowMoveProblemDialog(true)
                              }}>
                                移动到目录
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive"
                                onClick={() => window.removeProblem?.(problem.id)}>
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ====== Context Menu (right-click) ====== */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2 text-sm font-normal"
            onClick={() => { openCreateSubdir(contextMenu.dirId); setContextMenu(null) }}>
            <Plus className="h-3.5 w-3.5" />新建子目录
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2 text-sm font-normal"
            onClick={() => { openRename(contextMenu.dirId); setContextMenu(null) }}>
            <Pencil className="h-3.5 w-3.5" />重命名
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2 text-sm font-normal"
            onClick={() => { openMoveDir(contextMenu.dirId); setContextMenu(null) }}>
            <Folder className="h-3.5 w-3.5" />移动到
          </Button>
          <Separator className="my-1" />
          <Button variant="ghost" className="w-full justify-start gap-2 h-8 px-2 text-sm font-normal text-destructive hover:text-destructive"
            onClick={() => { openDelete(contextMenu.dirId); setContextMenu(null) }}>
            <Trash2 className="h-3.5 w-3.5" />删除目录
          </Button>
        </div>
      )}

      {/* ====== Dialogs ====== */}
      <Dialog open={showNewDirDialog} onOpenChange={setShowNewDirDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{contextDirId ? '新建子目录' : '新建根目录'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="目录名称" value={dirNameInput}
              onChange={(e) => setDirNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDir() }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewDirDialog(false); setContextDirId(null) }}>取消</Button>
            <Button onClick={handleCreateDir} disabled={dirSubmitting || !dirNameInput.trim()}>
              {dirSubmitting ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDirDialog} onOpenChange={setShowRenameDirDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>重命名目录</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="目录名称" value={dirNameInput}
              onChange={(e) => setDirNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameDir() }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRenameDirDialog(false); setContextDirId(null) }}>取消</Button>
            <Button onClick={handleRenameDir} disabled={dirSubmitting || !dirNameInput.trim()}>
              {dirSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDirDialog} onOpenChange={setShowDeleteDirDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>删除目录</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              子目录将上移一级，该目录下的题目将移至"未分类"。此操作不可撤销。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDirDialog(false); setContextDirId(null) }}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteDir} disabled={dirSubmitting}>
              {dirSubmitting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveProblemDialog} onOpenChange={setShowMoveProblemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>移动到目录</DialogTitle></DialogHeader>
          <Command className="rounded-lg border">
            <CommandInput placeholder="搜索目录..." />
            <CommandList>
              <CommandEmpty>无匹配目录</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => setMoveTargetDirId(null)}>
                  <FileText className="h-4 w-4 text-muted-foreground mr-2" />
                  <span className="flex-1">未分类</span>
                  {!moveTargetDirId && <Check className="h-4 w-4 text-primary" />}
                </CommandItem>
                {(directories || []).map(dir => (
                  <CommandItem key={dir.id} onSelect={() => setMoveTargetDirId(dir.id)}>
                    <Folder className="h-4 w-4 text-amber-500 mr-2" />
                    <span className="flex-1 truncate">{dir.name}</span>
                    {moveTargetDirId === dir.id && <Check className="h-4 w-4 text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowMoveProblemDialog(false); setMoveProblemId(null) }}>取消</Button>
            <Button onClick={handleMoveProblem} disabled={dirSubmitting}>
              {dirSubmitting ? '移动中...' : '确认移动'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Move Directory Dialog ====== */}
      <Dialog open={showMoveDirDialog} onOpenChange={setShowMoveDirDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>移动目录</DialogTitle></DialogHeader>
          <Command className="rounded-lg border">
            <CommandInput placeholder="搜索目标目录..." />
            <CommandList>
              <CommandEmpty>无匹配目录</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => setMoveTargetDirId(null)}>
                  <FileText className="h-4 w-4 text-muted-foreground mr-2" />
                  <span className="flex-1">根目录（顶级）</span>
                  {moveTargetDirId === null && <Check className="h-4 w-4 text-primary" />}
                </CommandItem>
                {(directories || [])
                  .filter(d => d.id !== contextDirId && !getDescendantIds(contextDirId, directories).has(d.id))
                  .map(dir => (
                    <CommandItem key={dir.id} onSelect={() => setMoveTargetDirId(dir.id)}>
                      <Folder className="h-4 w-4 text-amber-500 mr-2" />
                      <span className="flex-1 truncate">{dir.name}</span>
                      {moveTargetDirId === dir.id && <Check className="h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {contextDirId && getDescendantIds(contextDirId, directories).size > 0 && (
            <p className="text-xs text-muted-foreground mt-2">子目录会随父目录一起移动</p>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowMoveDirDialog(false); setContextDirId(null) }}>取消</Button>
            <Button onClick={handleMoveDir} disabled={dirSubmitting}>
              {dirSubmitting ? '移动中...' : '确认移动'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
