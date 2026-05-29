import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

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
          <div className="flex gap-4 mb-4">
            <Input placeholder="搜索题目（ID/标题/标签）" value={learningProblemSearch}
              onChange={(e) => onLearningProblemSearchChange(e.target.value)}
              className="w-full sm:w-[260px]" />
          </div>
          <div className="flex flex-col gap-2 max-w-3xl mx-auto">
            {filteredLearningProblems.length === 0 && (
              <p className="text-muted-foreground text-center py-4 w-full">没有匹配题目</p>
            )}
            {filteredLearningProblems.map((problem) => (
              <Link key={problem.id}
                to={`/spaces/${selectedSpace.id}/problems/${problem.id}/solve`}
                className="no-underline">
                <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary">
                  <CardContent className="py-2 px-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-primary w-[50px] shrink-0">#{problem.id}</span>
                      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                        <span className="font-medium text-sm text-foreground truncate">
                          {problem.completed ? '✅ ' : ''}{problem.title}
                        </span>
                        {(problem.tags || []).length > 0 && (
                          <div className="flex items-center gap-1 overflow-hidden shrink">
                            {problem.tags.map((tag) => (
                              <Badge key={`${problem.id}-${tag}`} variant="outline" className="text-[11px] h-[22px] shrink-0">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge className="bg-primary/10 text-primary text-xs h-[26px] shrink-0">{problemTypeText(problem.type)}</Badge>
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
          <div className="flex gap-3 mb-4 items-center">
            <Input placeholder="搜索训练计划标题" value={learningTrainingSearch}
              onChange={(e) => onLearningTrainingSearchChange(e.target.value)} className="flex-1" />
            {canManageSelectedSpace && <Button onClick={onOpenCreateTrainingPlan} className="shrink-0">创建训练计划</Button>}
          </div>

          {filteredLearningTrainingPlans.length === 0 && (
            <p className="text-muted-foreground text-center py-8 w-full">暂无匹配的训练计划。</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLearningTrainingPlans.map((plan) => {
              const isPublic = plan.isPublic !== false

              return (
                <Card key={plan.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base line-clamp-2">{plan.title}</CardTitle>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant={isPublic ? 'default' : 'secondary'} className="text-[11px]">{isPublic ? '公开' : '隐藏'}</Badge>
                      {plan.published ? (
                      <Badge variant="success" className="text-[11px]">已发布</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px]">未发布</Badge>
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
          <div className="flex gap-3 mb-4 items-center">
            <Input placeholder="搜索作业标题" value={learningHomeworkSearch}
              onChange={(e) => onLearningHomeworkSearchChange(e.target.value)} className="flex-1" />
            {canManageSelectedSpace && <Button onClick={onOpenCreateHomework} className="shrink-0">创建作业</Button>}
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
