import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'

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
        if (active) {
          setEnabled(Boolean(status?.enabled))
        }
      } catch (err) {
        if (active) {
          setError(err.message || '无法获取注册状态')
          setEnabled(false)
        }
      } finally {
        if (active) {
          setLoadingStatus(false)
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
    return <div className="screen-center">加载中...</div>
  }

  if (!enabled) {
    return (
      <div className="auth-wrap">
        <div className="auth-panel">
          <h1 className="auth-title">OrangeOJ</h1>
          <p className="auth-subtitle">当前未开放注册，请联系管理员开启后再试。</p>
          <Link className="ghost-btn" to="/login">返回登录</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <h1 className="auth-title">OrangeOJ</h1>
        <p className="auth-subtitle">创建账号后即可进入系统。</p>

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
              placeholder="至少 6 位"
              autoComplete="new-password"
            />
          </label>
          <label>
            确认密码
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="请再次输入密码"
              autoComplete="new-password"
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          {success && <div className="ok-box">{success}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? '提交中...' : '注册'}
          </button>
        </form>

        <div className="auth-footer">
          <span>
            已有账号？
            <Link to="/login">返回登录</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
