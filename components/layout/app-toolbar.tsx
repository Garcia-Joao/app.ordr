'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Clock,
  Wifi,
  WifiOff,
  PackagePlus,
  Plus,
  PackageMinus,
  SlidersHorizontal,
  X,
  Loader2,
  Search,
  CalendarDays,
  ShoppingCart,
  Trash2,
  Building2,
  FlaskConical,
  BadgeCheck,
  AlertTriangle,
} from 'lucide-react'
import {
  createStockMovement,
  getStockProducts,
  type StockProduct,
} from '@/lib/api/stock'
import { emitStockUpdated } from '@/lib/events/stock-events'
import {
  clearBuyCart,
  confirmBuyCart,
  getBuyCart,
  removeBuyCartItem,
  updateBuyCart,
  upsertBuyCartItem,
  type BuyCart,
} from '@/lib/api/buys'

import {
  EVENTS_UPDATED_EVENT,
  getCurrentEventDates,
  type EventDate,
} from '@/lib/api/events'
import { canAny, getStoredUser } from '@/lib/permissions'
import { OrdrIcon } from '@/components/brand/ordr-brand'
import type { AuthUser } from '@/lib/api/auth'
import {
  getActiveEventDate,
  getActiveEventDateId,
  setActiveEventDate,
} from '@/lib/events/active-events'

type AppToolbarProps = {
  title?: string
  currentUser: string | null
  isOnline: boolean
  time: Date | null
  onLogout: () => void | Promise<void>
  isBusy?: boolean
  rightContent?: React.ReactNode
  accountContent?: React.ReactNode
}

type QuickStockMovementType = 'in' | 'out' | 'adjustment'

function formatQuantity(
  quantity: number | string | null | undefined,
  unit?: string | null
) {
  const value = Number(quantity ?? 0)

  const formatted = value.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  })

  return `${formatted}${unit ? ` ${unit}` : ''}`
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

function getMovementLabel(type: QuickStockMovementType) {
  if (type === 'in') return 'Entrada'
  if (type === 'out') return 'Saída'
  return 'Ajuste'
}

function getStockUnitLabel(unit?: string | null) {
  if (unit === 'unit') return 'un.'
  return unit ?? 'un.'
}

function isUnitBuyProduct(product: Pick<StockProduct, 'stockUnit'> | null | undefined) {
  return (product?.stockUnit ?? 'unit') === 'unit'
}

function getBuyQuantityStep(product: Pick<StockProduct, 'stockUnit'> | null | undefined) {
  return isUnitBuyProduct(product) ? '1' : '0.001'
}

function normalizeBuyQuantityForProduct(
  product: Pick<StockProduct, 'stockUnit'> | null | undefined,
  quantity: number,
) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0

  return isUnitBuyProduct(product) ? Math.ceil(quantity) : quantity
}

