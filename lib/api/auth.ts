import { apiFetch } from './client'

export type AuthCompany = {
  id: string
  name: string
  isTest: boolean
  role: string
  systemRole?: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  customRoleName?: string | null
  activeEventDateId?: string | null
  permissions?: string[]
}

export type AuthUser = {
  id: string
  username: string
  role: string
  systemRole?: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  customRoleName?: string | null
  activeEventDateId?: string | null
  permissions?: string[]
  companyId: string
  companies?: AuthCompany[]
  name?: string | null
  phone?: string | null
  photoBase64?: string | null
}

export type UpdateMyAccountInput = {
  name?: string
  username?: string
  phone?: string
  photoBase64?: string | null
  currentPassword?: string
  newPassword?: string
}

export function login(username: string, password: string) {
  return apiFetch<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return apiFetch<{ ok: true }>('/auth/logout', {
    method: 'POST',
  })
}

export function me() {
  return apiFetch<{ user: AuthUser }>('/auth/me', {
    method: 'GET',
  })
}

export function updateMe(data: UpdateMyAccountInput) {
  return apiFetch<{ user: AuthUser }>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export const getMe = me

export function switchCompany(companyId: string) {
  return apiFetch<{ user: AuthUser }>('/auth/switch-company', {
    method: 'POST',
    body: JSON.stringify({ companyId }),
  })
}