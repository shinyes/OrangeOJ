import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle, CheckCircle2, Users } from 'lucide-react'

function problemTypeText(type) {
  if (type === 'programming') return '编程题'
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type || '未知题型'
}

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) return path
  return fallback
}

function problemTitleWithCompletion(item, index) {
  return `${index + 1}. #${item.problemId} ${item.title || `题目 ${item.problemId}`}`
}

function chapterProgress(chapter) {
  const total = chapter.items?.length || 0
  if (total === 0) return { total: 0, done: 0 }
  const done = chapter.items.filter((item) => item.completed).length
  return { total, done }
}

export default function TrainingPage({ user }) {
  const { spaceId, planId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [space, setSpace] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [viewAsUserId, setViewAsUserId] = useState('')
  const canManageSpace = space?.canManage

  const defaultBackTo = `/?spaceId=${spaceId}&tab=training`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回训练列表'
  const solveReturnTo = safeInternalPath(`/spaces/${spaceId}/training-plans/${planId}`, '/')
  const solveReturnLabel = encodeURIComponent('返回训练')

  const flatProblems = useMemo(() => {
    const result = []
    ;(plan?.chapters || []).forEach((chapter) => {
      ;(chapter.items || []).forEach((item) => {
        result.push({ problemId: item.problemId, title: item.title, type: item.type, completed: item.completed, chapterTitle: chapter.title })
      })
    })
    return result
  }, [plan])

  const totalProblemCount = useMemo(
    () => (plan?.chapters || []).reduce((sum, chapter) => sum + (chapter.items?.length || 0), 0),
    [plan]
  )
  const completedCount = useMemo(() => {
    let count = 0
    ;(plan?.chapters || []).forEach((ch) => (ch.items || []).forEach((item) => { if (item.completed) count++ }))
    return count
  }, [plan])
  const myParticipant = useMemo(
    () => (plan?.participants || []).find((participant) => Number(participant.userId) === Number(user?.id)) || null,
    [plan, user]
  )
  const loadData = async () => {
    const [spaceData, planData] = await Promise.all([
      api.getSpace(spaceId),
      api.getTrainingPlan(spaceId, planId, viewAsUserId ? { viewAs: viewAsUserId } : undefined)
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
  }, [spaceId, planId, viewAsUserId])

  // Auto-redirect to first problem
  useEffect(() => {
    if (loading || !plan) return
    const firstProblem = flatProblems[0]
    if (firstProblem) {
      navigate(`/spaces/${spaceId}/problems/${firstProblem.problemId}/solve?planId=${planId}&returnTo=${encodeURIComponent(solveReturnTo)}&returnLabel=${solveReturnLabel}`, { replace: true })
    }
  }, [loading, plan, flatProblems, spaceId, planId, navigate, solveReturnTo, solveReturnLabel])

  const scrollKey = `scroll-/spaces/${spaceId}/training-plans/${planId}`

  const saveScrollPosition = () => {
    sessionStorage.setItem(scrollKey, String(window.scrollY))
  }

  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(scrollKey)
    if (saved) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(saved, 10))
        })
      })
    }
  }, [loading, scrollKey])

  if (loading) return <div className="min-h-screen flex items-center justify-center">训练加载中...</div>

  if (error && !plan) {
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

  if (!plan) return <div className="min-h-screen flex items-center justify-center">训练不存在</div>

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 md:gap-2 flex-wrap">
              <h1 className="text-base md:text-lg font-bold">{plan.title}</h1>
              <span className="text-xs md:text-sm text-muted-foreground">
                {space?.name ? `空间：${space.name}` : `空间 #${spaceId}`} | 共 {plan.chapters?.length || 0} 个章节，{totalProblemCount} 道题目
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canManageSpace && (
              <Button size="sm" variant="outline" className="h-7 text-xs" asChild
                onClick={saveScrollPosition}>
                <Link to={`/spaces/${spaceId}/training-plans/${planId}/progress?returnTo=${encodeURIComponent(`/spaces/${spaceId}/training-plans/${planId}`)}&returnLabel=${encodeURIComponent('返回训练')}`}>
                  <Users className="h-3 w-3 mr-1" />进度
                </Link>
              </Button>
            )}
            {canManageSpace && (plan?.participants || []).length > 0 && (
              <>
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={viewAsUserId || '__self__'} onValueChange={(v) => setViewAsUserId(v === '__self__' ? '' : v)}>
                  <SelectTrigger className="w-[140px] h-7 text-xs">
                    <SelectValue placeholder="我的进度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__self__">我的进度</SelectItem>
                    {(plan?.participants || []).map((p) => (
                      <SelectItem key={p.userId} value={String(p.userId)}>{p.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <Button size="sm" variant="outline" className="h-7 md:h-8 text-xs" asChild><Link to={backTo}>{backLabel}</Link></Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto py-4 md:py-6 px-2 md:px-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {actionMessage && (
          <Alert variant="success" className="mb-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{actionMessage}</AlertDescription>
          </Alert>
        )}

        {(plan.chapters || []).length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            当前训练暂未配置章节。
          </CardContent></Card>
        ) : (
          <div className="flex flex-col gap-3">
            {(plan.chapters || []).map((chapter) => (
              <Card key={chapter.id || `${plan.id}-${chapter.orderNo}`} className="border">
                <CardContent className="p-0">
                  <div className="px-3 md:px-6 py-2 md:py-4">
                    <div className="flex justify-between items-start gap-2 md:gap-4 flex-wrap">
                      <div>
                        <h2 className="text-base md:text-lg font-semibold">{chapter.title || `第 ${chapter.orderNo} 章`}</h2>
                        {(() => { const p = chapterProgress(chapter); return (
                          <p className="text-xs md:text-sm">
                            <span className="text-muted-foreground">共 {p.total} 道题目</span>
                            {p.done > 0 && <span className="text-emerald-600 ml-2 font-medium">{p.done} 道已完成</span>}
                          </p>
                        )})()}
                      </div>
                      <Badge variant="outline" className="text-[10px] md:text-xs">第 {chapter.orderNo} 章</Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="p-2 md:p-4">
                    {(chapter.items || []).length === 0 ? (
                      <p className="text-xs md:text-sm text-muted-foreground">当前章节暂无题目。</p>
                    ) : (
                      <div className="flex flex-col gap-1 md:gap-1.5">
                        {(chapter.items || []).map((item, index) => {
                          const isDone = item.completed
                          return (
                          <Card key={`${chapter.id || chapter.orderNo}-${item.problemId}-${item.orderNo || index + 1}`}
                            className={`transition-all hover:-translate-y-px p-0 border ${isDone ? 'border-emerald-400 bg-emerald-50/50 hover:border-emerald-500' : 'hover:border-primary hover:bg-accent'}`}>
                            <Link
                              to={`/spaces/${spaceId}/problems/${item.problemId}/solve?planId=${planId}&returnTo=${encodeURIComponent(solveReturnTo)}&returnLabel=${solveReturnLabel}`}
                              className="block px-2 md:px-4 py-2 md:py-2.5 no-underline text-foreground"
                              onClick={saveScrollPosition}
                            >
                              <div className="flex justify-between items-center gap-1.5 md:gap-2">
                                <span className="font-medium text-sm md:text-base truncate flex items-center gap-1.5">
                                  {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                                  {problemTitleWithCompletion(item, index)}
                                </span>
                                <Badge variant="outline" className="shrink-0 text-[10px] md:text-xs">{problemTypeText(item.type)}</Badge>
                              </div>
                            </Link>
                          </Card>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
