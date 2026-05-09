"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileClock,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getAuditLogs, type AuditLog } from "@/lib/api/audit";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "—");
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number);
}

function formatBoolean(value: unknown) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return String(value ?? "—");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const fieldLabels: Record<string, string> = {
  name: "Nome",
  username: "Usuário/login",
  phone: "Telefone",
  description: "Descrição",
  categoryId: "Categoria",
  categoryName: "Categoria",
  price: "Preço",
  active: "Ativo",
  isStockOnly: "Somente estoque",
  trackStock: "Controla estoque",
  stockQuantity: "Quantidade em estoque",
  minStock: "Estoque mínimo",
  costMode: "Modo de custo",
  simpleCost: "Custo simples",
  stockUnit: "Unidade de estoque",
  referenceQuantity: "Quantidade de referência",
  referenceCost: "Custo da referência",
  unitContentQuantity: "Conteúdo por unidade",
  unitContentUnit: "Unidade do conteúdo",
  madeOnDemand: "Sob demanda",
  unlimitedStock: "Estoque ilimitado",
  recipeOutputQuantity: "Rendimento da receita",
  recipeOutputUnit: "Unidade do rendimento",
  systemRole: "Tipo de acesso",
  customRoleName: "Cargo",
  customRoleId: "ID do cargo",
  permissions: "Permissões",
  variationGroups: "Variações",
  recipeItems: "Ingredientes da receita",
  priceModifier: "Adicional de preço",
  passwordChanged: "Senha alterada",
};

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    ROLE_CREATED: "Cargo criado",
    ROLE_UPDATED: "Cargo atualizado",
    ROLE_DELETED: "Cargo excluído",
    USER_CREATED: "Usuário criado",
    USER_UPDATED: "Usuário atualizado",
    USER_ROLE_ASSIGNED: "Cargo atribuído",
    USER_ADMIN_GRANTED: "Admin concedido",
    USER_ADMIN_REVOKED: "Admin removido",
    ORDER_CREATED: "Pedido criado",
    ORDER_PAID: "Pedido pago",
    ORDER_CANCELLED: "Pedido cancelado",
    PRODUCT_CREATED: "Produto criado",
    PRODUCT_UPDATED: "Produto atualizado",
    PRODUCT_DELETED: "Produto excluído",
    PRODUCT_REACTIVATED: "Produto reativado",
    STOCK_ADJUSTED: "Estoque ajustado",
    PURCHASE_CREATED: "Compra criada",
    COST_UPDATED: "Custo atualizado",
    PRINTER_UPDATED: "Impressora atualizada",
    SETTINGS_UPDATED: "Configuração atualizada",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}

function entityLabel(entityType?: string | null) {
  const labels: Record<string, string> = {
    Product: "Produto",
    Role: "Cargo",
    User: "Usuário",
    UserCompany: "Acesso do usuário",
    Order: "Pedido",
    StockMovement: "Movimento de estoque",
    Printer: "Impressora",
  };
  return labels[entityType ?? ""] ?? entityType ?? "Registro";
}

function formatValue(key: string, value: unknown) {
  if (value === null || typeof value === "undefined" || value === "")
    return "—";
  if (key === "categoryId" || key === "categoryName") {
    if (isPlainRecord(value)) {
      return String(value.name ?? value.categoryName ?? value.id ?? "—");
    }
    return String(value);
  }
  if (key.toLowerCase().includes("price") || key.toLowerCase().includes("cost"))
    return formatCurrency(value);
  if (typeof value === "boolean") return formatBoolean(value);
  if (Array.isArray(value)) return `${value.length} itens`;
  if (isPlainRecord(value)) return "Objeto alterado";
  return String(value);
}

