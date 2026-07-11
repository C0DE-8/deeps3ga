import { httpClient } from './httpClient'

export async function fetchAdminOverview() {
  const response = await httpClient.get('/admin/overview')
  return response.data.data
}

export async function fetchAdminDataset(dataset, page = 1) {
  const response = await httpClient.get(`/admin/data/${dataset}`, { params: { page, pageSize: 25 } })
  return response.data.data
}
