'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function PedidosPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['orders.view', 'pdv.view']}>
      {children}
    </PermissionGate>
  )
}
