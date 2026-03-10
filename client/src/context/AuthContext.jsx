import { createContext, useContext, useMemo, useState } from 'react'
import * as api from '../services/api.js'

const AuthContext = createContext(null)

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

  const persist = (nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    localStorage.setItem(storageKey, JSON.stringify({ token: nextToken, user: nextUser }))
  }

  const clear = () => {
    setToken('')
    setUser(null)
    localStorage.removeItem(storageKey)
  }

  const login = async (payload) => {
    const data = await api.login(payload)
    persist(data.token, data.user)
    return data
  }

  const register = async (payload) => {
    const data = await api.register(payload)
    persist(data.token, data.user)
    return data
  }

  const setAuthFromToken = async (nextToken) => {
    const userProfile = await api.getProfile(nextToken)
    persist(nextToken, userProfile)
  }

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      register,
      logout: clear,
      setAuthFromToken,
      isAuthenticated: Boolean(token),
    }),
    [token, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
