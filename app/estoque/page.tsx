"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ShoppingCart,
  AlertTriangle,
  PackageX,
  Plus,
  Minus,
  History,
  Loader2,
  X,
  FlaskConical,
  Calculator,
  Pencil,
  Package,
  Trash2,
  Equal,
  GitBranch,
  ListTree,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import ReactFlow, {
  Background,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  calculateRecipeProduction,
  createStockMovement,
  getProductStockMovements,
  getRecipeAnalysis,
  getStockProducts,
  type RecipeAnalysisResponse,
  type RecipeCalculatorResponse,
  type StockMovement,
  type StockProduct,
} from "@/lib/api/stock";
import { getBuyCart, upsertBuyCartItem } from "@/lib/api/buys";
import { getProducts as getPosProducts } from "@/lib/api";
import {
  createProduct,
  updateProduct,
  getProductById,
  deleteProduct,
} from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";
import {
  formatBRL,
  type CategoryConfig,
  type Product,
  type ProductRecipeItem,
  type ProductCostMode,
  type ProductVariationGroup,
  type ProductVariationOption,
  type StockUnit,
} from "@/lib/pos-types";

type StockFilter = "all" | "low" | "out" | "ok" | "tracked" | "recipe";
type ProductTypeFilter = "all" | "stock_only" | "recipe" | "item" | "on_demand";
type ProfitFilter = "all" | "good" | "warning" | "negative" | "no_profit";
type RecipeViewMode = "flow" | "list";
type ProduceQuantityMode = "recipes" | "custom";

type StockBuySuggestion = {
  product: StockProduct;
  suggestedQuantity: number;
  quantity: string;
};

type RecipeBuySuggestionItem = {
  product: StockProduct;
  ingredientName: string;
  requiredQuantity: number;
  requiredUnit: StockUnit | null;
  missingQuantity: number;
  buyQuantity: number;
  quantity: string;
};

type RecipeBuySuggestion = {
  recipeProduct: StockProduct;
  items: RecipeBuySuggestionItem[];
};

type ExistingBuyCartPromptItem = {
  product: StockProduct;
  existingQuantity: number;
  requestedQuantity: number;
  nextQuantity: number;
};

type ExistingBuyCartPrompt = {
  items: ExistingBuyCartPromptItem[];
};

type ProduceItemPreview = RecipeCalculatorResponse;

type EditableStockItem = {
  id?: string;
  name: string;
  emoji?: string | null;
  categoryId?: string | null;
  price: number;
  isStockOnly: boolean;
  trackStock: boolean;
  stockQuantity: number;
  minStock: number;
  costMode: ProductCostMode;
  simpleCost: number | null;
  stockUnit: StockUnit | null;
  referenceQuantity: number | null;
  referenceCost: number | null;
  unitContentQuantity: number | null;
  unitContentUnit: StockUnit | null;
  madeOnDemand: boolean;
  unlimitedStock: boolean;
  recipeOutputQuantity: number | null;
  recipeOutputUnit: StockUnit | null;
  recipeItems: ProductRecipeItem[];
  variationGroups: EditableVariationGroup[];
};

type StockProductWithRecipeItems = StockProduct & {
  recipeItems?: ProductRecipeItem[];
};

type EditableVariationOptionRecipeItem = {
  id: string;
  ingredientProductId: string;
  quantity: number;
  unit: StockUnit;
};

type VariationCostPreview = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
  extraIngredientCost: number;
  totalExtraCost: number;
  finalCost: number;
  salePrice: number;
  marginAmount: number | null;
  marginPercent: number | null;
  ingredients: {
    ingredientProductId: string;
    ingredientName: string;
    quantity: number;
    unit: StockUnit;
    cost: number;
  }[];
};

type EditableVariationOption = {
  id: string;
  name: string;
  priceModifier: number;
  costMode: "simple" | "recipe";
  simpleCost: number | null;
  stockUnit: StockUnit | null;
  referenceQuantity: number | null;
  referenceCost: number | null;
  recipeItems: EditableVariationOptionRecipeItem[];
};

type EditableVariationGroup = {
  id: string;
  name: string;
  required: boolean;
  selectionType: "single" | "multiple";
  options: EditableVariationOption[];
};

const STOCK_UNIT_OPTIONS: StockUnit[] = ["unit", "ml", "l", "g", "kg"];

function mergeStockProductsWithProductVariationData(
  stockProducts: StockProduct[],
  posProducts: Product[] = [],
): StockProduct[] {
  const posById = new Map(posProducts.map((product: any) => [product.id, product]));

  return stockProducts.map((stockProduct: any) => {
    const posProduct = posById.get(stockProduct.id) as any;

    if (!posProduct) return stockProduct;

    const stockGroups = stockProduct.variationGroups ?? [];
    const posGroups = posProduct.variationGroups ?? [];
    const sourceGroups = stockGroups.length > 0 ? stockGroups : posGroups;

    const variationGroups = sourceGroups.map((sourceGroup: any) => {
      const stockGroup = stockGroups.find((group: any) => group.id === sourceGroup.id);
      const posGroup = posGroups.find((group: any) => group.id === sourceGroup.id);
      const stockOptions = stockGroup?.options ?? [];
      const posOptions = posGroup?.options ?? [];
      const sourceOptions = stockOptions.length > 0 ? stockOptions : posOptions;

      return {
        ...(posGroup ?? {}),
        ...(stockGroup ?? sourceGroup),
        options: sourceOptions.map((sourceOption: any) => {
          const stockOption = stockOptions.find((option: any) => option.id === sourceOption.id);
          const posOption = posOptions.find((option: any) => option.id === sourceOption.id);

          return {
            ...(posOption ?? {}),
            ...(stockOption ?? sourceOption),
            recipeItems: (
              stockOption?.recipeItems ??
              posOption?.recipeItems ??
              sourceOption?.recipeItems ??
              []
            ).map((item: any) => ({
              ...item,
              ingredientProductId:
                item.ingredientProductId ?? item.ingredientId ?? item.productId,
              quantity: Number(item.quantity ?? 0),
            })),
          };
        }),
      };
    });

    return {
      ...stockProduct,
      recipeItems: (stockProduct.recipeItems ?? posProduct.recipeItems ?? []).map(
        (item: any) => ({
          ...item,
          ingredientProductId:
            item.ingredientProductId ?? item.ingredientId ?? item.productId,
          quantity: Number(item.quantity ?? 0),
        }),
      ),
      variationGroups,
    };
  });
}

function getStockStatus(
  product: StockProduct,
  products: StockProduct[] = [],
): {
  label: string;
  className: string;
} {
  if (product.madeOnDemand || product.hasRecipe || product.costMode === "recipe") {
    const possibleProduction = getPossibleProductionConsideringVariations(product, products);
    const minProduction = Number(product.minStock ?? 0);
    const ingredientAlert = getRecipeIngredientStockAlertStatus(product, products);

    if (possibleProduction <= 0 || ingredientAlert === "zero") {
      return {
        label: "Não produz",
        className:
          "bg-destructive/15 text-destructive border border-destructive/30",
      };
    }

    if (
      (minProduction > 0 && possibleProduction < minProduction) ||
      ingredientAlert === "low" ||
      ingredientAlert === "unknown"
    ) {
      return {
        label: "Produção baixa",
        className: "bg-warning/15 text-warning border border-warning/30",
      };
    }

    return {
      label: "Produção OK",
      className: "bg-success/15 text-success border border-success/30",
    };
  }

  if (product.unlimitedStock) {
    return {
      label: "Infinito",
      className: "bg-primary/15 text-primary border border-primary/30",
    };
  }

  if (!product.trackStock) {
    return {
      label: "Não controlado",
      className: "bg-secondary text-secondary-foreground",
    };
  }

  if (product.stockQuantity <= 0) {
    return {
      label: "Sem estoque",
      className:
        "bg-destructive/15 text-destructive border border-destructive/30",
    };
  }

  if (product.stockQuantity <= product.minStock) {
    return {
      label: "Estoque baixo",
      className: "bg-warning/15 text-warning border border-warning/30",
    };
  }

  return {
    label: "OK",
    className: "bg-success/15 text-success border border-success/30",
  };
}

function formatQtyUnit(quantity: number, unit?: StockUnit | null) {
  const formatted = Number(quantity).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (!unit || unit === "unit") {
    return formatted;
  }

  return `${formatted} ${unit}`;
}

function formatQtyUnitCompact(quantity: number, unit?: StockUnit | null) {
  const formatted = Number(quantity).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (!unit || unit === "unit") {
    return formatted;
  }

  return `${formatted}${unit}`;
}

function getUnitFamily(unit?: StockUnit | null) {
  if (unit === "ml" || unit === "l") return "volume";
  if (unit === "g" || unit === "kg") return "weight";
  return "count";
}

function normalizeQuantity(quantity: number, unit?: StockUnit | null) {
  if (!Number.isFinite(quantity)) return quantity;

  switch (unit) {
    case "l":
      return quantity * 1000;
    case "ml":
      return quantity;
    case "kg":
      return quantity * 1000;
    case "g":
      return quantity;
    case "unit":
    default:
      return quantity;
  }
}

function denormalizeQuantity(quantity: number, unit?: StockUnit | null) {
  if (!Number.isFinite(quantity)) return quantity;

  switch (unit) {
    case "l":
      return quantity / 1000;
    case "kg":
      return quantity / 1000;
    case "ml":
    case "g":
    case "unit":
    default:
      return quantity;
  }
}

function getMissingQuantityInRequiredUnit(params: {
  requiredQuantity: number;
  requiredUnit?: StockUnit | null;
  stockAvailable?: number | null;
  stockUnit?: StockUnit | null;
}) {
  const { requiredQuantity, requiredUnit, stockAvailable, stockUnit } = params;

  if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return 0;
  if (stockAvailable == null) return requiredQuantity;
  if (!Number.isFinite(stockAvailable)) return 0;

  const requiredFamily = getUnitFamily(requiredUnit);
  const stockFamily = getUnitFamily(stockUnit ?? requiredUnit);

  if (requiredFamily !== stockFamily) return requiredQuantity;

  const requiredBase = normalizeQuantity(requiredQuantity, requiredUnit);
  const availableBase = normalizeQuantity(stockAvailable, stockUnit ?? requiredUnit);

  if (!Number.isFinite(requiredBase) || !Number.isFinite(availableBase)) return 0;

  return denormalizeQuantity(Math.max(0, requiredBase - availableBase), requiredUnit);
}

function getUnitContentQuantity(
  product: StockProduct | null | undefined,
): number | null {
  const quantity = Number((product as any)?.unitContentQuantity ?? 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function getUnitContentUnit(
  product: StockProduct | null | undefined,
): StockUnit | null {
  const unit = ((product as any)?.unitContentUnit ?? null) as StockUnit | null;
  return unit && unit !== "unit" ? unit : null;
}

function hasUnitContent(product: StockProduct | null | undefined) {
  return (
    (product?.stockUnit ?? "unit") === "unit" &&
    !!getUnitContentQuantity(product) &&
    !!getUnitContentUnit(product)
  );
}

function getEffectiveStockUnit(
  product: StockProduct | null | undefined,
): StockUnit {
  if (hasUnitContent(product)) {
    return getUnitContentUnit(product) ?? "unit";
  }

  return (product?.stockUnit ?? "unit") as StockUnit;
}

function getEffectiveStockQuantity(
  product: StockProduct | null | undefined,
): number {
  const stockQuantity = Number(product?.stockQuantity ?? 0);

  if (!Number.isFinite(stockQuantity)) return stockQuantity;

  if (hasUnitContent(product)) {
    return stockQuantity * (getUnitContentQuantity(product) ?? 1);
  }

  return stockQuantity;
}

function convertQuantityBetweenUnits(
  quantity: number,
  fromUnit?: StockUnit | null,
  toUnit?: StockUnit | null,
): number | null {
  const sourceUnit = fromUnit ?? toUnit ?? "unit";
  const targetUnit = toUnit ?? sourceUnit;

  if (!Number.isFinite(quantity)) return quantity;
  if (getUnitFamily(sourceUnit) !== getUnitFamily(targetUnit)) return null;

  const baseQuantity = normalizeQuantity(quantity, sourceUnit);
  if (!Number.isFinite(baseQuantity)) return null;

  return denormalizeQuantity(baseQuantity, targetUnit);
}

function getRequirementStockInfo(
  item: RecipeAnalysisResponse["flatRequirements"][number] | any,
  products: StockProduct[],
): {
  isUnlimited: boolean;
  availableInRequiredUnit: number;
  requiredUnit: StockUnit | null;
  display: string;
} {
  const product = products.find((p) => p.id === item.ingredientProductId);
  const requiredUnit = (item.unit ?? product?.stockUnit ?? item.stockUnit ?? "unit") as StockUnit;

  if (product?.unlimitedStock || item.isUnlimited) {
    return {
      isUnlimited: true,
      availableInRequiredUnit: Number.POSITIVE_INFINITY,
      requiredUnit,
      display: "∞",
    };
  }

  if (product) {
    const stockQuantity = Number(product.stockQuantity ?? 0);
    const stockUnit = hasUnitContent(product)
      ? getEffectiveStockUnit(product)
      : ((product.stockUnit ?? requiredUnit) as StockUnit);
    const effectiveStockQuantity = hasUnitContent(product)
      ? getEffectiveStockQuantity(product)
      : stockQuantity;

    const availableInRequiredUnit =
      convertQuantityBetweenUnits(effectiveStockQuantity, stockUnit, requiredUnit) ??
      effectiveStockQuantity;

    const rawDisplay = hasUnitContent(product)
      ? formatStockQuantityWithUnitContent(product)
      : formatQtyUnit(stockQuantity, product.stockUnit ?? requiredUnit);

    const shouldShowConverted =
      getUnitFamily(stockUnit) === getUnitFamily(requiredUnit) &&
      stockUnit !== requiredUnit &&
      Number.isFinite(availableInRequiredUnit);

    return {
      isUnlimited: false,
      availableInRequiredUnit,
      requiredUnit,
      display: shouldShowConverted
        ? rawDisplay + " (" + formatQtyUnit(availableInRequiredUnit, requiredUnit) + ")"
        : rawDisplay,
    };
  }

  const fallbackAvailable = Number(item.stockAvailable ?? 0);
  const fallbackUnit = (item.stockUnit ?? requiredUnit) as StockUnit;
  const availableInRequiredUnit =
    convertQuantityBetweenUnits(fallbackAvailable, fallbackUnit, requiredUnit) ??
    fallbackAvailable;

  return {
    isUnlimited: false,
    availableInRequiredUnit,
    requiredUnit,
    display:
      fallbackUnit !== requiredUnit && Number.isFinite(availableInRequiredUnit)
        ? formatQtyUnit(fallbackAvailable, fallbackUnit) + " (" + formatQtyUnit(availableInRequiredUnit, requiredUnit) + ")"
        : formatQtyUnit(fallbackAvailable, requiredUnit),
  };
}

function formatUnitContent(product: StockProduct | null | undefined) {
  if (!hasUnitContent(product)) return null;

  return `1 un. = ${formatQtyUnit(getUnitContentQuantity(product) ?? 0, getUnitContentUnit(product))}`;
}

function formatStockQuantityWithUnitContent(product: StockProduct) {
  const base = formatQtyUnit(
    Number(product.stockQuantity ?? 0),
    product.stockUnit ?? "unit",
  );

  if (!hasUnitContent(product)) return base;

  return `${base} (${formatQtyUnitCompact(
    getEffectiveStockQuantity(product),
    getEffectiveStockUnit(product),
  )})`;
}

function formatStockUnitWithUnitContent(product: StockProduct) {
  const base = product.stockUnit ?? "-";

  if (!hasUnitContent(product)) return base;

  return `${base}/${formatQtyUnitCompact(
    getUnitContentQuantity(product) ?? 0,
    getUnitContentUnit(product),
  )}`;
}

function getDisplayStockAvailableForRequirement(
  item: RecipeAnalysisResponse["flatRequirements"][number],
  products: StockProduct[],
) {
  return getRequirementStockInfo(item, products).display;
}

function getDisplayMissingQuantityForRequirement(
  quantity: number | null | undefined,
  unit?: StockUnit | null,
) {
  return formatQtyUnit(Number(quantity ?? 0), unit ?? "unit");
}

function getRequirementMissingQuantity(
  item: RecipeAnalysisResponse["flatRequirements"][number] | any,
  requiredQuantityOverride?: number,
  products?: StockProduct[],
) {
  const requiredQuantity = Number(requiredQuantityOverride ?? item?.requiredQuantity ?? 0);

  if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return 0;

  if (products?.length) {
    const stockInfo = getRequirementStockInfo(item, products);
    if (stockInfo.isUnlimited || !Number.isFinite(stockInfo.availableInRequiredUnit)) return 0;
    return Math.max(0, requiredQuantity - stockInfo.availableInRequiredUnit);
  }

  const explicitMissing = Number(item?.missingQuantity ?? 0);

  if (requiredQuantityOverride == null && Number.isFinite(explicitMissing) && explicitMissing > 0) {
    return explicitMissing;
  }

  return getMissingQuantityInRequiredUnit({
    requiredQuantity,
    requiredUnit: item?.unit ?? null,
    stockAvailable: item?.stockAvailable ?? null,
    stockUnit: item?.stockUnit ?? item?.unit ?? null,
  });
}

function hasEnoughRequirementStock(
  item: RecipeAnalysisResponse["flatRequirements"][number] | any,
  products: StockProduct[],
  requiredQuantityOverride?: number,
) {
  if (item.isUnlimited) return true;

  const requiredQuantity = Number(requiredQuantityOverride ?? item.requiredQuantity ?? 0);
  if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return true;

  const stockInfo = getRequirementStockInfo(item, products);
  if (stockInfo.isUnlimited || !Number.isFinite(stockInfo.availableInRequiredUnit)) return true;

  return stockInfo.availableInRequiredUnit + 0.000001 >= requiredQuantity;
}

function hasEnoughStock(
  requiredQuantity: number,
  requiredUnit?: StockUnit | null,
  stockAvailable?: number,
  stockUnit?: StockUnit | null,
) {
  if (stockAvailable == null) return false;
  if (!Number.isFinite(stockAvailable)) return true;

  const requiredFamily = getUnitFamily(requiredUnit);
  const stockFamily = getUnitFamily(stockUnit ?? requiredUnit);

  if (requiredFamily !== stockFamily) return false;

  return (
    normalizeQuantity(stockAvailable, stockUnit ?? requiredUnit) + 0.000001 >=
    normalizeQuantity(requiredQuantity, requiredUnit)
  );
}

function hasMissingQuantity(value?: number | null) {
  return (value ?? 0) > 0.000001;
}

function isBuyableStockProduct(product: StockProduct | null | undefined) {
  return (
    !!product &&
    (product as any).active !== false &&
    product.trackStock === true &&
    product.unlimitedStock !== true &&
    product.madeOnDemand !== true &&
    product.costMode !== "recipe" &&
    !(product.hasRecipe === true) &&
    !((product as any).recipeItems?.length > 0)
  );
}

function isWholeNumberStockUnit(product: StockProduct | null | undefined) {
  return (product?.stockUnit ?? "unit") === "unit";
}

function normalizeBuyQuantityForProduct(
  product: StockProduct,
  quantity: number,
) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;

  if (isWholeNumberStockUnit(product)) {
    return Math.max(1, Math.ceil(quantity - 0.000001));
  }

  return quantity;
}

function getBuyQuantityInputStep(product: StockProduct | null | undefined) {
  return isWholeNumberStockUnit(product) ? "1" : "0.01";
}

function getBuyQuantityInputMin(product: StockProduct | null | undefined) {
  return isWholeNumberStockUnit(product) ? "1" : "0.01";
}

function convertRequirementQuantityToBuyQuantity(
  product: StockProduct,
  requiredQuantity: number,
  requiredUnit?: StockUnit | null,
) {
  if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return 0;

  const productStockUnit = (product.stockUnit ?? "unit") as StockUnit;

  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 1;
    const contentUnit = getUnitContentUnit(product);

    if (getUnitFamily(requiredUnit) === getUnitFamily(contentUnit)) {
      const requiredBase = normalizeQuantity(requiredQuantity, requiredUnit);
      const contentBase = normalizeQuantity(contentQuantity, contentUnit);

      if (
        Number.isFinite(requiredBase) &&
        Number.isFinite(contentBase) &&
        contentBase > 0
      ) {
        return normalizeBuyQuantityForProduct(product, requiredBase / contentBase);
      }
    }
  }

  if (getUnitFamily(requiredUnit) !== getUnitFamily(productStockUnit)) {
    return normalizeBuyQuantityForProduct(product, requiredQuantity);
  }

  const requiredBase = normalizeQuantity(requiredQuantity, requiredUnit);

  if (productStockUnit === "l" || productStockUnit === "kg") {
    return normalizeBuyQuantityForProduct(product, requiredBase / 1000);
  }

  return normalizeBuyQuantityForProduct(product, requiredBase);
}

function getMissingQuantityToMinimum(product: StockProduct) {
  if (!isBuyableStockProduct(product)) return 0;

  const stockQuantity = Number(product.stockQuantity ?? 0);
  const minStock = Number(product.minStock ?? 0);

  if (!Number.isFinite(stockQuantity)) return 0;

  if (Number.isFinite(minStock) && minStock > 0) {
    return Math.max(0, minStock - stockQuantity);
  }

  return stockQuantity <= 0 ? 1 : 0;
}

function getRecipeProductionShortage(product: StockProduct) {
  const expectedYield = Number(product.expectedYield ?? 0);
  const minStock = Number(product.minStock ?? 0);

  if (Number.isFinite(minStock) && minStock > 0) {
    return Math.max(0, minStock - (Number.isFinite(expectedYield) ? expectedYield : 0));
  }

  return Number.isFinite(expectedYield) && expectedYield <= 0 ? 1 : 0;
}

function getRecipeRequirementMultiplier(params: {
  recipeProduct: StockProduct;
  analysis: RecipeAnalysisResponse;
}) {
  const { recipeProduct, analysis } = params;
  const shortage = getRecipeProductionShortage(recipeProduct);
  const targetOutput = shortage > 0 ? shortage : 1;
  const outputQuantity = Number(
    analysis.outputQuantity ?? recipeProduct.recipeOutputQuantity ?? 1,
  );

  if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) return targetOutput;

  return Math.max(1, targetOutput / outputQuantity);
}

function getRecipeTargetOutputQuantity(product: StockProduct) {
  const minStock = Number(product.minStock ?? 0);

  if (Number.isFinite(minStock) && minStock > 0) return minStock;

  const expectedYield = Number(product.expectedYield ?? 0);
  if (Number.isFinite(expectedYield) && expectedYield <= 0) return 1;

  return 1;
}

function getRecipeOutputQuantity(product: StockProduct) {
  const outputQuantity = Number(product.recipeOutputQuantity ?? 1);
  return Number.isFinite(outputQuantity) && outputQuantity > 0 ? outputQuantity : 1;
}

function getRecipeOutputUnit(product: StockProduct): StockUnit {
  return (product.recipeOutputUnit ?? product.stockUnit ?? "unit") as StockUnit;
}

function getStockAvailableInUnit(product: StockProduct, unit?: StockUnit | null) {
  if (product.unlimitedStock) return Number.POSITIVE_INFINITY;

  const targetUnit = (unit ?? getEffectiveStockUnit(product)) as StockUnit;
  const sourceUnit = getEffectiveStockUnit(product);
  const effectiveQuantity = getEffectiveStockQuantity(product);

  if (!Number.isFinite(effectiveQuantity)) return effectiveQuantity;

  const converted = convertQuantityBetweenUnits(effectiveQuantity, sourceUnit, targetUnit);
  return converted ?? effectiveQuantity;
}

function getRequirementMissingFromRealStock(params: {
  ingredient: StockProduct;
  requiredQuantity: number;
  requiredUnit?: StockUnit | null;
}) {
  const { ingredient, requiredQuantity, requiredUnit } = params;

  if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return 0;
  if (ingredient.unlimitedStock) return 0;

  const available = getStockAvailableInUnit(ingredient, requiredUnit);
  if (!Number.isFinite(available)) return 0;

  return Math.max(0, requiredQuantity - available);
}

function getRecipeMultiplierForTargetOutput(params: {
  recipeProduct: StockProduct;
  targetOutputQuantity: number;
  targetOutputUnit?: StockUnit | null;
}) {
  const { recipeProduct, targetOutputQuantity, targetOutputUnit } = params;
  const outputQuantity = getRecipeOutputQuantity(recipeProduct);
  const outputUnit = getRecipeOutputUnit(recipeProduct);

  if (!Number.isFinite(targetOutputQuantity) || targetOutputQuantity <= 0) return 1;

  const convertedTarget = convertQuantityBetweenUnits(
    targetOutputQuantity,
    targetOutputUnit ?? outputUnit,
    outputUnit,
  );

  const target = convertedTarget ?? targetOutputQuantity;
  if (!Number.isFinite(target) || target <= 0 || outputQuantity <= 0) return 1;

  return target / outputQuantity;
}


function convertRecipeQuantityToStockMovementQuantity(params: {
  product: StockProduct;
  quantity: number;
  unit?: StockUnit | null;
}) {
  const { product, quantity, unit } = params;

  if (!Number.isFinite(quantity)) return quantity;

  const stockUnit = (product.stockUnit ?? "unit") as StockUnit;

  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 1;
    const contentUnit = getUnitContentUnit(product);

    if (contentUnit && getUnitFamily(unit) === getUnitFamily(contentUnit)) {
      const requiredBase = normalizeQuantity(quantity, unit);
      const contentBase = normalizeQuantity(contentQuantity, contentUnit);

      if (Number.isFinite(requiredBase) && Number.isFinite(contentBase) && contentBase > 0) {
        return requiredBase / contentBase;
      }
    }
  }

  if (getUnitFamily(unit) !== getUnitFamily(stockUnit)) {
    return quantity;
  }

  const converted = convertQuantityBetweenUnits(quantity, unit, stockUnit);
  return converted ?? quantity;
}

function getVariationOptionPossibleOutputQuantity(params: {
  recipeProduct: StockProduct;
  option: ProductVariationOption;
  products: StockProduct[];
}) {
  const { recipeProduct, option, products } = params;
  const recipeItems = (option.recipeItems ?? []) as ProductRecipeItem[];

  if (recipeItems.length === 0) return Number.POSITIVE_INFINITY;

  let maxRecipeBatches = Number.POSITIVE_INFINITY;

  for (const recipeItem of recipeItems) {
    const ingredientProductId =
      (recipeItem as any).ingredientProductId ??
      (recipeItem as any).ingredientId ??
      (recipeItem as any).productId;
    const requiredQuantity = Number(recipeItem.quantity ?? 0);
    const requiredUnit = (recipeItem.unit ?? "unit") as StockUnit;

    if (!ingredientProductId || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
      continue;
    }

    const ingredient = products.find((product) => product.id === ingredientProductId);
    if (!ingredient) {
      maxRecipeBatches = 0;
      continue;
    }

    if (ingredient.unlimitedStock) continue;

    const available = getStockAvailableInUnit(ingredient, requiredUnit);
    if (!Number.isFinite(available)) continue;

    maxRecipeBatches = Math.min(maxRecipeBatches, available / requiredQuantity);
  }

  if (!Number.isFinite(maxRecipeBatches)) return Number.POSITIVE_INFINITY;

  return Math.max(0, maxRecipeBatches * getRecipeOutputQuantity(recipeProduct));
}

