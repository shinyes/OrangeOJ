import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'

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
  planTitle,
  onPlanTitleChange,
  canManageSelectedSpace,
  onCreateTrainingPlan,
  filteredLearningTrainingPlans,
  onJoinTrainingPlan,
  learningHomeworkSearch,
  onLearningHomeworkSearchChange,
  homeworkTitle,
  onHomeworkTitleChange,
  onCreateHomework,
  filteredLearningHomeworks,
  homeworkDetails,
  expandedHomeworkId,
  onToggleHomeworkDetail,
  homeworkTargetInputs,
  onHomeworkTargetInputChange,
  homeworkTargetSubmittingId,
  onAddHomeworkTarget,
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
              placeholder="搜索题目（ID/标题）"
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
                    <Typography
                      variant="body1"
                      sx={{
                        flex: 1,
                        fontWeight: 500,
                        color: 'text.primary',
                        fontSize: '14px'
                      }}
                    >
                      {problem.title}
                    </Typography>
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
              sx={{ minWidth: 200 }}
            />
            {canManageSelectedSpace && (
              <>
                <TextField
                  size="small"
                  placeholder="训练计划标题"
                  value={planTitle}
                  onChange={(event) => onPlanTitleChange(event.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <Button variant="contained" onClick={onCreateTrainingPlan}>创建训练计划</Button>
              </>
            )}
          </Box>
          {filteredLearningTrainingPlans.length === 0 && (
            <Typography color="text.secondary">没有匹配的训练计划。</Typography>
          )}
          {filteredLearningTrainingPlans.map((plan) => (
            <Box
              key={plan.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                borderBottom: '1px solid divider'
              }}
            >
              <Box>
                <Typography variant="subtitle2">{plan.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {plan.allowSelfJoin ? '允许主动参加' : '仅管理员分配'}
                </Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => onJoinTrainingPlan(plan.id)}>
                参加
              </Button>
            </Box>
          ))}
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
              sx={{ minWidth: 200 }}
            />
            {canManageSelectedSpace && (
              <>
                <TextField
                  size="small"
                  placeholder="作业标题"
                  value={homeworkTitle}
                  onChange={(event) => onHomeworkTitleChange(event.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <Button variant="contained" onClick={onCreateHomework}>创建作业</Button>
              </>
            )}
          </Box>
          {filteredLearningHomeworks.length === 0 && (
            <Typography color="text.secondary">没有匹配的作业。</Typography>
          )}
          {filteredLearningHomeworks.map((hw) => {
            const detail = homeworkDetails[hw.id]
            const expanded = expandedHomeworkId === hw.id
            return (
              <Box
                key={hw.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  p: 2,
                  borderBottom: '1px solid divider'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle2">{hw.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hw.published ? '已发布' : '草稿'}{' '}
                      {hw.dueAt ? `| 截止：${hw.dueAt}` : ''}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => onToggleHomeworkDetail(hw.id)}>
                    {expanded ? '收起详情' : '查看详情'}
                  </Button>
                </Box>

                {expanded && (
                  <Box sx={{ mt: 2 }}>
                    {!detail ? (
                      <Typography color="text.secondary">作业详情加载中...</Typography>
                    ) : (
                      <>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          题目数：{detail.items?.length || 0} | 目标用户数：{detail.targets?.length || 0}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                          {(detail.targets || []).length === 0 ? (
                            <Typography variant="caption" color="text.secondary">暂无目标用户</Typography>
                          ) : (
                            detail.targets.map((target) => (
                              <Chip
                                key={target.userId}
                                label={`#${target.userId} ${target.username}`}
                                size="small"
                              />
                            ))
                          )}
                        </Box>

                        {canManageSelectedSpace && (
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ min: 1 }}
                              placeholder="输入用户 ID 分配作业"
                              value={homeworkTargetInputs[hw.id] || ''}
                              onChange={(event) => onHomeworkTargetInputChange(hw.id, event.target.value)}
                              sx={{ minWidth: 200 }}
                            />
                            <Button
                              size="small"
                              variant="contained"
                              disabled={homeworkTargetSubmittingId === hw.id}
                              onClick={() => onAddHomeworkTarget(hw.id)}
                            >
                              {homeworkTargetSubmittingId === hw.id ? '分配中...' : '添加目标用户'}
                            </Button>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                )}
              </Box>
            )
          })}
          {homeworkActionMessage && (
            <Alert severity="success" sx={{ mt: 2 }}>{homeworkActionMessage}</Alert>
          )}
        </div>
      )}
    </main>
  )
}
