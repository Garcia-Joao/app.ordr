import { apiFetch } from './client'

export function createTestCompany(copyData: boolean) {
  return apiFetch<{
    ok: true
    company: {
      id: string
      name: string
      isTest: boolean
    }
  }>('/companies/create-test-company', {
    method: 'POST',
    body: JSON.stringify({ copyData }),
  })
}