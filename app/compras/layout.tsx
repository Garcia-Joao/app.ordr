'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function ComprasPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['buys.view', 'buys.manage', 'stock.quickBuy', 'stock.purchase.create']}>
      {children}
    </PermissionGate>
  )
}
