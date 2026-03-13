const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(endpoint, options = {}) {
  const { body, method = 'GET', auth = false } = options

  const headers = {
    'Content-Type': 'application/json',
    ...(auth ? getAuthHeaders() : {}),
  }

  const config = { method, headers }
  if (body) config.body = JSON.stringify(body)

  const res = await fetch(`${API_BASE}${endpoint}`, config)

  let data
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    data = await res.json()
  } else {
    const text = await res.text()
    data = { message: text }
  }

  if (!res.ok) {
    const error = new Error(data.error || data.message || 'Request failed')
    error.status = res.status
    error.data = data
    throw error
  }

  return data
}

const api = {
  get: (endpoint, auth = false) => request(endpoint, { auth }),
  post: (endpoint, body, auth = false) => request(endpoint, { method: 'POST', body, auth }),
  put: (endpoint, body, auth = false) => request(endpoint, { method: 'PUT', body, auth }),
  delete: (endpoint, auth = false) => request(endpoint, { method: 'DELETE', auth }),
}

export default api
