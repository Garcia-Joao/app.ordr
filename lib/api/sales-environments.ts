import { apiFetch } from './client'

export type SalesEnvironment = {
  id: string
  name: string
  color: string
  isDefault?: boolean
  active?: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

export function getSalesEnvironments() {
  return apiFetch<SalesEnvironment[]>('/sales-environments')
}

export function createSalesEnvironment(input: {
  name: string
  color: string
}) {
  return apiFetch<SalesEnvironment>('/sales-environments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteSalesEnvironment(environmentId: string) {
  return apiFetch<{ ok: true; environment: SalesEnvironment }>(
    `/sales-environments/${environmentId}`,
    {
      method: 'DELETE',
    }
  )
}