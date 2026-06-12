import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) return path
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

function recordStatusChipVariant(statusText) {
  if (statusText === '判题中') return 'secondary'
  if (statusText === '全部通过') return 'default'
  if (statusText === '部分提交') return 'secondary'
  return 'outline'
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
    if (isPending || !isWrong) return
    if (item?.problemType === 'programming') { programmingWrongCount += 1; return }
    objectiveWrongCount += 1
  })
  return { objectiveWrongCount, programmingWrongCount }
}

export default function PracticeSubmissionRecordsPage() {
  const { spaceId, practiceId } = useParams()
  const [searchParams] = useSearchParams()
  const [space, setSpace] = useState(null)
  const [practice, setPractice] = useState(null)
  const [records, setRecords] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const defaultBackTo = `/spaces/${spaceId}/practices/${practiceId}`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回练习'

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) return records
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
      if (userId > 0) ids.add(userId)
    })
    return ids.size
  }, [filteredRecords])

  const pendingRecordCount = useMemo(() => {
    return filteredRecords.filter((record) => Number(record?.pendingCount || 0) > 0).length
  }, [filteredRecords])

  const refreshRecords = async () => {
    const result = await api.listPracticeSubmissionRecords(spaceId, practiceId, { all: true })
    setRecords(result?.records || [])
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const spaceData = await api.getSpace(spaceId)
        if (!spaceData?.canManage) throw new Error('当前账号为普通成员，无空间管理权限')
        const [practiceData, recordData] = await Promise.all([
          api.getPractice(spaceId, practiceId),
          api.listPracticeSubmissionRecords(spaceId, practiceId, { all: true })
        ])
        setSpace(spaceData)
        setPractice(practiceData)
        setRecords(recordData?.records || [])
      } catch (err) {
        setError(err.message || '练习提交记录加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, practiceId])

  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>

  if (error && !practice) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
        <Card className="max-w-lg mx-auto mt-8">
          <CardContent className="p-6">
          <div className="flex flex-col gap-3 items-start">
            <h2 className="text-lg font-bold">无法查看练习提交记录</h2>
            <p className="text-sm text-muted-foreground">当前页面仅空间管理员和系统管理员可访问。</p>
            <Button asChild><Link to={backTo}>{backLabel}</Link></Button>
          </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {error && (
        <Alert variant="destructive" className="m-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      )}

      <header className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
          <div className="flex-1 min-w-0 md:min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold">{practice?.title}</h1>
              <Badge variant="outline">全部提交记录</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{space?.name || '当前空间'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 min-w-0 md:min-w-[180px]">
            <Badge variant="outline">{filteredRecords.length}/{records.length} 条记录</Badge>
            <Badge variant="outline">{userCount} 名用户</Badge>
            <Badge variant="outline">待判 {pendingRecordCount} 条</Badge>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => refreshRecords().catch((err) => setError(err.message || '刷新失败'))}>刷新</Button>
            <Button asChild><Link to={backTo}>{backLabel}</Link></Button>
          </div>
        </div>
      </header>

      <div className="p-4">
        <Card>
          <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <Input
              placeholder="筛选用户名或用户ID"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full md:w-[260px]"
            />
            {keyword.trim() && (
              <Button variant="outline" onClick={() => setKeyword('')}>清空筛选</Button>
            )}
          </div>

          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有用户提交整卷记录。</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有匹配当前筛选条件的提交记录。</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredRecords.map((record) => {
                const { objectiveWrongCount, programmingWrongCount } = getRecordWrongCounts(record)
                return (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row justify-between gap-3 items-stretch md:items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <Badge variant={recordStatusChipVariant(record.statusText)}>{record.statusText}</Badge>
                          <Badge variant="outline">用户 {record.username || `#${record.userId}`}</Badge>
                          <Badge variant="outline">提交时间：{formatDateTime(record.createdAt)}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">题目 {record.answeredCount}/{record.practiceItemCount}</Badge>
                          <Badge variant="outline">待判题 {record.pendingCount}</Badge>
                          <Badge variant="outline">客观题错 {objectiveWrongCount} 道</Badge>
                          <Badge variant="outline">编程题错 {programmingWrongCount} 道</Badge>
                        </div>
                      </div>
                      <Button variant="outline" asChild className="shrink-0">
                        <Link to={buildInternalPathWithQuery(`/spaces/${spaceId}/practices/${practiceId}`, {
                          recordId: record.id,
                          returnTo: `/spaces/${spaceId}/practices/${practiceId}/submission-records`,
                          returnLabel: '返回全部记录'
                        })}>
                          查看作答
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
