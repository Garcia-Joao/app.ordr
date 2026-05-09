import type { ReactNode } from 'react'
import { PermissionGate } from '@/components/auth/permission-gate'

export default function InternoPermissionLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGate permissions={['interno.view']}>
      {children}
    </PermissionGate>
  )
}
