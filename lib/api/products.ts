import { apiFetch } from './client'
import type { Product } from '../pos-types'

export function getProducts() {
  return apiFetch<Product[]>('/products')
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