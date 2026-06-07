import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

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
  const completionText = item?.completed ? '✅ ' : ''
  return `${index + 1}. #${item.problemId} ${completionText}${item.title || `题目 ${item.problemId}`}`
}

export default function TrainingPage({ user }) {
  const { spaceId, planId } = useParams()
  const [searchParams] = useSearchParams()
  const [space, setSpace] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

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
          <Button size="sm" variant="outline" className="h-7 md:h-8 text-xs" asChild><Link to={backTo}>{backLabel}</Link></Button>
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
                        <p className="text-xs md:text-sm text-muted-foreground">共 {chapter.items?.length || 0} 道题目</p>
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
                        {(chapter.items || []).map((item, index) => (
                          <Card key={`${chapter.id || chapter.orderNo}-${item.problemId}-${item.orderNo || index + 1}`} className="transition-all hover:border-primary hover:bg-accent hover:-translate-y-px p-0">
                            <Link
                              to={`/spaces/${spaceId}/problems/${item.problemId}/solve?planId=${planId}&returnTo=${encodeURIComponent(solveReturnTo)}&returnLabel=${solveReturnLabel}`}
                              className="block px-2 md:px-4 py-2 md:py-2.5 no-underline text-foreground"
                              onClick={saveScrollPosition}
                            >
                              <div className="flex justify-between items-center gap-1.5 md:gap-2">
                                <span className="font-medium text-sm md:text-base truncate">{problemTitleWithCompletion(item, index)}</span>
                                <Badge variant="outline" className="shrink-0 text-[10px] md:text-xs">{problemTypeText(item.type)}</Badge>
                              </div>
                            </Link>
                          </Card>
                        ))}
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
