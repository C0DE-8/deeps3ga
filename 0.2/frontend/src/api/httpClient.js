const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

export function getStoredToken() {
  return localStorage.getItem('deepSagaToken')
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('deepSagaToken', token)
  } else {
    localStorage.removeItem('deepSagaToken')
  }
}

export async function request(path, options = {}) {
  const token = getStoredToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Request failed.')
  }

  return payload
}
