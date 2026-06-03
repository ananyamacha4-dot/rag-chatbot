function ChatHistorySidebar({ messages, user, onSelectMessage, onLogout }) {
  const userMessages = messages.filter((message) => message.role === 'user')

  return (
    <aside className="history-sidebar">
      <div className="sidebar-header">
        <div>
          <span className="eyebrow">Signed in</span>
          <strong>{user?.username || 'User'}</strong>
        </div>
        <button className="ghost-button" onClick={onLogout} type="button">
          Logout
        </button>
      </div>

      <div className="history-list">
        <span className="eyebrow">Chat history</span>
        {userMessages.length === 0 ? (
          <p className="muted">Previous questions will appear here.</p>
        ) : (
          userMessages.map((message) => (
            <button
              className="history-item"
              key={message.id}
              onClick={() => onSelectMessage(message)}
              type="button"
            >
              {message.content}
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

export default ChatHistorySidebar
