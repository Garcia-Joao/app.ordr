import { apiFetch } from './client'

export type TestCompanyResponse = {
  ok: true
  alreadyExists?: boolean
  company: {
    id: string
    name: string
    isTest: boolean
    testSourceCompanyId?: string | null
  }
}

export function createTestCompany(input: {
  sourceCompanyId: string
  copyData: boolean
}) {
  return apiFetch<TestCompanyResponse>('/companies/create-test-company', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteTestCompany(companyId: string) {
  return apiFetch<{
    ok: true
    deletedCompany: {
      id: string
      name: string
      isTest: boolean
      testSourceCompanyId?: string | null
    }
  }>(`/companies/test-company/${companyId}`, {
    method: 'DELETE',
  })
}


export type PdvSettings = {
  requireComanda: boolean
  taxEnabled: boolean
  taxRate: number
}

export function getPdvSettings() {
  return apiFetch<PdvSettings>('/companies/pdv-settings')
}

export function updatePdvSettings(input: PdvSettings) {
  return apiFetch<PdvSettings>('/companies/pdv-settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
