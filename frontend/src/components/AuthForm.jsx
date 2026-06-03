import { useState } from 'react'
import Alert from './Alert'
import LoadingSpinner from './LoadingSpinner'

const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/
const NUMBER_PATTERN = /\d/

const validateSecureField = (label, value) => {
  if (value.length <= 6) {
    return `${label} must be more than 6 characters.`
  }

  if (!NUMBER_PATTERN.test(value)) {
    return `${label} must include at least 1 number.`
  }

  if (!SPECIAL_CHARACTER_PATTERN.test(value)) {
    return `${label} must include at least 1 special character.`
  }

  return ''
}

function AuthForm({
  title,
  subtitle,
  submitLabel,
  switchText,
  switchLabel,
  onSubmit,
  onSwitch,
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }

    const usernameError = validateSecureField('Username', username.trim())
    const passwordError = validateSecureField('Password', password)

    if (usernameError || passwordError) {
      setError(usernameError || passwordError)
      return
    }

    try {
      setIsLoading(true)
      await onSubmit({ username: username.trim(), password })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">RAG</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>

        <Alert message={error} />

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              type="text"
              value={username}
            />
            <span className="field-hint">More than 6 characters with 1 number and 1 special character.</span>
          </label>

          <label>
            Password
            <input
              autoComplete={submitLabel === 'Create account' ? 'new-password' : 'current-password'}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              type="password"
              value={password}
            />
            <span className="field-hint">More than 6 characters with 1 number and 1 special character.</span>
          </label>

          <button className="primary-button" disabled={isLoading} type="submit">
            {isLoading ? <LoadingSpinner label="Working" /> : submitLabel}
          </button>
        </form>

        <p className="switch-copy">
          {switchText}{' '}
          <button className="text-button" onClick={onSwitch} type="button">
            {switchLabel}
          </button>
        </p>
      </section>
    </main>
  )
}

export default AuthForm
