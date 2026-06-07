import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle } from 'lucide-react'

function safeInternalPath(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/')) return path
  return fallback
}

export default function TrainingPage({ user }) {
  const { spaceId, planId } = useParams()
  const [searchParams] = useSearchParams()
  const [space, setSpace] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const defaultBackTo = `/?spaceId=${spaceId}&tab=training`
  const backTo = safeInternalPath(searchParams.get('returnTo'), defaultBackTo)
  const backLabel = searchParams.get('returnLabel') || '返回训练列表'

  const flatProblems = useMemo(() => {
    const result = []
    ;(plan?.chapters || []).forEach((chapter) => {
      ;(chapter.items || []).forEach((item) => {
        result.push({ problemId: item.problemId, title: item.title, type: item.type, completed: item.completed })
      })
    })
    return result
  }, [plan])

  const canManageSpace = space?.canManage

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

  const firstProblem = flatProblems[0]
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 gap-4">
      <h1 className="text-xl font-bold">{plan.title}</h1>
      <p className="text-sm text-muted-foreground">共 {plan.chapters?.length || 0} 个章节，{flatProblems.length} 道题目</p>
      {firstProblem ? (
        <Button asChild>
          <Link to={`/spaces/${spaceId}/problems/${firstProblem.problemId}/solve?planId=${planId}&returnTo=${encodeURIComponent(`/spaces/${spaceId}/training-plans/${planId}`)}&returnLabel=${encodeURIComponent('返回训练')}`}>开始做题</Link>
        </Button>
      ) : (
        <p className="text-muted-foreground">训练中没有题目</p>
      )}
      <div className="flex gap-2 mt-2">
        {canManageSpace && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/spaces/${spaceId}/training-plans/${planId}/progress?returnTo=${encodeURIComponent(backTo)}&returnLabel=${encodeURIComponent(backLabel)}`}>查看进度</Link>
          </Button>
        )}
        <Button variant="outline" size="sm" asChild><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    </div>
  )
}
