const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Default per-request timeout. Render free-tier services can cold-start, so
// set this generously enough to absorb a wake-up but short enough that the
// UI never spins forever.
const DEFAULT_TIMEOUT_MS = 20_000

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(endpoint, options = {}) {
  const { body, method = 'GET', auth = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const headers = {
    'Content-Type': 'application/json',
    ...(auth ? getAuthHeaders() : {}),
  }

  const controller = new AbortController()
  const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null

  const config = { method, headers, signal: controller.signal }
  if (body) config.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(`${API_BASE}${endpoint}`, config)
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(
        `The server didn't respond in time. It may be waking up — please try again in a moment.`
      )
      timeoutErr.code = 'TIMEOUT'
      throw timeoutErr
    }
    const networkErr = new Error(
      `We couldn't reach our servers. Please check your connection and try again.`
    )
    networkErr.code = 'NETWORK'
    networkErr.cause = err
    throw networkErr
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }

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
  get: (endpoint, auth = false, opts = {}) => request(endpoint, { auth, ...opts }),
  post: (endpoint, body, auth = false, opts = {}) => request(endpoint, { method: 'POST', body, auth, ...opts }),
  put: (endpoint, body, auth = false, opts = {}) => request(endpoint, { method: 'PUT', body, auth, ...opts }),
  delete: (endpoint, auth = false, opts = {}) => request(endpoint, { method: 'DELETE', auth, ...opts }),
}

export default api
