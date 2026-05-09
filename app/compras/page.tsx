'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'
import { getStockProducts } from '@/lib/api/stock'
import { getCurrentEventDates, getEventDates, type EventDate } from '@/lib/api/events'
import {
  cancelBuyRequest,
  clearBuyCart,
  confirmBuyCart,
  getBuyCart,
  getBuyRequests,
  printBuyRequestShoppingList,
  receiveBuyRequest,
  removeBuyCartItem,
  updateBuyCart,
  upsertBuyCartItem,
  type BuyCart,
  type BuyProduct,
  type BuyRequest,
  type BuyRequestItemStatus,
} from '@/lib/api/buys'

function formatBRL(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function getProductUnitLabel(product: BuyProduct) {
  if (product.stockUnit === 'unit') return 'un.'
  if (product.stockUnit === 'ml') return 'ml'
  if (product.stockUnit === 'l') return 'l'
  if (product.stockUnit === 'g') return 'g'
  if (product.stockUnit === 'kg') return 'kg'
  return product.stockUnit ?? 'un.'
}

function formatQuantity(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  })
}

function formatEventDateTimeRange(eventDate: EventDate) {
  const start = new Date(eventDate.startAt)
  const end = eventDate.endAt ? new Date(eventDate.endAt) : null

  const startLabel = start.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const endLabel = end
    ? end.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null

  return endLabel ? `${startLabel} → ${endLabel}` : startLabel
}

