import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './auth-context.js'
import * as api from '../services/api.js'

const storageKey = 'aqa_auth'

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const stored = readStoredAuth()
  const [token, setToken] = useState(stored?.token || '')
  const [user, setUser] = useState(stored?.user || null)

  const persist = useCallback((nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    localStorage.setItem(storageKey, JSON.stringify({ token: nextToken, user: nextUser }))
  }, [])

  const clear = useCallback(() => {
    setToken('')
    setUser(null)
    localStorage.removeItem(storageKey)
  }, [])

  const login = useCallback(async (payload) => {
    const data = await api.login(payload)
    persist(data.token, data.user)
    return data
  }, [persist])

  const register = useCallback(async (payload) => {
    const data = await api.register(payload)
    persist(data.token, data.user)
    return data
  }, [persist])

  const setAuthFromToken = useCallback(async (nextToken) => {
    const userProfile = await api.getProfile(nextToken)
    persist(nextToken, userProfile)
  }, [persist])

  const refreshProfile = useCallback(async () => {
    if (!token) return null
    const userProfile = await api.getProfile(token)
    persist(token, userProfile)
    return userProfile
  }, [persist, token])

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      register,
      logout: clear,
      setAuthFromToken,
      refreshProfile,
      isAuthenticated: Boolean(token),
    }),
    [token, user, login, register, clear, setAuthFromToken, refreshProfile]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleAuthExpired = () => {
      clear()
    }
    window.addEventListener('aqa:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('aqa:auth-expired', handleAuthExpired)
  }, [clear])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
