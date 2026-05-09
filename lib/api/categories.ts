import { apiFetch } from './client'
import type { CategoryConfig } from '../pos-types'

export function getCategories() {
  return apiFetch<CategoryConfig[]>('/categories', {
    method: 'GET',
  })
}

export function getCategoryById(id: string) {
  return apiFetch<CategoryConfig>(`/categories/${id}`, {
    method: 'GET',
  })
}

export function createCategory(data: Omit<CategoryConfig, 'id'>) {
  return apiFetch<CategoryConfig>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateCategory(id: string, data: Partial<Omit<CategoryConfig, 'id'>>) {
  return apiFetch<CategoryConfig>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteCategory(id: string) {
  return apiFetch<{ ok: true }>(`/categories/${id}`, {
    method: 'DELETE',
  })
}