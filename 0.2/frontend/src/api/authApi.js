import { request } from './httpClient'

export async function registerPlayer({ email, password }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function loginPlayer({ identifier, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
}

export async function fetchCurrentPlayer() {
  const response = await fetchAuthStatus()
  return {
    ...response,
    data: { player: response.authenticated ? response.data.player : null },
  }
}

export async function fetchAuthStatus() {
  return request('/auth/status')
}

export async function createOpeningScene() {
  return request('/story/opening', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
