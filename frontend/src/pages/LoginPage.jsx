import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'

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
          简洁高效的在线判题与教学平台
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
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
              {submitting ? '登录中...' : '登录'}
            </Button>
            
            {loadingRegistrationStatus ? (
              <Typography variant="body2" color="text.secondary" align="center">
                注册状态加载中...
              </Typography>
            ) : registrationEnabled ? (
              <Typography variant="body2" align="center">
                没有账号？{' '}
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  去注册
                </Link>
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center">
                当前未开放注册，请联系管理员。
              </Typography>
            )}
          </form>
        </Paper>
      </Box>
    </Container>
  )
}
