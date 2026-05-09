'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileClock,
  CalendarDays,
  HandCoins,
  MoreHorizontal,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { canAny, getStoredUser } from '@/lib/permissions'
import type { AuthUser } from '@/lib/api/auth'

type MobileNavItem = {
  href: string
  label: string
  icon: ElementType
  requiredPermissions: string[]
  priority: number
}

const mobileNavItems: MobileNavItem[] = [
  {
    href: '/PDV',
    label: 'PDV',
    icon: ShoppingCart,
    requiredPermissions: ['pdv.view', 'orders.create'],
    priority: 1,
  },
  {
    href: '/interno',
    label: 'Interno',
    icon: HandCoins,
    requiredPermissions: ['interno.view'],
    priority: 2,
  },
  {
    href: '/pedidos',
    label: 'Pedidos',
    icon: ClipboardList,
    requiredPermissions: ['orders.view'],
    priority: 3,
  },
  {
    href: '/clientes',
    label: 'Clientes',
    icon: Users,
    requiredPermissions: ['customers.view'],
    priority: 4,
  },
  {
    href: '/produtos',
    label: 'Produtos',
    icon: Package,
    requiredPermissions: ['products.view'],
    priority: 5,
  },
  {
    href: '/estoque',
    label: 'Estoque',
    icon: Boxes,
    requiredPermissions: ['stock.view'],
    priority: 6,
  },
  {
    href: '/compras',
    label: 'Compras',
    icon: ShoppingCart,
    requiredPermissions: ['buys.view', 'buys.create', 'buys.manage', 'stock.quickBuy', 'stock.purchase.create'],
    priority: 7,
  },
  {
    href: '/relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    requiredPermissions: ['reports.view'],
    priority: 8,
  },
  {
    href: '/acessos',
    label: 'Acessos',
    icon: ShieldCheck,
    requiredPermissions: ['roles.view', 'roles.manage', 'users.view', 'users.manage'],
    priority: 9,
  },
  {
    href: '/auditoria',
    label: 'Auditoria',
    icon: FileClock,
    requiredPermissions: ['audit.view'],
    priority: 10,
  },

  {
    href: '/pessoas',
    label: 'Pessoas',
    icon: UserCog,
    requiredPermissions: ['people.view', 'people.manage', 'staffEvaluations.view'],
    priority: 11,
  },
  {
    href: '/eventos',
    label: 'Eventos',
    icon: CalendarDays,
    requiredPermissions: ['events.view', 'events.manage'],
    priority: 12,
  },
  {
    href: '/configuracoes',
    label: 'Config.',
    icon: Settings,
    requiredPermissions: ['settings.view'],
    priority: 13,
  },
]

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  useEffect(() => {
    setCurrentUser(getStoredUser())

    function handleUserUpdated() {
      setCurrentUser(getStoredUser())
    }

    window.addEventListener('storage', handleUserUpdated)
    window.addEventListener('ordr-user-updated', handleUserUpdated)

    return () => {
      window.removeEventListener('storage', handleUserUpdated)
      window.removeEventListener('ordr-user-updated', handleUserUpdated)
    }
  }, [])

  useEffect(() => {
    setIsMoreOpen(false)
  }, [pathname])

  const visibleItems = useMemo(() => {
    return mobileNavItems
      .filter((item) => canAny(currentUser, item.requiredPermissions))
      .sort((a, b) => a.priority - b.priority)
  }, [currentUser])

  const primaryItems = visibleItems.slice(0, 4)
  const overflowItems = visibleItems.slice(4)

  if (visibleItems.length === 0) return null

  return (
    <>
      {isMoreOpen && overflowItems.length > 0 && (
        <div className="fixed inset-x-3 bottom-[86px] z-40 rounded-3xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {overflowItems.map((item) => {
              const Icon = item.icon
              const active = isRouteActive(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-3 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-2 shadow-2xl backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {primaryItems.map((item) => {
            const Icon = item.icon
            const active = isRouteActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}

          {overflowItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMoreOpen((current) => !current)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition ${
                isMoreOpen
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Mais</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