function getMandatoryVariationProductionLimit(
  product: StockProduct,
  products: StockProduct[],
): number | null {
  let limit = Number.POSITIVE_INFINITY;

  for (const group of product.variationGroups ?? []) {
    if (!group.required) continue;

    const options = (group.options ?? []).filter((option: any) => option.active !== false);
    if (options.length === 0) continue;

    const optionLimits = options.map((option) =>
      getVariationOptionPossibleOutputQuantity({
        recipeProduct: product,
        option,
        products,
      }),
    );

    const finiteOptionLimits = optionLimits.filter((value) => Number.isFinite(value));
    if (finiteOptionLimits.length === 0) continue;

    const groupLimit =
      group.selectionType === "single"
        ? Math.max(...finiteOptionLimits)
        : Math.min(...finiteOptionLimits);

    limit = Math.min(limit, groupLimit);
  }

  return Number.isFinite(limit) ? Math.max(0, limit) : null;
}

function getPossibleProductionConsideringVariations(
  product: StockProduct,
  products: StockProduct[] = [],
) {
  const basePossible = Number(product.expectedYield ?? 0);
  const variationLimit = getMandatoryVariationProductionLimit(product, products);

  if (variationLimit == null) {
    return Number.isFinite(basePossible) ? basePossible : 0;
  }

  if (!Number.isFinite(basePossible) || basePossible <= 0) {
    return variationLimit;
  }

  return Math.min(basePossible, variationLimit);
}

function getRecipeItemStockAlertStatus(
  recipeItem: ProductRecipeItem | any,
  products: StockProduct[] = [],
): "ok" | "low" | "zero" | "unknown" {
  const ingredientProductId =
    recipeItem?.ingredientProductId ??
    recipeItem?.ingredientId ??
    recipeItem?.productId;
  const requiredQuantity = Number(recipeItem?.quantity ?? 0);

  if (!ingredientProductId || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
    return "ok";
  }

  const ingredient = products.find((item) => item.id === ingredientProductId);

  if (!ingredient) return "unknown";
  if (ingredient.unlimitedStock) return "ok";
  if (ingredient.madeOnDemand || !ingredient.trackStock) return "unknown";

  const requiredUnit = (recipeItem?.unit ?? getEffectiveStockUnit(ingredient)) as StockUnit;
  const available = getStockAvailableInUnit(ingredient, requiredUnit);

  if (!Number.isFinite(available)) return "unknown";
  if (available <= 0.000001) return "zero";
  if (available + 0.000001 < requiredQuantity) return "low";

  const stockQuantity = Number(ingredient.stockQuantity ?? 0);
  const minStock = Number(ingredient.minStock ?? 0);

  if (
    Number.isFinite(stockQuantity) &&
    Number.isFinite(minStock) &&
    minStock > 0 &&
    stockQuantity <= minStock
  ) {
    return "low";
  }

  return "ok";
}

function combineRecipeAlertStatus(
  current: "ok" | "low" | "zero" | "unknown",
  next: "ok" | "low" | "zero" | "unknown",
) {
  if (current === "zero" || next === "zero") return "zero";
  if (current === "low" || next === "low") return "low";
  if (current === "unknown" || next === "unknown") return "unknown";
  return "ok";
}

function getRecipeIngredientStockAlertStatus(
  product: StockProduct,
  products: StockProduct[] = [],
): "ok" | "low" | "zero" | "unknown" {
  if (products.length === 0) return "ok";

  let baseStatus: "ok" | "low" | "zero" | "unknown" = "ok";

  const productRecipeItems =
    ((product as StockProductWithRecipeItems).recipeItems ?? []) as ProductRecipeItem[];

  for (const recipeItem of productRecipeItems) {
    baseStatus = combineRecipeAlertStatus(
      baseStatus,
      getRecipeItemStockAlertStatus(recipeItem, products),
    );
  }

  // Required variations are different from the base recipe:
  // if one flavor/option ingredient is missing, the product may still be possible
  // through another option, but the stock page must still warn instead of showing OK.
  let variationStatus: "ok" | "low" | "zero" | "unknown" = "ok";

  for (const group of product.variationGroups ?? []) {
    if (!group.required) continue;

    const options = (group.options ?? []).filter((option: any) => option.active !== false);
    if (options.length === 0) {
      variationStatus = combineRecipeAlertStatus(variationStatus, "unknown");
      continue;
    }

    let groupHasAnyRecipeItem = false;
    let groupHasAvailableOption = false;
    let groupHasAlert = false;
    let groupHasUnknown = false;

    for (const option of options) {
      const optionRecipeItems = (option.recipeItems ?? []) as ProductRecipeItem[];

      if (optionRecipeItems.length === 0) {
        groupHasAvailableOption = true;
        continue;
      }

      groupHasAnyRecipeItem = true;
      let optionStatus: "ok" | "low" | "zero" | "unknown" = "ok";

      for (const recipeItem of optionRecipeItems) {
        optionStatus = combineRecipeAlertStatus(
          optionStatus,
          getRecipeItemStockAlertStatus(recipeItem, products),
        );
      }

      if (optionStatus === "ok") {
        groupHasAvailableOption = true;
      } else {
        groupHasAlert = true;
      }

      if (optionStatus === "unknown") {
        groupHasUnknown = true;
      }
    }

    if (!groupHasAnyRecipeItem) continue;

    if (!groupHasAvailableOption) {
      variationStatus = combineRecipeAlertStatus(
        variationStatus,
        groupHasUnknown ? "unknown" : "zero",
      );
      continue;
    }

    if (groupHasAlert) {
      variationStatus = combineRecipeAlertStatus(variationStatus, "low");
    }
  }

  if (baseStatus === "zero") return "zero";
  if (variationStatus === "zero") return "zero";
  if (baseStatus === "low" || variationStatus === "low") return "low";
  if (baseStatus === "unknown" || variationStatus === "unknown") return "unknown";
  return "ok";
}

function isRecipeStockProduct(product: StockProduct | null | undefined) {
  return !!product && (product.hasRecipe || product.costMode === "recipe");
}

function canManuallyProduceProduct(product: StockProduct | null | undefined) {
  return (
    isRecipeStockProduct(product) &&
    product?.madeOnDemand !== true &&
    product?.unlimitedStock !== true &&
    product?.trackStock === true
  );
}

function parsePositiveNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return 0;

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeProducedQuantityForProduct(
  product: StockProduct | null | undefined,
  quantity: number,
) {
  if (!product || !Number.isFinite(quantity) || quantity <= 0) return 0;

  const outputUnit = getRecipeOutputUnit(product);

  if (outputUnit === "unit") {
    return Math.max(1, Math.ceil(quantity - 0.000001));
  }

  return quantity;
}

function getProduceQuantityInputStep(product: StockProduct | null | undefined) {
  if (!product) return "0.001";
  return getRecipeOutputUnit(product) === "unit" ? "1" : "0.001";
}

function getProduceQuantityInputMin(product: StockProduct | null | undefined) {
  if (!product) return "0.001";
  return getRecipeOutputUnit(product) === "unit" ? "1" : "0.001";
}

function getProduceTargetQuantity(params: {
  product: StockProduct | null | undefined;
  mode: ProduceQuantityMode;
  recipeBatches: string;
  customQuantity: string;
}) {
  const { product, mode, recipeBatches, customQuantity } = params;

  if (!product) return 0;

  if (mode === "recipes") {
    const batches = Math.max(1, Math.ceil(parsePositiveNumber(recipeBatches) || 1));
    return normalizeProducedQuantityForProduct(
      product,
      getRecipeOutputQuantity(product) * batches,
    );
  }

  return normalizeProducedQuantityForProduct(
    product,
    parsePositiveNumber(customQuantity),
  );
}

type ProductionStockShortage = {
  ingredientProductId: string;
  ingredientName: string;
  requiredQuantity: number;
  requiredUnit: StockUnit | null;
  missingQuantity: number;
  stockDisplay: string;
};

function getProductionStockShortages(
  preview: RecipeCalculatorResponse | null | undefined,
  products: StockProduct[],
): ProductionStockShortage[] {
  if (!preview) return [];

  return (preview.directRequirements ?? []).flatMap((item) => {
    if ((item as any).isUnlimited) return [];

    const requiredQuantity = Number((item as any).requiredQuantity ?? 0);
    if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return [];

    const missingQuantity = getRequirementMissingQuantity(item, requiredQuantity, products);
    if (!Number.isFinite(missingQuantity) || missingQuantity <= 0.000001) return [];

    return [
      {
        ingredientProductId: (item as any).ingredientProductId,
        ingredientName: (item as any).ingredientName ?? "Ingrediente",
        requiredQuantity,
        requiredUnit: ((item as any).unit ?? null) as StockUnit | null,
        missingQuantity,
        stockDisplay: getDisplayStockAvailableForRequirement(
          item as RecipeAnalysisResponse["flatRequirements"][number],
          products,
        ),
      },
    ];
  });
}


function getActiveVariationOptionRecipeItems(product: StockProductWithRecipeItems) {
  const items: Array<{
    optionName: string;
    ingredientProductId: string;
    quantity: number;
    unit: StockUnit;
  }> = [];

  for (const group of product.variationGroups ?? []) {
    if (!group.required) continue;

    const options = (group.options ?? []).filter((option: any) => option.active !== false);

    for (const option of options) {
      for (const recipeItem of option.recipeItems ?? []) {
        const ingredientProductId =
          (recipeItem as any).ingredientProductId ??
          (recipeItem as any).ingredientId ??
          (recipeItem as any).productId;
        const quantity = Number((recipeItem as any).quantity ?? 0);
        const unit = ((recipeItem as any).unit ?? "unit") as StockUnit;

        if (!ingredientProductId || !Number.isFinite(quantity) || quantity <= 0) {
          continue;
        }

        items.push({
          optionName: option.name,
          ingredientProductId,
          quantity,
          unit,
        });
      }
    }
  }

  return items;
}

function toEditableStockItem(): EditableStockItem {
  return {
    name: "",
    emoji: "📦",
    categoryId: null,
    price: 0,
    isStockOnly: true,
    trackStock: true,
    stockQuantity: 0,
    minStock: 0,
    costMode: "simple",
    simpleCost: null,
    stockUnit: "unit",
    referenceQuantity: null,
    referenceCost: null,
    unitContentQuantity: null,
    unitContentUnit: "ml",
    madeOnDemand: false,
    unlimitedStock: false,
    recipeOutputQuantity: null,
    recipeOutputUnit: "unit",
    recipeItems: [],
    variationGroups: [],
  };
}

function getCostLabel(product: StockProduct): string {
  if (product.costMode === "recipe") return "Receita";
  return "Simples";
}

function getCostDisplay(product: StockProduct): string | null {
  if (product.costMode === "recipe") {
    if (product.recipeCost == null) return null;

    if (
      product.recipeOutputQuantity != null &&
      product.recipeOutputUnit &&
      product.recipeOutputUnit !== "unit"
    ) {
      return `${formatBRL(product.recipeCost)} / ${product.recipeOutputQuantity} ${product.recipeOutputUnit}`;
    }

    if (
      product.recipeOutputQuantity != null &&
      product.recipeOutputUnit === "unit" &&
      product.recipeOutputQuantity !== 1
    ) {
      return `${formatBRL(product.recipeCost)} / ${product.recipeOutputQuantity}`;
    }

    return formatBRL(product.recipeCost);
  }

  const simple = product.referenceCost ?? product.simpleCost ?? null;
  if (simple == null) return null;

  if (product.referenceQuantity != null && product.stockUnit) {
    const content = formatUnitContent(product);
    const referenceLabel = `${formatBRL(simple)} / ${product.referenceQuantity} ${product.stockUnit}`;
    return content ? `${referenceLabel} (${content})` : referenceLabel;
  }

  return formatBRL(simple);
}

function getSubtitle(product: StockProduct): string | null {
  const price = Number(product.price ?? 0);
  if (price <= 0) return null;

  return formatBRL(price);
}

function getDisplayCost(product: StockProduct): number | null {
  if (product.costMode === "recipe") {
    const recipeCost = Number(product.recipeCost ?? 0);
    const outputQuantity = Number(product.recipeOutputQuantity ?? 1);
    const outputUnit = product.recipeOutputUnit ?? "unit";

    if (
      !Number.isFinite(recipeCost) ||
      recipeCost <= 0 ||
      !Number.isFinite(outputQuantity) ||
      outputQuantity <= 0
    ) {
      return null;
    }

    if (outputUnit === "unit") {
      return recipeCost / outputQuantity;
    }

    return recipeCost;
  }

  const totalCost = Number(product.referenceCost ?? product.simpleCost ?? 0);
  const referenceQuantity = Number(product.referenceQuantity ?? 1);

  if (
    !Number.isFinite(totalCost) ||
    totalCost <= 0 ||
    !Number.isFinite(referenceQuantity) ||
    referenceQuantity <= 0
  ) {
    return null;
  }

  if (hasUnitContent(product) || (product.stockUnit ?? "unit") === "unit") {
    return totalCost / referenceQuantity;
  }

  return totalCost;
}

function getDisplayCostWithUnitContent(product: StockProduct): number | null {
  return getDisplayCost(product);
}

function getRequiredVariationAverageCostForProfit(
  product: StockProduct,
  products: StockProduct[],
) {
  return (product.variationGroups ?? []).reduce((sum: number, group: any) => {
    if (!group.required) return sum;

    const options = group.options ?? [];
    if (options.length === 0) return sum;

    const totalOptionsCost = options.reduce(
      (optionSum: number, option: any) => {
        return (
          optionSum +
          getVariationOptionRecipeCost({
            option,
            products,
            selectedRootProductId: product.id,
            rootAnalysis: null,
            nestedRecipeAnalyses: {},
          })
        );
      },
      0,
    );

    return sum + totalOptionsCost / options.length;
  }, 0);
}

function getRequiredVariationAveragePriceForProfit(product: StockProduct) {
  return (product.variationGroups ?? []).reduce((sum: number, group: any) => {
    if (!group.required) return sum;

    const options = group.options ?? [];
    if (options.length === 0) return sum;

    const totalOptionsPrice = options.reduce(
      (optionSum: number, option: any) =>
        optionSum + Number(option.priceModifier ?? 0),
      0,
    );

    return sum + totalOptionsPrice / options.length;
  }, 0);
}

function getProfitPercentage(
  product: StockProduct,
  products: StockProduct[],
): number | null {
  if (product.isStockOnly) return null;

  const baseCost = getDisplayCost(product);
  const price = Number(product.price ?? 0);

  if (baseCost == null || baseCost <= 0 || price <= 0) return null;

  const finalCost =
    baseCost + getRequiredVariationAverageCostForProfit(product, products);

  const finalPrice = price + getRequiredVariationAveragePriceForProfit(product);

  if (finalCost <= 0 || finalPrice <= 0) return null;

  const profitAmount = finalPrice - finalCost;

  return (profitAmount / finalPrice) * 100;
}

function getProfitStatus(
  product: StockProduct,
  products: StockProduct[],
  warningThreshold: number,
): "good" | "warning" | "negative" | "no_profit" {
  const profit = getProfitPercentage(product, products);

  if (product.isStockOnly || profit == null) return "no_profit";
  if (profit < 0) return "negative";
  if (profit < warningThreshold) return "warning";
  return "good";
}

function getRecipeItemVisualStatus(
  item: RecipeAnalysisResponse["flatRequirements"][number],
  products: StockProduct[] = [],
) {
  const enough = products.length
    ? hasEnoughRequirementStock(item, products)
    : item.isUnlimited ||
      hasEnoughStock(
        item.requiredQuantity,
        item.unit,
        item.stockAvailable,
        item.stockUnit ?? item.unit,
      );

  if (item.isUnlimited) {
    return {
      label: "Infinito",
      cardClass: "border-primary/30 bg-primary/5",
      badgeClass: "bg-primary/15 text-primary border border-primary/30",
      enough: true,
    };
  }

  if (enough) {
    return {
      label: "Em estoque",
      cardClass: "border-success/30 bg-success/5",
      badgeClass: "bg-success/15 text-success border border-success/30",
      enough: true,
    };
  }

  return {
    label: "Atenção",
    cardClass: "border-warning/30 bg-warning/5",
    badgeClass: "bg-warning/15 text-warning border border-warning/30",
    enough: false,
  };
}

function getProductBaseUnitCostShared(
  product: StockProduct,
  analysis?: RecipeAnalysisResponse | null,
): {
  unitCost: number;
  unit: StockUnit | null;
} | null {
  if (product.costMode === "recipe" || product.hasRecipe) {
    const totalCost = product.recipeCost ?? analysis?.recipeCost ?? null;
    const outputQuantity =
      product.recipeOutputQuantity ?? analysis?.outputQuantity ?? null;
    const outputUnit =
      product.recipeOutputUnit ??
      analysis?.outputUnit ??
      product.stockUnit ??
      "unit";

    if (
      totalCost == null ||
      outputQuantity == null ||
      outputQuantity <= 0 ||
      !Number.isFinite(totalCost) ||
      !Number.isFinite(outputQuantity)
    ) {
      return null;
    }

    const normalizedOutput = normalizeQuantity(outputQuantity, outputUnit);
    if (!Number.isFinite(normalizedOutput) || normalizedOutput <= 0) {
      return null;
    }

    return {
      unitCost: totalCost / normalizedOutput,
      unit: outputUnit,
    };
  }

  const totalCost = product.referenceCost ?? product.simpleCost ?? null;
  const rawReferenceQuantity =
    product.referenceQuantity ??
    (product.stockUnit === "unit" || !product.stockUnit ? 1 : null);

  if (
    totalCost == null ||
    rawReferenceQuantity == null ||
    rawReferenceQuantity <= 0 ||
    !Number.isFinite(totalCost) ||
    !Number.isFinite(rawReferenceQuantity)
  ) {
    return null;
  }

  const unit = getEffectiveStockUnit(product);

  let referenceQuantity = rawReferenceQuantity;

  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 1;

    // New meaning: referenceQuantity = how many stock units were bought.
    // Example: 1 un. costs R$16 and 1 un. = 910 ml => 16 / 910.
    // Compatibility: if older data stored 910 as referenceQuantity, treat it
    // as content quantity instead of 910 units.
    const looksLikeOldContentReference =
      Math.abs(rawReferenceQuantity - contentQuantity) < 0.000001;

    referenceQuantity = looksLikeOldContentReference
      ? rawReferenceQuantity
      : rawReferenceQuantity * contentQuantity;
  }

  const normalizedQuantity = normalizeQuantity(referenceQuantity, unit);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return null;
  }

  return {
    unitCost: totalCost / normalizedQuantity,
    unit,
  };
}

type RecipeFlowNodeData = {
  nodeKey: string;
  productId?: string;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeClassName?: string;
  selected?: boolean;
  warning?: boolean;
  canExpand?: boolean;
  isExpanded?: boolean;
  isCollapsing?: boolean;
  onSelect?: () => void;
  onToggle?: () => void;
  depth?: number;

  kind?: "product" | "ingredient" | "variation-group" | "variation-option";
  selectedOption?: boolean;
  onToggleOption?: () => void;
};

