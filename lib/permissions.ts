import type { AuthUser } from './api/auth'

export function can(user: Pick<AuthUser, 'systemRole' | 'permissions'> | null | undefined, permission: string) {
  if (!user) return false
  if (user.systemRole === 'ADMIN') return true
  return user.permissions?.includes(permission) ?? false
}

export function canAny(user: Pick<AuthUser, 'systemRole' | 'permissions'> | null | undefined, permissions: string[]) {
  if (!permissions.length) return true
  if (!user) return false
  if (user.systemRole === 'ADMIN') return true
  return permissions.some((permission) => user.permissions?.includes(permission))
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null

  try {
    const rawUser = localStorage.getItem('ordr-user')
    return rawUser ? (JSON.parse(rawUser) as AuthUser) : null
  } catch {
    return null
  }
}
