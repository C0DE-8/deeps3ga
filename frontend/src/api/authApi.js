import { httpClient } from './httpClient'

export async function registerAccount(payload) {
  const response = await httpClient.post('/auth/register', payload)
  return response.data.data
}

export async function loginAccount(payload) {
  const response = await httpClient.post('/auth/login', payload)
  return response.data.data
}

export async function getCurrentAccount() {
  const response = await httpClient.get('/auth/me')
  return response.data.data
}

export async function logoutAccount() {
  await httpClient.post('/auth/logout')
}
