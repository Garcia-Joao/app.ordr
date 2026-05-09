'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function EventosPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['events.view']}>
      {children}
    </PermissionGate>
  )
}
