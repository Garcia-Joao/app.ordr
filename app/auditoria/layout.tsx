'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function AuditoriaPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['audit.view']}>
      {children}
    </PermissionGate>
  )
}
