import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import ToastMessage from '../components/ToastMessage'

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) {
    return path
  }
  return fallback
}

function buildInternalPathWithQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const queryText = query.toString()
  return queryText ? `${path}?${queryText}` : path
}

function formatDateTime(value) {
  if (!value) return '未设置'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未设置'
  return date.toLocaleString()
}

function problemTypeText(type) {
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  if (type === 'programming') return '编程题'
  return type || '未知题型'
}

function recordStatusChipColor(statusText) {
  if (statusText === '判题中') return 'warning'
  if (statusText === '全部通过') return 'success'
  if (statusText === '部分提交') return 'info'
  return 'default'
}

function getRecordWrongCounts(record) {
  const items = Array.isArray(record?.items) ? record.items : []
  let objectiveWrongCount = 0
  let programmingWrongCount = 0

  items.forEach((item) => {
    const status = String(item?.status || '').trim()
    const verdict = String(item?.verdict || '').trim()
    const isPending = status && status !== 'done' && status !== 'failed'
    const isWrong = status === 'failed' || (status === 'done' && verdict && verdict !== 'AC' && verdict !== 'OK')
    if (isPending || !isWrong) {
      return
    }
    if (item?.problemType === 'programming') {
      programmingWrongCount += 1
      return
    }
    objectiveWrongCount += 1
  })

  return { objectiveWrongCount, programmingWrongCount }
}

export default function HomeworkSubmissionRecordsPage() {
  const { spaceId, homeworkId } = useParams()
  const [searchParams] = useSearchParams()
  const [space, setSpace] = useState(null)
  const [homework, setHomework] = useState(null)
  const [records, setRecords] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const defaultBackTo = `/spaces/${spaceId}/homeworks/${homeworkId}`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回作业'

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) {
      return records
    }
    return records.filter((record) => {
      const username = String(record?.username || '').trim().toLowerCase()
      const userId = String(record?.userId || '').trim()
      return username.includes(normalizedKeyword) || userId.includes(normalizedKeyword)
    })
  }, [keyword, records])

  const userCount = useMemo(() => {
    const ids = new Set()
    filteredRecords.forEach((record) => {
      const userId = Number(record?.userId)
      if (userId > 0) {
        ids.add(userId)
      }
    })
    return ids.size
  }, [filteredRecords])

  const pendingRecordCount = useMemo(() => {
    return filteredRecords.filter((record) => Number(record?.pendingCount || 0) > 0).length
  }, [filteredRecords])

  const refreshRecords = async () => {
    const result = await api.listHomeworkSubmissionRecords(spaceId, homeworkId, { all: true })
    setRecords(result?.records || [])
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')

        const spaceData = await api.getSpace(spaceId)
        if (!spaceData?.canManage) {
          throw new Error('当前账号为普通成员，无空间管理权限')
        }

        const [homeworkData, recordData] = await Promise.all([
          api.getHomework(spaceId, homeworkId),
          api.listHomeworkSubmissionRecords(spaceId, homeworkId, { all: true })
        ])

        setSpace(spaceData)
        setHomework(homeworkData)
        setRecords(recordData?.records || [])
      } catch (err) {
        setError(err.message || '作业提交记录加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, homeworkId])

  if (loading) {
    return <div className="screen-center">加载中...</div>
  }

  if (error && !homework) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#eef2f7', p: 2 }}>
        <ToastMessage message={error} severity="error" onShown={() => setError('')} />
        <Paper sx={{ maxWidth: 560, mx: 'auto', mt: 6, p: 3, borderRadius: 3 }}>
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              无法查看作业提交记录
            </Typography>
            <Typography variant="body2" color="text.secondary">
              当前页面仅空间管理员和系统管理员可访问。
            </Typography>
            <Button variant="contained" component={Link} to={backTo}>
              {backLabel}
            </Button>
          </Stack>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#eef2f7' }}>
      {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}

      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar
          sx={{
            minHeight: '56px !important',
            px: { xs: 1.5, md: 2.5 },
            py: 0.5,
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 220 }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                {homework?.title}
              </Typography>
              <Chip size="small" variant="outlined" label="全部提交记录" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {space?.name || '当前空间'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ minWidth: 180 }}>
            <Chip size="small" variant="outlined" label={`${filteredRecords.length}/${records.length} 条记录`} />
            <Chip size="small" variant="outlined" label={`${userCount} 名用户`} />
            <Chip size="small" variant="outlined" label={`待判 ${pendingRecordCount} 条`} />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Button variant="outlined" onClick={() => refreshRecords().catch((err) => setError(err.message || '刷新失败'))}>
              刷新
            </Button>
            <Button variant="contained" component={Link} to={backTo}>
              {backLabel}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="筛选用户名或用户ID"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              sx={{ width: { xs: '100%', md: 260 } }}
            />
            {keyword.trim() ? (
              <Button variant="outlined" onClick={() => setKeyword('')} sx={{ alignSelf: { xs: 'stretch', md: 'center' } }}>
                清空筛选
              </Button>
            ) : null}
          </Stack>

          {records.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              还没有用户提交整卷记录。
            </Typography>
          ) : filteredRecords.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              没有匹配当前筛选条件的提交记录。
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {filteredRecords.map((record) => {
                const { objectiveWrongCount, programmingWrongCount } = getRecordWrongCounts(record)
                return (
                  <Paper key={record.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'stretch', md: 'flex-start' }}
                      gap={1.5}
                    >
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                          <Chip size="small" color={recordStatusChipColor(record.statusText)} label={record.statusText} />
                          <Chip size="small" variant="outlined" label={`用户 ${record.username || `#${record.userId}`}`} />
                          <Chip size="small" variant="outlined" label={`提交时间：${formatDateTime(record.createdAt)}`} />
                        </Stack>

                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                          <Chip size="small" variant="outlined" label={`题目 ${record.answeredCount}/${record.homeworkItemCount}`} />
                          <Chip size="small" variant="outlined" label={`待判题 ${record.pendingCount}`} />
                          <Chip size="small" variant="outlined" label={`客观错 ${objectiveWrongCount} 道`} />
                          <Chip size="small" variant="outlined" label={`编程错 ${programmingWrongCount} 道`} />
                        </Stack>
                      </Box>

                      <Button
                        variant="outlined"
                        component={Link}
                        to={buildInternalPathWithQuery(`/spaces/${spaceId}/homeworks/${homeworkId}`, {
                          recordId: record.id,
                          returnTo: `/spaces/${spaceId}/homeworks/${homeworkId}/submission-records`,
                          returnLabel: '返回全部记录'
                        })}
                      >
                        查看作答
                      </Button>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
