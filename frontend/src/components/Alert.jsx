function Alert({ message, type = 'error' }) {
  if (!message) return null

  return (
    <div className={`alert alert-${type}`} role="status">
      {message}
    </div>
  )
}

export default Alert
