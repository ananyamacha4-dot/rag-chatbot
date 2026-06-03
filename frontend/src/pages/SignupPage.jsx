import AuthForm from '../components/AuthForm'
import { signup } from '../services/api'

function SignupPage({ onSignup, onNavigateToLogin }) {
  const handleSubmit = async (credentials) => {
    const payload = await signup(credentials)
    onSignup({
      ...payload,
      username: credentials.username,
    })
  }

  return (
    <AuthForm
      onSubmit={handleSubmit}
      onSwitch={onNavigateToLogin}
      submitLabel="Create account"
      subtitle="Create a workspace for your PDFs and RAG chat history."
      switchLabel="Login"
      switchText="Already have an account?"
      title="Create your account"
    />
  )
}

export default SignupPage
