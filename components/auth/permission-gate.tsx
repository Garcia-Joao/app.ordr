'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { canAny, getStoredUser } from '@/lib/permissions'
import type { AuthUser } from '@/lib/api/auth'

type PermissionGateProps = {
  children: React.ReactNode
  permissions: string[]
  fallbackTitle?: string
  fallbackDescription?: string
}

export function usePermissionGuard(permissions: string[]) {
  const [hasMounted, setHasMounted] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    setHasMounted(true)
    setUser(getStoredUser())

    function handleUserUpdated() {
      setUser(getStoredUser())
    }

    window.addEventListener('storage', handleUserUpdated)
    window.addEventListener('ordr-user-updated', handleUserUpdated)

    return () => {
      window.removeEventListener('storage', handleUserUpdated)
      window.removeEventListener('ordr-user-updated', handleUserUpdated)
    }
  }, [])

  const hasAccess = useMemo(() => {
    if (!hasMounted) return false
    return canAny(user, permissions)
  }, [hasMounted, permissions, user])

  return {
    isReady: hasMounted,
    user,
    hasAccess,
  }
}

export function PermissionBlocked({
  title = 'Acesso indisponível',
  description = 'Seu usuário não possui permissão para visualizar esta área.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link
          href="/PDV"
          className="mt-6 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          Voltar para o PDV
        </Link>
      </div>
    </div>
  )
}

export function PermissionGate({
  children,
  permissions,
  fallbackTitle,
  fallbackDescription,
}: PermissionGateProps) {
  const { isReady, hasAccess } = usePermissionGuard(permissions)

  if (!isReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
        Carregando permissões...
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <PermissionBlocked
        title={fallbackTitle}
        description={fallbackDescription}
      />
    )
  }

  return <>{children}</>
}
