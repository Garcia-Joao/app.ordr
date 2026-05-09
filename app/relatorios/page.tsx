'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  History,
  Printer,
  ChevronDown,
  CircleDollarSign,
  Filter,
  LineChart as LineChartIcon,
  Package,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getReportsDashboard,
  getReportsFilterOptions,
  type CustomerReportRow,
  type EventReportRow,
  type ProductReportRow,
  type RecentOrderReportRow,
  type ReportFilters,
  type ReportsDashboard,
  type ReportsFilterOptions,
} from '@/lib/api/reports'
import {
  getProductCostHistory,
  type ProductCostHistoryResponse,
  type ProductCostHistoryRow,
} from '@/lib/api/product-cost-history'

type DashboardModule =
  | 'overview'
  | 'sales'
  | 'products'
  | 'costHistory'
  | 'events'
  | 'customers'
  | 'orders'

type KpiTone = 'primary' | 'success' | 'warning' | 'destructive' | 'muted'

const CHART_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#22c55e', '#6366f1']

const MODULE_ACCENTS: Record<DashboardModule, { icon: string; active: string; hover: string; badge: string }> = {
  overview: { icon: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', active: 'border-cyan-400/50 bg-cyan-500/10 shadow-cyan-500/10', hover: 'hover:border-cyan-400/40 hover:bg-cyan-500/5', badge: 'bg-cyan-500' },
  sales: { icon: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', active: 'border-emerald-400/50 bg-emerald-500/10 shadow-emerald-500/10', hover: 'hover:border-emerald-400/40 hover:bg-emerald-500/5', badge: 'bg-emerald-500' },
  products: { icon: 'border-violet-400/30 bg-violet-500/15 text-violet-700 dark:text-violet-300', active: 'border-violet-400/50 bg-violet-500/10 shadow-violet-500/10', hover: 'hover:border-violet-400/40 hover:bg-violet-500/5', badge: 'bg-violet-500' },
  costHistory: { icon: 'border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300', active: 'border-fuchsia-400/50 bg-fuchsia-500/10 shadow-fuchsia-500/10', hover: 'hover:border-fuchsia-400/40 hover:bg-fuchsia-500/5', badge: 'bg-fuchsia-500' },
  events: { icon: 'border-amber-400/30 bg-amber-500/15 text-amber-700 dark:text-amber-300', active: 'border-amber-400/50 bg-amber-500/10 shadow-amber-500/10', hover: 'hover:border-amber-400/40 hover:bg-amber-500/5', badge: 'bg-amber-500' },
  customers: { icon: 'border-rose-400/30 bg-rose-500/15 text-rose-700 dark:text-rose-300', active: 'border-rose-400/50 bg-rose-500/10 shadow-rose-500/10', hover: 'hover:border-rose-400/40 hover:bg-rose-500/5', badge: 'bg-rose-500' },
  orders: { icon: 'border-slate-400/30 bg-slate-500/15 text-slate-700 dark:text-slate-200', active: 'border-slate-400/50 bg-slate-500/10 shadow-slate-500/10', hover: 'hover:border-slate-400/40 hover:bg-slate-500/5', badge: 'bg-slate-500' },
}

const defaultFilters: ReportFilters = {
  fromDate: toDateInputValue(new Date()),
  toDate: toDateInputValue(new Date()),
  status: 'all',
  paymentMethod: 'all',
  eventDateId: 'all',
  salesEnvironmentId: 'all',
  categoryId: 'all',
  productId: 'all',
  customerId: 'all',
  internalCustomerId: 'all',
  taxApplied: 'all',
  comanda: '',
}

const modules: Array<{
  id: DashboardModule
  title: string
  description: string
  icon: React.ReactNode
}> = [
  {
    id: 'overview',
    title: 'Visão geral',
    description: 'Saúde financeira e indicadores principais.',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: 'sales',
    title: 'Vendas',
    description: 'Receita por dia, hora, status e pagamento.',
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    id: 'products',
    title: 'Produtos',
    description: 'Ranking de receita, custo, lucro e margem.',
    icon: <Package className="h-4 w-4" />,
  },
  {
    id: 'costHistory',
    title: 'Histórico de custos',
    description: 'Evolução de custo por produto e categoria.',
    icon: <History className="h-4 w-4" />,
  },
  {
    id: 'events',
    title: 'Eventos',
    description: 'Resultado por evento com custos detalhados.',
    icon: <Target className="h-4 w-4" />,
  },
  {
    id: 'customers',
    title: 'Clientes',
    description: 'Comandas, clientes e consumo interno.',
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: 'orders',
    title: 'Pedidos',
    description: 'Auditoria detalhada dos pedidos filtrados.',
    icon: <ReceiptText className="h-4 w-4" />,
  },
]

function formatBRL(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatNumber(value: number | string | null | undefined, digits = 0) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatPercent(value: number | string | null | undefined) {
  return `${formatNumber(value, 1)}%`
}

function toDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDateKey(value?: string | Date | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function getStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    cancelled: 'Cancelado',
  }
  return labels[status ?? ''] ?? status ?? '-'
}

function getPaymentLabel(method?: string | null) {
  const labels: Record<string, string> = {
    money: 'Dinheiro',
    pix: 'Pix',
    credit: 'Crédito',
    debit: 'Débito',
    unknown: 'Sem método',
  }
  return labels[method ?? 'unknown'] ?? method ?? 'Sem método'
}

function getProfitTone(value: number): string {
  if (value > 0) return 'text-success'
  if (value < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

function getKpiTone(value: number): KpiTone {
  if (value > 0) return 'success'
  if (value < 0) return 'destructive'
  return 'muted'
}

function formatCostPerUnit(value: number | string | null | undefined, unit?: string | null) {
  const numericValue = Number(value ?? 0)
  const unitLabel = unit && unit !== 'unit' ? unit : 'un.'

  return `${formatBRL(numericValue)} / ${unitLabel}`
}

function getCostDeltaClass(value?: number | null) {
  if (value == null) return 'text-muted-foreground'
  if (value > 0) return 'text-rose-500'
  if (value < 0) return 'text-emerald-500'
  return 'text-muted-foreground'
}

function getCostDeltaLabel(value?: number | null) {
  if (value == null) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatBRL(value)}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-border bg-popover p-3 text-xs shadow-xl">
      {label && <p className="mb-2 font-semibold text-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((item: any, index: number) => {
          const name = item.name ?? item.dataKey
          const isMoney = ['Receita', 'Custo', 'Lucro', 'Faturamento', 'Compras', 'Equipe'].some((key) =>
            String(name).includes(key)
          )

          return (
            <p key={`${item.dataKey}-${index}`} className="flex items-center justify-between gap-6 text-muted-foreground">
              <span>{name}</span>
              <span className="font-medium text-foreground">
                {isMoney ? formatBRL(item.value) : formatNumber(item.value)}
              </span>
            </p>
          )
        })}
      </div>
    </div>
  )
}

