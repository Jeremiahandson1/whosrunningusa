import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/auth/me', true)
        .then(data => setUser(data.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // Token refresh: every 6 hours while the app is open
  useEffect(() => {
    if (!user) return

    const refreshToken = () => {
      const token = localStorage.getItem('token')
      if (!token) return

      api.post('/auth/refresh', {}, true)
        .then(data => {
          if (data.token) {
            localStorage.setItem('token', data.token)
          }
        })
        .catch((err) => {
          // If 401/403, token is invalid — log out
          if (err?.status === 401 || err?.status === 403 || String(err).includes('401')) {
            localStorage.removeItem('token')
            setUser(null)
          }
        })
    }

    // Refresh every 6 hours (21600000 ms)
    const SIX_HOURS = 6 * 60 * 60 * 1000
    const interval = setInterval(refreshToken, SIX_HOURS)

    // Also refresh on mount if token might be old (best-effort: try decoding exp)
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const tokenAge = Date.now() / 1000 - (payload.iat || 0)
        const FIVE_DAYS = 5 * 24 * 60 * 60
        if (tokenAge > FIVE_DAYS) {
          refreshToken()
        }
      }
    } catch {
      // If we can't decode, just let the interval handle it
    }

    return () => clearInterval(interval)
  }, [user])

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data
  }

  const register = async (formData) => {
    const data = await api.post('/auth/register', formData)
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const updateUser = (updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
