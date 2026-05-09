import { apiFetch } from "./client";

export type ProductCostHistoryFilters = {
  fromDate?: string;
  toDate?: string;
  productId?: string;
  categoryId?: string;
};

export type ProductCostHistoryRecipeItem = {
  ingredientProductId?: string | null;
  ingredientProductName?: string | null;
  categoryName?: string | null;
  quantity?: number | null;
  unit?: string | null;
};

export type ProductCostHistoryRow = {
  id: string;
  companyId: string;
  productId: string;
  productName: string;
  categoryId?: string | null;
  categoryName: string;
  changedByUserId?: string | null;
  changedByUserName?: string | null;
  source: string;
  reason?: string | null;
  costMode?: string | null;
  stockUnit?: string | null;
  simpleCost?: number | null;
  referenceCost?: number | null;
  referenceQuantity?: number | null;
  unitContentQuantity?: number | null;
  unitContentUnit?: string | null;
  recipeOutputQuantity?: number | null;
  recipeOutputUnit?: string | null;
  effectiveCost: number;
  effectiveUnit: string;
  oldEffectiveCost?: number | null;
  deltaCost?: number | null;
  deltaPercent?: number | null;
  createdAt: string;
  metadata?: any;
  oldRecipeItems?: ProductCostHistoryRecipeItem[];
  newRecipeItems?: ProductCostHistoryRecipeItem[];
};

export type ProductCostHistoryProductSummary = {
  productId: string;
  productName: string;
  categoryId?: string | null;
  categoryName: string;
  changes: number;
  firstCost: number;
  lastCost: number;
  minCost: number;
  maxCost: number;
  deltaCost: number;
  deltaPercent?: number | null;
  lastChangedAt: string;
  history: ProductCostHistoryRow[];
};

export type ProductCostHistoryCategorySummary = {
  categoryId?: string | null;
  categoryName: string;
  productCount: number;
  changes: number;
  averageCost: number;
  lastChangedAt: string;
};

export type ProductCostHistoryResponse = {
  filters: ProductCostHistoryFilters;
  summary: {
    totalChanges: number;
    productCount: number;
    categoryCount: number;
    increased: number;
    decreased: number;
    mostChangedProduct: ProductCostHistoryProductSummary | null;
  };
  rows: ProductCostHistoryRow[];
  byProduct: ProductCostHistoryProductSummary[];
  byCategory: ProductCostHistoryCategorySummary[];
};

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toNullableNumber(value: unknown) {
  if (value == null) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRecipeItems(value: unknown): ProductCostHistoryRecipeItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((item: any) => ({
    ingredientProductId: item?.ingredientProductId ?? null,
    ingredientProductName: item?.ingredientProductName ?? item?.name ?? null,
    categoryName: item?.categoryName ?? null,
    quantity: toNullableNumber(item?.quantity),
    unit: item?.unit ?? null,
  }));
}

function getEffectiveUnit(row: any) {
  return String(
    row?.effectiveUnit ??
      row?.newUnitContentUnit ??
      row?.newStockUnit ??
      row?.unitContentUnit ??
      row?.stockUnit ??
      "unit",
  );
}

