import { httpClient } from './httpClient'

export async function fetchDeepSagaFlow() {
  const response = await httpClient.get('/deep-saga/flow')
  return response.data
}

export async function fetchDeepSagaWorld() {
  const response = await httpClient.get('/deep-saga/world')
  return response.data
}

export async function continueNarrative(payload) {
  const response = await httpClient.post('/game/continue', payload)
  return response.data.data
}

export async function fetchGameState(storyCycleId) {
  const response = await httpClient.get(`/game/state/${storyCycleId}`)
  return response.data.data
}

export async function fetchGameSaves() {
  const response = await httpClient.get('/game/saves')
  return response.data.data
}

export async function startGame() {
  const response = await httpClient.post('/game/start')
  return response.data.data
}

export async function recordCharacterDeath(storyCycleId, deathScene) {
  const response = await httpClient.post(`/game/cycles/${storyCycleId}/death`, { deathScene })
  return response.data.data
}

export async function completeStoryCycle(storyCycleId, bossData) {
  const response = await httpClient.post(`/game/cycles/${storyCycleId}/complete`, { bossData })
  return response.data.data
}
