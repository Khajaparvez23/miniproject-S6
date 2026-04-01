import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './context/useAuth.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reports from './pages/Reports.jsx'
import OAuthSuccess from './pages/OAuthSuccess.jsx'

const DASHBOARD_THEME_KEY = 'dashboard-theme'

function Layout() {
  const { logout } = useAuth()
  const [dashboardTheme, setDashboardTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem(DASHBOARD_THEME_KEY) || 'light'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DASHBOARD_THEME_KEY, dashboardTheme)
  }, [dashboardTheme])

  return (
    <div className="app">
      <header className="top-nav">
        <nav className="nav-links">
          <Link className="active" to="/dashboard">
            Dashboard
          </Link>
        </nav>
        <div className="nav-actions">
          <button
            className="ghost icon-logout theme-trigger"
            type="button"
            onClick={() => setDashboardTheme((theme) => (theme === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${dashboardTheme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${dashboardTheme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {dashboardTheme === 'dark' ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span>{dashboardTheme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
          <button className="ghost icon-logout" type="button" onClick={logout} aria-label="Log out">
            <img src="/favicon.svg" alt="" />
            <span>Log out</span>
          </button>
        </div>
      </header>
      <main>
        <Outlet context={{ dashboardTheme }} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/oauth-success" element={<OAuthSuccess />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