function normalizeRow(row: any): ProductCostHistoryRow {
  const newCost =
    toNullableNumber(row?.effectiveCost) ??
    toNullableNumber(row?.cost) ??
    toNullableNumber(row?.newCostPerBaseUnit) ??
    toNullableNumber(row?.newCalculatedUnitCost) ??
    0;

  const oldCost =
    toNullableNumber(row?.oldEffectiveCost) ??
    toNullableNumber(row?.oldCost) ??
    toNullableNumber(row?.oldCostPerBaseUnit) ??
    toNullableNumber(row?.oldCalculatedUnitCost);

  const delta =
    toNullableNumber(row?.deltaCost) ??
    toNullableNumber(row?.delta) ??
    (oldCost == null ? null : newCost - oldCost);

  const deltaPercent =
    toNullableNumber(row?.deltaPercent) ??
    (oldCost != null && oldCost > 0 && delta != null
      ? (delta / oldCost) * 100
      : null);

  const metadata = row?.metadata ?? null;
  const oldRecipeItems = normalizeRecipeItems(
    metadata?.oldCostSnapshot?.recipeItems ?? metadata?.oldRecipeItems,
  );
  const newRecipeItems = normalizeRecipeItems(
    metadata?.newCostSnapshot?.recipeItems ?? metadata?.newRecipeItems,
  );

  return {
    id: String(row?.id ?? ""),
    companyId: String(row?.companyId ?? ""),
    productId: String(row?.productId ?? ""),
    productName: String(row?.productName ?? "Produto removido"),
    categoryId: row?.categoryId ?? null,
    categoryName: String(row?.categoryName ?? "Sem categoria"),
    changedByUserId:
      row?.changedByUserId ??
      row?.createdByUserId ??
      row?.createdByUser?.id ??
      null,
    changedByUserName:
      row?.changedByUserName ??
      row?.createdByUser?.name ??
      row?.createdByUser?.username ??
      null,
    source: String(row?.source ?? "manual"),
    reason: row?.reason ?? null,
    costMode: row?.costMode ?? null,
    stockUnit: row?.newStockUnit ?? row?.stockUnit ?? null,
    simpleCost: toNullableNumber(row?.newSimpleCost ?? row?.simpleCost),
    referenceCost: toNullableNumber(
      row?.newReferenceCost ?? row?.referenceCost,
    ),
    referenceQuantity: toNullableNumber(
      row?.newReferenceQuantity ?? row?.referenceQuantity,
    ),
    unitContentQuantity: toNullableNumber(
      row?.newUnitContentQuantity ?? row?.unitContentQuantity,
    ),
    unitContentUnit: row?.newUnitContentUnit ?? row?.unitContentUnit ?? null,
    recipeOutputQuantity: toNullableNumber(
      row?.newRecipeOutputQuantity ?? row?.recipeOutputQuantity,
    ),
    recipeOutputUnit: row?.newRecipeOutputUnit ?? row?.recipeOutputUnit ?? null,
    effectiveCost: newCost,
    effectiveUnit: getEffectiveUnit(row),
    oldEffectiveCost: oldCost,
    deltaCost: delta,
    deltaPercent,
    metadata,
    oldRecipeItems,
    newRecipeItems,
    createdAt: String(row?.createdAt ?? new Date().toISOString()),
  };
}

function buildProductSummaries(
  rows: ProductCostHistoryRow[],
): ProductCostHistoryProductSummary[] {
  const map = new Map<string, ProductCostHistoryProductSummary>();

  for (const row of rows) {
    const current = map.get(row.productId) ?? {
      productId: row.productId,
      productName: row.productName,
      categoryId: row.categoryId ?? null,
      categoryName: row.categoryName,
      changes: 0,
      firstCost: row.effectiveCost,
      lastCost: row.effectiveCost,
      minCost: row.effectiveCost,
      maxCost: row.effectiveCost,
      deltaCost: 0,
      deltaPercent: null,
      lastChangedAt: row.createdAt,
      history: [],
    };

    current.history.push(row);
    current.history.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const first = current.history[0];
    const last = current.history[current.history.length - 1];
    const costs = current.history.map((item) => item.effectiveCost);

    current.changes = current.history.length;
    current.firstCost = first?.effectiveCost ?? 0;
    current.lastCost = last?.effectiveCost ?? 0;
    current.minCost = costs.length ? Math.min(...costs) : 0;
    current.maxCost = costs.length ? Math.max(...costs) : 0;
    current.deltaCost = current.lastCost - current.firstCost;
    current.deltaPercent =
      current.firstCost > 0
        ? (current.deltaCost / current.firstCost) * 100
        : null;
    current.lastChangedAt = last?.createdAt ?? row.createdAt;

    map.set(row.productId, current);
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      history: [...item.history].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    }))
    .sort((a, b) => b.lastChangedAt.localeCompare(a.lastChangedAt));
}

function buildCategorySummaries(
  rows: ProductCostHistoryRow[],
): ProductCostHistoryCategorySummary[] {
  const map = new Map<
    string,
    ProductCostHistoryCategorySummary & {
      totalCost: number;
      productIds: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = row.categoryId ?? "uncategorized";
    const current = map.get(key) ?? {
      categoryId: row.categoryId ?? null,
      categoryName: row.categoryName,
      productCount: 0,
      changes: 0,
      averageCost: 0,
      lastChangedAt: row.createdAt,
      totalCost: 0,
      productIds: new Set<string>(),
    };

    current.changes += 1;
    current.productIds.add(row.productId);
    current.productCount = current.productIds.size;
    current.totalCost += row.effectiveCost;
    current.averageCost =
      current.changes > 0 ? current.totalCost / current.changes : 0;

    if (row.createdAt > current.lastChangedAt) {
      current.lastChangedAt = row.createdAt;
    }

    map.set(key, current);
  }

  return Array.from(map.values())
    .map(({ totalCost: _totalCost, productIds: _productIds, ...item }) => item)
    .sort((a, b) => b.changes - a.changes);
}

