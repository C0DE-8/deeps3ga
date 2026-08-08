import { request } from './httpClient'

export function fetchLibrary() {
  return request('/story/books')
}

export function fetchBook(slug) {
  return request(`/story/books/${slug}`)
}

export function createRun(bookSlug = 'ant-world') {
  return request('/story/runs', {
    method: 'POST',
    body: JSON.stringify({ bookSlug }),
  })
}

export function fetchRun(runId) {
  return request(`/story/runs/${runId}`)
}

export function fetchJournal(runId) {
  return request(`/story/runs/${runId}/journal`)
}

export function sendRunAction(runId, { action, clientActionId, expectedVersion }) {
  return request(`/story/runs/${runId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action, clientActionId, expectedVersion }),
  })
}

export function fetchJourney(runId) {
  return request(`/story/journey/${runId}`)
}

export function abandonRun(runId) {
  return request(`/story/runs/${runId}/abandon`, { method: 'POST' })
}
