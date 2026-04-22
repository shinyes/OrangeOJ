import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import ToastMessage from '../components/ToastMessage'

function problemTypeText(type) {
  if (type === 'programming') return '编程题'
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type || '未知题型'
}

function joinedByText(joinedBy) {
  if (joinedBy === 'self') return '自主加入'
  if (joinedBy === 'admin') return '管理员分配'
  return joinedBy || '未知来源'
}

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) {
    return path
  }
  return fallback
}

export default function TrainingPage({ user, onLogout }) {
  const { spaceId, planId } = useParams()
  const [searchParams] = useSearchParams()
  const [space, setSpace] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [joining, setJoining] = useState(false)

  const defaultBackTo = `/?spaceId=${spaceId}&tab=training`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回训练列表'
  const solveReturnTo = safeInternalPath(`/spaces/${spaceId}/training-plans/${planId}`, '/')
  const solveReturnLabel = encodeURIComponent('返回训练')

  const totalProblemCount = useMemo(
    () => (plan?.chapters || []).reduce((sum, chapter) => sum + (chapter.items?.length || 0), 0),
    [plan]
  )
  const isPublic = plan?.isPublic !== false
  const myParticipant = useMemo(
    () => (plan?.participants || []).find((participant) => Number(participant.userId) === Number(user?.id)) || null,
    [plan, user]
  )

  const loadData = async () => {
    const [spaceData, planData] = await Promise.all([
      api.getSpace(spaceId),
      api.getTrainingPlan(spaceId, planId)
    ])
    setSpace(spaceData)
    setPlan(planData)
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        await loadData()
      } catch (err) {
        setError(err.message || '训练加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, planId])

  const handleJoin = async () => {
    try {
      setJoining(true)
      setError('')
      setActionMessage('')
      await api.joinTrainingPlan(spaceId, planId)
      await loadData()
      setActionMessage('已加入训练')
    } catch (err) {
      setError(err.message || '加入训练失败')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return <div className="screen-center">训练加载中...</div>
  }

  if (error && !plan) {
    return (
      <div className="page-shell">
        <div className="error-box">{error}</div>
        <Link className="ghost-btn" to={backTo}>{backLabel}</Link>
      </div>
    )
  }

  if (!plan) {
    return <div className="screen-center">训练不存在</div>
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {plan.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {space?.name ? `空间：${space.name}` : `空间 #${spaceId}`} | 共 {plan.chapters?.length || 0} 个章节，{totalProblemCount} 道题目
            </Typography>
          </Box>
          <Button color="inherit" component={Link} to={backTo}>
            {backLabel}
          </Button>
          <Button color="inherit" onClick={onLogout}>
            退出登录
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
        {actionMessage && <ToastMessage message={actionMessage} severity="success" onShown={() => setActionMessage('')} />}

        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                训练概览
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip size="small" label={isPublic ? '公开训练' : '隐藏训练'} color={isPublic ? 'info' : 'default'} />
                <Chip size="small" label={plan.allowSelfJoin ? '允许自主加入' : '仅管理员分配'} color={plan.allowSelfJoin ? 'success' : 'default'} />
                <Chip size="small" label={plan.published || plan.publishedAt ? '已发布' : '未发布'} color={plan.published || plan.publishedAt ? 'primary' : 'default'} />
                <Chip size="small" label={`参与成员 ${plan.participants?.length || 0} 人`} />
                {myParticipant && (
                  <Chip
                    size="small"
                    color="warning"
                    label={`我的状态：已加入（${joinedByText(myParticipant.joinedBy)}）`}
                  />
                )}
              </Stack>
            </Box>

            {!myParticipant && (
              <Button
                variant="contained"
                disabled={!plan.allowSelfJoin || joining}
                onClick={handleJoin}
              >
                {!plan.allowSelfJoin ? '需管理员分配' : joining ? '加入中...' : '加入训练'}
              </Button>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            参与成员
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(plan.participants || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                当前还没有参与成员。
              </Typography>
            ) : (
              plan.participants.map((participant) => (
                <Chip
                  key={`${plan.id}-${participant.userId}`}
                  size="small"
                  label={`#${participant.userId} ${participant.username}（${joinedByText(participant.joinedBy)}）`}
                />
              ))
            )}
          </Box>
        </Paper>

        {(plan.chapters || []).length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">当前训练暂未配置章节。</Typography>
          </Paper>
        ) : (
          <Stack spacing={2.5}>
            {(plan.chapters || []).map((chapter) => (
              <Card key={chapter.id || `${plan.id}-${chapter.orderNo}`} variant="outlined">
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 2.5, py: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 600 }}>
                          {chapter.title || `第 ${chapter.orderNo} 章`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          共 {chapter.items?.length || 0} 道题目
                        </Typography>
                      </Box>
                      <Chip size="small" label={`第 ${chapter.orderNo} 章`} />
                    </Stack>
                  </Box>

                  <Divider />

                  <Box sx={{ p: 2 }}>
                    {(chapter.items || []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        当前章节暂无题目。
                      </Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {(chapter.items || []).map((item, index) => (
                          <Paper
                            key={`${chapter.id || chapter.orderNo}-${item.problemId}-${item.orderNo || index + 1}`}
                            component={Link}
                            to={`/spaces/${spaceId}/problems/${item.problemId}/solve?returnTo=${encodeURIComponent(solveReturnTo)}&returnLabel=${solveReturnLabel}`}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              textDecoration: 'none',
                              color: 'text.primary',
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'action.hover',
                                transform: 'translateY(-1px)'
                              }
                            }}
                          >
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                  {index + 1}. #{item.problemId} {item.title || `题目 ${item.problemId}`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  点击进入做题页
                                </Typography>
                              </Box>
                              <Chip size="small" label={problemTypeText(item.type)} />
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  )
}
