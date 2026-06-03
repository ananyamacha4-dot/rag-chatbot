import { useEffect, useRef } from 'react'
import LoadingSpinner from './LoadingSpinner'

function ChatWindow({ messages, isLoading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <section className="chat-window" aria-live="polite">
      {messages.length === 0 ? (
        <div className="empty-state">
          <h2>Ask a question about your PDFs</h2>
          <p>Upload a document, then ask for summaries, comparisons, definitions, or exact facts.</p>
        </div>
      ) : (
        messages.map((message) => (
          <article className={`message-row ${message.role}`} id={`message-${message.id}`} key={message.id}>
            <div className="message-bubble">
              <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
              <p>{message.content}</p>
            </div>
          </article>
        ))
      )}

      {isLoading && (
        <article className="message-row assistant">
          <div className="message-bubble">
            <LoadingSpinner label="Thinking" />
          </div>
        </article>
      )}

      <div ref={bottomRef} />
    </section>
  )
}

export default ChatWindow