export default function RelatoriosPage() {
  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null)
  const [filterOptions, setFilterOptions] = useState<ReportsFilterOptions | null>(null)
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters)
  const [activeModule, setActiveModule] = useState<DashboardModule>('overview')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportModules, setExportModules] = useState<Record<DashboardModule, boolean>>(() => ({
    overview: true,
    sales: true,
    products: true,
    costHistory: false,
    events: true,
    customers: true,
    orders: false,
  }))

  async function loadData(nextFilters = filters) {
    try {
      setIsLoading(true)
      const [options, data] = await Promise.all([
        getReportsFilterOptions(),
        getReportsDashboard(nextFilters),
      ])
      setFilterOptions(options)
      setDashboard(data)
    } catch (error) {
      console.error('Erro ao carregar dashboard de relatórios:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(defaultFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function applyQuickRange(range: 'today' | '7d' | '30d' | 'month' | 'all') {
    const today = new Date()
    const next = { ...filters }

    if (range === 'today') {
      next.fromDate = toDateInputValue(today)
      next.toDate = toDateInputValue(today)
    }

    if (range === '7d') {
      next.fromDate = toDateInputValue(addDays(today, -6))
      next.toDate = toDateInputValue(today)
    }

    if (range === '30d') {
      next.fromDate = toDateInputValue(addDays(today, -29))
      next.toDate = toDateInputValue(today)
    }

    if (range === 'month') {
      next.fromDate = toDateInputValue(monthStart(today))
      next.toDate = toDateInputValue(today)
    }

    if (range === 'all') {
      next.fromDate = ''
      next.toDate = ''
    }

    setFilters(next)
    loadData(next)
  }

  function resetFilters() {
    setFilters(defaultFilters)
    setSearch('')
    loadData(defaultFilters)
  }

  function toggleExportModule(moduleId: DashboardModule) {
    setExportModules((current) => ({ ...current, [moduleId]: !current[moduleId] }))
  }

  function setAllExportModules(value: boolean) {
    setExportModules({ overview: value, sales: value, products: value, costHistory: value, events: value, customers: value, orders: value })
  }

  function handleExportPdf() {
    if (!dashboard) {
      alert('Os dados do relatório ainda não foram carregados.')
      return
    }

    const selectedModules = modules.filter((module) => exportModules[module.id]).map((module) => module.id)
    if (selectedModules.length === 0) {
      alert('Selecione pelo menos um módulo para exportar.')
      return
    }

    const popup = window.open('', '_blank', 'width=1200,height=900')
    if (!popup) {
      alert('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups do navegador.')
      return
    }

    popup.document.open()
    popup.document.write(buildReportPdfHtml(dashboard, filters, selectedModules))
    popup.document.close()
    popup.focus()
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = dashboard?.tables.products ?? []
    if (!term) return rows

    return rows.filter((item) =>
      item.name.toLowerCase().includes(term) || item.categoryName.toLowerCase().includes(term)
    )
  }, [dashboard, search])

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = dashboard?.tables.events ?? []
    if (!term) return rows
    return rows.filter((item) => item.title.toLowerCase().includes(term))
  }, [dashboard, search])

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = dashboard?.tables.customers ?? []
    if (!term) return rows
    return rows.filter((item) => item.name.toLowerCase().includes(term))
  }, [dashboard, search])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = dashboard?.tables.recentOrders ?? []
    if (!term) return rows

    return rows.filter((item) =>
      item.id.toLowerCase().includes(term) ||
      String(item.comanda).includes(term) ||
      (item.customerName ?? '').toLowerCase().includes(term) ||
      (item.eventTitle ?? '').toLowerCase().includes(term) ||
      item.items.some((orderItem) => orderItem.name.toLowerCase().includes(term))
    )
  }, [dashboard, search])

  if (isLoading && !dashboard) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
        Carregando relatório avançado...
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        Não foi possível carregar os relatórios.
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col overflow-visible bg-gradient-to-br from-background via-background to-cyan-500/5 lg:h-full lg:overflow-hidden mobile-page-scroll">
      <header className="border-b border-border bg-card/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 via-violet-500/15 to-emerald-500/20 ring-1 ring-cyan-400/30">
              <BarChart3 className="h-6 w-6 text-cyan-500 dark:text-cyan-300" />
            </div>
            <div>
              <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  Dashboard modular
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Escolha um módulo para investigar vendas, custos, lucro, eventos, clientes ou pedidos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <QuickRangeButton onClick={() => applyQuickRange('today')}>Hoje</QuickRangeButton>
            <QuickRangeButton onClick={() => applyQuickRange('7d')}>7 dias</QuickRangeButton>
            <QuickRangeButton onClick={() => applyQuickRange('30d')}>30 dias</QuickRangeButton>
            <QuickRangeButton onClick={() => applyQuickRange('month')}>Mês</QuickRangeButton>
            <QuickRangeButton onClick={() => applyQuickRange('all')}>Tudo</QuickRangeButton>
            <button
              onClick={() => loadData(filters)}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 text-sm font-semibold text-white shadow-sm hover:from-cyan-400 hover:to-violet-400"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[150px_150px_1fr_160px_auto_auto]">
          <DateFilter label="De" value={filters.fromDate ?? ''} onChange={(value) => updateFilter('fromDate', value)} />
          <DateFilter label="Até" value={filters.toDate ?? ''} onChange={(value) => updateFilter('toDate', value)} />

          <div className="relative">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Busca</span>
            <Search className="absolute left-3 top-[34px] h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produto, evento, cliente, comanda ou pedido..."
              className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <SelectFilter label="Status" value={filters.status ?? 'all'} onChange={(value) => updateFilter('status', value as any)}>
            <option value="all">Todos</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
            <option value="cancelled">Cancelados</option>
          </SelectFilter>

          <button
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className={`mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
              showAdvancedFilters
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-secondary'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>

          <button
            onClick={resetFilters}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary"
          >
            <X className="h-4 w-4" />
            Limpar
          </button>
        </div>

        {showAdvancedFilters && (
          <AdvancedFilters
            filters={filters}
            options={filterOptions}
            updateFilter={updateFilter}
            onApply={() => loadData(filters)}
          />
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-visible xl:grid-cols-[280px_1fr] xl:overflow-hidden">
        <aside className="border-b border-border bg-card/60 p-3 xl:overflow-y-auto xl:border-b-0 xl:border-r xl:p-4">
          <div className="mb-4 rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {(filters.fromDate || filters.toDate)
                ? `${filters.fromDate ? formatDate(filters.fromDate) : 'Início'} → ${filters.toDate ? formatDate(filters.toDate) : 'Hoje'}`
                : 'Todos os dados'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {dashboard.summary.totalOrders} pedidos no filtro atual.
            </p>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 xl:block xl:space-y-2 xl:overflow-visible xl:pb-0">
            {modules.map((module) => (
              <ModuleButton
                key={module.id}
                active={activeModule === module.id}
                title={module.title}
                description={module.description}
                icon={module.icon}
                onClick={() => setActiveModule(module.id)}
              />
            ))}
          </nav>
        </aside>

        <main className="min-h-0 overflow-visible p-4 sm:p-6 xl:overflow-y-auto">
          {activeModule === 'overview' && <OverviewModule dashboard={dashboard} onDayClick={setSelectedDayDate} />}
          {activeModule === 'sales' && <SalesModule dashboard={dashboard} />}
          {activeModule === 'products' && <ProductsModule dashboard={dashboard} rows={filteredProducts} />}
          {activeModule === 'costHistory' && (
            <CostHistoryModule
              filters={filters}
              options={filterOptions}
            />
          )}
          {activeModule === 'events' && (
            <EventsModule
              dashboard={dashboard}
              rows={filteredEvents}
              expandedEventId={expandedEventId}
              setExpandedEventId={setExpandedEventId}
            />
          )}
          {activeModule === 'customers' && <CustomersModule rows={filteredCustomers} />}
          {activeModule === 'orders' && (
            <OrdersModule
              rows={filteredOrders}
              expandedOrderId={expandedOrderId}
              setExpandedOrderId={setExpandedOrderId}
            />
          )}
        </main>
      </div>

      {showExportModal && (
        <ExportPdfModal
          selectedModules={exportModules}
          onToggle={toggleExportModule}
          onSelectAll={() => setAllExportModules(true)}
          onClear={() => setAllExportModules(false)}
          onExport={handleExportPdf}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {selectedDayDate && (
        <DayDetailsModal
          date={selectedDayDate}
          dashboard={dashboard}
          onClose={() => setSelectedDayDate(null)}
        />
      )}
    </div>
  )
}

function AdvancedFilters({
  filters,
  options,
  updateFilter,
  onApply,
}: {
  filters: ReportFilters
  options: ReportsFilterOptions | null
  updateFilter: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void
  onApply: () => void
}) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Filtros avançados</h2>
          <p className="text-xs text-muted-foreground">Cruze os dados por evento, ambiente, produto, cliente e impostos.</p>
        </div>
        <button
          onClick={onApply}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Filter className="h-3.5 w-3.5" />
          Aplicar filtros
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SelectFilter label="Pagamento" value={filters.paymentMethod ?? 'all'} onChange={(value) => updateFilter('paymentMethod', value as any)}>
          <option value="all">Todos</option>
          <option value="money">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="credit">Crédito</option>
          <option value="debit">Débito</option>
          <option value="unknown">Sem método</option>
        </SelectFilter>

        <SelectFilter label="Evento" value={filters.eventDateId ?? 'all'} onChange={(value) => updateFilter('eventDateId', value)}>
          <option value="all">Todos</option>
          {(options?.events ?? []).map((event) => (
            <option key={event.id} value={event.id}>{event.title} • {formatDate(event.startAt)}</option>
          ))}
        </SelectFilter>

        <SelectFilter label="Ambiente" value={filters.salesEnvironmentId ?? 'all'} onChange={(value) => updateFilter('salesEnvironmentId', value)}>
          <option value="all">Todos</option>
          {(options?.environments ?? []).map((environment) => (
            <option key={environment.id} value={environment.id}>{environment.name}</option>
          ))}
        </SelectFilter>

        <SelectFilter label="Categoria" value={filters.categoryId ?? 'all'} onChange={(value) => updateFilter('categoryId', value)}>
          <option value="all">Todas</option>
          {(options?.categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </SelectFilter>

        <SelectFilter label="Produto" value={filters.productId ?? 'all'} onChange={(value) => updateFilter('productId', value)}>
          <option value="all">Todos</option>
          {(options?.products ?? [])
            .filter((product) => !filters.categoryId || filters.categoryId === 'all' || product.categoryId === filters.categoryId)
            .map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
        </SelectFilter>

        <SelectFilter label="Taxa" value={filters.taxApplied ?? 'all'} onChange={(value) => updateFilter('taxApplied', value as any)}>
          <option value="all">Todos</option>
          <option value="true">Com taxa</option>
          <option value="false">Sem taxa</option>
        </SelectFilter>

        <SelectFilter label="Cliente interno" value={filters.internalCustomerId ?? 'all'} onChange={(value) => updateFilter('internalCustomerId', value)}>
          <option value="all">Todos</option>
          {(options?.internalCustomers ?? []).map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </SelectFilter>

        <SelectFilter label="Cliente" value={filters.customerId ?? 'all'} onChange={(value) => updateFilter('customerId', value)}>
          <option value="all">Todos</option>
          {(options?.customers ?? []).map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </SelectFilter>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Comanda</span>
          <input
            value={filters.comanda ?? ''}
            onChange={(event) => updateFilter('comanda', event.target.value)}
            placeholder="Número da comanda"
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>
    </div>
  )
}

function OverviewModule({ dashboard, onDayClick }: { dashboard: ReportsDashboard; onDayClick: (date: string) => void }) {
  const summary = dashboard.summary

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Visão geral"
        description="Resumo executivo do período filtrado, com receita, custos, lucro e alertas operacionais."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Faturamento pago"
          value={formatBRL(summary.grossRevenue)}
          detail={`${summary.paidOrders} pedidos pagos • ticket ${formatBRL(summary.averageTicket)}`}
          icon={<Wallet className="h-5 w-5" />}
          tone="primary"
        />
        <KpiCard
          title="Lucro estimado"
          value={formatBRL(summary.estimatedProfit)}
          detail={`Margem ${formatPercent(summary.marginPercent)} • custo ${formatBRL(summary.totalCost)}`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone={getKpiTone(summary.estimatedProfit)}
        />
        <KpiCard
          title="Custos totais"
          value={formatBRL(summary.totalCost)}
          detail={`Produtos ${formatBRL(summary.productCost)} • Eventos ${formatBRL(summary.eventCost)}`}
          icon={<Target className="h-5 w-5" />}
          tone="warning"
        />
        <KpiCard
          title="Operação"
          value={`${summary.totalItemsSold} itens`}
          detail={`${summary.totalOrders} pedidos • ${formatPercent(summary.cancellationRate)} cancelamento`}
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="muted"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <HighlightCard
          title="Melhor dia"
          value={dashboard.highlights.bestDay ? formatBRL(dashboard.highlights.bestDay.revenue) : '-'}
          detail={dashboard.highlights.bestDay ? `${formatDate(dashboard.highlights.bestDay.date)} • ${dashboard.highlights.bestDay.paidOrders} pedidos pagos` : 'Sem dados'}
          icon={<Trophy className="h-4 w-4" />}
        />
        <HighlightCard
          title="Melhor horário"
          value={dashboard.highlights.bestHour ? dashboard.highlights.bestHour.hour : '-'}
          detail={dashboard.highlights.bestHour ? `${formatBRL(dashboard.highlights.bestHour.revenue)} em vendas` : 'Sem dados'}
          icon={<LineChartIcon className="h-4 w-4" />}
        />
        <HighlightCard
          title="Produto mais vendido"
          value={dashboard.highlights.bestProduct?.name ?? '-'}
          detail={dashboard.highlights.bestProduct ? `${formatBRL(dashboard.highlights.bestProduct.revenue)} • ${formatNumber(dashboard.highlights.bestProduct.quantity)} un.` : 'Sem dados'}
          icon={<Package className="h-4 w-4" />}
        />
        <HighlightCard
          title="Maior lucro"
          value={dashboard.highlights.bestProfitProduct?.name ?? '-'}
          detail={dashboard.highlights.bestProfitProduct ? `${formatBRL(dashboard.highlights.bestProfitProduct.profit)} de lucro` : 'Sem dados'}
          icon={<Sparkles className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <FinancialEvolutionChart data={dashboard.charts.salesByDay} onDayClick={onDayClick} />
        <CostBreakdownCard dashboard={dashboard} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Top produtos por lucro" description="Ranking rápido dos produtos que mais contribuíram para resultado.">
          <RankingList
            rows={dashboard.charts.productsByProfit.slice(0, 8)}
            getKey={(row) => row.productId}
            getTitle={(row) => row.name}
            getSubtitle={(row) => `${row.categoryName} • margem ${formatPercent(row.marginPercent)}`}
            getValue={(row) => formatBRL(row.profit)}
            getBarValue={(row) => Math.max(0, row.profit)}
          />
        </ChartCard>

        <ChartCard title="Eventos por resultado" description="Eventos com maior lucro estimado no filtro atual.">
          <RankingList
            rows={dashboard.charts.events.slice(0, 8)}
            getKey={(row) => row.eventDateId}
            getTitle={(row) => row.title}
            getSubtitle={(row) => `${formatDate(row.startAt)} • custo ${formatBRL(row.totalCost)}`}
            getValue={(row) => formatBRL(row.profit)}
            getBarValue={(row) => Math.max(0, row.profit)}
          />
        </ChartCard>
      </section>
    </div>
  )
}

function SalesModule({ dashboard }: { dashboard: ReportsDashboard }) {
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Vendas"
        description="Analise quando e como o dinheiro entrou: por dia, hora, status e método de pagamento."
        icon={<Wallet className="h-5 w-5" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Receita paga" value={formatBRL(dashboard.summary.grossRevenue)} detail={`${dashboard.summary.paidOrders} pedidos pagos`} icon={<Wallet className="h-5 w-5" />} tone="primary" />
        <KpiCard title="Pendente" value={formatBRL(dashboard.summary.pendingRevenue)} detail={`${dashboard.summary.pendingOrders} pedidos ainda abertos`} icon={<ReceiptText className="h-5 w-5" />} tone="warning" />
        <KpiCard title="Cancelado" value={formatBRL(dashboard.summary.cancelledRevenue)} detail={`${dashboard.summary.cancelledOrders} pedidos cancelados`} icon={<X className="h-5 w-5" />} tone="destructive" />
        <KpiCard title="Ticket médio" value={formatBRL(dashboard.summary.averageTicket)} detail="Média dos pedidos pagos" icon={<TrendingUp className="h-5 w-5" />} tone="success" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <FinancialEvolutionChart data={dashboard.charts.salesByDay} />
        <PaymentMethodsChart dashboard={dashboard} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SalesByHourChart dashboard={dashboard} />
        <StatusChart dashboard={dashboard} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightMetricCard
          title="Melhor horário geral"
          value={dashboard.highlights.bestHour?.hour ?? '-'}
          detail={dashboard.highlights.bestHour ? `${formatBRL(dashboard.highlights.bestHour.revenue)} • ${dashboard.highlights.bestHour.orders} pedidos` : 'Sem vendas no período'}
          tone="success"
        />
        <InsightMetricCard
          title="Melhor dia geral"
          value={dashboard.highlights.bestDay ? formatDate(dashboard.highlights.bestDay.date) : '-'}
          detail={dashboard.highlights.bestDay ? `${formatBRL(dashboard.highlights.bestDay.revenue)} • ${dashboard.highlights.bestDay.paidOrders} pagos` : 'Sem vendas no período'}
          tone="primary"
        />
        <InsightMetricCard
          title="Melhor período do mês"
          value={dashboard.highlights.bestPeriodOfMonth?.period ?? '-'}
          detail={dashboard.highlights.bestPeriodOfMonth ? `${formatBRL(dashboard.highlights.bestPeriodOfMonth.revenue)} • ticket ${formatBRL(dashboard.highlights.bestPeriodOfMonth.averageTicket)}` : 'Sem dados suficientes'}
          tone="warning"
        />
        <InsightMetricCard
          title="Melhor dia da semana"
          value={dashboard.highlights.bestWeekday?.weekday ?? '-'}
          detail={dashboard.highlights.bestWeekday ? `${formatBRL(dashboard.highlights.bestWeekday.revenue)} • ${dashboard.highlights.bestWeekday.paidOrders} pagos` : 'Sem dados suficientes'}
          tone="muted"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Melhor horário por dia" description="Para cada dia do filtro, mostra o horário que mais faturou.">
          <InsightTable
            rows={dashboard.analytics.bestHourByDay.slice(-20)}
            empty="Sem dados de horário por dia."
            columns={[
              { key: 'date', label: 'Dia', render: (row) => formatDate(row.date) },
              { key: 'hour', label: 'Melhor horário' },
              { key: 'paidOrders', label: 'Pedidos pagos' },
              { key: 'revenue', label: 'Receita', render: (row) => formatBRL(row.revenue) },
              { key: 'averageTicket', label: 'Ticket', render: (row) => formatBRL(row.averageTicket) },
            ]}
          />
        </ChartCard>

        <ChartCard title="Melhor dia por semana" description="Dentro de cada semana, mostra o dia com melhor faturamento.">
          <InsightTable
            rows={dashboard.analytics.bestDayByWeek.slice(-16)}
            empty="Sem dados semanais."
            columns={[
              { key: 'weekStart', label: 'Semana', render: (row) => `Semana de ${formatDate(row.weekStart)}` },
              { key: 'date', label: 'Melhor dia', render: (row) => `${row.weekday} • ${formatDate(row.date)}` },
              { key: 'paidOrders', label: 'Pedidos pagos' },
              { key: 'revenue', label: 'Receita', render: (row) => formatBRL(row.revenue) },
              { key: 'profit', label: 'Lucro', render: (row) => <span className={getProfitTone(row.profit)}>{formatBRL(row.profit)}</span> },
            ]}
          />
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Períodos do mês" description="Compara início, meio e fim do mês para entender sazonalidade.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboard.analytics.monthPeriodPerformance}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => formatNumber(Number(value) / 1000, 0) + 'k'} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="revenue" name="Receita" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              <Bar dataKey="profit" name="Lucro" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Dias da semana" description="Ranking de faturamento por dia da semana.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboard.analytics.weekdayPerformance}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="weekday" />
              <YAxis tickFormatter={(value) => formatNumber(Number(value) / 1000, 0) + 'k'} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="revenue" name="Receita" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  )
}

function ProductsModule({ dashboard, rows }: { dashboard: ReportsDashboard; rows: ProductReportRow[] }) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const variationRows = dashboard.charts.productVariations ?? []
  const mostChosenVariation = variationRows[0] ?? null
  const mostExpensiveVariation = [...variationRows].sort((a, b) => b.cost - a.cost)[0] ?? null
  const mostProfitableVariation = [...variationRows].sort((a, b) => b.profit - a.profit)[0] ?? null

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Produtos"
        description="Produtos, categorias e variações: receita, custo, lucro, margem e escolhas mais comuns."
        icon={<Package className="h-5 w-5" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Produto mais vendido"
          value={dashboard.highlights.bestProduct?.name ?? '-'}
          detail={dashboard.highlights.bestProduct ? `${formatNumber(dashboard.highlights.bestProduct.quantity)} vendidos • ${formatBRL(dashboard.highlights.bestProduct.revenue)}` : 'Sem vendas no período'}
          icon={<Trophy className="h-5 w-5" />}
          tone="primary"
        />
        <KpiCard
          title="Maior lucro"
          value={dashboard.highlights.bestProfitProduct?.name ?? '-'}
          detail={dashboard.highlights.bestProfitProduct ? `${formatBRL(dashboard.highlights.bestProfitProduct.profit)} • ${formatPercent(dashboard.highlights.bestProfitProduct.marginPercent)}` : 'Sem lucro no período'}
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="success"
        />
        <KpiCard
          title="Variação mais escolhida"
          value={mostChosenVariation ? mostChosenVariation.optionName : '-'}
          detail={mostChosenVariation ? `${mostChosenVariation.productName} • ${formatNumber(mostChosenVariation.quantity)} usos` : 'Sem variações no período'}
          icon={<Sparkles className="h-5 w-5" />}
          tone="warning"
        />
        <KpiCard
          title="Maior custo em variações"
          value={mostExpensiveVariation ? mostExpensiveVariation.optionName : '-'}
          detail={mostExpensiveVariation ? `${mostExpensiveVariation.productName} • ${formatBRL(mostExpensiveVariation.cost)}` : 'Sem custo de variação'}
          icon={<Package className="h-5 w-5" />}
          tone="muted"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Produtos por faturamento" description="Receita bruta por produto.">
          <RankingList
            rows={dashboard.charts.productsByRevenue.slice(0, 10)}
            getKey={(row) => row.productId}
            getTitle={(row) => row.name}
            getSubtitle={(row) => `${row.categoryName} • ${formatNumber(row.quantity)} vendidos`}
            getValue={(row) => formatBRL(row.revenue)}
            getBarValue={(row) => row.revenue}
          />
        </ChartCard>

        <ChartCard title="Produtos por lucro" description="Resultado estimado por produto.">
          <RankingList
            rows={dashboard.charts.productsByProfit.slice(0, 10)}
            getKey={(row) => row.productId}
            getTitle={(row) => row.name}
            getSubtitle={(row) => `Custo ${formatBRL(row.cost)} • margem ${formatPercent(row.marginPercent)}`}
            getValue={(row) => formatBRL(row.profit)}
            getBarValue={(row) => Math.max(0, row.profit)}
          />
        </ChartCard>

        <ChartCard title="Categorias por lucro" description="Categorias com maior contribuição.">
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={dashboard.charts.categories.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={(value) => formatNumber(value / 1000, 0) + 'k'} />
              <YAxis type="category" dataKey="name" width={96} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="profit" name="Lucro" radius={[0, 8, 8, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <ChartCard title="Variações mais escolhidas" description="Quais opções são selecionadas com mais frequência dentro dos produtos.">
          <VariationRankingList rows={variationRows.slice(0, 12)} />
        </ChartCard>

        <ChartCard title="Lucro por variação" description="Receita incremental, custo e margem das opções selecionadas.">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={[...variationRows].sort((a, b) => b.profit - a.profit).slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={(value) => formatNumber(value / 1000, 0) + 'k'} />
              <YAxis type="category" dataKey="optionName" width={112} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="profit" name="Lucro da variação" radius={[0, 8, 8, 0]} fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <SectionCard title="Tabela de produtos" description="Clique em um produto para ver as variações mais escolhidas, custo, receita incremental e margem.">
        <ProductsTable rows={rows} expandedProductId={expandedProductId} setExpandedProductId={setExpandedProductId} />
      </SectionCard>

      <SectionCard title="Detalhamento de variações" description="Ranking geral de opções por produto, incluindo quantidade, frequência, custo e lucro estimado.">
        <ProductVariationTable rows={variationRows} />
      </SectionCard>
    </div>
  )
}

function VariationRankingList({ rows }: { rows: NonNullable<ProductReportRow['variations']> }) {
  if (!rows.length) return <EmptyState message="Nenhuma variação vendida no período." />

  const max = Math.max(...rows.map((row) => row.quantity), 1)

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const percent = Math.max(5, (row.quantity / max) * 100)
        return (
          <div key={`${row.productId}-${row.variationGroupId}-${row.optionId}`} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{index + 1}. {row.optionName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.productName} • {row.variationGroupName} • frequência {formatPercent(row.attachRatePercent)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">{formatNumber(row.quantity)}</p>
                <p className="text-[11px] text-muted-foreground">seleções</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <MiniMetric label="Receita var." value={formatBRL(row.revenueModifier)} />
              <MiniMetric label="Custo" value={formatBRL(row.cost)} />
              <MiniMetric label="Lucro" value={formatBRL(row.profit)} tone={getProfitTone(row.profit)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CostHistoryModule({
  filters,
  options,
}: {
  filters: ReportFilters
  options: ReportsFilterOptions | null
}) {
  const [history, setHistory] = useState<ProductCostHistoryResponse | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState(filters.productId ?? 'all')
  const [selectedCategoryId, setSelectedCategoryId] = useState(filters.categoryId ?? 'all')
  const [fromDate, setFromDate] = useState(filters.fromDate ?? '')
  const [toDate, setToDate] = useState(filters.toDate ?? '')
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)

  async function loadHistory() {
    try {
      setIsLoadingHistory(true)
      const data = await getProductCostHistory({
        fromDate,
        toDate,
        productId: selectedProductId,
        categoryId: selectedCategoryId,
      })
      setHistory(data)
    } catch (error: any) {
      console.error('Erro ao carregar histórico de custos:', error)
      alert(error?.message || 'Erro ao carregar histórico de custos.')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const safeHistoryRows = history?.rows ?? []
  const safeHistoryByProduct = history?.byProduct ?? []
  const safeHistoryByCategory = history?.byCategory ?? []

  const chartRows = useMemo(() => {
    if (!history) return []

    if (selectedProductId && selectedProductId !== 'all') {
      return safeHistoryRows.map((row) => ({
        label: formatDate(row.createdAt),
        productName: row.productName,
        effectiveCost: Number(row.effectiveCost ?? 0),
        deltaCost: Number(row.deltaCost ?? 0),
        effectiveUnit: row.effectiveUnit ?? 'unit',
      }))
    }

    return safeHistoryByProduct.map((row) => ({
      label: row.productName,
      productName: row.productName,
      effectiveCost: Number(row.lastCost ?? 0),
      deltaCost: Number(row.deltaCost ?? 0),
      effectiveUnit: row.history?.[row.history.length - 1]?.effectiveUnit ?? 'unit',
    }))
  }, [history, selectedProductId])

  function printRows(rows: ProductCostHistoryRow[], title = 'Histórico de custos') {
    const popup = window.open('', '_blank', 'width=1100,height=850')
    if (!popup) {
      alert('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.')
      return
    }

    popup.document.open()
    popup.document.write(buildCostHistoryPrintHtml(title, rows, fromDate, toDate))
    popup.document.close()
    popup.focus()
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Histórico de custos"
        description="Veja como o custo dos produtos mudou com compras, ajustes e alterações de cadastro."
        icon={<History className="h-5 w-5" />}
      />

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_150px_1fr_1fr_auto_auto]">
          <DateFilter label="De" value={fromDate} onChange={setFromDate} />
          <DateFilter label="Até" value={toDate} onChange={setToDate} />

          <SelectFilter label="Categoria" value={selectedCategoryId} onChange={(value) => {
            setSelectedCategoryId(value)
            setSelectedProductId('all')
          }}>
            <option value="all">Todas</option>
            {(options?.categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </SelectFilter>

          <SelectFilter label="Produto" value={selectedProductId} onChange={setSelectedProductId}>
            <option value="all">Todos</option>
            {(options?.products ?? [])
              .filter((product) => selectedCategoryId === 'all' || product.categoryId === selectedCategoryId)
              .map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
          </SelectFilter>

          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => printRows(safeHistoryRows)}
            disabled={safeHistoryRows.length === 0}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </section>

      {isLoadingHistory && !history ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
          Carregando histórico de custos...
        </div>
      ) : !history || safeHistoryRows.length === 0 ? (
        <EmptyState message="Nenhum histórico de custo encontrado para os filtros atuais." />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Mudanças" value={formatNumber(history.summary.totalChanges)} detail={`${(history.summary.productCount ?? history.byProduct?.length ?? 0)} produtos monitorados`} icon={<History className="h-5 w-5" />} tone="primary" />
            <KpiCard title="Aumentos" value={formatNumber((history.summary.increased ?? 0))} detail="Alterações com custo maior" icon={<TrendingUp className="h-5 w-5" />} tone="destructive" />
            <KpiCard title="Reduções" value={formatNumber((history.summary.decreased ?? 0))} detail="Alterações com custo menor" icon={<TrendingUp className="h-5 w-5 rotate-180" />} tone="success" />
            <KpiCard title="Maior variação" value={history.summary.mostChangedProduct?.productName ?? '-'} detail={history.summary.mostChangedProduct ? `${formatPercent(history.summary.mostChangedProduct.deltaPercent ?? 0)} • ${getCostDeltaLabel(history.summary.mostChangedProduct.deltaCost)}` : 'Sem comparação'} icon={<Sparkles className="h-5 w-5" />} tone="warning" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
            <ChartCard title={selectedProductId === 'all' ? 'Último custo por produto' : 'Evolução do custo'} description="Custo efetivo normalizado por unidade base: ml, g ou unidade.">
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => formatBRL(Number(value))} />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0].payload
                    return (
                      <div className="rounded-xl border border-border bg-popover p-3 text-xs shadow-xl">
                        <p className="font-semibold text-foreground">{row.productName}</p>
                        <p className="mt-1 text-foreground">Custo: <strong>{formatCostPerUnit(row.effectiveCost, row.effectiveUnit)}</strong></p>
                        <p className={getCostDeltaClass(row.deltaCost)}>Variação: {getCostDeltaLabel(row.deltaCost)}</p>
                      </div>
                    )
                  }} />
                  <Bar dataKey="effectiveCost" name="Custo efetivo" fill="#a855f7" radius={[8, 8, 0, 0]} />
                  {selectedProductId !== 'all' && <Line dataKey="effectiveCost" name="Linha de custo" stroke="#06b6d4" strokeWidth={3} dot />}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Categorias" description="Categorias com mais mudanças de custo.">
              <RankingList
                rows={safeHistoryByCategory.slice(0, 10)}
                getKey={(row) => row.categoryId ?? 'uncategorized'}
                getTitle={(row) => row.categoryName}
                getSubtitle={(row) => `${row.productCount} produtos • ${row.changes} mudanças`}
                getValue={(row) => formatCostPerUnit(row.averageCost, 'unit')}
                getBarValue={(row) => row.changes}
              />
            </ChartCard>
          </section>

          <SectionCard title="Produtos com histórico" description="Clique para expandir e imprimir um produto específico.">
            <div className="space-y-3">
              {safeHistoryByProduct.map((product) => {
                const expanded = expandedProductId === product.productId
                const unit = product.history[product.history.length - 1]?.effectiveUnit ?? 'unit'
                return (
                  <div key={product.productId} className="rounded-2xl border border-border bg-background p-4">
                    <button type="button" onClick={() => setExpandedProductId(expanded ? null : product.productId)} className="flex w-full items-start justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{product.productName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{product.categoryName} • {product.changes} mudanças • último em {formatDateTime(product.lastChangedAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{formatCostPerUnit(product.lastCost, unit)}</p>
                        <p className={`text-xs font-semibold ${getCostDeltaClass(product.deltaCost)}`}>{getCostDeltaLabel(product.deltaCost)} • {formatPercent(product.deltaPercent ?? 0)}</p>
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-4">
                        <button type="button" onClick={() => printRows(product.history, `Histórico de custo • ${product.productName}`)} className="mb-3 inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary">
                          <Printer className="h-3.5 w-3.5" />
                          Imprimir este produto
                        </button>
                        <CostHistoryRowsTable rows={product.history} compact />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="Lista detalhada de alterações" description="Todos os registros capturados pelo histórico.">
            <CostHistoryRowsTable rows={safeHistoryRows} />
          </SectionCard>
        </>
      )}
    </div>
  )
}

function CostHistoryRowsTable({ rows, compact = false }: { rows: ProductCostHistoryRow[]; compact?: boolean }) {
  if (!rows.length) return <EmptyState message="Nenhuma alteração encontrada." />

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <table className="hidden w-full min-w-[920px] text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Data</th>
            {!compact && <th className="px-3 py-3">Produto</th>}
            <th className="px-3 py-3">Categoria</th>
            <th className="px-3 py-3">Fonte</th>
            <th className="px-3 py-3 text-right">Anterior</th>
            <th className="px-3 py-3 text-right">Novo</th>
            <th className="px-3 py-3 text-right">Variação</th>
            <th className="px-3 py-3">Configuração</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/70 last:border-0">
              <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
              {!compact && <td className="px-3 py-3 font-medium text-foreground">{row.productName}</td>}
              <td className="px-3 py-3 text-muted-foreground">{row.categoryName}</td>
              <td className="px-3 py-3 text-muted-foreground">{row.source}</td>
              <td className="px-3 py-3 text-right">{row.oldEffectiveCost == null ? '-' : formatCostPerUnit(row.oldEffectiveCost, row.effectiveUnit)}</td>
              <td className="px-3 py-3 text-right font-semibold text-foreground">{formatCostPerUnit(row.effectiveCost, row.effectiveUnit)}</td>
              <td className={`px-3 py-3 text-right font-semibold ${getCostDeltaClass(row.deltaCost)}`}>{getCostDeltaLabel(row.deltaCost)}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground">
                {row.referenceCost && row.referenceQuantity ? `Referência: ${formatBRL(row.referenceCost)} / ${formatNumber(row.referenceQuantity, 3)} ${row.stockUnit ?? row.effectiveUnit}` : row.simpleCost ? `Simples: ${formatBRL(row.simpleCost)}` : row.costMode}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{compact ? row.categoryName : row.productName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(row.createdAt)} • {row.source}</p>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${getCostDeltaClass(row.deltaCost)}`}>
                {getCostDeltaLabel(row.deltaCost)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <MiniMetric label="Anterior" value={row.oldEffectiveCost == null ? '-' : formatCostPerUnit(row.oldEffectiveCost, row.effectiveUnit)} />
              <MiniMetric label="Novo" value={formatCostPerUnit(row.effectiveCost, row.effectiveUnit)} />
              {!compact && <MiniMetric label="Categoria" value={row.categoryName ?? 'Sem categoria'} />}
              <MiniMetric label="Configuração" value={row.referenceCost && row.referenceQuantity ? `Ref. ${formatBRL(row.referenceCost)}` : row.simpleCost ? `Simples ${formatBRL(row.simpleCost)}` : row.costMode} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildCostHistoryPrintHtml(title: string, rows: ProductCostHistoryRow[], fromDate?: string, toDate?: string) {
  const generatedAt = new Date().toLocaleString('pt-BR')
  const period = (fromDate || toDate) ? `${fromDate ? formatDate(fromDate) : 'Início'} → ${toDate ? formatDate(toDate) : 'Hoje'}` : 'Todos os dados'
  const maxValue = Math.max(1, ...rows.map((row) => Math.max(0, row.effectiveCost)))
  const chartBars = rows.slice(-28).map((row, index) => {
    const height = Math.max(4, (row.effectiveCost / maxValue) * 150)
    const x = 50 + index * 28
    const y = 190 - height
    const color = row.deltaCost == null ? '#8b5cf6' : row.deltaCost > 0 ? '#f43f5e' : row.deltaCost < 0 ? '#10b981' : '#06b6d4'
    return `<g><rect x="${x}" y="${y}" width="18" height="${height}" rx="7" fill="${color}"/><text x="${x + 9}" y="214" text-anchor="middle" font-size="8" fill="#64748b">${escapeHtml(formatDate(row.createdAt).slice(0, 5))}</text></g>`
  }).join('')
  const table = rows.map((row) => `<tr><td>${escapeHtml(formatDateTime(row.createdAt))}</td><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.categoryName)}</td><td>${escapeHtml(row.source)}</td><td>${row.oldEffectiveCost == null ? '-' : escapeHtml(formatCostPerUnit(row.oldEffectiveCost, row.effectiveUnit))}</td><td>${escapeHtml(formatCostPerUnit(row.effectiveCost, row.effectiveUnit))}</td><td>${escapeHtml(getCostDeltaLabel(row.deltaCost))}</td></tr>`).join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,Arial,sans-serif}.page{padding:34px}.hero{border-radius:28px;padding:28px;color:white;background:linear-gradient(135deg,#7c3aed,#0891b2 52%,#059669);box-shadow:0 18px 60px rgba(15,23,42,.18)}.eyebrow{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.14em;opacity:.86}h1{margin:0;font-size:30px}.meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.pill{border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.14);font-size:12px}.section{margin-top:22px;border:1px solid #e2e8f0;border-radius:24px;background:white;padding:22px;box-shadow:0 10px 28px rgba(15,23,42,.06)}.chart{border:1px solid #e2e8f0;border-radius:20px;background:#fff;padding:14px}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding:9px 8px}td{border-bottom:1px solid #eef2f7;padding:9px 8px;vertical-align:top}@media print{body{background:white}.page{padding:0}.section{box-shadow:none}}</style></head><body><div class="page"><section class="hero"><p class="eyebrow">ORDR • Histórico de custos</p><h1>${escapeHtml(title)}</h1><div class="meta"><span class="pill">Período: ${escapeHtml(period)}</span><span class="pill">Gerado em: ${escapeHtml(generatedAt)}</span></div></section><section class="section"><h2>Gráfico de custo efetivo</h2><div class="chart"><svg viewBox="0 0 900 245"><rect width="900" height="245" rx="20" fill="#f8fafc"/><line x1="40" x2="860" y1="190" y2="190" stroke="#cbd5e1"/>${chartBars}</svg></div></section><section class="section"><h2>Lista de alterações</h2><table><thead><tr><th>Data</th><th>Produto</th><th>Categoria</th><th>Fonte</th><th>Anterior</th><th>Novo</th><th>Variação</th></tr></thead><tbody>${table || '<tr><td colspan="7">Sem registros.</td></tr>'}</tbody></table></section></div><script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),350)})</script></body></html>`
}

function EventsModule({
  dashboard,
  rows,
  expandedEventId,
  setExpandedEventId,
}: {
  dashboard: ReportsDashboard
  rows: EventReportRow[]
  expandedEventId: string | null
  setExpandedEventId: (id: string | null) => void
}) {
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Eventos"
        description="Compare faturamento, custo de produtos, equipe, compras e lucro por evento."
        icon={<Target className="h-5 w-5" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Custo de equipe" value={formatBRL(dashboard.summary.staffCost)} detail="Pessoas confirmadas e valores configurados" icon={<Users className="h-5 w-5" />} tone="warning" />
        <KpiCard title="Custo de compras" value={formatBRL(dashboard.summary.buyCost)} detail="Compras recebidas vinculadas a eventos" icon={<ShoppingCart className="h-5 w-5" />} tone="warning" />
        <KpiCard title="Custo de produto" value={formatBRL(dashboard.summary.productCost)} detail="Custo estimado dos itens vendidos" icon={<Package className="h-5 w-5" />} tone="muted" />
        <KpiCard title="Lucro de eventos" value={formatBRL(dashboard.charts.events.reduce((sum, item) => sum + item.profit, 0))} detail={`${dashboard.charts.events.length} eventos no filtro`} icon={<CircleDollarSign className="h-5 w-5" />} tone="success" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightMetricCard
          title="Maior ticket por evento"
          value={dashboard.analytics.ticketByEvent[0]?.title ?? '-'}
          detail={dashboard.analytics.ticketByEvent[0] ? `${formatBRL(dashboard.analytics.ticketByEvent[0].averageTicket)} • ${dashboard.analytics.ticketByEvent[0].paidOrders} pedidos pagos` : 'Sem eventos com vendas pagas'}
          tone="primary"
        />
        <InsightMetricCard
          title="Evento mais lucrativo"
          value={dashboard.charts.events[0]?.title ?? '-'}
          detail={dashboard.charts.events[0] ? `${formatBRL(dashboard.charts.events[0].profit)} de lucro` : 'Sem eventos no filtro'}
          tone="success"
        />
        <InsightMetricCard
          title="Maior custo de equipe"
          value={[...dashboard.charts.events].sort((a, b) => b.staffCost - a.staffCost)[0]?.title ?? '-'}
          detail={(() => {
            const event = [...dashboard.charts.events].sort((a, b) => b.staffCost - a.staffCost)[0]
            return event ? formatBRL(event.staffCost) : 'Sem custo de equipe'
          })()}
          tone="warning"
        />
        <InsightMetricCard
          title="Maior custo de compras"
          value={[...dashboard.charts.events].sort((a, b) => b.buyCost - a.buyCost)[0]?.title ?? '-'}
          detail={(() => {
            const event = [...dashboard.charts.events].sort((a, b) => b.buyCost - a.buyCost)[0]
            return event ? formatBRL(event.buyCost) : 'Sem compras vinculadas'
          })()}
          tone="muted"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <ChartCard title="Eventos por lucro" description="Ranking de resultado estimado por evento.">
          <RankingList
            rows={dashboard.charts.events.slice(0, 10)}
            getKey={(row) => row.eventDateId}
            getTitle={(row) => row.title}
            getSubtitle={(row) => `${formatDate(row.startAt)} • receita ${formatBRL(row.revenue)}`}
            getValue={(row) => formatBRL(row.profit)}
            getBarValue={(row) => Math.max(0, row.profit)}
          />
        </ChartCard>

        <ChartCard title="Ambientes de venda" description="Resultado por ambiente/preço aplicado.">
          <RankingList
            rows={dashboard.charts.environments.slice(0, 10)}
            getKey={(row) => row.salesEnvironmentId}
            getTitle={(row) => row.name}
            getSubtitle={(row) => `${row.orders} pedidos • custo ${formatBRL(row.cost)}`}
            getValue={(row) => formatBRL(row.profit)}
            getBarValue={(row) => Math.max(0, row.profit)}
          />
        </ChartCard>
      </section>

      <SectionCard title="Ticket médio por evento" description="Ranking de ticket médio considerando apenas pedidos pagos dentro de cada evento.">
        <InsightTable
          rows={dashboard.analytics.ticketByEvent}
          empty="Nenhum evento com pedido pago no período."
          columns={[
            { key: 'title', label: 'Evento' },
            { key: 'startAt', label: 'Data', render: (row) => formatDate(row.startAt) },
            { key: 'paidOrders', label: 'Pedidos pagos' },
            { key: 'revenue', label: 'Receita', render: (row) => formatBRL(row.revenue) },
            { key: 'averageTicket', label: 'Ticket médio', render: (row) => formatBRL(row.averageTicket) },
            { key: 'profit', label: 'Lucro', render: (row) => <span className={getProfitTone(row.profit)}>{formatBRL(row.profit)}</span> },
          ]}
        />
      </SectionCard>

      <SectionCard title="Cards de eventos" description="Clique em um evento para abrir custos detalhados.">
        <EventsGrid rows={rows} expandedEventId={expandedEventId} setExpandedEventId={setExpandedEventId} />
      </SectionCard>
    </div>
  )
}

function CustomersModule({ rows }: { rows: CustomerReportRow[] }) {
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)
  const totalOrders = rows.reduce((sum, row) => sum + row.orders, 0)
  const bestCustomer = [...rows].sort((a, b) => b.revenue - a.revenue)[0]

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Clientes e comandas"
        description="Veja quem compra mais, ticket médio e origem dos pedidos: cliente, interno ou comanda."
        icon={<Users className="h-5 w-5" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Faturamento rastreado" value={formatBRL(totalRevenue)} detail={`${rows.length} clientes/comandas`} icon={<Wallet className="h-5 w-5" />} tone="primary" />
        <KpiCard title="Pedidos" value={formatNumber(totalOrders)} detail="Pedidos associados a clientes, internos ou comandas" icon={<ReceiptText className="h-5 w-5" />} tone="muted" />
        <KpiCard title="Melhor cliente/comanda" value={bestCustomer?.name ?? '-'} detail={bestCustomer ? `${formatBRL(bestCustomer.revenue)} • ${bestCustomer.orders} pedidos` : 'Sem dados'} icon={<Trophy className="h-5 w-5" />} tone="success" />
      </section>

      <SectionCard title="Ranking de clientes e comandas" description="Ordenado pelo faturamento do período filtrado.">
        <CustomersTable rows={rows} />
      </SectionCard>
    </div>
  )
}

function OrdersModule({
  rows,
  expandedOrderId,
  setExpandedOrderId,
}: {
  rows: RecentOrderReportRow[]
  expandedOrderId: string | null
  setExpandedOrderId: (id: string | null) => void
}) {
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Pedidos"
        description="Auditoria granular dos pedidos filtrados, com itens, custos e lucro estimado."
        icon={<ReceiptText className="h-5 w-5" />}
      />

      <OrdersTable rows={rows} expandedOrderId={expandedOrderId} setExpandedOrderId={setExpandedOrderId} />
    </div>
  )
}


