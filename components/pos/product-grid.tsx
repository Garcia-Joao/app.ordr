'use client'

import type {
  Product,
  CategoryConfig,
  OrderItemVariationSelection,
} from '@/lib/pos-types'
import {
  formatBRL,
  getProductBasePriceForEnvironment,
  getItemPrice,
  getVariationOptionPriceModifierForEnvironment,
  validateOrderItem,
} from '@/lib/pos-types'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BoxIcon,
  ChefHat,
  PackageX,
  TrendingDown,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type ProductGridProps = {
  category: string
  products: Product[]
  allProducts?: Product[]
  categories: CategoryConfig[]
  onAddProduct: (
    product: Product,
    variationSelections?: OrderItemVariationSelection[]
  ) => void
  salesEnvironmentId?: string | null
}

type ProductRecipeItemLike = {
  id?: string
  ingredientProductId: string
  quantity: number
  unit?: string | null
}

type IngredientWarningBadge = {
  label: string
  title?: string
  className: string
  icon: typeof AlertTriangle | typeof PackageX
}

type ProductWithStockInfo = Product & {
  isStockOnly?: boolean
  trackStock?: boolean
  stockQuantity?: number | null
  minStock?: number | null
  stockUnit?: string | null
  unitContentQuantity?: number | null
  unitContentUnit?: string | null
  madeOnDemand?: boolean
  unlimitedStock?: boolean
  hasRecipe?: boolean

  costMode?: 'simple' | 'recipe' | string | null
  simpleCost?: number | null
  referenceQuantity?: number | null
  referenceCost?: number | null
  recipeCost?: number | null

  recipeOutputQuantity?: number | null
  recipeOutputUnit?: string | null
  recipeItems?: ProductRecipeItemLike[]

  possibleProductionQuantity?: number | null
  possibleProductionStatus?: 'ok' | 'low' | 'zero' | 'unknown' | null
  expectedYield?: number | null
}

type VariationCostLine = {
  ingredientName: string
  quantityLabel: string
  cost: number
}

type VariationCostDetails = {
  totalCost: number
  lines: VariationCostLine[]
}

type ProductionCheck = {
  batches: number | null
  hasZeroIngredient: boolean
  hasLowIngredient: boolean
  hasUnknownIngredient: boolean
}

function getUnitFamily(unit?: string | null) {
  if (unit === 'ml' || unit === 'l') return 'volume'
  if (unit === 'g' || unit === 'kg') return 'weight'
  return 'count'
}

function normalizeQuantity(quantity: number, unit?: string | null) {
  if (!Number.isFinite(quantity)) return quantity

  switch (unit) {
    case 'l':
      return quantity * 1000
    case 'ml':
      return quantity
    case 'kg':
      return quantity * 1000
    case 'g':
      return quantity
    case 'unit':
    default:
      return quantity
  }
}

function getDisplayUnit(unit?: string | null) {
  if (!unit || unit === 'unit') return 'un.'
  return unit
}

function formatQuantity(quantity: number, unit?: string | null) {
  if (!Number.isFinite(quantity)) return '-'

  const formatted = Number(quantity).toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  })

  return `${formatted} ${getDisplayUnit(unit)}`
}

function getUnitContentQuantity(product: ProductWithStockInfo | null | undefined) {
  const quantity = Number((product as any)?.unitContentQuantity ?? 0)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

function getUnitContentUnit(product: ProductWithStockInfo | null | undefined) {
  const unit = ((product as any)?.unitContentUnit ?? null) as string | null
  return unit && unit !== 'unit' ? unit : null
}

function hasUnitContent(product: ProductWithStockInfo | null | undefined) {
  return (
    (product?.stockUnit ?? 'unit') === 'unit' &&
    getUnitContentQuantity(product) != null &&
    getUnitContentUnit(product) != null
  )
}

function getEffectiveStockUnit(product: ProductWithStockInfo | null | undefined) {
  if (hasUnitContent(product)) {
    return getUnitContentUnit(product) ?? 'unit'
  }

  return product?.stockUnit ?? 'unit'
}

function getEffectiveStockQuantity(product: ProductWithStockInfo | null | undefined) {
  const stockQuantity = Number(product?.stockQuantity ?? 0)

  if (!Number.isFinite(stockQuantity)) return stockQuantity

  if (hasUnitContent(product)) {
    return stockQuantity * (getUnitContentQuantity(product) ?? 1)
  }

  return stockQuantity
}

function getAvailableBaseQuantity(
  product: ProductWithStockInfo,
  fallbackUnit?: string | null
) {
  if (product.unlimitedStock) return Number.POSITIVE_INFINITY

  const stockQuantity = Number(product.stockQuantity ?? 0)
  if (!Number.isFinite(stockQuantity)) return stockQuantity

  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 0
    const contentUnit = getUnitContentUnit(product) ?? fallbackUnit ?? 'unit'

    return normalizeQuantity(stockQuantity * contentQuantity, contentUnit)
  }

  return normalizeQuantity(
    stockQuantity,
    product.stockUnit ?? fallbackUnit ?? 'unit'
  )
}

