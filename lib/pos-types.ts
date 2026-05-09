export type Product = {
  id: string
  categoryId: string
  name: string
  description?: string | null
  emoji: string
  price: number
  active?: boolean

  isStockOnly?: boolean
  trackStock?: boolean
  stockQuantity?: number
  minStock?: number



  costMode?: ProductCostMode
  simpleCost?: number | null
  stockUnit?: StockUnit | null
  referenceQuantity?: number | null
  referenceCost?: number | null
  unitContentQuantity?: number | null
  unitContentUnit?: StockUnit | null

  madeOnDemand?: boolean
  unlimitedStock?: boolean
  recipeOutputQuantity?: number | null
  recipeOutputUnit?: StockUnit | null

  recipeItems?: ProductRecipeItem[]
  variationGroups?: ProductVariationGroup[]
  environmentPrices?: ProductEnvironmentPrice[]
  category?: CategoryConfig
}

export interface OrderItemVariationSelection {
  groupId: string
  selectedOptionIds: string[]
}

export interface OrderItem {
  product: Product
  quantity: number
  variationSelections?: OrderItemVariationSelection[]
  notes?: string | null
}

export type PaymentMethod = 'money' | 'pix' | 'credit' | 'debit'

export type InternalCustomer = {
  id: string
  name: string
  phone?: string | null
  active?: boolean
  salesEnvironmentId?: string | null
  salesEnvironment?: {
    id: string
    name: string
    color?: string | null
    isDefault?: boolean
  } | null
}

export type ProductVariationOption = {
  id: string
  groupId?: string
  name: string
  priceModifier: number
  sortOrder?: number
  active?: boolean

  costMode?: 'simple' | 'recipe'
  simpleCost?: number | null
  stockUnit?: StockUnit | null
  referenceQuantity?: number | null
  referenceCost?: number | null

  environmentPrices?: ProductVariationOptionEnvironmentPrice[]
  recipeItems?: ProductVariationOptionRecipeItem[]
}

export type Order = {
  id: string
  comanda: number
  comandaName?: string | null
  observation?: string | null
  notes?: string | null
  internalCustomerId?: string | null
  items: OrderItem[]
  total: number
  paymentMethod?: PaymentMethod | null
  taxApplied: boolean
  status: 'pending' | 'paid' | 'cancelled'
  createdAt: Date
  paidAt?: Date
  customerId?: string | null
  customer?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  } | null
}

export interface CategoryConfig {
  id: string
  name: string
  emoji: string
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = []
export const DEFAULT_PRODUCTS: Product[] = []

export function formatBRL(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function getProductBasePriceForEnvironment(
  product: Product,
  salesEnvironmentId?: string | null
): number {
  if (!salesEnvironmentId) {
    return Number(product.price ?? 0)
  }

  const environmentPrice = product.environmentPrices?.find(
    (item) => item.salesEnvironmentId === salesEnvironmentId
  )

  return Number(environmentPrice?.price ?? product.price ?? 0)
}

export function getVariationOptionPriceModifierForEnvironment(
  option: ProductVariationOption,
  salesEnvironmentId?: string | null
): number {
  if (!salesEnvironmentId) {
    return Number(option.priceModifier ?? 0)
  }

  const environmentPrice = option.environmentPrices?.find(
    (item) => item.salesEnvironmentId === salesEnvironmentId
  )

  return Number(environmentPrice?.priceModifier ?? option.priceModifier ?? 0)
}

export function getItemPrice(
  item: OrderItem,
  salesEnvironmentId?: string | null
): number {
  const basePrice = getProductBasePriceForEnvironment(
    item.product,
    salesEnvironmentId
  )

  const groups = item.product.variationGroups ?? []
  const selections = item.variationSelections ?? []

  let totalModifier = 0

  for (const selection of selections) {
    const group = groups.find((g) => g.id === selection.groupId)
    if (!group) continue

    for (const optionId of selection.selectedOptionIds) {
      const option = group.options.find((o) => o.id === optionId)
      if (!option) continue

      totalModifier += getVariationOptionPriceModifierForEnvironment(
        option,
        salesEnvironmentId
      )
    }
  }

  return basePrice + totalModifier
}

export function validateOrderItem(item: OrderItem): string[] {
  const errors: string[] = []
  const groups = item.product.variationGroups ?? []
  const selections = item.variationSelections ?? []

  for (const group of groups) {
    const selection = selections.find((s) => s.groupId === group.id)
    const selectedCount = selection?.selectedOptionIds.length ?? 0

    if (group.required && selectedCount === 0) {
      errors.push(`Seleção obrigatória não preenchida: ${group.name}`)
      continue
    }

    if (group.selectionType === 'single' && selectedCount > 1) {
      errors.push(`A categoria ${group.name} permite apenas uma opção`)
    }

    if (selection) {
      for (const optionId of selection.selectedOptionIds) {
        const exists = group.options.some((o) => o.id === optionId)
        if (!exists) {
          errors.push(`Opção inválida em ${group.name}: ${optionId}`)
        }
      }
    }
  }

  return errors
}

export function generateSampleOrders(): Order[] {
  return []
}

export type StockUnit = 'unit' | 'ml' | 'l' | 'g' | 'kg'
export type ProductCostMode = 'simple' | 'recipe'

export interface ProductVariationOptionEnvironmentPrice {
  id: string
  salesEnvironmentId: string
  priceModifier: number
  salesEnvironment?: {
    id: string
    name: string
    color: string
    isDefault?: boolean
  }
}

export interface ProductVariationOptionRecipeItem {
  id: string
  ingredientProductId: string
  quantity: number
  unit: StockUnit
  computedCost?: number
  ingredientProduct?: {
    id: string
    name: string
    emoji?: string | null
    price: number
    simpleCost?: number | null
    stockUnit?: StockUnit | null
    referenceQuantity?: number | null
    referenceCost?: number | null
    trackStock?: boolean
    isStockOnly?: boolean
  } | null
}

export interface ProductVariationGroup {
  id: string
  name: string
  required: boolean
  selectionType: 'single' | 'multiple'
  sortOrder?: number
  options: ProductVariationOption[]
}

export interface ProductEnvironmentPrice {
  id: string
  salesEnvironmentId: string
  price: number
  salesEnvironment?: {
    id: string
    name: string
    color: string
    isDefault?: boolean
  }
}

export interface ProductRecipeItem {
  id: string
  ingredientProductId: string
  quantity: number
  unit: StockUnit
  computedCost?: number
  ingredientProduct?: {
    id: string
    name: string
    emoji?: string | null
    price: number
    simpleCost?: number | null
    stockUnit?: StockUnit | null
    referenceQuantity?: number | null
    referenceCost?: number | null
    trackStock?: boolean
    isStockOnly?: boolean
  } | null
}

export type OrderCustomerFieldsPatch = {
  customerId?: string | null
  customer?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  } | null
  eventDateId?: string | null
}