function InsightMetricCard({
  title,
  value,
  detail,
  tone = 'primary',
}: {
  title: string
  value: string
  detail: string
  tone?: KpiTone
}) {
  const toneClass = {
    primary: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    destructive: 'border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    muted: 'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  }[tone]

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </div>
  )
}

function InsightTable({
  rows,
  columns,
  empty,
}: {
  rows: Array<Record<string, any>>
  columns: Array<{
    key: string
    label: string
    render?: (row: Record<string, any>) => React.ReactNode
  }>
  empty: string
}) {
  if (!rows.length) {
    return <EmptyState message={empty} />
  }

  return (
    <div className="rounded-xl border border-border bg-background">
      <table className="hidden w-full min-w-[720px] text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.date ?? row.weekStart ?? row.period ?? row.eventDateId ?? row.weekday ?? index}-${index}`} className="border-b border-border/60 last:border-0">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-3 align-top text-foreground">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row, index) => (
          <div key={`${row.date ?? row.weekStart ?? row.period ?? row.eventDateId ?? row.weekday ?? index}-${index}`} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-semibold text-foreground">
              {columns[0]?.render ? columns[0].render(row) : row[columns[0]?.key]}
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              {columns.slice(1).map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-3 rounded-xl bg-background px-3 py-2">
                  <span className="text-muted-foreground">{column.label}</span>
                  <span className="max-w-[55%] text-right font-medium text-foreground">
                    {column.render ? column.render(row) : row[column.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModuleHeader({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

function ModuleButton({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-[220px] shrink-0 rounded-2xl border p-3 text-left transition xl:w-full xl:p-4 ${
        active
          ? 'border-primary/40 bg-primary/10 shadow-sm'
          : 'border-border bg-background hover:border-primary/30 hover:bg-secondary/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border p-2 ${active ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  )
}

function FinancialEvolutionChart({ data, onDayClick }: { data: ReportsDashboard['charts']['salesByDay']; onDayClick?: (date: string) => void }) {
  return (
    <ChartCard title="Receita, custo e lucro por dia" description="Evolução financeira no período filtrado.">
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={data}
          onClick={(state: any) => {
            const row = state?.activePayload?.[0]?.payload
            if (onDayClick && row?.date) onDayClick(String(row.date))
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tickFormatter={formatDate} />
          <YAxis tickFormatter={(value) => formatNumber(value / 1000, 0) + 'k'} />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Bar dataKey="revenue" name="Receita" radius={[8, 8, 0, 0]} fill="#06b6d4" />
          <Bar dataKey="cost" name="Custo" radius={[8, 8, 0, 0]} fill="#f59e0b" />
          <Line dataKey="profit" name="Lucro" stroke="#10b981" strokeWidth={3} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function PaymentMethodsChart({ dashboard }: { dashboard: ReportsDashboard }) {
  return (
    <ChartCard title="Mix de pagamento" description="Participação de cada método no faturamento pago.">
      <ResponsiveContainer width="100%" height={340}>
        <PieChart>
          <Pie
            data={dashboard.charts.paymentMethods}
            dataKey="revenue"
            nameKey="label"
            innerRadius={72}
            outerRadius={116}
            paddingAngle={3}
            label={(entry) => entry.label}
          >
            {dashboard.charts.paymentMethods.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function SalesByHourChart({ dashboard }: { dashboard: ReportsDashboard }) {
  return (
    <ChartCard title="Vendas por hora" description="Encontre os horários mais fortes do bar.">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={dashboard.charts.salesByHour}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="hour" />
          <YAxis tickFormatter={(value) => formatNumber(value / 1000, 0) + 'k'} />
          <Tooltip content={<ChartTooltip />} />
          <Area dataKey="revenue" name="Receita" stroke="#8b5cf6" fill="#06b6d4" fillOpacity={0.25} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function StatusChart({ dashboard }: { dashboard: ReportsDashboard }) {
  return (
    <ChartCard title="Status dos pedidos" description="Volume por situação no período.">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={dashboard.charts.status}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Pedidos" radius={[8, 8, 0, 0]} fill="#06b6d4" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function CostBreakdownCard({ dashboard }: { dashboard: ReportsDashboard }) {
  const rows = [
    { label: 'Produtos', value: dashboard.summary.productCost, icon: <Package className="h-4 w-4" /> },
    { label: 'Equipe', value: dashboard.summary.staffCost, icon: <Users className="h-4 w-4" /> },
    { label: 'Compras de eventos', value: dashboard.summary.buyCost, icon: <ShoppingCart className="h-4 w-4" /> },
  ]
  const max = Math.max(...rows.map((row) => row.value), 1)

  return (
    <ChartCard title="Composição dos custos" description="Separação dos custos estimados no período.">
      <div className="space-y-4">
        {rows.map((row) => {
          const width = Math.max(4, (row.value / max) * 100)
          return (
            <div key={row.label} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground">{row.icon}</span>
                  {row.label}
                </div>
                <span className="font-semibold text-foreground">{formatBRL(row.value)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

function QuickRangeButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-secondary"
    >
      {children}
    </button>
  )
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </label>
  )
}

function SelectFilter({
  label,
  value,
  onChange,
  children,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>}
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  )
}

function KpiCard({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string
  value: string
  detail: string
  icon: React.ReactNode
  tone: KpiTone
}) {
  const toneClass = {
    primary: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-400/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
    destructive: 'border-rose-400/30 bg-rose-500/15 text-rose-700 dark:text-rose-300',
    muted: 'border-slate-400/30 bg-slate-500/15 text-slate-700 dark:text-slate-200',
  }[tone]

  return (
    <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm ring-1 ring-white/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`rounded-xl border p-2 ${toneClass}`}>{icon}</div>
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function HighlightCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="truncate text-lg font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm ring-1 ring-white/5">
      <div className="mb-4">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm ring-1 ring-white/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function RankingList<T>({
  rows,
  getKey,
  getTitle,
  getSubtitle,
  getValue,
  getBarValue,
}: {
  rows: T[]
  getKey: (row: T) => string
  getTitle: (row: T) => string
  getSubtitle: (row: T) => string
  getValue: (row: T) => string
  getBarValue: (row: T) => number
}) {
  const max = Math.max(...rows.map(getBarValue), 1)

  if (!rows.length) return <EmptyState message="Sem dados para exibir." />

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const percent = Math.max(4, (getBarValue(row) / max) * 100)
        return (
          <div key={getKey(row)} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{getTitle(row)}</p>
                  <p className="truncate text-xs text-muted-foreground">{getSubtitle(row)}</p>
                </div>
              </div>
              <span className="shrink-0 font-semibold text-primary">{getValue(row)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProductsTable({
  rows,
  expandedProductId,
  setExpandedProductId,
}: {
  rows: ProductReportRow[]
  expandedProductId: string | null
  setExpandedProductId: (id: string | null) => void
}) {
  if (!rows.length) return <EmptyState message="Nenhum produto encontrado." />

  return (
    <div className="rounded-xl border border-border bg-background">
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Produto</th>
            <th className="px-3 py-3">Categoria</th>
            <th className="px-3 py-3 text-right">Qtd.</th>
            <th className="px-3 py-3 text-right">Receita</th>
            <th className="px-3 py-3 text-right">Custo</th>
            <th className="px-3 py-3 text-right">Lucro</th>
            <th className="px-3 py-3 text-right">Margem</th>
            <th className="px-3 py-3 text-right">Variações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedProductId === row.productId
            const variations = row.variations ?? []
            return (
              <FragmentLike key={row.productId}>
                <tr className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-3 font-medium text-foreground">
                    <button
                      type="button"
                      onClick={() => variations.length && setExpandedProductId(expanded ? null : row.productId)}
                      className="text-left hover:text-primary disabled:hover:text-foreground"
                      disabled={!variations.length}
                    >
                      {row.name}
                      {row.topVariation && (
                        <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                          Mais escolhida: {row.topVariation.optionName} ({formatPercent(row.topVariation.attachRatePercent)})
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{row.categoryName}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.quantity)}</td>
                  <td className="px-3 py-3 text-right font-medium">{formatBRL(row.revenue)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{formatBRL(row.cost)}</td>
                  <td className={`px-3 py-3 text-right font-semibold ${getProfitTone(row.profit)}`}>{formatBRL(row.profit)}</td>
                  <td className="px-3 py-3 text-right">{formatPercent(row.marginPercent)}</td>
                  <td className="px-3 py-3 text-right">
                    {variations.length ? (
                      <button
                        type="button"
                        onClick={() => setExpandedProductId(expanded ? null : row.productId)}
                        className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                      >
                        {expanded ? 'Ocultar' : `${variations.length} opções`}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem variações</span>
                    )}
                  </td>
                </tr>

                {expanded && variations.length > 0 && (
                  <tr className="border-b border-border/70 bg-violet-500/5">
                    <td colSpan={8} className="px-3 py-4">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {variations.map((variation) => (
                          <div key={`${variation.variationGroupId}-${variation.optionId}`} className="rounded-xl border border-violet-400/20 bg-card p-3">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{variation.optionName}</p>
                                <p className="truncate text-xs text-muted-foreground">{variation.variationGroupName}</p>
                              </div>
                              <span className="rounded-full bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                                {formatPercent(variation.attachRatePercent)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <MiniMetric label="Qtd." value={formatNumber(variation.quantity)} />
                              <MiniMetric label="Receita" value={formatBRL(variation.revenueModifier)} />
                              <MiniMetric label="Custo" value={formatBRL(variation.cost)} />
                              <MiniMetric label="Lucro" value={formatBRL(variation.profit)} tone={getProfitTone(variation.profit)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </FragmentLike>
            )
          })}
        </tbody>
      </table>

      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row) => {
          const variations = row.variations ?? []
          const expanded = expandedProductId === row.productId

          return (
            <div key={row.productId} className="rounded-2xl border border-border bg-card p-4">
              <button
                type="button"
                onClick={() => variations.length && setExpandedProductId(expanded ? null : row.productId)}
                className="w-full text-left"
                disabled={!variations.length}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{row.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.categoryName} • {formatNumber(row.quantity)} vendidos</p>
                  </div>
                  <span className={`shrink-0 font-semibold ${getProfitTone(row.profit)}`}>{formatBRL(row.profit)}</span>
                </div>
              </button>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <MiniMetric label="Receita" value={formatBRL(row.revenue)} />
                <MiniMetric label="Custo" value={formatBRL(row.cost)} />
                <MiniMetric label="Margem" value={formatPercent(row.marginPercent)} />
                <MiniMetric label="Variações" value={variations.length ? `${variations.length} opções` : 'Sem variações'} />
              </div>

              {expanded && variations.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {variations.map((variation) => (
                    <div key={`${variation.variationGroupId}-${variation.optionId}`} className="rounded-xl border border-border bg-background p-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{variation.optionName}</p>
                          <p className="text-muted-foreground">{variation.variationGroupName}</p>
                        </div>
                        <span className="font-semibold text-foreground">{formatPercent(variation.attachRatePercent)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <MiniMetric label="Qtd." value={formatNumber(variation.quantity)} />
                        <MiniMetric label="Lucro" value={formatBRL(variation.profit)} tone={getProfitTone(variation.profit)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProductVariationTable({ rows }: { rows: NonNullable<ProductReportRow['variations']> }) {
  if (!rows.length) return <EmptyState message="Nenhuma variação encontrada no período." />

  return (
    <div className="rounded-xl border border-border bg-background">
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Produto</th>
            <th className="px-3 py-3">Grupo</th>
            <th className="px-3 py-3">Opção</th>
            <th className="px-3 py-3 text-right">Qtd.</th>
            <th className="px-3 py-3 text-right">Frequência</th>
            <th className="px-3 py-3 text-right">Receita var.</th>
            <th className="px-3 py-3 text-right">Custo</th>
            <th className="px-3 py-3 text-right">Lucro</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row) => (
            <tr key={`${row.productId}-${row.variationGroupId}-${row.optionId}`} className="border-b border-border/70 last:border-0">
              <td className="px-3 py-3 font-medium text-foreground">{row.productName}</td>
              <td className="px-3 py-3 text-muted-foreground">{row.variationGroupName}</td>
              <td className="px-3 py-3">{row.optionName}</td>
              <td className="px-3 py-3 text-right">{formatNumber(row.quantity)}</td>
              <td className="px-3 py-3 text-right">{formatPercent(row.attachRatePercent)}</td>
              <td className="px-3 py-3 text-right">{formatBRL(row.revenueModifier)}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{formatBRL(row.cost)}</td>
              <td className={`px-3 py-3 text-right font-semibold ${getProfitTone(row.profit)}`}>{formatBRL(row.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 p-3 md:hidden">
        {rows.slice(0, 80).map((row) => (
          <div key={`${row.productId}-${row.variationGroupId}-${row.optionId}`} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{row.optionName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.productName} • {row.variationGroupName}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold">
                {formatPercent(row.attachRatePercent)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <MiniMetric label="Qtd." value={formatNumber(row.quantity)} />
              <MiniMetric label="Receita" value={formatBRL(row.revenueModifier)} />
              <MiniMetric label="Custo" value={formatBRL(row.cost)} />
              <MiniMetric label="Lucro" value={formatBRL(row.profit)} tone={getProfitTone(row.profit)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FragmentLike({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function EventsGrid({
  rows,
  expandedEventId,
  setExpandedEventId,
}: {
  rows: EventReportRow[]
  expandedEventId: string | null
  setExpandedEventId: (id: string | null) => void
}) {
  if (!rows.length) return <EmptyState message="Nenhum evento encontrado." />

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const expanded = expandedEventId === row.eventDateId
        const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0

        return (
          <button
            key={row.eventDateId}
            onClick={() => setExpandedEventId(expanded ? null : row.eventDateId)}
            className="rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.startAt)} • {row.orders} pedidos</p>
              </div>
              <span className={`font-bold ${getProfitTone(row.profit)}`}>{formatBRL(row.profit)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MiniMetric label="Receita" value={formatBRL(row.revenue)} />
              <MiniMetric label="Custo total" value={formatBRL(row.totalCost)} />
              <MiniMetric label="Produtos" value={formatBRL(row.productCost)} />
              <MiniMetric label="Equipe" value={formatBRL(row.staffCost)} />
            </div>
            {expanded && (
              <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                <p>Compras vinculadas: <span className="font-medium text-foreground">{formatBRL(row.buyCost)}</span></p>
                <p>Lucro estimado: <span className={`font-medium ${getProfitTone(row.profit)}`}>{formatBRL(row.profit)}</span></p>
                <p>Margem: <span className="font-medium text-foreground">{formatPercent(margin)}</span></p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function CustomersTable({ rows }: { rows: CustomerReportRow[] }) {
  if (!rows.length) return <EmptyState message="Nenhum cliente/comanda encontrado." />

  return (
    <div className="rounded-xl border border-border bg-background">
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Nome</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3 text-right">Pedidos</th>
            <th className="px-3 py-3 text-right">Faturamento</th>
            <th className="px-3 py-3 text-right">Ticket médio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/70 last:border-0">
              <td className="px-3 py-3 font-medium text-foreground">{row.name}</td>
              <td className="px-3 py-3 text-muted-foreground">{row.type === 'internal' ? 'Interno' : row.type === 'customer' ? 'Cliente' : 'Comanda'}</td>
              <td className="px-3 py-3 text-right">{row.orders}</td>
              <td className="px-3 py-3 text-right font-medium">{formatBRL(row.revenue)}</td>
              <td className="px-3 py-3 text-right">{formatBRL(row.averageTicket)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{row.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.type === 'internal' ? 'Interno' : row.type === 'customer' ? 'Cliente' : 'Comanda'}</p>
              </div>
              <span className="shrink-0 font-semibold text-foreground">{formatBRL(row.revenue)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <MiniMetric label="Pedidos" value={String(row.orders)} />
              <MiniMetric label="Ticket médio" value={formatBRL(row.averageTicket)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersTable({
  rows,
  expandedOrderId,
  setExpandedOrderId,
}: {
  rows: RecentOrderReportRow[]
  expandedOrderId: string | null
  setExpandedOrderId: (id: string | null) => void
}) {
  if (!rows.length) return <EmptyState message="Nenhum pedido encontrado." />

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const expanded = expandedOrderId === row.id

        return (
          <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <button
              onClick={() => setExpandedOrderId(expanded ? null : row.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div>
                <p className="font-semibold text-foreground">Pedido #{row.id.slice(0, 8)} • Comanda {row.comanda}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(row.createdAt)} • {getStatusLabel(row.status)} • {getPaymentLabel(row.paymentMethod)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.customerName ?? 'Sem cliente'} {row.eventTitle ? `• ${row.eventTitle}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">{formatBRL(row.total)}</p>
                <p className={`text-xs font-semibold ${getProfitTone(row.profit)}`}>{formatBRL(row.profit)} lucro</p>
              </div>
            </button>

            {expanded && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qtd.</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Custo</th>
                      <th className="px-3 py-2 text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.items.map((item) => (
                      <tr key={`${row.id}-${item.productId}-${item.name}`} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                        </td>
                        <td className="px-3 py-2 text-right">{formatNumber(item.quantity)}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(item.totalPrice)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatBRL(item.estimatedCost)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${getProfitTone(item.estimatedProfit)}`}>{formatBRL(item.estimatedProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ExportPdfModal({
  selectedModules,
  onToggle,
  onSelectAll,
  onClear,
  onExport,
  onClose,
}: {
  selectedModules: Record<DashboardModule, boolean>
  onToggle: (moduleId: DashboardModule) => void
  onSelectAll: () => void
  onClear: () => void
  onExport: () => void
  onClose: () => void
}) {
  const selectedCount = modules.filter((module) => selectedModules[module.id]).length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-emerald-500/10 px-6 py-5">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-400/30 dark:text-cyan-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Exportar resumo em PDF</h2>
              <p className="text-sm text-muted-foreground">
                Escolha os módulos que entram no relatório colorido. A janela abre pronta para salvar como PDF.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {selectedCount} módulo{selectedCount === 1 ? '' : 's'} selecionado{selectedCount === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <button onClick={onSelectAll} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary">
                Selecionar todos
              </button>
              <button onClick={onClear} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary">
                Limpar
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {modules.map((module) => {
              const accent = MODULE_ACCENTS[module.id]
              const checked = selectedModules[module.id]

              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => onToggle(module.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    checked ? `${accent.active} ring-1 ring-white/10` : 'border-border bg-background hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl border p-2 ${checked ? `${accent.badge} border-transparent text-white` : accent.icon}`}>
                        {module.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{module.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{module.description}</p>
                      </div>
                    </div>
                    <span className={`mt-1 h-5 w-5 rounded-md border ${checked ? `${accent.badge} border-transparent` : 'border-border bg-card'}`} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button onClick={onClose} className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary">
            Cancelar
          </button>
          <button
            onClick={onExport}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 text-sm font-semibold text-white shadow-sm hover:from-cyan-400 hover:to-violet-400"
          >
            <Download className="h-4 w-4" />
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  )
}

function buildReportPdfHtml(dashboard: ReportsDashboard, filters: ReportFilters, selectedModules: DashboardModule[]) {
  const selected = new Set(selectedModules)
  const generatedAt = new Date().toLocaleString('pt-BR')
  const period = (filters.fromDate || filters.toDate)
    ? `${filters.fromDate ? formatDate(filters.fromDate) : 'Início'} → ${filters.toDate ? formatDate(filters.toDate) : 'Hoje'}`
    : 'Todos os dados'
  const summary = dashboard.summary
  const moduleTitle = (id: DashboardModule) => modules.find((module) => module.id === id)?.title ?? id
  const tableRows = (rows: string, colspan: number) => rows || `<tr><td colspan="${colspan}" class="muted center">Sem dados para este módulo.</td></tr>`
  const moneyCard = (label: string, value: string, tone = 'cyan') => `<div class="metric metric-${tone}"><span>${label}</span><strong>${value}</strong></div>`
  const pdfColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#64748b']
  const maxChartValue = (values: number[]) => Math.max(1, ...values.map((value) => Math.max(0, Number(value) || 0)))
  const pdfVerticalBars = (
    rows: Array<{ label: string; value: number; secondary?: number }>,
    title: string,
    valueLabel: (value: number) => string = (value) => String(Math.round(value))
  ) => {
    if (rows.length === 0) return ''
    const max = maxChartValue(rows.flatMap((row) => [row.value, row.secondary ?? 0]))
    const barWidth = Math.max(18, 720 / Math.max(1, rows.length))
    const bars = rows.map((row, index) => {
      const x = 70 + index * barWidth
      const h = Math.max(2, (Math.max(0, row.value) / max) * 155)
      const y = 190 - h
      const h2 = row.secondary == null ? 0 : Math.max(2, (Math.max(0, row.secondary) / max) * 155)
      const y2 = 190 - h2
      const color = pdfColors[index % pdfColors.length]
      return `<g><rect x="${x}" y="${y}" width="${Math.max(12, barWidth - 12)}" height="${h}" rx="8" fill="${color}" opacity=".92"/>${row.secondary == null ? '' : `<rect x="${x + Math.max(12, barWidth - 12) * .58}" y="${y2}" width="${Math.max(6, (barWidth - 12) * .35)}" height="${h2}" rx="6" fill="#0f172a" opacity=".35"/>`}<text x="${x + Math.max(12, barWidth - 12) / 2}" y="${y - 7}" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">${escapeHtml(valueLabel(row.value))}</text><text x="${x + Math.max(12, barWidth - 12) / 2}" y="225" text-anchor="middle" font-size="10" fill="#64748b">${escapeHtml(row.label).slice(0, 12)}</text></g>`
    }).join('')
    return `<div class="chart-box"><h3>${escapeHtml(title)}</h3><svg viewBox="0 0 900 250"><rect width="900" height="250" rx="20" fill="#f8fafc"/><line x1="58" x2="858" y1="190" y2="190" stroke="#cbd5e1"/>${bars}</svg></div>`
  }
  const pdfHorizontalBars = (
    rows: Array<{ label: string; value: number; detail?: string }>,
    title: string,
    valueLabel: (value: number) => string = (value) => String(Math.round(value))
  ) => {
    if (rows.length === 0) return ''
    const max = maxChartValue(rows.map((row) => row.value))
    const height = Math.max(95, rows.length * 38 + 36)
    const bars = rows.map((row, index) => {
      const y = 26 + index * 38
      const width = Math.max(4, (Math.max(0, row.value) / max) * 500)
      const color = pdfColors[index % pdfColors.length]
      return `<g><text x="24" y="${y + 15}" font-size="12" font-weight="700" fill="#334155">${escapeHtml(row.label).slice(0, 33)}</text>${row.detail ? `<text x="24" y="${y + 30}" font-size="9" fill="#64748b">${escapeHtml(row.detail)}</text>` : ''}<rect x="300" y="${y}" width="${width}" height="22" rx="11" fill="${color}" opacity=".9"/><text x="${310 + width}" y="${y + 15}" font-size="11" font-weight="700" fill="#0f172a">${escapeHtml(valueLabel(row.value))}</text></g>`
    }).join('')
    return `<div class="chart-box"><h3>${escapeHtml(title)}</h3><svg viewBox="0 0 900 ${height}"><rect width="900" height="${height}" rx="20" fill="#f8fafc"/>${bars}</svg></div>`
  }
  const pdfDonut = (
    rows: Array<{ label: string; value: number }>,
    title: string,
    valueLabel: (value: number) => string = formatBRL
  ) => {
    const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.value) || 0), 0)
    if (total <= 0) return ''
    const radius = 66
    const circ = 2 * Math.PI * radius
    let acc = 0
    const arcs = rows.map((row, index) => {
      const dash = (Math.max(0, row.value) / total) * circ
      const out = `<circle cx="110" cy="110" r="${radius}" fill="none" stroke="${pdfColors[index % pdfColors.length]}" stroke-width="28" stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${-acc}" transform="rotate(-90 110 110)"/>`
      acc += dash
      return out
    }).join('')
    const legend = rows.map((row, index) => `<div class="legend-item"><span style="background:${pdfColors[index % pdfColors.length]}"></span><strong>${escapeHtml(row.label)}</strong><em>${escapeHtml(valueLabel(row.value))}</em></div>`).join('')
    return `<div class="chart-box donut-grid"><h3>${escapeHtml(title)}</h3><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="28"/>${arcs}<text x="110" y="106" text-anchor="middle" font-size="18" font-weight="800" fill="#0f172a">${escapeHtml(formatBRL(total))}</text><text x="110" y="126" text-anchor="middle" font-size="10" fill="#64748b">total</text></svg><div class="legend">${legend}</div></div>`
  }
  const sections: string[] = []

  if (selected.has('overview')) {
    sections.push(`<section class="section"><h2>Visão geral</h2><div class="metrics">
      ${moneyCard('Receita paga', formatBRL(summary.grossRevenue), 'cyan')}
      ${moneyCard('Custo total', formatBRL(summary.totalCost), 'amber')}
      ${moneyCard('Lucro estimado', formatBRL(summary.estimatedProfit), summary.estimatedProfit >= 0 ? 'emerald' : 'rose')}
      ${moneyCard('Margem', formatPercent(summary.marginPercent), 'violet')}
      ${moneyCard('Pedidos pagos', String(summary.paidOrders), 'slate')}
      ${moneyCard('Ticket médio', formatBRL(summary.averageTicket), 'pink')}
    </div></section>`)
  }

  if (selected.has('sales')) {
    sections.push(`<section class="section"><h2>Vendas</h2><div class="metrics compact">
      ${moneyCard('Pendente', formatBRL(summary.pendingRevenue), 'amber')}
      ${moneyCard('Cancelado', formatBRL(summary.cancelledRevenue), 'rose')}
      ${moneyCard('Itens vendidos', formatNumber(summary.totalItemsSold), 'violet')}
      ${moneyCard('Cancelamento', formatPercent(summary.cancellationRate), 'slate')}
    </div>
    ${pdfVerticalBars(dashboard.charts.salesByDay.slice(-12).map((row) => ({ label: formatDate(row.date).slice(0, 5), value: row.revenue, secondary: row.profit })), 'Receita e lucro por dia', formatBRL)}
    ${pdfDonut(dashboard.charts.paymentMethods.map((row) => ({ label: getPaymentLabel(row.paymentMethod), value: row.revenue })), 'Mix de pagamentos', formatBRL)}
    ${pdfHorizontalBars((dashboard.analytics?.weekdayPerformance ?? []).slice(0, 7).map((row) => ({ label: row.weekday ?? '-', value: row.revenue, detail: `${formatNumber(row.paidOrders)} pedidos pagos • ticket ${formatBRL(row.averageTicket)}` })), 'Receita por dia da semana', formatBRL)}
    ${pdfHorizontalBars((dashboard.analytics?.monthPeriodPerformance ?? []).map((row) => ({ label: row.period ?? '-', value: row.revenue, detail: `${formatNumber(row.paidOrders)} pedidos pagos • lucro ${formatBRL(row.profit)}` })), 'Melhor período do mês', formatBRL)}
    <h3>Melhor horário por dia</h3><table><thead><tr><th>Dia</th><th>Melhor horário</th><th>Pedidos pagos</th><th>Receita</th><th>Ticket médio</th></tr></thead><tbody>
      ${tableRows((dashboard.analytics?.bestHourByDay ?? []).slice(-18).map((row) => `<tr><td>${formatDate(row.date)}</td><td>${escapeHtml(row.hour ?? '-')}</td><td>${row.paidOrders}</td><td>${formatBRL(row.revenue)}</td><td>${formatBRL(row.averageTicket)}</td></tr>`).join(''), 5)}
    </tbody></table>
    <h3>Melhor dia por semana</h3><table><thead><tr><th>Semana</th><th>Melhor dia</th><th>Pedidos pagos</th><th>Receita</th><th>Lucro</th></tr></thead><tbody>
      ${tableRows((dashboard.analytics?.bestDayByWeek ?? []).slice(-12).map((row) => `<tr><td>Semana de ${formatDate(row.weekStart)}</td><td>${escapeHtml(row.weekday ?? '-')} • ${formatDate(row.date)}</td><td>${row.paidOrders}</td><td>${formatBRL(row.revenue)}</td><td>${formatBRL(row.profit)}</td></tr>`).join(''), 5)}
    </tbody></table>
    <h3>Receita por dia</h3><table><thead><tr><th>Data</th><th>Pedidos</th><th>Receita</th><th>Custo</th><th>Lucro</th></tr></thead><tbody>
      ${tableRows(dashboard.charts.salesByDay.slice(0, 30).map((row) => `<tr><td>${formatDate(row.date)}</td><td>${row.paidOrders}</td><td>${formatBRL(row.revenue)}</td><td>${formatBRL(row.cost)}</td><td>${formatBRL(row.profit)}</td></tr>`).join(''), 5)}
    </tbody></table></section>`)
  }

  if (selected.has('products')) {
    sections.push(`<section class="section"><h2>Produtos</h2>
      ${pdfHorizontalBars(dashboard.charts.productsByProfit.slice(0, 8).map((row) => ({ label: row.name, value: row.profit, detail: `${formatBRL(row.revenue)} receita • ${formatPercent(row.marginPercent)} margem` })), 'Top produtos por lucro', formatBRL)}
      ${pdfHorizontalBars(dashboard.charts.categories.slice(0, 8).map((row) => ({ label: row.name, value: row.profit, detail: `${formatBRL(row.revenue)} receita` })), 'Lucro por categoria', formatBRL)}
      ${pdfHorizontalBars((dashboard.charts.productVariations ?? []).slice(0, 10).map((row) => ({ label: `${row.productName} • ${row.optionName}`, value: row.quantity, detail: `${row.variationGroupName} • custo ${formatBRL(row.cost)} • lucro ${formatBRL(row.profit)}` })), 'Variações mais escolhidas', (value) => formatNumber(value))}
      <h3>Produtos</h3><table><thead><tr><th>Produto</th><th>Categoria</th><th>Qtd.</th><th>Receita</th><th>Custo</th><th>Lucro</th><th>Margem</th></tr></thead><tbody>
      ${tableRows(dashboard.charts.productsByProfit.slice(0, 10).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.categoryName)}</td><td>${formatNumber(row.quantity)}</td><td>${formatBRL(row.revenue)}</td><td>${formatBRL(row.cost)}</td><td>${formatBRL(row.profit)}</td><td>${formatPercent(row.marginPercent)}</td></tr>`).join(''), 7)}
    </tbody></table>
      <h3>Variações por produto</h3><table><thead><tr><th>Produto</th><th>Grupo</th><th>Opção</th><th>Qtd.</th><th>Frequência</th><th>Receita var.</th><th>Custo</th><th>Lucro</th></tr></thead><tbody>
      ${tableRows((dashboard.charts.productVariations ?? []).slice(0, 18).map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.variationGroupName)}</td><td>${escapeHtml(row.optionName)}</td><td>${formatNumber(row.quantity)}</td><td>${formatPercent(row.attachRatePercent)}</td><td>${formatBRL(row.revenueModifier)}</td><td>${formatBRL(row.cost)}</td><td>${formatBRL(row.profit)}</td></tr>`).join(''), 8)}
    </tbody></table></section>`)
  }

  if (selected.has('costHistory')) {
    sections.push(`<section class="section"><h2>Histórico de custos</h2><p class="muted">O histórico de custos usa filtros próprios por produto/categoria e pode ser impresso diretamente no módulo Histórico de custos, com gráfico e lista detalhada.</p></section>`)
  }

  if (selected.has('events')) {
    sections.push(`<section class="section"><h2>Eventos</h2>
      ${pdfHorizontalBars(dashboard.charts.events.slice(0, 8).map((row) => ({ label: row.title, value: row.profit, detail: `${formatBRL(row.revenue)} receita • ${formatBRL(row.staffCost + row.buyCost)} custo evento` })), 'Resultado por evento', formatBRL)}
      <h3>Ticket médio por evento</h3><table><thead><tr><th>Evento</th><th>Data</th><th>Pedidos pagos</th><th>Receita</th><th>Ticket médio</th><th>Lucro</th></tr></thead><tbody>
      ${tableRows((dashboard.analytics?.ticketByEvent ?? []).slice(0, 12).map((row) => `<tr><td>${escapeHtml(row.title)}</td><td>${formatDate(row.startAt)}</td><td>${row.paidOrders}</td><td>${formatBRL(row.revenue)}</td><td>${formatBRL(row.averageTicket)}</td><td>${formatBRL(row.profit)}</td></tr>`).join(''), 6)}
    </tbody></table>
      <table><thead><tr><th>Evento</th><th>Data</th><th>Receita</th><th>Produto</th><th>Equipe</th><th>Compras</th><th>Lucro</th></tr></thead><tbody>
      ${tableRows(dashboard.charts.events.slice(0, 10).map((row) => `<tr><td>${escapeHtml(row.title)}</td><td>${formatDate(row.startAt)}</td><td>${formatBRL(row.revenue)}</td><td>${formatBRL(row.productCost)}</td><td>${formatBRL(row.staffCost)}</td><td>${formatBRL(row.buyCost)}</td><td>${formatBRL(row.profit)}</td></tr>`).join(''), 7)}
    </tbody></table></section>`)
  }

  if (selected.has('customers')) {
    sections.push(`<section class="section"><h2>Clientes e comandas</h2><table><thead><tr><th>Nome</th><th>Tipo</th><th>Pedidos</th><th>Receita</th><th>Ticket médio</th></tr></thead><tbody>
      ${tableRows(dashboard.charts.customers.slice(0, 10).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.type}</td><td>${row.orders}</td><td>${formatBRL(row.revenue)}</td><td>${formatBRL(row.averageTicket)}</td></tr>`).join(''), 5)}
    </tbody></table></section>`)
  }

  if (selected.has('orders')) {
    sections.push(`<section class="section"><h2>Pedidos</h2><table><thead><tr><th>Pedido</th><th>Comanda</th><th>Status</th><th>Pagamento</th><th>Total</th><th>Lucro</th><th>Criado em</th></tr></thead><tbody>
      ${tableRows(dashboard.tables.recentOrders.slice(0, 20).map((row) => `<tr><td>#${row.id.slice(0, 8)}</td><td>${row.comanda}</td><td>${getStatusLabel(row.status)}</td><td>${getPaymentLabel(row.paymentMethod)}</td><td>${formatBRL(row.total)}</td><td>${formatBRL(row.profit)}</td><td>${formatDateTime(row.createdAt)}</td></tr>`).join(''), 7)}
    </tbody></table></section>`)
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Relatório ORDR</title><style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc}.page{padding:34px}.hero{border-radius:28px;padding:28px;color:white;background:linear-gradient(135deg,#0891b2,#7c3aed 52%,#059669);box-shadow:0 18px 60px rgba(15,23,42,.18)}.eyebrow{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.14em;opacity:.85}h1{margin:0;font-size:32px}h2{margin:0 0 16px;font-size:22px}h3{margin:18px 0 10px;font-size:15px;color:#334155}.meta{margin-top:14px;display:flex;flex-wrap:wrap;gap:10px}.pill{border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.14);font-size:12px}.modules{margin-top:14px;font-size:12px;opacity:.9}.section{break-inside:avoid;margin-top:22px;border:1px solid #e2e8f0;border-radius:24px;background:white;padding:22px;box-shadow:0 10px 28px rgba(15,23,42,.06)}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metrics.compact{grid-template-columns:repeat(4,1fr)}.metric{border-radius:18px;padding:14px;border:1px solid #e2e8f0}.metric span{display:block;color:#475569;font-size:12px}.metric strong{display:block;margin-top:6px;font-size:20px;color:#0f172a}.metric-cyan{background:#ecfeff;border-color:#a5f3fc}.metric-emerald{background:#ecfdf5;border-color:#a7f3d0}.metric-amber{background:#fffbeb;border-color:#fde68a}.metric-rose{background:#fff1f2;border-color:#fecdd3}.metric-violet{background:#f5f3ff;border-color:#ddd6fe}.metric-pink{background:#fdf2f8;border-color:#fbcfe8}.metric-slate{background:#f8fafc;border-color:#cbd5e1}.chart-box{break-inside:avoid;margin:16px 0 18px;border:1px solid #e2e8f0;border-radius:22px;background:#fff;padding:14px}.chart-box h3{margin:0 0 10px;color:#334155}.donut-grid{display:grid;grid-template-columns:240px 1fr;align-items:center;gap:12px}.legend{display:grid;gap:8px}.legend-item{display:flex;align-items:center;gap:8px;font-size:12px;color:#334155}.legend-item span{display:inline-flex;width:12px;height:12px;border-radius:999px}.legend-item strong{min-width:130px}.legend-item em{font-style:normal;color:#64748b}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding:9px 8px}td{border-bottom:1px solid #eef2f7;padding:9px 8px;vertical-align:top}tr:last-child td{border-bottom:0}.muted{color:#64748b}.center{text-align:center}@media print{body{background:white}.page{padding:0}.section{box-shadow:none}}
  </style></head><body><div class="page"><section class="hero"><p class="eyebrow">ORDR • Relatório gerencial</p><h1>Resumo financeiro e operacional</h1><div class="meta"><span class="pill">Período: ${period}</span><span class="pill">Gerado em: ${generatedAt}</span><span class="pill">Pedidos no filtro: ${summary.totalOrders}</span></div><p class="modules">Módulos exportados: ${selectedModules.map(moduleTitle).join(' • ')}</p></section>${sections.join('')}</div><script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),350)})</script></body></html>`
}


function DayDetailsModal({
  date,
  dashboard,
  onClose,
}: {
  date: string
  dashboard: ReportsDashboard
  onClose: () => void
}) {
  const day = dashboard.charts.salesByDay.find((row) => row.date === date) ?? null
  const dayOrders = dashboard.tables.recentOrders.filter((order) => getDateKey(order.createdAt) === date)
  const paidOrders = dayOrders.filter((order) => order.status === 'paid')
  const dayEvents = dashboard.tables.events.filter((event) => getDateKey(event.startAt) === date)
  const bestHour = dashboard.analytics.bestHourByDay.find((row) => row.date === date) ?? null

  const revenue = day?.revenue ?? paidOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0)
  const cost = day?.cost ?? paidOrders.reduce((sum, order) => sum + Number(order.cost ?? 0), 0)
  const profit = day?.profit ?? revenue - cost
  const averageTicket = paidOrders.length > 0 ? revenue / paidOrders.length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[94svh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-emerald-500/10 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-300">
              Detalhes do dia
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">{formatDate(date)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Eventos, pedidos, custos, ticket médio e lucro do dia selecionado.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              title="Receita"
              value={formatBRL(revenue)}
              detail={`${paidOrders.length} pedidos pagos`}
              icon={<Wallet className="h-5 w-5" />}
              tone="primary"
            />
            <KpiCard
              title="Custo"
              value={formatBRL(cost)}
              detail="Produtos + custos vinculados"
              icon={<Target className="h-5 w-5" />}
              tone="warning"
            />
            <KpiCard
              title="Lucro"
              value={formatBRL(profit)}
              detail={`Margem ${revenue > 0 ? formatPercent((profit / revenue) * 100) : '0,0%'}`}
              icon={<CircleDollarSign className="h-5 w-5" />}
              tone={getKpiTone(profit)}
            />
            <KpiCard
              title="Ticket médio"
              value={formatBRL(averageTicket)}
              detail="Pedidos pagos do dia"
              icon={<TrendingUp className="h-5 w-5" />}
              tone="success"
            />
            <KpiCard
              title="Melhor horário"
              value={bestHour?.hour ?? '-'}
              detail={bestHour ? `${formatBRL(bestHour.revenue)} • ${bestHour.orders} pedidos` : 'Sem dados'}
              icon={<LineChartIcon className="h-5 w-5" />}
              tone="muted"
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <ChartCard
              title="Eventos do dia"
              description="Eventos que começaram no dia selecionado, com custo, ticket médio e lucro."
            >
              {dayEvents.length === 0 ? (
                <EmptyState message="Nenhum evento encontrado para este dia no filtro atual." />
              ) : (
                <div className="space-y-3">
                  {dayEvents.map((event) => (
                    <div key={event.eventDateId} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{event.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.paidOrders ?? event.orders} pedidos pagos • ticket {formatBRL(event.averageTicket ?? 0)}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${getProfitTone(event.profit)}`}>
                          {formatBRL(event.profit)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <MiniMetric label="Receita" value={formatBRL(event.revenue)} />
                        <MiniMetric label="Produto" value={formatBRL(event.productCost)} />
                        <MiniMetric label="Equipe" value={formatBRL(event.staffCost)} />
                        <MiniMetric label="Compras" value={formatBRL(event.buyCost)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Pedidos do dia"
              description="Pedidos recentes capturados pelo relatório para o dia selecionado."
            >
              {dayOrders.length === 0 ? (
                <EmptyState message="Nenhum pedido encontrado para este dia no filtro atual." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="hidden w-full min-w-[760px] text-sm md:table">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2">Pedido</th>
                        <th className="px-3 py-2">Comanda/cliente</th>
                        <th className="px-3 py-2">Evento</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Receita</th>
                        <th className="px-3 py-2 text-right">Custo</th>
                        <th className="px-3 py-2 text-right">Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayOrders.map((order) => (
                        <tr key={order.id} className="border-b border-border/70">
                          <td className="px-3 py-2 font-mono text-xs">#{order.id.slice(0, 8)}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground">Comanda {order.comanda}</p>
                            <p className="text-xs text-muted-foreground">{order.customerName ?? order.comandaName ?? '-'}</p>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{order.eventTitle ?? '-'}</td>
                          <td className="px-3 py-2">{getStatusLabel(order.status)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatBRL(order.total)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{formatBRL(order.cost)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${getProfitTone(order.profit)}`}>
                            {formatBRL(order.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </section>
        </div>
      </div>
    </div>
  )
}


function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{message}</div>
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-semibold ${tone ?? 'text-foreground'}`}>{value}</p>
    </div>
  )
}
