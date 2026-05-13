import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Card, CardContent } from '../ui/card'

export default function LearningPanel({
  selectedSpace, spaces, spaceTab,
  learningProblemSearch, onLearningProblemSearchChange, filteredLearningProblems, problemTypeText,
  learningTrainingSearch, onLearningTrainingSearchChange, canManageSelectedSpace,
  onOpenCreateTrainingPlan, filteredLearningTrainingPlans, onOpenEditTrainingPlan,
  onOpenAssignTrainingParticipant, onDeleteTrainingPlan, onJoinTrainingPlan, trainingActionMessage,
  learningHomeworkSearch, onLearningHomeworkSearchChange, onOpenCreateHomework,
  filteredLearningHomeworks, onOpenEditHomework, onOpenAssignHomeworkTarget,
  onDeleteHomework, homeworkActionMessage
}) {
  if (!selectedSpace) {
    return (
      <div className="border rounded-xl p-6 text-center bg-background">
        <p className="text-muted-foreground">
          {spaces.length === 0 ? '暂无可访问空间，请先创建或加入空间。' : '请选择一个空间。'}
        </p>
      </div>
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
          <div className="flex gap-3 mb-4 flex-wrap">
            <Input placeholder="搜索训练计划标题" value={learningTrainingSearch}
              onChange={(e) => onLearningTrainingSearchChange(e.target.value)} className="min-w-[220px]" />
            {canManageSelectedSpace && <Button onClick={onOpenCreateTrainingPlan}>创建训练计划</Button>}
          </div>

          <div className="flex flex-col gap-2 max-w-3xl mx-auto">
            {filteredLearningTrainingPlans.length === 0 && (
              <p className="text-muted-foreground text-center py-4 w-full">暂无匹配的训练计划。</p>
            )}
            {filteredLearningTrainingPlans.map((plan) => {
              const isPublic = plan.isPublic !== false
              const isJoined = plan.joined === true
              const showEnterTraining = canManageSelectedSpace || isJoined
              const showJoinTraining = !canManageSelectedSpace && !isJoined

              return (
                <div key={plan.id} className="border rounded-lg p-4 w-full bg-background">
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold break-words">{plan.title}</h3>
                      <span className="text-xs text-muted-foreground block">
                        {isPublic ? '公开训练' : '隐藏训练'} | {plan.allowSelfJoin ? '允许自行加入' : '仅管理员分配'} | {plan.published || plan.publishedAt ? '已发布' : '未发布'}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {showEnterTraining && (
                        <Button size="sm" asChild><Link to={`/spaces/${selectedSpace.id}/training-plans/${plan.id}`}>进入训练</Link></Button>
                      )}
                      {showJoinTraining && (
                        <Button size="sm" onClick={() => onJoinTrainingPlan(plan.id)} disabled={!plan.allowSelfJoin}>
                          {plan.allowSelfJoin ? '加入训练' : '需管理员分配'}
                        </Button>
                      )}
                      {canManageSelectedSpace && (
                        <Button size="sm" variant="outline" onClick={() => onOpenAssignTrainingParticipant(plan.id)}>分配用户</Button>
                      )}
                      {canManageSelectedSpace && (
                        <Button size="sm" variant="outline" onClick={() => onOpenEditTrainingPlan(plan.id)}>编辑</Button>
                      )}
                      {canManageSelectedSpace && (
                        <Button size="sm" variant="destructive" onClick={() => onDeleteTrainingPlan(plan.id)}>删除</Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Homework Tab */}
      {spaceTab === 'homework' && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <Input placeholder="搜索作业标题" value={learningHomeworkSearch}
              onChange={(e) => onLearningHomeworkSearchChange(e.target.value)} className="min-w-[220px]" />
            {canManageSelectedSpace && <Button onClick={onOpenCreateHomework}>创建作业</Button>}
          </div>

          <div className="flex flex-col gap-2 max-w-3xl mx-auto">
            {filteredLearningHomeworks.length === 0 && (
              <p className="text-muted-foreground text-center py-4 w-full">暂无匹配的作业。</p>
            )}
            {filteredLearningHomeworks.map((homework) => (
              <div key={homework.id} className="border rounded-lg p-4 w-full bg-background">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold break-words">{homework.title}</h3>
                    <span className="text-xs text-muted-foreground block">
                      {homework.published ? '已发布' : '草稿'}
                      {homework.displayMode === 'list' ? ' | 题单模式' : ' | 试卷模式'}
                      {homework.dueAt ? ` | 截止：${homework.dueAt}` : ' | 未设置截止时间'}
                      {typeof homework.itemCount === 'number' ? ` | ${homework.itemCount} 道题` : ''}
                      {typeof homework.targetCount === 'number' ? ` | ${homework.targetCount} 名目标用户` : ''}
                      {!canManageSelectedSpace && homework.assigned ? ' | 已分配给我' : ''}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" asChild><Link to={`/spaces/${selectedSpace.id}/homeworks/${homework.id}`}>进入作业</Link></Button>
                    {canManageSelectedSpace && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/spaces/${selectedSpace.id}/homeworks/${homework.id}/submission-records?returnTo=${encodeURIComponent(`/?spaceId=${selectedSpace.id}&tab=homework`)}&returnLabel=${encodeURIComponent('返回作业列表')}`}>提交记录</Link>
                      </Button>
                    )}
                    {canManageSelectedSpace && (
                      <Button size="sm" variant="outline" onClick={() => onOpenAssignHomeworkTarget(homework.id)}>分配用户</Button>
                    )}
                    {canManageSelectedSpace && (
                      <Button size="sm" variant="outline" onClick={() => onOpenEditHomework(homework.id)}>编辑</Button>
                    )}
                    {canManageSelectedSpace && (
                      <Button size="sm" variant="destructive" onClick={() => onDeleteHomework(homework.id)}>删除</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
