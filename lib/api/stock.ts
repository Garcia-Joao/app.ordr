import { apiFetch } from './client'
import type { ProductVariationGroup } from '@/lib/pos-types'

export type StockUnit = 'unit' | 'ml' | 'l' | 'g' | 'kg'

export type StockProduct = {
  id: string
  name: string
  emoji?: string | null
  price: number
  category?: {
    id: string
    name: string
    emoji?: string | null
  } | null

  isStockOnly: boolean
  trackStock: boolean
  stockQuantity: number
  minStock: number

  costMode: 'simple' | 'recipe'
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
  variationGroups?: ProductVariationGroup[]

  hasRecipe?: boolean
  recipeCost?: number | null
  expectedYield?: number | null
  limitingIngredient?: {
    id: string
    name: string
  } | null
}

export type StockMovement = {
  id: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  previousQty: number
  newQty: number
  reason?: string | null
  createdAt: string
  product: {
    id: string
    name: string
    emoji?: string | null
    category?: {
      id: string
      name: string
      emoji?: string | null
    } | null
  }
}

export type RecipeRequirement = {
  ingredientProductId: string
  ingredientName: string
  ingredientEmoji?: string | null
  unit: StockUnit
  requiredQuantity: number
  stockAvailable: number
  possibleUnitsFromStock: number
  missingQuantity: number
  isRecipe?: boolean
  isUnlimited?: boolean
  stockUnit?: StockUnit
}

export type RecipeTreeNode = {
  productId: string
  productName: string
  requestedQuantity: number
  children: RecipeTreeNode[]
}

export type RecipeAnalysisResponse = {
  product: StockProduct
  recipeCost: number
  recipeUnitCost: number
  outputQuantity: number
  outputUnit: StockUnit
  expectedYield: number | null
  limitingIngredient: {
    id: string
    name: string
  } | null
  flatRequirements: RecipeRequirement[]
  tree: RecipeTreeNode
}

export type CalculatorNestedRequirement = {
  recipeProductId: string
  recipeProductName: string
  requiredQuantity: number
  unit: StockUnit
  baseItems: RecipeRequirement[]
}

export type RecipeCalculatorResponse = {
  product: StockProduct
  requestedQuantity: number
  outputUnit: StockUnit
  unitCost: number
  totalCost: number
  directRequirements: RecipeRequirement[]
  nestedRequirements: CalculatorNestedRequirement[]
  tree: RecipeTreeNode
}

export function getStockProducts() {
  return apiFetch<StockProduct[]>('/stock')
}

export function createStockMovement(input: {
  productId: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  reason?: string | null
}) {
  return apiFetch<{
    product: StockProduct
    movement: StockMovement
  }>('/stock/movements', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getProductStockMovements(productId: string) {
  return apiFetch<StockMovement[]>(`/stock/${productId}/movements`)
}

export function getRecipeAnalysis(productId: string) {
  return apiFetch<RecipeAnalysisResponse>(`/stock/${productId}/recipe-analysis`)
}

export function calculateRecipeProduction(productId: string, quantity: number) {
  return apiFetch<RecipeCalculatorResponse>(
    `/stock/${productId}/calculator?quantity=${quantity}`
  )
}