function stableStringifyForAudit(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringifyForAudit).join(",")}]`;
  }

  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringifyForAudit(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function normalizeNumberLike(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function normalizeRecipeItemsForAuditCompare(value: unknown) {
  const items = Array.isArray(value) ? value : [];

  return items
    .map((item: any) => ({
      // Intentionally ignore the recipe row id. The backend can recreate recipe
      // rows during a save even when the ingredient/quantity did not change.
      ingredientProductId: item?.ingredientProductId ?? null,
      ingredientProductName: item?.ingredientProductName ?? null,
      categoryName: item?.categoryName ?? null,
      quantity: normalizeNumberLike(item?.quantity),
      unit: item?.unit ?? null,
    }))
    .sort((a: any, b: any) =>
      String(a.ingredientProductName ?? a.ingredientProductId ?? "").localeCompare(
        String(b.ingredientProductName ?? b.ingredientProductId ?? ""),
      ),
    );
}

function normalizeEnvironmentPricesForAuditCompare(value: unknown) {
  const items = Array.isArray(value) ? value : [];

  return items
    .map((item: any) => ({
      salesEnvironmentId: item?.salesEnvironmentId ?? null,
      salesEnvironmentName: item?.salesEnvironmentName ?? null,
      priceModifier: normalizeNumberLike(item?.priceModifier),
    }))
    .sort((a: any, b: any) =>
      String(a.salesEnvironmentName ?? a.salesEnvironmentId ?? "").localeCompare(
        String(b.salesEnvironmentName ?? b.salesEnvironmentId ?? ""),
      ),
    );
}

function normalizeVariationGroupsForAuditCompare(value: unknown) {
  const groups = Array.isArray(value) ? value : [];

  return groups
    .map((group: any) => ({
      id: group?.id ?? null,
      name: group?.name ?? null,
      required: Boolean(group?.required),
      selectionType: group?.selectionType ?? null,
      sortOrder: normalizeNumberLike(group?.sortOrder) ?? 0,
      options: (Array.isArray(group?.options) ? group.options : [])
        .map((option: any) => ({
          id: option?.id ?? null,
          name: option?.name ?? null,
          priceModifier: normalizeNumberLike(option?.priceModifier) ?? 0,
          active: option?.active !== false,
          sortOrder: normalizeNumberLike(option?.sortOrder) ?? 0,
          costMode: option?.costMode ?? "simple",
          simpleCost: normalizeNumberLike(option?.simpleCost),
          stockUnit: option?.stockUnit ?? null,
          referenceQuantity: normalizeNumberLike(option?.referenceQuantity),
          referenceCost: normalizeNumberLike(option?.referenceCost),
          environmentPrices: normalizeEnvironmentPricesForAuditCompare(
            option?.environmentPrices,
          ),
          recipeItems: normalizeRecipeItemsForAuditCompare(option?.recipeItems),
        }))
        .sort((a: any, b: any) =>
          String(a.name ?? a.id ?? "").localeCompare(String(b.name ?? b.id ?? "")),
        ),
    }))
    .sort((a: any, b: any) =>
      String(a.name ?? a.id ?? "").localeCompare(String(b.name ?? b.id ?? "")),
    );
}

function areAuditValuesEqual(key: string, before: unknown, after: unknown) {
  if (key === "variationGroups") {
    return (
      stableStringifyForAudit(normalizeVariationGroupsForAuditCompare(before)) ===
      stableStringifyForAudit(normalizeVariationGroupsForAuditCompare(after))
    );
  }

  if (key === "recipeItems") {
    return (
      stableStringifyForAudit(normalizeRecipeItemsForAuditCompare(before)) ===
      stableStringifyForAudit(normalizeRecipeItemsForAuditCompare(after))
    );
  }

  if (key === "environmentPrices") {
    return (
      stableStringifyForAudit(normalizeEnvironmentPricesForAuditCompare(before)) ===
      stableStringifyForAudit(normalizeEnvironmentPricesForAuditCompare(after))
    );
  }

  return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

function getComparableKeys(oldValues: unknown, newValues: unknown) {
  const oldRecord = isPlainRecord(oldValues) ? oldValues : {};
  const newRecord = isPlainRecord(newValues) ? newValues : {};

  return Array.from(
    new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]),
  ).filter((key) => !areAuditValuesEqual(key, oldRecord[key], newRecord[key]));
}

function getDisplayFieldValue(record: Record<string, unknown>, key: string) {
  if (key === "categoryId") {
    return record.categoryName ?? record.categoryId ?? null;
  }

  return record[key];
}

function getDisplayFieldKey(key: string) {
  if (key === "categoryId") return "categoryName";
  return key;
}

function getChangedFields(log: AuditLog) {
  const oldRecord = isPlainRecord(log.oldValues) ? log.oldValues : {};
  const newRecord = isPlainRecord(log.newValues) ? log.newValues : {};
  const keys = getComparableKeys(log.oldValues, log.newValues);
  const changes = new Map<
    string,
    { key: string; label: string; before: unknown; after: unknown }
  >();

  for (const rawKey of keys) {
    const key = getDisplayFieldKey(rawKey);
    const before = getDisplayFieldValue(oldRecord, rawKey);
    const after = getDisplayFieldValue(newRecord, rawKey);

    if (areAuditValuesEqual(key, before, after)) {
      continue;
    }

    changes.set(key, {
      key,
      label: fieldLabels[key] ?? key,
      before,
      after,
    });
  }

  return Array.from(changes.values());
}

function getShortSummary(log: AuditLog) {
  const changes = getChangedFields(log);
  if (changes.length === 0)
    return log.description || `${entityLabel(log.entityType)} atualizado`;

  const important =
    changes.find((change) =>
      [
        "price",
        "simpleCost",
        "stockQuantity",
        "variationGroups",
        "recipeItems",
        "name",
        "systemRole",
        "customRoleName",
      ].includes(change.key),
    ) ?? changes[0];
  if (important.key === "variationGroups")
    return "Variações do produto alteradas";
  if (important.key === "recipeItems")
    return "Ingredientes da receita alterados";
  return `${important.label}: ${formatValue(important.key, important.before)} → ${formatValue(important.key, important.after)}`;
}

function PermissionDiff({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const beforeList = Array.isArray(before) ? before.map(String) : [];
  const afterList = Array.isArray(after) ? after.map(String) : [];
  const added = afterList.filter((item) => !beforeList.includes(item));
  const removed = beforeList.filter((item) => !afterList.includes(item));

  if (!added.length && !removed.length)
    return (
      <p className="text-sm text-muted-foreground">
        Sem mudanças nas permissões.
      </p>
    );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border bg-emerald-500/5 p-3">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Adicionadas
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {added.length ? (
            added.map((item) => (
              <span
                key={item}
                className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nenhuma</span>
          )}
        </div>
      </div>
      <div className="rounded-2xl border bg-red-500/5 p-3">
        <p className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-300">
          Removidas
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {removed.length ? (
            removed.map((item) => (
              <span
                key={item}
                className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Nenhuma</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getNamedKey(item: any) {
  return String(item?.id ?? item?.name ?? "");
}

function formatUnitLabel(unit: unknown) {
  const labels: Record<string, string> = {
    unit: "un",
    ml: "ml",
    l: "l",
    g: "g",
    kg: "kg",
  };

  return labels[String(unit ?? "")] ?? String(unit ?? "");
}

function formatSelectionType(value: unknown) {
  if (value === "multiple") return "Múltipla escolha";
  if (value === "single") return "Escolha única";
  return String(value ?? "—");
}

function formatCostMode(value: unknown) {
  if (value === "recipe") return "Receita/ingredientes";
  if (value === "simple") return "Custo simples";
  return String(value ?? "—");
}

function formatAuditFieldValue(key: string, value: unknown) {
  if (value === null || typeof value === "undefined" || value === "")
    return "—";
  if (key === "categoryId" || key === "categoryName") {
    if (isPlainRecord(value)) {
      return String(value.name ?? value.categoryName ?? value.id ?? "—");
    }
    return String(value);
  }
  if (
    key === "priceModifier" ||
    key === "simpleCost" ||
    key === "referenceCost"
  )
    return formatCurrency(value);
  if (key === "required" || key === "active") return formatBoolean(value);
  if (key === "selectionType") return formatSelectionType(value);
  if (key === "costMode") return formatCostMode(value);
  if (key === "stockUnit" || key === "unit") return formatUnitLabel(value);
  return String(value);
}

const variationGroupLabels: Record<string, string> = {
  name: "Nome do grupo",
  required: "Obrigatório",
  selectionType: "Tipo de seleção",
  sortOrder: "Ordem",
};

const variationOptionLabels: Record<string, string> = {
  name: "Nome da opção",
  priceModifier: "Adicional de preço",
  active: "Ativa",
  sortOrder: "Ordem",
  costMode: "Modo de custo",
  simpleCost: "Custo simples",
  stockUnit: "Unidade",
  referenceQuantity: "Quantidade de referência",
  referenceCost: "Custo da referência",
};

function getFieldChanges(before: any, after: any, keys: string[]) {
  return keys
    .filter(
      (key) =>
        JSON.stringify(before?.[key] ?? null) !==
        JSON.stringify(after?.[key] ?? null),
    )
    .map((key) => ({ key, before: before?.[key], after: after?.[key] }));
}

function normalizeRecipeItemKey(item: any) {
  return (
    String(
      item?.ingredientProductId ??
        item?.ingredientProductName ??
        item?.id ??
        "",
    ) + `:${String(item?.unit ?? "")}`
  );
}

function describeRecipeItem(item: any) {
  const name =
    item?.ingredientProductName ||
    item?.name ||
    item?.ingredientProductId ||
    "Ingrediente";
  const quantity =
    item?.quantity == null ? "—" : formatValue("quantity", item.quantity);
  const unit = formatUnitLabel(item?.unit);
  return `${name} • ${quantity} ${unit}`.trim();
}

function RecipeItemsDiff({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const beforeItems = Array.isArray(before) ? before : [];
  const afterItems = Array.isArray(after) ? after : [];
  const beforeMap = new Map<string, any>(
    beforeItems.map((item: any) => [normalizeRecipeItemKey(item), item]),
  );
  const afterMap = new Map<string, any>(
    afterItems.map((item: any) => [normalizeRecipeItemKey(item), item]),
  );

  const added = afterItems.filter(
    (item: any) => !beforeMap.has(normalizeRecipeItemKey(item)),
  );
  const removed = beforeItems.filter(
    (item: any) => !afterMap.has(normalizeRecipeItemKey(item)),
  );
  const changed = afterItems
    .map((item: any) => ({
      before: beforeMap.get(normalizeRecipeItemKey(item)),
      after: item,
    }))
    .filter(
      (item: any) =>
        item.before &&
        JSON.stringify(item.before) !== JSON.stringify(item.after),
    );

  if (!added.length && !removed.length && !changed.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem mudanças nos ingredientes da receita.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {added.map((item: any) => (
        <div
          key={`recipe-added-${normalizeRecipeItemKey(item)}`}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"
        >
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Ingrediente adicionado
          </p>
          <p className="mt-1 text-sm font-semibold">
            {describeRecipeItem(item)}
          </p>
          {item.categoryName && (
            <p className="text-xs text-muted-foreground">
              Categoria: {item.categoryName}
            </p>
          )}
        </div>
      ))}

      {removed.map((item: any) => (
        <div
          key={`recipe-removed-${normalizeRecipeItemKey(item)}`}
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-3"
        >
          <p className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-300">
            Ingrediente removido
          </p>
          <p className="mt-1 text-sm font-semibold">
            {describeRecipeItem(item)}
          </p>
        </div>
      ))}

      {changed.map((item: any) => (
        <div
          key={`recipe-changed-${normalizeRecipeItemKey(item.after)}`}
          className="rounded-xl border p-3"
        >
          <p className="text-sm font-semibold">
            {item.after?.ingredientProductName ||
              item.before?.ingredientProductName ||
              "Ingrediente"}
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div className="rounded-lg bg-muted p-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Antes
              </p>
              <p className="text-xs">{describeRecipeItem(item.before)}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2">
              <p className="text-[10px] font-bold uppercase text-primary">
                Depois
              </p>
              <p className="text-xs">{describeRecipeItem(item.after)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function describeVariationOption(option: any) {
  const parts = [
    `Adicional ${formatCurrency(option?.priceModifier ?? 0)}`,
    option?.active === false ? "Inativa" : "Ativa",
  ];

  if (option?.costMode === "recipe") parts.push("Custo por receita");
  if (option?.simpleCost != null)
    parts.push(`Custo ${formatCurrency(option.simpleCost)}`);
  if (option?.referenceCost != null && option?.referenceQuantity != null) {
    parts.push(
      `Referência ${formatCurrency(option.referenceCost)} / ${option.referenceQuantity} ${formatUnitLabel(option.stockUnit)}`.trim(),
    );
  }
  if (Array.isArray(option?.recipeItems) && option.recipeItems.length) {
    parts.push(`${option.recipeItems.length} ingrediente(s)`);
  }

  return parts.join(" • ");
}

function FieldChangeList({
  changes,
  labels,
}: {
  changes: { key: string; before: unknown; after: unknown }[];
  labels: Record<string, string>;
}) {
  if (!changes.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {changes.map((change) => (
        <div
          key={change.key}
          className="grid gap-2 rounded-xl border bg-muted/30 p-2 text-xs md:grid-cols-[150px_1fr_auto_1fr] md:items-center"
        >
          <p className="font-bold text-muted-foreground">
            {labels[change.key] ?? change.key}
          </p>
          <p className="rounded-lg bg-background px-2 py-1">
            {formatAuditFieldValue(change.key, change.before)}
          </p>
          <ChevronRight className="hidden h-3 w-3 text-muted-foreground md:block" />
          <p className="rounded-lg bg-primary/10 px-2 py-1 font-semibold text-primary">
            {formatAuditFieldValue(change.key, change.after)}
          </p>
        </div>
      ))}
    </div>
  );
}

function VariationDiff({ before, after }: { before: unknown; after: unknown }) {
  const beforeGroups = Array.isArray(before) ? before : [];
  const afterGroups = Array.isArray(after) ? after : [];

  const beforeMap = new Map<string, any>(
    beforeGroups.map((group: any) => [getNamedKey(group), group]),
  );
  const afterMap = new Map<string, any>(
    afterGroups.map((group: any) => [getNamedKey(group), group]),
  );

  const addedGroups = afterGroups.filter(
    (group: any) => !beforeMap.has(getNamedKey(group)),
  );
  const removedGroups = beforeGroups.filter(
    (group: any) => !afterMap.has(getNamedKey(group)),
  );
  const commonGroups = afterGroups
    .map((group: any) => ({
      before: beforeMap.get(getNamedKey(group)),
      after: group,
    }))
    .filter((pair: any) => pair.before);

  const changedGroups = commonGroups
    .map((pair: any) => {
      const beforeOptions = Array.isArray(pair.before?.options)
        ? pair.before.options
        : [];
      const afterOptions = Array.isArray(pair.after?.options)
        ? pair.after.options
        : [];
      const beforeOptionMap = new Map<string, any>(
        beforeOptions.map((option: any) => [getNamedKey(option), option]),
      );
      const afterOptionMap = new Map<string, any>(
        afterOptions.map((option: any) => [getNamedKey(option), option]),
      );

      const addedOptions = afterOptions.filter(
        (option: any) => !beforeOptionMap.has(getNamedKey(option)),
      );
      const removedOptions = beforeOptions.filter(
        (option: any) => !afterOptionMap.has(getNamedKey(option)),
      );
      const changedOptions = afterOptions
        .map((option: any) => {
          const beforeOption = beforeOptionMap.get(getNamedKey(option)) as any;
          const optionChanges = getFieldChanges(
            beforeOption,
            option,
            Object.keys(variationOptionLabels),
          );
          const recipeChanged = !areAuditValuesEqual(
            "recipeItems",
            beforeOption?.recipeItems,
            option?.recipeItems,
          );
          const environmentChanged = !areAuditValuesEqual(
            "environmentPrices",
            beforeOption?.environmentPrices,
            option?.environmentPrices,
          );

          return {
            before: beforeOption,
            after: option,
            optionChanges,
            recipeChanged,
            environmentChanged,
          };
        })
        .filter(
          (item: any) =>
            item.before &&
            (item.optionChanges.length ||
              item.recipeChanged ||
              item.environmentChanged),
        );

      const groupChanges = getFieldChanges(
        pair.before,
        pair.after,
        Object.keys(variationGroupLabels),
      );

      return {
        before: pair.before,
        after: pair.after,
        groupChanges,
        addedOptions,
        removedOptions,
        changedOptions,
      };
    })
    .filter(
      (group: any) =>
        group.groupChanges.length ||
        group.addedOptions.length ||
        group.removedOptions.length ||
        group.changedOptions.length,
    );

  if (!beforeGroups.length && !afterGroups.length) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Detalhes da variação não gravados
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Este registro foi criado, mas a versão anterior não salvava os dados
          de antes/depois das variações. Novas alterações feitas depois desta
          correção aparecerão detalhadas aqui.
        </p>
      </div>
    );
  }

  if (!addedGroups.length && !removedGroups.length && !changedGroups.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem mudanças nas variações.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {addedGroups.map((group: any) => (
        <div
          key={`added-${getNamedKey(group)}`}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3"
        >
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Grupo adicionado
          </p>
          <p className="mt-1 font-semibold">{group.name}</p>
          <p className="text-xs text-muted-foreground">
            {group.required ? "Obrigatório" : "Opcional"} •{" "}
            {formatSelectionType(group.selectionType)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(group.options ?? []).map((option: any) => (
              <span
                key={getNamedKey(option)}
                className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                {option.name} • {formatCurrency(option.priceModifier ?? 0)}
              </span>
            ))}
          </div>
        </div>
      ))}

      {removedGroups.map((group: any) => (
        <div
          key={`removed-${getNamedKey(group)}`}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3"
        >
          <p className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-300">
            Grupo removido/inativado
          </p>
          <p className="mt-1 font-semibold">{group.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(group.options ?? []).map((option: any) => (
              <span
                key={getNamedKey(option)}
                className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {option.name}
              </span>
            ))}
          </div>
        </div>
      ))}

      {changedGroups.map((group: any) => (
        <div
          key={`changed-${getNamedKey(group.after)}`}
          className="rounded-2xl border bg-background p-3"
        >
          <p className="text-xs font-black uppercase tracking-wide text-primary">
            Grupo alterado
          </p>
          <p className="mt-1 font-semibold">{group.after.name}</p>

          <FieldChangeList
            changes={group.groupChanges}
            labels={variationGroupLabels}
          />

          <div className="mt-3 space-y-2">
            {group.addedOptions.map((option: any) => (
              <div
                key={`added-option-${getNamedKey(option)}`}
                className="rounded-xl bg-emerald-500/5 p-3"
              >
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  + {option.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {describeVariationOption(option)}
                </p>
                {Array.isArray(option.recipeItems) &&
                  option.recipeItems.length > 0 && (
                    <div className="mt-2 rounded-lg bg-background/70 p-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Ingredientes
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {option.recipeItems.map((item: any) => (
                          <span
                            key={normalizeRecipeItemKey(item)}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px]"
                          >
                            {describeRecipeItem(item)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ))}

            {group.removedOptions.map((option: any) => (
              <div
                key={`removed-option-${getNamedKey(option)}`}
                className="rounded-xl bg-red-500/5 p-3"
              >
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  - {option.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {describeVariationOption(option)}
                </p>
              </div>
            ))}

            {group.changedOptions.map((item: any) => (
              <div
                key={`changed-option-${getNamedKey(item.after)}`}
                className="rounded-xl border p-3"
              >
                <p className="text-sm font-semibold">{item.after.name}</p>

                <FieldChangeList
                  changes={item.optionChanges}
                  labels={variationOptionLabels}
                />

                {item.recipeChanged && (
                  <div className="mt-3 rounded-xl border bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                      Ingredientes da receita
                    </p>
                    <RecipeItemsDiff
                      before={item.before?.recipeItems}
                      after={item.after?.recipeItems}
                    />
                  </div>
                )}

                {item.environmentChanged && (
                  <div className="mt-3 rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                      Preços por ambiente alterados
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Os adicionais por ambiente desta opção foram alterados.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecipeChangeCard({
  change,
}: {
  change: { key: string; label: string; before: unknown; after: unknown };
}) {
  return (
    <div className="rounded-2xl border bg-background p-4 md:col-span-2">
      <p className="mb-3 text-sm font-black">Ingredientes da receita</p>
      <RecipeItemsDiff before={change.before} after={change.after} />
    </div>
  );
}

function ChangeCard({
  change,
}: {
  change: { key: string; label: string; before: unknown; after: unknown };
}) {
  if (change.key === "permissions") {
    return (
      <div className="rounded-2xl border bg-background p-4 md:col-span-2">
        <p className="mb-3 text-sm font-black">Permissões</p>
        <PermissionDiff before={change.before} after={change.after} />
      </div>
    );
  }

  if (change.key === "variationGroups") {
    return (
      <div className="rounded-2xl border bg-background p-4 md:col-span-2">
        <p className="mb-3 text-sm font-black">Variações</p>
        <VariationDiff before={change.before} after={change.after} />
      </div>
    );
  }

  if (change.key === "recipeItems") {
    return <RecipeChangeCard change={change} />;
  }

  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-black">{change.label}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-xl bg-muted p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Antes
          </p>
          <p className="mt-1 break-words text-sm font-semibold">
            {formatValue(change.key, change.before)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className="rounded-xl bg-primary/10 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
            Depois
          </p>
          <p className="mt-1 break-words text-sm font-semibold">
            {formatValue(change.key, change.after)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );
  const entityTypes = useMemo(
    () => Array.from(new Set(logs.map((log) => log.entityType))).sort(),
    [logs],
  );

  async function loadLogs(
    cursor?: string | null,
    override?: { clear?: boolean },
  ) {
    try {
      if (cursor) setIsLoadingMore(true);
      else setIsLoading(true);

      const result = await getAuditLogs({
        search,
        action,
        entityType,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        take: 50,
        cursor: cursor ?? undefined,
      });

      setLogs((current) =>
        cursor && !override?.clear ? [...current, ...result.logs] : result.logs,
      );
      setNextCursor(result.nextCursor ?? null);
    } catch (error: any) {
      console.error("Erro ao carregar auditoria:", error);
      alert(error?.message || "Erro ao carregar auditoria");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setSelectedLog(null);
    loadLogs(null, { clear: true });
  }

  function clearFilters() {
    setSearch("");
    setAction("");
    setEntityType("");
    setFrom("");
    setTo("");
    setSelectedLog(null);
    setTimeout(() => loadLogs(null, { clear: true }), 0);
  }

  const selectedChanges = selectedLog ? getChangedFields(selectedLog) : [];

  return (
    <div className="min-h-full bg-background p-3 text-foreground sm:p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:gap-6">
        <header className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="flex flex-col justify-between gap-4 p-4 sm:p-5 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <FileClock className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">
                  Auditoria
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Veja alterações importantes com comparação clara de antes e
                  depois, sem JSON cru.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Histórico protegido
            </div>
          </div>

          <div className="grid grid-cols-1 border-t bg-muted/30 sm:grid-cols-3">
            <div className="border-b p-4 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Registros carregados
              </p>
              <p className="mt-1 text-2xl font-black">{logs.length}</p>
            </div>
            <div className="border-b p-4 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tipos de ação
              </p>
              <p className="mt-1 text-2xl font-black">{actions.length}</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Entidades
              </p>
              <p className="mt-1 text-2xl font-black">{entityTypes.length}</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border bg-card p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.7fr_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por ação, entidade, usuário ou descrição..."
                className="h-11 w-full rounded-2xl border bg-background pl-9 pr-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
              />
            </label>

            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="h-11 rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
            >
              <option value="">Todas as ações</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {actionLabel(item)}
                </option>
              ))}
            </select>

            <select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="h-11 rounded-2xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
            >
              <option value="">Todas as entidades</option>
              {entityTypes.map((item) => (
                <option key={item} value={item}>
                  {entityLabel(item)}
                </option>
              ))}
            </select>

            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-11 w-full rounded-2xl border bg-background pl-9 pr-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
              />
            </label>

            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-11 w-full rounded-2xl border bg-background pl-9 pr-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
              />
            </label>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={applyFilters}
                className="h-11 flex-1 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 lg:flex-none"
              >
                Filtrar
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="h-11 flex-1 rounded-2xl border px-4 text-sm font-bold transition hover:bg-muted lg:flex-none"
              >
                Limpar
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="hidden grid-cols-[150px_190px_170px_1fr_120px] bg-muted/70 px-5 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground md:grid">
            <div>Data</div>
            <div>Usuário</div>
            <div>Ação</div>
            <div>Resumo</div>
            <div className="text-right">Detalhes</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando
              auditoria...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum registro de auditoria encontrado.
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const changes = getChangedFields(log);
                return (
                  <article
                    key={log.id}
                    className="p-4 transition hover:bg-muted/30 sm:p-5"
                  >
                    <div className="grid gap-3 md:grid-cols-[150px_190px_170px_1fr_120px] md:items-center">
                      <div className="text-sm font-semibold">
                        {formatDate(log.createdAt)}
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <UserRound className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {log.user?.name || log.user?.username || "Sistema"}
                          </p>
                          {log.user?.username && (
                            <p className="truncate text-xs text-muted-foreground">
                              @{log.user.username}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                          {actionLabel(log.action)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {log.description ||
                            `${entityLabel(log.entityType)} ${log.entityId}`}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {getShortSummary(log)}
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition hover:bg-muted"
                        >
                          <Activity className="h-4 w-4" /> Ver mudanças
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 md:ml-[510px]">
                      <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                        {entityLabel(log.entityType)}
                      </span>
                      {changes.slice(0, 4).map((change) => (
                        <span
                          key={change.key}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {change.label}
                        </span>
                      ))}
                      {changes.length > 4 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          +{changes.length - 4}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {nextCursor && (
            <div className="border-t p-4 text-center">
              <button
                type="button"
                onClick={() => loadLogs(nextCursor)}
                disabled={isLoadingMore}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition hover:bg-muted disabled:opacity-60"
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
                Carregar mais
              </button>
            </div>
          )}
        </section>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileClock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black tracking-tight">
                    {actionLabel(selectedLog.action)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(selectedLog.createdAt)} ·{" "}
                    {entityLabel(selectedLog.entityType)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                    Usuário
                  </p>
                  <p className="mt-1 font-bold">
                    {selectedLog.user?.name ||
                      selectedLog.user?.username ||
                      "Sistema"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                    Entidade
                  </p>
                  <p className="mt-1 font-bold">
                    {entityLabel(selectedLog.entityType)}
                  </p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                    Campos alterados
                  </p>
                  <p className="mt-1 font-bold">{selectedChanges.length}</p>
                </div>
              </div>

              {selectedLog.description && (
                <div className="mb-5 rounded-2xl border bg-primary/5 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm font-medium">
                      {selectedLog.description}
                    </p>
                  </div>
                </div>
              )}

              {selectedChanges.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Este registro não possui comparação de campos salva.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {selectedChanges.map((change) => (
                    <ChangeCard key={change.key} change={change} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
