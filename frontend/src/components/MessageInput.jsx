import { useState } from 'react'

function MessageInput({ disabled, onSend }) {
  const [message, setMessage] = useState('')

  const submitMessage = (event) => {
    event.preventDefault()

    if (!message.trim()) return

    onSend(message.trim())
    setMessage('')
  }

  return (
    <form className="message-form" onSubmit={submitMessage}>
      <textarea
        disabled={disabled}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            submitMessage(event)
          }
        }}
        placeholder="Ask about an uploaded PDF..."
        rows="2"
        value={message}
      />
      <button className="primary-button send-button" disabled={disabled || !message.trim()} type="submit">
        Send
      </button>
    </form>
  )
}

export default MessageInput
