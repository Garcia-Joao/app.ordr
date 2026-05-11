import { apiFetch } from '@/lib/api/client'

export type BuyRequestStatus =
  | 'pending'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export type BuyRequestItemStatus =
  | 'pending'
  | 'bought'
  | 'not_bought'
  | 'partial'

export type BuyProduct = {
  id: string
  name: string
  emoji?: string | null
  stockQuantity?: number | null
  stockUnit?: string | null
  referenceCost?: number | string | null
  referenceQuantity?: number | string | null
  simpleCost?: number | string | null
  category?: {
    id: string
    name: string
  } | null
}

export type BuyCartItem = {
  productId: string
  quantity: number
  notes?: string | null
  addedAt: string
  updatedAt: string
  product: BuyProduct
}

export type BuyCart = {
  companyId: string
  title: string
  supplierName?: string | null
  notes?: string | null
  eventDateId?: string | null
  items: BuyCartItem[]
  updatedAt: string
}

export type BuyRequestItem = {
  id: string
  buyRequestId: string
  productId: string
  product: BuyProduct
  requestedQuantity: number
  boughtQuantity: number
  unitPrice: number | null
  totalPrice: number | null
  status: BuyRequestItemStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type BuyRequest = {
  id: string
  companyId: string
  eventDateId?: string | null
  title: string
  supplierName?: string | null
  notes?: string | null
  status: BuyRequestStatus
  createdAt: string
  updatedAt: string
  confirmedAt?: string | null
  receivedAt?: string | null
  cancelledAt?: string | null
  items: BuyRequestItem[]
}

export async function getBuyCart(): Promise<BuyCart> {
  return apiFetch('/buys/cart')
}

export async function updateBuyCart(input: {
  title?: string
  supplierName?: string | null
  notes?: string | null
  eventDateId?: string | null
}): Promise<BuyCart> {
  return apiFetch('/buys/cart', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function upsertBuyCartItem(input: {
  productId: string
  quantity: number
  notes?: string | null
}): Promise<BuyCart> {
  return apiFetch('/buys/cart/items', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removeBuyCartItem(productId: string): Promise<BuyCart> {
  return apiFetch(`/buys/cart/items/${productId}`, {
    method: 'DELETE',
  })
}

export async function clearBuyCart(): Promise<BuyCart> {
  return apiFetch('/buys/cart', {
    method: 'DELETE',
  })
}

export async function confirmBuyCart(input: {
  title?: string
  supplierName?: string | null
  notes?: string | null
  eventDateId?: string | null
}): Promise<BuyRequest> {
  return apiFetch('/buys/cart/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getBuyRequests(): Promise<BuyRequest[]> {
  return apiFetch('/buys')
}

export async function receiveBuyRequest(
  id: string,
  input: {
    items: Array<{
      itemId: string
      boughtQuantity: number
      unitPrice?: number | null
      totalPrice?: number | null
      status?: BuyRequestItemStatus
      notes?: string | null
    }>
  }
): Promise<BuyRequest> {
  return apiFetch(`/buys/${id}/receive`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function printBuyRequestShoppingList(id: string, portId?: string | null): Promise<{ ok: true; queuedCount?: number; failedCount?: number }> {
  return apiFetch(`/buys/${id}/print-shopping-list`, {
    method: 'POST',
    body: JSON.stringify({ portId: portId || null }),
  })
}

export async function cancelBuyRequest(id: string): Promise<BuyRequest> {
  return apiFetch(`/buys/${id}/cancel`, {
    method: 'PATCH',
  })
}
