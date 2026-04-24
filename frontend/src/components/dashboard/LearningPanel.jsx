import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ToastMessage from '../ToastMessage'

export default function LearningPanel({
  selectedSpace,
  spaces,
  spaceTab,
  learningProblemSearch,
  onLearningProblemSearchChange,
  filteredLearningProblems,
  problemTypeText,
  learningTrainingSearch,
  onLearningTrainingSearchChange,
  canManageSelectedSpace,
  onOpenCreateTrainingPlan,
  filteredLearningTrainingPlans,
  onOpenEditTrainingPlan,
  onOpenAssignTrainingParticipant,
  onDeleteTrainingPlan,
  onJoinTrainingPlan,
  trainingActionMessage,
  learningHomeworkSearch,
  onLearningHomeworkSearchChange,
  onOpenCreateHomework,
  filteredLearningHomeworks,
  onOpenEditHomework,
  onOpenAssignHomeworkTarget,
  onDeleteHomework,
  homeworkActionMessage
}) {
  if (!selectedSpace) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {spaces.length === 0 ? '暂无可访问空间，请先创建或加入空间。' : '请选择一个空间。'}
        </Typography>
      </Paper>
    )
  }

  return (
    <main className="panel">
      {spaceTab === 'problems' && (
        <div className="tab-body">
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              size="small"
              placeholder="搜索题目（ID/标题/标签）"
              value={learningProblemSearch}
              onChange={(event) => onLearningProblemSearchChange(event.target.value)}
              sx={{ width: 180 }}
            />
          </Box>
          <Stack spacing={1.5} sx={{ mt: 2, alignItems: 'center' }}>
            {filteredLearningProblems.length === 0 && (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography color="text.secondary">没有匹配题目</Typography>
              </Paper>
            )}
            {filteredLearningProblems.map((problem) => (
              <Card
                key={problem.id}
                component={Link}
                to={`/spaces/${selectedSpace.id}/problems/${problem.id}/solve`}
                sx={{
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 4,
                    borderColor: 'primary.main',
                    transform: 'translateY(-3px)'
                  },
                  width: '100%',
                  maxWidth: '900px'
                }}
              >
                <CardContent sx={{ py: '8px !important', px: '12px !important' }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: '600',
                        width: '50px',
                        color: 'primary.main',
                        fontSize: '14px'
                      }}
                    >
                      #{problem.id}
                    </Typography>
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        overflow: 'hidden',
                        flexWrap: 'nowrap'
                      }}
                    >
                      <Typography
                        variant="body1"
                        noWrap
                        sx={{
                          fontWeight: 500,
                          color: 'text.primary',
                          fontSize: '14px',
                          minWidth: 0
                        }}
                      >
                        {problem.title}
                      </Typography>
                      {(problem.tags || []).length > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            flexWrap: 'nowrap',
                            overflow: 'hidden',
                            flexShrink: 1
                          }}
                        >
                          {problem.tags.map((tag) => (
                            <Chip
                              key={`${problem.id}-${tag}`}
                              label={tag}
                              size="small"
                              variant="outlined"
                              sx={{ height: '22px', fontSize: '11px', flexShrink: 0 }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                    <Chip
                      label={problemTypeText(problem.type)}
                      size="small"
                      sx={{
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        fontWeight: 500,
                        height: '26px',
                        fontSize: '12px'
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </div>
      )}

      {spaceTab === 'training' && (
        <div className="tab-body">
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="搜索训练计划标题"
              value={learningTrainingSearch}
              onChange={(event) => onLearningTrainingSearchChange(event.target.value)}
              sx={{ minWidth: 220 }}
            />
            {canManageSelectedSpace && (
              <Button variant="contained" onClick={onOpenCreateTrainingPlan}>
                创建训练计划
              </Button>
            )}
          </Box>

          {filteredLearningTrainingPlans.length === 0 && (
            <Typography color="text.secondary">暂无匹配的训练计划。</Typography>
          )}

          {filteredLearningTrainingPlans.map((plan) => {
            const isPublic = plan.isPublic !== false
            const isJoined = plan.joined === true
            const showEnterTraining = canManageSelectedSpace || isJoined
            const showJoinTraining = !canManageSelectedSpace && !isJoined

            return (
              <Paper key={plan.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="subtitle2">{plan.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isPublic ? '公开训练' : '隐藏训练'} | {plan.allowSelfJoin ? '允许自行加入' : '仅管理员分配'} | {plan.published || plan.publishedAt ? '已发布' : '未发布'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {showEnterTraining && (
                      <Button
                        size="small"
                        component={Link}
                        to={`/spaces/${selectedSpace.id}/training-plans/${plan.id}`}
                        variant="contained"
                      >
                        进入训练
                      </Button>
                    )}
                    {showJoinTraining && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => onJoinTrainingPlan(plan.id)}
                        disabled={!plan.allowSelfJoin}
                      >
                        {plan.allowSelfJoin ? '加入训练' : '需管理员分配'}
                      </Button>
                    )}
                    {canManageSelectedSpace && (
                      <Button size="small" variant="outlined" onClick={() => onOpenAssignTrainingParticipant(plan.id)}>
                        分配用户
                      </Button>
                    )}
                    {canManageSelectedSpace && (
                      <Button size="small" variant="outlined" onClick={() => onOpenEditTrainingPlan(plan.id)}>
                        编辑
                      </Button>
                    )}
                    {canManageSelectedSpace && (
                      <Button size="small" color="error" variant="outlined" onClick={() => onDeleteTrainingPlan(plan.id)}>
                        删除
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>
            )
          })}

          {trainingActionMessage && <ToastMessage message={trainingActionMessage} severity="success" />}
        </div>
      )}

      {spaceTab === 'homework' && (
        <div className="tab-body">
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="搜索作业标题"
              value={learningHomeworkSearch}
              onChange={(event) => onLearningHomeworkSearchChange(event.target.value)}
              sx={{ minWidth: 220 }}
            />
            {canManageSelectedSpace && (
              <Button variant="contained" onClick={onOpenCreateHomework}>
                创建作业
              </Button>
            )}
          </Box>

          {filteredLearningHomeworks.length === 0 && (
            <Typography color="text.secondary">暂无匹配的作业。</Typography>
          )}

          {filteredLearningHomeworks.map((homework) => (
            <Paper key={homework.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="subtitle2">{homework.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {homework.published ? '已发布' : '草稿'}
                    {homework.displayMode === 'list' ? ' | 题单模式' : ' | 试卷模式'}
                    {homework.dueAt ? ` | 截止：${homework.dueAt}` : ' | 未设置截止时间'}
                    {typeof homework.itemCount === 'number' ? ` | ${homework.itemCount} 道题` : ''}
                    {typeof homework.targetCount === 'number' ? ` | ${homework.targetCount} 名目标用户` : ''}
                    {!canManageSelectedSpace && homework.assigned ? ' | 已分配给我' : ''}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="contained"
                    component={Link}
                    to={`/spaces/${selectedSpace.id}/homeworks/${homework.id}`}
                  >
                    进入作业
                  </Button>
                  {canManageSelectedSpace && (
                    <Button
                      size="small"
                      variant="outlined"
                      component={Link}
                      to={`/spaces/${selectedSpace.id}/homeworks/${homework.id}/submission-records?returnTo=${encodeURIComponent(`/?spaceId=${selectedSpace.id}&tab=homework`)}&returnLabel=${encodeURIComponent('返回作业列表')}`}
                    >
                      提交记录
                    </Button>
                  )}
                  {canManageSelectedSpace && (
                    <Button size="small" variant="outlined" onClick={() => onOpenAssignHomeworkTarget(homework.id)}>
                      分配用户
                    </Button>
                  )}
                  {canManageSelectedSpace && (
                    <Button size="small" variant="outlined" onClick={() => onOpenEditHomework(homework.id)}>
                      编辑
                    </Button>
                  )}
                  {canManageSelectedSpace && (
                    <Button size="small" color="error" variant="outlined" onClick={() => onDeleteHomework(homework.id)}>
                      删除
                    </Button>
                  )}
                </Box>
              </Box>
            </Paper>
          ))}

          {homeworkActionMessage && <ToastMessage message={homeworkActionMessage} severity="success" />}
        </div>
      )}
    </main>
  )
}
