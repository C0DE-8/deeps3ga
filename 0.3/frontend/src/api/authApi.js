import { request } from './httpClient'

export async function registerPlayer({ username, email, password }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
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

export async function fetchPersonas() {
  return request('/auth/personas')
}

export async function updateNarratorPersona(persona) {
  return request('/auth/persona', {
    method: 'PATCH',
    body: JSON.stringify({ persona }),
  })
}

export async function createOpeningScene() {
  return request('/story/opening', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
