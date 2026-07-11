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
  const response = await httpClient.post('/story/continue', payload)
  return response.data.data
}
