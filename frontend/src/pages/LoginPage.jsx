import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'

export default function LoginPage({ onLogin, user }) {
  const [username, setUsername] = useState('admin')
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
        if (active) {
          setRegistrationEnabled(Boolean(result?.enabled))
        }
      } catch {
        if (active) {
          setRegistrationEnabled(false)
        }
      } finally {
        if (active) {
          setLoadingRegistrationStatus(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [])

  if (user) {
    return <Navigate to="/" replace />
  }

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
    <div className="auth-wrap">
      <div className="auth-panel">
        <h1 className="auth-title">OrangeOJ</h1>
        <p className="auth-subtitle">简洁高效的在线判题与教学平台</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            用户名
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="auth-footer">
          {loadingRegistrationStatus ? (
            <span className="muted">注册状态加载中...</span>
          ) : registrationEnabled ? (
            <span>
              没有账号？
              <Link to="/register">去注册</Link>
            </span>
          ) : (
            <span className="muted">当前未开放注册，请联系管理员。</span>
          )}
        </div>
      </div>
    </div>
  )
}
