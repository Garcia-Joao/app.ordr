'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function AcessosPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['roles.view', 'roles.manage', 'users.view', 'users.manage']}>
      {children}
    </PermissionGate>
  )
}
