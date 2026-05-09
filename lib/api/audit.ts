import { apiFetch } from './client'

export type AuditLog = {
  id: string
  companyId: string
  userId?: string | null
  entityType: string
  entityId: string
  action: string
  description?: string | null
  oldValues?: unknown
  newValues?: unknown
  metadata?: unknown
  createdAt: string
  user?: {
    id: string
    username: string
    name?: string | null
    photoBase64?: string | null
  } | null
}

export type AuditFilters = {
  action?: string
  entityType?: string
  userId?: string
  search?: string
  from?: string
  to?: string
  take?: number
  cursor?: string
}

export function getAuditLogs(filters: AuditFilters = {}) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value))
    }
  })

  const query = params.toString()

  return apiFetch<{ logs: AuditLog[]; nextCursor?: string | null }>(
    `/audit${query ? `?${query}` : ''}`
  )
}
