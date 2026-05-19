import { apiFetch } from './client'

export type ReportStatus = 'pending' | 'paid' | 'cancelled'
export type PaymentMethod = 'money' | 'pix' | 'credit' | 'debit' | 'discount' | 'unknown'

export type ReportFilters = {
  fromDate?: string
  toDate?: string
  fromTime?: string
  toTime?: string
  status?: ReportStatus | 'all'
  paymentMethod?: PaymentMethod | 'all'
  eventDateId?: string
  salesEnvironmentId?: string
  categoryId?: string
  productId?: string
  customerId?: string
  internalCustomerId?: string
  comanda?: string
  taxApplied?: 'true' | 'false' | 'all'
}

export type ReportsFilterOptions = {
  events: Array<{ id: string; title: string; startAt: string; status: string }>
  environments: Array<{ id: string; name: string; color?: string | null; isDefault?: boolean }>
  categories: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; categoryId?: string | null }>
  customers: Array<{ id: string; name: string }>
  internalCustomers: Array<{ id: string; name: string; salesEnvironmentId?: string | null }>
}

export type MoneyMetric = {
  revenue: number
  cost?: number
  profit?: number
  marginPercent?: number
}

export type TimeInsightRow = {
  date?: string
  hour?: string
  weekStart?: string
  weekday?: string
  period?: string
  orders: number
  paidOrders: number
  revenue: number
  cost: number
  profit: number
  averageTicket: number
}


export type ReportPeriodEventRow = {
  eventDateId: string
  title: string
  startAt: string
  endAt?: string | null
  orders: number
  paidOrders: number
  revenue: number
}

export type ReportPeriodRow = {
  id: string
  label: string
  startAt: string
  endAt: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  orders: number
  paidOrders: number
  pendingOrders: number
  cancelledOrders: number
  revenue: number
  cost: number
  profit: number
  averageTicket: number
  itemsSold: number
  eventDateId?: string | null
  eventTitle?: string | null
  eventStartAt?: string | null
  eventEndAt?: string | null
  events: ReportPeriodEventRow[]
  paymentMethods: Array<{ paymentMethod: PaymentMethod; label: string; orders: number; revenue: number }>
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>
}

export type EventTicketInsightRow = EventReportRow & {
  paidOrders: number
  averageTicket: number
}

export type ProductVariationReportRow = {
  productId: string
  productName: string
  categoryId?: string | null
  categoryName: string
  variationGroupId: string
  variationGroupName: string
  optionId: string
  optionName: string
  selections: number
  quantity: number
  revenueModifier: number
  cost: number
  profit: number
  marginPercent: number
  attachRatePercent: number
}

