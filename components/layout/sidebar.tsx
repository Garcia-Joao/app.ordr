'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShoppingCart,
  Package,
  Printer,
  Monitor,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  HandCoins,
  Boxes,
  Moon,
  Sun,
  LayoutDashboard,
  SlidersHorizontal,
  UserRoundCog,
  CalendarDays,
  ShieldCheck,
  FileClock,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { canAny, getStoredUser } from '@/lib/permissions'
import { OrdrFullLogo, OrdrIcon } from '@/components/brand/ordr-brand'
import type { AuthUser } from '@/lib/api/auth'

type NavItem = {
  href: string
  icon: React.ElementType
  label: string
  description: string
  requiredPermissions?: string[]
}

type NavGroup = {
  id: string
  title: string
  icon: React.ElementType
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'operation',
    title: 'Operação',
    icon: LayoutDashboard,
    items: [
      {
        href: '/PDV',
        icon: ShoppingCart,
        label: 'PDV',
        description: 'Ponto de venda principal',
        requiredPermissions: ['pdv.view', 'orders.create'],
      },
      {
        href: '/interno',
        icon: HandCoins,
        label: 'PDV Interno',
        description: 'Contas internas do dia',
        requiredPermissions: ['interno.view'],
      },
      {
        href: '/pedidos',
        icon: ClipboardList,
        label: 'Pedidos',
        description: 'Pedidos e cancelamentos',
        requiredPermissions: ['orders.view'],
      },
      {
        href: '/clientes',
        icon: Users,
        label: 'Clientes',
        description: 'Cadastro de clientes',
        requiredPermissions: ['customers.view'],
      },
    ],
  },
  {
    id: 'management',
    title: 'Gestão',
    icon: SlidersHorizontal,
    items: [
      {
        href: '/produtos',
        icon: Package,
        label: 'Produtos',
        description: 'Cardápio e preços',
        requiredPermissions: ['products.view'],
      },
      {
        href: '/estoque',
        icon: Boxes,
        label: 'Estoque',
        description: 'Receitas, custos e produção',
        requiredPermissions: ['stock.view'],
      },
      {
        href: '/compras',
        icon: ShoppingCart,
        label: 'Compras',
        description: 'Pedidos de compra e recebimento',
        requiredPermissions: ['buys.view', 'buys.manage', 'stock.quickBuy', 'stock.purchase.create'],
      },
      {
        href: '/pessoas',
        icon: UserRoundCog,
        label: 'Pessoas',
        description: 'Equipe, músicos e freelancers',
        requiredPermissions: ['people.view'],
      },
      {
        href: '/eventos',
        icon: CalendarDays,
        label: 'Eventos',
        description: 'Agenda e equipe de eventos',
        requiredPermissions: ['events.view'],
      },
      {
        href: '/relatorios',
        icon: BarChart3,
        label: 'Relatórios',
        description: 'Vendas e análises',
        requiredPermissions: ['reports.view'],
      },
    ],
  },
  {
    id: 'system',
    title: 'Sistema',
    icon: Settings,
    items: [
      {
        href: '/impressoras',
        icon: Printer,
        label: 'Impressões',
        description: 'Tickets e térmicas',
        requiredPermissions: ['printers.view'],
      },
      {
        href: '/dispositivos',
        icon: Monitor,
        label: 'Dispositivos',
        description: 'Terminais e acessos',
        requiredPermissions: ['settings.view'],
      },
      {
        href: '/acessos',
        icon: ShieldCheck,
        label: 'Acessos',
        description: 'Cargos e permissões',
        requiredPermissions: ['roles.view', 'roles.manage', 'users.view', 'users.manage'],
      },
      {
        href: '/auditoria',
        icon: FileClock,
        label: 'Auditoria',
        description: 'Histórico de alterações',
        requiredPermissions: ['audit.view'],
      },
      {
        href: '/configuracoes',
        icon: Settings,
        label: 'Configurações',
        description: 'Ajustes do sistema',
        requiredPermissions: ['settings.view'],
      },
    ],
  },
]

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getInitialOpenGroups(pathname: string) {
  const state: Record<string, boolean> = {}

  for (const group of navGroups) {
    const hasActiveItem = group.items.some((item) =>
      isRouteActive(pathname, item.href)
    )

    state[group.id] = hasActiveItem || group.id === 'operation'
  }

  return state
}