function ActionIconButton({
  onClick,
  title,
  children,
  className = "",
  disabled = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function RecipeFlowNode({ data }: NodeProps<RecipeFlowNodeData>) {
  return (
    <div
      onClick={data.onSelect}
      className={`relative min-w-65 max-w-65 rounded-2xl border bg-card p-4 text-left shadow-sm cursor-pointer hover:shadow-md
        ${data.isCollapsing ? "animate-[recipeNodeOut_180ms_ease-in]" : "animate-[recipeNodeIn_220ms_ease-out]"}
        ${data.selected ? "border-primary ring-2 ring-primary/25" : "border-border"}
        ${data.warning ? "bg-warning/5 border-warning/30" : ""}
        ${data.selectedOption ? "bg-primary/5 border-primary/40" : ""}`}
      style={{
        animationDelay: `${(data.depth ?? 0) * 40}ms`,
        animationFillMode: "both",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3! h-3! border-2! !border-background bg-primary!"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">{data.label}</p>

          {data.subtitle && (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
              {data.subtitle}
            </p>
          )}
        </div>

        {data.badge && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
              data.badgeClassName ?? "bg-secondary text-secondary-foreground"
            }`}
          >
            {data.badge}
          </span>
        )}
      </div>

      {data.kind === "variation-option" && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleOption?.();
            }}
            className={`h-8 px-3 rounded-lg border text-xs font-medium ${
              data.selectedOption
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-secondary"
            }`}
          >
            {data.selectedOption ? "Selecionada" : "Selecionar"}
          </button>
        </div>
      )}

      {data.canExpand && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggle?.();
            }}
            className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-medium"
          >
            {data.isExpanded ? "Recolher composição" : "Expandir composição"}
          </button>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-background !bg-primary"
      />
    </div>
  );
}

const recipeNodeTypes = {
  recipeNode: RecipeFlowNode,
};

const FLOW_NODE_WIDTH = 260;
const FLOW_HORIZONTAL_GAP = 70;
const FLOW_VERTICAL_GAP = 240;

type RecipeRequirement = RecipeAnalysisResponse["flatRequirements"][number];

function measureRecipeBranchWidth(
  item: RecipeRequirement,
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>,
  expandedRecipeNodes: Record<string, boolean>,
): number {
  const nested = nestedRecipeAnalyses[item.ingredientProductId];
  const isExpanded =
    item.isRecipe && expandedRecipeNodes[item.ingredientProductId] && !!nested;

  if (!isExpanded) return FLOW_NODE_WIDTH;

  const childWidths = nested.flatRequirements.map((child) =>
    measureRecipeBranchWidth(child, nestedRecipeAnalyses, expandedRecipeNodes),
  );

  const childrenTotalWidth =
    childWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, childWidths.length - 1) * FLOW_HORIZONTAL_GAP;

  return Math.max(FLOW_NODE_WIDTH, childrenTotalWidth);
}

function buildRecipeFlowGraph(params: {
  selectedProduct: StockProduct;
  recipeAnalysis: RecipeAnalysisResponse;
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>;
  expandedRecipeNodes: Record<string, boolean>;
  collapsingRecipeNodes: Record<string, boolean>;
  selectedRecipeItemId: string | null;
  getFractionCostLabel: (item: RecipeRequirement) => string | null;
  onSelectNode: (productId: string) => void;
  onToggleNode: (nodeKey: string, productId: string) => void;
  selectedVariationOptions: Record<string, string[]>;
  onToggleVariationOption: (
    group: ProductVariationGroup,
    option: ProductVariationOption,
  ) => void;
  currentRecipeTotalCost: number;
  selectedVariationExtraCost: number;
  getVariationOptionCost: (option: ProductVariationOption) => number;
  products: StockProduct[];
}): { nodes: Node<RecipeFlowNodeData>[]; edges: Edge[] } {
  const {
    selectedProduct,
    recipeAnalysis,
    nestedRecipeAnalyses,
    expandedRecipeNodes,
    collapsingRecipeNodes,
    selectedRecipeItemId,
    getFractionCostLabel,
    onSelectNode,
    onToggleNode,
    selectedVariationOptions,
    onToggleVariationOption,
    currentRecipeTotalCost,
    selectedVariationExtraCost,
    getVariationOptionCost,
    products,
  } = params;

  const nodes: Node<RecipeFlowNodeData>[] = [];
  const edges: Edge[] = [];

  const rootId = `root-${selectedProduct.id}`;

  nodes.push({
    id: rootId,
    type: "recipeNode",
    position: { x: -FLOW_NODE_WIDTH / 2, y: 20 },
    data: {
      nodeKey: rootId,
      productId: selectedProduct.id,
      label: selectedProduct.name,
      subtitle:
        `Produz: ${formatQtyUnit(recipeAnalysis.outputQuantity ?? 0, recipeAnalysis.outputUnit)}\n` +
        `Custo do lote: ${formatBRL(recipeAnalysis.recipeCost)}`,
      badge: "Receita",
      badgeClassName: "bg-primary/15 text-primary border border-primary/30",
      onSelect: () => {},
      depth: 0,
    },
  });

  function measureBranchWidth(
    item: RecipeRequirement,
    nodeKey: string,
  ): number {
    const nested = nestedRecipeAnalyses[item.ingredientProductId];
    const isExpanded =
      item.isRecipe && expandedRecipeNodes[nodeKey] && !!nested;

    if (!isExpanded) return FLOW_NODE_WIDTH;

    const childWidths = nested.flatRequirements.map((child, index) =>
      measureBranchWidth(
        child,
        `${nodeKey}-${child.ingredientProductId}-${index}`,
      ),
    );

    const totalChildrenWidth =
      childWidths.reduce((sum, width) => sum + width, 0) +
      Math.max(0, childWidths.length - 1) * FLOW_HORIZONTAL_GAP;

    return Math.max(FLOW_NODE_WIDTH, totalChildrenWidth);
  }

  function addChildren(params: {
    items: RecipeRequirement[];
    parentNodeId: string;
    parentCenterX: number;
    depth: number;
    pathPrefix: string;
  }) {
    const { items, parentNodeId, parentCenterX, depth, pathPrefix } = params;
    if (items.length === 0) return;

    const widths = items.map((item, index) =>
      measureBranchWidth(
        item,
        `${pathPrefix}-${item.ingredientProductId}-${index}`,
      ),
    );

    const totalWidth =
      widths.reduce((sum, width) => sum + width, 0) +
      Math.max(0, widths.length - 1) * FLOW_HORIZONTAL_GAP;

    let cursorX = parentCenterX - totalWidth / 2;
    const rowY = 20 + depth * FLOW_VERTICAL_GAP;

    items.forEach((item, index) => {
      const nodeKey = `${pathPrefix}-${item.ingredientProductId}-${index}`;
      const branchWidth = widths[index];
      const centerX = cursorX + branchWidth / 2;
      const visual = getRecipeItemVisualStatus(item, products);
      const nested = nestedRecipeAnalyses[item.ingredientProductId];
      const isExpanded = item.isRecipe && !!expandedRecipeNodes[nodeKey];
      const isCollapsing = item.isRecipe && !!collapsingRecipeNodes[nodeKey];
      const fractionCost = getFractionCostLabel(item);

      nodes.push({
        id: nodeKey,
        type: "recipeNode",
        position: {
          x: centerX - FLOW_NODE_WIDTH / 2,
          y: rowY,
        },
        data: {
          nodeKey,
          productId: item.ingredientProductId,
          label: item.ingredientName,
          subtitle:
            `Precisa: ${formatQtyUnit(item.requiredQuantity, item.unit)}\n` +
            `Em estoque: ${getDisplayStockAvailableForRequirement(item, products)}` +
            (fractionCost ? `\nCusto usado: ${fractionCost}` : ""),
          badge: visual.label,
          badgeClassName: visual.badgeClass,
          selected: selectedRecipeItemId === item.ingredientProductId,
          warning: !visual.enough,
          canExpand: item.isRecipe,
          isExpanded,
          isCollapsing,
          onSelect: () => onSelectNode(item.ingredientProductId),
          onToggle: () => onToggleNode(nodeKey, item.ingredientProductId),
          depth,
        },
      });

      edges.push({
        id: `${parentNodeId}->${nodeKey}`,
        source: parentNodeId,
        target: nodeKey,
        type: "bezier",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: {
          strokeWidth: 2,
          stroke: "#64748b",
        },
      });

      if (item.isRecipe && isExpanded && nested) {
        addChildren({
          items: nested.flatRequirements,
          parentNodeId: nodeKey,
          parentCenterX: centerX,
          depth: depth + 1,
          pathPrefix: nodeKey,
        });
      }

      cursorX += branchWidth + FLOW_HORIZONTAL_GAP;
    });
  }

  addChildren({
    items: recipeAnalysis.flatRequirements,
    parentNodeId: rootId,
    parentCenterX: 0,
    depth: 1,
    pathPrefix: "node",
  });

  const variationGroups = selectedProduct.variationGroups ?? [];
  const variationGroupStartX = 520;
  const variationGroupY = 40;
  const variationOptionStartY = 210;
  const variationGroupGapX = 340;
  const variationOptionGapY = 180;

  variationGroups.forEach((group, groupIndex) => {
    const groupNodeId = `variation-group-${group.id}`;
    const groupX = variationGroupStartX + groupIndex * variationGroupGapX;

    nodes.push({
      id: groupNodeId,
      type: "recipeNode",
      position: { x: groupX, y: variationGroupY },
      data: {
        nodeKey: groupNodeId,
        label: group.name,
        subtitle:
          `Tipo: ${group.selectionType === "single" ? "Única" : "Múltipla"}
` + `Obrigatória: ${group.required ? "Sim" : "Não"}`,
        badge: "Variação",
        badgeClassName: "bg-secondary text-secondary-foreground",
        kind: "variation-group",
        depth: 1,
      },
    });

    edges.push({
      id: `root->${groupNodeId}`,
      source: rootId,
      target: groupNodeId,
      type: "bezier",
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2, stroke: "#64748b" },
    });
    (group.options ?? []).forEach((option, optionIndex) => {
      const optionNodeId = `variation-option-${group.id}-${option.id}`;
      const optionCost = getVariationOptionCost(option);
      const isSelected = (selectedVariationOptions[group.id] ?? []).includes(
        option.id,
      );

      nodes.push({
        id: optionNodeId,
        type: "recipeNode",
        position: {
          x: groupX,
          y: variationOptionStartY + optionIndex * variationOptionGapY,
        },
        data: {
          nodeKey: optionNodeId,
          productId: option.id,
          label: option.name,
          subtitle:
            `Extra: ${formatBRL(optionCost)}
` + `Final: ${formatBRL(recipeAnalysis.recipeCost + optionCost)}`,
          badge: isSelected ? "Ativa" : "Opção",
          badgeClassName: isSelected
            ? "bg-primary/15 text-primary border border-primary/30"
            : "bg-secondary text-secondary-foreground",
          kind: "variation-option",
          selectedOption: isSelected,
          onToggleOption: () => onToggleVariationOption(group, option),
          depth: 2,
        },
      });

      edges.push({
        id: `${groupNodeId}->${optionNodeId}`,
        source: groupNodeId,
        target: optionNodeId,
        type: "bezier",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2, stroke: "#64748b" },
      });
    });
  });

  return { nodes, edges };
}

function getVariationOptionRecipeCost(params: {
  option: ProductVariationOption;
  products: StockProduct[];
  selectedRootProductId: string | null;
  rootAnalysis: RecipeAnalysisResponse | null;
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>;
}) {
  const {
    option,
    products,
    selectedRootProductId,
    rootAnalysis,
    nestedRecipeAnalyses,
  } = params;

  const costMode = (option as any).costMode ?? "simple";

  if (costMode === "simple") {
    const referenceCost = Number(
      (option as any).referenceCost ?? (option as any).simpleCost ?? 0,
    );
    return Number.isFinite(referenceCost) && referenceCost > 0
      ? referenceCost
      : 0;
  }

  return (option.recipeItems ?? []).reduce((sum, item) => {
    const product = products.find((p) => p.id === item.ingredientProductId);
    if (!product) return sum;

    const analysis =
      selectedRootProductId === product.id
        ? rootAnalysis
        : (nestedRecipeAnalyses[product.id] ?? null);

    const costData = getProductBaseUnitCostShared(product, analysis);
    if (!costData) return sum;

    const requiredUnit = item.unit ?? costData.unit;
    const productUnit = costData.unit ?? requiredUnit;

    if (getUnitFamily(requiredUnit) !== getUnitFamily(productUnit)) {
      return sum;
    }

    const requiredBase = normalizeQuantity(item.quantity, requiredUnit);
    if (!Number.isFinite(requiredBase)) return sum;

    return sum + costData.unitCost * requiredBase;
  }, 0);
}

function getSelectedVariationExtraCost(params: {
  product: StockProduct | null;
  selectedVariationOptions: Record<string, string[]>;
  products: StockProduct[];
  selectedRootProductId: string | null;
  rootAnalysis: RecipeAnalysisResponse | null;
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>;
}) {
  const {
    product,
    selectedVariationOptions,
    products,
    selectedRootProductId,
    rootAnalysis,
    nestedRecipeAnalyses,
  } = params;

  if (!product) return 0;

  let total = 0;

  for (const group of product.variationGroups ?? []) {
    const selectedIds = selectedVariationOptions[group.id] ?? [];

    for (const option of group.options ?? []) {
      if (!selectedIds.includes(option.id)) continue;

      total += getVariationOptionRecipeCost({
        option,
        products,
        selectedRootProductId,
        rootAnalysis,
        nestedRecipeAnalyses,
      });
    }
  }

  return total;
}

function buildSelectedVariationBreakdown(params: {
  product: StockProduct | null;
  selectedVariationOptions: Record<string, string[]>;
  products: StockProduct[];
  selectedRootProductId: string | null;
  rootAnalysis: RecipeAnalysisResponse | null;
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>;
}) {
  const {
    product,
    selectedVariationOptions,
    products,
    selectedRootProductId,
    rootAnalysis,
    nestedRecipeAnalyses,
  } = params;

  if (!product) return [];

  const lines: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    extraCost: number;
  }[] = [];

  for (const group of product.variationGroups ?? []) {
    const selectedIds = selectedVariationOptions[group.id] ?? [];

    for (const option of group.options ?? []) {
      if (!selectedIds.includes(option.id)) continue;

      const extraCost = getVariationOptionRecipeCost({
        option,
        products,
        selectedRootProductId,
        rootAnalysis,
        nestedRecipeAnalyses,
      });

      lines.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        extraCost,
      });
    }
  }

  return lines;
}

function getMandatoryVariationAverages(params: {
  product: StockProduct | null;
  products: StockProduct[];
  selectedRootProductId: string | null;
  rootAnalysis: RecipeAnalysisResponse | null;
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>;
  selectedVariationOptions?: Record<string, string[]>;
}) {
  const {
    product,
    products,
    selectedRootProductId,
    rootAnalysis,
    nestedRecipeAnalyses,
    selectedVariationOptions = {},
  } = params;

  const result = {
    averageCost: 0,
    averagePriceModifier: 0,
    groups: [] as {
      groupId: string;
      groupName: string;
      averageCost: number;
      averagePriceModifier: number;
      optionsCount: number;
      usedSelectedOptions: boolean;
    }[],
  };

  if (!product) return result;

  for (const group of product.variationGroups ?? []) {
    if (!group.required) continue;

    const options = (group.options ?? []).filter(
      (option) => option.active !== false,
    );
    if (options.length === 0) continue;

    const selectedIds = selectedVariationOptions[group.id] ?? [];
    const selectedOptions = options.filter((option) =>
      selectedIds.includes(option.id),
    );
    const optionsToUse = selectedOptions.length > 0 ? selectedOptions : options;

    const totalCost = optionsToUse.reduce(
      (sum, option) =>
        sum +
        getVariationOptionRecipeCost({
          option,
          products,
          selectedRootProductId,
          rootAnalysis,
          nestedRecipeAnalyses,
        }),
      0,
    );

    const totalPriceModifier = optionsToUse.reduce(
      (sum, option) => sum + Number(option.priceModifier ?? 0),
      0,
    );

    const divisor = Math.max(1, optionsToUse.length);
    const averageCost = totalCost / divisor;
    const averagePriceModifier = totalPriceModifier / divisor;

    result.averageCost += averageCost;
    result.averagePriceModifier += averagePriceModifier;
    result.groups.push({
      groupId: group.id,
      groupName: group.name,
      averageCost,
      averagePriceModifier,
      optionsCount: optionsToUse.length,
      usedSelectedOptions: selectedOptions.length > 0,
    });
  }

  return result;
}

function getProductCostWithMandatoryVariations(params: {
  product: StockProduct;
  products: StockProduct[];
  rootAnalysis?: RecipeAnalysisResponse | null;
  nestedRecipeAnalyses?: Record<string, RecipeAnalysisResponse>;
  selectedVariationOptions?: Record<string, string[]>;
}) {
  const {
    product,
    products,
    rootAnalysis = null,
    nestedRecipeAnalyses = {},
    selectedVariationOptions = {},
  } = params;

  const baseCost = getDisplayCost(product);
  if (baseCost == null) {
    return {
      baseCost: null as number | null,
      finalCost: null as number | null,
      selectedVariationCost: 0,
      selectedVariationPrice: 0,
      finalPrice: Number(product.price ?? 0),
      variationGroups: [] as ReturnType<
        typeof getMandatoryVariationAverages
      >["groups"],
    };
  }

  const selectedVariationCost = getSelectedVariationExtraCost({
    product,
    selectedVariationOptions,
    products,
    selectedRootProductId: product.id,
    rootAnalysis,
    nestedRecipeAnalyses,
  });

  let selectedVariationPrice = 0;
  for (const group of product.variationGroups ?? []) {
    const selectedIds = selectedVariationOptions[group.id] ?? [];
    for (const option of group.options ?? []) {
      if (selectedIds.includes(option.id)) {
        selectedVariationPrice += Number(option.priceModifier ?? 0);
      }
    }
  }

  return {
    baseCost,
    finalCost: baseCost + selectedVariationCost,
    selectedVariationCost,
    selectedVariationPrice,
    finalPrice: Number(product.price ?? 0) + selectedVariationPrice,
    variationGroups: getMandatoryVariationAverages({
      product,
      products,
      selectedRootProductId: product.id,
      rootAnalysis,
      nestedRecipeAnalyses,
      selectedVariationOptions,
    }).groups,
  };
}

function getProfitPercentageWithMandatoryVariations(params: {
  product: StockProduct;
  products: StockProduct[];
  rootAnalysis?: RecipeAnalysisResponse | null;
  nestedRecipeAnalyses?: Record<string, RecipeAnalysisResponse>;
  selectedVariationOptions?: Record<string, string[]>;
}) {
  if (params.product.isStockOnly) return null;

  const costData = getProductCostWithMandatoryVariations(params);
  const cost = costData.finalCost;
  const price = costData.finalPrice;

  if (cost == null || cost <= 0 || price <= 0) return null;

  return ((price - cost) / price) * 100;
}

function getProfitStatusWithMandatoryVariations(
  product: StockProduct,
  products: StockProduct[],
  warningThreshold: number,
): "good" | "warning" | "negative" | "no_profit" {
  const profit = getProfitPercentageWithMandatoryVariations({
    product,
    products,
  });

  if (product.isStockOnly || profit == null) return "no_profit";
  if (profit < 0) return "negative";
  if (profit < warningThreshold) return "warning";
  return "good";
}

function getIngredientFractionCostLabel(
  item: RecipeAnalysisResponse["flatRequirements"][number],
  products: StockProduct[],
  selectedRootProductId: string | null,
  rootAnalysis: RecipeAnalysisResponse | null,
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>,
) {
  const product = products.find((p) => p.id === item.ingredientProductId);
  if (!product) return null;

  const analysis =
    selectedRootProductId === product.id
      ? rootAnalysis
      : (nestedRecipeAnalyses[product.id] ?? null);

  const costData = getProductBaseUnitCostShared(product, analysis);
  if (!costData) return null;

  const requiredUnit = item.unit ?? costData.unit;
  const productUnit = costData.unit ?? requiredUnit;

  if (getUnitFamily(requiredUnit) !== getUnitFamily(productUnit)) {
    return null;
  }

  const requiredBase = normalizeQuantity(item.requiredQuantity, requiredUnit);
  if (!Number.isFinite(requiredBase)) return null;

  const total = costData.unitCost * requiredBase;

  return Number.isFinite(total) ? formatBRL(total) : null;
}

type RecipeListItemProps = {
  item: RecipeRequirement;
  nodeKey: string;
  depth: number;
  products: StockProduct[];
  selectedProductId: string | null;
  recipeAnalysis: RecipeAnalysisResponse;
  nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>;
  expandedRecipeNodes: Record<string, boolean>;
  selectedRecipeItemId: string | null;
  onSelect: (productId: string) => void;
  onToggle: (nodeKey: string, productId: string) => void;
};

function RecipeListItem({
  item,
  nodeKey,
  depth,
  products,
  selectedProductId,
  recipeAnalysis,
  nestedRecipeAnalyses,
  expandedRecipeNodes,
  selectedRecipeItemId,
  onSelect,
  onToggle,
}: RecipeListItemProps) {
  const visual = getRecipeItemVisualStatus(item, products);
  const nested = nestedRecipeAnalyses[item.ingredientProductId];
  const isExpanded = Boolean(expandedRecipeNodes[nodeKey]);
  const isSelected = selectedRecipeItemId === item.ingredientProductId;
  const fractionCost = getIngredientFractionCostLabel(
    item,
    products,
    selectedProductId,
    recipeAnalysis,
    nestedRecipeAnalyses,
  );

  return (
    <div
      className={`rounded-xl border p-4 transition ${visual.cardClass} ${
        isSelected
          ? "ring-2 ring-primary border-primary shadow-md bg-primary/5"
          : ""
      }`}
      style={{ marginLeft: depth > 0 ? Math.min(depth * 18, 72) : 0 }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => onSelect(item.ingredientProductId)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{item.ingredientName}</p>
            {item.isRecipe && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Receita
              </span>
            )}
          </div>

          <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <p>
              Precisa:{" "}
              <span className="font-medium text-foreground">
                {formatQtyUnit(item.requiredQuantity, item.unit)}
              </span>
            </p>
            <p>
              Em estoque:{" "}
              <span className="font-medium text-foreground">
                {getDisplayStockAvailableForRequirement(item, products)}
              </span>
            </p>
            <p>
              Custo usado:{" "}
              <span className="font-medium text-foreground">
                {fractionCost ?? "-"}
              </span>
            </p>
          </div>
        </button>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${visual.badgeClass}`}
          >
            {visual.label}
          </span>

          {item.isRecipe && (
            <button
              type="button"
              onClick={() => onToggle(nodeKey, item.ingredientProductId)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-secondary"
            >
              {isExpanded ? "Recolher composição" : "Expandir composição"}
            </button>
          )}
        </div>
      </div>

      {item.isRecipe && isExpanded && (
        <div className="mt-4 space-y-3 border-l-2 border-border pl-3">
          {!nested ? (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              Carregando composição...
            </div>
          ) : nested.flatRequirements.length > 0 ? (
            nested.flatRequirements.map((child, index) => (
              <RecipeListItem
                key={`${nodeKey}-${child.ingredientProductId}-${child.unit}-${index}`}
                item={child}
                nodeKey={`${nodeKey}-${child.ingredientProductId}-${index}`}
                depth={depth + 1}
                products={products}
                selectedProductId={selectedProductId}
                recipeAnalysis={recipeAnalysis}
                nestedRecipeAnalyses={nestedRecipeAnalyses}
                expandedRecipeNodes={expandedRecipeNodes}
                selectedRecipeItemId={selectedRecipeItemId}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))
          ) : (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              Esta receita não possui itens filhos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EstoquePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSavingStockItem, setIsSavingStockItem] = useState(false);
  const [isAddingToBuyCart, setIsAddingToBuyCart] = useState(false);
  const [buySuggestion, setBuySuggestion] = useState<StockBuySuggestion | null>(
    null,
  );
  const [recipeBuySuggestion, setRecipeBuySuggestion] =
    useState<RecipeBuySuggestion | null>(null);
  const [isAddingSuggestedBuy, setIsAddingSuggestedBuy] = useState(false);
  const [isLoadingRecipeBuySuggestion, setIsLoadingRecipeBuySuggestion] =
    useState(false);
  const [existingBuyCartPrompt, setExistingBuyCartPrompt] =
    useState<ExistingBuyCartPrompt | null>(null);
  const [selectedExistingBuyCartItems, setSelectedExistingBuyCartItems] =
    useState<Record<string, boolean>>({});

  const [products, setProducts] = useState<StockProduct[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>("all");
  const [profitWarningThreshold, setProfitWarningThreshold] = useState("30");

  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(
    null,
  );
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);

  const [selectedVariationOptions, setSelectedVariationOptions] = useState<
    Record<string, string[]>
  >({});

  const [recipeAnalysis, setRecipeAnalysis] =
    useState<RecipeAnalysisResponse | null>(null);
  const [calculatorResult, setCalculatorResult] =
    useState<RecipeCalculatorResponse | null>(null);
  const [calculatorQuantity, setCalculatorQuantity] = useState("1");
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [produceProductId, setProduceProductId] = useState("");
  const [produceQuantityMode, setProduceQuantityMode] =
    useState<ProduceQuantityMode>("recipes");
  const [produceRecipeBatches, setProduceRecipeBatches] = useState("1");
  const [produceQuantity, setProduceQuantity] = useState("1");
  const [producePreview, setProducePreview] =
    useState<ProduceItemPreview | null>(null);
  const [isCalculatingProducePreview, setIsCalculatingProducePreview] =
    useState(false);
  const [isProducingItem, setIsProducingItem] = useState(false);
  const [recipeViewMode, setRecipeViewMode] = useState<RecipeViewMode>("flow");
  const [selectedRecipeItemId, setSelectedRecipeItemId] = useState<
    string | null
  >(null);
  const [expandedRecipeNodes, setExpandedRecipeNodes] = useState<
    Record<string, boolean>
  >({});
  const [nestedRecipeAnalyses, setNestedRecipeAnalyses] = useState<
    Record<string, RecipeAnalysisResponse>
  >({});

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);

  const [showCostModal, setShowCostModal] = useState(false);
  const [costProduct, setCostProduct] = useState<StockProduct | null>(null);
  const [costRecipeAnalysis, setCostRecipeAnalysis] =
    useState<RecipeAnalysisResponse | null>(null);
  const [costSelectedVariationOptions, setCostSelectedVariationOptions] =
    useState<Record<string, string[]>>({});

  const [movementType, setMovementType] = useState<"in" | "out" | "adjustment">(
    "in",
  );
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementReason, setMovementReason] = useState("");

  const [showStockItemModal, setShowStockItemModal] = useState(false);
  const [editingStockItem, setEditingStockItem] =
    useState<EditableStockItem | null>(null);

  const [collapsingRecipeNodes, setCollapsingRecipeNodes] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    async function load() {
      try {
        const [stockProductsData, posProductsData, categoriesData] = await Promise.all([
          getStockProducts(),
          getPosProducts(),
          getCategories(),
        ]);

        const productsData = mergeStockProductsWithProductVariationData(
          stockProductsData,
          posProductsData as Product[],
        );

        setProducts(productsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Erro ao carregar estoque:", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const baseRecipeCost = recipeAnalysis?.recipeCost ?? 0;

  const selectedVariationBreakdown = useMemo(() => {
    return buildSelectedVariationBreakdown({
      product: selectedProduct,
      selectedVariationOptions,
      products,
      selectedRootProductId: selectedProduct?.id ?? null,
      rootAnalysis: recipeAnalysis,
      nestedRecipeAnalyses,
    });
  }, [
    selectedProduct,
    selectedVariationOptions,
    products,
    recipeAnalysis,
    nestedRecipeAnalyses,
  ]);

  const selectedVariationExtraCost = useMemo(() => {
    return getSelectedVariationExtraCost({
      product: selectedProduct,
      selectedVariationOptions,
      products,
      selectedRootProductId: selectedProduct?.id ?? null,
      rootAnalysis: recipeAnalysis,
      nestedRecipeAnalyses,
    });
  }, [
    selectedProduct,
    selectedVariationOptions,
    products,
    recipeAnalysis,
    nestedRecipeAnalyses,
  ]);

  const currentRecipeTotalCost = baseRecipeCost + selectedVariationExtraCost;

  const costModalBaseCost =
    costRecipeAnalysis?.recipeCost ??
    (costProduct ? (getDisplayCostWithUnitContent(costProduct) ?? 0) : 0);

  const costModalSelectedBreakdown = useMemo(() => {
    return buildSelectedVariationBreakdown({
      product: costProduct,
      selectedVariationOptions: costSelectedVariationOptions,
      products,
      selectedRootProductId: costProduct?.id ?? null,
      rootAnalysis: costRecipeAnalysis,
      nestedRecipeAnalyses: {},
    });
  }, [costProduct, costSelectedVariationOptions, products, costRecipeAnalysis]);

  const costModalMandatoryAverage = useMemo(() => {
    return getMandatoryVariationAverages({
      product: costProduct,
      products,
      selectedRootProductId: costProduct?.id ?? null,
      rootAnalysis: costRecipeAnalysis,
      nestedRecipeAnalyses: {},
      selectedVariationOptions: costSelectedVariationOptions,
    });
  }, [costProduct, products, costRecipeAnalysis, costSelectedVariationOptions]);

  const costModalExtraCost = useMemo(() => {
    return getSelectedVariationExtraCost({
      product: costProduct,
      selectedVariationOptions: costSelectedVariationOptions,
      products,
      selectedRootProductId: costProduct?.id ?? null,
      rootAnalysis: costRecipeAnalysis,
      nestedRecipeAnalyses: {},
    });
  }, [costProduct, costSelectedVariationOptions, products, costRecipeAnalysis]);

  const costModalSelectedPriceModifier = useMemo(() => {
    if (!costProduct) return 0;

    let total = 0;
    for (const group of costProduct.variationGroups ?? []) {
      const selectedIds = costSelectedVariationOptions[group.id] ?? [];
      for (const option of group.options ?? []) {
        if (selectedIds.includes(option.id)) {
          total += Number(option.priceModifier ?? 0);
        }
      }
    }

    return total;
  }, [costProduct, costSelectedVariationOptions]);

  const costModalFinalCost = costModalBaseCost + costModalExtraCost;
  const costModalFinalPrice =
    Number(costProduct?.price ?? 0) + costModalSelectedPriceModifier;
  const costModalProfitAmount = costModalFinalPrice - costModalFinalCost;
  const costModalProfitPercent =
    costModalFinalPrice > 0
      ? (costModalProfitAmount / costModalFinalPrice) * 100
      : null;

  async function reloadStock() {
    const [stockProductsData, posProductsData] = await Promise.all([
      getStockProducts(),
      getPosProducts(),
    ]);
    const data = mergeStockProductsWithProductVariationData(
      stockProductsData,
      posProductsData as Product[],
    );
    setProducts(data);
    return data;
  }

  function toggleVariationOption(
    group: ProductVariationGroup,
    option: ProductVariationOption,
  ) {
    setSelectedVariationOptions((prev) => {
      const current = prev[group.id] ?? [];

      if (group.selectionType === "single") {
        const alreadySelected = current.includes(option.id);

        return {
          ...prev,
          [group.id]: alreadySelected ? [] : [option.id],
        };
      }

      const alreadySelected = current.includes(option.id);

      return {
        ...prev,
        [group.id]: alreadySelected
          ? current.filter((id) => id !== option.id)
          : [...current, option.id],
      };
    });
  }

  async function ensureNestedRecipeLoaded(productId: string) {
    if (nestedRecipeAnalyses[productId]) return nestedRecipeAnalyses[productId];

    const data = await getRecipeAnalysis(productId);
    setNestedRecipeAnalyses((prev) => ({
      ...prev,
      [productId]: data,
    }));
    return data;
  }

  async function saveBuyCartQuantity(product: StockProduct, quantity: number) {
    const normalizedQuantity = normalizeBuyQuantityForProduct(product, quantity);

    await upsertBuyCartItem({
      productId: product.id,
      quantity: normalizedQuantity,
      notes: null,
    });
    window.dispatchEvent(new CustomEvent("ordr-buy-cart-updated"));
  }

  async function getExistingBuyCartPromptItems(
    requestedItems: Array<{ product: StockProduct; quantity: number }>,
  ): Promise<ExistingBuyCartPromptItem[]> {
    const cart = await getBuyCart();

    return requestedItems
      .map((requestedItem) => {
        const requestedQuantity = normalizeBuyQuantityForProduct(
          requestedItem.product,
          requestedItem.quantity,
        );

        const matchingCartItems = (cart.items ?? []).filter(
          (item) => item.productId === requestedItem.product.id,
        );

        if (matchingCartItems.length === 0) return null;

        const existingQuantity = normalizeBuyQuantityForProduct(
          requestedItem.product,
          matchingCartItems.reduce(
            (sum, item) => sum + Number(item.quantity ?? 0),
            0,
          ),
        );

        return {
          product: requestedItem.product,
          existingQuantity,
          requestedQuantity,
          nextQuantity: normalizeBuyQuantityForProduct(
            requestedItem.product,
            existingQuantity + requestedQuantity,
          ),
        };
      })
      .filter((item): item is ExistingBuyCartPromptItem => !!item);
  }

  function openExistingBuyCartPrompt(items: ExistingBuyCartPromptItem[]) {
    if (items.length === 0) return;

    setExistingBuyCartPrompt({ items });
    setSelectedExistingBuyCartItems(
      items.reduce<Record<string, boolean>>((acc, item) => {
        acc[item.product.id] = true;
        return acc;
      }, {}),
    );
  }

  async function handleAddProductToBuyCart(
    product: StockProduct,
    quantity: number,
    options: { skipExistingCheck?: boolean; silent?: boolean } = {},
  ): Promise<boolean> {
    if (!isBuyableStockProduct(product)) {
      alert(
        "Este item não pode ser comprado diretamente. Use os ingredientes base da receita.",
      );
      return false;
    }

    const normalizedQuantity = normalizeBuyQuantityForProduct(product, quantity);

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      alert("Quantidade inválida para adicionar ao carrinho.");
      return false;
    }

    try {
      setIsAddingToBuyCart(true);

      if (!options.skipExistingCheck) {
        const existingItems = await getExistingBuyCartPromptItems([
          { product, quantity: normalizedQuantity },
        ]);

        if (existingItems.length > 0) {
          openExistingBuyCartPrompt(existingItems);
          return false;
        }
      }

      await saveBuyCartQuantity(product, normalizedQuantity);

      if (!options.silent) {
        alert(`
${product.name} adicionado ao carrinho de compras.`.trim());
      }

      return true;
    } catch (error: any) {
      console.error("Erro ao adicionar ao carrinho de compras:", error);
      alert(error?.message || "Erro ao adicionar ao carrinho de compras.");
      return false;
    } finally {
      setIsAddingToBuyCart(false);
    }
  }

  async function confirmAddExistingBuyCartItem() {
    if (!existingBuyCartPrompt) return;

    const selectedItems = existingBuyCartPrompt.items.filter(
      (item) => selectedExistingBuyCartItems[item.product.id],
    );

    if (selectedItems.length === 0) {
      setExistingBuyCartPrompt(null);
      setSelectedExistingBuyCartItems({});
      return;
    }

    try {
      setIsAddingToBuyCart(true);

      for (const item of selectedItems) {
        await saveBuyCartQuantity(item.product, item.nextQuantity);
      }

      alert(
        selectedItems.length === 1
          ? `${selectedItems[0].product.name} atualizado no carrinho de compras.`
          : `${selectedItems.length} itens atualizados no carrinho de compras.`,
      );

      setExistingBuyCartPrompt(null);
      setSelectedExistingBuyCartItems({});
    } catch (error: any) {
      console.error("Erro ao atualizar item no carrinho:", error);
      alert(error?.message || "Erro ao atualizar item no carrinho.");
    } finally {
      setIsAddingToBuyCart(false);
    }
  }

  function handleAddMissingProductToBuyCart(product: StockProduct) {
    if (!isBuyableStockProduct(product)) {
      alert(
        "Este item não pode ser comprado diretamente. Use os ingredientes base da receita.",
      );
      return;
    }

    const missingQuantity = getMissingQuantityToMinimum(product);
    const defaultQuantity = normalizeBuyQuantityForProduct(
      product,
      missingQuantity > 0 ? missingQuantity : 1,
    );

    setBuySuggestion({
      product,
      suggestedQuantity: defaultQuantity,
      quantity: String(defaultQuantity),
    });
  }

  async function openRecipeBuySuggestionModal(product: StockProduct) {
    if (!(product.hasRecipe || product.costMode === "recipe" || product.madeOnDemand)) {
      handleAddMissingProductToBuyCart(product);
      return;
    }

    try {
      setIsLoadingRecipeBuySuggestion(true);

      const itemsByProduct = new Map<string, RecipeBuySuggestionItem>();
      const visitedRecipeIds = new Set<string>();
      const targetOutputQuantity = getRecipeTargetOutputQuantity(product);

      async function getFullStockProduct(productId: string) {
        const fromList = products.find((productItem) => productItem.id === productId) ?? null;

        try {
          const fullProduct = await getProductById(productId);
          return {
            ...(fromList ?? {}),
            ...(fullProduct as any),
            stockQuantity: Number((fullProduct as any)?.stockQuantity ?? fromList?.stockQuantity ?? 0),
            minStock: Number((fullProduct as any)?.minStock ?? fromList?.minStock ?? 0),
            recipeOutputQuantity:
              (fullProduct as any)?.recipeOutputQuantity == null
                ? fromList?.recipeOutputQuantity ?? null
                : Number((fullProduct as any).recipeOutputQuantity),
            recipeItems: ((fullProduct as any)?.recipeItems ?? (fromList as any)?.recipeItems ?? []).map((item: any) => ({
              ...item,
              ingredientProductId:
                item.ingredientProductId ?? item.ingredientId ?? item.productId,
              quantity: Number(item.quantity ?? 0),
              unit: (item.unit ?? "unit") as StockUnit,
            })),
            variationGroups: ((fullProduct as any)?.variationGroups ?? (fromList as any)?.variationGroups ?? []).map((group: any) => ({
              ...group,
              required: Boolean(group.required),
              options: (group.options ?? []).map((option: any) => ({
                ...option,
                recipeItems: (option.recipeItems ?? []).map((item: any) => ({
                  ...item,
                  ingredientProductId:
                    item.ingredientProductId ?? item.ingredientId ?? item.productId,
                  quantity: Number(item.quantity ?? 0),
                  unit: (item.unit ?? "unit") as StockUnit,
                })),
              })),
            })),
          } as StockProductWithRecipeItems;
        } catch {
          return fromList as StockProductWithRecipeItems | null;
        }
      }

      function upsertBuySuggestion(params: {
        ingredient: StockProduct;
        ingredientName: string;
        requiredQuantity: number;
        requiredUnit: StockUnit | null;
      }) {
        const { ingredient, ingredientName, requiredQuantity, requiredUnit } = params;

        if (!isBuyableStockProduct(ingredient)) return;

        const missingQuantity = getRequirementMissingFromRealStock({
          ingredient,
          requiredQuantity,
          requiredUnit,
        });

        if (!Number.isFinite(missingQuantity) || missingQuantity <= 0) return;

        const buyQuantity = convertRequirementQuantityToBuyQuantity(
          ingredient,
          missingQuantity,
          requiredUnit,
        );

        if (!Number.isFinite(buyQuantity) || buyQuantity <= 0) return;

        const current = itemsByProduct.get(ingredient.id);
        if (current) {
          const nextRequiredQuantity = current.requiredQuantity + requiredQuantity;
          const nextMissingQuantity = current.missingQuantity + missingQuantity;
          const nextBuyQuantity = current.buyQuantity + buyQuantity;

          itemsByProduct.set(ingredient.id, {
            ...current,
            requiredQuantity: nextRequiredQuantity,
            missingQuantity: nextMissingQuantity,
            buyQuantity: nextBuyQuantity,
            quantity: String(nextBuyQuantity),
          });
          return;
        }

        itemsByProduct.set(ingredient.id, {
          product: ingredient,
          ingredientName,
          requiredQuantity,
          requiredUnit,
          missingQuantity,
          buyQuantity,
          quantity: String(buyQuantity),
        });
      }

      async function collectFromVariationGroups(params: {
        recipeProduct: StockProductWithRecipeItems;
        multiplier: number;
      }) {
        const { recipeProduct, multiplier } = params;
        const variationItems = getActiveVariationOptionRecipeItems(recipeProduct);

        for (const variationItem of variationItems) {
          const requiredQuantity = variationItem.quantity * multiplier;
          const requiredUnit = variationItem.unit;

          if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
            continue;
          }

          const ingredient = await getFullStockProduct(variationItem.ingredientProductId);
          if (!ingredient) continue;

          const shouldExpandRecipe =
            ingredient.hasRecipe ||
            ingredient.costMode === "recipe" ||
            ingredient.madeOnDemand ||
            (((ingredient as any).recipeItems ?? []).length > 0 && !isBuyableStockProduct(ingredient));

          if (shouldExpandRecipe && !isBuyableStockProduct(ingredient)) {
            const nestedOutputUnit = getRecipeOutputUnit(ingredient);
            const nestedOutputQuantity =
              convertQuantityBetweenUnits(requiredQuantity, requiredUnit, nestedOutputUnit) ??
              requiredQuantity;

            await collectFromRecipeProduct({
              recipeProductId: ingredient.id,
              targetOutputQuantity: nestedOutputQuantity,
              targetOutputUnit: nestedOutputUnit,
            });
            continue;
          }

          upsertBuySuggestion({
            ingredient,
            ingredientName: ingredient.name,
            requiredQuantity,
            requiredUnit,
          });
        }
      }

      async function collectFromRecipeItems(params: {
        recipeProduct: StockProductWithRecipeItems;
        targetOutputQuantity: number;
        targetOutputUnit?: StockUnit | null;
      }) {
        const { recipeProduct, targetOutputQuantity, targetOutputUnit } = params;
        const recipeItems = ((recipeProduct as any).recipeItems ?? []) as ProductRecipeItem[];

        const multiplier = getRecipeMultiplierForTargetOutput({
          recipeProduct,
          targetOutputQuantity,
          targetOutputUnit,
        });

        await collectFromVariationGroups({
          recipeProduct,
          multiplier,
        });

        if (recipeItems.length === 0) return false;

        for (const recipeItem of recipeItems) {
          const ingredientProductId = (recipeItem as any).ingredientProductId ?? (recipeItem as any).ingredientId ?? (recipeItem as any).productId;
          const requiredQuantity = Number(recipeItem.quantity ?? 0) * multiplier;
          const requiredUnit = (recipeItem.unit ?? "unit") as StockUnit;

          if (!ingredientProductId || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) continue;

          const ingredient = await getFullStockProduct(ingredientProductId);
          if (!ingredient) continue;

          const shouldExpandRecipe =
            ingredient.hasRecipe ||
            ingredient.costMode === "recipe" ||
            ingredient.madeOnDemand ||
            (((ingredient as any).recipeItems ?? []).length > 0 && !isBuyableStockProduct(ingredient));

          if (shouldExpandRecipe && !isBuyableStockProduct(ingredient)) {
            const nestedOutputUnit = getRecipeOutputUnit(ingredient);
            const nestedOutputQuantity =
              convertQuantityBetweenUnits(requiredQuantity, requiredUnit, nestedOutputUnit) ??
              requiredQuantity;

            await collectFromRecipeProduct({
              recipeProductId: ingredient.id,
              targetOutputQuantity: nestedOutputQuantity,
              targetOutputUnit: nestedOutputUnit,
            });
            continue;
          }

          upsertBuySuggestion({
            ingredient,
            ingredientName: ingredient.name,
            requiredQuantity,
            requiredUnit,
          });
        }

        return true;
      }

      async function collectFromAnalysis(params: {
        recipeProductId: string;
        targetOutputQuantity: number;
        targetOutputUnit?: StockUnit | null;
      }) {
        const { recipeProductId, targetOutputQuantity, targetOutputUnit } = params;
        const recipeProduct = await getFullStockProduct(recipeProductId);
        if (!recipeProduct) return;

        const analysis = await getRecipeAnalysis(recipeProductId);
        const multiplier = getRecipeMultiplierForTargetOutput({
          recipeProduct,
          targetOutputQuantity,
          targetOutputUnit,
        });

        await collectFromVariationGroups({
          recipeProduct,
          multiplier,
        });

        for (const item of analysis.flatRequirements ?? []) {
          if (item.isUnlimited) continue;

          const ingredient = await getFullStockProduct(item.ingredientProductId);
          const requiredUnit = (item.unit ?? ingredient?.stockUnit ?? "unit") as StockUnit;
          const requiredQuantity = Number(item.requiredQuantity ?? 0) * multiplier;

          if (!ingredient || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) continue;

          const shouldExpandRecipe =
            item.isRecipe ||
            ingredient.hasRecipe ||
            ingredient.costMode === "recipe" ||
            ingredient.madeOnDemand;

          if (shouldExpandRecipe && !isBuyableStockProduct(ingredient)) {
            const nestedOutputUnit = getRecipeOutputUnit(ingredient);
            const nestedOutputQuantity =
              convertQuantityBetweenUnits(requiredQuantity, requiredUnit, nestedOutputUnit) ??
              requiredQuantity;

            await collectFromRecipeProduct({
              recipeProductId: ingredient.id,
              targetOutputQuantity: nestedOutputQuantity,
              targetOutputUnit: nestedOutputUnit,
            });
            continue;
          }

          upsertBuySuggestion({
            ingredient,
            ingredientName: item.ingredientName,
            requiredQuantity,
            requiredUnit,
          });
        }
      }

      async function collectFromRecipeProduct(params: {
        recipeProductId: string;
        targetOutputQuantity: number;
        targetOutputUnit?: StockUnit | null;
      }) {
        const { recipeProductId, targetOutputQuantity, targetOutputUnit } = params;

        if (visitedRecipeIds.has(recipeProductId)) return;
        visitedRecipeIds.add(recipeProductId);

        const recipeProduct = await getFullStockProduct(recipeProductId);
        if (!recipeProduct) return;

        const collectedFromItems = await collectFromRecipeItems({
          recipeProduct,
          targetOutputQuantity,
          targetOutputUnit,
        });

        if (!collectedFromItems) {
          await collectFromAnalysis({
            recipeProductId,
            targetOutputQuantity,
            targetOutputUnit,
          });
        }
      }

      await collectFromRecipeProduct({
        recipeProductId: product.id,
        targetOutputQuantity,
        targetOutputUnit: getRecipeOutputUnit(product),
      });

      const items = Array.from(itemsByProduct.values()).filter(
        (item) => Number(item.buyQuantity) > 0,
      );

      if (items.length === 0) {
        alert(
          "Não há ingredientes faltantes para comprar. Se a produção ainda aparece baixa, atualize a página para recarregar a produção estimada.",
        );
        return;
      }

      setRecipeBuySuggestion({ recipeProduct: product, items });
    } catch (error: any) {
      console.error("Erro ao preparar compra da receita:", error);
      alert(error?.message || "Erro ao preparar ingredientes da receita.");
    } finally {
      setIsLoadingRecipeBuySuggestion(false);
    }
  }

  async function confirmRecipeBuySuggestion() {
    if (!recipeBuySuggestion) return;

    const validItems = recipeBuySuggestion.items
      .map((item) => ({
        ...item,
        parsedQuantity: normalizeBuyQuantityForProduct(
          item.product,
          Number(item.quantity),
        ),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.parsedQuantity) && item.parsedQuantity > 0,
      );

    if (validItems.length === 0) {
      alert("Informe pelo menos uma quantidade válida.");
      return;
    }

    try {
      setIsAddingSuggestedBuy(true);

      const existingItems = await getExistingBuyCartPromptItems(
        validItems.map((item) => ({
          product: item.product,
          quantity: item.parsedQuantity,
        })),
      );
      const existingIds = new Set(existingItems.map((item) => item.product.id));
      const newItems = validItems.filter((item) => !existingIds.has(item.product.id));

      for (const item of newItems) {
        await saveBuyCartQuantity(item.product, item.parsedQuantity);
      }

      if (existingItems.length > 0) {
        openExistingBuyCartPrompt(existingItems);
        setRecipeBuySuggestion(null);
        return;
      }

      alert("Ingredientes adicionados ao carrinho de compras.");
      setRecipeBuySuggestion(null);
    } catch (error: any) {
      console.error("Erro ao adicionar ingredientes ao carrinho:", error);
      alert(error?.message || "Erro ao adicionar ingredientes ao carrinho.");
    } finally {
      setIsAddingSuggestedBuy(false);
    }
  }

  async function confirmBuySuggestion() {
    if (!buySuggestion) return;

    const quantity = normalizeBuyQuantityForProduct(
      buySuggestion.product,
      Number(buySuggestion.quantity),
    );

    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    const added = await handleAddProductToBuyCart(buySuggestion.product, quantity);
    if (added) {
      setBuySuggestion(null);
    }
  }

  async function handleAddRequirementToBuyCart(params: {
    productId: string;
    quantity: number;
    unit?: StockUnit | null;
  }) {
    const product = products.find((item) => item.id === params.productId);

    if (!product) {
      alert("Produto não encontrado no estoque.");
      return;
    }

    const buyQuantity = convertRequirementQuantityToBuyQuantity(
      product,
      params.quantity,
      params.unit,
    );

    await handleAddProductToBuyCart(product, buyQuantity);
  }

  async function handleAddCalculatorMissingItemsToBuyCart() {
    if (!calculatorResult) return;

    const quantitiesByProduct = new Map<
      string,
      { quantity: number; unit: StockUnit | null }
    >();

    function addRequirement(
      productId: string,
      quantity: number,
      unit?: StockUnit | null,
    ) {
      const product = products.find((item) => item.id === productId);
      if (!product || !isBuyableStockProduct(product)) return;
      if (!Number.isFinite(quantity) || quantity <= 0) return;

      const buyQuantity = convertRequirementQuantityToBuyQuantity(
        product,
        quantity,
        unit,
      );
      if (!Number.isFinite(buyQuantity) || buyQuantity <= 0) return;

      const existing = quantitiesByProduct.get(productId);
      quantitiesByProduct.set(productId, {
        quantity: (existing?.quantity ?? 0) + buyQuantity,
        unit: product.stockUnit ?? unit ?? "unit",
      });
    }

    for (const item of calculatorResult.directRequirements ?? []) {
      if (item.isUnlimited) continue;

      const missingQuantity = getRequirementMissingQuantity(item, undefined, products);

      addRequirement(item.ingredientProductId, missingQuantity, item.unit);
    }

    for (const group of calculatorIntermediateGroups.needed) {
      for (const item of group.baseItems ?? []) {
        if (item.isUnlimited || !hasMissingQuantity(item.missingQuantity))
          continue;
        addRequirement(
          item.ingredientProductId,
          Number(item.missingQuantity ?? 0),
          item.unit,
        );
      }
    }

    if (quantitiesByProduct.size === 0) {
      alert("Não há itens de compra faltantes para adicionar ao carrinho.");
      return;
    }

    try {
      setIsAddingToBuyCart(true);

      for (const [productId, data] of quantitiesByProduct.entries()) {
        const product = products.find((item) => item.id === productId);
        if (!product) continue;

        const added = await handleAddProductToBuyCart(product, data.quantity, {
          silent: true,
        });

        if (!added) {
          return;
        }
      }

      alert("Itens faltantes adicionados ao carrinho de compras.");
    } catch (error: any) {
      console.error("Erro ao adicionar faltantes ao carrinho:", error);
      alert(error?.message || "Erro ao adicionar faltantes ao carrinho.");
    } finally {
      setIsAddingToBuyCart(false);
    }
  }

  async function handleOpenHistory(product: StockProduct) {
    try {
      setSelectedProduct(product);
      setIsLoadingMovements(true);
      setShowHistoryModal(true);
      const data = await getProductStockMovements(product.id);
      setMovements(data);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
    } finally {
      setIsLoadingMovements(false);
    }
  }

  async function handleOpenCostModal(product: StockProduct) {
    try {
      setCostRecipeAnalysis(null);
      setCostSelectedVariationOptions({});
      setShowCostModal(true);

      const fullProduct = await getProductById(product.id);
      const modalProduct = (fullProduct ?? product) as StockProduct;
      setCostProduct(modalProduct);

      const initialSelected: Record<string, string[]> = {};
      for (const group of modalProduct.variationGroups ?? []) {
        initialSelected[group.id] = [];
      }
      setCostSelectedVariationOptions(initialSelected);

      if (modalProduct.hasRecipe || modalProduct.costMode === "recipe") {
        const analysis = await getRecipeAnalysis(modalProduct.id);
        setCostRecipeAnalysis(analysis);
      }
    } catch (error) {
      console.error("Erro ao carregar custos:", error);
      alert("Erro ao carregar custos");
      setShowCostModal(false);
    }
  }

  function toggleCostVariationOption(
    group: ProductVariationGroup,
    option: ProductVariationOption,
  ) {
    setCostSelectedVariationOptions((prev) => {
      const current = prev[group.id] ?? [];

      if (group.selectionType === "single") {
        const alreadySelected = current.includes(option.id);
        return {
          ...prev,
          [group.id]: alreadySelected ? [] : [option.id],
        };
      }

      const alreadySelected = current.includes(option.id);
      return {
        ...prev,
        [group.id]: alreadySelected
          ? current.filter((id) => id !== option.id)
          : [...current, option.id],
      };
    });
  }

  async function handleOpenRecipe(product: StockProduct) {
    try {
      setSelectedProduct(product);
      setRecipeAnalysis(null);
      setSelectedRecipeItemId(null);
      setRecipeViewMode("flow");
      setIsLoadingRecipe(true);
      const initialSelectedVariationOptions: Record<string, string[]> = {};

      for (const group of product.variationGroups ?? []) {
        if (
          group.required &&
          group.selectionType === "single" &&
          group.options?.length
        ) {
          initialSelectedVariationOptions[group.id] = [group.options[0].id];
        } else {
          initialSelectedVariationOptions[group.id] = [];
        }
      }

      setSelectedVariationOptions(initialSelectedVariationOptions);
      setShowRecipeModal(true);

      const data = await getRecipeAnalysis(product.id);
      setRecipeAnalysis(data);

      const initialExpanded: Record<string, boolean> = {};
      for (const item of data.flatRequirements) {
        if (item.isRecipe) {
          initialExpanded[item.ingredientProductId] = false;
        }
      }

      setExpandedRecipeNodes(initialExpanded);
      const firstItem = data.flatRequirements[0];
      setSelectedRecipeItemId(firstItem?.ingredientProductId ?? null);
    } catch (error) {
      console.error("Erro ao carregar análise da receita:", error);
      alert("Erro ao carregar análise da receita");
    } finally {
      setIsLoadingRecipe(false);
    }
  }

  function getAnalysisForProduct(
    productId: string,
    selectedRootProductId: string | null,
    rootAnalysis: RecipeAnalysisResponse | null,
    nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>,
  ) {
    if (selectedRootProductId === productId) {
      return rootAnalysis;
    }

    return nestedRecipeAnalyses[productId] ?? null;
  }

  function getProductBaseUnitCost(
    product: StockProduct,
    analysis?: RecipeAnalysisResponse | null,
  ): {
    unitCost: number;
    unit: StockUnit | null;
  } | null {
    if (product.costMode === "recipe" || product.hasRecipe) {
      const totalCost = product.recipeCost ?? analysis?.recipeCost ?? null;
      const outputQuantity =
        product.recipeOutputQuantity ?? analysis?.outputQuantity ?? null;
      const outputUnit =
        product.recipeOutputUnit ??
        analysis?.outputUnit ??
        product.stockUnit ??
        "unit";

      if (
        totalCost == null ||
        outputQuantity == null ||
        outputQuantity <= 0 ||
        !Number.isFinite(totalCost) ||
        !Number.isFinite(outputQuantity)
      ) {
        return null;
      }

      const normalizedOutput = normalizeQuantity(outputQuantity, outputUnit);
      if (!Number.isFinite(normalizedOutput) || normalizedOutput <= 0) {
        return null;
      }

      return {
        unitCost: totalCost / normalizedOutput,
        unit: outputUnit,
      };
    }

    const totalCost = product.referenceCost ?? product.simpleCost ?? null;
    const referenceQuantity =
      product.referenceQuantity ??
      (product.stockUnit === "unit" || !product.stockUnit ? 1 : null);
    const unit = product.stockUnit ?? "unit";

    if (
      totalCost == null ||
      referenceQuantity == null ||
      referenceQuantity <= 0 ||
      !Number.isFinite(totalCost) ||
      !Number.isFinite(referenceQuantity)
    ) {
      return null;
    }

    const normalizedQuantity = normalizeQuantity(referenceQuantity, unit);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return null;
    }

    return {
      unitCost: totalCost / normalizedQuantity,
      unit,
    };
  }

  function getIngredientFractionCost(
    item: RecipeAnalysisResponse["flatRequirements"][number],
    products: StockProduct[],
    selectedRootProductId: string | null,
    rootAnalysis: RecipeAnalysisResponse | null,
    nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>,
  ): number | null {
    const product = products.find((p) => p.id === item.ingredientProductId);
    if (!product) return null;

    const analysis = getAnalysisForProduct(
      product.id,
      selectedRootProductId,
      rootAnalysis,
      nestedRecipeAnalyses,
    );

    const costData = getProductBaseUnitCostShared(product, analysis);
    if (!costData) return null;

    const requiredUnit = item.unit ?? costData.unit;
    const productUnit = costData.unit ?? requiredUnit;

    const requiredFamily = getUnitFamily(requiredUnit);
    const productFamily = getUnitFamily(productUnit);

    if (requiredFamily !== productFamily) return null;

    const requiredBase = normalizeQuantity(item.requiredQuantity, requiredUnit);
    if (!Number.isFinite(requiredBase)) return null;

    const total = costData.unitCost * requiredBase;
    return Number.isFinite(total) ? total : null;
  }

  function getIngredientFractionCostLabel(
    item: RecipeAnalysisResponse["flatRequirements"][number],
    products: StockProduct[],
    selectedRootProductId: string | null,
    rootAnalysis: RecipeAnalysisResponse | null,
    nestedRecipeAnalyses: Record<string, RecipeAnalysisResponse>,
  ) {
    const value = getIngredientFractionCost(
      item,
      products,
      selectedRootProductId,
      rootAnalysis,
      nestedRecipeAnalyses,
    );

    return value == null ? null : formatBRL(value);
  }

  async function toggleRecipeNode(nodeKey: string, productId: string) {
    const isOpen = !!expandedRecipeNodes[nodeKey];

    if (!isOpen) {
      if (!nestedRecipeAnalyses[productId]) {
        try {
          await ensureNestedRecipeLoaded(productId);
        } catch (error) {
          console.error("Erro ao carregar receita intermediária:", error);
        }
      }

      setExpandedRecipeNodes((prev) => ({
        ...prev,
        [nodeKey]: true,
      }));
      setSelectedRecipeItemId(productId);
      return;
    }

    setCollapsingRecipeNodes((prev) => ({
      ...prev,
      [nodeKey]: true,
    }));

    setTimeout(() => {
      setExpandedRecipeNodes((prev) => ({
        ...prev,
        [nodeKey]: false,
      }));

      setCollapsingRecipeNodes((prev) => {
        const next = { ...prev };
        delete next[nodeKey];
        return next;
      });
    }, 180);

    setSelectedRecipeItemId(productId);
  }

  function handleOpenCalculator(product: StockProduct) {
    setSelectedProduct(product);
    setCalculatorResult(null);
    setCalculatorQuantity("1");
    setShowCalculatorModal(true);
  }

  async function handleCalculateRecipe() {
    if (!selectedProduct) return;

    const quantity = Number(calculatorQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    try {
      setIsCalculating(true);
      const data = await calculateRecipeProduction(
        selectedProduct.id,
        quantity,
      );
      setCalculatorResult(data);
    } catch (error) {
      console.error("Erro ao calcular produção:", error);
      alert("Erro ao calcular produção");
    } finally {
      setIsCalculating(false);
    }
  }

  function handleOpenProduceModal(productId?: string) {
    const firstRecipeProduct = products.find((product) =>
      canManuallyProduceProduct(product),
    );
    const initialProductId = productId || firstRecipeProduct?.id || "";

    setProduceProductId(initialProductId);
    setProduceQuantityMode("recipes");
    setProduceRecipeBatches("1");
    setProduceQuantity("1");
    setProducePreview(null);
    setShowProduceModal(true);
  }

  async function handleCalculateProducePreview() {
    const product = products.find((item) => item.id === produceProductId);
    const quantity = getProduceTargetQuantity({
      product,
      mode: produceQuantityMode,
      recipeBatches: produceRecipeBatches,
      customQuantity: produceQuantity,
    });

    if (!product || !canManuallyProduceProduct(product)) {
      alert("Selecione um item com receita e estoque físico para produzir. Itens sob demanda não são produzidos manualmente.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Informe uma quantidade válida para produzir.");
      return;
    }

    try {
      setIsCalculatingProducePreview(true);
      const preview = await calculateRecipeProduction(product.id, quantity);
      setProducePreview(preview);
    } catch (error: any) {
      console.error("Erro ao calcular produção:", error);
      alert(error?.message || "Erro ao calcular produção.");
    } finally {
      setIsCalculatingProducePreview(false);
    }
  }

  async function handleProduceItem() {
    const product = products.find((item) => item.id === produceProductId);
    const quantity = getProduceTargetQuantity({
      product,
      mode: produceQuantityMode,
      recipeBatches: produceRecipeBatches,
      customQuantity: produceQuantity,
    });

    if (!product || !canManuallyProduceProduct(product)) {
      alert("Selecione um item com receita e estoque físico para produzir. Itens sob demanda não são produzidos manualmente.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Informe uma quantidade válida para produzir.");
      return;
    }

    try {
      setIsProducingItem(true);

      const preview = producePreview ?? (await calculateRecipeProduction(product.id, quantity));
      const stockShortages = getProductionStockShortages(preview, products);

      if (stockShortages.length > 0) {
        setProducePreview(preview);
        alert(
          "A produção ultrapassa o estoque disponível. Ajuste a quantidade antes de confirmar.\n\n" +
            stockShortages
              .slice(0, 6)
              .map(
                (item) =>
                  `• ${item.ingredientName}: falta ${formatQtyUnit(
                    item.missingQuantity,
                    item.requiredUnit,
                  )}`,
              )
              .join("\n"),
        );
        return;
      }

      for (const item of preview.directRequirements ?? []) {
        if (item.isUnlimited) continue;

        const ingredient = products.find(
          (stockProduct) => stockProduct.id === item.ingredientProductId,
        );

        if (!ingredient || ingredient.unlimitedStock || !ingredient.trackStock) {
          continue;
        }

        const movementQuantity = convertRecipeQuantityToStockMovementQuantity({
          product: ingredient,
          quantity: Number(item.requiredQuantity ?? 0),
          unit: item.unit ?? ingredient.stockUnit ?? "unit",
        });

        if (!Number.isFinite(movementQuantity) || movementQuantity <= 0) {
          continue;
        }

        await createStockMovement({
          productId: ingredient.id,
          type: "out",
          quantity: movementQuantity,
          reason: `Produção de ${formatQtyUnit(quantity, preview.outputUnit)} de ${product.name}`,
        });
      }

      const producedQuantity = convertRecipeQuantityToStockMovementQuantity({
        product,
        quantity,
        unit: preview.outputUnit ?? product.recipeOutputUnit ?? product.stockUnit ?? "unit",
      });

      await createStockMovement({
        productId: product.id,
        type: "in",
        quantity: producedQuantity,
        reason: `Produção finalizada: ${formatQtyUnit(quantity, preview.outputUnit)} de ${product.name}`,
      });

      const refreshedProducts = await reloadStock();
      const refreshedProducedProduct =
        refreshedProducts.find((item) => item.id === product.id) ?? product;

      setSelectedProduct(refreshedProducedProduct);
      setShowProduceModal(false);
      setProducePreview(null);

      try {
        const analysis = await getRecipeAnalysis(product.id);
        setRecipeAnalysis(analysis);
      } catch {}

      alert(`${product.name} produzido e estoque atualizado.`);
    } catch (error: any) {
      console.error("Erro ao produzir item:", error);
      alert(error?.message || "Erro ao produzir item.");
    } finally {
      setIsProducingItem(false);
    }
  }

  function handleOpenMovement(
    product: StockProduct,
    type: "in" | "out" | "adjustment",
  ) {
    setSelectedProduct(product);
    setMovementType(type);
    setMovementQuantity(
      type === "adjustment" ? String(product.stockQuantity ?? 0) : "",
    );
    setMovementReason("");
    setShowMovementModal(true);
  }

  function handleAddStockItem() {
    setEditingStockItem(toEditableStockItem());
    setShowStockItemModal(true);
  }

  async function handleEditStockItem(product: StockProduct) {
    try {
      const fullProduct = await getProductById(product.id);

      setEditingStockItem({
        id: fullProduct.id,
        name: fullProduct.name,
        emoji: fullProduct.emoji ?? "📦",
        categoryId: fullProduct.categoryId ?? null,
        price: Number(fullProduct.price ?? 0),
        isStockOnly: fullProduct.isStockOnly ?? true,
        trackStock: fullProduct.trackStock ?? true,
        stockQuantity: Number(fullProduct.stockQuantity ?? 0),
        minStock: Number(fullProduct.minStock ?? 0),
        costMode: (fullProduct.costMode ?? "simple") as ProductCostMode,
        simpleCost:
          fullProduct.simpleCost == null
            ? null
            : Number(fullProduct.simpleCost),
        stockUnit: (fullProduct.stockUnit as StockUnit | null) ?? "unit",
        referenceQuantity:
          fullProduct.referenceQuantity == null
            ? null
            : Number(fullProduct.referenceQuantity),
        referenceCost:
          fullProduct.referenceCost == null
            ? null
            : Number(fullProduct.referenceCost),
        unitContentQuantity:
          (fullProduct as any).unitContentQuantity == null
            ? null
            : Number((fullProduct as any).unitContentQuantity),
        unitContentUnit:
          ((fullProduct as any).unitContentUnit as StockUnit | null) ?? "ml",
        madeOnDemand: Boolean(fullProduct.madeOnDemand),
        unlimitedStock: Boolean(fullProduct.unlimitedStock),
        recipeOutputQuantity:
          fullProduct.recipeOutputQuantity == null
            ? null
            : Number(fullProduct.recipeOutputQuantity),
        recipeOutputUnit:
          (fullProduct.recipeOutputUnit as StockUnit | null) ?? "unit",
        recipeItems: fullProduct.recipeItems ?? [],
        variationGroups: (fullProduct.variationGroups ?? []).map((group) => ({
          id: group.id,
          name: group.name,
          required: Boolean(group.required),
          selectionType: group.selectionType,
          options: (group.options ?? []).map((option) => ({
            id: option.id,
            name: option.name,
            priceModifier: Number(option.priceModifier ?? 0),
            costMode: (option as any).costMode ?? "simple",
            simpleCost:
              (option as any).simpleCost == null
                ? null
                : Number((option as any).simpleCost),
            stockUnit:
              ((option as any).stockUnit as StockUnit | null) ?? "unit",
            referenceQuantity:
              (option as any).referenceQuantity == null
                ? null
                : Number((option as any).referenceQuantity),
            referenceCost:
              (option as any).referenceCost == null
                ? null
                : Number((option as any).referenceCost),
            recipeItems: (option.recipeItems ?? []).map((item) => ({
              id: item.id,
              ingredientProductId: item.ingredientProductId,
              quantity: Number(item.quantity),
              unit: item.unit,
            })),
          })),
        })),
      });

      setShowStockItemModal(true);
    } catch (error) {
      console.error("Erro ao carregar item completo do estoque:", error);
      alert("Erro ao carregar item para edição.");
    }
  }

  async function handleDeleteStockItem(productId: string) {
    const confirmed = window.confirm(
      "Deseja realmente excluir este item de estoque?",
    );
    if (!confirmed) return;

    try {
      await deleteProduct(productId);

      setProducts((prev) => prev.filter((item) => item.id !== productId));

      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
        setMovements([]);
        setRecipeAnalysis(null);
        setCalculatorResult(null);
      }
    } catch (error) {
      console.error("Erro ao excluir item de estoque:", error);
      alert("Erro ao excluir item de estoque.");
    }
  }

  async function handleSaveStockItem(data: EditableStockItem) {
    try {
      if (!data.categoryId) {
        alert("Selecione uma categoria.");
        return;
      }

      setIsSavingStockItem(true);

      const payload: Omit<Product, "id"> & {
        unitContentQuantity?: number | null;
        unitContentUnit?: StockUnit | null;
      } = {
        name: data.name,
        price: data.price,
        categoryId: data.categoryId,
        emoji: data.emoji ?? "📦",
        isStockOnly: data.isStockOnly,
        trackStock: data.trackStock,
        stockQuantity: data.stockQuantity,
        minStock: data.minStock,
        costMode: data.costMode,
        simpleCost: data.simpleCost,
        stockUnit: data.stockUnit,
        referenceQuantity: data.referenceQuantity,
        referenceCost: data.referenceCost,
        unitContentQuantity: data.unitContentQuantity,
        unitContentUnit: data.unitContentUnit,
        madeOnDemand: data.madeOnDemand,
        unlimitedStock: data.unlimitedStock,
        recipeOutputQuantity: data.recipeOutputQuantity,
        recipeOutputUnit: data.recipeOutputUnit,
        recipeItems:
          data.costMode === "recipe"
            ? data.recipeItems
                .filter(
                  (item) =>
                    item.ingredientProductId && Number(item.quantity) > 0,
                )
                .map((item) => ({
                  id: item.id,
                  ingredientProductId: item.ingredientProductId,
                  quantity: Number(item.quantity),
                  unit: item.unit,
                }))
            : [],
        variationGroups: data.variationGroups.map((group) => ({
          id: group.id,
          name: group.name,
          required: group.required,
          selectionType: group.selectionType,
          options: group.options.map((option) => ({
            id: option.id,
            name: option.name,
            priceModifier: Number(option.priceModifier ?? 0),
            costMode: option.costMode,
            simpleCost: option.costMode === "simple" ? option.simpleCost : null,
            stockUnit: option.stockUnit,
            referenceQuantity:
              option.costMode === "simple" ? option.referenceQuantity : null,
            referenceCost:
              option.costMode === "simple" ? option.referenceCost : null,
            recipeItems:
              option.costMode === "recipe"
                ? (option.recipeItems ?? [])
                    .filter(
                      (item) =>
                        item.ingredientProductId && Number(item.quantity) > 0,
                    )
                    .map((item) => ({
                      id: item.id,
                      ingredientProductId: item.ingredientProductId,
                      quantity: Number(item.quantity),
                      unit: item.unit,
                    }))
                : [],
          })),
        })),
        environmentPrices: [],
      };

      if (data.id) {
        await updateProduct(data.id, payload);
      } else {
        await createProduct(payload);
      }

      const refreshed = await reloadStock();

      if (data.id) {
        const updatedSelected = refreshed.find((p) => p.id === data.id) ?? null;
        setSelectedProduct(updatedSelected);
      }

      setShowStockItemModal(false);
      setEditingStockItem(null);
    } catch (error) {
      console.error("Erro ao salvar item de estoque:", error);
      alert("Erro ao salvar item de estoque.");
    } finally {
      setIsSavingStockItem(false);
    }
  }

  async function handleSaveMovement() {
    if (!selectedProduct) return;

    const quantity = Number(movementQuantity);

    if (!Number.isFinite(quantity) || quantity < 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    if (movementType !== "adjustment" && quantity <= 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    try {
      setIsSavingMovement(true);

      const result = await createStockMovement({
        productId: selectedProduct.id,
        type: movementType,
        quantity,
        reason: movementReason.trim() || null,
      });

      setProducts((prev) =>
        prev.map((product) =>
          product.id === result.product.id
            ? { ...product, ...result.product }
            : product,
        ),
      );

      setSelectedProduct(result.product);
      setShowMovementModal(false);

      const updatedMovements = await getProductStockMovements(
        result.product.id,
      );
      setMovements(updatedMovements);

      await reloadStock();

      if (result.product.hasRecipe || result.product.costMode === "recipe") {
        try {
          const analysis = await getRecipeAnalysis(result.product.id);
          setRecipeAnalysis(analysis);
        } catch {}
      }
    } catch (error: any) {
      console.error("Erro ao salvar movimentação:", error);
      alert(error?.message || "Erro ao salvar movimentação");
    } finally {
      setIsSavingMovement(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const threshold = Number(profitWarningThreshold);

    return products.filter((product) => {
      const matchesSearch =
        term === "" ||
        product.name.toLowerCase().includes(term) ||
        (product.category?.name ?? "").toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (
        selectedCategoryId !== "all" &&
        product.category?.id !== selectedCategoryId
      ) {
        return false;
      }

      if (typeFilter === "stock_only" && !product.isStockOnly) return false;
      if (typeFilter === "recipe" && product.costMode !== "recipe")
        return false;
      if (typeFilter === "item" && product.isStockOnly) return false;
      if (typeFilter === "on_demand" && !product.madeOnDemand) return false;

      if (profitFilter !== "all") {
        const status = getProfitStatusWithMandatoryVariations(
          product,
          products,
          Number.isFinite(threshold) && threshold >= 0 ? threshold : 30,
        );

        if (profitFilter !== status) return false;
      }

      if (filter === "tracked") return product.trackStock;
      if (filter === "recipe")
        return Boolean(product.hasRecipe || product.costMode === "recipe");
      if (filter === "out") {
        if (product.madeOnDemand || product.hasRecipe || product.costMode === "recipe") {
          return getStockStatus(product, products).label === "Não produz";
        }

        return (
          !product.unlimitedStock &&
          product.trackStock &&
          product.stockQuantity <= 0
        );
      }

      if (filter === "low") {
        if (product.madeOnDemand || product.hasRecipe || product.costMode === "recipe") {
          return getStockStatus(product, products).label === "Produção baixa";
        }

        return (
          !product.unlimitedStock &&
          product.trackStock &&
          product.stockQuantity > 0 &&
          product.stockQuantity <= product.minStock
        );
      }

      if (filter === "ok") {
        if (product.madeOnDemand || product.hasRecipe || product.costMode === "recipe") {
          return getStockStatus(product, products).label === "Produção OK";
        }

        return (
          !product.unlimitedStock &&
          product.trackStock &&
          product.stockQuantity > product.minStock
        );
      }

      return true;
    });
  }, [
    products,
    search,
    filter,
    selectedCategoryId,
    typeFilter,
    profitFilter,
    profitWarningThreshold,
  ]);

  const lowCount = products.filter((p) => {
    if (p.madeOnDemand || p.hasRecipe || p.costMode === "recipe") {
      return getStockStatus(p, products).label === "Produção baixa";
    }

    return (
      !p.unlimitedStock &&
      p.trackStock &&
      p.stockQuantity > 0 &&
      p.stockQuantity <= p.minStock
    );
  }).length;

  const outCount = products.filter((p) => {
    if (p.madeOnDemand || p.hasRecipe || p.costMode === "recipe") {
      return getStockStatus(p, products).label === "Não produz";
    }

    return !p.unlimitedStock && p.trackStock && p.stockQuantity <= 0;
  }).length;

  const recipeProducts = useMemo(
    () =>
      products
        .filter((product) => canManuallyProduceProduct(product))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  const selectedProduceProduct = useMemo(
    () => recipeProducts.find((product) => product.id === produceProductId) ?? null,
    [recipeProducts, produceProductId],
  );

  const produceBaseRecipeQuantity = selectedProduceProduct
    ? getRecipeOutputQuantity(selectedProduceProduct)
    : 1;
  const produceOutputUnit = selectedProduceProduct
    ? getRecipeOutputUnit(selectedProduceProduct)
    : "unit";
  const produceTargetQuantity = getProduceTargetQuantity({
    product: selectedProduceProduct,
    mode: produceQuantityMode,
    recipeBatches: produceRecipeBatches,
    customQuantity: produceQuantity,
  });

  const produceStockShortages = useMemo(
    () => getProductionStockShortages(producePreview, products),
    [producePreview, products],
  );
  const produceExceedsStock = produceStockShortages.length > 0;

  const calculatorIntermediateGroups = useMemo(() => {
    const empty = {
      needed: [] as RecipeCalculatorResponse["nestedRequirements"],
      covered: [] as RecipeCalculatorResponse["nestedRequirements"],
    };

    if (!calculatorResult) return empty;

    const needed: RecipeCalculatorResponse["nestedRequirements"] = [];
    const covered: RecipeCalculatorResponse["nestedRequirements"] = [];

    for (const group of calculatorResult.nestedRequirements ?? []) {
      const directRequirement = calculatorResult.directRequirements.find(
        (item) => item.ingredientProductId === group.recipeProductId,
      );

      const alreadyCovered =
        !!directRequirement &&
        hasEnoughRequirementStock(
          {
            ...directRequirement,
            requiredQuantity: group.requiredQuantity,
            unit: group.unit,
          },
          products,
        );

      if (alreadyCovered) {
        covered.push(group);
      } else {
        needed.push(group);
      }
    }

    return { needed, covered };
  }, [calculatorResult]);

  const selectedRecipeItem = useMemo(() => {
    if (!selectedRecipeItemId) return null;

    const rootMatch =
      recipeAnalysis?.flatRequirements.find(
        (item) => item.ingredientProductId === selectedRecipeItemId,
      ) ?? null;

    if (rootMatch) return rootMatch;

    for (const nested of Object.values(nestedRecipeAnalyses)) {
      const match =
        nested.flatRequirements.find(
          (item) => item.ingredientProductId === selectedRecipeItemId,
        ) ?? null;

      if (match) return match;
    }

    return null;
  }, [recipeAnalysis, nestedRecipeAnalyses, selectedRecipeItemId]);

  const getRecipeItemCostLabel = useCallback(
    (item: RecipeAnalysisResponse["flatRequirements"][number]) => {
      return getIngredientFractionCostLabel(
        item,
        products,
        selectedProduct?.id ?? null,
        recipeAnalysis,
        nestedRecipeAnalyses,
      );
    },
    [products, selectedProduct, recipeAnalysis, nestedRecipeAnalyses],
  );
  const getVariationOptionCost = useCallback(
    (option: ProductVariationOption) => {
      return getVariationOptionRecipeCost({
        option,
        products,
        selectedRootProductId: selectedProduct?.id ?? null,
        rootAnalysis: recipeAnalysis,
        nestedRecipeAnalyses,
      });
    },
    [products, selectedProduct, recipeAnalysis, nestedRecipeAnalyses],
  );

  function toggleRecipeByProductId(productId: string) {
    setExpandedRecipeNodes((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  }

  const recipeFlowGraph = useMemo(() => {
    if (!selectedProduct || !recipeAnalysis) {
      return { nodes: [], edges: [] };
    }

    return buildRecipeFlowGraph({
      selectedProduct,
      recipeAnalysis,
      nestedRecipeAnalyses,
      expandedRecipeNodes,
      collapsingRecipeNodes,
      selectedRecipeItemId,
      getFractionCostLabel: getRecipeItemCostLabel,
      onSelectNode: (productId) => setSelectedRecipeItemId(productId),
      onToggleNode: (nodeKey, productId) => {
        void toggleRecipeNode(nodeKey, productId);
      },
      selectedVariationOptions,
      onToggleVariationOption: (group, option) => {
        toggleVariationOption(group, option);
      },
      currentRecipeTotalCost,
      selectedVariationExtraCost,
      getVariationOptionCost,
      products,
    });
  }, [
    selectedProduct,
    recipeAnalysis,
    nestedRecipeAnalyses,
    expandedRecipeNodes,
    collapsingRecipeNodes,
    selectedRecipeItemId,
    getRecipeItemCostLabel,
    selectedVariationOptions,
    currentRecipeTotalCost,
    selectedVariationExtraCost,
    getVariationOptionCost,
    products,
  ]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-muted-foreground">Carregando estoque...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col overflow-visible lg:h-full lg:overflow-hidden mobile-page-scroll">
      <div className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              Controle de estoque, custos, receitas e produção
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenProduceModal()}
            disabled={recipeProducts.length === 0}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-foreground hover:bg-secondary disabled:opacity-50 sm:flex-none"
            title={
              recipeProducts.length === 0
                ? "Cadastre um item com receita para produzir"
                : "Produzir item com receita"
            }
          >
            <FlaskConical className="h-4 w-4" />
            Produzir item
          </button>

          <button
            onClick={handleAddStockItem}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground hover:bg-primary/90 sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            Novo item
          </button>
        </div>
      </div>

      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-start">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-full flex-1 sm:min-w-[260px] sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar item..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 h-10 rounded-lg text-sm border ${
                    filter === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border"
                  }`}
                >
                  Todos
                </button>

                <button
                  onClick={() => setFilter("tracked")}
                  className={`px-3 h-10 rounded-lg text-sm border ${
                    filter === "tracked"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border"
                  }`}
                >
                  Controlados
                </button>

                <button
                  onClick={() => setFilter("recipe")}
                  className={`px-3 h-10 rounded-lg text-sm border ${
                    filter === "recipe"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border"
                  }`}
                >
                  Receitas
                </button>

                <button
                  onClick={() => setFilter("low")}
                  className={`px-3 h-10 rounded-lg text-sm border ${
                    filter === "low"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border"
                  }`}
                >
                  Baixo
                </button>

                <button
                  onClick={() => setFilter("out")}
                  className={`px-3 h-10 rounded-lg text-sm border ${
                    filter === "out"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border"
                  }`}
                >
                  Zerado
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-stretch">
              <div className="rounded-xl border border-border bg-background px-3 py-2 min-w-[190px]">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Categoria
                </p>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                >
                  <option value="all">Todas categorias</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.emoji ? `${category.emoji} ` : ""}
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-border bg-background px-3 py-2 min-w-[170px]">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Tipo
                </p>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as ProductTypeFilter)
                  }
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="stock_only">Só estoque</option>
                  <option value="recipe">Receita</option>
                  <option value="item">Item de venda</option>
                  <option value="on_demand">Sob demanda</option>
                </select>
              </div>

              <div className="rounded-xl border border-border bg-background px-3 py-2 min-w-[170px]">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Lucro
                </p>
                <select
                  value={profitFilter}
                  onChange={(e) =>
                    setProfitFilter(e.target.value as ProfitFilter)
                  }
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="good">Lucro bom</option>
                  <option value="warning">Lucro baixo</option>
                  <option value="negative">Lucro negativo</option>
                  <option value="no_profit">Sem lucro</option>
                </select>
              </div>

              <div className="rounded-xl border border-border bg-background px-3 py-2 min-w-[150px]">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Alerta
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">&lt;</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={profitWarningThreshold}
                    onChange={(e) => setProfitWarningThreshold(e.target.value)}
                    className="w-16 bg-transparent outline-none text-sm text-foreground"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setFilter("all");
                  setSelectedCategoryId("all");
                  setTypeFilter("all");
                  setProfitFilter("all");
                }}
                className="h-12 rounded-xl border border-border bg-background px-4 text-sm text-foreground hover:bg-secondary sm:h-[60px]"
              >
                Limpar filtros
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() =>
                setFilter((current) => (current === "low" ? "all" : "low"))
              }
              className={`inline-flex items-center justify-between rounded-lg px-3 h-10 border transition ${
                filter === "low"
                  ? "border-warning bg-warning text-warning-foreground"
                  : "border-warning/30 bg-warning/10 hover:bg-warning/15"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    filter === "low"
                      ? "text-warning-foreground"
                      : "text-warning"
                  }`}
                />
                <span
                  className={`text-xs uppercase truncate ${
                    filter === "low"
                      ? "text-warning-foreground"
                      : "text-warning"
                  }`}
                >
                  Baixo
                </span>
              </div>
              <span
                className={`text-sm font-semibold ${
                  filter === "low" ? "text-warning-foreground" : "text-warning"
                }`}
              >
                {lowCount}
              </span>
            </button>

            <button
              onClick={() =>
                setFilter((current) => (current === "out" ? "all" : "out"))
              }
              className={`inline-flex items-center justify-between rounded-lg px-3 h-10 border transition ${
                filter === "out"
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-destructive/30 bg-destructive/10 hover:bg-destructive/15"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <PackageX
                  className={`h-4 w-4 ${
                    filter === "out"
                      ? "text-destructive-foreground"
                      : "text-destructive"
                  }`}
                />
                <span
                  className={`text-xs uppercase truncate ${
                    filter === "out"
                      ? "text-destructive-foreground"
                      : "text-destructive"
                  }`}
                >
                  Zerado
                </span>
              </div>
              <span
                className={`text-sm font-semibold ${
                  filter === "out"
                    ? "text-destructive-foreground"
                    : "text-destructive"
                }`}
              >
                {outCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-visible p-4 sm:p-6 lg:overflow-hidden">
        <div className="overflow-visible rounded-xl border border-border bg-card lg:h-full lg:overflow-auto">
          <table className="hidden w-full min-w-[1180px] xl:table">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-card shadow-sm">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Item
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Categoria
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Atual
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Unidade
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Tipo
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Custo
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Lucro %
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Produção possível
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground bg-card">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => {
                const status = getStockStatus(product, products);
                const costData = getProductCostWithMandatoryVariations({
                  product,
                  products,
                });
                const costText = getCostDisplay(product);
                const finalCostText =
                  costData.finalCost != null
                    ? formatBRL(costData.finalCost)
                    : costText;
                const hasMandatoryVariationAverage =
                  costData.variationGroups.length > 0;
                const profitPercentage =
                  getProfitPercentageWithMandatoryVariations({
                    product,
                    products,
                  });
                const subtitle = getSubtitle(product);
                const disableStockMove =
                  product.madeOnDemand || product.unlimitedStock;

                return (
                  <tr
                    key={product.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {product.emoji || "📦"}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            {product.name}
                          </p>
                          {subtitle && (
                            <p className="text-xs text-muted-foreground">
                              {subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {product.category?.name ?? "-"}
                    </td>

                    <td className="px-4 py-3 text-center font-semibold text-foreground">
                      {product.madeOnDemand
                        ? product.expectedYield
                        : product.unlimitedStock
                          ? "∞"
                          : product.trackStock
                            ? formatStockQuantityWithUnitContent(product)
                            : "-"}
                    </td>

                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {formatStockUnitWithUnitContent(product)}
                    </td>

                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {product.costMode === "recipe"
                        ? product.madeOnDemand
                          ? "Sob demanda"
                          : "Receita"
                        : product.isStockOnly
                          ? "Só estoque"
                          : "Item"}
                    </td>

                    <td className="px-4 py-3 text-center text-sm">
                      {costText ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCostModal(product)}
                          className="inline-flex flex-col items-center rounded-lg border border-border bg-background px-3 py-2 hover:bg-secondary transition"
                        >
                          <span className="font-semibold text-foreground">
                            {finalCostText}
                          </span>
                          <span
                            className={`text-[11px] mt-1 ${
                              product.costMode === "recipe"
                                ? "text-primary font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {hasMandatoryVariationAverage
                              ? "Receita Base"
                              : getCostLabel(product)}
                          </span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center text-sm">
                      {!product.isStockOnly && profitPercentage != null ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${
                            profitPercentage < 0
                              ? "bg-destructive/15 text-destructive border-destructive/30"
                              : profitPercentage <
                                  (Number(profitWarningThreshold) || 30)
                                ? "bg-warning/15 text-warning border-warning/30"
                                : "bg-success/15 text-success border-success/30"
                          }`}
                        >
                          {profitPercentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center text-sm">
                      {product.hasRecipe || product.costMode === "recipe" ? (
                        <span className="font-semibold text-foreground">
                          {product.expectedYield != null
                            ? `${product.expectedYield} ${product.recipeOutputUnit ?? ""}`.trim()
                            : "-"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {getMissingQuantityToMinimum(product) > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleAddMissingProductToBuyCart(product)
                          }
                          disabled={isAddingToBuyCart}
                          title={`Adicionar ${formatQtyUnit(getMissingQuantityToMinimum(product), product.stockUnit ?? "unit")} ao carrinho para atingir o mínimo`}
                          className={`inline-flex px-2 py-1 rounded-full text-xs ${status.className} hover:opacity-80 disabled:opacity-50`}
                        >
                          {status.label} • comprar
                        </button>
                      ) : (product.hasRecipe || product.costMode === "recipe" || product.madeOnDemand) &&
                        (status.label === "Não produz" || status.label === "Produção baixa") ? (
                        <button
                          type="button"
                          onClick={() => openRecipeBuySuggestionModal(product)}
                          disabled={isAddingToBuyCart || isLoadingRecipeBuySuggestion}
                          title="Adicionar ingredientes faltantes da receita ao carrinho"
                          className={`inline-flex px-2 py-1 rounded-full text-xs ${status.className} hover:opacity-80 disabled:opacity-50`}
                        >
                          {status.label} • ingredientes
                        </button>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs ${status.className}`}
                        >
                          {status.label}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <ActionIconButton
                          onClick={() => handleEditStockItem(product)}
                          title="Editar"
                          className="border-border hover:bg-secondary"
                        >
                          <Pencil className="h-4 w-4" />
                        </ActionIconButton>

                        <ActionIconButton
                          onClick={() => handleDeleteStockItem(product.id)}
                          title="Excluir"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </ActionIconButton>

                        <ActionIconButton
                          onClick={() => handleOpenMovement(product, "adjustment")}
                          title="Movimentar estoque"
                          className="border-primary/30 text-primary hover:bg-primary/10"
                          disabled={disableStockMove}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </ActionIconButton>

                        {(product.hasRecipe ||
                          product.costMode === "recipe") && (
                          <>
                            <ActionIconButton
                              onClick={() => handleOpenRecipe(product)}
                              title="Receita"
                              className="border-border hover:bg-secondary"
                            >
                              <FlaskConical className="h-4 w-4" />
                            </ActionIconButton>

                            <ActionIconButton
                              onClick={() => handleOpenCalculator(product)}
                              title="Calcular"
                              className="border-border hover:bg-secondary"
                            >
                              <Calculator className="h-4 w-4" />
                            </ActionIconButton>

                            {canManuallyProduceProduct(product) && (
                              <ActionIconButton
                                onClick={() => handleOpenProduceModal(product.id)}
                                title="Produzir item"
                                className="border-primary/30 text-primary hover:bg-primary/10"
                              >
                                <Sparkles className="h-4 w-4" />
                              </ActionIconButton>
                            )}
                          </>
                        )}

                        <ActionIconButton
                          onClick={() => handleOpenHistory(product)}
                          title="Histórico"
                          className="border-border hover:bg-secondary"
                        >
                          <History className="h-4 w-4" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="grid gap-3 p-3 xl:hidden">
            {filteredProducts.map((product) => {
              const status = getStockStatus(product, products);
              const costData = getProductCostWithMandatoryVariations({
                product,
                products,
              });
              const costText = getCostDisplay(product);
              const finalCostText =
                costData.finalCost != null
                  ? formatBRL(costData.finalCost)
                  : costText;
              const profitPercentage =
                getProfitPercentageWithMandatoryVariations({
                  product,
                  products,
                });
              const disableStockMove =
                product.madeOnDemand || product.unlimitedStock;

              return (
                <div key={product.id} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-3xl">{product.emoji || "📦"}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{product.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{product.category?.name ?? "-"}</p>
                      </div>
                    </div>

                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Estoque</p>
                      <p className="font-semibold text-foreground">
                        {product.madeOnDemand
                          ? product.expectedYield
                          : product.unlimitedStock
                            ? "∞"
                            : product.trackStock
                              ? formatStockQuantityWithUnitContent(product)
                              : "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Custo</p>
                      <p className="font-semibold text-foreground">{finalCostText || "-"}</p>
                    </div>

                    <div className="rounded-xl bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className={`font-semibold ${
                        profitPercentage == null
                          ? "text-muted-foreground"
                          : profitPercentage < 0
                            ? "text-destructive"
                            : profitPercentage < (Number(profitWarningThreshold) || 30)
                              ? "text-warning"
                              : "text-success"
                      }`}>
                        {!product.isStockOnly && profitPercentage != null ? `${profitPercentage.toFixed(1)}%` : "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Produção</p>
                      <p className="font-semibold text-foreground">
                        {product.hasRecipe || product.costMode === "recipe"
                          ? product.expectedYield != null
                            ? `${product.expectedYield} ${product.recipeOutputUnit ?? ""}`.trim()
                            : "-"
                          : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <ActionIconButton onClick={() => handleEditStockItem(product)} title="Editar" className="border-border hover:bg-secondary">
                      <Pencil className="h-4 w-4" />
                    </ActionIconButton>
                    <ActionIconButton onClick={() => handleOpenMovement(product, "adjustment")} title="Movimentar estoque" className="border-primary/30 text-primary hover:bg-primary/10" disabled={disableStockMove}>
                      <SlidersHorizontal className="h-4 w-4" />
                    </ActionIconButton>
                    <ActionIconButton onClick={() => handleOpenHistory(product)} title="Histórico" className="border-border hover:bg-secondary">
                      <History className="h-4 w-4" />
                    </ActionIconButton>
                  </div>

                  {(product.hasRecipe || product.costMode === "recipe") && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => handleOpenRecipe(product)} className="h-10 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary">
                        Receita
                      </button>
                      <button type="button" onClick={() => handleOpenCalculator(product)} className="h-10 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary">
                        Calcular
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">
              Nenhum item encontrado.
            </div>
          )}
        </div>
      </div>

      {showHistoryModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground">Histórico</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedProduct.name}
                </p>
              </div>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {isLoadingMovements ? (
                <div className="text-sm text-muted-foreground">
                  Carregando movimentações...
                </div>
              ) : movements.length > 0 ? (
                <div className="space-y-3">
                  {movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs ${
                            movement.type === "in"
                              ? "bg-success/15 text-success"
                              : movement.type === "out"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {movement.type === "in"
                            ? "Entrada"
                            : movement.type === "out"
                              ? "Saída"
                              : "Ajuste"}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          {new Date(movement.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>

                      <div className="mt-3 text-sm">
                        <p className="text-foreground">
                          Quantidade: <strong>{movement.quantity}</strong>
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {movement.previousQty} → {movement.newQty}
                        </p>
                        {movement.reason && (
                          <p className="text-muted-foreground mt-2">
                            Motivo: {movement.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Nenhuma movimentação encontrada.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecipeModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[94svh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-xl sm:max-h-[92vh] sm:rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                  {selectedProduct.emoji || "📦"}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-lg">
                    Receita · {selectedProduct.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Visualização da estrutura da receita e do estoque disponível
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecipeViewMode("flow")}
                  className={`h-10 px-3 rounded-lg border inline-flex items-center gap-2 ${
                    recipeViewMode === "flow"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <GitBranch className="h-4 w-4" />
                  Fluxo
                </button>

                <button
                  onClick={() => setRecipeViewMode("list")}
                  className={`h-10 px-3 rounded-lg border inline-flex items-center gap-2 ${
                    recipeViewMode === "list"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <ListTree className="h-4 w-4" />
                  Lista
                </button>

                <button
                  onClick={() => setShowRecipeModal(false)}
                  className="h-10 w-10 rounded-lg border border-border hover:bg-secondary inline-flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto p-4 sm:p-5">
              {isLoadingRecipe ? (
                <div className="text-sm text-muted-foreground">
                  Carregando receita...
                </div>
              ) : recipeAnalysis ? (
                <>
                  <div className="grid md:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Custo do lote
                      </p>
                      <p className="text-lg font-semibold text-foreground mt-1">
                        {formatBRL(recipeAnalysis.recipeCost)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Produz
                      </p>
                      <p className="text-lg font-semibold text-foreground mt-1">
                        {formatQtyUnit(
                          recipeAnalysis.outputQuantity ?? 0,
                          recipeAnalysis.outputUnit,
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Produção possível
                      </p>
                      <p className="text-lg font-semibold text-foreground mt-1">
                        {recipeAnalysis.expectedYield != null
                          ? formatQtyUnit(
                              recipeAnalysis.expectedYield,
                              recipeAnalysis.outputUnit,
                            )
                          : "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Ingrediente limitante
                      </p>
                      <p className="text-lg font-semibold text-foreground mt-1">
                        {recipeAnalysis.limitingIngredient?.name ?? "-"}
                      </p>
                    </div>
                  </div>

                  {recipeViewMode === "flow" ? (
                    <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
                      <div className="rounded-2xl border border-border bg-background overflow-hidden h-[700px]">
                        <ReactFlow
                          nodes={recipeFlowGraph.nodes}
                          edges={recipeFlowGraph.edges}
                          nodeTypes={recipeNodeTypes}
                          fitView
                          fitViewOptions={{ padding: 0.25 }}
                          minZoom={0.35}
                          maxZoom={2}
                          nodesDraggable={false}
                          nodesConnectable={false}
                          elementsSelectable
                          panOnDrag
                          zoomOnScroll
                          zoomOnPinch
                          zoomOnDoubleClick={false}
                          proOptions={{ hideAttribution: true }}
                          defaultEdgeOptions={{
                            type: "bezier",
                            markerEnd: { type: MarkerType.ArrowClosed },
                            style: { strokeWidth: 2, stroke: "#64748b" },
                          }}
                        >
                          <Background gap={24} size={1} />
                        </ReactFlow>
                      </div>

                      <div className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold text-foreground">
                            Detalhes e custo atual
                          </p>
                        </div>

                        {selectedRecipeItem ? (
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
                              <p className="text-lg font-semibold text-foreground">
                                {selectedRecipeItem.ingredientName}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {selectedRecipeItem.isUnlimited
                                  ? "Este item não limita a produção."
                                  : "Visualização detalhada do papel deste ingrediente na receita."}
                              </p>
                            </div>

                            <div className="grid gap-3">
                              <div className="rounded-xl border border-border bg-card p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Custo base
                                </p>
                                <p className="text-lg font-semibold text-foreground mt-1">
                                  {formatBRL(baseRecipeCost)}
                                </p>
                              </div>

                              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Variações selecionadas
                                </p>
                                {selectedVariationBreakdown.length > 0 ? (
                                  <>
                                    {selectedVariationBreakdown.map((line) => (
                                      <div
                                        key={line.optionId}
                                        className="flex items-center justify-between text-sm"
                                      >
                                        <span className="text-muted-foreground">
                                          + {line.groupName}: {line.optionName}
                                        </span>
                                        <span className="font-medium text-foreground">
                                          {formatBRL(line.extraCost)}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="pt-2 border-t border-border flex items-center justify-between">
                                      <span className="font-semibold text-foreground">
                                        Total atual
                                      </span>
                                      <span className="text-lg font-bold text-foreground">
                                        {formatBRL(currentRecipeTotalCost)}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    Nenhuma variação selecionada.
                                  </p>
                                )}
                              </div>

                              <div className="rounded-xl border border-border bg-card p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Necessário
                                </p>
                                <p className="text-lg font-semibold text-foreground mt-1">
                                  {formatQtyUnit(
                                    selectedRecipeItem.requiredQuantity,
                                    selectedRecipeItem.unit,
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl border border-border bg-card p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Em estoque
                                </p>
                                <p className="text-lg font-semibold text-foreground mt-1">
                                  {getDisplayStockAvailableForRequirement(selectedRecipeItem, products)}
                                </p>
                              </div>

                              <div className="rounded-xl border border-border bg-card p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Custo usado
                                </p>
                                <p className="text-lg font-semibold text-foreground mt-1">
                                  {getRecipeItemCostLabel(selectedRecipeItem) ??
                                    "-"}
                                </p>
                              </div>

                              <div className="rounded-xl border border-border bg-card p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Situação
                                </p>
                                <div className="mt-2">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                      getRecipeItemVisualStatus(selectedRecipeItem, products).badgeClass
                                    }`}
                                  >
                                    {
                                      getRecipeItemVisualStatus(selectedRecipeItem, products).label
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>

                            {!selectedRecipeItem.isUnlimited &&
                              !getRecipeItemVisualStatus(selectedRecipeItem, products).enough && (
                                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                                  <p className="text-sm font-medium text-warning">
                                    Estoque insuficiente para esta receita
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Verifique reposição ou ajuste a quantidade
                                    produzida.
                                  </p>
                                </div>
                              )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                              Selecione um ingrediente no fluxo para ver mais
                              detalhes.
                            </div>
                            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Composição do custo atual
                              </p>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Custo base
                                </span>
                                <span className="font-medium text-foreground">
                                  {formatBRL(baseRecipeCost)}
                                </span>
                              </div>
                              {selectedVariationBreakdown.map((line) => (
                                <div
                                  key={line.optionId}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="text-muted-foreground">
                                    + {line.groupName}: {line.optionName}
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {formatBRL(line.extraCost)}
                                  </span>
                                </div>
                              ))}
                              <div className="pt-2 border-t border-border flex items-center justify-between">
                                <span className="font-semibold text-foreground">
                                  Total atual
                                </span>
                                <span className="text-lg font-bold text-foreground">
                                  {formatBRL(currentRecipeTotalCost)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Ingredientes da receita
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expanda ingredientes que também são receitas para
                            ver a composição completa.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {recipeAnalysis.flatRequirements.map((item, index) => (
                          <RecipeListItem
                            key={`recipe-root-${item.ingredientProductId}-${item.unit}-${index}`}
                            item={item}
                            nodeKey={`recipe-root-${item.ingredientProductId}-${index}`}
                            depth={0}
                            products={products}
                            selectedProductId={selectedProduct?.id ?? null}
                            recipeAnalysis={recipeAnalysis}
                            nestedRecipeAnalyses={nestedRecipeAnalyses}
                            expandedRecipeNodes={expandedRecipeNodes}
                            selectedRecipeItemId={selectedRecipeItemId}
                            onSelect={setSelectedRecipeItemId}
                            onToggle={(nodeKey, productId) => {
                              void toggleRecipeNode(nodeKey, productId);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Nenhuma receita encontrada.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCalculatorModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground">
                  Calcular produção
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedProduct.name}
                </p>
              </div>

              <button
                onClick={() => setShowCalculatorModal(false)}
                className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={calculatorQuantity}
                  onChange={(e) => setCalculatorQuantity(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                  placeholder="Quantidade"
                />
                <button
                  onClick={handleCalculateRecipe}
                  disabled={isCalculating}
                  className="h-10 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isCalculating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  Calcular
                </button>
              </div>

              {calculatorResult ? (
                <div className="rounded-xl border border-border bg-background p-4 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Resultado da produção
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Para produzir {calculatorResult.requestedQuantity}{" "}
                        {calculatorResult.outputUnit === "unit"
                          ? "unit"
                          : calculatorResult.outputUnit}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-[180px]">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Custo total
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {formatBRL(calculatorResult.totalCost)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Unitário: {formatBRL(calculatorResult.unitCost)}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const hasMissingBuyableItems = (() => {
                      for (const item of calculatorResult.directRequirements ?? []) {
                        if (item.isUnlimited) continue;
                        const product = products.find((productItem) => productItem.id === item.ingredientProductId);
                        if (!product || !isBuyableStockProduct(product)) continue;
                        const missingQuantity = getRequirementMissingQuantity(item, undefined, products);
                        if (hasMissingQuantity(missingQuantity)) return true;
                      }

                      for (const group of calculatorIntermediateGroups.needed) {
                        for (const item of group.baseItems ?? []) {
                          const product = products.find((productItem) => productItem.id === item.ingredientProductId);
                          if (!product || !isBuyableStockProduct(product)) continue;
                          if (hasMissingQuantity(Number(item.missingQuantity ?? 0))) return true;
                        }
                      }

                      return false;
                    })();

                    if (!hasMissingBuyableItems) return null;

                    return (
                                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                                          <div>
                                            <p className="text-sm font-semibold text-foreground">
                                              Itens faltantes
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Adicione ao carrinho apenas os ingredientes base que
                                              precisam ser comprados.
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={handleAddCalculatorMissingItemsToBuyCart}
                                            disabled={isAddingToBuyCart}
                                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                          >
                                            {isAddingToBuyCart ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <ShoppingCart className="h-4 w-4" />
                                            )}
                                            Adicionar faltantes ao carrinho
                                          </button>
                                        </div>
                    );
                  })()}

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-3">
                      Ingredientes da receita
                    </p>
                    <div className="space-y-3">
                      {calculatorResult.directRequirements.map((item) => {
                        const enoughStock = hasEnoughRequirementStock(item, products);

                        return (
                          <div
                            key={`${item.ingredientProductId}-${item.unit}`}
                            className="rounded-xl border border-border p-4 bg-card"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-medium text-foreground">
                                  {item.ingredientName}
                                </p>
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                  <p>
                                    Necessário:{" "}
                                    <span className="text-foreground">
                                      {formatQtyUnit(
                                        item.requiredQuantity,
                                        item.unit,
                                      )}
                                    </span>
                                  </p>
                                  <p>
                                    Em estoque:{" "}
                                    <span className="text-foreground">
                                      {getDisplayStockAvailableForRequirement(
                                          item as RecipeAnalysisResponse["flatRequirements"][number],
                                          products,
                                        )}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              {enoughStock ? (
                                <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2.5 py-1 text-xs font-medium border border-success/30 whitespace-nowrap">
                                  Em estoque
                                </span>
                              ) : (
                                (() => {
                                  const product = products.find(
                                    (p) => p.id === item.ingredientProductId,
                                  );
                                  const missingQuantity = getRequirementMissingQuantity(item);

                                  return product &&
                                    isBuyableStockProduct(product) &&
                                    missingQuantity > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAddRequirementToBuyCart({
                                          productId: item.ingredientProductId,
                                          quantity: missingQuantity,
                                          unit: item.unit,
                                        })
                                      }
                                      disabled={isAddingToBuyCart}
                                      className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2.5 py-1 text-xs font-medium border border-warning/30 whitespace-nowrap hover:bg-warning/25 disabled:opacity-50"
                                    >
                                      Comprar falta
                                    </button>
                                  ) : null;
                                })()
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {calculatorIntermediateGroups.needed.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-3">
                        Intermediários que precisam ser produzidos
                      </p>

                      <div className="space-y-4">
                        {calculatorIntermediateGroups.needed.map((group) => (
                          <div
                            key={group.recipeProductId}
                            className="rounded-xl border border-warning/30 bg-warning/5 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  {group.recipeProductName}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Produzir:{" "}
                                  {formatQtyUnit(
                                    group.requiredQuantity,
                                    group.unit,
                                  )}
                                </p>
                              </div>

                              <span className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2.5 py-1 text-xs font-medium border border-warning/30 whitespace-nowrap">
                                Produção necessária
                              </span>
                            </div>

                            <div className="mt-4 space-y-3">
                              {group.baseItems.map((item, index) => {
                                const itemCovered =
                                  item.isUnlimited ||
                                  !hasMissingQuantity(item.missingQuantity);

                                return (
                                  <div
                                    key={`${group.recipeProductId}-${item.ingredientProductId}-${index}`}
                                    className="rounded-lg border border-border bg-background p-3"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="font-medium text-foreground">
                                          {item.ingredientName}
                                        </p>
                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                          <p>
                                            Necessário:{" "}
                                            <span className="text-foreground">
                                              {formatQtyUnit(
                                                item.requiredQuantity,
                                                item.unit,
                                              )}
                                            </span>
                                          </p>
                                          <p>
                                            Em estoque:{" "}
                                            <span className="text-foreground">
                                              {getDisplayStockAvailableForRequirement(
                                                item as RecipeAnalysisResponse["flatRequirements"][number],
                                                products,
                                              )}
                                            </span>
                                          </p>

                                          {!itemCovered && (
                                            <p>
                                              Falta:{" "}
                                              <span className="text-destructive font-medium">
                                                {formatQtyUnit(
                                                  item.missingQuantity,
                                                  item.unit,
                                                )}
                                              </span>
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {itemCovered ? (
                                        <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2.5 py-1 text-xs font-medium border border-success/30 whitespace-nowrap">
                                          Em estoque
                                        </span>
                                      ) : (
                                        (() => {
                                          const product = products.find(
                                            (p) =>
                                              p.id === item.ingredientProductId,
                                          );

                                          return product &&
                                            isBuyableStockProduct(product) ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleAddRequirementToBuyCart({
                                                  productId:
                                                    item.ingredientProductId,
                                                  quantity: Number(
                                                    item.missingQuantity ?? 0,
                                                  ),
                                                  unit: item.unit,
                                                })
                                              }
                                              disabled={isAddingToBuyCart}
                                              className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2.5 py-1 text-xs font-medium border border-warning/30 whitespace-nowrap hover:bg-warning/25 disabled:opacity-50"
                                            >
                                              Comprar falta
                                            </button>
                                          ) : null;
                                        })()
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {calculatorIntermediateGroups.covered.length > 0 && (
                    <details className="rounded-xl border border-border bg-card overflow-hidden">
                      <summary className="list-none cursor-pointer px-4 py-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Intermediários já cobertos pelo estoque
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Opcional — veja a decomposição das receitas se
                            quiser
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2.5 py-1 text-xs font-medium border border-success/30">
                            {calculatorIntermediateGroups.covered.length}{" "}
                            coberto(s)
                          </span>
                        </div>
                      </summary>

                      <div className="px-4 pb-4 space-y-4">
                        {calculatorIntermediateGroups.covered.map((group) => (
                          <div
                            key={group.recipeProductId}
                            className="rounded-xl border border-border bg-background p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  {group.recipeProductName}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Necessário:{" "}
                                  {formatQtyUnit(
                                    group.requiredQuantity,
                                    group.unit,
                                  )}
                                </p>
                              </div>

                              <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2.5 py-1 text-xs font-medium border border-success/30 whitespace-nowrap">
                                Já em estoque
                              </span>
                            </div>

                            <div className="mt-4 space-y-3">
                              {group.baseItems.map((item, index) => {
                                const itemCovered =
                                  item.isUnlimited ||
                                  !hasMissingQuantity(item.missingQuantity);

                                return (
                                  <div
                                    key={`${group.recipeProductId}-${item.ingredientProductId}-${index}`}
                                    className="rounded-lg border border-border bg-card p-3"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="font-medium text-foreground">
                                          {item.ingredientName}
                                        </p>
                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                          <p>
                                            Necessário:{" "}
                                            <span className="text-foreground">
                                              {formatQtyUnit(
                                                item.requiredQuantity,
                                                item.unit,
                                              )}
                                            </span>
                                          </p>
                                          <p>
                                            Em estoque:{" "}
                                            <span className="text-foreground">
                                              {getDisplayStockAvailableForRequirement(
                                                item as RecipeAnalysisResponse["flatRequirements"][number],
                                                products,
                                              )}
                                            </span>
                                          </p>

                                          {!itemCovered && (
                                            <p>
                                              Falta:{" "}
                                              <span className="text-destructive font-medium">
                                                {formatQtyUnit(
                                                  item.missingQuantity,
                                                  item.unit,
                                                )}
                                              </span>
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {itemCovered && (
                                        <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2.5 py-1 text-xs font-medium border border-success/30 whitespace-nowrap">
                                          Em estoque
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showMovementModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-xl sm:rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground">
                  {movementType === "adjustment"
                    ? "Ajustar estoque"
                    : "Movimentar estoque"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedProduct.name}
                </p>
              </div>

              <button
                onClick={() => setShowMovementModal(false)}
                className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tipo
                </label>
                <select
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(
                      e.target.value as "in" | "out" | "adjustment",
                    )
                  }
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border"
                >
                  <option value="in">Entrada</option>
                  <option value="out">Saída</option>
                  <option value="adjustment">Ajuste</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {movementType === "adjustment"
                    ? "Novo estoque final"
                    : "Quantidade"}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border"
                  placeholder={
                    movementType === "adjustment"
                      ? "Novo estoque final"
                      : "Quantidade"
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Motivo
                </label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border"
                  placeholder="Ex: reposição, quebra, correção..."
                />
              </div>

              <div className="rounded-xl border border-border bg-background p-4 text-sm">
                <p className="text-muted-foreground">Estoque atual</p>
                <p className="text-lg font-bold text-foreground">
                  {selectedProduct.unlimitedStock
                    ? "∞"
                    : selectedProduct.madeOnDemand
                      ? "Sob demanda"
                      : formatStockQuantityWithUnitContent(selectedProduct)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={() => setShowMovementModal(false)}
                className="h-10 px-4 rounded-lg border border-border hover:bg-secondary"
              >
                Cancelar
              </button>

              <button
                onClick={handleSaveMovement}
                disabled={isSavingMovement}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isSavingMovement ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Salvar movimentação
              </button>
            </div>
          </div>
        </div>
      )}

      {showCostModal && costProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-card border border-border shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground text-lg">
                  Análise de custo
                </h2>
                <p className="text-sm text-muted-foreground">
                  {costProduct.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCostModal(false)}
                className="h-10 w-10 rounded-lg border border-border hover:bg-secondary inline-flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid xl:grid-cols-[320px_minmax(0,1fr)] gap-5">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Custo base
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatBRL(costModalBaseCost)}
                  </p>
                </div>

                {costModalMandatoryAverage.groups.length > 0 && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        Média das variações obrigatórias
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Visual apenas. O custo final abaixo só muda quando você
                        seleciona uma variação.
                      </p>
                    </div>

                    {costModalMandatoryAverage.groups.map((group) => (
                      <div
                        key={group.groupId}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {group.groupName}
                          {group.usedSelectedOptions
                            ? " selecionada"
                            : ` média (${group.optionsCount})`}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatBRL(group.averageCost)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    Variações selecionadas
                  </p>

                  {costModalSelectedBreakdown.length > 0 ? (
                    costModalSelectedBreakdown.map((line) => (
                      <div
                        key={line.optionId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {line.groupName}: {line.optionName}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatBRL(line.extraCost)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma variação selecionada.
                    </p>
                  )}

                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Custo final
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatBRL(costModalFinalCost)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Preço final
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatBRL(costModalFinalPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Lucro
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatBRL(costModalProfitAmount)}
                        {costModalProfitPercent != null
                          ? ` (${costModalProfitPercent.toFixed(1)}%)`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {(costProduct.variationGroups ?? []).length === 0 && (
                  <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    Este produto não possui grupos de variação carregados.
                    Verifique se as variações estão salvas no produto.
                  </div>
                )}

                {(costProduct.variationGroups ?? []).map((group) => (
                  <div
                    key={group.id}
                    className="rounded-2xl border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="font-semibold text-foreground">
                          {group.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {group.selectionType === "single"
                            ? "Seleção única"
                            : "Seleção múltipla"}
                          {group.required ? " • Obrigatória" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {(group.options ?? []).map((option) => {
                        const isSelected = (
                          costSelectedVariationOptions[group.id] ?? []
                        ).includes(option.id);
                        const optionCost = getVariationOptionRecipeCost({
                          option,
                          products,
                          selectedRootProductId: costProduct.id,
                          rootAnalysis: costRecipeAnalysis,
                          nestedRecipeAnalyses: {},
                        });
                        const optionItems = option.recipeItems ?? [];

                        return (
                          <div
                            key={option.id}
                            className={`rounded-xl border p-4 transition ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  {option.name}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Extra custo: {formatBRL(optionCost)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Extra preço:{" "}
                                  {formatBRL(Number(option.priceModifier ?? 0))}
                                </p>
                              </div>

                              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                                <input
                                  type={
                                    group.selectionType === "single"
                                      ? "radio"
                                      : "checkbox"
                                  }
                                  name={`cost-group-${group.id}`}
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleCostVariationOption(group, option)
                                  }
                                  className="h-4 w-4"
                                />
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-secondary text-secondary-foreground"
                                  }`}
                                >
                                  {isSelected ? "Selecionada" : "Selecionar"}
                                </span>
                              </label>
                            </div>

                            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                              <span className="text-muted-foreground">
                                Custo final com esta opção
                              </span>
                              <span className="font-semibold text-foreground">
                                {formatBRL(costModalBaseCost + optionCost)}
                              </span>
                            </div>

                            {optionItems.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-border space-y-2">
                                {optionItems.map((item) => {
                                  const ingredient = products.find(
                                    (p) => p.id === item.ingredientProductId,
                                  );

                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-muted-foreground">
                                        {ingredient?.name ?? "Ingrediente"}
                                      </span>
                                      <span className="text-foreground">
                                        {item.quantity} {item.unit}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {recipeBuySuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Comprar ingredientes da receita
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste as quantidades antes de adicionar ao carrinho.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRecipeBuySuggestion(null)}
                disabled={isAddingSuggestedBuy}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Receita com produção baixa
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {recipeBuySuggestion.recipeProduct.name}
                </p>
              </div>

              <div className="space-y-3">
                {recipeBuySuggestion.items.map((item, index) => (
                  <div
                    key={`${item.product.id}-${index}`}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {item.product.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Necessário para completar: {getDisplayMissingQuantityForRequirement(
                            item.requiredQuantity,
                            item.requiredUnit,
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Falta em estoque: {getDisplayMissingQuantityForRequirement(
                            item.missingQuantity,
                            item.requiredUnit,
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Compra sugerida: {formatQtyUnit(
                            item.buyQuantity,
                            item.product.stockUnit ?? "unit",
                          )}
                        </p>
                      </div>

                      <div className="w-36 shrink-0">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Comprar
                        </label>
                        <input
                          type="number"
                          min={getBuyQuantityInputMin(item.product)}
                          step={getBuyQuantityInputStep(item.product)}
                          value={item.quantity}
                          onChange={(event) =>
                            setRecipeBuySuggestion((current) =>
                              current
                                ? {
                                    ...current,
                                    items: current.items.map((currentItem, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...currentItem,
                                            quantity: event.target.value,
                                          }
                                        : currentItem,
                                    ),
                                  }
                                : current,
                            )
                          }
                          onBlur={() =>
                            setRecipeBuySuggestion((current) =>
                              current
                                ? {
                                    ...current,
                                    items: current.items.map((currentItem, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...currentItem,
                                            quantity: String(
                                              normalizeBuyQuantityForProduct(
                                                currentItem.product,
                                                Number(currentItem.quantity),
                                              ) || "",
                                            ),
                                          }
                                        : currentItem,
                                    ),
                                  }
                                : current,
                            )
                          }
                          className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setRecipeBuySuggestion(null)}
                disabled={isAddingSuggestedBuy}
                className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmRecipeBuySuggestion}
                disabled={isAddingSuggestedBuy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isAddingSuggestedBuy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                Adicionar ingredientes
              </button>
            </div>
          </div>
        </div>
      )}

      {existingBuyCartPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Itens já estão no carrinho
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selecione quais itens deseja somar novamente ao carrinho.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setExistingBuyCartPrompt(null);
                  setSelectedExistingBuyCartItems({});
                }}
                disabled={isAddingToBuyCart}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
              {existingBuyCartPrompt.items.map((item) => {
                const checked = selectedExistingBuyCartItems[item.product.id] ?? true;

                return (
                  <label
                    key={item.product.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isAddingToBuyCart}
                      onChange={(event) => {
                        const isChecked = event.target.checked;
                        setSelectedExistingBuyCartItems((prev) => ({
                          ...prev,
                          [item.product.id]: isChecked,
                        }));
                      }}
                      className="mt-1 h-4 w-4 rounded border-border accent-primary"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">
                        {item.product.name}
                      </p>

                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">No carrinho</p>
                          <p className="font-medium text-foreground">
                            {formatQtyUnit(
                              item.existingQuantity,
                              item.product.stockUnit ?? "unit",
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Novo</p>
                          <p className="font-medium text-foreground">
                            {formatQtyUnit(
                              item.requestedQuantity,
                              item.product.stockUnit ?? "unit",
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="font-medium text-foreground">
                            {formatQtyUnit(
                              item.nextQuantity,
                              item.product.stockUnit ?? "unit",
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  const shouldSelectAll = existingBuyCartPrompt.items.some(
                    (item) => !selectedExistingBuyCartItems[item.product.id],
                  );

                  setSelectedExistingBuyCartItems(
                    existingBuyCartPrompt.items.reduce<Record<string, boolean>>(
                      (acc, item) => {
                        acc[item.product.id] = shouldSelectAll;
                        return acc;
                      },
                      {},
                    ),
                  );
                }}
                disabled={isAddingToBuyCart}
                className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                {existingBuyCartPrompt.items.every(
                  (item) => selectedExistingBuyCartItems[item.product.id],
                )
                  ? "Desmarcar todos"
                  : "Selecionar todos"}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setExistingBuyCartPrompt(null);
                    setSelectedExistingBuyCartItems({});
                  }}
                  disabled={isAddingToBuyCart}
                  className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={confirmAddExistingBuyCartItem}
                  disabled={
                    isAddingToBuyCart ||
                    !existingBuyCartPrompt.items.some(
                      (item) => selectedExistingBuyCartItems[item.product.id],
                    )
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isAddingToBuyCart ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  Somar selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {buySuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Adicionar ao carrinho
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste a quantidade antes de adicionar à compra.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBuySuggestion(null)}
                disabled={isAddingToBuyCart}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {buySuggestion.product.emoji || "📦"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {buySuggestion.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {buySuggestion.product.category?.name ?? "Sem categoria"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">
                      Estoque atual
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatStockQuantityWithUnitContent(
                        buySuggestion.product,
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Mínimo</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatQtyUnit(
                        Number(buySuggestion.product.minStock ?? 0),
                        buySuggestion.product.stockUnit ?? "unit",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Quantidade para adicionar
                </label>

                <input
                  type="number"
                  min={getBuyQuantityInputMin(buySuggestion.product)}
                  step={getBuyQuantityInputStep(buySuggestion.product)}
                  value={buySuggestion.quantity}
                  onChange={(event) =>
                    setBuySuggestion((current) =>
                      current
                        ? {
                            ...current,
                            quantity: event.target.value,
                          }
                        : current,
                    )
                  }
                  onBlur={() =>
                    setBuySuggestion((current) =>
                      current
                        ? {
                            ...current,
                            quantity: String(
                              normalizeBuyQuantityForProduct(
                                current.product,
                                Number(current.quantity),
                              ) || "",
                            ),
                          }
                        : current,
                    )
                  }
                  className="h-12 w-full rounded-xl border border-border bg-background px-4 text-lg font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />

                <p className="mt-2 text-xs text-muted-foreground">
                  Valor sugerido para chegar ao mínimo:{" "}
                  <span className="font-medium text-foreground">
                    {formatQtyUnit(
                      buySuggestion.suggestedQuantity,
                      buySuggestion.product.stockUnit ?? "unit",
                    )}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setBuySuggestion(null)}
                disabled={isAddingToBuyCart}
                className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmBuySuggestion}
                disabled={isAddingToBuyCart}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isAddingToBuyCart ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {showProduceModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground text-lg">
                  Produzir item
                </h2>
                <p className="text-sm text-muted-foreground">
                  Dá entrada em itens físicos com receita e baixa os ingredientes diretos. Itens sob demanda ficam fora deste fluxo.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowProduceModal(false);
                  setProducePreview(null);
                }}
                disabled={isProducingItem}
                className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid md:grid-cols-[minmax(0,1fr)_240px_auto] gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Item produzido
                  </label>
                  <select
                    value={produceProductId}
                    onChange={(e) => {
                      setProduceProductId(e.target.value);
                      setProduceQuantityMode("recipes");
                      setProduceRecipeBatches("1");
                      setProduceQuantity("1");
                      setProducePreview(null);
                    }}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground"
                  >
                    {recipeProducts.length === 0 ? (
                      <option value="">Nenhum item físico com receita</option>
                    ) : (
                      recipeProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Modo de produção
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProduceQuantityMode("recipes");
                        setProducePreview(null);
                      }}
                      className={`h-10 rounded-lg border px-3 text-sm font-medium transition ${
                        produceQuantityMode === "recipes"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:bg-secondary"
                      }`}
                    >
                      Por receitas
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProduceQuantityMode("custom");
                        setProducePreview(null);
                      }}
                      className={`h-10 rounded-lg border px-3 text-sm font-medium transition ${
                        produceQuantityMode === "custom"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:bg-secondary"
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCalculateProducePreview}
                  disabled={isCalculatingProducePreview || !produceProductId}
                  className="h-10 px-4 rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-2 justify-center"
                >
                  {isCalculatingProducePreview ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  Revisar
                </button>
              </div>

              {selectedProduceProduct && (
                <div className="rounded-xl border border-border bg-background p-4">
                  {produceQuantityMode === "recipes" ? (
                    <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-end">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          Quantas receitas
                        </label>
                        <div className="flex h-11 rounded-lg border border-border bg-card overflow-hidden">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={produceRecipeBatches}
                            onChange={(e) => {
                              setProduceRecipeBatches(e.target.value);
                              setProducePreview(null);
                            }}
                            onBlur={() => {
                              const batches = Math.max(1, Math.ceil(parsePositiveNumber(produceRecipeBatches) || 1));
                              setProduceRecipeBatches(String(batches));
                            }}
                            className="min-w-0 flex-1 px-3 bg-transparent text-foreground outline-none text-lg font-semibold"
                            placeholder="Ex: 3"
                          />
                          <div className="flex items-center border-l border-border px-3 text-sm text-muted-foreground">
                            receita{Number(produceRecipeBatches) === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 5].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              setProduceRecipeBatches(String(count));
                              setProducePreview(null);
                            }}
                            className={`h-11 rounded-lg border text-sm font-medium transition ${
                              Math.ceil(parsePositiveNumber(produceRecipeBatches) || 0) === count
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card hover:bg-secondary"
                            }`}
                          >
                            {count} receita{count === 1 ? "" : "s"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Quantidade produzida personalizada
                      </label>
                      <div className="flex h-11 rounded-lg border border-border bg-card overflow-hidden">
                        <input
                          type="number"
                          step={getProduceQuantityInputStep(selectedProduceProduct)}
                          min={getProduceQuantityInputMin(selectedProduceProduct)}
                          value={produceQuantity}
                          onChange={(e) => {
                            setProduceQuantity(e.target.value);
                            setProducePreview(null);
                          }}
                          onBlur={() => {
                            const quantity = normalizeProducedQuantityForProduct(
                              selectedProduceProduct,
                              parsePositiveNumber(produceQuantity),
                            );

                            if (quantity > 0) {
                              setProduceQuantity(String(quantity));
                            }
                          }}
                          className="min-w-0 flex-1 px-3 bg-transparent text-foreground outline-none text-lg font-semibold"
                          placeholder="Ex: 10"
                        />
                        <div className="flex items-center border-l border-border px-3 text-sm text-muted-foreground">
                          {produceOutputUnit}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    <span>Receita base: </span>
                    <span className="font-medium text-foreground">
                      {formatQtyUnit(produceBaseRecipeQuantity, produceOutputUnit)}
                    </span>
                    <span> • Produção planejada: </span>
                    <span className="font-medium text-foreground">
                      {formatQtyUnit(produceTargetQuantity, produceOutputUnit)}
                    </span>
                  </div>
                </div>
              )}

              {selectedProduceProduct && (
                <div className="rounded-xl border border-border bg-background p-4 text-sm">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Estoque atual
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatStockQuantityWithUnitContent(selectedProduceProduct)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Receita base
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatQtyUnit(
                          getRecipeOutputQuantity(selectedProduceProduct),
                          getRecipeOutputUnit(selectedProduceProduct),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Custo atual
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {getCostDisplay(selectedProduceProduct) ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {producePreview && (
                <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Resumo da produção
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Para produzir {formatQtyUnit(producePreview.requestedQuantity, producePreview.outputUnit)}.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-[180px]">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Custo estimado
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {formatBRL(producePreview.totalCost)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Unitário: {formatBRL(producePreview.unitCost)}
                      </p>
                    </div>
                  </div>

                  {produceExceedsStock && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-semibold">
                            Essa produção ultrapassa o estoque disponível.
                          </p>
                          <p className="mt-1 text-destructive/90">
                            Reduza a quantidade ou compre os ingredientes faltantes antes de confirmar.
                          </p>
                          <div className="mt-3 grid gap-2">
                            {produceStockShortages.map((item) => (
                              <div
                                key={`${item.ingredientProductId}-${item.requiredUnit}`}
                                className="rounded-lg border border-destructive/20 bg-background/60 px-3 py-2"
                              >
                                <p className="font-medium text-foreground">
                                  {item.ingredientName}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Em estoque: {item.stockDisplay} • Falta: {formatQtyUnit(item.missingQuantity, item.requiredUnit)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">
                      Baixa de ingredientes
                    </p>
                    {producePreview.directRequirements.map((item) => {
                      const ingredient = products.find(
                        (product) => product.id === item.ingredientProductId,
                      );
                      const movementQuantity = ingredient
                        ? convertRecipeQuantityToStockMovementQuantity({
                            product: ingredient,
                            quantity: Number(item.requiredQuantity ?? 0),
                            unit: item.unit ?? ingredient.stockUnit ?? "unit",
                          })
                        : Number(item.requiredQuantity ?? 0);
                      const enough = hasEnoughRequirementStock(item, products);

                      return (
                        <div
                          key={`${item.ingredientProductId}-${item.unit}`}
                          className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {item.ingredientName}
                            </p>
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                              <p>
                                Necessário: {formatQtyUnit(item.requiredQuantity, item.unit)}
                              </p>
                              <p>
                                Baixa no estoque: {formatQtyUnit(movementQuantity, ingredient?.stockUnit ?? item.unit)}
                              </p>
                              <p>
                                Em estoque: {getDisplayStockAvailableForRequirement(item as RecipeAnalysisResponse["flatRequirements"][number], products)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border whitespace-nowrap ${
                              item.isUnlimited || enough
                                ? "bg-success/15 text-success border-success/30"
                                : "bg-destructive/15 text-destructive border-destructive/30"
                            }`}
                          >
                            {item.isUnlimited ? "Infinito" : enough ? "Em estoque" : "Vai negativar"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowProduceModal(false);
                  setProducePreview(null);
                }}
                disabled={isProducingItem}
                className="h-10 px-4 rounded-lg border border-border hover:bg-secondary disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleProduceItem}
                disabled={
                  isProducingItem ||
                  !produceProductId ||
                  produceTargetQuantity <= 0 ||
                  (producePreview != null && produceExceedsStock)
                }
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isProducingItem ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Confirmar produção
              </button>
            </div>
          </div>
        </div>
      )}

      {showStockItemModal && editingStockItem && (
        <StockItemModal
          item={editingStockItem}
          products={products}
          categories={categories}
          isSaving={isSavingStockItem}
          onSave={handleSaveStockItem}
          onClose={() => {
            setShowStockItemModal(false);
            setEditingStockItem(null);
          }}
        />
      )}
    </div>
  );
}

function StockItemModal({
  item,
  products,
  categories,
  isSaving,
  onSave,
  onClose,
}: {
  item: EditableStockItem;
  products: StockProduct[];
  categories: CategoryConfig[];
  isSaving: boolean;
  onSave: (data: EditableStockItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [emoji, setEmoji] = useState(item.emoji || "📦");
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");
  const [price, setPrice] = useState(String(item.price ?? 0));
  const [isStockOnly, setIsStockOnly] = useState(item.isStockOnly);
  const [trackStock, setTrackStock] = useState(item.trackStock);
  const [stockQuantity, setStockQuantity] = useState(
    String(item.stockQuantity ?? 0),
  );
  const [minStock, setMinStock] = useState(String(item.minStock ?? 0));
  const [costMode, setCostMode] = useState<ProductCostMode>(item.costMode);
  const [simpleCost, setSimpleCost] = useState(
    item.simpleCost != null ? String(item.simpleCost) : "",
  );
  const [stockUnit, setStockUnit] = useState<StockUnit>(
    item.stockUnit ?? "unit",
  );
  const [referenceQuantity, setReferenceQuantity] = useState(
    item.referenceQuantity != null ? String(item.referenceQuantity) : "",
  );
  const [referenceCost, setReferenceCost] = useState(
    item.referenceCost != null ? String(item.referenceCost) : "",
  );
  const [unitContentQuantity, setUnitContentQuantity] = useState(
    item.unitContentQuantity != null ? String(item.unitContentQuantity) : "",
  );
  const [unitContentUnit, setUnitContentUnit] = useState<StockUnit>(
    item.unitContentUnit ?? "ml",
  );
  const [madeOnDemand, setMadeOnDemand] = useState(item.madeOnDemand);
  const [unlimitedStock, setUnlimitedStock] = useState(item.unlimitedStock);
  const [recipeOutputQuantity, setRecipeOutputQuantity] = useState(
    item.recipeOutputQuantity != null ? String(item.recipeOutputQuantity) : "",
  );
  const [recipeOutputUnit, setRecipeOutputUnit] = useState<StockUnit>(
    item.recipeOutputUnit ?? "unit",
  );
  const [recipeItems, setRecipeItems] = useState<ProductRecipeItem[]>(
    item.recipeItems ?? [],
  );
  const [variationGroups, setVariationGroups] = useState<
    EditableVariationGroup[]
  >(item.variationGroups ?? []);

  const availableIngredients = useMemo(
    () => products.filter((p) => p.id !== item.id),
    [products, item.id],
  );

  const isSellable = !isStockOnly;
  const usesRecipe = costMode === "recipe";
  const usesSimpleCost = costMode === "simple";
  const usesUnitContent = stockUnit === "unit";
  const normalizedReferenceQuantityForUnitContent = useMemo(() => {
    if (!usesUnitContent) return referenceQuantity;

    const contentQuantity = Number(unitContentQuantity || 0);
    const rawReferenceQuantity = Number(referenceQuantity || 0);

    if (
      Number.isFinite(contentQuantity) &&
      contentQuantity > 0 &&
      Number.isFinite(rawReferenceQuantity) &&
      rawReferenceQuantity > 0 &&
      Math.abs(rawReferenceQuantity - contentQuantity) < 0.000001
    ) {
      return "1";
    }

    return referenceQuantity;
  }, [usesUnitContent, referenceQuantity, unitContentQuantity]);

  const usesPhysicalStock = !madeOnDemand && !unlimitedStock && trackStock;
  const usesProductionTarget = madeOnDemand;
  const canHaveVariations = isSellable;

  const stockUnitLabel = madeOnDemand
    ? "Unidade produzida"
    : "Unidade do estoque";
  const stockQuantityLabel = madeOnDemand
    ? "Quantidade pronta agora"
    : "Estoque atual";
  const minStockLabel = madeOnDemand
    ? "Produção mínima desejada"
    : "Estoque mínimo";
  const recipeOutputLabel = madeOnDemand
    ? "Rendimento da receita"
    : "Quantidade produzida pela receita";

  function randomId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function handleSetIsStockOnly(checked: boolean) {
    setIsStockOnly(checked);

    if (checked) {
      setPrice("0");
      setMadeOnDemand(false);
    }
  }

  function handleSetMadeOnDemand(checked: boolean) {
    setMadeOnDemand(checked);

    if (checked) {
      setIsStockOnly(false);
      setTrackStock(false);
      setUnlimitedStock(false);
      setStockQuantity("0");
      setCostMode("recipe");
      setRecipeOutputQuantity((current) => current || "1");
      setRecipeOutputUnit((current) => current || "unit");
    }
  }

  function handleSetUnlimitedStock(checked: boolean) {
    setUnlimitedStock(checked);

    if (checked) {
      setMadeOnDemand(false);
      setTrackStock(false);
      setStockQuantity("0");
      setMinStock("0");
    }
  }

  function handleSetTrackStock(checked: boolean) {
    setTrackStock(checked);

    if (checked) {
      setUnlimitedStock(false);
    }
  }

  function handleAddRecipeItem() {
    setRecipeItems((prev) => [
      ...prev,
      {
        id: randomId(),
        ingredientProductId: "",
        quantity: 0,
        unit: "unit",
      },
    ]);
  }

  function handleUpdateRecipeItem(
    id: string,
    updates: Partial<ProductRecipeItem>,
  ) {
    setRecipeItems((prev) =>
      prev.map((recipeItem) =>
        recipeItem.id === id ? { ...recipeItem, ...updates } : recipeItem,
      ),
    );
  }

  function handleRemoveRecipeItem(id: string) {
    setRecipeItems((prev) => prev.filter((recipeItem) => recipeItem.id !== id));
  }

  function addVariationGroup() {
    setVariationGroups((prev) => [
      ...prev,
      {
        id: randomId(),
        name: "",
        required: false,
        selectionType: "single",
        options: [],
      },
    ]);
  }

  function updateVariationGroup(
    groupId: string,
    updates: Partial<EditableVariationGroup>,
  ) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, ...updates } : group,
      ),
    );
  }

  function removeVariationGroup(groupId: string) {
    setVariationGroups((prev) => prev.filter((group) => group.id !== groupId));
  }

  function addVariationOption(groupId: string) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: [
                ...group.options,
                {
                  id: randomId(),
                  name: "",
                  priceModifier: 0,
                  costMode: "simple",
                  simpleCost: null,
                  stockUnit: "unit",
                  referenceQuantity: null,
                  referenceCost: null,
                  recipeItems: [],
                },
              ],
            }
          : group,
      ),
    );
  }

  function updateVariationOption(
    groupId: string,
    optionId: string,
    updates: Partial<EditableVariationOption>,
  ) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId ? { ...option, ...updates } : option,
              ),
            }
          : group,
      ),
    );
  }

  function removeVariationOption(groupId: string, optionId: string) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.filter((option) => option.id !== optionId),
            }
          : group,
      ),
    );
  }

  function addVariationOptionRecipeItem(groupId: string, optionId: string) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId
                  ? {
                      ...option,
                      recipeItems: [
                        ...option.recipeItems,
                        {
                          id: randomId(),
                          ingredientProductId: "",
                          quantity: 0,
                          unit: "unit",
                        },
                      ],
                    }
                  : option,
              ),
            }
          : group,
      ),
    );
  }

  function updateVariationOptionRecipeItem(
    groupId: string,
    optionId: string,
    recipeItemId: string,
    updates: Partial<EditableVariationOptionRecipeItem>,
  ) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId
                  ? {
                      ...option,
                      recipeItems: option.recipeItems.map((recipeItem) =>
                        recipeItem.id === recipeItemId
                          ? { ...recipeItem, ...updates }
                          : recipeItem,
                      ),
                    }
                  : option,
              ),
            }
          : group,
      ),
    );
  }

  function removeVariationOptionRecipeItem(
    groupId: string,
    optionId: string,
    recipeItemId: string,
  ) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId
                  ? {
                      ...option,
                      recipeItems: option.recipeItems.filter(
                        (item) => item.id !== recipeItemId,
                      ),
                    }
                  : option,
              ),
            }
          : group,
      ),
    );
  }

  function getRepresentedUnitInfo(
    product: StockProduct | StockProductWithRecipeItems,
  ): {
    quantity: number;
    unit: StockUnit;
  } | null {
    const stockUnit = product.stockUnit ?? "unit";

    if (stockUnit !== "unit") {
      return null;
    }

    const unitContentQuantity = Number(
      (product as any).unitContentQuantity ?? 0,
    );
    const unitContentUnit = (product as any).unitContentUnit as
      | StockUnit
      | null
      | undefined;

    if (
      !unitContentUnit ||
      !Number.isFinite(unitContentQuantity) ||
      unitContentQuantity <= 0
    ) {
      return null;
    }

    return {
      quantity: unitContentQuantity,
      unit: unitContentUnit,
    };
  }

  function getIngredientUnitCostPreview(
    ingredient: StockProductWithRecipeItems,
    visitedProductIds: Set<string> = new Set(),
  ): { unitCost: number; unit: StockUnit | null } | null {
    if (visitedProductIds.has(ingredient.id)) {
      return null;
    }

    const nextVisited = new Set(visitedProductIds);
    nextVisited.add(ingredient.id);

    const isRecipeIngredient =
      ingredient.costMode === "recipe" || ingredient.hasRecipe;

    const representedUnit = getRepresentedUnitInfo(ingredient);

    const outputQuantity = Number(ingredient.recipeOutputQuantity ?? 1);
    const outputUnit =
      representedUnit?.unit ??
      ingredient.recipeOutputUnit ??
      ingredient.stockUnit ??
      "unit";

    const normalizedOutputQuantity =
      representedUnit &&
      (ingredient.recipeOutputUnit ?? ingredient.stockUnit) === "unit"
        ? normalizeQuantity(
            outputQuantity * representedUnit.quantity,
            representedUnit.unit,
          )
        : normalizeQuantity(outputQuantity, outputUnit);

    if (isRecipeIngredient && ingredient.recipeCost != null) {
      const recipeCost = Number(ingredient.recipeCost);

      if (
        Number.isFinite(recipeCost) &&
        recipeCost > 0 &&
        Number.isFinite(normalizedOutputQuantity) &&
        normalizedOutputQuantity > 0
      ) {
        return {
          unitCost: recipeCost / normalizedOutputQuantity,
          unit: outputUnit,
        };
      }
    }

    const ingredientRecipeItems = ingredient.recipeItems ?? [];

    if (isRecipeIngredient && ingredientRecipeItems.length > 0) {
      if (
        !Number.isFinite(normalizedOutputQuantity) ||
        normalizedOutputQuantity <= 0
      ) {
        return null;
      }

      const totalRecipeCost = ingredientRecipeItems.reduce(
        (sum: number, recipeItem: ProductRecipeItem) => {
          const nestedIngredient = products.find(
            (product) => product.id === recipeItem.ingredientProductId,
          ) as StockProductWithRecipeItems | undefined;

          if (!nestedIngredient) return sum;

          const nestedCost = getIngredientUnitCostPreview(
            nestedIngredient,
            nextVisited,
          );
          if (!nestedCost) return sum;

          const requiredUnit = recipeItem.unit ?? nestedCost.unit ?? "unit";
          const nestedUnit = nestedCost.unit ?? requiredUnit;

          if (getUnitFamily(requiredUnit) !== getUnitFamily(nestedUnit)) {
            return sum;
          }

          const neededBase = normalizeQuantity(
            Number(recipeItem.quantity),
            requiredUnit,
          );
          if (!Number.isFinite(neededBase) || neededBase <= 0) return sum;

          return sum + nestedCost.unitCost * neededBase;
        },
        0,
      );

      if (!Number.isFinite(totalRecipeCost) || totalRecipeCost <= 0) {
        return null;
      }

      return {
        unitCost: totalRecipeCost / normalizedOutputQuantity,
        unit: outputUnit,
      };
    }

    const ingredientCost = Number(
      ingredient.referenceCost ?? ingredient.simpleCost ?? 0,
    );

    const referenceQuantity = Number(
      ingredient.referenceQuantity ??
        (ingredient.stockUnit === "unit" || !ingredient.stockUnit ? 1 : 0),
    );

    if (
      !Number.isFinite(ingredientCost) ||
      ingredientCost <= 0 ||
      !Number.isFinite(referenceQuantity) ||
      referenceQuantity <= 0
    ) {
      return null;
    }

    if (representedUnit) {
      const representedBaseQuantity = normalizeQuantity(
        referenceQuantity * representedUnit.quantity,
        representedUnit.unit,
      );

      if (
        !Number.isFinite(representedBaseQuantity) ||
        representedBaseQuantity <= 0
      ) {
        return null;
      }

      return {
        unitCost: ingredientCost / representedBaseQuantity,
        unit: representedUnit.unit,
      };
    }

    const ingredientUnit = ingredient.stockUnit ?? "unit";
    const ingredientBase = normalizeQuantity(referenceQuantity, ingredientUnit);

    if (!Number.isFinite(ingredientBase) || ingredientBase <= 0) {
      return null;
    }

    return {
      unitCost: ingredientCost / ingredientBase,
      unit: ingredientUnit,
    };
  }

  function getRecipeItemCostPreview(
    recipeItem: ProductRecipeItem | EditableVariationOptionRecipeItem,
  ) {
    const ingredient = products.find(
      (p) => p.id === recipeItem.ingredientProductId,
    ) as StockProductWithRecipeItems | undefined;
    if (!ingredient) return 0;

    const costData = getIngredientUnitCostPreview(ingredient);
    if (!costData) return 0;

    const requiredUnit = recipeItem.unit ?? costData.unit ?? "unit";
    const ingredientUnit = costData.unit ?? requiredUnit;

    if (getUnitFamily(requiredUnit) !== getUnitFamily(ingredientUnit)) {
      return 0;
    }

    const neededBase = normalizeQuantity(
      Number(recipeItem.quantity),
      requiredUnit,
    );
    if (!Number.isFinite(neededBase) || neededBase <= 0) return 0;

    return costData.unitCost * neededBase;
  }

  function getBaseRecipeCostPreview() {
    return recipeItems.reduce(
      (sum: number, recipeItem: ProductRecipeItem) =>
        sum + getRecipeItemCostPreview(recipeItem),
      0,
    );
  }

  function getVariationOptionCostPreview(option: EditableVariationOption) {
    if ((option.costMode ?? "simple") === "simple") {
      const directCost = Number(option.referenceCost ?? option.simpleCost ?? 0);
      return Number.isFinite(directCost) && directCost > 0 ? directCost : 0;
    }

    return option.recipeItems.reduce(
      (sum: number, recipeItem: EditableVariationOptionRecipeItem) =>
        sum + getRecipeItemCostPreview(recipeItem),
      0,
    );
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalizedMadeOnDemand = madeOnDemand;
    const normalizedIsStockOnly = normalizedMadeOnDemand ? false : isStockOnly;
    const normalizedUnlimitedStock = normalizedMadeOnDemand
      ? false
      : unlimitedStock;
    const normalizedTrackStock = normalizedMadeOnDemand ? false : trackStock;
    const normalizedCostMode: ProductCostMode = normalizedMadeOnDemand
      ? "recipe"
      : costMode;

    onSave({
      id: item.id,
      name,
      emoji,
      categoryId: categoryId || null,
      price: normalizedIsStockOnly ? 0 : parseFloat(price) || 0,
      isStockOnly: normalizedIsStockOnly,
      trackStock: normalizedTrackStock,
      stockQuantity:
        normalizedMadeOnDemand || normalizedUnlimitedStock
          ? 0
          : parseFloat(stockQuantity) || 0,
      minStock: parseFloat(minStock) || 0,
      costMode: normalizedCostMode,
      simpleCost:
        normalizedCostMode === "simple" ? parseFloat(simpleCost) || 0 : null,
      stockUnit,
      referenceQuantity:
        normalizedCostMode === "simple"
          ? (() => {
              const raw = usesUnitContent
                ? normalizedReferenceQuantityForUnitContent
                : referenceQuantity;

              return raw.trim() !== "" ? parseFloat(raw) || 0 : null;
            })()
          : null,
      referenceCost:
        normalizedCostMode === "simple" && referenceCost.trim() !== ""
          ? parseFloat(referenceCost) || 0
          : null,
      unitContentQuantity:
        stockUnit === "unit" && unitContentQuantity.trim() !== ""
          ? parseFloat(unitContentQuantity) || 0
          : null,
      unitContentUnit: stockUnit === "unit" ? unitContentUnit : null,
      madeOnDemand: normalizedMadeOnDemand,
      unlimitedStock: normalizedUnlimitedStock,
      recipeOutputQuantity:
        normalizedCostMode === "recipe" && recipeOutputQuantity.trim() !== ""
          ? parseFloat(recipeOutputQuantity) || 0
          : null,
      recipeOutputUnit,
      recipeItems:
        normalizedCostMode === "recipe"
          ? recipeItems
              .filter(
                (recipeItem) =>
                  recipeItem.ingredientProductId &&
                  Number(recipeItem.quantity) > 0,
              )
              .map((recipeItem) => ({
                id: recipeItem.id,
                ingredientProductId: recipeItem.ingredientProductId,
                quantity: Number(recipeItem.quantity),
                unit: recipeItem.unit,
              }))
          : [],
      variationGroups: variationGroups
        .filter((group) => group.name.trim())
        .map((group, groupIndex) => ({
          id: group.id,
          name: group.name.trim(),
          required: Boolean(group.required),
          selectionType: group.selectionType,
          sortOrder: groupIndex,
          options: (group.options ?? [])
            .filter((option) => option.name.trim())
            .map((option, optionIndex) => ({
              id: option.id,
              name: option.name.trim(),
              priceModifier: Number(option.priceModifier ?? 0),
              sortOrder: optionIndex,
              costMode: option.costMode ?? "simple",
              simpleCost:
                (option.costMode ?? "simple") === "simple"
                  ? option.simpleCost == null
                    ? null
                    : Number(option.simpleCost)
                  : null,
              stockUnit: option.stockUnit ?? "unit",
              referenceQuantity:
                (option.costMode ?? "simple") === "simple"
                  ? option.referenceQuantity == null
                    ? null
                    : Number(option.referenceQuantity)
                  : null,
              referenceCost:
                (option.costMode ?? "simple") === "simple"
                  ? option.referenceCost == null
                    ? null
                    : Number(option.referenceCost)
                  : null,
              recipeItems:
                (option.costMode ?? "simple") === "recipe"
                  ? (option.recipeItems ?? [])
                      .filter(
                        (recipeItem) =>
                          recipeItem.ingredientProductId &&
                          Number(recipeItem.quantity) > 0,
                      )
                      .map((recipeItem) => ({
                        id: recipeItem.id,
                        ingredientProductId: recipeItem.ingredientProductId,
                        quantity: Number(recipeItem.quantity),
                        unit: recipeItem.unit,
                      }))
                  : [],
            })),
        })),
    });
  }

  const recipePreview = getBaseRecipeCostPreview();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="mobile-modal-shell flex h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-foreground">
              {item.id ? "Editar item" : "Novo item"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Campos mudam conforme o tipo do item para evitar configurações
              desnecessárias.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="stock-item-modal-form min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5"
        >
          <section className="rounded-xl border border-border bg-background p-4 space-y-4">
            <div className="grid grid-cols-[1fr_100px] gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Emoji
                </label>
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground text-center"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Categoria
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                  required
                >
                  <option value="" disabled>
                    Selecione uma categoria
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.emoji ? `${category.emoji} ` : ""}
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {stockUnitLabel}
                </label>
                <select
                  value={stockUnit}
                  onChange={(e) => setStockUnit(e.target.value as StockUnit)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                >
                  {STOCK_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                {usesUnitContent && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ex: 1 unidade pode representar uma garrafa, dose, caixa ou
                    pacote.
                  </p>
                )}
              </div>

              {isSellable && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Preço de venda
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-background p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Tipo e controle
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              <label
                className={`rounded-xl border p-3 cursor-pointer transition ${isStockOnly ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={isStockOnly}
                    onChange={(e) => handleSetIsStockOnly(e.target.checked)}
                  />
                  Só estoque
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ingrediente ou item interno, sem venda no PDV.
                </p>
              </label>

              <label
                className={`rounded-xl border p-3 cursor-pointer transition ${madeOnDemand ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={madeOnDemand}
                    onChange={(e) => handleSetMadeOnDemand(e.target.checked)}
                  />
                  Sob demanda
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Produção calculada pela receita e ingredientes.
                </p>
              </label>

              <label
                className={`rounded-xl border p-3 cursor-pointer transition ${trackStock ? "border-primary bg-primary/10" : "border-border bg-card"} ${madeOnDemand || unlimitedStock ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={trackStock}
                    disabled={madeOnDemand || unlimitedStock}
                    onChange={(e) => handleSetTrackStock(e.target.checked)}
                  />
                  Controlar estoque
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Movimenta quantidade física do item.
                </p>
              </label>

              <label
                className={`rounded-xl border p-3 cursor-pointer transition ${unlimitedStock ? "border-primary bg-primary/10" : "border-border bg-card"} ${madeOnDemand ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={unlimitedStock}
                    disabled={madeOnDemand}
                    onChange={(e) => handleSetUnlimitedStock(e.target.checked)}
                  />
                  Estoque infinito
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Item sem controle de saldo.
                </p>
              </label>
            </div>

            {usesPhysicalStock && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {stockQuantityLabel}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {minStockLabel}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                  />
                </div>
              </div>
            )}

            {usesProductionTarget && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Produção mínima desejada
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Para itens sob demanda, este número significa o mínimo que
                  você quer conseguir produzir. Ex: 10 Caipirinhas.
                </p>
              </div>
            )}
          </section>

          {usesUnitContent && (
            <section className="rounded-xl border border-border bg-background p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Equal className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    O que 1 unidade representa?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use isso para transformar estoque em unidade para receitas
                    em ml, l, g ou kg.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-[1fr_180px] gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Quantidade representada por 1 unidade
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={unitContentQuantity}
                    onChange={(e) => setUnitContentQuantity(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                    placeholder="Ex: 910"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Unidade real
                  </label>
                  <select
                    value={unitContentUnit}
                    onChange={(e) =>
                      setUnitContentUnit(e.target.value as StockUnit)
                    }
                    className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                  >
                    {STOCK_UNIT_OPTIONS.filter((unit) => unit !== "unit").map(
                      (unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {unitContentQuantity.trim() !== "" &&
                Number(unitContentQuantity) > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                    1 un. ={" "}
                    {Number(unitContentQuantity).toLocaleString("pt-BR", {
                      maximumFractionDigits: 3,
                    })}{" "}
                    {unitContentUnit}. Com estoque atual de{" "}
                    {stockQuantity || "0"} un., você tem aproximadamente{" "}
                    {(
                      Number(stockQuantity || 0) *
                      Number(unitContentQuantity || 0)
                    ).toLocaleString("pt-BR", {
                      maximumFractionDigits: 3,
                    })}{" "}
                    {unitContentUnit} disponíveis.
                  </div>
                )}
            </section>
          )}

          <section className="rounded-xl border border-border bg-background p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Custo</p>
              </div>

              <select
                value={costMode}
                disabled={madeOnDemand}
                onChange={(e) => setCostMode(e.target.value as ProductCostMode)}
                className="h-9 px-3 rounded-lg bg-card border border-border text-sm text-foreground disabled:opacity-50"
              >
                <option value="simple">Simples</option>
                <option value="recipe">Receita</option>
              </select>
            </div>

            {usesSimpleCost && (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                  <p className="font-medium">Como preencher o custo</p>
                  <p className="mt-1 text-xs text-primary/80">
                    Informe quanto você pagou e por quantas unidades/quantidade
                    comprada.
                    {usesUnitContent
                      ? " Ex: comprou 1 garrafa por R$ 16 e 1 unidade representa 910 ml."
                      : " Ex: comprou 2 kg por R$ 30."}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Quantidade comprada
                    </label>
                    <div className="flex h-10 overflow-hidden rounded-lg border border-border bg-card">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={
                          usesUnitContent
                            ? normalizedReferenceQuantityForUnitContent
                            : referenceQuantity
                        }
                        onChange={(e) => setReferenceQuantity(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent px-3 text-foreground outline-none"
                        placeholder={usesUnitContent ? "Ex: 1" : "Ex: 2"}
                      />
                      <div className="flex items-center border-l border-border px-3 text-sm text-muted-foreground">
                        {stockUnit || "unit"}
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {usesUnitContent
                        ? `Quantidade em unidades de estoque. Ex: 1 garrafa, 2 garrafas, 12 unidades.`
                        : `Quantidade na unidade do estoque usada para este custo.`}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Valor pago nessa compra
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={referenceCost}
                      onChange={(e) => {
                        setReferenceCost(e.target.value);
                        setSimpleCost(e.target.value);
                      }}
                      className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                      placeholder="Ex: 16"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      O sistema calcula automaticamente o custo por
                      ml/g/kg/unidade.
                    </p>
                  </div>
                </div>

                {usesUnitContent &&
                  unitContentQuantity.trim() !== "" &&
                  Number(unitContentQuantity) > 0 &&
                  (usesUnitContent
                    ? normalizedReferenceQuantityForUnitContent
                    : referenceQuantity
                  ).trim() !== "" &&
                  referenceCost.trim() !== "" && (
                    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">
                        Resumo do cálculo
                      </p>
                      <p className="mt-1">
                        {Number(
                          usesUnitContent
                            ? normalizedReferenceQuantityForUnitContent
                            : referenceQuantity,
                        ).toLocaleString("pt-BR", {
                          maximumFractionDigits: 3,
                        })}{" "}
                        un. ×{" "}
                        {Number(unitContentQuantity).toLocaleString("pt-BR", {
                          maximumFractionDigits: 3,
                        })}{" "}
                        {unitContentUnit} ={" "}
                        {(
                          Number(
                            usesUnitContent
                              ? normalizedReferenceQuantityForUnitContent
                              : referenceQuantity,
                          ) * Number(unitContentQuantity)
                        ).toLocaleString("pt-BR", {
                          maximumFractionDigits: 3,
                        })}{" "}
                        {unitContentUnit} por{" "}
                        {formatBRL(Number(referenceCost || 0))}.
                      </p>
                    </div>
                  )}
              </div>
            )}

            {usesRecipe && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      {recipeOutputLabel}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={recipeOutputQuantity}
                      onChange={(e) => setRecipeOutputQuantity(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                      placeholder="Ex: 1, 2, 0.7"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Unidade da saída
                    </label>
                    <select
                      value={recipeOutputUnit}
                      onChange={(e) =>
                        setRecipeOutputUnit(e.target.value as StockUnit)
                      }
                      className="w-full h-10 px-3 rounded-lg bg-card border border-border text-foreground"
                    >
                      {STOCK_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Receita base
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ingredientes usados para produzir este item.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddRecipeItem}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Ingrediente
                    </button>
                  </div>

                  {recipeItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum ingrediente adicionado.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recipeItems.map((recipeItem) => (
                        <div
                          key={recipeItem.id}
                          className="grid md:grid-cols-[1fr_120px_120px_auto] gap-3 items-end rounded-lg border border-border bg-background p-3"
                        >
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Ingrediente
                            </label>
                            <select
                              value={recipeItem.ingredientProductId}
                              onChange={(e) =>
                                handleUpdateRecipeItem(recipeItem.id, {
                                  ingredientProductId: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground"
                            >
                              <option value="">Selecione um item</option>
                              {availableIngredients.map((ingredient) => (
                                <option
                                  key={ingredient.id}
                                  value={ingredient.id}
                                >
                                  {ingredient.emoji
                                    ? `${ingredient.emoji} `
                                    : ""}
                                  {ingredient.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Quantidade
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              value={recipeItem.quantity}
                              onChange={(e) =>
                                handleUpdateRecipeItem(recipeItem.id, {
                                  quantity: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Unidade
                            </label>
                            <select
                              value={recipeItem.unit}
                              onChange={(e) =>
                                handleUpdateRecipeItem(recipeItem.id, {
                                  unit: e.target.value as StockUnit,
                                })
                              }
                              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground"
                            >
                              {STOCK_UNIT_OPTIONS.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveRecipeItem(recipeItem.id)
                            }
                            className="h-10 px-3 rounded-lg text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {recipePreview > 0 && (
                    <div className="rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground">
                      Prévia simples do custo da receita:{" "}
                      <span className="font-semibold">
                        {formatBRL(recipePreview)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {canHaveVariations && (
            <section className="rounded-xl border border-border bg-background p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Variações
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ex: sabor, tamanho, adicionais e consumo extra por opção.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addVariationGroup}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Grupo
                </button>
              </div>

              {variationGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum grupo de variação.
                </p>
              ) : (
                <div className="space-y-4">
                  {variationGroups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-xl border border-border bg-card p-4 space-y-4"
                    >
                      <div className="grid md:grid-cols-[1fr_160px_150px_auto] gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Nome do grupo
                          </label>
                          <input
                            type="text"
                            value={group.name}
                            onChange={(e) =>
                              updateVariationGroup(group.id, {
                                name: e.target.value,
                              })
                            }
                            className="w-full h-10 px-3 rounded-lg bg-background border border-border"
                            placeholder="Ex: Sabor"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Seleção
                          </label>
                          <select
                            value={group.selectionType}
                            onChange={(e) =>
                              updateVariationGroup(group.id, {
                                selectionType: e.target.value as
                                  | "single"
                                  | "multiple",
                              })
                            }
                            className="w-full h-10 px-3 rounded-lg bg-background border border-border"
                          >
                            <option value="single">Única</option>
                            <option value="multiple">Múltipla</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-foreground h-10">
                          <input
                            type="checkbox"
                            checked={group.required}
                            onChange={(e) =>
                              updateVariationGroup(group.id, {
                                required: e.target.checked,
                              })
                            }
                          />
                          Obrigatória
                        </label>

                        <button
                          type="button"
                          onClick={() => removeVariationGroup(group.id)}
                          className="h-10 px-3 rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="space-y-3">
                        {group.options.map((option) => {
                          const optionCostPreview =
                            getVariationOptionCostPreview(option);

                          return (
                            <div
                              key={option.id}
                              className="rounded-xl border border-border bg-background p-4 space-y-4"
                            >
                              <div className="grid md:grid-cols-[1fr_160px_auto] gap-3 items-end">
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Opção
                                  </label>
                                  <input
                                    type="text"
                                    value={option.name}
                                    onChange={(e) =>
                                      updateVariationOption(
                                        group.id,
                                        option.id,
                                        { name: e.target.value },
                                      )
                                    }
                                    className="w-full h-10 px-3 rounded-lg bg-card border border-border"
                                    placeholder="Ex: Maracujá"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Preço extra
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={option.priceModifier}
                                    onChange={(e) =>
                                      updateVariationOption(
                                        group.id,
                                        option.id,
                                        {
                                          priceModifier: Number(
                                            e.target.value || 0,
                                          ),
                                        },
                                      )
                                    }
                                    className="w-full h-10 px-3 rounded-lg bg-card border border-border"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeVariationOption(group.id, option.id)
                                  }
                                  className="h-10 px-3 rounded-lg text-destructive hover:bg-destructive/10"
                                >
                                  Remover opção
                                </button>
                              </div>

                              <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Custo da variação
                                    </p>
                                    {optionCostPreview > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        Custo extra:{" "}
                                        {formatBRL(optionCostPreview)}
                                      </span>
                                    )}
                                  </div>

                                  <select
                                    value={option.costMode}
                                    onChange={(e) =>
                                      updateVariationOption(
                                        group.id,
                                        option.id,
                                        {
                                          costMode: e.target.value as
                                            | "simple"
                                            | "recipe",
                                        },
                                      )
                                    }
                                    className="h-9 px-3 rounded-lg bg-background border border-border text-sm"
                                  >
                                    <option value="simple">
                                      Custo simples
                                    </option>
                                    <option value="recipe">
                                      Custo por receita
                                    </option>
                                  </select>
                                </div>

                                {option.costMode === "simple" ? (
                                  <div className="grid md:grid-cols-4 gap-3">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={option.simpleCost ?? ""}
                                      onChange={(e) =>
                                        updateVariationOption(
                                          group.id,
                                          option.id,
                                          {
                                            simpleCost:
                                              e.target.value.trim() === ""
                                                ? null
                                                : Number(e.target.value || 0),
                                          },
                                        )
                                      }
                                      className="h-10 px-3 rounded-lg bg-background border border-border"
                                      placeholder="Custo fixo"
                                    />

                                    <select
                                      value={option.stockUnit ?? "unit"}
                                      onChange={(e) =>
                                        updateVariationOption(
                                          group.id,
                                          option.id,
                                          {
                                            stockUnit: e.target
                                              .value as StockUnit,
                                          },
                                        )
                                      }
                                      className="h-10 px-3 rounded-lg bg-background border border-border"
                                    >
                                      {STOCK_UNIT_OPTIONS.map((unit) => (
                                        <option key={unit} value={unit}>
                                          {unit}
                                        </option>
                                      ))}
                                    </select>

                                    <input
                                      type="number"
                                      step="0.001"
                                      value={option.referenceQuantity ?? ""}
                                      onChange={(e) =>
                                        updateVariationOption(
                                          group.id,
                                          option.id,
                                          {
                                            referenceQuantity:
                                              e.target.value.trim() === ""
                                                ? null
                                                : Number(e.target.value || 0),
                                          },
                                        )
                                      }
                                      className="h-10 px-3 rounded-lg bg-background border border-border"
                                      placeholder="Qtd. referência"
                                    />

                                    <input
                                      type="number"
                                      step="0.01"
                                      value={option.referenceCost ?? ""}
                                      onChange={(e) =>
                                        updateVariationOption(
                                          group.id,
                                          option.id,
                                          {
                                            referenceCost:
                                              e.target.value.trim() === ""
                                                ? null
                                                : Number(e.target.value || 0),
                                          },
                                        )
                                      }
                                      className="h-10 px-3 rounded-lg bg-background border border-border"
                                      placeholder="Custo referência"
                                    />
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Consumo adicional desta opção
                                    </p>

                                    {(option.recipeItems ?? []).map(
                                      (recipeItem) => (
                                        <div
                                          key={recipeItem.id}
                                          className="grid md:grid-cols-[1fr_120px_120px_auto] gap-3 items-end"
                                        >
                                          <select
                                            value={
                                              recipeItem.ingredientProductId
                                            }
                                            onChange={(e) =>
                                              updateVariationOptionRecipeItem(
                                                group.id,
                                                option.id,
                                                recipeItem.id,
                                                {
                                                  ingredientProductId:
                                                    e.target.value,
                                                },
                                              )
                                            }
                                            className="w-full px-3 py-2 bg-card border border-border rounded-lg"
                                          >
                                            <option value="">
                                              Selecione um ingrediente
                                            </option>
                                            {availableIngredients.map(
                                              (ingredient) => (
                                                <option
                                                  key={ingredient.id}
                                                  value={ingredient.id}
                                                >
                                                  {ingredient.emoji
                                                    ? `${ingredient.emoji} `
                                                    : ""}
                                                  {ingredient.name}
                                                </option>
                                              ),
                                            )}
                                          </select>

                                          <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={recipeItem.quantity}
                                            onChange={(e) =>
                                              updateVariationOptionRecipeItem(
                                                group.id,
                                                option.id,
                                                recipeItem.id,
                                                {
                                                  quantity: Number(
                                                    e.target.value || 0,
                                                  ),
                                                },
                                              )
                                            }
                                            className="w-full px-3 py-2 bg-card border border-border rounded-lg"
                                          />

                                          <select
                                            value={recipeItem.unit}
                                            onChange={(e) =>
                                              updateVariationOptionRecipeItem(
                                                group.id,
                                                option.id,
                                                recipeItem.id,
                                                {
                                                  unit: e.target
                                                    .value as StockUnit,
                                                },
                                              )
                                            }
                                            className="w-full px-3 py-2 bg-card border border-border rounded-lg"
                                          >
                                            {STOCK_UNIT_OPTIONS.map((unit) => (
                                              <option key={unit} value={unit}>
                                                {unit}
                                              </option>
                                            ))}
                                          </select>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeVariationOptionRecipeItem(
                                                group.id,
                                                option.id,
                                                recipeItem.id,
                                              )
                                            }
                                            className="h-10 px-3 rounded-lg text-destructive hover:bg-destructive/10"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                      ),
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        addVariationOptionRecipeItem(
                                          group.id,
                                          option.id,
                                        )
                                      }
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Adicionar consumo
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => addVariationOption(group.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar opção
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="ordr-mobile-modal-footer sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 sm:-mx-5 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-border hover:bg-secondary"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