export function AppToolbar({
  title = 'Ordr',
  currentUser,
  isOnline,
  time,
  onLogout,
  isBusy = false,
  rightContent,
  accountContent,
}: AppToolbarProps) {
  const [showStockModal, setShowStockModal] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isSavingMovement, setIsSavingMovement] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showBuyCartModal, setShowBuyCartModal] = useState(false)
  const [buyCart, setBuyCart] = useState<BuyCart | null>(null)
  const [buyProductSearch, setBuyProductSearch] = useState('')
  const [buySelectedProductId, setBuySelectedProductId] = useState('')
  const [buyQuantity, setBuyQuantity] = useState('1')
  const [buyCartItemQuantities, setBuyCartItemQuantities] = useState<Record<string, string>>({})
  const [isLoadingBuyCart, setIsLoadingBuyCart] = useState(false)
  const [isSavingBuyCart, setIsSavingBuyCart] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  const [products, setProducts] = useState<StockProduct[]>([])
  const [productSearch, setProductSearch] = useState('')

  const [selectedProductId, setSelectedProductId] = useState('')
  const [movementType, setMovementType] =
    useState<QuickStockMovementType>('in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [currentEvents, setCurrentEvents] = useState<EventDate[]>([])
  const [activeEventDateId, setActiveEventDateIdState] = useState<string | null>(
    null
  )
  const [isLoadingCurrentEvents, setIsLoadingCurrentEvents] = useState(false)

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === selectedProductId) ?? null
  }, [products, selectedProductId])

  const stockProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()

    return products
      .filter((product) => {
        if (!product.trackStock) return false

        if (term === '') return true

        return (
          product.name.toLowerCase().includes(term) ||
          (product.emoji ?? '').toLowerCase().includes(term) ||
          (product.category?.name ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, productSearch])

  const buyProducts = useMemo(() => {
    const term = buyProductSearch.trim().toLowerCase()

    return products
      .filter(isBuyableStockProduct)
      .filter((product) => {
        if (term === '') return true

        return (
          product.name.toLowerCase().includes(term) ||
          (product.emoji ?? '').toLowerCase().includes(term) ||
          (product.category?.name ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, buyProductSearch])

  const selectedBuyProduct = useMemo(() => {
    return products.find((product) => product.id === buySelectedProductId) ?? null
  }, [products, buySelectedProductId])

  const buyCartQuantity = useMemo(() => {
    return buyCart?.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0) ?? 0
  }, [buyCart])

  useEffect(() => {
    setBuyCartItemQuantities((current) => {
      const next: Record<string, string> = {}

      for (const item of buyCart?.items ?? []) {
        next[item.productId] = current[item.productId] ?? String(item.quantity ?? 0)
      }

      return next
    })
  }, [buyCart?.items])

  const canUseEvents = canAny(authUser, ['events.view', 'events.manage', 'events.active.select'])
  const canUseBuyCart = canAny(authUser, ['buys.view', 'buys.create', 'buys.manage', 'stock.quickBuy', 'stock.purchase.create'])
  const canUseQuickStock = canAny(authUser, ['stock.adjust', 'stock.quickAdjust'])

  const activeEvent = useMemo(() => {
    if (!hasMounted || !canUseEvents) return null

    return (
      currentEvents.find((eventDate) => eventDate.id === activeEventDateId) ??
      getActiveEventDate()
    )
  }, [currentEvents, activeEventDateId, hasMounted, canUseEvents])

  const currentCompany = useMemo(() => {
    if (!authUser?.companies?.length) return null

    return (
      authUser.companies.find((company) => company.id === authUser.companyId) ??
      authUser.companies[0] ??
      null
    )
  }, [authUser])

  const currentCompanyLicenseDaysRemaining =
    typeof currentCompany?.licenseDaysRemaining === 'number'
      ? currentCompany.licenseDaysRemaining
      : null

  const isCurrentCompanyLicenseExpiringSoon = Boolean(
    currentCompany?.licenseActive === true &&
      currentCompanyLicenseDaysRemaining !== null &&
      currentCompanyLicenseDaysRemaining >= 0 &&
      currentCompanyLicenseDaysRemaining < 7
  )

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

  function formatEventShortTimeRange(eventDate: EventDate) {
    const start = new Date(eventDate.startAt)
    const end = eventDate.endAt ? new Date(eventDate.endAt) : null

    const startLabel = start.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const endLabel = end
      ? end.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      : null

    return endLabel ? `${startLabel} - ${endLabel}` : startLabel
  }

  async function loadProductsForStock() {
    try {
      setIsLoadingProducts(true)

      const data = await getStockProducts()
      setProducts(data)

      setSelectedProductId((current) => {
        if (current && data.some((product) => product.id === current)) {
          return current
        }

        const firstStockProduct = data.find((product) => product.trackStock)
        return firstStockProduct?.id ?? ''
      })
    } catch (error: any) {
      console.error('Erro ao carregar produtos para estoque:', error)
      alert(error?.message || 'Erro ao carregar produtos.')
    } finally {
      setIsLoadingProducts(false)
    }
  }

  async function loadCurrentEvents(options?: { preserveSelection?: boolean }) {
    try {
      setIsLoadingCurrentEvents(true)

      const data = await getCurrentEventDates()
      setCurrentEvents(data)

      const storedActiveEvent = getActiveEventDate()
      const storedActiveEventId = getActiveEventDateId() ?? storedActiveEvent?.id ?? null
      const storedStillValid =
        storedActiveEventId &&
        data.some((eventDate) => eventDate.id === storedActiveEventId)

      if (storedStillValid) {
        const nextActiveEvent =
          data.find((eventDate) => eventDate.id === storedActiveEventId) ??
          storedActiveEvent ??
          null

        setActiveEventDateIdState(nextActiveEvent?.id ?? null)
        setActiveEventDate(nextActiveEvent)
        return
      }

      if (options?.preserveSelection) {
        setActiveEventDateIdState(storedActiveEventId)
        return
      }

      const nextActiveEvent = data[0] ?? null
      setActiveEventDateIdState(nextActiveEvent?.id ?? null)
      setActiveEventDate(nextActiveEvent)
    } catch (error) {
      console.error('Erro ao carregar eventos atuais:', error)
      setCurrentEvents([])

      if (!options?.preserveSelection) {
        setActiveEventDateIdState(null)
        setActiveEventDate(null)
      }
    } finally {
      setIsLoadingCurrentEvents(false)
    }
  }

  useEffect(() => {
    setHasMounted(true)
    setAuthUser(getStoredUser())

    function handleUserUpdated() {
      setAuthUser(getStoredUser())
    }

    window.addEventListener('storage', handleUserUpdated)
    window.addEventListener('ordr-user-updated', handleUserUpdated)

    return () => {
      window.removeEventListener('storage', handleUserUpdated)
      window.removeEventListener('ordr-user-updated', handleUserUpdated)
    }
  }, [])

  useEffect(() => {
    if (!hasMounted) return

    if (!canUseEvents) {
      setCurrentEvents([])
      setActiveEventDateIdState(null)
      setActiveEventDate(null)
      return
    }

    loadCurrentEvents()

    const timer = window.setInterval(() => {
      loadCurrentEvents()
    }, 60_000)

    function handleEventsUpdated() {
      loadCurrentEvents()
    }

    window.addEventListener(EVENTS_UPDATED_EVENT, handleEventsUpdated)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener(EVENTS_UPDATED_EVENT, handleEventsUpdated)
    }
  }, [hasMounted, canUseEvents])

  function handleActiveEventChange(eventDate: EventDate | null) {
    setActiveEventDateIdState(eventDate?.id ?? null)
    setActiveEventDate(eventDate)
    setShowEventModal(false)
  }

  async function openEventModal() {
    if (!canUseEvents) return
    const storedActiveEvent = getActiveEventDate()
    const storedActiveEventId = getActiveEventDateId() ?? storedActiveEvent?.id ?? null

    setActiveEventDateIdState(storedActiveEventId)
    setShowEventModal(true)
    await loadCurrentEvents({ preserveSelection: true })
  }

  async function openStockModal() {
    if (!canUseQuickStock) return
    setShowStockModal(true)

    if (products.length === 0) {
      await loadProductsForStock()
    }
  }

  async function loadBuyCartData() {
    try {
      setIsLoadingBuyCart(true)

      const [cartData, productsData] = await Promise.all([
        getBuyCart(),
        products.length > 0 ? Promise.resolve(products) : getStockProducts(),
      ])

      setBuyCart(cartData)
      setProducts(productsData)
    } catch (error: any) {
      console.error('Erro ao carregar carrinho de compras:', error)
      alert(error?.message || 'Erro ao carregar carrinho de compras.')
    } finally {
      setIsLoadingBuyCart(false)
    }
  }

  async function openBuyCartModal() {
    if (!canUseBuyCart) return
    setShowBuyCartModal(true)
    await Promise.all([loadBuyCartData(), loadCurrentEvents({ preserveSelection: true })])
  }

  function closeBuyCartModal() {
    if (isSavingBuyCart) return

    setShowBuyCartModal(false)
    setBuyProductSearch('')
    setBuySelectedProductId('')
    setBuyQuantity('1')
  }

  async function handleBuyCartMetaChange(patch: Partial<BuyCart>) {
    try {
      const updated = await updateBuyCart(patch)
      setBuyCart(updated)
    } catch (error) {
      console.error('Erro ao atualizar carrinho de compras:', error)
    }
  }

  async function handleAddBuyCartItem() {
    if (!buySelectedProductId || isSavingBuyCart) return

    const quantityNumber = normalizeBuyQuantityForProduct(
      selectedBuyProduct,
      Number(buyQuantity.replace(',', '.')),
    )

    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      alert('Informe uma quantidade válida.')
      return
    }

    try {
      setIsSavingBuyCart(true)
      const updated = await upsertBuyCartItem({
        productId: buySelectedProductId,
        quantity: quantityNumber,
        notes: null,
      })

      setBuyCart(updated)
      setBuySelectedProductId('')
      setBuyQuantity('1')
      setBuyProductSearch('')
    } catch (error: any) {
      console.error('Erro ao adicionar item ao carrinho:', error)
      alert(error?.message || 'Erro ao adicionar item ao carrinho.')
    } finally {
      setIsSavingBuyCart(false)
    }
  }

  async function handleRemoveBuyCartItem(productId: string) {
    try {
      const updated = await removeBuyCartItem(productId)
      setBuyCart(updated)
    } catch (error: any) {
      console.error('Erro ao remover item do carrinho:', error)
      alert(error?.message || 'Erro ao remover item do carrinho.')
    }
  }

  async function handleUpdateBuyCartItemQuantity(
    productId: string,
    product: StockProduct,
    rawQuantity: string | number,
  ) {
    if (isSavingBuyCart) return

    const quantityNumber = normalizeBuyQuantityForProduct(
      product,
      typeof rawQuantity === 'number' ? rawQuantity : Number(rawQuantity.replace(',', '.')),
    )

    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      await handleRemoveBuyCartItem(productId)
      return
    }

    try {
      setIsSavingBuyCart(true)
      const updated = await upsertBuyCartItem({
        productId,
        quantity: quantityNumber,
        notes: null,
      })

      setBuyCart(updated)
      setBuyCartItemQuantities((current) => ({
        ...current,
        [productId]: String(quantityNumber),
      }))
    } catch (error: any) {
      console.error('Erro ao atualizar quantidade do carrinho:', error)
      alert(error?.message || 'Erro ao atualizar quantidade do carrinho.')
    } finally {
      setIsSavingBuyCart(false)
    }
  }

  async function handleClearBuyCart() {
    if (!confirm('Limpar carrinho de compras?')) return

    try {
      setIsSavingBuyCart(true)
      const updated = await clearBuyCart()
      setBuyCart(updated)
    } catch (error: any) {
      console.error('Erro ao limpar carrinho:', error)
      alert(error?.message || 'Erro ao limpar carrinho.')
    } finally {
      setIsSavingBuyCart(false)
    }
  }

  async function handleConfirmBuyCart() {
    if (!buyCart || buyCart.items.length === 0 || isSavingBuyCart) return

    if (!confirm('Criar solicitação de compra com os itens do carrinho?')) return

    try {
      setIsSavingBuyCart(true)
      await confirmBuyCart({
        title: buyCart.title,
        supplierName: buyCart.supplierName,
        notes: null,
        eventDateId: buyCart.eventDateId,
      })
      await loadBuyCartData()
      alert('Solicitação de compra criada com sucesso.')
    } catch (error: any) {
      console.error('Erro ao criar solicitação de compra:', error)
      alert(error?.message || 'Erro ao criar solicitação de compra.')
    } finally {
      setIsSavingBuyCart(false)
    }
  }

  function closeStockModal() {
    if (isSavingMovement) return

    setShowStockModal(false)
    setProductSearch('')
    setQuantity('')
    setReason('')
    setMovementType('in')
  }

  async function handleSaveStockMovement() {
    if (!selectedProductId) {
      alert('Selecione um item de estoque.')
      return
    }

    const quantityNumber = Number(quantity.replace(',', '.'))

    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      alert('Informe uma quantidade válida.')
      return
    }

    try {
      setIsSavingMovement(true)

      const result = await createStockMovement({
        productId: selectedProductId,
        type: movementType,
        quantity: quantityNumber,
        reason: reason.trim() || null,
      })

      emitStockUpdated({
        productId: selectedProductId,
      })

      setProducts((current) =>
        current.map((product) =>
          product.id === result.product.id ? result.product : product
        )
      )

      setQuantity('')
      setReason('')
      setProductSearch('')

      alert(`${getMovementLabel(movementType)} registrada com sucesso.`)
    } catch (error: any) {
      console.error('Erro ao registrar movimentação de estoque:', error)

      if (error?.message === 'PRODUCT_NOT_FOUND' || error?.message === 'Product not found') {
        alert('Produto não encontrado.')
        return
      }

      if (
        error?.message === 'STOCK_MOVEMENT_TYPE_REQUIRED' ||
        error?.message === 'Movement type is required'
      ) {
        alert('Selecione o tipo da movimentação.')
        return
      }

      if (
        error?.message === 'STOCK_MOVEMENT_QUANTITY_INVALID' ||
        error?.message === 'Quantity must be greater than zero'
      ) {
        alert('Informe uma quantidade maior que zero.')
        return
      }

      if (
        error?.message === 'STOCK_NEGATIVE_NOT_ALLOWED' ||
        error?.message === 'Insufficient stock for this movement'
      ) {
        alert('Essa saída deixaria o estoque negativo.')
        return
      }

      alert(error?.message || 'Erro ao registrar movimentação de estoque.')
    } finally {
      setIsSavingMovement(false)
    }
  }

  useEffect(() => {
    if (!showStockModal) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeStockModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showStockModal, isSavingMovement])

  return (
    <>
      <div className="ordr-topbar flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 sm:px-4 lg:px-6 shrink-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <h1 className="text-lg font-semibold text-foreground truncate">
            {title}
          </h1>

          {rightContent}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {canUseEvents && (
            <button
              type="button"
              onClick={openEventModal}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground ${activeEvent ? 'text-primary' : ''}`}
              title={
                activeEvent
                  ? `Evento ativo: ${activeEvent.title} • ${formatEventDateTimeRange(activeEvent)}`
                  : 'Selecionar evento ativo'
              }
              aria-label="Selecionar evento ativo"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              {activeEvent && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>
          )}

          {canUseBuyCart && (
            <button
              type="button"
              onClick={openBuyCartModal}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              title="Carrinho de compras"
              aria-label="Carrinho de compras"
            >
              <ShoppingCart className="h-4 w-4" />
              {buyCart && buyCart.items.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm">
                  {buyCart.items.length}
                </span>
              )}
            </button>
          )}

          {canUseQuickStock && (
            <button
              type="button"
              onClick={openStockModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              title="Estoque rápido"
              aria-label="Estoque rápido"
            >
              <PackagePlus className="h-4 w-4" />
            </button>
          )}

          <div
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border bg-background sm:inline-flex"
            title={isOnline ? 'Conectado' : 'Desconectado'}
            aria-label={isOnline ? 'Conectado' : 'Desconectado'}
          >
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
          </div>

          <div className="hidden items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-muted-foreground md:flex">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-mono" suppressHydrationWarning>
              {time?.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }) || '--:--'}
            </span>
          </div>

          {currentCompany && (
            <Link
              href="/selecionar-empresa/"
              className={`hidden min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-foreground transition hover:-translate-y-0.5 hover:border-primary hover:bg-secondary lg:flex ${
                currentCompany.isTest
                  ? 'max-w-[310px] border-sky-500/35 bg-sky-500/10 shadow-[0_0_0_1px_rgba(14,165,233,0.12)]'
                  : 'max-w-[250px] border-border bg-background'
              }`}
              title={currentCompany.isTest ? `${currentCompany.name} • ambiente de teste • trocar empresa` : `${currentCompany.name} • trocar empresa`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${currentCompany.isTest ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'bg-primary/10 text-primary'}`}>
                {currentCompany.isTest ? (
                  <FlaskConical className="h-3.5 w-3.5" />
                ) : (
                  <Building2 className="h-3.5 w-3.5" />
                )}
              </span>

              <span className="min-w-0 truncate text-sm font-semibold">
                {currentCompany.name}
              </span>

              {currentCompany.isTest && (
                <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  Ambiente teste
                </span>
              )}

              {currentCompany.licenseActive === false ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  Licença
                </span>
              ) : isCurrentCompanyLicenseExpiringSoon ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  {currentCompanyLicenseDaysRemaining === 0 ? 'Hoje' : `${currentCompanyLicenseDaysRemaining}d`}
                </span>
              ) : currentCompany.licenseActive === true ? (
                <span className="hidden shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-600 xl:flex">
                  <BadgeCheck className="h-3 w-3" />
                  Ativa
                </span>
              ) : null}

              <span className="hidden shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary xl:inline-flex">
                Trocar
              </span>
            </Link>
          )}

          {accountContent ? (
            accountContent
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {currentUser ?? '—'}
              </span>

              <button
                onClick={onLogout}
                disabled={isBusy}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>


      {showEventModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Evento ativo
                </h2>
                <p className="text-sm text-muted-foreground">
                  Escolha o evento atual para vincular os próximos pedidos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Apenas eventos dentro do horário agendado aparecem aqui.
                </p>

                <button
                  type="button"
                  onClick={() => loadCurrentEvents({ preserveSelection: true })}
                  disabled={isLoadingCurrentEvents}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
                >
                  {isLoadingCurrentEvents && <Loader2 className="h-4 w-4 animate-spin" />}
                  Atualizar
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleActiveEventChange(null)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${!activeEventDateId
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background hover:bg-secondary'
                    }`}
                >
                  <p className="font-semibold text-foreground">Sem evento ativo</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Os pedidos não serão vinculados a uma data de evento.
                  </p>
                </button>

                {isLoadingCurrentEvents ? (
                  <div className="rounded-2xl border border-border bg-background p-5 text-sm text-muted-foreground">
                    Carregando eventos atuais...
                  </div>
                ) : currentEvents.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background p-5 text-sm text-muted-foreground">
                    Nenhum evento está dentro do horário agendado agora.
                  </div>
                ) : (
                  currentEvents.map((eventDate) => (
                    <button
                      key={eventDate.id}
                      type="button"
                      onClick={() => handleActiveEventChange(eventDate)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${activeEventDateId === eventDate.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:bg-secondary'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {eventDate.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatEventDateTimeRange(eventDate)}
                          </p>
                          {eventDate.salesEnvironment?.name && (
                            <p className="mt-2 inline-flex rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                              Ambiente: {eventDate.salesEnvironment.name}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {formatEventShortTimeRange(eventDate)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBuyCartModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Carrinho de compras</h2>
                <p className="text-sm text-muted-foreground">Adicione ou remova itens rapidamente e confirme para criar uma solicitação.</p>
              </div>
              <button type="button" onClick={closeBuyCartModal} disabled={isSavingBuyCart} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid flex-1 min-h-0 grid-cols-[1fr_340px] overflow-hidden">
              <div className="flex min-h-0 flex-col border-r border-border">
                <div className="border-b border-border p-5">
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <input value={buyCart?.title ?? ''} onChange={(event) => handleBuyCartMetaChange({ title: event.target.value })} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Título da compra" />
                    <input value={buyCart?.supplierName ?? ''} onChange={(event) => handleBuyCartMetaChange({ supplierName: event.target.value })} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Fornecedor / mercado" />
                  </div>
                  <div className="mb-3">
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Evento / custo do evento
                    </label>
                    <select value={buyCart?.eventDateId ?? ''} onChange={(event) => handleBuyCartMetaChange({ eventDateId: event.target.value || null } as Partial<BuyCart>)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="">Sem evento vinculado</option>
                      {currentEvents.map((eventDate) => (
                        <option key={eventDate.id} value={eventDate.id}>
                          {eventDate.title} • {formatEventDateTimeRange(eventDate)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-[1fr_110px_110px] gap-2">
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={buyProductSearch} onChange={(event) => setBuyProductSearch(event.target.value)} placeholder="Buscar item de estoque..." className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <select value={buySelectedProductId} onChange={(event) => setBuySelectedProductId(event.target.value)} disabled={isLoadingBuyCart || buyProducts.length === 0} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50">
                        {isLoadingBuyCart ? <option value="">Carregando...</option> : buyProducts.length === 0 ? <option value="">Nenhum item encontrado</option> : <>
                          <option value="">Selecione um item</option>
                          {buyProducts.slice(0, 100).map((product) => (
                            <option key={product.id} value={product.id}>{product.name} — {formatQuantity(product.stockQuantity, product.stockUnit)}</option>
                          ))}
                        </>}
                      </select>
                    </div>
                    <input type="number" step={getBuyQuantityStep(selectedBuyProduct)} min={isUnitBuyProduct(selectedBuyProduct) ? '1' : '0.001'} value={buyQuantity} onChange={(event) => setBuyQuantity(event.target.value)} onBlur={() => { const quantityNumber = normalizeBuyQuantityForProduct(selectedBuyProduct, Number(buyQuantity.replace(',', '.'))); if (quantityNumber > 0) setBuyQuantity(String(quantityNumber)) }} className="h-[88px] rounded-xl border border-border bg-background px-3 text-center text-xl font-bold text-foreground" placeholder="Qtd." />
                    <button type="button" onClick={handleAddBuyCartItem} disabled={isSavingBuyCart || !buySelectedProductId} className="inline-flex h-[88px] items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      <Plus className="h-4 w-4" /> Adicionar
                    </button>
                  </div>
                  {selectedBuyProduct && <p className="mt-2 text-xs text-muted-foreground">Estoque atual: {formatQuantity(selectedBuyProduct.stockQuantity, selectedBuyProduct.stockUnit)}</p>}
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {isLoadingBuyCart ? (
                    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando carrinho...</div>
                  ) : !buyCart?.items.length ? (
                    <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">Nenhum item no carrinho.</div>
                  ) : (
                    <div className="grid gap-3">
                      {buyCart.items.map((item) => {
                        const quantityValue = buyCartItemQuantities[item.productId] ?? String(item.quantity ?? 0)
                        const step = Number(getBuyQuantityStep(item.product as StockProduct))

                        return (
                          <div key={item.productId} className="rounded-xl border border-border bg-background p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{item.product.name}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Unidade de compra: {getStockUnitLabel(item.product.stockUnit)}
                                </p>
                              </div>
                              <button type="button" onClick={() => handleRemoveBuyCartItem(item.productId)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <button type="button" onClick={() => handleUpdateBuyCartItemQuantity(item.productId, item.product as StockProduct, Number(quantityValue.replace(',', '.')) - step)} className="h-9 w-9 rounded-lg border border-border bg-card text-lg font-semibold hover:bg-secondary">−</button>
                              <input type="number" step={getBuyQuantityStep(item.product as StockProduct)} min={isUnitBuyProduct(item.product as StockProduct) ? '1' : '0.001'} value={quantityValue} onChange={(event) => setBuyCartItemQuantities((current) => ({ ...current, [item.productId]: event.target.value }))} onBlur={(event) => handleUpdateBuyCartItemQuantity(item.productId, item.product as StockProduct, event.target.value)} className="h-9 w-28 rounded-lg border border-border bg-card px-3 text-center text-sm font-semibold" />
                              <button type="button" onClick={() => handleUpdateBuyCartItemQuantity(item.productId, item.product as StockProduct, Number(quantityValue.replace(',', '.')) + step)} className="h-9 w-9 rounded-lg border border-border bg-card text-lg font-semibold hover:bg-secondary">+</button>
                              <span className="text-sm text-muted-foreground">{getStockUnitLabel(item.product.stockUnit)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <aside className="flex flex-col bg-background p-5">
                <div className="rounded-2xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Itens no carrinho</p><p className="mt-1 text-3xl font-bold text-foreground">{buyCart?.items.length ?? 0}</p><p className="mt-2 text-sm text-muted-foreground">Quantidade total: <span className="font-semibold text-foreground">{buyCartQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span></p></div>
                <div className="mt-auto space-y-2">
                  <button type="button" onClick={handleClearBuyCart} disabled={isSavingBuyCart || !buyCart?.items.length} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"><Trash2 className="h-4 w-4" />Limpar carrinho</button>
                  <button type="button" onClick={handleConfirmBuyCart} disabled={isSavingBuyCart || !buyCart?.items.length} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isSavingBuyCart ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}Criar solicitação</button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {showStockModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Estoque rápido
                </h2>
                <p className="text-sm text-muted-foreground">
                  Registre entradas, saídas, descartes ou ajustes rápidos.
                </p>
              </div>

              <button
                type="button"
                onClick={closeStockModal}
                disabled={isSavingMovement}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMovementType('in')}
                  className={`rounded-2xl border p-4 text-left transition ${movementType === 'in'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                    : 'border-border bg-background text-foreground hover:bg-secondary'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <PackagePlus className="h-5 w-5" />
                    <span className="font-semibold">Entrada</span>
                  </div>

                  <p className="mt-1 text-xs opacity-75">
                    Compra, reposição ou item entrando.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType('out')}
                  className={`rounded-2xl border p-4 text-left transition ${movementType === 'out'
                    ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'
                    : 'border-border bg-background text-foreground hover:bg-secondary'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <PackageMinus className="h-5 w-5" />
                    <span className="font-semibold">Saída</span>
                  </div>

                  <p className="mt-1 text-xs opacity-75">
                    Descarte, perda, quebra ou retirada.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType('adjustment')}
                  className={`rounded-2xl border p-4 text-left transition ${movementType === 'adjustment'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-foreground hover:bg-secondary'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5" />
                    <span className="font-semibold">Ajuste</span>
                  </div>

                  <p className="mt-1 text-xs opacity-75">
                    Define o estoque para o valor informado.
                  </p>
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Item de estoque
                </label>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar item..."
                    className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  disabled={isLoadingProducts || stockProducts.length === 0}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  {isLoadingProducts ? (
                    <option value="">Carregando...</option>
                  ) : stockProducts.length === 0 ? (
                    <option value="">Nenhum item encontrado</option>
                  ) : (
                    stockProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} —{' '}
                        {formatQuantity(product.stockQuantity, product.stockUnit)}
                      </option>
                    ))
                  )}
                </select>

                {selectedProduct && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estoque atual:{' '}
                    <span className="font-medium text-foreground">
                      {formatQuantity(
                        selectedProduct.stockQuantity,
                        selectedProduct.stockUnit
                      )}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-[180px_1fr] gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {movementType === 'adjustment'
                      ? 'Novo estoque'
                      : 'Quantidade'}
                  </label>

                  <input
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    inputMode="decimal"
                    placeholder={movementType === 'adjustment' ? 'Ex: 10' : 'Ex: 2'}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Observação
                  </label>

                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={
                      movementType === 'in'
                        ? 'Ex: Compra fornecedor, reposição...'
                        : movementType === 'out'
                          ? 'Ex: Descarte, quebra, perda...'
                          : 'Ex: Conferência manual, correção...'
                    }
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-4">
              <button
                type="button"
                onClick={closeStockModal}
                disabled={isSavingMovement}
                className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveStockMovement}
                disabled={
                  isSavingMovement ||
                  isLoadingProducts ||
                  !selectedProductId ||
                  !quantity
                }
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50 ${movementType === 'in'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : movementType === 'out'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
              >
                {isSavingMovement && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar {getMovementLabel(movementType).toLowerCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}