export type ReportsDashboard = {
  filters: ReportFilters
  summary: {
    totalOrders: number
    paidOrders: number
    pendingOrders: number
    cancelledOrders: number
    grossRevenue: number
    pendingRevenue: number
    cancelledRevenue: number
    productCost: number
    eventCost: number
    staffCost: number
    buyCost: number
    totalCost: number
    estimatedProfit: number
    marginPercent: number
    averageTicket: number
    totalItemsSold: number
    cancellationRate: number
    statusCounts: {
      pending: number
      paid: number
      cancelled: number
    }
  }
  highlights: {
    bestDay: ({ date: string; orders: number; paidOrders: number } & MoneyMetric) | null
    bestHour: ({ hour: string; orders: number } & MoneyMetric) | null
    bestProduct: ProductReportRow | null
    bestProfitProduct: ProductReportRow | null
    bestPeriodOfMonth: TimeInsightRow | null
    bestWeekday: TimeInsightRow | null
  }
  analytics: {
    bestHourByDay: TimeInsightRow[]
    bestDayByWeek: TimeInsightRow[]
    monthPeriodPerformance: TimeInsightRow[]
    weekdayPerformance: TimeInsightRow[]
    ticketByEvent: EventTicketInsightRow[]
    periods: ReportPeriodRow[]
  }
  charts: {
    salesByDay: Array<{ date: string; orders: number; paidOrders: number; revenue: number; cost: number; profit: number }>
    salesByHour: Array<{ hour: string; orders: number; revenue: number; cost: number; profit: number }>
    paymentMethods: Array<{ paymentMethod: PaymentMethod; label: string; orders: number; revenue: number }>
    status: Array<{ status: ReportStatus; label: string; count: number }>
    categories: CategoryReportRow[]
    productsByRevenue: ProductReportRow[]
    productsByProfit: ProductReportRow[]
    productsByQuantity: ProductReportRow[]
    productVariations: ProductVariationReportRow[]
    environments: EnvironmentReportRow[]
    events: EventReportRow[]
    ticketByEvent: EventTicketInsightRow[]
    bestHourByDay: TimeInsightRow[]
    bestDayByWeek: TimeInsightRow[]
    monthPeriodPerformance: TimeInsightRow[]
    weekdayPerformance: TimeInsightRow[]
    customers: CustomerReportRow[]
    periods: ReportPeriodRow[]
  }
  tables: {
    products: ProductReportRow[]
    productVariations: ProductVariationReportRow[]
    categories: CategoryReportRow[]
    events: EventReportRow[]
    ticketByEvent: EventTicketInsightRow[]
    bestHourByDay: TimeInsightRow[]
    bestDayByWeek: TimeInsightRow[]
    monthPeriodPerformance: TimeInsightRow[]
    weekdayPerformance: TimeInsightRow[]
    environments: EnvironmentReportRow[]
    customers: CustomerReportRow[]
    periods: ReportPeriodRow[]
    recentOrders: RecentOrderReportRow[]
  }
}

export type ProductReportRow = {
  productId: string
  name: string
  categoryId?: string | null
  categoryName: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  marginPercent: number
  variationCount?: number
  topVariation?: ProductVariationReportRow | null
  variations?: ProductVariationReportRow[]
}

export type CategoryReportRow = {
  categoryId: string
  name: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  marginPercent: number
}

export type EnvironmentReportRow = {
  salesEnvironmentId: string
  name: string
  color?: string | null
  orders: number
  paidOrders?: number
  averageTicket?: number
  revenue: number
  cost: number
  profit: number
}

export type EventReportRow = {
  eventDateId: string
  title: string
  startAt: string
  orders: number
  paidOrders?: number
  averageTicket?: number
  revenue: number
  productCost: number
  staffCost: number
  buyCost: number
  totalCost: number
  profit: number
}

export type CustomerReportRow = {
  id: string
  name: string
  type: 'customer' | 'internal' | 'comanda'
  orders: number
  revenue: number
  averageTicket: number
}

export type RecentOrderReportRow = {
  id: string
  comanda: number
  comandaName?: string | null
  customerName?: string | null
  eventTitle?: string | null
  environmentName?: string | null
  total: number
  cost: number
  profit: number
  status: ReportStatus
  paymentMethod?: PaymentMethod | null
  taxApplied: boolean
  createdAt: string
  paidAt?: string | null
  itemsCount: number
  items: Array<{
    productId: string
    name: string
    categoryName: string
    quantity: number
    unitPrice: number
    totalPrice: number
    estimatedCost: number
    estimatedProfit: number
    variations?: Array<{
      groupId: string
      groupName: string
      optionId: string
      optionName: string
      priceModifier: number
      revenueModifier: number
      estimatedCost: number
      estimatedProfit: number
    }>
  }>
}

export async function getReportsFilterOptions() {
  return apiFetch<ReportsFilterOptions>('/reports/filters')
}

export async function getReportsDashboard(filters: ReportFilters = {}) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') params.set(key, value)
  }

  const query = params.toString()
  return apiFetch<ReportsDashboard>(query ? `/reports/dashboard?${query}` : '/reports/dashboard')
}

// Legacy compatibility, in case some component still imports this name.
export type OrdersReportSummary = ReportsDashboard
export async function getOrdersReportSummary(fromDate?: string, toDate?: string) {
  return getReportsDashboard({ fromDate, toDate })
}
