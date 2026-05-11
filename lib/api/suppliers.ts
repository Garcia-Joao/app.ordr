import { apiFetch } from './client'
import type { StockProduct, StockUnit } from './stock'

export type SupplierPriceTableItem = {
  id: string
  priceTableId: string
  productId?: string | null
  product?: Pick<StockProduct, 'id' | 'name' | 'emoji' | 'stockUnit' | 'category'> | null
  itemName: string
  sku?: string | null
  unit: StockUnit
  quantity: string | number
  unitPrice: string | number
  notes?: string | null
  lastQuotedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type SupplierPriceTable = {
  id: string
  supplierId: string
  name: string
  description?: string | null
  active: boolean
  validFrom?: string | null
  validUntil?: string | null
  items: SupplierPriceTableItem[]
  createdAt: string
  updatedAt: string
}

export type Supplier = {
  id: string
  companyId: string
  name: string
  document?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  priceTables: SupplierPriceTable[]
  createdAt: string
  updatedAt: string
}

export type SupplierInput = {
  name: string
  document?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  active?: boolean
  createDefaultTable?: boolean
}

export type SupplierPriceTableInput = {
  name: string
  description?: string | null
  active?: boolean
  validFrom?: string | null
  validUntil?: string | null
}

export type SupplierPriceTableItemInput = {
  productId?: string | null
  itemName?: string | null
  sku?: string | null
  unit?: StockUnit | null
  quantity?: number | string | null
  unitPrice: number | string
  notes?: string | null
  lastQuotedAt?: string | null
}

export function getSuppliers() {
  return apiFetch<Supplier[]>('/suppliers')
}

export function createSupplier(input: SupplierInput) {
  return apiFetch<Supplier>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateSupplier(id: string, input: Partial<SupplierInput>) {
  return apiFetch<Supplier>(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteSupplier(id: string) {
  return apiFetch<Supplier>(`/suppliers/${id}`, { method: 'DELETE' })
}

export function createSupplierPriceTable(supplierId: string, input: SupplierPriceTableInput) {
  return apiFetch<Supplier>(`/suppliers/${supplierId}/price-tables`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateSupplierPriceTable(supplierId: string, tableId: string, input: Partial<SupplierPriceTableInput>) {
  return apiFetch<Supplier>(`/suppliers/${supplierId}/price-tables/${tableId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteSupplierPriceTable(supplierId: string, tableId: string) {
  return apiFetch<Supplier>(`/suppliers/${supplierId}/price-tables/${tableId}`, { method: 'DELETE' })
}

export function createSupplierPriceTableItem(supplierId: string, tableId: string, input: SupplierPriceTableItemInput) {
  return apiFetch<Supplier>(`/suppliers/${supplierId}/price-tables/${tableId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateSupplierPriceTableItem(supplierId: string, tableId: string, itemId: string, input: Partial<SupplierPriceTableItemInput>) {
  return apiFetch<Supplier>(`/suppliers/${supplierId}/price-tables/${tableId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteSupplierPriceTableItem(supplierId: string, tableId: string, itemId: string) {
  return apiFetch<Supplier>(`/suppliers/${supplierId}/price-tables/${tableId}/items/${itemId}`, { method: 'DELETE' })
}
