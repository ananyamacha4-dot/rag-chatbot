const API_BASE_URL = 'http://localhost:8000'

// Central response parsing keeps error messages consistent across forms, upload, and chat.
const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.detail || payload?.message || 'Something went wrong. Please try again.'

    throw new Error(message)
  }

  return payload
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })

  return parseResponse(response)
}

export const signup = (credentials) =>
  request('/signup', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })

export const login = (credentials) =>
  request('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })

export const uploadPdf = ({ file, userId }) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('user_id', userId)

  return request('/upload', {
    method: 'POST',
    body: formData,
  })
}

export const sendMessage = ({ userId, message }) =>
  request('/message', {
    method: 'POST',
    body: JSON.stringify({
      user_id: Number(userId),
      message,
    }),
  })

export const getMessages = (userId) => request(`/messages/${userId}`)

export const getDocuments = (userId) => request(`/documents?user_id=${userId}`)

export const deleteDocument = ({ documentId, userId }) =>
  request(`/documents/${documentId}?user_id=${userId}`, {
    method: 'DELETE',
  })

export const chatWithDocuments = ({ userId, question }) =>
  request('/chat', {
    method: 'POST',
    body: JSON.stringify({
      user_id: Number(userId),
      question,
    }),
  })

// Supports both the current /message response and richer chatbot payloads if the backend evolves.
export const normalizeAssistantReply = (payload) =>
  payload?.answer ||
  payload?.response ||
  payload?.reply ||
  payload?.bot_response ||
  payload?.message ||
  'Message sent successfully.'
