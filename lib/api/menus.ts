import type { Product } from '../pos-types'
import { apiFetch } from './client'

export type MenuItem = {
  id: string
  menuId: string
  productId: string
  price: number
  active: boolean
  sortOrder: number
  product?: Product | null
}

export type Menu = {
  id: string
  companyId: string
  name: string
  description?: string | null
  active: boolean
  items: MenuItem[]
  createdAt: string
  updatedAt: string
}

export type MenuInput = {
  name: string
  description?: string | null
  active?: boolean
  items?: Array<{
    productId: string
    price: number
    active?: boolean
    sortOrder?: number
  }>
}

export function getMenus() {
  return apiFetch<{ menus: Menu[] }>('/menus')
}

export function getActiveMenu() {
  return apiFetch<{ menu: Menu | null }>('/menus/active')
}

export function createMenu(input: MenuInput) {
  return apiFetch<{ menu: Menu }>('/menus', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMenu(menuId: string, input: Partial<MenuInput>) {
  return apiFetch<{ menu: Menu }>(`/menus/${menuId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function activateMenu(menuId: string) {
  return apiFetch<{ menu: Menu }>(`/menus/${menuId}/activate`, { method: 'POST' })
}

export function deactivateMenu(menuId: string) {
  return apiFetch<{ menu: Menu }>(`/menus/${menuId}/deactivate`, { method: 'POST' })
}

export function duplicateMenu(menuId: string, input: { name?: string; active?: boolean } = {}) {
  return apiFetch<{ menu: Menu }>(`/menus/${menuId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteMenu(menuId: string) {
  return apiFetch<{ ok: true }>(`/menus/${menuId}`, { method: 'DELETE' })
}
