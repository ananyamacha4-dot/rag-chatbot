import AuthForm from '../components/AuthForm'
import { login } from '../services/api'

function LoginPage({ onLogin, onNavigateToSignup }) {
  const handleSubmit = async (credentials) => {
    const payload = await login(credentials)
    onLogin(payload)
  }

  return (
    <AuthForm
      onSubmit={handleSubmit}
      onSwitch={onNavigateToSignup}
      submitLabel="Login"
      subtitle="Sign in to upload PDFs and continue your document conversations."
      switchLabel="Create one"
      switchText="Need an account?"
      title="Welcome back"
    />
  )
}

export default LoginPage