function checkRecipeRequirementsProduction(
  recipeItems: ProductRecipeItemLike[],
  products: ProductWithStockInfo[]
): ProductionCheck {
  let possibleBatches = Infinity
  let hasZeroIngredient = false
  let hasLowIngredient = false
  let hasUnknownIngredient = false

  for (const recipeItem of recipeItems) {
    const ingredient = products.find(
      (item) => item.id === recipeItem.ingredientProductId
    )

    if (!ingredient) {
      hasUnknownIngredient = true
      continue
    }

    if (ingredient.madeOnDemand) {
      hasUnknownIngredient = true
      continue
    }

    if (ingredient.unlimitedStock) {
      continue
    }

    if (!ingredient.trackStock) {
      hasUnknownIngredient = true
      continue
    }

    const requiredQuantity = Number(recipeItem.quantity ?? 0)

    if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
      continue
    }

    const requiredUnit = recipeItem.unit ?? getEffectiveStockUnit(ingredient)
    const stockUnit = getEffectiveStockUnit(ingredient)

    if (getUnitFamily(requiredUnit) !== getUnitFamily(stockUnit)) {
      hasUnknownIngredient = true
      continue
    }

    const requiredBase = normalizeQuantity(requiredQuantity, requiredUnit)
    const availableBase = getAvailableBaseQuantity(ingredient, requiredUnit)

    if (!Number.isFinite(requiredBase) || requiredBase <= 0) {
      continue
    }

    if (!Number.isFinite(availableBase)) {
      hasUnknownIngredient = true
      continue
    }

    if (availableBase <= 0) {
      hasZeroIngredient = true
    }

    const minStock = Number(ingredient.minStock ?? 0)
    const stockQuantity = Number(ingredient.stockQuantity ?? 0)

    if (Number.isFinite(stockQuantity) && stockQuantity <= minStock) {
      hasLowIngredient = true
    }

    possibleBatches = Math.min(
      possibleBatches,
      Math.floor(availableBase / requiredBase)
    )
  }

  return {
    batches: possibleBatches === Infinity ? null : possibleBatches,
    hasZeroIngredient,
    hasLowIngredient,
    hasUnknownIngredient,
  }
}

function getRequiredVariationGroups(product: ProductWithStockInfo) {
  return (product.variationGroups ?? []).filter(
    (group: any) => group.required && (group.options?.length ?? 0) > 0
  )
}

function getRequiredVariationProduction(
  product: ProductWithStockInfo,
  products: ProductWithStockInfo[]
): ProductionCheck {
  let possibleBatches: number | null = null
  let hasZeroIngredient = false
  let hasLowIngredient = false
  let hasUnknownIngredient = false

  for (const group of getRequiredVariationGroups(product)) {
    const options = (group.options ?? []) as Array<{
      recipeItems?: ProductRecipeItemLike[]
    }>

    if (options.length === 0) {
      hasUnknownIngredient = true
      continue
    }

    let bestOptionBatches: number | null = null
    let bestOptionStatus: ProductionCheck | null = null

    for (const option of options) {
      const recipeItems = option.recipeItems ?? []

      if (recipeItems.length === 0) {
        bestOptionBatches = null
        bestOptionStatus = {
          batches: null,
          hasZeroIngredient: false,
          hasLowIngredient: false,
          hasUnknownIngredient: false,
        }
        break
      }

      const optionStatus = checkRecipeRequirementsProduction(recipeItems, products)
      const optionBatches = optionStatus.batches

      if (optionBatches == null) {
        bestOptionBatches = null
        bestOptionStatus = optionStatus
        break
      }

      if (bestOptionBatches == null || optionBatches > bestOptionBatches) {
        bestOptionBatches = optionBatches
        bestOptionStatus = optionStatus
      }
    }

    if (!bestOptionStatus) {
      hasUnknownIngredient = true
      continue
    }

    hasZeroIngredient = hasZeroIngredient || bestOptionStatus.hasZeroIngredient
    hasLowIngredient = hasLowIngredient || bestOptionStatus.hasLowIngredient
    hasUnknownIngredient =
      hasUnknownIngredient || bestOptionStatus.hasUnknownIngredient

    if (bestOptionBatches != null) {
      possibleBatches =
        possibleBatches == null
          ? bestOptionBatches
          : Math.min(possibleBatches, bestOptionBatches)
    }
  }

  return {
    batches: possibleBatches,
    hasZeroIngredient,
    hasLowIngredient,
    hasUnknownIngredient,
  }
}


function getMinimumExpectedProduction(product: ProductWithStockInfo) {
  const minStock = Number(product.minStock ?? 0)

  return Number.isFinite(minStock) && minStock > 0 ? minStock : 0
}

