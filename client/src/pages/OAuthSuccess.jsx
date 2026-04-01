import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

export default function OAuthSuccess() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setAuthFromToken } = useAuth()

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      navigate('/login')
      return
    }

    const finalize = async () => {
      try {
        await setAuthFromToken(token)
        navigate('/dashboard')
      } catch {
        navigate('/login?error=oauth')
      }
    }

    finalize()
  }, [params, navigate, setAuthFromToken])

  return <div className="page"><div className="empty">Signing you in...</div></div>
}
