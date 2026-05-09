import type { InternalCustomer, Order, PaymentMethod } from '@/lib/pos-types'
import { apiFetch } from './client'

export type InternalCustomerPendingSummary = {
  pendingCount: number
  pendingTotal: number
}

export type InternalCustomerOrdersResponse = {
  customer: InternalCustomer
  orders: Order[]
  summary: InternalCustomerPendingSummary
}

export type PayInternalCustomerOrdersPayload = {
  paymentMethod: PaymentMethod
  taxApplied: boolean
  orderIds: string[]
}

export function getInternalCustomers() {
  return apiFetch<InternalCustomer[]>('/internal-customers')
}

export function getInternalCustomerTodayOrders(customerId: string) {
  return apiFetch<InternalCustomerOrdersResponse>(
    `/internal-customers/${customerId}/orders/today`
  )
}

export function getInternalCustomerPendingOrders(customerId: string) {
  return apiFetch<InternalCustomerOrdersResponse>(
    `/internal-customers/${customerId}/orders/pending`
  )
}

export function paySelectedInternalCustomerOrders(
  customerId: string,
  payload: PayInternalCustomerOrdersPayload
) {
  return apiFetch<InternalCustomerOrdersResponse>(
    `/internal-customers/${customerId}/orders/pay`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}
