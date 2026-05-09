'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function ConfiguracoesPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['settings.view']}>
      {children}
    </PermissionGate>
  )
}
