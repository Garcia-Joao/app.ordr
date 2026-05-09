'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function PDVPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['pdv.view', 'orders.create']}>
      {children}
    </PermissionGate>
  )
}