export function Sidebar() {
  const pathname = usePathname()

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    getInitialOpenGroups(pathname)
  )

  useEffect(() => {
    setCurrentUser(getStoredUser())

    function handleStorage() {
      setCurrentUser(getStoredUser())
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('ordr-user-updated', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('ordr-user-updated', handleStorage)
    }
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('ordr-theme') as 'light' | 'dark' | null

    const initialTheme =
      savedTheme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

    setTheme(initialTheme)
    document.documentElement.classList.toggle('dark', initialTheme === 'dark')
  }, [])

  const visibleNavGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          canAny(currentUser, item.requiredPermissions ?? [])
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [currentUser])

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current }

      for (const group of visibleNavGroups) {
        const hasActiveItem = group.items.some((item) =>
          isRouteActive(pathname, item.href)
        )

        if (hasActiveItem) {
          next[group.id] = true
        }
      }

      return next
    })
  }, [pathname, visibleNavGroups])

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'

      localStorage.setItem('ordr-theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')

      return next
    })
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }))
  }

  const activeGroupTitle = useMemo(() => {
    const group = visibleNavGroups.find((navGroup) =>
      navGroup.items.some((item) => isRouteActive(pathname, item.href))
    )

    return group?.title ?? null
  }, [pathname, visibleNavGroups])

  return (
    <aside
      className={`group/sidebar relative flex h-screen flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out ${collapsed ? 'w-[78px]' : 'w-[272px]'
        }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sidebar-primary/10 to-transparent" />

      <div className="relative border-b border-sidebar-border px-3 py-4">
        <div
          className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'justify-between'
            }`}
        >
          <Link
            href="/PDV"
            title={collapsed ? 'PDV' : undefined}
            className={`flex min-w-0 items-center gap-3 transition-all duration-300 ${collapsed ? 'justify-center' : ''
              }`}
          >
            {collapsed ? (
              <OrdrIcon size="sm" rotateOnHover ariaLabel="ORDR" />
            ) : (
              <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <OrdrFullLogo className="h-12 w-auto max-w-[150px]" textClassName="text-sidebar-foreground" />
                <p className="mt-1 truncate text-xs text-sidebar-foreground/55">
                  Bar, eventos e comandas
                </p>
              </div>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Recolher menu"
              aria-label="Recolher menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-105"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expandir menu"
            aria-label="Expandir menu"
            className="mt-3 flex h-9 w-full items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-105"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {!collapsed && activeGroupTitle && (
        <div className="relative px-4 pt-4">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
              Área atual
            </p>
            <p className="mt-1 text-sm font-semibold text-sidebar-foreground">
              {activeGroupTitle}
            </p>
          </div>
        </div>
      )}

      <nav className="relative flex-1 overflow-y-auto px-2 py-4">
        <div className="space-y-3">
          {visibleNavGroups.map((group) => {
            const GroupIcon = group.icon
            const isOpen = collapsed || openGroups[group.id]
            const hasActiveItem = group.items.some((item) =>
              isRouteActive(pathname, item.href)
            )

            return (
              <section
                key={group.id}
                className={`rounded-2xl transition-colors duration-200 ${!collapsed && hasActiveItem ? 'bg-sidebar-accent/25' : ''
                  }`}
              >
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <GroupIcon className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/45" />
                      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em]">
                        {group.title}
                      </span>
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'
                        }`}
                    />
                  </button>
                ) : (
                  <div
                    title={group.title}
                    className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/45"
                  >
                    <GroupIcon className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`grid transition-all duration-300 ease-out ${isOpen
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                    }`}
                >
                  <div className="overflow-hidden">
                    <ul className="space-y-1 pb-2">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const isActive = isRouteActive(pathname, item.href)

                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              title={collapsed ? item.label : undefined}
                              className={`relative flex items-center rounded-2xl transition-all duration-200 ${collapsed
                                ? 'mx-auto h-11 w-11 justify-center'
                                : 'gap-3 px-3 py-3'
                                } ${isActive
                                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                                  : 'text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                }`}
                            >
                              {isActive && (
                                <span
                                  className={`absolute rounded-full bg-sidebar-primary-foreground/80 ${collapsed
                                    ? '-right-1 top-1/2 h-5 w-1 -translate-y-1/2'
                                    : 'left-1 top-1/2 h-6 w-1 -translate-y-1/2'
                                    }`}
                                />
                              )}

                              <Icon
                                className={`h-5 w-5 shrink-0 transition-transform duration-200 ${isActive ? 'scale-105' : 'group-hover/sidebar:scale-100'
                                  }`}
                              />

                              {!collapsed && (
                                <div className="min-w-0 animate-in fade-in slide-in-from-left-1 duration-200">
                                  <p className="truncate text-sm font-semibold">
                                    {item.label}
                                  </p>
                                  <p
                                    className={`truncate text-xs ${isActive
                                      ? 'text-sidebar-primary-foreground/70'
                                      : 'text-sidebar-foreground/45'
                                      }`}
                                  >
                                    {item.description}
                                  </p>
                                </div>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </nav>

      <div className="relative border-t border-sidebar-border p-3">
        <div
          className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-3'
            }`}
        >
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground/70">
                Aparência
              </p>
              <p className="text-[11px] text-sidebar-foreground/45">
                {theme === 'dark' ? 'Tema escuro' : 'Tema claro'}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className={`relative flex h-9 w-[62px] shrink-0 items-center rounded-full border border-sidebar-border bg-sidebar-accent/70 p-1 transition-colors duration-300 hover:bg-sidebar-accent ${theme === 'dark' ? 'justify-end' : 'justify-start'
              }`}
          >
            <span
              className={`absolute inset-y-1 left-1 h-7 w-7 rounded-full bg-sidebar-primary shadow-sm transition-transform duration-300 ease-out ${theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-0'
                }`}
            />

            <span className="relative z-10 flex h-7 w-7 items-center justify-center">
              <Sun
                className={`absolute h-4 w-4 text-sidebar-primary-foreground transition-all duration-300 ${theme === 'light'
                  ? 'rotate-0 scale-100 opacity-100'
                  : 'rotate-90 scale-50 opacity-0'
                  }`}
              />
              <Moon
                className={`absolute h-4 w-4 text-sidebar-primary-foreground transition-all duration-300 ${theme === 'dark'
                  ? 'rotate-0 scale-100 opacity-100'
                  : '-rotate-90 scale-50 opacity-0'
                  }`}
              />
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}