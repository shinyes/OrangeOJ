import { createContext, useState, useCallback, useEffect } from 'react'
import { api } from '../api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMe()
  }, [refreshMe])

  const login = useCallback(async (credentials) => {
    await api.login(credentials)
    await refreshMe()
  }, [refreshMe])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const value = {
    user,
    loading,
    login,
    logout,
    refreshMe
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