function mergeProductionStatus(
  current: 'ok' | 'low' | 'zero' | 'unknown',
  next: 'ok' | 'low' | 'zero' | 'unknown'
): 'ok' | 'low' | 'zero' | 'unknown' {
  // Severity order for production badges:
  // zero > low > unknown > ok.
  //
  // Important: the backend can send possibleProductionStatus = 'unknown'
  // together with a valid possibleProductionQuantity. When the frontend can
  // confidently recalculate the recipe/variation limit, that backend unknown
  // should not override an OK result, otherwise sufficient production becomes
  // a gray "uncertain" badge.
  if (current === 'zero' || next === 'zero') return 'zero'
  if (current === 'low' || next === 'low') return 'low'
  if (current === 'unknown' && next === 'unknown') return 'unknown'
  return 'ok'
}


function applyMinimumProductionStatus(
  quantity: number | null,
  status: 'ok' | 'low' | 'zero' | 'unknown',
  minimumExpectedProduction: number
): 'ok' | 'low' | 'zero' | 'unknown' {
  if (quantity == null) return status
  if (quantity <= 0) return 'zero'

  if (
    Number.isFinite(minimumExpectedProduction) &&
    minimumExpectedProduction > 0 &&
    quantity < minimumExpectedProduction
  ) {
    return 'low'
  }

  if (status === 'unknown') return 'ok'

  return status
}

function getPossibleProduction(
  product: ProductWithStockInfo,
  products: ProductWithStockInfo[]
) {
  const backendPossibleProduction = Number(
    product.possibleProductionQuantity ?? (product as any).expectedYield ?? NaN
  )
  const backendQuantity = Number.isFinite(backendPossibleProduction)
    ? Math.max(0, Math.floor(backendPossibleProduction))
    : null
  const backendStatus = (product.possibleProductionStatus ?? 'ok') as
    | 'ok'
    | 'low'
    | 'zero'
    | 'unknown'
  const minimumExpectedProduction = getMinimumExpectedProduction(product)
  const recipeItems = product.recipeItems ?? []

  if (!product.madeOnDemand || recipeItems.length === 0) {
    if (backendQuantity == null) return null

    return {
      quantity: backendQuantity,
      status: applyMinimumProductionStatus(
        backendQuantity,
        backendStatus,
        minimumExpectedProduction
      ),
    } as const
  }

  const outputQuantity = Number(product.recipeOutputQuantity ?? 1)
  const safeOutputQuantity =
    Number.isFinite(outputQuantity) && outputQuantity > 0 ? outputQuantity : 1

  const baseStatus = checkRecipeRequirementsProduction(recipeItems, products)
  const requiredVariationStatus = getRequiredVariationProduction(product, products)

  let possibleBatches = baseStatus.batches

  if (requiredVariationStatus.batches != null) {
    possibleBatches =
      possibleBatches == null
        ? requiredVariationStatus.batches
        : Math.min(possibleBatches, requiredVariationStatus.batches)
  }

  const hasZeroIngredient =
    baseStatus.hasZeroIngredient || requiredVariationStatus.hasZeroIngredient
  const hasLowIngredient =
    baseStatus.hasLowIngredient || requiredVariationStatus.hasLowIngredient
  const hasUnknownIngredient =
    baseStatus.hasUnknownIngredient || requiredVariationStatus.hasUnknownIngredient

  let quantity: number | null = backendQuantity
  let status: 'ok' | 'low' | 'zero' | 'unknown' = backendStatus

  if (possibleBatches == null) {
    if (backendQuantity == null) {
      return {
        quantity: null,
        status: hasUnknownIngredient ? 'unknown' : 'ok',
      } as const
    }

    if (hasUnknownIngredient) {
      status = mergeProductionStatus('unknown', status)
    }
  } else {
    const possibleUnits = Math.max(
      0,
      Math.floor(possibleBatches * safeOutputQuantity)
    )

    quantity = possibleUnits

    status =
      hasZeroIngredient || possibleUnits <= 0
        ? 'zero'
        : hasLowIngredient
          ? 'low'
          : hasUnknownIngredient
            ? 'unknown'
            : 'ok'

    status = mergeProductionStatus(status, backendStatus)
  }

  return {
    quantity,
    status: applyMinimumProductionStatus(
      quantity,
      status,
      minimumExpectedProduction
    ),
  } as const
}

function getIngredientWarningBadges(
  product: ProductWithStockInfo,
  products: ProductWithStockInfo[]
): IngredientWarningBadge[] {
  if (!product.madeOnDemand) return []

  const recipeItems = [
    ...(product.recipeItems ?? []),
    ...getRequiredVariationGroups(product).flatMap((group: any) =>
      (group.options ?? []).flatMap((option: any) => option.recipeItems ?? [])
    ),
  ]

  if (recipeItems.length === 0) return []

  const badges: IngredientWarningBadge[] = []
  const usedLabels = new Set<string>()

  for (const recipeItem of recipeItems) {
    const ingredient = products.find(
      (item) => item.id === recipeItem.ingredientProductId
    )

    if (!ingredient) continue
    if (ingredient.unlimitedStock) continue
    if (ingredient.madeOnDemand) continue
    if (!ingredient.trackStock) continue

    const stockQuantity = Number(ingredient.stockQuantity ?? 0)
    const minStock = Number(ingredient.minStock ?? 0)

    if (!Number.isFinite(stockQuantity)) continue

    if (stockQuantity <= 0) {
      const label = `Sem ${ingredient.name}`
      const shortLabel = 'Sem'

      if (!usedLabels.has(label)) {
        usedLabels.add(label)
        badges.push({
          label: shortLabel,
          title: label,
          className: 'bg-red-950/30 text-red-300 border-red-800/60',
          icon: PackageX,
        } as any)
      }

      continue
    }

    if (stockQuantity <= minStock) {
      const label = `Pouca ${ingredient.name}`
      const shortLabel = 'Pouco'

      if (!usedLabels.has(label)) {
        usedLabels.add(label)
        badges.push({
          label: shortLabel,
          title: label,
          className: 'bg-amber-950/30 text-amber-300 border-amber-800/60',
          icon: AlertTriangle,
        } as any)
      }
    }
  }

  return badges
}

