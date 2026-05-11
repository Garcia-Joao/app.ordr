'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { canAny } from '@/lib/permissions'
import type { AuthCompany, AuthUser } from '@/lib/api/auth'
import { getFirstAllowedPath } from '@/lib/auth-routing'
import { me } from '@/lib/api/auth'

const SUPPLIERS_APP_URL = process.env.NEXT_PUBLIC_SUPPLIERS_APP_URL || 'https://suppliers.panelordr.com.br/'

function isSupplierCompany(company?: AuthCompany | null) {
  return String(company?.companyType ?? '').toUpperCase() === 'SUPPLIER'
}

function hasMultipleCompanies(user?: AuthUser | null) {
  return Boolean(user?.requiresCompanySelection) || (user?.companies?.length ?? 0) > 1
}

type PermissionGateProps = {
  children: React.ReactNode
  permissions: string[]
  fallbackTitle?: string
  fallbackDescription?: string
}

export function usePermissionGuard(permissions: string[]) {
  const router = useRouter()
  const pathname = usePathname()

  const [hasMounted, setHasMounted] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let isMounted = true

    async function syncUser() {
      setHasMounted(true)

      try {
        // Always validate with /auth/me. Do not trust stale localStorage here,
        // otherwise a supplier can force /PDV after changing company/session.
        const result = await me()

        if (!isMounted) return

        // Keep localStorage fresh, but do not dispatch here; otherwise the guard
        // would react to its own update and loop.
        localStorage.setItem('ordr-user', JSON.stringify(result.user))

        if (isSupplierCompany(result.user.currentCompany)) {
          if (hasMultipleCompanies(result.user)) {
            router.replace('/selecionar-empresa/')
          } else {
            window.location.href = SUPPLIERS_APP_URL
          }
          return
        }

        setUser(result.user)
      } catch {
        if (!isMounted) return

        localStorage.removeItem('ordr-user')

        const next = pathname && pathname !== '/login' ? `?next=${encodeURIComponent(pathname)}` : ''
        router.replace(`/login${next}`)
      }
    }

    syncUser()

    function handleStorageUpdated() {
      // Cross-tab changes should be validated against the API again.
      syncUser()
    }

    window.addEventListener('storage', handleStorageUpdated)

    return () => {
      isMounted = false
      window.removeEventListener('storage', handleStorageUpdated)
    }
  }, [pathname, router])

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
  user,
}: {
  title?: string
  description?: string
  user?: AuthUser | null
}) {
  const fallbackPath = getFirstAllowedPath(user)

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        <Link
          href={fallbackPath}
          className="mt-6 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          Ir para uma área disponível
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
  const { isReady, user, hasAccess } = usePermissionGuard(permissions)

  if (!isReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
        Carregando permissões...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
        Redirecionando para login...
      </div>
    )
  }

  if (isSupplierCompany(user.currentCompany)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
        Redirecionando para o painel correto...
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <PermissionBlocked
        user={user}
        title={fallbackTitle}
        description={fallbackDescription}
      />
    )
  }

  return <>{children}</>
}
