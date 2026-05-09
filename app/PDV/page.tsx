'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CategoryTabs } from '@/components/pos/category-tabs'
import { ProductGrid } from '@/components/pos/product-grid'
import { OrderPanel } from '@/components/pos/order-panel'
import { OrdersList } from '@/components/pos/orders-list'
import { TicketPreview } from '@/components/pos/ticket-preview'
import { listenStockUpdated } from '@/lib/events/stock-events'
import { ListOrdered, Loader2, Search, ShoppingCart, X } from 'lucide-react'
import { lookupCustomerByEventComanda } from '@/lib/api/customers'
import {
  getActiveEventDate,
  getActiveEventDateId,
  listenActiveEventChanged,
} from '@/lib/events/active-events'
import type {
  Order,
  OrderItem,
  Product,
  OrderItemVariationSelection,
  CategoryConfig,
  PaymentMethod,
} from '@/lib/pos-types'
import { getItemPrice } from '@/lib/pos-types'

import { createOrder, getCategories, getProducts } from '@/lib/api'
import { getStockProducts } from '@/lib/api/stock'
import { getOrders } from '@/lib/api/orders'

function generateOrderId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
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

function isToday(date: Date) {
  const now = new Date()

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
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

export default function POSPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [categories, setCategories] = useState<CategoryConfig[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [productSearch, setProductSearch] = useState('')
  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([])
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)

  const [currentComandaNumber, setCurrentComandaNumber] = useState<number | null>(null)
  const [currentComandaName, setCurrentComandaName] = useState('')
  const [applyTax, setApplyTax] = useState(true)

  const [orders, setOrders] = useState<Order[]>([])
  const [showOrdersList, setShowOrdersList] = useState(false)
  const [showMobileOrderPanel, setShowMobileOrderPanel] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null)
  const [isLookingUpComanda, setIsLookingUpComanda] = useState(false)

  const [currentOrderObservation, setCurrentOrderObservation] = useState('')

  const REQUIRE_COMANDA_STORAGE_KEY = 'ordr-settings-require-comanda'
  const [requireComanda, setRequireComanda] = useState(true)
  const taxRate = 0.1
  const [activeEventDate, setActiveEventDate] = useState(() =>
    getActiveEventDate()
  )

  const activeSalesEnvironmentId = activeEventDate?.salesEnvironmentId ?? null

  useEffect(() => {
    setActiveEventDate(getActiveEventDate())

    return listenActiveEventChanged((eventDate) => {
      setActiveEventDate(eventDate ?? getActiveEventDate())
    })
  }, [])

  useEffect(() => {
    async function lookupComandaCustomer() {
      const eventDateId = activeEventDate?.id ?? getActiveEventDateId()
      const comandaNumber = currentComandaNumber

      if (!eventDateId || comandaNumber == null) {
        setLinkedCustomerId(null)
        return
      }

      try {
        setIsLookingUpComanda(true)

        const result = await lookupCustomerByEventComanda({
          eventDateId,
          comandaNumber,
        })

        if (result?.customer) {
          setLinkedCustomerId(result.customer.id)
          setCurrentComandaName(
            result.comandaName?.trim() || result.customer.name
          )
        } else {
          setLinkedCustomerId(null)
        }
      } catch (error) {
        console.error('Erro ao buscar cliente da comanda:', error)
        setLinkedCustomerId(null)
      } finally {
        setIsLookingUpComanda(false)
      }
    }

    lookupComandaCustomer()
  }, [activeEventDate?.id, currentComandaNumber])

  useEffect(() => {
    const savedRequireComanda = localStorage.getItem(REQUIRE_COMANDA_STORAGE_KEY)
    if (savedRequireComanda !== null) {
      setRequireComanda(savedRequireComanda === 'true')
    }
  }, [])

  useEffect(() => {
    setCurrentOrderId(generateOrderId())
  }, [])

  useEffect(() => {
    async function loadPage() {
      try {
        const [posProductsData, stockProductsData, categoriesData, ordersData] =
          await Promise.all([
            getProducts(),
            getStockProducts(),
            getCategories(),
            getOrders(true),
          ])

        const productsData = mergeProductsWithStockInfo(
          posProductsData,
          stockProductsData
        )

        setProducts(productsData)

        const categoriesWithProducts = getCategoriesWithSellableProducts(
          categoriesData,
          productsData
        )
        setCategories(categoriesWithProducts)
        setSelectedCategory(categoriesWithProducts[0]?.id ?? '')

        const normalizedOrders: Order[] = ordersData
          .map((order) => ({
            ...order,
            total: Number(order.total ?? 0),
            paymentMethod: order.paymentMethod ?? 'money',
            taxApplied: order.taxApplied ?? true,
            createdAt: new Date(order.createdAt as any),
            paidAt: order.paidAt ? new Date(order.paidAt as any) : undefined,
          }))
          .filter((order) => isToday(new Date(order.createdAt)))

        setOrders(normalizedOrders)
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    loadPage()
  }, [router])

  useEffect(() => {
    return listenStockUpdated(async () => {
      try {
        const [posProductsData, stockProductsData, categoriesData] =
          await Promise.all([
            getProducts(),
            getStockProducts(),
            getCategories(),
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

        setCurrentOrderItems((currentItems) =>
          currentItems.map((item) => {
            const updatedProduct = productsData.find(
              (product) => product.id === item.product.id
            )

            return updatedProduct ? { ...item, product: updatedProduct } : item
          })
        )
      } catch (error) {
        console.error('Erro ao atualizar produtos após estoque rápido:', error)
      }
    })
  }, [])

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategory('')
      return
    }

    const categoryStillExists = categories.some(
      (cat) => cat.id === selectedCategory
    )

    if (!categoryStillExists) {
      setSelectedCategory(categories[0].id)
    }
  }, [categories, selectedCategory])

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

      if (term !== '') {
        return true
      }

      return !selectedCategory || product.categoryId === selectedCategory
    })
  }, [products, selectedCategory, productSearch])


  const handleSetItemNotes = useCallback(
    (itemKey: string, notes: string) => {
      if (isSubmittingOrder) return

      setCurrentOrderItems((prev) =>
        prev.map((item) =>
          getItemKey(item) === itemKey
            ? {
              ...item,
              notes,
            }
            : item
        )
      )
    },
    [isSubmittingOrder]
  )

  const handleAddProduct = useCallback(
    (product: Product, variationSelections?: OrderItemVariationSelection[]) => {
      if (isSubmittingOrder) return

      setCurrentOrderItems((prev) => {
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

      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setShowMobileOrderPanel(true)
      }
    },
    [isSubmittingOrder]
  )

  const handleUpdateQuantity = useCallback(
    (itemKey: string, delta: number) => {
      if (isSubmittingOrder) return

      setCurrentOrderItems((prev) =>
        prev
          .map((item) =>
            getItemKey(item) === itemKey
              ? { ...item, quantity: Math.max(0, item.quantity + delta) }
              : item
          )
          .filter((item) => item.quantity > 0)
      )
    },
    [isSubmittingOrder]
  )

  const handleRemoveItem = useCallback(
    (itemKey: string) => {
      if (isSubmittingOrder) return

      setCurrentOrderItems((prev) =>
        prev.filter((item) => getItemKey(item) !== itemKey)
      )
    },
    [isSubmittingOrder]
  )

  const handleClearOrder = useCallback(() => {
    if (isSubmittingOrder) return

    setCurrentOrderObservation('')
    setCurrentOrderItems([])
    setCurrentOrderId(generateOrderId())
    setCurrentComandaNumber(null)
    setCurrentComandaName('')
    setLinkedCustomerId(null)
    setApplyTax(true)
  }, [isSubmittingOrder])

  const handleCharge = useCallback(async (paymentMethod: PaymentMethod) => {
    try {
      if (isSubmittingOrder) return

      if (requireComanda && currentComandaNumber == null) {
        console.error('Comanda não definida')
        return
      }

      if (!currentOrderId) {
        console.error('Order ID não definido')
        return
      }

      if (currentOrderItems.length === 0) {
        console.error('Pedido vazio')
        return
      }

      setIsSubmittingOrder(true)

      const subtotal = currentOrderItems.reduce(
        (sum, item) => sum + Number(getItemPrice(item, activeSalesEnvironmentId) ?? 0) * item.quantity,
        0
      )

      const tax = applyTax ? subtotal * taxRate : 0
      const total = subtotal + tax

      const newOrder: Order & { eventDateId?: string | null; customerId?: string | null } = {
        id: currentOrderId,
        eventDateId: activeEventDate?.id ?? getActiveEventDateId(),
        customerId: linkedCustomerId,
        comanda: currentComandaNumber ?? 0,
        comandaName: currentComandaName.trim() || null,
        observation: currentOrderObservation.trim() || null,
        items: [...currentOrderItems],
        total,
        paymentMethod,
        taxApplied: applyTax,
        status: 'paid',
        createdAt: new Date(),
        paidAt: new Date(),
      }

      const savedOrder = await createOrder(newOrder, activeSalesEnvironmentId)

      const [refreshedPosProducts, refreshedStockProducts] = await Promise.all([
        getProducts(),
        getStockProducts(),
      ])

      const refreshedProducts = mergeProductsWithStockInfo(
        refreshedPosProducts,
        refreshedStockProducts
      )

      setProducts(refreshedProducts)

      const categoriesWithProducts = getCategoriesWithSellableProducts(
        categories,
        refreshedProducts
      )

      setCategories(categoriesWithProducts)

      if (
        selectedCategory &&
        !categoriesWithProducts.some((category) => category.id === selectedCategory)
      ) {
        setSelectedCategory(categoriesWithProducts[0]?.id ?? '')
      }

      const normalizedOrder: Order = {
        ...newOrder,
        id: savedOrder.id ?? newOrder.id,
        comanda: savedOrder.comanda ?? newOrder.comanda,
        comandaName: newOrder.comandaName,
        observation: newOrder.observation,
        total: Number(savedOrder.total ?? newOrder.total ?? 0),
        paymentMethod: savedOrder.paymentMethod ?? newOrder.paymentMethod,
        taxApplied: savedOrder.taxApplied ?? newOrder.taxApplied,
        status: savedOrder.status ?? newOrder.status,
        items: newOrder.items,
        createdAt: savedOrder.createdAt
          ? new Date(savedOrder.createdAt)
          : newOrder.createdAt,
        paidAt: savedOrder.paidAt
          ? new Date(savedOrder.paidAt)
          : newOrder.paidAt,
      }

      setOrders((prev) => [normalizedOrder, ...prev])
      setSelectedOrder(normalizedOrder)
      setCurrentOrderItems([])
      setCurrentOrderId(generateOrderId())
      setCurrentComandaNumber(null)
      setCurrentComandaName('')
      setLinkedCustomerId(null)
      setCurrentOrderObservation('')
      setApplyTax(true)
    } catch (err) {
      console.error('Erro ao enviar pedido:', err)
    } finally {
      setIsSubmittingOrder(false)
    }
  }, [
    activeEventDate,
    activeSalesEnvironmentId,
    applyTax,
    categories,
    currentComandaName,
    currentComandaNumber,
    currentOrderId,
    currentOrderItems,
    isSubmittingOrder,
    requireComanda,
    currentOrderObservation,
    linkedCustomerId,
    selectedCategory,
  ])

  const handleSelectOrder = useCallback((order: Order) => {
    if (isSubmittingOrder) return

    setSelectedOrder(order)

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setShowOrdersList(false)
    }
  }, [isSubmittingOrder])

  const handlePrint = useCallback(() => {
    if (isSubmittingOrder) return
    setSelectedOrder(null)
  }, [isSubmittingOrder])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {isSubmittingOrder && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded-xl bg-card px-5 py-4 shadow-lg border border-border">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium text-foreground">
              Salvando pedido e imprimindo...
            </span>
          </div>
        </div>
      )}

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {showOrdersList && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm lg:hidden"
              onClick={() => !isSubmittingOrder && setShowOrdersList(false)}
              aria-label="Fechar pedidos recentes"
            />

            <aside className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+5rem)] bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[90] flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl lg:relative lg:inset-auto lg:left-auto lg:right-auto lg:top-auto lg:bottom-auto lg:z-auto lg:w-[320px] lg:max-w-none lg:rounded-none lg:border-y-0 lg:border-l-0 lg:shadow-none">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">
                    Pedidos de Hoje
                  </h2>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    {orders.length} pedido{orders.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => !isSubmittingOrder && setShowOrdersList(false)}
                  disabled={isSubmittingOrder}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Fechar pedidos recentes"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative min-h-0 flex-1">
                <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-4 bg-gradient-to-b from-card to-transparent" />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-4 bg-gradient-to-t from-card to-transparent" />

                <div className="h-full min-h-0 overflow-y-scroll overscroll-contain p-3 pr-2 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] sm:p-4 sm:pr-3">
                  <OrdersList orders={orders} onSelectOrder={handleSelectOrder} />
                </div>
              </div>
            </aside>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex min-w-0 items-center border-b border-border bg-card/50">
            <button
              onClick={() => !isSubmittingOrder && setShowOrdersList(!showOrdersList)}
              disabled={isSubmittingOrder}
              className={`flex items-center gap-2 px-5 py-4 border-r border-border transition-colors shrink-0 ${showOrdersList
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ListOrdered className="h-5 w-5" />
              <span className="hidden text-sm font-medium sm:inline">Pedidos</span>
              {orders.length > 0 && (
                <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {orders.length}
                </span>
              )}
            </button>

            <div className="flex-1 min-w-0">
              {categories.length > 0 ? (
                <CategoryTabs
                  categories={categories}
                  selected={selectedCategory}
                  onSelect={isSubmittingOrder ? () => { } : setSelectedCategory}
                />
              ) : (
                <div className="px-5 py-4 text-sm text-muted-foreground">
                  Nenhuma categoria cadastrada
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-border bg-card px-3 py-3 sm:px-5 sm:py-4">
            <div className="relative max-w-md sm:max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar produto em todas as categorias..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <ProductGrid
            category={productSearch.trim() ? '' : selectedCategory}
            products={filteredProducts}
            allProducts={products}
            categories={categories}
            onAddProduct={handleAddProduct}
            salesEnvironmentId={activeSalesEnvironmentId}
          />
        </div>

        <div className="hidden lg:flex">
          <OrderPanel
            items={currentOrderItems}
            orderId={currentOrderId}
            comandaNumber={currentComandaNumber}
            comandaName={currentComandaName}
            orderObservation={currentOrderObservation}
            applyTax={applyTax}
            requireComanda={requireComanda}
            taxRate={taxRate}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearOrder={handleClearOrder}
            onCharge={handleCharge}
            onSetComandaNumber={setCurrentComandaNumber}
            onSetComandaName={setCurrentComandaName}
            onSetOrderObservation={setCurrentOrderObservation}
            onSetItemNotes={handleSetItemNotes}
            onSetApplyTax={setApplyTax}
            isLoading={isSubmittingOrder}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowMobileOrderPanel(true)}
        className="fixed inset-x-4 bottom-24 z-30 flex items-center justify-between rounded-2xl border border-border bg-primary px-4 py-3 text-primary-foreground shadow-2xl lg:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <ShoppingCart className="h-5 w-5" />
          Pedido
          {currentOrderItems.length > 0 && (
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
              {currentOrderItems.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </span>
        <span className="text-sm font-black">
          {currentOrderItems
            .reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0)
            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </button>

      {showMobileOrderPanel && (
        <div className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm lg:hidden">
          <div className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">Pedido atual</p>
                <p className="text-xs text-muted-foreground">
                  {currentOrderItems.length} item{currentOrderItems.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileOrderPanel(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground"
                aria-label="Fechar pedido"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <OrderPanel
                items={currentOrderItems}
                orderId={currentOrderId}
                comandaNumber={currentComandaNumber}
                comandaName={currentComandaName}
                orderObservation={currentOrderObservation}
                applyTax={applyTax}
                requireComanda={requireComanda}
                taxRate={taxRate}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onClearOrder={handleClearOrder}
                onCharge={handleCharge}
                onSetComandaNumber={setCurrentComandaNumber}
                onSetComandaName={setCurrentComandaName}
                onSetOrderObservation={setCurrentOrderObservation}
                onSetItemNotes={handleSetItemNotes}
                onSetApplyTax={setApplyTax}
                isLoading={isSubmittingOrder}
              />
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <TicketPreview
          order={selectedOrder}
          onClose={() => !isSubmittingOrder && setSelectedOrder(null)}
          onPrint={handlePrint}
        />
      )}
    </div>
  )
}