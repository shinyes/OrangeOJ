import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Play, Pencil, Download, MoreHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { api } from '../../api'

function problemTypeText(type) {
  if (type === 'programming') return '编程题'
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type
}

/**
 * 行内操作按钮：任何宽度下都显示图标；仅超宽屏（xl+）显示"图标 + 文字"。
 */
function RowAction({ icon: Icon, children, ...props }) {
  return (
    <Button size="sm" variant="ghost" className="h-7 w-7 px-0 xl:w-auto xl:px-2" {...props}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden xl:inline">{children}</span>
    </Button>
  )
}

/**
 * 题库列表中的一行题目。
 * 使用 Grid 布局（grid-cols-[auto_minmax(0,1fr)_auto]）：
 *  - 第 1 列 auto：题号，按内容宽度
 *  - 第 2 列 minmax(0,1fr)：标题，可收缩到 0 并省略号截断（数学上不可能撑破行）
 *  - 第 3 列 auto：徽标 + 操作按钮，按内容宽度，永远完整显示在行最右
 * 行容器另有 max-w-full + overflow-hidden 双保险，任意宽度/任意长标题都不会溢出。
 */
export default function ProblemRow({ problem, spaceId, onEdit, onMove, onRemove }) {
  const handleExport = () => {
    api.exportProblems(spaceId, [problem.id], problem.title)
  }

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 px-1.5 py-2 rounded-lg border hover:bg-accent/50 transition-colors group overflow-hidden w-full max-w-full"
    >
      {/* 第 1 列：题号 */}
      <span className="font-bold text-sm text-primary tabular-nums whitespace-nowrap">#{problem.id}</span>

      {/* 第 2 列：标题（minmax(0,1fr) 可收缩 + truncate 截断） */}
      <span className="text-sm font-medium truncate min-w-0" title={problem.title}>{problem.title}</span>

      {/* 第 3 列：右侧组（徽标 + 操作按钮） */}
      <div className="flex items-center justify-end gap-1.5">
        <Badge variant="outline" className="text-[11px] shrink-0 hidden xl:inline-flex">{problemTypeText(problem.type)}</Badge>
        {(problem.tags || []).slice(0, 1).map(tag => (
          <Badge key={tag} variant="secondary" className="text-[11px] shrink-0 hidden 2xl:inline-flex">{tag}</Badge>
        ))}
        <div className="flex items-center gap-0.5 md:gap-1">
          <RowAction
            icon={Play}
            onClick={() => window.open(`/spaces/${spaceId}/problems/${problem.id}/solve`, '_blank')}
            title="在新窗口打开做题页面"
          >做题</RowAction>
          <RowAction icon={Pencil} onClick={() => onEdit(problem.id)}>编辑</RowAction>
          <RowAction icon={Download} onClick={handleExport} title="导出这道题（ZIP）">导出</RowAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onMove(problem)}>移动到目录</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onRemove(problem.id)}>删除</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
