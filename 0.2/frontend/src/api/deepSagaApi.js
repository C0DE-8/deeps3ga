import { request } from './httpClient'

export async function fetchGameSaves() {
  const response = await request('/game/saves')
  return response.data
}

export async function startGame() {
  const response = await request('/game/start', { method: 'POST', body: JSON.stringify({}) })
  return response.data
}

export async function fetchGameState(storyCycleId) {
  const response = await request(`/game/state/${storyCycleId}`)
  return response.data
}

export async function continueNarrative(payload) {
  const response = await request('/game/continue', {
    method: 'POST',
    headers: { 'Idempotency-Key': payload.requestKey },
    body: JSON.stringify(payload),
  })
  return response.data
}
