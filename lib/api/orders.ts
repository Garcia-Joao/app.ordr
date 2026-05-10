import type { Order } from '@/lib/pos-types'
import {
  getItemPrice,
  getVariationOptionPriceModifierForEnvironment,
} from '@/lib/pos-types'
import { apiFetch } from '@/lib/api/client'

type PrintItemMode = 'SEPARATE' | 'GROUPED'

type OrderWithPrintModes = Order & {
  eventDateId?: string | null
  customerId?: string | null
  printItemModes?: Record<string, PrintItemMode>
}

function getOrderItemPrintKey(item: Order['items'][number]) {
  const selections = (item.variationSelections ?? [])
    .map((selection) => ({
      groupId: selection.groupId,
      selectedOptionIds: [...selection.selectedOptionIds].sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId))

  return `${item.product.id}-${JSON.stringify(selections)}`
}

export async function createOrder(
  order: OrderWithPrintModes,
  salesEnvironmentId?: string | null
): Promise<any> {
  const payload = {
    id: order.id,
    internalCustomerId: order.internalCustomerId ?? null,
    eventDateId: order.eventDateId ?? null,
    customerId: order.customerId ?? null,
    comanda: order.comanda,
    comandaName: order.comandaName ?? null,
    observation: order.observation ?? order.notes ?? null,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    status: order.status,
    total: order.total,
    paymentMethod: order.paymentMethod ?? null,
    taxApplied: order.taxApplied,
    orderItems: order.items.map((item) => {
      const unitPrice = Number(getItemPrice(item, salesEnvironmentId) ?? 0)

      return {
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
        notes: item.notes ?? null,
        printMode: order.printItemModes?.[getOrderItemPrintKey(item)] ?? 'SEPARATE',
        variations: (item.variationSelections ?? []).map((selection) => {
          const group = item.product.variationGroups?.find(
            (variationGroup) => variationGroup.id === selection.groupId
          )

          return {
            groupId: selection.groupId,
            options: selection.selectedOptionIds.map((optionId) => {
              const option = group?.options.find((item) => item.id === optionId)

              return {
                optionId,
                priceModifier: option
                  ? getVariationOptionPriceModifierForEnvironment(
                      option,
                      salesEnvironmentId
                    )
                  : 0,
              }
            }),
          }
        }),
      }
    }),
  }

  return apiFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type CreateOrderResponse = {
  id: string
  comanda: number
  comandaName?: string | null
  total: number
  status: 'pending' | 'paid' | 'cancelled'
  paymentMethod?: 'money' | 'pix' | 'credit' | 'debit' | null
  taxApplied: boolean
  createdAt: string | Date
  paidAt?: string | Date | null
}

type OrdersListResponse = Array<Order & {
  total: number | string
  createdAt: string
  paidAt?: string | null
}>

export function getOrders(includeCancelled = true) {
  const query = includeCancelled ? '?includeCancelled=true' : ''
  return apiFetch<OrdersListResponse>(`/orders${query}`)
}

export function cancelOrder(orderId: string) {
  return apiFetch<CreateOrderResponse>(`/orders/${orderId}/cancel`, {
    method: 'PATCH',
  })
}