import { apiFetch } from './client'
import type { EventDate } from './events'

export type PermissionCatalogItem = {
  key: string
  label: string
  description?: string | null
}

export type PermissionCatalogGroup = {
  group: string
  description?: string | null
  permissions: PermissionCatalogItem[]
}

export type AccessRole = {
  id: string
  companyId: string
  name: string
  description?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  permissions: Array<{
    id: string
    roleId: string
    permissionKey: string
  }>
  _count?: {
    memberships: number
  }
}

export type AccessUser = {
  id: string
  userId: string
  companyId: string
  role: string
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  activeEventDateId?: string | null
  activeEventDate?: EventDate | null
  createdAt: string
  updatedAt?: string
  user: {
    id: string
    username: string
    name?: string | null
    phone?: string | null
    photoBase64?: string | null
    createdAt: string
  }
  customRole?: AccessRole | null
}

export function getPermissionCatalog() {
  return apiFetch<{ groups: PermissionCatalogGroup[] }>('/access/permissions')
}

export function getAccessRoles() {
  return apiFetch<{ roles: AccessRole[] }>('/access/roles')
}

export function createAccessRole(data: {
  name: string
  description?: string | null
  permissionKeys: string[]
}) {
  return apiFetch<{ role: AccessRole }>('/access/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAccessRole(
  id: string,
  data: {
    name?: string
    description?: string | null
    active?: boolean
    permissionKeys?: string[]
  }
) {
  return apiFetch<{ role: AccessRole }>(`/access/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteAccessRole(id: string) {
  return apiFetch<{ ok: true }>(`/access/roles/${id}`, {
    method: 'DELETE',
  })
}

export function getAccessUsers() {
  return apiFetch<{ users: AccessUser[] }>('/access/users')
}

export function updateUserAccess(
  membershipId: string,
  data: {
    systemRole: 'ADMIN' | 'CUSTOM'
    customRoleId?: string | null
    activeEventDateId?: string | null
  }
) {
  return apiFetch<{ membership: AccessUser }>(`/access/users/${membershipId}/access`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function createAccessUser(data: {
  username: string
  password: string
  name?: string | null
  phone?: string | null
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  activeEventDateId?: string | null
}) {
  return apiFetch<{ user: AccessUser }>('/access/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAccessUser(
  membershipId: string,
  data: {
    username?: string
    password?: string | null
    name?: string | null
    phone?: string | null
    systemRole: 'ADMIN' | 'CUSTOM'
    customRoleId?: string | null
    activeEventDateId?: string | null
  }
) {
  return apiFetch<{ user: AccessUser }>(`/access/users/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}


export function getAccessEventDates() {
  return apiFetch<{ eventDates: EventDate[] }>('/access/event-dates')
}

export function updateMyActiveEventDate(activeEventDateId: string | null) {
  return apiFetch<{ activeEventDateId: string | null; activeEventDate: EventDate | null }>('/access/me/active-event', {
    method: 'PATCH',
    body: JSON.stringify({ activeEventDateId }),
  })
}
