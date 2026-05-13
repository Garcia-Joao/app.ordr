'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Hash,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  lookupCustomerByEventComanda,
  updateCustomer,
  upsertEventCustomerComanda,
  type Customer,
} from '@/lib/api/customers'
import { getEventDates, type EventDate } from '@/lib/api/events'
import { getActiveEventDate } from '@/lib/events/active-events'
import { canAny, getStoredUser } from '@/lib/permissions'
import type { AuthUser } from '@/lib/api/auth'

function formatEventLabel(eventDate: EventDate) {
  const start = new Date(eventDate.startAt)
  const date = start.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
  const time = start.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${eventDate.title} • ${date} ${time}`
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function formatCurrency(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default function ClientesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasCheckedAccess, setHasCheckedAccess] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [events, setEvents] = useState<EventDate[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const canViewCustomers = canAny(authUser, ['customers.view'])
  const canCreateCustomer = canAny(authUser, ['customers.create'])
  const canUpdateCustomer = canAny(authUser, ['customers.update'])
  const canDeleteCustomer = canAny(authUser, ['customers.delete'])
  const canUseEventComandas = canAny(authUser, ['customers.eventComanda.manage', 'events.manage'])
  const canViewEvents = canAny(authUser, ['events.view', 'events.manage', 'events.active.select', 'customers.eventComanda.manage', 'pdv.view', 'orders.create'])

  async function loadData() {
    if (!canViewCustomers) {
      setCustomers([])
      setEvents([])
      return
    }

    const activeEvent = getActiveEventDate()

    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth() + 2, 0)

    const customersData = await getCustomers()
    setCustomers(customersData)

    if (!canViewEvents) {
      setEvents([])
      return
    }

    try {
      const eventsData = await getEventDates({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        status: 'all',
      })

      const sortedEvents = [...eventsData].sort((a, b) => {
        if (activeEvent?.id === a.id) return -1
        if (activeEvent?.id === b.id) return 1
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      })

      setEvents(sortedEvents)
    } catch (error) {
      console.warn('Eventos ocultos para este usuário ou indisponíveis:', error)
      setEvents([])
    }
  }

  useEffect(() => {
    function syncStoredUser() {
      setAuthUser(getStoredUser())
      setHasCheckedAccess(true)
    }

    syncStoredUser()
    window.addEventListener('storage', syncStoredUser)
    window.addEventListener('ordr-user-updated', syncStoredUser)

    return () => {
      window.removeEventListener('storage', syncStoredUser)
      window.removeEventListener('ordr-user-updated', syncStoredUser)
    }
  }, [])

  useEffect(() => {
    if (!hasCheckedAccess) return

    async function init() {
      try {
        setIsLoading(true)
        await loadData()
      } catch (error) {
        console.error('Erro ao carregar clientes:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [hasCheckedAccess, canViewCustomers, canViewEvents])

  const filteredCustomers = useMemo(() => {
    const search = normalizeText(searchTerm)

    return customers.filter((customer) => {
      if (!search) return true

      return (
        normalizeText(customer.name).includes(search) ||
        normalizeText(customer.phone).includes(search) ||
        normalizeText(customer.email).includes(search) ||
        customer.eventComandas?.some((link) =>
          String(link.comandaNumber).includes(search)
        )
      )
    })
  }, [customers, searchTerm])

  const totalLinkedComandas = customers.reduce(
    (sum, customer) => sum + (customer.eventComandas?.length ?? 0),
    0
  )

  const totalOrders = customers.reduce(
    (sum, customer) => sum + Number(customer._count?.orders ?? 0),
    0
  )

  const totalCustomerSpent = customers.reduce(
    (sum, customer) => sum + Number(customer.totalSpent ?? 0),
    0
  )

  function openNewCustomer() {
    if (!canCreateCustomer) return
    setEditingCustomer(null)
    setIsModalOpen(true)
  }

  function openEditCustomer(customer: Customer) {
    if (!canUpdateCustomer) return
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  async function handleDeleteCustomer(customer: Customer) {
    if (!canDeleteCustomer) return
    const confirmed = window.confirm(
      `Desativar o cliente "${customer.name}"? Ele não será removido dos pedidos antigos.`
    )

    if (!confirmed) return

    try {
      await deleteCustomer(customer.id)
      await loadData()
    } catch (error: any) {
      console.error('Erro ao desativar cliente:', error)
      alert(error?.message || 'Erro ao desativar cliente.')
    }
  }

  async function handleSaved() {
    setIsModalOpen(false)
    setEditingCustomer(null)
    await loadData()
  }

  if (!hasCheckedAccess || isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando clientes...
        </div>
      </div>
    )
  }

  if (!canViewCustomers) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Clientes oculto para este acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este usuário não possui a permissão <strong>customers.view</strong>.
            Por isso a página não carrega a lista nem faz chamadas para a API.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col overflow-y-auto bg-background md:h-full md:overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Cadastro de clientes e comandas por evento
            </p>
          </div>
        </div>

        {canCreateCustomer && (
          <button
            onClick={openNewCustomer}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-border bg-card/50 p-4 sm:grid-cols-2 md:p-6 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Clientes ativos</p>
              <p className="text-2xl font-bold text-foreground">{customers.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Comandas vinculadas</p>
              <p className="text-2xl font-bold text-foreground">
                {totalLinkedComandas}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Pedidos vinculados</p>
              <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Gasto total</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCustomerSpent)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-4 py-4 md:px-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, email ou comanda..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="rounded-xl border border-border bg-card">
          <div className="space-y-3 md:hidden">
            {filteredCustomers.map((customer) => (
              <article key={customer.id} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground">{customer.name}</p>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        {customer.phone || 'Sem telefone'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{customer.email || 'Sem email'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {canUpdateCustomer && (
                      <button
                        onClick={() => openEditCustomer(customer)}
                        className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        aria-label="Editar cliente"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDeleteCustomer && (
                      <button
                        onClick={() => handleDeleteCustomer(customer)}
                        className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Excluir cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Pedidos</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{customer._count?.orders ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Gasto total</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(customer.totalSpent ?? 0)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {customer.eventComandas?.length ? (
                    customer.eventComandas.slice(0, 3).map((link) => (
                      <span key={link.id} className="inline-flex items-center rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                        #{link.comandaNumber} • {link.eventDate?.title ?? 'Evento'}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Nenhuma comanda vinculada</span>
                  )}
                  {(customer.eventComandas?.length ?? 0) > 3 && (
                    <span className="rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                      +{(customer.eventComandas?.length ?? 0) - 3}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <table className="hidden w-full border-separate border-spacing-0 md:table">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-muted/95 shadow-sm backdrop-blur">
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                  Cliente
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                  Contato
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                  Comandas por evento
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                  Pedidos
                </th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">
                  Gasto total
                </th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-foreground">{customer.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {customer.phone || 'Sem telefone'}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {customer.email || 'Sem email'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex max-w-[420px] flex-wrap gap-1.5">
                      {customer.eventComandas?.length ? (
                        customer.eventComandas.slice(0, 4).map((link) => (
                          <span
                            key={link.id}
                            title={`${link.eventDate?.title ?? 'Evento'} • ${link.comandaName ?? customer.name}`}
                            className="inline-flex items-center rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                          >
                            #{link.comandaNumber} • {link.eventDate?.title ?? 'Evento'}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Nenhuma comanda vinculada
                        </span>
                      )}
                      {(customer.eventComandas?.length ?? 0) > 4 && (
                        <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                          +{(customer.eventComandas?.length ?? 0) - 4}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-foreground">
                    {customer._count?.orders ?? 0}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-foreground">
                      {formatCurrency(customer.totalSpent ?? 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {canUpdateCustomer && (
                        <button
                          onClick={() => openEditCustomer(customer)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDeleteCustomer && (
                        <button
                          onClick={() => handleDeleteCustomer(customer)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCustomers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">Nenhum cliente encontrado</p>
              <p className="text-sm">Tente ajustar a busca ou adicione um novo cliente.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          customers={customers}
          events={events}
          isSaving={isSaving}
          setIsSaving={setIsSaving}
          canCreateCustomer={canCreateCustomer}
          canUpdateCustomer={canUpdateCustomer}
          canLinkEventComanda={canUseEventComandas && canViewEvents}
          onSaved={handleSaved}
          onClose={() => {
            setIsModalOpen(false)
            setEditingCustomer(null)
          }}
        />
      )}
    </div>
  )
}

function CustomerModal({
  customer,
  customers,
  events,
  isSaving,
  setIsSaving,
  canCreateCustomer,
  canUpdateCustomer,
  canLinkEventComanda,
  onSaved,
  onClose,
}: {
  customer: Customer | null
  customers: Customer[]
  events: EventDate[]
  isSaving: boolean
  setIsSaving: (value: boolean) => void
  canCreateCustomer: boolean
  canUpdateCustomer: boolean
  canLinkEventComanda: boolean
  onSaved: () => void | Promise<void>
  onClose: () => void
}) {
  const activeEvent = getActiveEventDate()
  const [selectedExistingCustomerId, setSelectedExistingCustomerId] = useState(
    customer?.id ?? ''
  )
  const [name, setName] = useState(customer?.name || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [email, setEmail] = useState(customer?.email || '')
  const [eventDateId, setEventDateId] = useState(
    canLinkEventComanda ? activeEvent?.id ?? events[0]?.id ?? '' : ''
  )
  const [comandaNumber, setComandaNumber] = useState('')
  const [comandaName, setComandaName] = useState(customer?.name || '')
  const [searchExisting, setSearchExisting] = useState('')
  const [comandaNameEditedManually, setComandaNameEditedManually] = useState(false)
  const [comandaNumberEditedManually, setComandaNumberEditedManually] = useState(false)
  const [isCheckingComanda, setIsCheckingComanda] = useState(false)
  const [comandaConflict, setComandaConflict] = useState<{
    customerId: string
    customerName: string
  } | null>(null)

  const selectedExistingCustomer = customers.find(
    (item) => item.id === selectedExistingCustomerId
  )

  const selectedEvent = events.find((event) => event.id === eventDateId)
  const customerNameForPreview = name.trim() || selectedExistingCustomer?.name || 'Cliente'
  const comandaNamePreview = comandaName.trim() || customerNameForPreview
  const comandaNumberPreview = comandaNumber.trim() || '--'
  const selectedCustomerStats = selectedExistingCustomer ?? customer
  const selectedCustomerSpent = Number(selectedCustomerStats?.totalSpent ?? 0)
  const selectedCustomerOrders = Number(selectedCustomerStats?._count?.orders ?? 0)

  function getNextComandaNumber(targetEventDateId: string) {
    if (!targetEventDateId) return ''

    const usedNumbers = customers
      .flatMap((customerItem) => customerItem.eventComandas ?? [])
      .filter((link) => link.eventDateId === targetEventDateId)
      .map((link) => Number(link.comandaNumber))
      .filter((value) => Number.isFinite(value) && value > 0)

    if (usedNumbers.length === 0) return '1'

    return String(Math.max(...usedNumbers) + 1)
  }

  function increaseComanda() {
    setComandaNumberEditedManually(true)
    setComandaNumber((current) => {
      const value = Number(current || 0)
      return String(Math.max(1, value + 1))
    })
  }

  function decreaseComanda() {
    setComandaNumberEditedManually(true)
    setComandaNumber((current) => {
      const value = Number(current || 1)
      return String(Math.max(1, value - 1))
    })
  }

  function updateCustomerName(value: string) {
    if (!customer) {
      setSelectedExistingCustomerId('')
    }

    setName(value)

    if (!comandaNameEditedManually) {
      setComandaName(value)
    }
  }

  const filteredExistingCustomers = useMemo(() => {
    const term = normalizeText(searchExisting)
    if (!term) return customers.slice(0, 5)

    return customers
      .filter((item) => {
        return (
          normalizeText(item.name).includes(term) ||
          normalizeText(item.phone).includes(term) ||
          normalizeText(item.email).includes(term)
        )
      })
      .slice(0, 5)
  }, [customers, searchExisting])

  useEffect(() => {
    if (!selectedExistingCustomer) {
      if (!comandaNumberEditedManually && eventDateId) {
        setComandaNumber(getNextComandaNumber(eventDateId))
      }

      return
    }

    setName(selectedExistingCustomer.name)
    setPhone(selectedExistingCustomer.phone ?? '')
    setEmail(selectedExistingCustomer.email ?? '')

    const existingLink = selectedExistingCustomer.eventComandas?.find(
      (link) => link.eventDateId === eventDateId
    )

    if (existingLink) {
      setComandaNumber(String(existingLink.comandaNumber))
      setComandaName(existingLink.comandaName ?? selectedExistingCustomer.name)
      setComandaNameEditedManually(Boolean(existingLink.comandaName))
      return
    }

    if (!comandaNumberEditedManually) {
      setComandaNumber(getNextComandaNumber(eventDateId))
    }

    if (!comandaNameEditedManually) {
      setComandaName(selectedExistingCustomer.name)
    }
  }, [
    selectedExistingCustomer,
    eventDateId,
    comandaNumberEditedManually,
    comandaNameEditedManually,
    customers,
  ])

  useEffect(() => {
    if (selectedExistingCustomer) return
    if (comandaNumberEditedManually) return
    if (!eventDateId) return

    setComandaNumber(getNextComandaNumber(eventDateId))
  }, [eventDateId, selectedExistingCustomer, comandaNumberEditedManually, customers])

  useEffect(() => {
    if (!canLinkEventComanda) {
      setComandaConflict(null)
      setIsCheckingComanda(false)
      return
    }

    const parsedComanda = Number(comandaNumber)
    const currentCustomerId = customer?.id ?? selectedExistingCustomerId

    if (!eventDateId || !Number.isInteger(parsedComanda) || parsedComanda <= 0) {
      setComandaConflict(null)
      setIsCheckingComanda(false)
      return
    }

    let cancelled = false

    async function checkComanda() {
      try {
        setIsCheckingComanda(true)

        const result = await lookupCustomerByEventComanda({
          eventDateId,
          comandaNumber: parsedComanda,
        })

        if (cancelled) return

        const foundCustomer = result?.customer

        if (!foundCustomer) {
          setComandaConflict(null)
          return
        }

        if (foundCustomer.id === currentCustomerId) {
          setComandaConflict(null)

          if (result.comandaName && !comandaNameEditedManually) {
            setComandaName(result.comandaName)
          }

          return
        }

        setComandaConflict({
          customerId: foundCustomer.id,
          customerName: foundCustomer.name,
        })
      } catch (error) {
        if (!cancelled) {
          console.error('Erro ao verificar comanda:', error)
          setComandaConflict(null)
        }
      } finally {
        if (!cancelled) {
          setIsCheckingComanda(false)
        }
      }
    }

    const timer = window.setTimeout(checkComanda, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    eventDateId,
    comandaNumber,
    customer?.id,
    selectedExistingCustomerId,
    comandaNameEditedManually,
    canLinkEventComanda,
  ])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!name.trim()) {
      alert('Informe o nome do cliente.')
      return
    }

    const customerIdToUpdate = customer?.id ?? selectedExistingCustomerId
    const parsedComanda = Number(comandaNumber)
    const shouldLinkComanda =
      canLinkEventComanda && eventDateId && Number.isInteger(parsedComanda) && parsedComanda > 0

    if (customerIdToUpdate && !canUpdateCustomer && !shouldLinkComanda) {
      alert('Você não tem permissão para editar clientes.')
      return
    }

    if (!customerIdToUpdate && !canCreateCustomer) {
      alert('Você não tem permissão para criar clientes.')
      return
    }

    if (shouldLinkComanda && comandaConflict) {
      alert(
        `A comanda #${parsedComanda} já está vinculada ao cliente ${comandaConflict.customerName} neste evento.`
      )
      return
    }

    const finalComandaName = comandaName.trim() || name.trim()

    try {
      setIsSaving(true)

      const savedCustomer = customerIdToUpdate
        ? canUpdateCustomer
          ? await updateCustomer(customerIdToUpdate, {
              name,
              phone: phone || null,
              email: email || null,
            })
          : selectedExistingCustomer ?? customer
        : await createCustomer({
            name,
            phone: phone || null,
            email: email || null,
          })

      if (!savedCustomer) {
        alert('Cliente não encontrado para vincular a comanda.')
        return
      }

      if (shouldLinkComanda) {
        await upsertEventCustomerComanda({
          eventDateId,
          customerId: savedCustomer.id,
          comandaNumber: parsedComanda,
          comandaName: finalComandaName || savedCustomer.name,
        })
      }

      await onSaved()
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error)

      if (error?.message === 'COMANDA_ALREADY_LINKED_TO_ANOTHER_CUSTOMER') {
        alert('Essa comanda já está vinculada a outro cliente neste evento.')
        return
      }

      alert(error?.message || 'Erro ao salvar cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="mobile-modal-shell flex h-[94svh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {customer ? 'Editar cliente' : 'Novo cliente / vincular comanda'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Cadastre o cliente à esquerda e vincule a comanda do evento à direita.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`customer-modal-form grid min-h-0 flex-1 grid-cols-1 overflow-y-auto ${canLinkEventComanda ? 'lg:grid-cols-[1fr_390px]' : ''}`}
        >
          <div className="space-y-5 overflow-y-visible p-4 sm:p-6 lg:overflow-y-auto">
            {!customer && (
              <section className="rounded-2xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Cliente existente</h3>
                    <p className="text-sm text-muted-foreground">
                      Pesquise antes de criar para evitar cadastros duplicados.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchExisting}
                    onChange={(event) => setSearchExisting(event.target.value)}
                    placeholder="Nome, telefone ou email..."
                    className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {filteredExistingCustomers.length > 0 && (
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {filteredExistingCustomers.map((item) => {
                      const isSelected = item.id === selectedExistingCustomerId

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedExistingCustomerId(isSelected ? '' : item.id)
                            if (isSelected) {
                              setName('')
                              setPhone('')
                              setEmail('')
                              setComandaName('')
                              setComandaNumber('')
                              setComandaNameEditedManually(false)
                              setComandaNumberEditedManually(false)
                            }
                          }}
                          className={`w-full rounded-xl border px-4 py-2.5 text-left transition ${
                            isSelected
                              ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                              : 'border-border bg-card hover:bg-secondary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.phone || 'Sem telefone'} • {item.email || 'Sem email'}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                                Usar este cliente
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">Dados do cliente</h3>
                <p className="text-sm text-muted-foreground">
                  Informações principais para identificar o cliente.
                </p>
              </div>

              {selectedCustomerStats && (
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Gasto do cliente</p>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {formatCurrency(selectedCustomerSpent)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Pedidos vinculados</p>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {selectedCustomerOrders}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Nome
                  </label>
                  <input
                    value={name}
                    onChange={(event) => updateCustomerName(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-card px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Nome completo"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Telefone / número
                  </label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-card px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-card px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="flex flex-col overflow-y-visible border-t border-border bg-primary/5 p-4 sm:p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <section className="sticky top-0 overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-sm">
              <div className="border-b border-primary/20 bg-primary/10 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <UserPlus className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground">Comanda do evento</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Selecione o evento e defina o número da comanda deste cliente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className={`rounded-2xl border bg-background p-5 text-center ${
                    comandaConflict ? 'border-destructive/40' : 'border-primary/30'
                  }`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Número da comanda
                  </p>

                  <div
                    className={`mt-3 grid h-20 grid-cols-[1fr_64px] overflow-hidden rounded-2xl border bg-background transition ${
                      comandaConflict
                        ? 'border-destructive ring-2 ring-destructive/20'
                        : 'border-primary/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 px-4">
                      <span
                        className={`text-4xl font-black ${
                          comandaConflict ? 'text-destructive' : 'text-primary'
                        }`}
                      >
                        #
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={comandaNumber}
                        onChange={(event) => {
                          setComandaNumberEditedManually(true)
                          setComandaNumber(event.target.value)
                        }}
                        className={`h-full w-full border-0 bg-transparent text-center text-4xl font-black outline-none [appearance:textfield] placeholder:text-primary/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                          comandaConflict ? 'text-destructive' : 'text-primary'
                        }`}
                        placeholder="42"
                      />
                    </div>

                    <div className="grid h-full grid-rows-2 border-l border-border">
                      <button
                        type="button"
                        onClick={increaseComanda}
                        className="flex items-center justify-center bg-card text-primary transition hover:bg-primary/10"
                        title="Aumentar comanda"
                      >
                        <ChevronUp className="h-7 w-7" />
                      </button>

                      <button
                        type="button"
                        onClick={decreaseComanda}
                        className="flex items-center justify-center border-t border-border bg-card text-primary transition hover:bg-primary/10"
                        title="Diminuir comanda"
                      >
                        <ChevronDown className="h-7 w-7" />
                      </button>
                    </div>
                  </div>
                  {isCheckingComanda && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Verificando disponibilidade da comanda...
                    </p>
                  )}

                  {comandaConflict && (
                    <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      A comanda #{comandaNumber} já está vinculada a{' '}
                      <strong>{comandaConflict.customerName}</strong> neste evento.
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Evento
                  </label>
                  <select
                    value={eventDateId}
                    onChange={(event) => setEventDateId(event.target.value)}
                    className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Não vincular agora</option>
                    {events.map((eventDate) => (
                      <option key={eventDate.id} value={eventDate.id}>
                        {formatEventLabel(eventDate)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-foreground">
                      Nome que aparece na comanda
                    </label>

                    {comandaNameEditedManually && (
                      <button
                        type="button"
                        onClick={() => {
                          setComandaName(name)
                          setComandaNameEditedManually(false)
                        }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Usar nome do cliente
                      </button>
                    )}
                  </div>

                  <input
                    value={comandaName}
                    onChange={(event) => {
                      setComandaName(event.target.value)
                      setComandaNameEditedManually(true)
                    }}
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={name || 'Usa o nome do cliente se vazio'}
                  />

                  <p className="mt-2 text-xs text-muted-foreground">
                    Esse nome acompanha o nome do cliente até ser editado manualmente.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Prévia
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary px-3 py-1 text-lg font-bold text-primary-foreground">
                        #{comandaNumberPreview}
                      </span>
                      <span className="font-semibold text-foreground">{comandaNamePreview}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {selectedEvent ? selectedEvent.title : 'Nenhum evento selecionado'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-auto flex gap-3 border-t border-primary/20 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-secondary px-4 py-3 font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || isCheckingComanda || Boolean(comandaConflict)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  )
}
