import { apiFetch } from './client'
import type { Product } from '../pos-types'

export type GetProductsOptions = {
  activeMenuOnly?: boolean
  includeInactive?: boolean
}

export function getProducts(options: GetProductsOptions = {}) {
  const params = new URLSearchParams()
  if (options.activeMenuOnly) params.set('menu', 'active')
  if (options.includeInactive) params.set('includeInactive', 'true')
  const query = params.toString()
  return apiFetch<Product[]>(`/products${query ? `?${query}` : ''}`)
}

export function getProductById(productId: string) {
  return apiFetch<Product>(`/products/${productId}`)
}

export function createProduct(input: Omit<Product, 'id'>) {
  return apiFetch<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProduct(productId: string, input: Omit<Product, 'id'>) {
  return apiFetch<Product>(`/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteProduct(productId: string) {
  return apiFetch<{ ok: true }>(`/products/${productId}`, {
    method: 'DELETE',
  })
}