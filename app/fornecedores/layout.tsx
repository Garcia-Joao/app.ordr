'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function FornecedoresPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['suppliers.view', 'suppliers.manage']}>
      {children}
    </PermissionGate>
  )
}
