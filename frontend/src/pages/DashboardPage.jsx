import { useEffect, useMemo, useState } from 'react'
import Alert from '../components/Alert'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  chatWithDocuments,
  deleteDocument,
  getDocuments,
  getMessages,
  uploadPdf,
} from '../services/api'

const sections = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'upload', label: 'PDF Upload' },
  { id: 'documents', label: 'Documents' },
  { id: 'chat', label: 'Chatbot' },
  { id: 'history', label: 'Chat History' },
]

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat('en', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Saved in PostgreSQL'

const parseHistoryRecord = (record) => {
  try {
    return JSON.parse(record.message)
  } catch {
    return {
      question: record.message,
      answer: '',
      created_at: null,
    }
  }
}

function DashboardPage({ user, onLogout }) {
  const userId = user?.id || user?.user_id
  const [activeSection, setActiveSection] = useState('overview')
  const [documents, setDocuments] = useState([])
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const activeLabel = sections.find((section) => section.id === activeSection)?.label || 'Dashboard'
  const parsedHistory = useMemo(() => history.map(parseHistoryRecord), [history])
  const filteredDocuments = documents.filter((doc) =>
    doc.filename?.toLowerCase().includes(search.toLowerCase()),
  )
  const totalChunks = documents.reduce((total, doc) => total + Number(doc.chunks || 0), 0)

  const showNotice = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  const loadDashboardData = async () => {
    setError('')

    try {
      setIsLoading(true)
      const [documentData, messageData] = await Promise.all([
        getDocuments(userId),
        getMessages(userId),
      ])
      setDocuments(documentData)
      setHistory(messageData)

      const restoredMessages = messageData.flatMap((record) => {
        const item = parseHistoryRecord(record)
        return [
          item.question && { role: 'user', text: item.question, time: item.created_at },
          item.answer && { role: 'assistant', text: item.answer, time: item.created_at },
        ].filter(Boolean)
      })
      setChatMessages(restoredMessages)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      loadDashboardData()
    }
  }, [userId])

  const handleUpload = async () => {
    setError('')

    if (!selectedFile) {
      setError('Choose a PDF first.')
      return
    }

    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF files are supported.')
      return
    }

    try {
      setIsUploading(true)
      const result = await uploadPdf({ file: selectedFile, userId })
      showNotice(`${result.filename || selectedFile.name} uploaded with ${result.chunks || 0} chunks.`)
      setSelectedFile(null)
      await loadDashboardData()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (doc) => {
    const confirmed = window.confirm(`Permanently delete "${doc.filename}"?`)
    if (!confirmed) return

    try {
      await deleteDocument({ documentId: doc.id, userId })
      showNotice('Document deleted.')
      await loadDashboardData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleChatSubmit = async (event) => {
    event.preventDefault()
    const question = chatInput.trim()

    if (!question) return

    setChatInput('')
    setError('')
    setChatMessages((current) => [...current, { role: 'user', text: question, time: new Date() }])

    try {
      setIsSending(true)
      const response = await chatWithDocuments({ userId, question })
      setChatMessages((current) => [
        ...current,
        { role: 'assistant', text: response.answer || 'No answer returned.', time: new Date() },
      ])
      await loadDashboardData()
    } catch (err) {
      setError(err.message)
      setChatMessages((current) => [
        ...current,
        { role: 'assistant', text: err.message, time: new Date() },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>RAG Assistant</strong>
          <span>Document intelligence workspace</span>
        </div>

        <nav className="nav" aria-label="Dashboard navigation">
          {sections.map((section) => (
            <button
              className={activeSection === section.id ? 'active' : ''}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="user-card">
          <strong>{user?.username || 'User'}</strong>
          <span>User ID {userId}</span>
          <button className="button-danger" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>
            <h1>{activeLabel}</h1>
            <div className="section-subtitle">PostgreSQL-backed RAG chatbot platform</div>
          </div>
          <a className="button-secondary" href="http://localhost:8000/docs" target="_blank">
            API Docs
          </a>
        </header>

        <div className="content">
          <Alert message={error} />
          <Alert message={notice} type="success" />

          {isLoading ? (
            <div className="panel centered-panel">
              <LoadingSpinner label="Loading dashboard" />
            </div>
          ) : (
            <>
              {activeSection === 'overview' && (
                <section className="section active">
                  <div className="grid">
                    <article className="stat-card">
                      <span className="meta">Documents</span>
                      <strong>{documents.length}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="meta">Chat Records</span>
                      <strong>{history.length}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="meta">Indexed Chunks</span>
                      <strong>{totalChunks}</strong>
                    </article>
                  </div>
                  <div className="panel">
                    <h2>Workspace</h2>
                    <p className="section-subtitle">
                      Upload PDFs, review indexed documents, and ask grounded questions using your
                      FastAPI backend.
                    </p>
                  </div>
                </section>
              )}

              {activeSection === 'upload' && (
                <section className="section active">
                  <div className="panel">
                    <h2>Upload PDF</h2>
                    <p className="section-subtitle">Choose a PDF and index it for retrieval.</p>
                    <label className="drop-zone">
                      <strong>{selectedFile?.name || 'Drop PDF here'}</strong>
                      <span>or click to browse</span>
                      <input
                        accept="application/pdf"
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        type="file"
                      />
                    </label>
                    <button disabled={isUploading} onClick={handleUpload} type="button">
                      {isUploading ? <LoadingSpinner label="Uploading" /> : 'Upload Selected PDF'}
                    </button>
                  </div>
                </section>
              )}

              {activeSection === 'documents' && (
                <section className="section active">
                  <div className="panel">
                    <h2>Document Management</h2>
                    <input
                      className="input"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search uploaded documents..."
                      type="search"
                      value={search}
                    />
                  </div>
                  <div className="documents-grid">
                    {filteredDocuments.length === 0 ? (
                      <div className="empty">No documents found.</div>
                    ) : (
                      filteredDocuments.map((doc) => (
                        <article className="doc-card" key={doc.id}>
                          <div className="doc-card-header">
                            <h3>{doc.filename}</h3>
                            <button
                              className="doc-delete-button"
                              onClick={() => handleDeleteDocument(doc)}
                              title={`Delete ${doc.filename}`}
                              type="button"
                            >
                              x
                            </button>
                          </div>
                          <div className="meta">Document ID: {doc.id}</div>
                          <div className="meta">{doc.characters || 0} characters</div>
                          <div className="meta">{doc.chunks || 0} chunk(s)</div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              )}

              {activeSection === 'chat' && (
                <section className="section active">
                  <div className="dashboard-chat-layout">
                    <div className="chat-panel">
                      <div className="chat-log">
                        {chatMessages.length === 0 ? (
                          <div className="empty">Ask a question from your uploaded documents.</div>
                        ) : (
                          chatMessages.map((message, index) => (
                            <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                              {message.text}
                              <span className="timestamp">{formatTime(message.time)}</span>
                            </div>
                          ))
                        )}
                        {isSending && (
                          <div className="message assistant">
                            <LoadingSpinner label="Typing" />
                          </div>
                        )}
                      </div>
                      <form className="composer" onSubmit={handleChatSubmit}>
                        <textarea
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="Ask a question..."
                          required
                          value={chatInput}
                        />
                        <button disabled={isSending} type="submit">
                          Send
                        </button>
                      </form>
                    </div>
                    <aside className="panel">
                      <h2>Retrieval Rules</h2>
                      <p className="section-subtitle">
                        Answers are grounded only in retrieved document context. If the information
                        is missing, the assistant returns the fallback response.
                      </p>
                    </aside>
                  </div>
                </section>
              )}

              {activeSection === 'history' && (
                <section className="section active">
                  <div className="panel">
                    <h2>Chat History</h2>
                    <p className="section-subtitle">
                      Conversation records loaded from PostgreSQL for this authenticated user.
                    </p>
                  </div>
                  <div className="history-list">
                    {parsedHistory.length === 0 ? (
                      <div className="empty">No chat history yet.</div>
                    ) : (
                      parsedHistory
                        .slice()
                        .reverse()
                        .map((item, index) => (
                          <article className="history-card" key={`${item.question}-${index}`}>
                            <h3>{item.question || 'Message'}</h3>
                            <p>{item.answer || ''}</p>
                            <div className="meta">{formatTime(item.created_at)}</div>
                          </article>
                        ))
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default DashboardPage
