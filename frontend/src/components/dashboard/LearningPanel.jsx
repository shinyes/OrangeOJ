import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { MoreHorizontal, Search, CheckCircle2 } from 'lucide-react'

export default function LearningPanel({
  selectedSpace, spaces, spaceTab,
  learningProblemSearch, onLearningProblemSearchChange, filteredLearningProblems, problemTypeText,
  learningTrainingSearch, onLearningTrainingSearchChange, canManageSelectedSpace,
  onOpenCreateTrainingPlan, filteredLearningTrainingPlans, onOpenEditTrainingPlan,
  onOpenAssignTrainingParticipant, onExportTrainingPlan, onDeleteTrainingPlan, trainingActionMessage,
  learningHomeworkSearch, onLearningHomeworkSearchChange, onOpenCreateHomework,
  filteredLearningHomeworks, onOpenEditHomework, onOpenAssignHomeworkTarget,
  onExportHomework, onDeleteHomework, homeworkActionMessage
}) {
  if (!selectedSpace) {
    return (
      <Card><CardContent className="p-6 text-center">
        <p className="text-muted-foreground">
          {spaces.length === 0 ? '暂无可访问空间，请先创建或加入空间。' : '请选择一个空间。'}
        </p>
      </CardContent>
    </Card>
    )
  }

  return (
    <main>
      {/* Problems Tab */}
      {spaceTab === 'problems' && (
        <div>
          <div className="mb-4">
            <div className="relative">
              <Input placeholder="搜索题目（ID/标题/标签）" value={learningProblemSearch}
                onChange={(e) => onLearningProblemSearchChange(e.target.value)}
                className="w-full pl-9" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-2 max-w-3xl mx-auto">
            {filteredLearningProblems.length === 0 && (
              <p className="text-muted-foreground text-center py-8 w-full">没有匹配题目</p>
            )}
            {filteredLearningProblems.map((problem) => (
              <Link key={problem.id}
                to={`/spaces/${selectedSpace.id}/problems/${problem.id}/solve`}
                className="no-underline group">
                <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary">
                  <CardContent className="py-3 px-4">
                    {/* Mobile layout: two rows */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                      {/* Top row: ID + Title (mobile) / All in one row (desktop) */}
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                        <span className="font-bold text-sm text-primary shrink-0 min-w-[3.5ch] tabular-nums">#{problem.id}</span>
                        <div className="w-4 shrink-0 flex items-center justify-center">
                          {problem.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : null}
                        </div>
                        <span className="font-medium text-sm text-foreground leading-snug truncate">
                          {problem.title}
                        </span>
                      </div>
                      {/* Bottom row: Tags + Type */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap sm:shrink-0 ml-[3.5ch] sm:ml-0">
                        {(problem.tags || []).length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap min-w-0">
                            {problem.tags.map((tag) => (
                              <Badge key={`${problem.id}-${tag}`} variant="outline" className="text-[11px] h-[22px] shrink-0">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        <Badge className="bg-primary/10 text-primary text-xs h-[22px] shrink-0 ml-auto sm:ml-1">{problemTypeText(problem.type)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Training Tab */}
      {spaceTab === 'training' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
            <Input placeholder="搜索训练计划标题" value={learningTrainingSearch}
              onChange={(e) => onLearningTrainingSearchChange(e.target.value)} className="flex-1" />
            {canManageSelectedSpace && <Button onClick={onOpenCreateTrainingPlan} className="shrink-0 w-full sm:w-auto">创建训练计划</Button>}
          </div>

          {filteredLearningTrainingPlans.length === 0 && (
            <p className="text-muted-foreground text-center py-8 w-full">暂无匹配的训练计划。</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLearningTrainingPlans.map((plan) => {
              return (
                <Card key={plan.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base line-clamp-2">{plan.title}</CardTitle>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {plan.published ? (
                      <Badge variant="success" className="text-[11px]">已发布</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px]">未发布</Badge>
                    )}
                    {plan.participantUsernames && plan.participantUsernames.length > 0 && (
                      <Badge variant="outline" className="text-[11px] max-w-[200px] truncate" title={plan.participantUsernames}>
                        {plan.participantUsernames}
                      </Badge>
                    )}
                    </div>
                  </CardHeader>
                  <CardFooter className="mt-auto pt-2 flex flex-wrap gap-2">
                    <Button size="sm" asChild><Link to={`/spaces/${selectedSpace.id}/training-plans/${plan.id}`}>进入训练</Link></Button>
                    {canManageSelectedSpace && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpenAssignTrainingParticipant(plan.id)}>分配成员</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onOpenEditTrainingPlan(plan.id)}>编辑</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onExportTrainingPlan(plan.id)}>导出</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => onDeleteTrainingPlan(plan.id)}>删除</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Homework Tab */}
      {spaceTab === 'homework' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
            <Input placeholder="搜索作业标题" value={learningHomeworkSearch}
              onChange={(e) => onLearningHomeworkSearchChange(e.target.value)} className="flex-1" />
            {canManageSelectedSpace && <Button onClick={onOpenCreateHomework} className="shrink-0 w-full sm:w-auto">创建作业</Button>}
          </div>

          {filteredLearningHomeworks.length === 0 && (
            <p className="text-muted-foreground text-center py-8 w-full">暂无匹配的作业。</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLearningHomeworks.map((homework) => (
              <Card key={homework.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base line-clamp-2">{homework.title}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant={homework.published ? 'success' : 'secondary'} className="text-[11px]">{homework.published ? '已发布' : '未发布'}</Badge>
                    {homework.dueAt && <Badge variant="outline" className="text-[11px]">截止：{homework.dueAt}</Badge>}
                    {homework.targetUsernames && homework.targetUsernames.length > 0 && (
                      <Badge variant="outline" className="text-[11px] max-w-[200px] truncate" title={homework.targetUsernames}>
                        {homework.targetUsernames}
                      </Badge>
                    )}
                    {!canManageSelectedSpace && homework.assigned && (
                      <Badge variant="info" className="text-[11px]">已分配给我</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardFooter className="mt-auto pt-2 flex flex-wrap gap-2">
                  <Button size="sm" asChild><Link to={`/spaces/${selectedSpace.id}/homeworks/${homework.id}`}>进入作业</Link></Button>
                  {canManageSelectedSpace && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/spaces/${selectedSpace.id}/homeworks/${homework.id}/submission-records?returnTo=${encodeURIComponent(`/?spaceId=${selectedSpace.id}&tab=homework`)}&returnLabel=${encodeURIComponent('返回作业列表')}`}>提交记录</Link>
                    </Button>
                  )}
                  {canManageSelectedSpace && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenAssignHomeworkTarget(homework.id)}>分配成员</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onOpenEditHomework(homework.id)}>编辑</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExportHomework(homework.id)}>导出</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDeleteHomework(homework.id)}>删除</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
