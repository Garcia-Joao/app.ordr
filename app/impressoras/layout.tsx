'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function ImpressorasPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['printers.view']}>
      {children}
    </PermissionGate>
  )
}
