'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function TerminalPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['printers.view', 'printers.update']}>
      {children}
    </PermissionGate>
  )
}
