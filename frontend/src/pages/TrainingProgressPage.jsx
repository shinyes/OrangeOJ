import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react'

function problemTypeText(type) {
  if (type === 'programming') return '编程'
  if (type === 'single_choice') return '单选'
  if (type === 'true_false') return '判断'
  return type || '?'
}

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) return path
  return fallback
}

export default function TrainingProgressPage() {
  const { spaceId, planId } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const backTo = safeInternalPath(
    searchParams.get('returnTo'),
    `/spaces/${spaceId}/training-plans/${planId}`
  )
  const backLabel = searchParams.get('returnLabel') || '返回训练'

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const result = await api.getTrainingPlanProgress(spaceId, planId)
        setData(result)
      } catch (err) {
        setError(err.message || '加载进度失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [spaceId, planId])

  // Flatten all problems from chapters
  const allProblems = useMemo(() => {
    const result = []
    ;(data?.chapters || []).forEach((chapter) => {
      ;(chapter.items || []).forEach((item) => {
        result.push({
          problemId: item.problemId,
          title: item.title || `#${item.problemId}`,
          type: item.type,
          chapterTitle: chapter.title || `第 ${chapter.orderNo} 章`,
        })
      })
    })
    return result
  }, [data])

  const participants = data?.participants || []

  // Build completion set per user
  const completedSets = useMemo(() => {
    const map = {}
    participants.forEach((p) => {
      map[p.userId] = new Set(p.completedProblemIds || [])
    })
    return map
  }, [participants])

  const countCompleted = (userId) => {
    const set = completedSets[userId]
    if (!set) return 0
    return allProblems.filter((p) => set.has(p.problemId)).length
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中...</div>

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-muted/30">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    )
  }

  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">暂无数据</div>

  const totalProblems = allProblems.length
  const chapters = data?.chapters || []

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-bold">完成进度</h1>
          </div>
          <Button size="sm" variant="outline" className="h-7 md:h-8 text-xs" asChild>
            <Link to={backTo}>{backLabel}</Link>
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto py-4 md:py-6 px-2 md:px-4">
        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
          {participants.map((p) => {
            const done = countCompleted(p.userId)
            const pct = totalProblems > 0 ? Math.round((done / totalProblems) * 100) : 0
            return (
              <Card key={p.userId} className="p-3">
                <p className="text-sm font-medium mb-1 truncate">{p.username}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-emerald-600 tabular-nums">{done}</span>
                  <span className="text-xs text-muted-foreground">/ {totalProblems}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </Card>
            )
          })}
        </div>

        {/* Per-chapter grid */}
        {chapters.map((chapter) => (
          <Card key={chapter.id || `ch-${chapter.orderNo}`} className="mb-3 border">
            <CardContent className="p-0">
              <div className="px-3 md:px-5 py-2 border-b bg-muted/30">
                <h2 className="text-sm font-semibold">{chapter.title || `第 ${chapter.orderNo} 章`}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-12">#</th>
                      <th className="text-left px-1 py-1.5 font-medium text-muted-foreground">题目</th>
                      {participants.map((p) => (
                        <th key={p.userId} className="text-center px-2 py-1.5 font-medium text-muted-foreground w-16">
                          {p.username}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(chapter.items || []).map((item, idx) => {
                      const pid = item.problemId
                      return (
                        <tr key={pid} className="border-b last:border-b-0 hover:bg-muted/10">
                          <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{idx + 1}</td>
                          <td className="px-1 py-1.5 truncate max-w-[200px]">
                            <span className="font-medium">#{pid}</span>
                            <span className="text-muted-foreground ml-1">{item.title || ''}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1 align-middle">{problemTypeText(item.type)}</Badge>
                          </td>
                          {participants.map((p) => {
                            const completed = (completedSets[p.userId] || new Set()).has(pid)
                            return (
                              <td key={p.userId} className="text-center px-2 py-1.5">
                                {completed ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 inline-block" />
                                ) : (
                                  <MinusCircle className="h-4 w-4 text-gray-300 inline-block" />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
