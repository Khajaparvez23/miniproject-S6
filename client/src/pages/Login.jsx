import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const initialForm = {
  identifier: '',
  password: '',
}

function PasswordEyeIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 12s3.5-6 9-6c2.2 0 4.08.73 5.63 1.7C19.87 9.08 21 12 21 12s-3.5 6-9 6c-2.2 0-4.08-.73-5.63-1.7C4.13 14.92 3 12 3 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 4l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Login() {
  const { isAuthenticated, login } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  useEffect(() => {
    setForm(initialForm)
    setError('')
    setShowPassword(false)
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
            <img className="auth-head-logo" src="/favicon.svg" alt="App logo" />
            <h1>Welcome back</h1>
            <p>Access your academic dashboard, records, and performance insights from one place.</p>
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
              <span className="password-field">
                <input
                  className="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => handleChange('password', event.target.value)}
                  autoComplete="new-password"
                />
                <button
                  className="password-toggle-icon"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <PasswordEyeIcon visible={showPassword} />
                </button>
              </span>
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