function normalizeProductSummary(
  summary: any,
  rows: ProductCostHistoryRow[],
): ProductCostHistoryProductSummary {
  const productId = String(summary?.productId ?? "");
  const productRows = rows.filter((row) => row.productId === productId);
  const built = buildProductSummaries(productRows)[0];

  const normalizedHistory = asArray<any>(summary?.history)
    .map((row: any) => normalizeRow(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    productId: String(summary?.productId ?? built?.productId ?? ""),
    productName: String(
      summary?.productName ?? built?.productName ?? "Produto",
    ),
    categoryId: summary?.categoryId ?? built?.categoryId ?? null,
    categoryName: String(
      summary?.categoryName ?? built?.categoryName ?? "Sem categoria",
    ),
    changes: toNumber(summary?.changes ?? summary?.points ?? built?.changes),
    firstCost: toNumber(summary?.firstCost ?? built?.firstCost),
    lastCost: toNumber(summary?.lastCost ?? built?.lastCost),
    minCost: toNumber(summary?.minCost ?? built?.minCost),
    maxCost: toNumber(summary?.maxCost ?? built?.maxCost),
    deltaCost: toNumber(
      summary?.deltaCost ?? summary?.delta ?? built?.deltaCost,
    ),
    deltaPercent: toNullableNumber(
      summary?.deltaPercent ?? built?.deltaPercent,
    ),
    lastChangedAt: String(
      summary?.lastChangedAt ??
        built?.lastChangedAt ??
        new Date().toISOString(),
    ),
    history:
      normalizedHistory.length > 0
        ? normalizedHistory
        : [...productRows].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
  };
}

function normalizeCategorySummary(
  summary: any,
): ProductCostHistoryCategorySummary {
  return {
    categoryId: summary?.categoryId ?? null,
    categoryName: String(summary?.categoryName ?? "Sem categoria"),
    productCount: toNumber(
      summary?.productCount ??
        summary?.productsChanged ??
        summary?.products ??
        0,
    ),
    changes: toNumber(summary?.changes ?? summary?.points ?? 0),
    averageCost: toNumber(summary?.averageCost),
    lastChangedAt: String(summary?.lastChangedAt ?? new Date().toISOString()),
  };
}

function normalizeResponse(
  raw: any,
  filters: ProductCostHistoryFilters,
): ProductCostHistoryResponse {
  const rawRows = asArray<any>(raw?.rows).length
    ? asArray<any>(raw?.rows)
    : asArray<any>(raw?.history);

  const rows = rawRows
    .map((row: any) => normalizeRow(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const byProduct = asArray<any>(raw?.byProduct).length
    ? asArray<any>(raw?.byProduct).map((item: any) =>
        normalizeProductSummary(item, rows),
      )
    : asArray<any>(raw?.products).length
      ? asArray<any>(raw?.products).map((item: any) =>
          normalizeProductSummary(item, rows),
        )
      : buildProductSummaries(rows);

  const byCategory = asArray<any>(raw?.byCategory).length
    ? asArray<any>(raw?.byCategory).map((item: any) =>
        normalizeCategorySummary(item),
      )
    : asArray<any>(raw?.categories).length
      ? asArray<any>(raw?.categories).map((item: any) =>
          normalizeCategorySummary(item),
        )
      : buildCategorySummaries(rows);

  const mostChangedProduct =
    byProduct.length > 0
      ? [...byProduct].sort(
          (a, b) => Math.abs(b.deltaCost) - Math.abs(a.deltaCost),
        )[0]
      : null;

  return {
    filters: raw?.filters ?? filters,
    summary: {
      totalChanges: toNumber(raw?.summary?.totalChanges ?? rows.length),
      productCount: toNumber(
        raw?.summary?.productCount ??
          raw?.summary?.productsChanged ??
          byProduct.length,
      ),
      categoryCount: toNumber(
        raw?.summary?.categoryCount ??
          raw?.summary?.categoriesChanged ??
          byCategory.length,
      ),
      increased: toNumber(
        raw?.summary?.increased ??
          raw?.summary?.increases ??
          rows.filter((row) => (row.deltaCost ?? 0) > 0).length,
      ),
      decreased: toNumber(
        raw?.summary?.decreased ??
          raw?.summary?.decreases ??
          rows.filter((row) => (row.deltaCost ?? 0) < 0).length,
      ),
      mostChangedProduct,
    },
    rows,
    byProduct,
    byCategory,
  };
}

export async function getProductCostHistory(
  filters: ProductCostHistoryFilters = {},
) {
  const params = new URLSearchParams();

  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.productId && filters.productId !== "all") {
    params.set("productId", filters.productId);
  }
  if (filters.categoryId && filters.categoryId !== "all") {
    params.set("categoryId", filters.categoryId);
  }

  const query = params.toString();
  const raw = await apiFetch<any>(
    query ? `/product-cost-history?${query}` : "/product-cost-history",
  );

  return normalizeResponse(raw, filters);
}
