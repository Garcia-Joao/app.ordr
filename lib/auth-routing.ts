import type { AuthUser } from '@/lib/api/auth'
import { canAny } from '@/lib/permissions'

export type AppRouteAccess = {
  path: string
  label: string
  permissions: string[]
}

export const APP_ROUTE_ACCESS: AppRouteAccess[] = [
  {
    path: '/PDV/',
    label: 'PDV',
    permissions: ['pdv.view', 'orders.create'],
  },
  {
    path: '/interno/',
    label: 'Interno',
    permissions: ['interno.view'],
  },
  {
    path: '/pedidos/',
    label: 'Pedidos',
    permissions: ['orders.view', 'pdv.view'],
  },
  {
    path: '/produtos/',
    label: 'Produtos',
    permissions: ['products.view'],
  },
  {
    path: '/cardapios/',
    label: 'Cardápios',
    permissions: ['products.view'],
  },
  {
    path: '/clientes/',
    label: 'Clientes',
    permissions: ['customers.view'],
  },
  {
    path: '/estoque/',
    label: 'Estoque',
    permissions: ['stock.view'],
  },
  {
    path: '/compras/',
    label: 'Compras',
    permissions: [
      'buys.view',
      'buys.create',
      'buys.manage',
      'stock.quickBuy',
      'stock.purchase.create',
    ],
  },
  {
    path: '/fornecedores/',
    label: 'Fornecedores',
    permissions: ['suppliers.view', 'suppliers.manage'],
  },
  {
    path: '/eventos/',
    label: 'Eventos',
    permissions: ['events.view'],
  },
  {
    path: '/pessoas/',
    label: 'Pessoas',
    permissions: ['people.view'],
  },
  {
    path: '/relatorios/',
    label: 'Relatórios',
    permissions: ['reports.view'],
  },
  {
    path: '/impressoras/',
    label: 'Impressoras',
    permissions: ['printers.view'],
  },
  {
    path: '/terminal/',
    label: 'Terminal',
    permissions: ['printers.view', 'printers.update'],
  },
  {
    path: '/dispositivos/',
    label: 'Dispositivos',
    permissions: ['devices.view', 'devices.manage', 'settings.view'],
  },
  {
    path: '/configuracoes/',
    label: 'Configurações',
    permissions: ['settings.view'],
  },
  {
    path: '/acessos/',
    label: 'Acessos',
    permissions: ['roles.view', 'roles.manage', 'users.view', 'users.manage'],
  },
  {
    path: '/auditoria/',
    label: 'Auditoria',
    permissions: ['audit.view'],
  },
]

export function getFirstAllowedPath(user: AuthUser | null | undefined) {
  if (!user) return '/login/'

  if (String(user.currentCompany?.companyType ?? '').toUpperCase() === 'SUPPLIER') {
    return '/selecionar-empresa/'
  }

  const route = APP_ROUTE_ACCESS.find((item) => {
    return canAny(user, item.permissions)
  })

  return route?.path ?? '/login/'
}