function getStockBadge(
  product: ProductWithStockInfo,
  products: ProductWithStockInfo[]
) {
  if (product.madeOnDemand) {
    const production = getPossibleProduction(product, products)

    if (!production || production.quantity == null) {
      return {
        label: '~?',
        className: 'bg-slate-900/40 text-slate-300 border-slate-700/60',
        icon: ChefHat,
      }
    }

    if (production.status === 'zero' || production.quantity <= 0) {
      return {
        label: `~${production.quantity}`,
        className: 'bg-red-950/30 text-red-300 border-red-800/60',
        icon: PackageX,
      }
    }

    if (production.status === 'low') {
      return {
        label: `~${production.quantity}`,
        className: 'bg-amber-950/30 text-amber-300 border-amber-800/60',
        icon: AlertTriangle,
      }
    }


    return {
      label: `~${production.quantity}`,
      className: 'bg-emerald-950/25 text-emerald-300 border-emerald-800/50',
      icon: ChefHat,
    }
  }

  if (product.unlimitedStock) {
    return {
      label: '∞',
      className: 'bg-sky-950/30 text-sky-300 border-sky-800/60',
      icon: null,
    }
  }

  if (!product.trackStock) {
    return null
  }

  const stockQuantity = Number(product.stockQuantity ?? 0)
  const minStock = Number(product.minStock ?? 0)

  const quantityLabel = hasUnitContent(product)
    ? `${formatQuantity(stockQuantity, product.stockUnit)} (${formatQuantity(
      getEffectiveStockQuantity(product),
      getEffectiveStockUnit(product)
    )})`
    : formatQuantity(stockQuantity, product.stockUnit)

  if (stockQuantity <= 0) {
    return {
      label: quantityLabel,
      className: 'bg-red-950/30 text-red-300 border-red-800/60',
      icon: PackageX,
    }
  }

  if (stockQuantity <= minStock) {
    return {
      label: quantityLabel,
      className: 'bg-amber-950/30 text-amber-300 border-amber-800/60',
      icon: AlertTriangle,
    }
  }

  return {
    label: quantityLabel,
    className: 'bg-emerald-950/25 text-emerald-300 border-emerald-800/50',
    icon: BoxIcon,
  }
}

function getProductBaseUnitCostForCard(product: ProductWithStockInfo): {
  unitCost: number
  unit: string | null
} | null {
  if (product.costMode === 'recipe' || product.hasRecipe) {
    const totalCost = Number(product.recipeCost ?? 0)
    const outputQuantity = Number(product.recipeOutputQuantity ?? 1)
    const outputUnit = product.recipeOutputUnit ?? product.stockUnit ?? 'unit'

    if (
      !Number.isFinite(totalCost) ||
      totalCost <= 0 ||
      !Number.isFinite(outputQuantity) ||
      outputQuantity <= 0
    ) {
      return null
    }

    const representedQuantity = hasUnitContent(product)
      ? getUnitContentQuantity(product)
      : null
    const representedUnit = hasUnitContent(product)
      ? getUnitContentUnit(product)
      : null

    const normalizedOutput =
      representedQuantity != null &&
        representedUnit != null &&
        outputUnit === 'unit'
        ? normalizeQuantity(outputQuantity * representedQuantity, representedUnit)
        : normalizeQuantity(outputQuantity, outputUnit)

    const finalUnit =
      representedQuantity != null && representedUnit != null && outputUnit === 'unit'
        ? representedUnit
        : outputUnit

    if (!Number.isFinite(normalizedOutput) || normalizedOutput <= 0) {
      return null
    }

    return {
      unitCost: totalCost / normalizedOutput,
      unit: finalUnit,
    }
  }

  const totalCost = Number(product.referenceCost ?? product.simpleCost ?? 0)
  const rawReferenceQuantity = Number(
    product.referenceQuantity ??
    ((product.stockUnit ?? 'unit') === 'unit' ? 1 : NaN)
  )

  if (
    !Number.isFinite(totalCost) ||
    totalCost <= 0 ||
    !Number.isFinite(rawReferenceQuantity) ||
    rawReferenceQuantity <= 0
  ) {
    return null
  }

  const unit = getEffectiveStockUnit(product)
  let referenceQuantity = rawReferenceQuantity

  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 1

    const looksLikeOldContentReference =
      Math.abs(rawReferenceQuantity - contentQuantity) < 0.000001

    referenceQuantity = looksLikeOldContentReference
      ? rawReferenceQuantity
      : rawReferenceQuantity * contentQuantity
  }

  const normalizedQuantity = normalizeQuantity(referenceQuantity, unit)

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return null
  }

  return {
    unitCost: totalCost / normalizedQuantity,
    unit,
  }
}

