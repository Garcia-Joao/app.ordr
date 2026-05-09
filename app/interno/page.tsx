'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  UserRound,
  Phone,
  Loader2,
  Banknote,
  QrCode,
  CreditCard,
  Trash2,
  CheckSquare,
  Square,
  Clock3,
  Check,
  X,
  ShoppingBasket,
  Wallet,
  ListChecks,
  Minus,
  ChevronLeft,
  ChevronRight,
  Bell,
  MapPinned,
  Info,
} from 'lucide-react'
import { getCategories } from '@/lib/api/categories'
import { getProducts } from '@/lib/api/products'
import { getStockProducts } from '@/lib/api/stock'
import { createOrder } from '@/lib/api/orders'
import { listenStockUpdated } from '@/lib/events/stock-events'
import { ProductGrid } from '@/components/pos/product-grid'
import type {
  CategoryConfig,
  InternalCustomer,
  Order,
  OrderItem,
  OrderItemVariationSelection,
  PaymentMethod,
  Product,
} from '@/lib/pos-types'
import { formatBRL, getItemPrice } from '@/lib/pos-types'

import {
  getInternalCustomers,
  getInternalCustomerTodayOrders,
  getInternalCustomerPendingOrders,
  paySelectedInternalCustomerOrders,
} from '@/lib/api/internal-customers'
import {
  getSalesEnvironments,
  type SalesEnvironment,
} from '@/lib/api/sales-environments'

import { getActiveEventDateId } from '@/lib/events/active-events'

function generateOrderId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function getSavedItemUnitPrice(item: any, salesEnvironmentId?: string | null): number {
  if (item?.unitPrice != null) {
    return Number(item.unitPrice)
  }

  return Number(getItemPrice(item, salesEnvironmentId ?? null) ?? 0)
}

function getSavedItemTotalPrice(item: any, salesEnvironmentId?: string | null): number {
  if (item?.totalPrice != null) {
    return Number(item.totalPrice)
  }

  if (item?.unitPrice != null && item?.quantity != null) {
    return Number(item.unitPrice) * Number(item.quantity)
  }

  return (
    Number(getItemPrice(item, salesEnvironmentId ?? null) ?? 0) *
    Number(item.quantity ?? 0)
  )
}

function getItemKey(item: OrderItem): string {
  const selections = (item.variationSelections ?? [])
    .map((selection) => ({
      groupId: selection.groupId,
      selectedOptionIds: [...selection.selectedOptionIds].sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId))

  const selectionKey = JSON.stringify(selections)
  return `${item.product.id}-${selectionKey}`
}

function getCategoriesWithSellableProducts(
  categories: CategoryConfig[],
  products: Product[]
) {
  const sellableProducts = products.filter((product) => !product.isStockOnly)

  return categories.filter((category) =>
    sellableProducts.some((product) => product.categoryId === category.id)
  )
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    icon: Clock3,
    badge: 'text-warning bg-warning/20 border border-warning/30',
    dot: 'bg-warning',
    border: 'border-warning/30',
    card: 'bg-warning/5',
  },
  paid: {
    label: 'Pago',
    icon: Check,
    badge: 'text-success bg-success/20 border border-success/30',
    dot: 'bg-success',
    border: 'border-success/30',
    card: 'bg-success/5',
  },
  cancelled: {
    label: 'Cancelado',
    icon: X,
    badge: 'text-destructive bg-destructive/20 border border-destructive/30',
    dot: 'bg-destructive',
    border: 'border-destructive/30',
    card: 'bg-destructive/5',
  },
} as const

type RightTab = 'orders' | 'cart'
type CustomerFilter = 'all' | 'pending' | 'clear'

type CustomerPendingSummary = {
  count: number
  total: number
}

