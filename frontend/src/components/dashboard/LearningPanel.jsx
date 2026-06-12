import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { MoreHorizontal, Search, CheckCircle2 } from 'lucide-react'
import { api } from '../../api'
import { differenceInDays } from 'date-fns'

export default function LearningPanel({
  selectedSpace, spaces, spaceTab,
  learningProblemSearch, onLearningProblemSearchChange, filteredLearningProblems, problemTypeText,
  learningTrainingSearch, onLearningTrainingSearchChange, canManageSelectedSpace,
  onOpenCreateTrainingPlan, filteredLearningTrainingPlans, onOpenEditTrainingPlan,
  onOpenAssignTrainingParticipant, onExportTrainingPlan, onDeleteTrainingPlan, trainingActionMessage,
  allTrainingTags, allPracticeTags,
  learningTrainingTag, onLearningTrainingTagChange,
  learningPracticeTag, onLearningPracticeTagChange,
  learningPracticeSearch, onLearningPracticeSearchChange, onOpenCreatePractice,
  filteredLearningPractices, onOpenEditPractice, onOpenAssignPracticeTarget,
  onExportPractice, onDeletePractice, practiceActionMessage
}) {
  const navigate = useNavigate()

  const handleEnterTraining = async (planId) => {
    try {
      const plan = await api.getTrainingPlan(selectedSpace.id, planId)
      const firstProblem = (plan?.chapters || []).flatMap(ch => ch.items || [])[0]
      if (firstProblem) {
        const returnTo = '/?spaceId=' + selectedSpace.id + '&tab=training'
        navigate('/spaces/' + selectedSpace.id + '/problems/' + firstProblem.problemId + '/solve?planId=' + planId + '&returnTo=' + encodeURIComponent(returnTo) + '&returnLabel=' + encodeURIComponent('返回训练列表'))
      } else {
        navigate(`/spaces/${selectedSpace.id}/training-plans/${planId}/progress`)
      }
    } catch {
      navigate(`/spaces/${selectedSpace.id}/training-plans/${planId}/progress`)
    }
  }

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
          <div className="flex flex-col sm:flex-row gap-3 mb-2 items-stretch sm:items-center">
            <Input placeholder="搜索训练计划标题" value={learningTrainingSearch}
              onChange={(e) => onLearningTrainingSearchChange(e.target.value)} className="flex-1" />
            {canManageSelectedSpace && <Button onClick={onOpenCreateTrainingPlan} className="shrink-0 w-full sm:w-auto">创建训练计划</Button>}
          </div>

          {allTrainingTags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {allTrainingTags.map((tag) => (
                <Badge key={tag}
                  variant={learningTrainingTag === tag ? 'default' : 'outline'}
                  className="cursor-pointer text-xs select-none"
                  onClick={() => onLearningTrainingTagChange(learningTrainingTag === tag ? '' : tag)}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}

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
                    {Array.isArray(plan.tags) && plan.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[11px]">{tag}</Badge>
                    ))}
                    {plan.participantUsernames && plan.participantUsernames
                      .split(',').map(s => s.trim()).filter(Boolean)
                      .map((name) => (
                        <Badge key={name} variant="info" className="text-[11px]">{name}</Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardFooter className="mt-auto pt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleEnterTraining(plan.id)}>进入训练</Button>
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

      {/* Practice Tab */}
      {spaceTab === 'practice' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-2 items-stretch sm:items-center">
            <Input placeholder="搜索练习标题" value={learningPracticeSearch}
              onChange={(e) => onLearningPracticeSearchChange(e.target.value)} className="flex-1" />
            {canManageSelectedSpace && <Button onClick={onOpenCreatePractice} className="shrink-0 w-full sm:w-auto">创建练习</Button>}
          </div>

          {allPracticeTags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {allPracticeTags.map((tag) => (
                <Badge key={tag}
                  variant={learningPracticeTag === tag ? 'default' : 'outline'}
                  className="cursor-pointer text-xs select-none"
                  onClick={() => onLearningPracticeTagChange(learningPracticeTag === tag ? '' : tag)}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {filteredLearningPractices.length === 0 && (
            <p className="text-muted-foreground text-center py-8 w-full">暂无匹配的练习。</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLearningPractices.map((practice) => (
              <Card key={practice.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base line-clamp-2">{practice.title}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant={practice.published ? 'success' : 'secondary'} className="text-[11px]">{practice.published ? '已发布' : '未发布'}</Badge>
                    {Array.isArray(practice.tags) && practice.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[11px]">{tag}</Badge>
                    ))}
                    {practice.dueAt && (() => {
                      const daysLeft = differenceInDays(new Date(practice.dueAt), new Date())
                      if (daysLeft < 0) return <Badge className="bg-red-600 text-white text-[11px] hover:bg-red-700">已过期 {Math.abs(daysLeft)} 天</Badge>
                      if (daysLeft === 0) return <Badge className="bg-orange-500 text-white text-[11px] hover:bg-orange-600">今天截止</Badge>
                      return <Badge className="bg-blue-500 text-white text-[11px] hover:bg-blue-600">剩余 {daysLeft} 天</Badge>
                    })()}
                    {practice.targetUsernames && practice.targetUsernames
                      .split(',').map(s => s.trim()).filter(Boolean)
                      .map((name) => (
                        <Badge key={name} variant="info" className="text-[11px]">{name}</Badge>
                      ))}
                    {!canManageSelectedSpace && practice.assigned && (
                      <Badge variant="info" className="text-[11px]">已分配给我</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardFooter className="mt-auto pt-2 flex flex-wrap gap-2">
                  <Button size="sm" asChild><Link to={`/spaces/${selectedSpace.id}/practices/${practice.id}`}>进入练习</Link></Button>
                  {canManageSelectedSpace && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/spaces/${selectedSpace.id}/practices/${practice.id}/submission-records?returnTo=${encodeURIComponent(`/?spaceId=${selectedSpace.id}&tab=practice`)}&returnLabel=${encodeURIComponent('返回练习列表')}`}>提交记录</Link>
                    </Button>
                  )}
                  {canManageSelectedSpace && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenAssignPracticeTarget(practice.id)}>分配成员</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onOpenEditPractice(practice.id)}>编辑</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExportPractice(practice.id)}>导出</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDeletePractice(practice.id)}>删除</DropdownMenuItem>
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
