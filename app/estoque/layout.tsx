'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function EstoquePermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['stock.view']}>
      {children}
    </PermissionGate>
  )
}
