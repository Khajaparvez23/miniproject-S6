import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const initialForm = {
  identifier: '',
  password: '',
}

export default function Login() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  useEffect(() => {
    setForm(initialForm)
    setError('')
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.identifier.trim() || !form.password.trim()) {
      setError('Username/email and password are required.')
      return
    }

    try {
      setLoading(true)
      await login({ identifier: form.identifier, password: form.password })
      setForm(initialForm)
      setError('')
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <div className="auth-card">
          <div className="auth-head">
            <h1>Welcome back</h1>
            <img className="auth-head-logo" src="/favicon.svg" alt="App logo" />
          </div>
          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            <label>
              Username or email
              <input
                type="text"
                value={form.identifier}
                onChange={(event) => handleChange('identifier', event.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange('password', event.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && (
              <div className="status error" role="alert">
                {error}
              </div>
            )}

            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : 'Sign in'}
            </button>
          </form>
          <div className="oauth">
            <span className="muted">Or continue with</span>
            <a className="secondary" href={`${apiBase}/api/auth/google`}>
              Google
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
