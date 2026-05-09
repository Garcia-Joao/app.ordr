'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function RelatoriosPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['reports.view']}>
      {children}
    </PermissionGate>
  )
}
