import { Suspense, lazy } from 'react'
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CodingPage = lazy(() => import('./pages/CodingPage'))
const TrainingPage = lazy(() => import('./pages/TrainingPage'))
const HomeworkPage = lazy(() => import('./pages/HomeworkPage'))
const HomeworkProgrammingPage = lazy(() => import('./pages/HomeworkProgrammingPage'))
const HomeworkSubmissionRecordsPage = lazy(() => import('./pages/HomeworkSubmissionRecordsPage'))
const TrainingProgressPage = lazy(() => import('./pages/TrainingProgressPage'))

function PageFallback() {
  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中...</div>
}

function Protected({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中...</div>
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

  const renderProtectedPage = (element) => (
    <Protected>
      <Suspense fallback={<PageFallback />}>
        {element}
      </Suspense>
    </Protected>
  )

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={handleLogin} user={user} />} />
      <Route path="/register" element={<RegisterPage user={user} />} />
      <Route
        path="/"
        element={renderProtectedPage(<DashboardPage user={user} onLogout={handleLogout} view="learn" />)}
      />
      <Route
        path="/manage/space"
        element={renderProtectedPage(<DashboardPage user={user} onLogout={handleLogout} view="space-manage" />)}
      />
      <Route
        path="/manage/system"
        element={renderProtectedPage(<DashboardPage user={user} onLogout={handleLogout} view="system-manage" />)}
      />
      <Route
        path="/spaces/:spaceId/problems/:problemId/solve"
        element={renderProtectedPage(<CodingPage user={user} onLogout={handleLogout} />)}
      />
      <Route
        path="/spaces/:spaceId/training-plans/:planId"
        element={renderProtectedPage(<TrainingPage user={user} onLogout={handleLogout} />)}
      />
      <Route
        path="/spaces/:spaceId/training-plans/:planId/progress"
        element={renderProtectedPage(<TrainingProgressPage user={user} onLogout={handleLogout} />)}
      />
      <Route
        path="/spaces/:spaceId/homeworks/:homeworkId"
        element={renderProtectedPage(<HomeworkPage user={user} onLogout={handleLogout} />)}
      />
      <Route
        path="/spaces/:spaceId/homeworks/:homeworkId/problems/:problemId"
        element={renderProtectedPage(<HomeworkProgrammingPage user={user} onLogout={handleLogout} />)}
      />
      <Route
        path="/spaces/:spaceId/homeworks/:homeworkId/submission-records"
        element={renderProtectedPage(<HomeworkSubmissionRecordsPage user={user} onLogout={handleLogout} />)}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
