import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CodingPage from './pages/CodingPage'

function Protected({ user, loading, children }) {
  const location = useLocation()

  if (loading) {
    return <div className="screen-center">加载中...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const refreshMe = async () => {
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshMe()
  }, [])

  const handleLogin = async (credentials) => {
    await api.login(credentials)
    await refreshMe()
    navigate('/')
  }

  const handleLogout = async () => {
    await api.logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={handleLogin} user={user} />} />
      <Route path="/register" element={<RegisterPage user={user} />} />
      <Route
        path="/"
        element={
          <Protected user={user} loading={loading}>
            <DashboardPage user={user} onLogout={handleLogout} view="learn" />
          </Protected>
        }
      />
      <Route
        path="/manage/space"
        element={
          <Protected user={user} loading={loading}>
            <DashboardPage user={user} onLogout={handleLogout} view="space-manage" />
          </Protected>
        }
      />
      <Route
        path="/manage/root-problems"
        element={
          <Protected user={user} loading={loading}>
            <DashboardPage user={user} onLogout={handleLogout} view="root-manage" />
          </Protected>
        }
      />
      <Route
        path="/manage/system"
        element={
          <Protected user={user} loading={loading}>
            <DashboardPage user={user} onLogout={handleLogout} view="system-manage" />
          </Protected>
        }
      />
      <Route
        path="/spaces/:spaceId/problems/:problemId/solve"
        element={
          <Protected user={user} loading={loading}>
            <CodingPage user={user} onLogout={handleLogout} />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
