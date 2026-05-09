'use client'

import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function PessoasPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['people.view']}>
      {children}
    </PermissionGate>
  )
}
