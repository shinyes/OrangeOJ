import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default function LoginPage({ onLogin, user }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [loadingRegistrationStatus, setLoadingRegistrationStatus] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const result = await api.registrationStatus()
        if (active) setRegistrationEnabled(Boolean(result?.enabled))
      } catch {
        if (active) setRegistrationEnabled(false)
      } finally {
        if (active) setLoadingRegistrationStatus(false)
      }
    })()
    return () => { active = false }
  }, [])

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onLogin({ username, password })
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold">🍊 OrangeOJ</h1>
        <p className="text-sm text-muted-foreground mb-6">简洁高效的在线判题与教学平台</p>

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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? '登录中...' : '登录'}
              </Button>

              {loadingRegistrationStatus ? (
                <p className="text-sm text-muted-foreground text-center">注册状态加载中...</p>
              ) : registrationEnabled ? (
                <p className="text-sm text-center">
                  没有账号？{' '}
                  <Link to="/register" className="text-primary hover:underline">去注册</Link>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground text-center">当前未开放注册，请联系管理员。</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