function getVariationOptionPossibleUses(
  option: any,
  products: ProductWithStockInfo[]
): {
  quantity: number | null
  status: 'ok' | 'low' | 'zero' | 'unknown'
} | null {
  const recipeItems = option.recipeItems ?? []

  if (recipeItems.length === 0) {
    return null
  }

  let possibleUses = Infinity
  let hasLowIngredient = false
  let hasUnknownIngredient = false

  for (const recipeItem of recipeItems) {
    const ingredient = products.find(
      (product) => product.id === recipeItem.ingredientProductId
    )

    if (!ingredient) {
      hasUnknownIngredient = true
      continue
    }

    if (ingredient.unlimitedStock) {
      continue
    }

    if (!ingredient.trackStock) {
      hasUnknownIngredient = true
      continue
    }

    const requiredQuantity = Number(recipeItem.quantity ?? 0)

    if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
      continue
    }

    const requiredUnit = recipeItem.unit ?? getEffectiveStockUnit(ingredient)
    const stockUnit = getEffectiveStockUnit(ingredient)

    if (getUnitFamily(requiredUnit) !== getUnitFamily(stockUnit)) {
      hasUnknownIngredient = true
      continue
    }

    const requiredBaseQuantity = normalizeQuantity(requiredQuantity, requiredUnit)
    const availableBaseQuantity = getAvailableBaseQuantity(
      ingredient,
      requiredUnit
    )

    if (
      !Number.isFinite(requiredBaseQuantity) ||
      requiredBaseQuantity <= 0 ||
      !Number.isFinite(availableBaseQuantity)
    ) {
      hasUnknownIngredient = true
      continue
    }

    const ingredientPossibleUses = Math.floor(
      availableBaseQuantity / requiredBaseQuantity
    )

    possibleUses = Math.min(possibleUses, ingredientPossibleUses)

    const stockQuantity = Number(ingredient.stockQuantity ?? 0)
    const minStock = Number(ingredient.minStock ?? 0)

    if (Number.isFinite(stockQuantity) && stockQuantity <= minStock) {
      hasLowIngredient = true
    }
  }

  if (possibleUses === Infinity) {
    return {
      quantity: null,
      status: hasUnknownIngredient ? 'unknown' : 'ok',
    }
  }

  const quantity = Math.max(0, possibleUses)

  return {
    quantity,
    status:
      quantity <= 0
        ? 'zero'
        : hasLowIngredient
          ? 'low'
          : hasUnknownIngredient
            ? 'unknown'
            : 'ok',
  }
}

function getVariationOptionStockBadge(
  option: any,
  products: ProductWithStockInfo[]
) {
  const possibleUses = getVariationOptionPossibleUses(option, products)

  if (!possibleUses) return null

  if (possibleUses.quantity == null) {
    return {
      label: '?',
      title: 'Não foi possível calcular quantas vezes essa variação pode ser usada com o estoque atual.',
      className: 'bg-slate-900/40 text-slate-300 border-slate-700/60',
      icon: AlertTriangle,
    }
  }

  const title = `Você tem estoque para usar esta variação aproximadamente ${possibleUses.quantity} vez${possibleUses.quantity === 1 ? '' : 'es'
    }.`

  if (possibleUses.status === 'zero' || possibleUses.quantity <= 0) {
    return {
      label: String(possibleUses.quantity),
      title,
      className: 'bg-red-950/30 text-red-300 border-red-800/60',
      icon: PackageX,
    }
  }

  if (possibleUses.status === 'low') {
    return {
      label: String(possibleUses.quantity),
      title,
      className: 'bg-amber-950/30 text-amber-300 border-amber-800/60',
      icon: AlertTriangle,
    }
  }

  if (possibleUses.status === 'unknown') {
    return {
      label: String(possibleUses.quantity),
      title,
      className: 'bg-slate-900/40 text-slate-300 border-slate-700/60',
      icon: AlertTriangle,
    }
  }

  return {
    label: String(possibleUses.quantity),
    title,
    className: 'bg-emerald-950/25 text-emerald-300 border-emerald-800/50',
    icon: BoxIcon,
  }
}

