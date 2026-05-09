'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function ClientesPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['customers.view']}>
      {children}
    </PermissionGate>
  )
}
