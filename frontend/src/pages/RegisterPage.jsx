import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'

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
    return (
      <Container component="main" maxWidth="xs">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Typography>加载中...</Typography>
        </Box>
      </Container>
    )
  }

  if (!enabled) {
    return (
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography component="h1" variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
            OrangeOJ
          </Typography>
          <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
            <Typography variant="body1" gutterBottom>
              当前未开放注册，请联系管理员开启后再试。
            </Typography>
            <Button
              component={Link}
              to="/login"
              variant="outlined"
              sx={{ mt: 2 }}
            >
              返回登录
            </Button>
          </Paper>
        </Box>
      </Container>
    )
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
          OrangeOJ
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          创建账号后即可进入系统。
        </Typography>
        
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="用户名"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密码"
              type="password"
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="确认密码"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            
            {success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {success}
              </Alert>
            )}
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting}
              sx={{ mt: 3, mb: 2 }}
            >
              {submitting ? '提交中...' : '注册'}
            </Button>
            
            <Typography variant="body2" align="center">
              已有账号？{' '}
              <Link to="/login" style={{ textDecoration: 'none' }}>
                返回登录
              </Link>
            </Typography>
          </form>
        </Paper>
      </Box>
    </Container>
  )
}