function getProductCostForCard(product: ProductWithStockInfo): number | null {
  if (product.isStockOnly) return null

  if (product.costMode === 'recipe' || product.hasRecipe) {
    const recipeCost = Number(product.recipeCost ?? 0)
    const outputQuantity = Number(product.recipeOutputQuantity ?? 1)
    const outputUnit = product.recipeOutputUnit ?? 'unit'

    if (
      !Number.isFinite(recipeCost) ||
      recipeCost <= 0 ||
      !Number.isFinite(outputQuantity) ||
      outputQuantity <= 0
    ) {
      return null
    }

    if (outputUnit === 'unit') {
      return recipeCost / outputQuantity
    }

    return recipeCost
  }

  const totalCost = Number(product.referenceCost ?? product.simpleCost ?? 0)
  const referenceQuantity = Number(product.referenceQuantity ?? 1)

  if (
    !Number.isFinite(totalCost) ||
    totalCost <= 0 ||
    !Number.isFinite(referenceQuantity) ||
    referenceQuantity <= 0
  ) {
    return null
  }

  if (hasUnitContent(product) || (product.stockUnit ?? 'unit') === 'unit') {
    return totalCost / referenceQuantity
  }

  return totalCost
}

function getRecipeItemsCostDetailsForCard(
  recipeItems: ProductRecipeItemLike[] | undefined,
  products: ProductWithStockInfo[]
): VariationCostDetails {
  if (!recipeItems || recipeItems.length === 0) {
    return {
      totalCost: 0,
      lines: [],
    }
  }

  return recipeItems.reduce<VariationCostDetails>(
    (details, recipeItem) => {
      const ingredient = products.find(
        (product) => product.id === recipeItem.ingredientProductId
      )

      if (!ingredient) return details

      const costData = getProductBaseUnitCostForCard(ingredient)
      if (!costData) return details

      const requiredQuantity = Number(recipeItem.quantity ?? 0)
      const requiredUnit = recipeItem.unit ?? costData.unit ?? 'unit'

      if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
        return details
      }

      if (getUnitFamily(requiredUnit) !== getUnitFamily(costData.unit)) {
        return details
      }

      const requiredBase = normalizeQuantity(requiredQuantity, requiredUnit)

      if (!Number.isFinite(requiredBase) || requiredBase <= 0) {
        return details
      }

      const cost = costData.unitCost * requiredBase

      details.totalCost += cost
      details.lines.push({
        ingredientName: ingredient.name,
        quantityLabel: formatQuantity(requiredQuantity, requiredUnit),
        cost,
      })

      return details
    },
    {
      totalCost: 0,
      lines: [],
    }
  )
}

function getVariationOptionCostDetailsForCard(
  option: any,
  products: ProductWithStockInfo[]
): VariationCostDetails {
  const costMode = option.costMode ?? 'simple'

  if (costMode === 'recipe') {
    return getRecipeItemsCostDetailsForCard(option.recipeItems ?? [], products)
  }

  const referenceCost = Number(option.referenceCost ?? option.simpleCost ?? 0)
  const referenceQuantity = Number(option.referenceQuantity ?? 1)

  if (!Number.isFinite(referenceCost) || referenceCost <= 0) {
    return {
      totalCost: 0,
      lines: [],
    }
  }

  const safeReferenceQuantity =
    Number.isFinite(referenceQuantity) && referenceQuantity > 0
      ? referenceQuantity
      : 1

  const totalCost = referenceCost / safeReferenceQuantity

  return {
    totalCost,
    lines: [
      {
        ingredientName: 'Custo',
        quantityLabel: formatQuantity(1, 'unit'),
        cost: totalCost,
      },
    ],
  }
}

function getVariationOptionCostForCard(
  option: any,
  products: ProductWithStockInfo[]
) {
  return getVariationOptionCostDetailsForCard(option, products).totalCost
}

function getVariationSelectionsCostForCard(
  product: ProductWithStockInfo,
  selections: OrderItemVariationSelection[],
  products: ProductWithStockInfo[]
) {
  return selections.reduce((sum, selection) => {
    const group = product.variationGroups?.find(
      (variationGroup: any) => variationGroup.id === selection.groupId
    )

    if (!group) return sum

    const selectedOptions = (group.options ?? []).filter((option: any) =>
      selection.selectedOptionIds.includes(option.id)
    )

    return (
      sum +
      selectedOptions.reduce(
        (optionSum: number, option: any) =>
          optionSum + getVariationOptionCostForCard(option, products),
        0
      )
    )
  }, 0)
}

function getProfitInfo(
  product: ProductWithStockInfo,
  salesEnvironmentId?: string | null
) {
  if (product.isStockOnly) return null

  const price = getProductBasePriceForEnvironment(product, salesEnvironmentId)
  const cost = getProductCostForCard(product)

  if (!Number.isFinite(price) || price <= 0 || cost == null || cost <= 0) {
    return null
  }

  const profitAmount = price - cost

  if (profitAmount >= 0) {
    return null
  }

  const marginPercent = (profitAmount / price) * 100

  return {
    label: `Prejuízo ${marginPercent.toFixed(0)}%`,
    className: 'bg-red-950/30 text-red-300 border-red-800/60',
    icon: TrendingDown,
    marginPercent,
    profitAmount,
    cost,
  }
}