function toDateInputValue(value: Date) {
  const offset = value.getTimezoneOffset()
  const local = new Date(value.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function getEventDateStatus(eventDate: EventDate) {
  return ((eventDate as any).status ?? 'scheduled') as string
}

function isActiveEventDate(eventDate: EventDate) {
  const status = getEventDateStatus(eventDate)
  if (status === 'cancelled' || status === 'done') return false

  const now = new Date()
  const start = new Date(eventDate.startAt)
  const end = eventDate.endAt ? new Date(eventDate.endAt) : null

  return start <= now && (!end || end >= now)
}

function isPlannedEventDate(eventDate: EventDate) {
  const status = getEventDateStatus(eventDate)
  if (status === 'cancelled' || status === 'done') return false

  const start = new Date(eventDate.startAt)
  return start > new Date()
}

function mergeEventDates(...groups: EventDate[][]) {
  const byId = new Map<string, EventDate>()

  for (const group of groups) {
    for (const eventDate of group) {
      byId.set(eventDate.id, eventDate)
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )
}

function parseMoney(value: string | number | null | undefined) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const normalized = value.replace(',', '.').trim()
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function getRequestEventDateId(request: BuyRequest | null | undefined) {
  return (
    (request as any)?.eventDateId ??
    (request as any)?.eventDate?.id ??
    (request as any)?.event?.id ??
    null
  ) as string | null
}

function getEventLabelForRequest(
  request: BuyRequest | null | undefined,
  eventDates: EventDate[],
) {
  if (!request) return 'Sem evento vinculado'

  const embeddedEvent = ((request as any).eventDate ?? (request as any).event) as
    | EventDate
    | undefined

  if (embeddedEvent?.title) {
    return `${embeddedEvent.title} • ${formatEventDateTimeRange(embeddedEvent)}`
  }

  const eventDateId = getRequestEventDateId(request)
  const eventDate = eventDates.find((item) => item.id === eventDateId)

  return eventDate
    ? `${eventDate.title} • ${formatEventDateTimeRange(eventDate)}`
    : 'Sem evento vinculado'
}

function getEffectiveBoughtQuantity(item: {
  status: ReceiveItemStatus
  boughtQuantity: string
}) {
  if (item.status === 'not_bought') return 0
  return parseMoney(item.boughtQuantity)
}

function getEffectiveUnitPrice(item: {
  status: ReceiveItemStatus
  unitPrice: string
}) {
  if (item.status === 'not_bought') return 0
  return item.unitPrice === '' ? 0 : parseMoney(item.unitPrice)
}

function getEffectiveTotalPrice(item: {
  status: ReceiveItemStatus
  boughtQuantity: string
  unitPrice: string
  totalPrice: string
}) {
  if (item.status === 'not_bought') return 0

  const explicitTotal = item.totalPrice === '' ? null : parseMoney(item.totalPrice)
  if (explicitTotal != null && Number.isFinite(explicitTotal)) return explicitTotal

  return getEffectiveBoughtQuantity(item) * getEffectiveUnitPrice(item)
}

function isUnitBuyProduct(product: Pick<BuyProduct, 'stockUnit'> | null | undefined) {
  return (product?.stockUnit ?? 'unit') === 'unit'
}

function getBuyQuantityStep(product: Pick<BuyProduct, 'stockUnit'> | null | undefined) {
  return isUnitBuyProduct(product) ? '1' : '0.001'
}

function normalizeBuyQuantityForProduct(
  product: Pick<BuyProduct, 'stockUnit'> | null | undefined,
  quantity: number,
) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0

  return isUnitBuyProduct(product) ? Math.ceil(quantity) : quantity
}


function isBuyableStockProduct(product: any) {
  return (
    product.active !== false &&
    product.trackStock === true &&
    product.unlimitedStock !== true &&
    product.madeOnDemand !== true &&
    product.costMode !== 'recipe' &&
    !(product.hasRecipe === true) &&
    !(Array.isArray(product.recipeItems) && product.recipeItems.length > 0)
  )
}

function getRequestStatusLabel(status: BuyRequest['status']) {
  const labels: Record<BuyRequest['status'], string> = {
    pending: 'Pendente',
    partially_received: 'Recebida parcial',
    received: 'Recebida',
    cancelled: 'Cancelada',
  }

  return labels[status]
}

function getRequestStatusClass(status: BuyRequest['status']) {
  if (status === 'received') return 'border-success/30 bg-success/10 text-success'
  if (status === 'partially_received') return 'border-warning/30 bg-warning/10 text-warning'
  if (status === 'cancelled') return 'border-destructive/30 bg-destructive/10 text-destructive'
  return 'border-primary/30 bg-primary/10 text-primary'
}

type ReceiveItemStatus = BuyRequestItemStatus | 'not_bought'

type ReceiveFormItem = {
  itemId: string
  boughtQuantity: string
  unitPrice: string
  totalPrice: string
  status: ReceiveItemStatus
}

export default function ComprasPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [cart, setCart] = useState<BuyCart | null>(null)
  const [requests, setRequests] = useState<BuyRequest[]>([])
  const [stockProducts, setStockProducts] = useState<BuyProduct[]>([])
  const [search, setSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedQuantity, setSelectedQuantity] = useState('1')
  const [selectedRequest, setSelectedRequest] = useState<BuyRequest | null>(null)
  const [receiveForm, setReceiveForm] = useState<ReceiveFormItem[]>([])
  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [cartItemQuantities, setCartItemQuantities] = useState<Record<string, string>>({})

  async function loadData() {
    const today = new Date()
    const plannedUntil = addMonths(today, 12)

    const [
      cartData,
      requestsData,
      stockProductsData,
      activeEventDatesData,
      plannedEventDatesData,
    ] = await Promise.all([
      getBuyCart(),
      getBuyRequests(),
      getStockProducts(),
      getCurrentEventDates(),
      getEventDates({
        from: toDateInputValue(today),
        to: toDateInputValue(plannedUntil),
        status: 'all',
      }),
    ])

    const visibleEventDates = mergeEventDates(
      activeEventDatesData,
      plannedEventDatesData.filter(
        (eventDate) => isActiveEventDate(eventDate) || isPlannedEventDate(eventDate),
      ),
    )

    setCart(cartData)
    setRequests(requestsData)
    setEventDates(visibleEventDates)
    setStockProducts(
      stockProductsData
        .filter(isBuyableStockProduct)
        .map((product: any) => ({
          ...product,
          stockQuantity: Number(product.stockQuantity ?? 0),
        }))
    )
  }

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true)
        await loadData()
      } catch (error) {
        console.error('Erro ao carregar compras:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  useEffect(() => {
    setCartItemQuantities((current) => {
      const next: Record<string, string> = {}

      for (const item of cart?.items ?? []) {
        next[item.productId] = current[item.productId] ?? String(item.quantity ?? 0)
      }

      return next
    })
  }, [cart?.items])

  const filteredProducts = useMemo(() => {
    const term = normalizeText(productSearch)

    return stockProducts
      .filter((product) => {
        if (!term) return true

        return (
          normalizeText(product.name).includes(term) ||
          normalizeText(product.category?.name).includes(term)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [stockProducts, productSearch])

  const selectedProduct = useMemo(() => {
    return stockProducts.find((product) => product.id === selectedProductId) ?? null
  }, [stockProducts, selectedProductId])

  const activeEventDates = useMemo(
    () => eventDates.filter(isActiveEventDate),
    [eventDates],
  )

  const plannedEventDates = useMemo(
    () => eventDates.filter(isPlannedEventDate),
    [eventDates],
  )

  const filteredRequests = useMemo(() => {
    const term = normalizeText(search)

    return requests.filter((request) => {
      if (!term) return true

      return (
        normalizeText(request.title).includes(term) ||
        normalizeText(request.supplierName).includes(term) ||
        request.items.some((item) => normalizeText(item.product.name).includes(term))
      )
    })
  }, [requests, search])

  const cartTotalItems = cart?.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0) ?? 0

  function openReceiveModal(request: BuyRequest) {
    setSelectedRequest(request)
    setReceiveForm(
      request.items.map((item) => ({
        itemId: item.id,
        boughtQuantity:
          item.boughtQuantity && Number(item.boughtQuantity) > 0
            ? String(item.boughtQuantity)
            : String(item.requestedQuantity),
        unitPrice: item.unitPrice == null ? '' : String(item.unitPrice),
        totalPrice:
          item.totalPrice == null
            ? item.unitPrice == null
              ? ''
              : String(Number(item.unitPrice) * Number(item.boughtQuantity ?? item.requestedQuantity ?? 0))
            : String(item.totalPrice),
        status: (item.status === 'pending' ? 'bought' : item.status) as ReceiveItemStatus,
      }))
    )
  }

  async function handleCartMetaChange(patch: Partial<BuyCart>) {
    try {
      const updated = await updateBuyCart(patch)
      setCart(updated)
    } catch (error) {
      console.error('Erro ao atualizar carrinho:', error)
    }
  }

  async function handleAddItem() {
    if (!selectedProductId || isSaving) return

    const quantity = normalizeBuyQuantityForProduct(
      selectedProduct,
      Number(selectedQuantity.replace(',', '.')),
    )
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Informe uma quantidade válida.')
      return
    }

    try {
      setIsSaving(true)
      const updated = await upsertBuyCartItem({
        productId: selectedProductId,
        quantity,
        notes: null,
      })
      setCart(updated)
      setSelectedProductId('')
      setSelectedQuantity('1')
      setProductSearch('')
    } catch (error: any) {
      console.error('Erro ao adicionar item:', error)
      alert(error?.message || 'Erro ao adicionar item.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveCartItem(productId: string) {
    try {
      const updated = await removeBuyCartItem(productId)
      setCart(updated)
    } catch (error) {
      console.error('Erro ao remover item:', error)
    }
  }

  async function handleUpdateCartItemQuantity(
    productId: string,
    product: BuyProduct,
    rawQuantity: string | number,
  ) {
    if (isSaving) return

    const quantity = normalizeBuyQuantityForProduct(
      product,
      typeof rawQuantity === 'number' ? rawQuantity : Number(rawQuantity.replace(',', '.')),
    )

    if (!Number.isFinite(quantity) || quantity <= 0) {
      await handleRemoveCartItem(productId)
      return
    }

    try {
      setIsSaving(true)
      const updated = await upsertBuyCartItem({
        productId,
        quantity,
        notes: null,
      })
      setCart(updated)
      setCartItemQuantities((current) => ({
        ...current,
        [productId]: String(quantity),
      }))
    } catch (error: any) {
      console.error('Erro ao atualizar quantidade do carrinho:', error)
      alert(error?.message || 'Erro ao atualizar quantidade do carrinho.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClearCart() {
    if (!confirm('Limpar carrinho de compras?')) return

    try {
      const updated = await clearBuyCart()
      setCart(updated)
    } catch (error) {
      console.error('Erro ao limpar carrinho:', error)
    }
  }

  async function handleConfirmCart() {
    if (!cart || cart.items.length === 0 || isSaving) return

    if (!confirm('Criar solicitação de compra com os itens do carrinho?')) return

    try {
      setIsSaving(true)
      await confirmBuyCart({
        title: cart.title,
        supplierName: cart.supplierName,
        notes: null,
        eventDateId: cart.eventDateId,
      })
      await loadData()
    } catch (error: any) {
      console.error('Erro ao confirmar carrinho:', error)
      alert(error?.message || 'Erro ao criar solicitação de compra.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancelRequest(request: BuyRequest) {
    if (!confirm(`Cancelar compra "${request.title}"?`)) return

    try {
      await cancelBuyRequest(request.id)
      await loadData()
    } catch (error: any) {
      console.error('Erro ao cancelar compra:', error)
      alert(error?.message || 'Erro ao cancelar compra.')
    }
  }


  async function handlePrintShoppingList(request: BuyRequest) {
    if (request.status !== 'pending') {
      alert('Só é possível imprimir a lista de compras de solicitações pendentes.')
      return
    }

    try {
      setIsSaving(true)
      await printBuyRequestShoppingList(request.id)
    } catch (error: any) {
      console.error('Erro ao imprimir lista de compras:', error)
      alert(error?.message || 'Erro ao imprimir lista de compras.')
    } finally {
      setIsSaving(false)
    }
  }

  function updateReceiveItem(itemId: string, patch: Partial<ReceiveFormItem>) {
    setReceiveForm((current) =>
      current.map((item) => {
        if (item.itemId !== itemId) return item

        if (patch.status === 'not_bought') {
          return {
            ...item,
            status: 'not_bought',
            boughtQuantity: '',
            unitPrice: '',
            totalPrice: '',
          }
        }

        const next: ReceiveFormItem = {
          ...item,
          ...patch,
        }

        if (item.status === 'not_bought' && patch.status && !isNotBoughtStatus(patch.status)) {
          const requestItem = selectedRequest?.items.find((entry) => entry.id === itemId)
          next.boughtQuantity = String(requestItem?.requestedQuantity ?? 0)
        }

        if (patch.boughtQuantity !== undefined) {
          next.status = 'partial'

          const quantity = parseMoney(patch.boughtQuantity)
          const unitPrice = parseMoney(next.unitPrice)

          next.totalPrice = quantity > 0 && unitPrice > 0 ? String(quantity * unitPrice) : ''
        }

        if (patch.unitPrice !== undefined) {
          const quantity = parseMoney(next.boughtQuantity)
          const unitPrice = parseMoney(patch.unitPrice)

          next.totalPrice = quantity > 0 && unitPrice > 0 ? String(quantity * unitPrice) : ''
        }

        if (patch.totalPrice !== undefined) {
          const quantity = parseMoney(next.boughtQuantity)
          const totalPrice = parseMoney(patch.totalPrice)

          next.unitPrice = quantity > 0 && totalPrice > 0 ? String(totalPrice / quantity) : ''
        }

        return next
      })
    )
  }

  function isNotBoughtStatus(status: unknown) {
  return String(status) === 'not_bought'
}

  async function handleReceiveRequest() {
    if (!selectedRequest || isSaving) return

    if (!confirm('Finalizar conferência? Isso vai atualizar o estoque e o custo dos itens comprados.')) {
      return
    }

    try {
      setIsSaving(true)

      const updated = await receiveBuyRequest(selectedRequest.id, {
        items: receiveForm.map((item) => {
          if (item.status === 'not_bought') {
            return {
              itemId: item.itemId,
              boughtQuantity: 0,
              unitPrice: null,
              totalPrice: null,
              status: item.status as BuyRequestItemStatus,
              notes: null,
            }
          }

          const boughtQuantity = getEffectiveBoughtQuantity(item)
          const unitPriceValue = getEffectiveUnitPrice(item)
          const totalPriceValue = getEffectiveTotalPrice(item)
          const unitPrice = unitPriceValue > 0 ? unitPriceValue : null
          const totalPrice = totalPriceValue > 0 ? totalPriceValue : null

          return {
            itemId: item.itemId,
            boughtQuantity,
            unitPrice,
            totalPrice,
            status: item.status as BuyRequestItemStatus,
            notes: null,
          }
        }),
      })

      setSelectedRequest(updated)
      await loadData()
      setSelectedRequest(null)
      setReceiveForm([])
    } catch (error: any) {
      console.error('Erro ao receber compra:', error)
      alert(error?.message || 'Erro ao receber compra.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando compras...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background mobile-page-scroll">
      <div className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Compras</h1>
            <p className="text-sm text-muted-foreground">
              Monte carrinhos, crie solicitações e atualize estoque/custos ao receber.
            </p>
          </div>
        </div>

        <div className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-muted-foreground sm:w-auto">
          Carrinho: <span className="font-semibold text-foreground">{cart?.items.length ?? 0}</span> item{cart?.items.length === 1 ? '' : 's'} •{' '}
          <span className="font-semibold text-foreground">{cartTotalItems}</span> qtd.
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(540px,640px)_1fr] lg:gap-0 lg:overflow-hidden lg:p-0">
        <aside className="flex min-h-0 flex-col rounded-2xl border border-border bg-card lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r">
          <div className="border-b border-border p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Carrinho de compra</h2>
              </div>
              <button
                onClick={handleClearCart}
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Limpar carrinho"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={cart?.title ?? ''}
                onChange={(event) => handleCartMetaChange({ title: event.target.value })}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Título da compra"
              />
              <input
                value={cart?.supplierName ?? ''}
                onChange={(event) => handleCartMetaChange({ supplierName: event.target.value })}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Fornecedor / mercado"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Evento / custo do evento
              </label>
              <select
                value={cart?.eventDateId ?? ''}
                onChange={(event) =>
                  handleCartMetaChange({ eventDateId: event.target.value || null } as Partial<BuyCart>)
                }
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Sem evento vinculado</option>

                {activeEventDates.length > 0 && (
                  <optgroup label="Eventos ativos agora">
                    {activeEventDates.map((eventDate) => (
                      <option key={eventDate.id} value={eventDate.id}>
                        {eventDate.title} • {formatEventDateTimeRange(eventDate)}
                      </option>
                    ))}
                  </optgroup>
                )}

                {plannedEventDates.length > 0 && (
                  <optgroup label="Eventos planejados">
                    {plannedEventDates.map((eventDate) => (
                      <option key={eventDate.id} value={eventDate.id}>
                        {eventDate.title} • {formatEventDateTimeRange(eventDate)}
                      </option>
                    ))}
                  </optgroup>
                )}

                {activeEventDates.length === 0 && plannedEventDates.length === 0 && (
                  <option value="" disabled>
                    Nenhum evento ativo ou planejado encontrado
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="border-b border-border p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Adicionar item</h3>
              {selectedProduct && (
                <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                  Estoque: {formatQuantity(selectedProduct.stockQuantity)} {getProductUnitLabel(selectedProduct)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_120px]">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm"
                    placeholder="Buscar item de estoque..."
                  />
                </div>

                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">Selecione um item</option>
                  {filteredProducts.slice(0, 100).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} • {formatQuantity(product.stockQuantity)} {getProductUnitLabel(product)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Quantidade
                </label>
                <input
                  type="number"
                  step={getBuyQuantityStep(selectedProduct)}
                  min={isUnitBuyProduct(selectedProduct) ? '1' : '0.001'}
                  value={selectedQuantity}
                  onChange={(event) => setSelectedQuantity(event.target.value)}
                  onBlur={() => {
                    const quantity = normalizeBuyQuantityForProduct(
                      selectedProduct,
                      Number(selectedQuantity.replace(',', '.')),
                    )

                    if (quantity > 0) {
                      setSelectedQuantity(String(quantity))
                    }
                  }}
                  className="h-[90px] w-full rounded-xl border border-border bg-background px-3 text-center text-2xl font-bold text-foreground"
                  placeholder="Qtd."
                />
              </div>

              <button
                onClick={handleAddItem}
                disabled={isSaving || !selectedProductId}
                className="mt-6 inline-flex h-[90px] items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!cart?.items.length ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum item no carrinho.
              </div>
            ) : (
              <div className="grid gap-3">
                {cart.items.map((item) => {
                  const quantityValue = cartItemQuantities[item.productId] ?? String(item.quantity ?? 0)
                  const step = Number(getBuyQuantityStep(item.product))

                  return (
                    <div key={item.productId} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.product.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Unidade de compra: {getProductUnitLabel(item.product)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveCartItem(item.productId)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCartItemQuantity(
                              item.productId,
                              item.product,
                              Number(quantityValue.replace(',', '.')) - step,
                            )
                          }
                          className="h-9 w-9 rounded-lg border border-border bg-card text-lg font-semibold hover:bg-secondary"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          step={getBuyQuantityStep(item.product)}
                          min={isUnitBuyProduct(item.product) ? '1' : '0.001'}
                          value={quantityValue}
                          onChange={(event) =>
                            setCartItemQuantities((current) => ({
                              ...current,
                              [item.productId]: event.target.value,
                            }))
                          }
                          onBlur={(event) =>
                            handleUpdateCartItemQuantity(
                              item.productId,
                              item.product,
                              event.target.value,
                            )
                          }
                          className="h-9 w-28 rounded-lg border border-border bg-card px-3 text-center text-sm font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCartItemQuantity(
                              item.productId,
                              item.product,
                              Number(quantityValue.replace(',', '.')) + step,
                            )
                          }
                          className="h-9 w-9 rounded-lg border border-border bg-card text-lg font-semibold hover:bg-secondary"
                        >
                          +
                        </button>
                        <span className="text-sm text-muted-foreground">
                          {getProductUnitLabel(item.product)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border p-5">
            <button
              onClick={handleConfirmCart}
              disabled={isSaving || !cart?.items.length}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Criar solicitação de compra
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-card/50 px-6 py-4">
            <div>
              <h2 className="font-semibold text-foreground">Solicitações</h2>
              <p className="text-xs text-muted-foreground">
                Clique em uma compra pendente para conferir o que foi comprado.
              </p>
            </div>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm"
                placeholder="Buscar compras..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {filteredRequests.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Nenhuma compra encontrada.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredRequests.map((request) => {
                  const activeItems = request.items.filter(
                    (item) => !isNotBoughtStatus(item.status)
                  )
                  const notBoughtItems = request.items.length - activeItems.length
                  const requested = request.items.reduce((sum, item) => sum + Number(item.requestedQuantity ?? 0), 0)
                  const bought = activeItems.reduce((sum, item) => sum + Number(item.boughtQuantity ?? 0), 0)
                  const total = activeItems.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0)
                  const eventLabel = getEventLabelForRequest(request, eventDates)

                  return (
                    <div key={request.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-foreground">{request.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(request.createdAt)}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            <span className="truncate">{eventLabel}</span>
                          </p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${getRequestStatusClass(request.status)}`}>
                          {getRequestStatusLabel(request.status)}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>{request.items.length} item{request.items.length === 1 ? '' : 's'}</p>
                        <p>Solicitado: <span className="font-medium text-foreground">{requested.toFixed(2)}</span></p>
                        <p>Comprado: <span className="font-medium text-foreground">{bought.toFixed(2)}</span></p>
                        {notBoughtItems > 0 && (
                          <p>Não comprado: <span className="font-medium text-foreground">{notBoughtItems}</span> item{notBoughtItems === 1 ? '' : 's'}</p>
                        )}
                        <p>Total pago: <span className="font-medium text-foreground">{formatBRL(total)}</span></p>
                        {request.supplierName && <p>Fornecedor: {request.supplierName}</p>}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <button
                          onClick={() => openReceiveModal(request)}
                          className="h-9 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          {request.status === 'pending' ? 'Conferir' : 'Ver detalhes'}
                        </button>
                        <button
                          onClick={() => handlePrintShoppingList(request)}
                          disabled={request.status !== 'pending' || isSaving}
                          className="h-9 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
                        >
                          Imprimir
                        </button>
                        <button
                          onClick={() => handleCancelRequest(request)}
                          disabled={request.status !== 'pending'}
                          className="h-9 rounded-xl bg-destructive/15 text-xs font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-40"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Conferir compra</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.title} • informe o que foi comprado e o preço pago.
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {getEventLabelForRequest(selectedRequest, eventDates)}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg p-2 hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {selectedRequest.items.map((item) => {
                  const formItem = receiveForm.find((entry) => entry.itemId === item.id)
                  const fallbackFormItem: ReceiveFormItem = {
                    itemId: item.id,
                    boughtQuantity: '',
                    unitPrice: '',
                    totalPrice: '',
                    status: 'not_bought',
                  }
                  const safeFormItem = formItem ?? fallbackFormItem
                  const isNotBought = safeFormItem.status === 'not_bought'
                  const boughtQuantity = getEffectiveBoughtQuantity(safeFormItem)
                  const unitPrice = getEffectiveUnitPrice(safeFormItem)
                  const total = getEffectiveTotalPrice(safeFormItem)

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 ${isNotBought
                          ? 'border-destructive/30 bg-destructive/5 opacity-80'
                          : 'border-border bg-background'
                        }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Pedido: {Number(item.requestedQuantity).toFixed(2)} {getProductUnitLabel(item.product)} • estoque atual {Number(item.product.stockQuantity ?? 0).toFixed(2)}
                          </p>
                        </div>

                        {isNotBought && (
                          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                            Não comprado
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[130px_140px_140px_140px_150px] lg:items-end">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Qtd. comprada
                          </label>
                          <input
                            type="number"
                            step={getBuyQuantityStep(item.product)}
                            min="0"
                            value={safeFormItem.boughtQuantity}
                            onChange={(event) => updateReceiveItem(item.id, { boughtQuantity: event.target.value })}
                            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Qtd."
                            disabled={selectedRequest.status !== 'pending' || isNotBought}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Preço por {getProductUnitLabel(item.product)}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={safeFormItem.unitPrice}
                            onChange={(event) => updateReceiveItem(item.id, { unitPrice: event.target.value })}
                            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Preço un."
                            disabled={selectedRequest.status !== 'pending' || isNotBought}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Total do item
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={safeFormItem.totalPrice}
                            onChange={(event) => updateReceiveItem(item.id, { totalPrice: event.target.value })}
                            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Total"
                            disabled={selectedRequest.status !== 'pending' || isNotBought}
                          />
                        </div>

                        <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                          <p className="text-[11px] text-muted-foreground">Calculado</p>
                          <p className="font-semibold text-foreground">{formatBRL(total)}</p>
                          {!isNotBought && boughtQuantity > 0 && unitPrice > 0 && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {formatBRL(unitPrice)} / {getProductUnitLabel(item.product)}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Status
                          </label>
                          <select
                            value={safeFormItem.status}
                            onChange={(event) => updateReceiveItem(item.id, { status: event.target.value as ReceiveItemStatus })}
                            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                            disabled={selectedRequest.status !== 'pending'}
                          >
                            <option value="bought">Comprado</option>
                            <option value="partial">Parcial</option>
                            <option value="not_bought">Não comprado</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => setSelectedRequest(null)}
                className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-secondary"
              >
                Fechar
              </button>
              {selectedRequest.status === 'pending' && (
                <button
                  onClick={handleReceiveRequest}
                  disabled={isSaving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Finalizar e atualizar estoque
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
