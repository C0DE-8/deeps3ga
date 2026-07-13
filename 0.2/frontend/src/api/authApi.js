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
  return request('/auth/me')
}

export async function createOpeningScene() {
  return request('/story/opening', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
