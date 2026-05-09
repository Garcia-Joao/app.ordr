import { apiFetch } from '@/lib/api/client'

export type CustomerEventComanda = {
  id: string
  companyId?: string
  eventDateId: string
  customerId: string
  comandaNumber: number
  comandaName?: string | null
  eventDate?: {
    id: string
    title: string
    startAt: string
    endAt?: string | null
    status: string
  }
}

export type Customer = {
  id: string
  companyId: string
  name: string
  phone?: string | null
  email?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  eventComandas?: CustomerEventComanda[]
  totalSpent?: number
  _count?: {
    orders: number
  }
}

export type SaveCustomerInput = {
  name: string
  phone?: string | null
  email?: string | null
}

export type SaveEventCustomerComandaInput = {
  eventDateId: string
  customerId: string
  comandaNumber: number
  comandaName?: string | null
}

export async function getCustomers(params?: {
  search?: string
  includeInactive?: boolean
}): Promise<Customer[]> {
  const search = new URLSearchParams()

  if (params?.search) search.set('search', params.search)
  if (params?.includeInactive) search.set('includeInactive', 'true')

  const query = search.toString()
  return apiFetch(`/customers${query ? `?${query}` : ''}`)
}

export async function createCustomer(data: SaveCustomerInput): Promise<Customer> {
  return apiFetch('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCustomer(
  id: string,
  data: Partial<SaveCustomerInput> & { active?: boolean }
): Promise<Customer> {
  return apiFetch(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteCustomer(id: string): Promise<Customer> {
  return apiFetch(`/customers/${id}`, {
    method: 'DELETE',
  })
}

export async function upsertEventCustomerComanda(
  data: SaveEventCustomerComandaInput
): Promise<CustomerEventComanda & { customer: Customer }> {
  return apiFetch('/customers/event-comanda', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function removeEventCustomerComanda(
  eventDateId: string,
  customerId: string
) {
  return apiFetch(`/customers/event-comanda/${eventDateId}/${customerId}`, {
    method: 'DELETE',
  })
}

export async function lookupCustomerByEventComanda(params: {
  eventDateId: string
  comandaNumber: number
}): Promise<
  | null
  | {
      id: string
      customerId: string
      eventDateId: string
      comandaNumber: number
      comandaName: string
      customer: Customer
    }
> {
  const search = new URLSearchParams()
  search.set('eventDateId', params.eventDateId)
  search.set('comandaNumber', String(params.comandaNumber))

  return apiFetch(`/customers/lookup-by-comanda?${search.toString()}`)
}