function mergeProductsWithStockInfo(
  posProducts: any[],
  stockProducts: any[]
): Product[] {
  const stockById = new Map(stockProducts.map((product) => [product.id, product]))

  return posProducts.map((product) => {
    const stockProduct = stockById.get(product.id)

    return {
      ...product,
      ...stockProduct,

      // Keep the POS/product endpoint as the source of truth for category and variations.
      // The stock endpoint is only used to enrich the product with stock/cost fields.
      categoryId:
        product.categoryId ??
        stockProduct?.categoryId ??
        stockProduct?.category?.id ??
        '',

      variationGroups:
        product.variationGroups?.length > 0
          ? product.variationGroups.map((group: any) => {
              const stockGroup = stockProduct?.variationGroups?.find(
                (item: any) => item.id === group.id
              )

              return {
                ...group,
                options: (group.options ?? []).map((option: any) => {
                  const stockOption = stockGroup?.options?.find(
                    (item: any) => item.id === option.id
                  )

                  return {
                    ...option,
                    ...stockOption,
                    priceModifier: Number(
                      option.priceModifier ?? stockOption?.priceModifier ?? 0
                    ),
                    simpleCost:
                      stockOption?.simpleCost == null
                        ? option.simpleCost ?? null
                        : Number(stockOption.simpleCost),
                    referenceCost:
                      stockOption?.referenceCost == null
                        ? option.referenceCost ?? null
                        : Number(stockOption.referenceCost),
                    referenceQuantity:
                      stockOption?.referenceQuantity == null
                        ? option.referenceQuantity ?? null
                        : Number(stockOption.referenceQuantity),
                    recipeItems: (
                      stockOption?.recipeItems ?? option.recipeItems ?? []
                    ).map((item: any) => ({
                      ...item,
                      quantity: Number(item.quantity ?? 0),
                    })),
                  }
                }),
              }
            })
          : stockProduct?.variationGroups ?? [],

      recipeItems: (stockProduct?.recipeItems ?? product.recipeItems ?? []).map(
        (item: any) => ({
          ...item,
          quantity: Number(item.quantity ?? 0),
        })
      ),

      price: Number(product.price ?? stockProduct?.price ?? 0),

      stockQuantity:
        stockProduct?.stockQuantity == null
          ? product.stockQuantity ?? null
          : Number(stockProduct.stockQuantity),

      minStock:
        stockProduct?.minStock == null
          ? product.minStock ?? null
          : Number(stockProduct.minStock),

      stockUnit: stockProduct?.stockUnit ?? product.stockUnit ?? null,

      simpleCost:
        stockProduct?.simpleCost == null
          ? product.simpleCost ?? null
          : Number(stockProduct.simpleCost),

      referenceCost:
        stockProduct?.referenceCost == null
          ? product.referenceCost ?? null
          : Number(stockProduct.referenceCost),

      referenceQuantity:
        stockProduct?.referenceQuantity == null
          ? product.referenceQuantity ?? null
          : Number(stockProduct.referenceQuantity),

      unitContentQuantity:
        stockProduct?.unitContentQuantity == null
          ? product.unitContentQuantity ?? null
          : Number(stockProduct.unitContentQuantity),

      unitContentUnit:
        stockProduct?.unitContentUnit ?? product.unitContentUnit ?? null,

      recipeCost:
        stockProduct?.recipeCost == null
          ? product.recipeCost ?? null
          : Number(stockProduct.recipeCost),

      recipeOutputQuantity:
        stockProduct?.recipeOutputQuantity == null
          ? product.recipeOutputQuantity ?? null
          : Number(stockProduct.recipeOutputQuantity),

      recipeOutputUnit:
        stockProduct?.recipeOutputUnit ?? product.recipeOutputUnit ?? null,
    }
  }) as Product[]
}

