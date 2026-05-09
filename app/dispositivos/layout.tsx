'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function DispositivosPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['settings.view']}>
      {children}
    </PermissionGate>
  )
}
