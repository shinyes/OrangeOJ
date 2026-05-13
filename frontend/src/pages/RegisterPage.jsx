import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export default function RegisterPage({ user }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const status = await api.registrationStatus()
        if (active) setEnabled(Boolean(status?.enabled))
      } catch (err) {
        if (active) {
          setError(err.message || '无法获取注册状态')
          setEnabled(false)
        }
      } finally {
        if (active) setLoadingStatus(false)
      }
    })()
    return () => { active = false }
  }, [])

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      setError('用户名不能为空')
      return
    }
    if (password.length < 6) {
      setError('密码至少需要 6 位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    try {
      await api.register({ username: trimmedUsername, password })
      setSuccess('注册成功，正在跳转到登录页...')
      setTimeout(() => navigate('/login'), 800)
    } catch (err) {
      setError(err.message || '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold mb-2">🍊 OrangeOJ</h1>
          <Card className="w-full">
            <CardContent className="pt-6 text-center">
              <p className="mb-4">当前未开放注册，请联系管理员开启后再试。</p>
              <Button variant="outline" asChild>
                <Link to="/login">返回登录</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold">🍊 OrangeOJ</h1>
        <p className="text-sm text-muted-foreground mb-6">创建账号后即可进入系统。</p>

        <Card className="w-full">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                required
                id="username"
                placeholder="用户名"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                required
                name="password"
                placeholder="密码"
                type="password"
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                required
                name="confirmPassword"
                placeholder="确认密码"
                type="password"
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? '提交中...' : '注册'}
              </Button>

              <p className="text-sm text-center">
                已有账号？{' '}
                <Link to="/login" className="text-primary hover:underline">返回登录</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