export default function InternoPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [isPaying, setIsPaying] = useState(false)

  const [customers, setCustomers] = useState<InternalCustomer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<InternalCustomer | null>(null)

  const [categories, setCategories] = useState<CategoryConfig[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [todayOrders, setTodayOrders] = useState<Order[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])

  const [currentItems, setCurrentItems] = useState<OrderItem[]>([])
  const [rightTab, setRightTab] = useState<RightTab>('orders')


  const [salesEnvironments, setSalesEnvironments] = useState<SalesEnvironment[]>([])
  const [environmentFilter, setEnvironmentFilter] = useState('all')

  const [isCustomerSidebarCollapsed, setIsCustomerSidebarCollapsed] = useState(false)
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all')
  const [customerPendingMap, setCustomerPendingMap] = useState<Record<string, CustomerPendingSummary>>({})
  const [toast, setToast] = useState<{
    visible: boolean
    title: string
    description: string
  }>({
    visible: false,
    title: '',
    description: '',
  })

  const selectedSalesEnvironmentId = selectedCustomer?.salesEnvironmentId ?? null
  const selectedCustomerIsDisabled = selectedCustomer?.active === false

  function showToast(title: string, description: string) {
    setToast({
      visible: true,
      title,
      description,
    })
  }

  useEffect(() => {
    if (!toast.visible) return

    const timer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 3200)

    return () => window.clearTimeout(timer)
  }, [toast.visible])

  useEffect(() => {
    async function loadInitial() {
      try {
        const [
          customersData,
          posProductsData,
          stockProductsData,
          categoriesData,
          environmentsData,
        ] = await Promise.all([
          getInternalCustomers(),
          getProducts(),
          getStockProducts(),
          getCategories(),
          getSalesEnvironments(),
        ])

        const productsData = mergeProductsWithStockInfo(
          posProductsData,
          stockProductsData
        )

        const categoriesWithProducts = getCategoriesWithSellableProducts(
          categoriesData,
          productsData
        )

        setCustomers(customersData)
        setProducts(productsData)
        setCategories(categoriesWithProducts)
        setSalesEnvironments(environmentsData)
        setSelectedCategory(categoriesWithProducts[0]?.id ?? '')
      } catch (error) {
        console.error('Erro ao carregar PDV interno:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitial()
  }, [])

  useEffect(() => {
    return listenStockUpdated(async () => {
      try {
        const [
          customersData,
          posProductsData,
          stockProductsData,
          categoriesData,
          environmentsData,
        ] = await Promise.all([
          getInternalCustomers(),
          getProducts(),
          getStockProducts(),
          getCategories(),
          getSalesEnvironments(),
        ])

        const productsData = mergeProductsWithStockInfo(
          posProductsData,
          stockProductsData
        )
        const categoriesWithProducts = getCategoriesWithSellableProducts(
          categoriesData,
          productsData
        )

        setProducts(productsData)
        setCategories(categoriesWithProducts)

        setSelectedCategory((current) => {
          if (current && categoriesWithProducts.some((category) => category.id === current)) {
            return current
          }

          return categoriesWithProducts[0]?.id ?? ''
        })

        setCurrentItems((currentItems) =>
          currentItems.map((item) => {
            const updatedProduct = productsData.find(
              (product) => product.id === item.product.id
            )

            return updatedProduct ? { ...item, product: updatedProduct } : item
          })
        )
      } catch (error) {
        console.error('Erro ao atualizar produtos internos após estoque rápido:', error)
      }
    })
  }, [])

  useEffect(() => {
    async function loadPendingSummaries() {
      if (customers.length === 0) {
        setCustomerPendingMap({})
        return
      }

      try {
        const results = await Promise.all(
          customers.map(async (customer) => {
            try {
              const data = await getInternalCustomerPendingOrders(customer.id)
              return {
                id: customer.id,
                count: data.summary.pendingCount,
                total: Number(data.summary.pendingTotal ?? 0),
              }
            } catch {
              return {
                id: customer.id,
                count: 0,
                total: 0,
              }
            }
          })
        )

        const nextMap: Record<string, CustomerPendingSummary> = {}
        for (const result of results) {
          nextMap[result.id] = {
            count: result.count,
            total: result.total,
          }
        }

        setCustomerPendingMap(nextMap)
      } catch (error) {
        console.error('Erro ao carregar resumo de pendências:', error)
      }
    }

    loadPendingSummaries()
  }, [customers])

  useEffect(() => {
    async function loadCustomerData() {
      if (!selectedCustomerId) {
        setSelectedCustomer(null)
        setTodayOrders([])
        setPendingOrders([])
        setSelectedOrderIds([])
        return
      }

      try {
        const [todayResult, pendingResult] = await Promise.all([
          getInternalCustomerTodayOrders(selectedCustomerId),
          getInternalCustomerPendingOrders(selectedCustomerId),
        ])

        const normalizedTodayOrders: Order[] = todayResult.orders.map((order: any) => ({
          ...order,
          total: Number(order.total ?? 0),
          createdAt: new Date(order.createdAt as any),
          paidAt: order.paidAt ? new Date(order.paidAt as any) : undefined,
        }))

        const normalizedPendingOrders: Order[] = pendingResult.orders.map((order: any) => ({
          ...order,
          total: Number(order.total ?? 0),
          createdAt: new Date(order.createdAt as any),
          paidAt: order.paidAt ? new Date(order.paidAt as any) : undefined,
        }))

        setSelectedCustomer(todayResult.customer)
        setTodayOrders(normalizedTodayOrders)
        setPendingOrders(normalizedPendingOrders)
        setSelectedOrderIds(normalizedPendingOrders.map((order) => order.id))

        setCustomerPendingMap((prev) => ({
          ...prev,
          [selectedCustomerId]: {
            count: pendingResult.summary.pendingCount,
            total: Number(pendingResult.summary.pendingTotal ?? 0),
          },
        }))
      } catch (error) {
        console.error('Erro ao carregar cliente interno:', error)
      }
    }

    loadCustomerData()
  }, [selectedCustomerId])

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategory('')
      return
    }

    const exists = categories.some((category) => category.id === selectedCategory)
    if (!exists) {
      setSelectedCategory(categories[0].id)
    }
  }, [categories, selectedCategory])

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase()

    return customers.filter((customer) => {
      const pendingSummary = customerPendingMap[customer.id] ?? { count: 0, total: 0 }

      const matchesSearch =
        term === '' ||
        customer.name.toLowerCase().includes(term) ||
        (customer.phone ?? '').toLowerCase().includes(term) ||
        (customer.salesEnvironment?.name ?? '').toLowerCase().includes(term)

      if (!matchesSearch) return false

      if (customerFilter === 'pending' && pendingSummary.count <= 0) {
        return false
      }

      if (customerFilter === 'clear' && pendingSummary.count > 0) {
        return false
      }

      if (
        environmentFilter !== 'all' &&
        customer.salesEnvironmentId !== environmentFilter
      ) {
        return false
      }

      return true
    })
  }, [customers, customerSearch, customerFilter, customerPendingMap, environmentFilter])

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()

    return products.filter((product) => {
      if (product.isStockOnly) return false

      const matchesSearch =
        term === '' ||
        product.name.toLowerCase().includes(term) ||
        (product.description ?? '').toLowerCase().includes(term) ||
        (product.emoji ?? '').toLowerCase().includes(term)

      if (!matchesSearch) return false
      if (term !== '') return true

      return !selectedCategory || product.categoryId === selectedCategory
    })
  }, [products, selectedCategory, productSearch])


  const currentSubtotal = currentItems.reduce(
    (sum, item) => sum + Number(getItemPrice(item, selectedSalesEnvironmentId) ?? 0) * item.quantity,
    0
  )

  const currentTotal = currentSubtotal

  const pendingTotal = pendingOrders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0
  )

  const paidOrCancelledOrders = todayOrders.filter((order) => order.status !== 'pending')

  const selectedPendingOrders = pendingOrders.filter((order) =>
    selectedOrderIds.includes(order.id)
  )

  const selectedPendingTotal = selectedPendingOrders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0
  )

  const allPendingSelected =
    pendingOrders.length > 0 && selectedOrderIds.length === pendingOrders.length

  function handleAddProduct(
    product: Product,
    variationSelections?: OrderItemVariationSelection[]
  ) {
    if (!selectedCustomerId || isSavingOrder) return

    if (selectedCustomerIsDisabled) {
      showToast(
        'Pessoa desativada',
        'Não é possível adicionar novos itens para uma pessoa desativada.'
      )
      return
    }

    setCurrentItems((prev) => {
      const newItem: OrderItem = {
        product,
        quantity: 1,
        variationSelections,
      }

      const itemKey = getItemKey(newItem)
      const existingItem = prev.find((item) => getItemKey(item) === itemKey)

      if (existingItem) {
        return prev.map((item) =>
          getItemKey(item) === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...prev, newItem]
    })

    setRightTab('cart')
  }

  function handleClearDraft() {
    if (isSavingOrder || selectedCustomerIsDisabled) return
    setCurrentItems([])
  }

  function handleRemoveDraftItem(itemKey: string) {
    if (isSavingOrder || selectedCustomerIsDisabled) return
    setCurrentItems((prev) => prev.filter((item) => getItemKey(item) !== itemKey))
  }

  function handleUpdateDraftItemQuantity(itemKey: string, delta: number) {
    if (isSavingOrder || selectedCustomerIsDisabled) return

    setCurrentItems((prev) =>
      prev
        .map((item) =>
          getItemKey(item) === itemKey
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    )
  }

  function toggleSelectAllPending() {
    if (allPendingSelected) {
      setSelectedOrderIds([])
    } else {
      setSelectedOrderIds(pendingOrders.map((order) => order.id))
    }
  }

  async function reloadSelectedCustomer() {
    if (!selectedCustomerId) return

    const [todayResult, pendingResult, customersData] = await Promise.all([
      getInternalCustomerTodayOrders(selectedCustomerId),
      getInternalCustomerPendingOrders(selectedCustomerId),
      getInternalCustomers(),
    ])

    const normalizedTodayOrders: Order[] = todayResult.orders.map((order: any) => ({
      ...order,
      total: Number(order.total ?? 0),
      createdAt: new Date(order.createdAt as any),
      paidAt: order.paidAt ? new Date(order.paidAt as any) : undefined,
    }))

    const normalizedPendingOrders: Order[] = pendingResult.orders.map((order: any) => ({
      ...order,
      total: Number(order.total ?? 0),
      createdAt: new Date(order.createdAt as any),
      paidAt: order.paidAt ? new Date(order.paidAt as any) : undefined,
    }))

    setCustomers(customersData)
    setSelectedCustomer(todayResult.customer)
    setTodayOrders(normalizedTodayOrders)
    setPendingOrders(normalizedPendingOrders)
    setSelectedOrderIds(normalizedPendingOrders.map((order) => order.id))

    setCustomerPendingMap((prev) => ({
      ...prev,
      [selectedCustomerId]: {
        count: pendingResult.summary.pendingCount,
        total: Number(pendingResult.summary.pendingTotal ?? 0),
      },
    }))
  }

  async function handleSavePendingOrder() {
    if (!selectedCustomerId || currentItems.length === 0 || isSavingOrder) return

    if (selectedCustomerIsDisabled) {
      showToast(
        'Pessoa desativada',
        'Não é possível gerar novos pedidos para uma pessoa desativada.'
      )
      return
    }

    try {
      setIsSavingOrder(true)

      const order: Order & { eventDateId?: string | null } = {
        id: Math.random().toString(36).substring(2, 8).toUpperCase(),
        eventDateId: getActiveEventDateId(),
        internalCustomerId: selectedCustomerId,
        comanda: 0,
        comandaName: selectedCustomer?.name ?? null,
        items: currentItems,
        total: currentTotal,
        paymentMethod: null,
        taxApplied: false,
        status: 'pending',
        createdAt: new Date(),
        paidAt: undefined,
      }

      await createOrder(order, selectedSalesEnvironmentId)

      const [refreshedPosProducts, refreshedStockProducts] = await Promise.all([
        getProducts(),
        getStockProducts(),
      ])

      const refreshedProducts = mergeProductsWithStockInfo(
        refreshedPosProducts,
        refreshedStockProducts
      )

      const categoriesWithProducts = getCategoriesWithSellableProducts(
        categories,
        refreshedProducts
      )

      setProducts(refreshedProducts)
      setCategories(categoriesWithProducts)

      setSelectedCategory((current) => {
        if (current && categoriesWithProducts.some((category) => category.id === current)) {
          return current
        }

        return categoriesWithProducts[0]?.id ?? ''
      })

      setCurrentItems([])
      setRightTab('orders')
      await reloadSelectedCustomer()
      showToast('Pedido salvo', 'O pedido pendente foi salvo com sucesso.')
    } catch (error: any) {
      if (error?.message === 'INTERNAL_CUSTOMER_DISABLED') {
        alert('Esta pessoa está desativada e não pode receber novos pedidos.')
        return
      }

      if (
        error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND' ||
        error?.message === 'Internal customer not found'
      ) {
        alert('Cliente interno não encontrado.')
        setSelectedCustomerId(null)
        setSelectedCustomer(null)
        setTodayOrders([])
        setPendingOrders([])
        setSelectedOrderIds([])
        setCurrentItems([])
        return
      }

      console.error('Erro ao salvar pedido pendente:', error)
      alert(error?.message || 'Erro ao salvar pedido pendente')
    } finally {
      setIsSavingOrder(false)
    }
  }

  async function handlePaySelected(method: PaymentMethod) {
    if (!selectedCustomerId || selectedOrderIds.length === 0 || isPaying) return

    const paidCustomerId = selectedCustomerId

    try {
      setIsPaying(true)

      await paySelectedInternalCustomerOrders(paidCustomerId, {
        paymentMethod: method,
        taxApplied: false,
        orderIds: selectedOrderIds,
      })

      const customersData = await getInternalCustomers()

      setCustomers(customersData)

      const stillVisibleCustomer = customersData.find(
        (customer) => customer.id === paidCustomerId
      )

      if (!stillVisibleCustomer) {
        setSelectedCustomerId(null)
        setSelectedCustomer(null)
        setTodayOrders([])
        setPendingOrders([])
        setSelectedOrderIds([])
        setCurrentItems([])
        setRightTab('orders')

        setCustomerPendingMap((prev) => {
          const next = { ...prev }
          delete next[paidCustomerId]
          return next
        })

        showToast(
          'Pagamento confirmado',
          'Os pedidos foram pagos. Como essa pessoa está desativada, ela foi removida do PDV Interno.'
        )

        return
      }

      const [todayResult, pendingResult] = await Promise.all([
        getInternalCustomerTodayOrders(paidCustomerId),
        getInternalCustomerPendingOrders(paidCustomerId),
      ])

      const normalizedTodayOrders: Order[] = todayResult.orders.map((order: any) => ({
        ...order,
        total: Number(order.total ?? 0),
        createdAt: new Date(order.createdAt as any),
        paidAt: order.paidAt ? new Date(order.paidAt as any) : undefined,
      }))

      const normalizedPendingOrders: Order[] = pendingResult.orders.map((order: any) => ({
        ...order,
        total: Number(order.total ?? 0),
        createdAt: new Date(order.createdAt as any),
        paidAt: order.paidAt ? new Date(order.paidAt as any) : undefined,
      }))

      setSelectedCustomer(todayResult.customer)
      setTodayOrders(normalizedTodayOrders)
      setPendingOrders(normalizedPendingOrders)
      setSelectedOrderIds(normalizedPendingOrders.map((order) => order.id))

      setCustomerPendingMap((prev) => ({
        ...prev,
        [paidCustomerId]: {
          count: pendingResult.summary.pendingCount,
          total: Number(pendingResult.summary.pendingTotal ?? 0),
        },
      }))

      showToast('Pagamento confirmado', 'Os pedidos selecionados foram pagos.')
    } catch (error: any) {
      if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
        setSelectedCustomerId(null)
        setSelectedCustomer(null)
        setTodayOrders([])
        setPendingOrders([])
        setSelectedOrderIds([])
        setCurrentItems([])
        setRightTab('orders')

        setCustomers((prev) =>
          prev.filter((customer) => customer.id !== selectedCustomerId)
        )

        showToast(
          'Pagamento confirmado',
          'Os pedidos foram pagos. Como essa pessoa está desativada, ela foi removida do PDV Interno.'
        )

        return
      }

      console.error('Erro ao pagar pedidos selecionados:', error)
      alert(error?.message || 'Erro ao pagar pedidos selecionados')
    } finally {
      setIsPaying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-full flex-col overflow-visible bg-background lg:h-full lg:overflow-hidden mobile-page-scroll">
      {toast.visible && (
        <div className="fixed left-3 right-3 top-4 z-50 rounded-xl border border-border bg-card p-4 shadow-lg sm:left-auto sm:w-[340px]">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{toast.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">PDV Interno</h1>
          <p className="text-sm text-muted-foreground">
            Contas internas vinculadas à Gestão de Pessoas
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          Cadastros são feitos em Gestão de Pessoas
        </div>
      </div>

      <div
        className={`grid flex-1 grid-cols-1 gap-0 overflow-visible lg:min-h-0 lg:overflow-hidden ${isCustomerSidebarCollapsed
          ? 'lg:grid-cols-[72px_1fr_460px]'
          : 'lg:grid-cols-[320px_1fr_460px]'
          }`}
      >
        <aside className="flex min-h-0 flex-col border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            {!isCustomerSidebarCollapsed && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <button
              onClick={() => setIsCustomerSidebarCollapsed((prev) => !prev)}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary lg:flex"
            >
              {isCustomerSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {!isCustomerSidebarCollapsed && (
            <>
              <div className="px-4 py-3 border-b border-border space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Clientes internos
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCustomerFilter('all')}
                    className={`h-9 rounded-lg text-xs font-medium ${customerFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                  >
                    Todos
                  </button>

                  <button
                    onClick={() => setCustomerFilter('pending')}
                    className={`h-9 rounded-lg text-xs font-medium ${customerFilter === 'pending'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                  >
                    Pendentes
                  </button>

                  <button
                    onClick={() => setCustomerFilter('clear')}
                    className={`h-9 rounded-lg text-xs font-medium ${customerFilter === 'clear'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                  >
                    Sem pend.
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Ambiente de venda
                  </label>

                  <select
                    value={environmentFilter}
                    onChange={(e) => setEnvironmentFilter(e.target.value)}
                    className="h-10 px-3 rounded-lg bg-background border border-border text-sm text-foreground"
                  >
                    <option value="all">Todos os ambientes</option>
                    {salesEnvironments.map((environment) => (
                      <option key={environment.id} value={environment.id}>
                        {environment.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="max-h-[320px] space-y-3 overflow-y-auto p-4 lg:max-h-none lg:flex-1">
                {filteredCustomers.map((customer) => {
                  const isSelected = customer.id === selectedCustomerId
                  const pendingSummary = customerPendingMap[customer.id] ?? { count: 0, total: 0 }

                  return (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-background hover:bg-secondary/40'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <UserRound className="h-5 w-5 text-primary" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-foreground truncate">
                              {customer.name}
                            </p>

                            {pendingSummary.count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-warning bg-warning/15 border border-warning/30 shrink-0">
                                <Clock3 className="h-3 w-3" />
                                {pendingSummary.count}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span className="truncate">{customer.phone || 'Sem telefone'}</span>
                          </div>

                          {customer.salesEnvironment && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: customer.salesEnvironment.color ?? undefined }}
                              />
                              <span>{customer.salesEnvironment.name}</span>
                            </div>
                          )}

                          {pendingSummary.count > 0 && (
                            <p className="mt-2 text-xs text-warning">
                              Pendente: {formatBRL(pendingSummary.total)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {isCustomerSidebarCollapsed && (
            <div className="max-h-[320px] space-y-2 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
              {filteredCustomers.map((customer) => {
                const isSelected = customer.id === selectedCustomerId
                const pendingSummary = customerPendingMap[customer.id] ?? { count: 0, total: 0 }

                return (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    title={customer.name}
                    className={`relative w-full h-14 rounded-xl border flex items-center justify-center transition-all ${isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-background hover:bg-secondary/40'
                      }`}
                  >
                    <UserRound className="h-5 w-5 text-primary" />

                    {customer.salesEnvironment && (
                      <span
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: customer.salesEnvironment.color ?? undefined }}
                      />
                    )}

                    {pendingSummary.count > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-warning text-black text-[10px] font-bold flex items-center justify-center">
                        {pendingSummary.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <main className="flex min-h-0 flex-col overflow-visible lg:overflow-hidden">
          {!selectedCustomer ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione um cliente para abrir a conta do dia
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedCustomer.name}
                    </h2>

                    {selectedCustomerIsDisabled && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                        <X className="h-3 w-3" />
                        Desativado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedCustomer.phone || 'Sem telefone'}
                  </p>

                  {selectedCustomer.salesEnvironment && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: selectedCustomer.salesEnvironment.color ?? undefined,
                        }}
                      />
                      <MapPinned className="h-3 w-3" />
                      {selectedCustomer.salesEnvironment.name}
                    </div>
                  )}
                </div>

                <div className="w-fit rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  Dados editados em Gestão de Pessoas
                </div>
              </div>

              {selectedCustomerIsDisabled && (
                <div className="px-6 py-3 border-b border-destructive/30 bg-destructive/10">
                  <p className="text-sm font-medium text-destructive">
                    Esta pessoa está desativada. Você ainda pode pagar pedidos pendentes,
                    mas não pode criar novos pedidos.
                  </p>
                </div>
              )}

              <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    disabled={selectedCustomerIsDisabled}
                    placeholder="Buscar produto..."
                    className="w-full h-10 pl-10 pr-4 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="border-b border-border bg-card/60 px-4 py-3 sm:px-6">
                {categories.length > 0 && (
                  <div className="flex overflow-x-auto gap-2">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        disabled={selectedCustomerIsDisabled}
                        className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap disabled:opacity-50 ${selectedCategory === category.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground'
                          }`}
                      >
                        {category.emoji ? `${category.emoji} ` : ''}
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={`min-h-[420px] flex-1 overflow-visible lg:overflow-hidden ${selectedCustomerIsDisabled ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
                <ProductGrid
                  category={productSearch.trim() ? '' : selectedCategory}
                  products={filteredProducts}
                  allProducts={products}
                  categories={categories}
                  salesEnvironmentId={selectedSalesEnvironmentId}
                  onAddProduct={handleAddProduct}
                />
              </div>
            </>
          )}
        </main>

        <aside className="flex min-h-0 flex-col border-t border-border bg-card lg:border-l lg:border-t-0 lg:overflow-hidden">
          {!selectedCustomer ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground px-6">
              A conta do cliente aparece aqui
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Wallet className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Pendente
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {formatBRL(pendingTotal)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <ListChecks className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Selecionado
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatBRL(selectedPendingTotal)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setRightTab('orders')}
                    className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${rightTab === 'orders'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                  >
                    Pedidos
                  </button>

                  <button
                    onClick={() => setRightTab('cart')}
                    className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${rightTab === 'cart'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                  >
                    Carrinho
                    {currentItems.length > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-background/20 text-xs">
                        {currentItems.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {rightTab === 'cart' ? (
                <>
                  <div className="min-h-0 flex-1 overflow-visible p-4 lg:overflow-y-auto">
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ShoppingBasket className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">
                          Carrinho atual
                        </h3>
                      </div>

                      {selectedCustomerIsDisabled ? (
                        <p className="text-sm text-destructive">
                          Pessoa desativada. Não é possível criar novos pedidos.
                        </p>
                      ) : currentItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Adicione itens no centro para montar o pedido.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {currentItems.map((item, index) => {
                            const itemKey = getItemKey(item)
                            const unitPrice = Number(
                              getItemPrice(item, selectedSalesEnvironmentId) ?? 0
                            )
                            const totalPrice = unitPrice * item.quantity

                            return (
                              <div
                                key={`${itemKey}-${index}`}
                                className="rounded-lg border border-border bg-secondary/30 px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {item.product.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {formatBRL(unitPrice)} cada
                                    </p>
                                  </div>

                                  <button
                                    onClick={() => handleRemoveDraftItem(itemKey)}
                                    disabled={isSavingOrder || selectedCustomerIsDisabled}
                                    className="h-8 w-8 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center"
                                    title="Remover item"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleUpdateDraftItemQuantity(itemKey, -1)}
                                      disabled={isSavingOrder || selectedCustomerIsDisabled}
                                      className="h-8 w-8 rounded-md bg-background border border-border flex items-center justify-center hover:bg-secondary"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>

                                    <span className="w-8 text-center text-sm font-semibold text-foreground">
                                      {item.quantity}
                                    </span>

                                    <button
                                      onClick={() => handleUpdateDraftItemQuantity(itemKey, 1)}
                                      disabled={isSavingOrder || selectedCustomerIsDisabled}
                                      className="h-8 w-8 rounded-md bg-background border border-border flex items-center justify-center hover:bg-secondary"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <p className="text-sm font-semibold text-primary whitespace-nowrap">
                                    {formatBRL(totalPrice)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border p-4 bg-card space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold text-foreground">
                        {formatBRL(currentTotal)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleClearDraft}
                        disabled={isSavingOrder || currentItems.length === 0 || selectedCustomerIsDisabled}
                        className="h-10 rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-50"
                      >
                        Limpar
                      </button>

                      <button
                        onClick={handleSavePendingOrder}
                        disabled={isSavingOrder || currentItems.length === 0 || selectedCustomerIsDisabled}
                        className="h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {isSavingOrder ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Salvar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-h-0 flex-1 space-y-5 overflow-visible p-4 lg:overflow-y-auto">
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Pedidos pendentes
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Todos os pedidos em aberto desse cliente
                          </p>
                        </div>

                        {pendingOrders.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleSelectAllPending}
                            className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
                          >
                            {allPendingSelected ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                            {allPendingSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                          </button>
                        )}
                      </div>

                      {pendingOrders.length === 0 ? (
                        <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                          Nenhum pedido pendente.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pendingOrders.map((order) => {
                            const config = statusConfig[order.status]
                            const Icon = config.icon
                            const isChecked = selectedOrderIds.includes(order.id)

                            return (
                              <div
                                key={order.id}
                                className={`rounded-xl border p-4 ${config.border} ${config.card}`}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleOrderSelection(order.id)}
                                    className="mt-1 h-4 w-4 rounded border-border"
                                  />

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-medium text-foreground">
                                            #{order.id}
                                          </p>
                                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.badge}`}>
                                            <Icon className="h-3 w-3" />
                                            {config.label}
                                          </span>
                                        </div>

                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(order.createdAt).toLocaleDateString('pt-BR')} às{' '}
                                          {new Date(order.createdAt).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                          {order.paymentMethod ? ` • ${order.paymentMethod}` : ''}
                                        </p>
                                      </div>

                                      <p className="font-semibold text-primary whitespace-nowrap">
                                        {formatBRL(order.total)}
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      {order.items.map((item, itemIndex) => (
                                        <div
                                          key={`${order.id}-${item.product.id}-${itemIndex}`}
                                          className="rounded-lg bg-background border border-border px-3 py-2"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-foreground truncate">
                                                {item.quantity}x {item.product.name}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                {formatBRL(getSavedItemUnitPrice(item, selectedSalesEnvironmentId))} cada
                                              </p>
                                            </div>

                                            <p className="text-sm font-semibold text-primary whitespace-nowrap">
                                              {formatBRL(getSavedItemTotalPrice(item, selectedSalesEnvironmentId))}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>

                    <section>
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-foreground">
                          Histórico de hoje
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Pedidos já pagos ou cancelados
                        </p>
                      </div>

                      {paidOrCancelledOrders.length === 0 ? (
                        <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                          Nenhum pedido finalizado hoje.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {paidOrCancelledOrders.map((order) => {
                            const config = statusConfig[order.status]
                            const Icon = config.icon

                            return (
                              <div
                                key={order.id}
                                className={`rounded-xl border p-4 opacity-90 ${config.border} bg-background`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${config.dot}`} />

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-medium text-foreground">
                                            #{order.id}
                                          </p>
                                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.badge}`}>
                                            <Icon className="h-3 w-3" />
                                            {config.label}
                                          </span>
                                        </div>

                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(order.createdAt).toLocaleDateString('pt-BR')} às{' '}
                                          {new Date(order.createdAt).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                          {order.paymentMethod ? ` • ${order.paymentMethod}` : ''}
                                        </p>
                                      </div>

                                      <p className="font-semibold text-foreground whitespace-nowrap">
                                        {formatBRL(order.total)}
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      {order.items.map((item, itemIndex) => (
                                        <div
                                          key={`${order.id}-${item.product.id}-${itemIndex}`}
                                          className="rounded-lg bg-secondary/20 border border-border px-3 py-2"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-foreground truncate">
                                                {item.quantity}x {item.product.name}
                                              </p>
                                            </div>

                                            <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                                              {formatBRL(getSavedItemTotalPrice(item, selectedSalesEnvironmentId))}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  </div>

                  <div className="border-t border-border p-4 bg-card">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handlePaySelected('money')}
                        disabled={isPaying || selectedOrderIds.length === 0}
                        className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                        Dinheiro
                      </button>

                      <button
                        onClick={() => handlePaySelected('pix')}
                        disabled={isPaying || selectedOrderIds.length === 0}
                        className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        Pix
                      </button>

                      <button
                        onClick={() => handlePaySelected('credit')}
                        disabled={isPaying || selectedOrderIds.length === 0}
                        className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Crédito
                      </button>

                      <button
                        onClick={() => handlePaySelected('debit')}
                        disabled={isPaying || selectedOrderIds.length === 0}
                        className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Débito
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>

    </div>
  )
}
