const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://deeps3ga-b.vercel.app/api'
const TOKEN_KEY = 'deepSagaPlayerTokenV2'
const LEGACY_TOKEN_KEY = 'deepSagaToken'
const AUTH_NOTICE_KEY = 'deepSagaAuthNotice'

function rememberExpiredSession() {
  sessionStorage.setItem(AUTH_NOTICE_KEY, 'Your session has expired. Log in again to continue your story.')
}

export function consumeAuthNotice() {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY) || ''
  sessionStorage.removeItem(AUTH_NOTICE_KEY)
  return notice
}

export function clearAuthNotice() {
  sessionStorage.removeItem(AUTH_NOTICE_KEY)
}

export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY)
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (!token && legacyToken) {
    localStorage.setItem(TOKEN_KEY, legacyToken)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    return legacyToken
  }
  return token
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    clearAuthNotice()
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
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
    if (response.status === 401) {
      rememberExpiredSession()
      setStoredToken(null)
      window.dispatchEvent(new CustomEvent('deep-saga:unauthorized'))
    }
    const error = new Error(payload.message || payload.error || 'Request failed.')
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}