function Badge({
  label,
  className,
  icon: Icon,
  title,
}: {
  label: string
  className: string
  icon?: React.ElementType | null
  title?: string
}) {
  return (
    <span
      title={title ?? label}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${className}`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  )
}

export function ProductGrid({
  category,
  products,
  allProducts,
  categories,
  onAddProduct,
  salesEnvironmentId,
}: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariations, setSelectedVariations] = useState<
    OrderItemVariationSelection[]
  >([])

  const stockProducts = useMemo(
    () => (allProducts ?? products) as ProductWithStockInfo[],
    [allProducts, products]
  )

  const visibleProducts = useMemo(() => {
    if (!category) {
      return products
    }

    return products.filter((product) => product.categoryId === category)
  }, [products, category])

  const handleProductClick = (product: Product) => {
    const hasVariations = (product.variationGroups?.length ?? 0) > 0

    if (!hasVariations) {
      onAddProduct(product)
      return
    }

    setSelectedProduct(product)
    setSelectedVariations([])
  }

  const handleToggleOption = (
    groupId: string,
    optionId: string,
    selectionType: 'single' | 'multiple'
  ) => {
    setSelectedVariations((prev) => {
      const existing = prev.find((selection) => selection.groupId === groupId)

      if (!existing) {
        return [
          ...prev,
          {
            groupId,
            selectedOptionIds: [optionId],
          },
        ]
      }

      if (selectionType === 'single') {
        return prev.map((selection) =>
          selection.groupId === groupId
            ? {
              ...selection,
              selectedOptionIds: [optionId],
            }
            : selection
        )
      }

      const alreadySelected = existing.selectedOptionIds.includes(optionId)

      return prev.map((selection) =>
        selection.groupId === groupId
          ? {
            ...selection,
            selectedOptionIds: alreadySelected
              ? selection.selectedOptionIds.filter((id) => id !== optionId)
              : [...selection.selectedOptionIds, optionId],
          }
          : selection
      )
    })
  }

  const handleConfirmVariations = () => {
    if (!selectedProduct) return

    const draftItem = {
      product: selectedProduct,
      quantity: 1,
      variationSelections: selectedVariations,
    }

    const errors = validateOrderItem(draftItem)

    if (errors.length > 0) {
      alert(errors[0])
      return
    }

    onAddProduct(selectedProduct, selectedVariations)
    setSelectedProduct(null)
    setSelectedVariations([])
  }

  const getCandidateSelections = (groupId?: string, optionId?: string) => {
    if (!selectedProduct) return selectedVariations

    const nextSelections = selectedVariations.map((selection) => ({
      groupId: selection.groupId,
      selectedOptionIds: [...selection.selectedOptionIds],
    }))

    if (!groupId || !optionId) {
      return nextSelections
    }

    const currentGroup = selectedProduct.variationGroups?.find(
      (group) => group.id === groupId
    )

    if (!currentGroup) {
      return nextSelections
    }

    const existing = nextSelections.find(
      (selection) => selection.groupId === groupId
    )

    if (!existing) {
      nextSelections.push({
        groupId,
        selectedOptionIds: [optionId],
      })

      return nextSelections
    }

    if (currentGroup.selectionType === 'single') {
      existing.selectedOptionIds = [optionId]
      return nextSelections
    }

    const alreadySelected = existing.selectedOptionIds.includes(optionId)

    existing.selectedOptionIds = alreadySelected
      ? existing.selectedOptionIds.filter((id) => id !== optionId)
      : [...existing.selectedOptionIds, optionId]

    return nextSelections
  }

  const getRunningPriceForSelections = (
    selections: OrderItemVariationSelection[]
  ) => {
    if (!selectedProduct) return 0

    return getItemPrice(
      {
        product: selectedProduct,
        quantity: 1,
        variationSelections: selections,
      },
      salesEnvironmentId
    )
  }

  const getRunningPriceForGroup = (groupId?: string, optionId?: string) => {
    return getRunningPriceForSelections(getCandidateSelections(groupId, optionId))
  }

  const getProfitForSelections = (
    selections: OrderItemVariationSelection[]
  ) => {
    if (!selectedProduct) return null

    const product = selectedProduct as ProductWithStockInfo
    const baseCost = getProductCostForCard(product)

    if (baseCost == null || baseCost <= 0) return null

    const finalPrice = getRunningPriceForSelections(selections)
    const variationCost = getVariationSelectionsCostForCard(
      product,
      selections,
      stockProducts
    )

    const finalCost = baseCost + variationCost
    const profitAmount = finalPrice - finalCost

    if (profitAmount >= 0) return null

    return {
      profitAmount,
      finalCost,
      finalPrice,
      label: `Prejuízo ${formatBRL(Math.abs(profitAmount))}`,
    }
  }

  const selectedCategory = categories.find((cat) => cat.id === category)

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 sm:p-5">
        {visibleProducts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm">
              {products.length === 0
                ? 'Nenhum produto cadastrado'
                : 'Nenhum produto encontrado'}
            </p>
            <p className="mt-1 text-xs">
              {products.length === 0
                ? 'Cadastre produtos para começar'
                : 'Tente outra busca ou categoria'}
            </p>
          </div>
        ) : (
          <>
            {selectedCategory && category && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Categoria:{' '}
                  <span className="font-medium text-foreground">
                    {selectedCategory.name}
                  </span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const stockProduct = product as ProductWithStockInfo

                const stockBadge = getStockBadge(stockProduct, stockProducts)
                const ingredientWarningBadges = getIngredientWarningBadges(
                  stockProduct,
                  stockProducts
                )
                const profitInfo = getProfitInfo(
                  stockProduct,
                  salesEnvironmentId
                )
                const price = getProductBasePriceForEnvironment(
                  product,
                  salesEnvironmentId
                )

                return (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    className="group flex min-h-[132px] flex-col rounded-2xl border border-border bg-card p-3 text-left transition-all hover:border-primary/20 hover:bg-secondary/40 sm:min-h-[145px] sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-2xl sm:text-3xl">{product.emoji ?? '🍽️'}</span>

                      <div className="flex max-w-[150px] flex-col items-end gap-1">
                        {stockBadge && (
                          <Badge
                            label={stockBadge.label}
                            className={stockBadge.className}
                            icon={stockBadge.icon}
                          />
                        )}

                        {ingredientWarningBadges.slice(0, 2).map((badge) => (
                          <Badge
                            key={badge.title ?? badge.label}
                            label={badge.label}
                            title={badge.title}
                            className={badge.className}
                            icon={badge.icon}
                          />
                        ))}

                        {ingredientWarningBadges.length > 2 && (
                          <Badge
                            label={`+${ingredientWarningBadges.length - 2} alertas`}
                            className="bg-slate-900/40 text-slate-300 border-slate-700/60"
                            icon={AlertTriangle}
                          />
                        )}

                        {profitInfo && (
                          <Badge
                            label={profitInfo.label}
                            className={profitInfo.className}
                            icon={profitInfo.icon}
                          />
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex-1">
                      <h3 className="font-semibold leading-tight text-foreground">
                        {product.name}
                      </h3>

                      {product.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Preço</p>
                        <p className="text-sm font-bold text-primary">
                          {formatBRL(price)}
                        </p>
                      </div>

                      {profitInfo && (
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">
                            Custo
                          </p>
                          <p className="text-xs font-semibold text-red-300">
                            {formatBRL(profitInfo.cost)}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedProduct.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Escolha as variações do produto
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedProduct(null)
                  setSelectedVariations([])
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[68dvh] space-y-5 overflow-y-auto p-4 sm:p-5">
              {selectedProduct.variationGroups?.map((group) => {
                const selection = selectedVariations.find(
                  (item) => item.groupId === group.id
                )

                return (
                  <div key={group.id} className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {group.name}
                        {group.required && (
                          <span className="ml-2 text-xs text-warning">
                            (obrigatório)
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {group.selectionType === 'single'
                          ? 'Selecione uma opção'
                          : 'Selecione uma ou mais opções'}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      {group.options.map((option) => {
                        const isSelected =
                          selection?.selectedOptionIds.includes(option.id) ?? false

                        const optionModifier =
                          getVariationOptionPriceModifierForEnvironment(
                            option,
                            salesEnvironmentId
                          )

                        const candidateSelections = getCandidateSelections(
                          group.id,
                          option.id
                        )
                        const candidatePrice =
                          getRunningPriceForSelections(candidateSelections)

                        const optionCostDetails =
                          getVariationOptionCostDetailsForCard(
                            option,
                            stockProducts
                          )

                        const variationStockBadge = getVariationOptionStockBadge(
                          option,
                          stockProducts
                        )

                        const optionProfitWarning =
                          getProfitForSelections(candidateSelections)

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              handleToggleOption(
                                group.id,
                                option.id,
                                group.selectionType
                              )
                            }
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-background hover:bg-secondary'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {option.name}
                                </p>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge
                                    label={`${optionModifier >= 0 ? '+' : ''
                                      }${formatBRL(optionModifier)}`}
                                    className="bg-sky-950/30 text-sky-300 border-sky-800/60"
                                    icon={null}
                                  />

                                  {variationStockBadge && (
                                    <Badge
                                      label={variationStockBadge.label}
                                      title={variationStockBadge.title}
                                      className={variationStockBadge.className}
                                      icon={variationStockBadge.icon}
                                    />
                                  )}

                                  {optionProfitWarning && (
                                    <Badge
                                      label={optionProfitWarning.label}
                                      className="bg-red-950/30 text-red-300 border-red-800/60"
                                      icon={TrendingDown}
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-xs text-muted-foreground">
                                  Total
                                </p>
                                <p className="text-sm font-semibold text-primary">
                                  {formatBRL(candidatePrice)}
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
              <div>
                <p className="text-sm text-muted-foreground">Preço final</p>
                <p className="text-xl font-bold text-primary">
                  {formatBRL(getRunningPriceForGroup())}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedProduct(null)
                    setSelectedVariations([])
                  }}
                >
                  Cancelar
                </Button>

                <Button
                  onClick={handleConfirmVariations}
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                >
                  Adicionar ao pedido
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
