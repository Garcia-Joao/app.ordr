'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function ProdutosPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['products.view']}>
      {children}
    </PermissionGate>
  )
}
