import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reports from './pages/Reports.jsx'
import OAuthSuccess from './pages/OAuthSuccess.jsx'

function Layout() {
  const { logout } = useAuth()

  return (
    <div className="app">
      <header className="top-nav">
        <nav className="nav-links">
          <Link className="active" to="/dashboard">
            Dashboard
          </Link>
        </nav>
        <div className="nav-actions">
          <button className="ghost icon-logout" type="button" onClick={logout} aria-label="Log out">
            <img src="/favicon.svg" alt="" />
            <span>Log out</span>
          </button>
        </div>
      </header>
      <main>
        <Outlet />
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
