import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CodingPage from './pages/CodingPage'

function Protected({ children }) {
  const { user, loading } = useAuth()
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
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (credentials) => {
    await login(credentials)
    navigate('/')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={handleLogin} user={user} />} />
      <Route path="/register" element={<RegisterPage user={user} />} />
      <Route
        path="/"
        element={
          <Protected>
            <DashboardPage user={user} onLogout={handleLogout} view="learn" />
          </Protected>
        }
      />
      <Route
        path="/manage/space"
        element={
          <Protected>
            <DashboardPage user={user} onLogout={handleLogout} view="space-manage" />
          </Protected>
        }
      />
      <Route
        path="/manage/root-problems"
        element={
          <Protected>
            <DashboardPage user={user} onLogout={handleLogout} view="root-manage" />
          </Protected>
        }
      />
      <Route
        path="/manage/system"
        element={
          <Protected>
            <DashboardPage user={user} onLogout={handleLogout} view="system-manage" />
          </Protected>
        }
      />
      <Route
        path="/spaces/:spaceId/problems/:problemId/solve"
        element={
          <Protected>
            <CodingPage user={user} onLogout={handleLogout} />
          </Protected>
        }
      />
      <Route
        path="/problems/:problemId/solve"
        element={
          <Protected>
            <CodingPage user={user} onLogout={handleLogout} />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
