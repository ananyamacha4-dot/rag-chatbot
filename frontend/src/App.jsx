import { useEffect, useMemo, useState } from 'react'
import './App.css'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'

const STORAGE_KEY = 'rag_chat_user'

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function App() {
  const [user, setUser] = useState(getStoredUser)
  const [route, setRoute] = useState(() => window.location.pathname)

  const isAuthenticated = Boolean(user?.id || user?.user_id)

  const navigate = (path) => {
    window.history.pushState({}, '', path)
    setRoute(path)
  }

  const handleLogin = (loginPayload) => {
    const nextUser = {
      id: loginPayload.user?.id ?? loginPayload.user_id ?? loginPayload.id,
      username: loginPayload.user?.username ?? loginPayload.username,
      token: loginPayload.access_token ?? loginPayload.token ?? '',
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
    setUser(nextUser)
    navigate('/app/dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    navigate('/app/login')
  }

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (route === '/') {
      navigate(isAuthenticated ? '/app/dashboard' : '/app/login')
    }
  }, [isAuthenticated, route])

  const screen = useMemo(() => {
    if (route === '/app/signup') {
      return (
        <SignupPage
          onSignup={handleLogin}
          onNavigateToLogin={() => navigate('/app/login')}
        />
      )
    }

    if (route === '/app/dashboard' || route === '/app/chat') {
      if (!isAuthenticated) {
        return <LoginPage onLogin={handleLogin} onNavigateToSignup={() => navigate('/app/signup')} />
      }

      return <DashboardPage user={user} onLogout={handleLogout} />
    }

    return <LoginPage onLogin={handleLogin} onNavigateToSignup={() => navigate('/app/signup')} />
  }, [isAuthenticated, route, user])

  return screen
}

export default App
