"use client";

import { useEffect, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  Receipt,
  X,
  Loader2,
  Banknote,
  QrCode,
  CreditCard,
  MessageSquareText,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderItem, PaymentMethod } from "@/lib/pos-types";
import { formatBRL, getItemPrice } from "@/lib/pos-types";

type PrintItemMode = "SEPARATE" | "GROUPED";

type OrderPanelProps = {
  items: OrderItem[];
  orderId: string | null;
  comandaNumber: number | null;
  comandaName: string;
  orderObservation: string;
  applyTax: boolean;
  requireComanda: boolean;
  taxRate: number;
  onUpdateQuantity: (itemKey: string, delta: number) => void;
  onRemoveItem: (itemKey: string) => void;
  onClearOrder: () => void;
  onCharge: (paymentMethod: PaymentMethod) => void;
  onSetComandaNumber: (value: number | null) => void;
  onSetComandaName: (value: string) => void;
  onSetOrderObservation: (value: string) => void;
  onSetItemNotes: (itemKey: string, notes: string) => void;
  onSetApplyTax: (value: boolean) => void;
  printItemModes?: Record<string, PrintItemMode>;
  onSetItemPrintMode?: (itemKey: string, mode: PrintItemMode) => void;
  isLoading?: boolean;
  onClose?: () => void;
};

function getItemKey(item: OrderItem): string {
  const selections = (item.variationSelections ?? [])
    .map((selection) => ({
      groupId: selection.groupId,
      selectedOptionIds: [...selection.selectedOptionIds].sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));

  return `${item.product.id}-${JSON.stringify(selections)}`;
}

function getVariationLabels(item: OrderItem): string[] {
  if (
    !item.variationSelections?.length ||
    !item.product.variationGroups?.length
  ) {
    return [];
  }

  return item.variationSelections.flatMap((selection) => {
    const group = item.product.variationGroups?.find(
      (group) => group.id === selection.groupId,
    );

    if (!group) return [];

    return selection.selectedOptionIds
      .map((optionId) => {
        const option = group.options.find((option) => option.id === optionId);
        return option ? `${group.name}: ${option.name}` : null;
      })
      .filter((value): value is string => value !== null);
  });
}

export function OrderPanel({
  items,
  orderId,
  comandaNumber,
  comandaName,
  orderObservation,
  applyTax,
  requireComanda,
  taxRate = 0.1,
  onUpdateQuantity,
  onRemoveItem,
  onClearOrder,
  onCharge,
  onSetComandaNumber,
  onSetComandaName,
  onSetOrderObservation,
  onSetItemNotes,
  onSetApplyTax,
  printItemModes = {},
  onSetItemPrintMode,
  isLoading = false,
  onClose,
}: OrderPanelProps) {
  const [isOrderObservationOpen, setIsOrderObservationOpen] = useState(false);
  const [editingNotesItemKey, setEditingNotesItemKey] = useState<string | null>(
    null,
  );
  const [editingNotesValue, setEditingNotesValue] = useState("");
  const [isChargeOpen, setIsChargeOpen] = useState(false);

  const subtotal = items.reduce(
    (sum, item) => sum + getItemPrice(item) * item.quantity,
    0,
  );

  const canApplyTax = Number(taxRate) > 0;
  const tax = canApplyTax && applyTax ? subtotal * taxRate : 0;
  const total = subtotal + tax;
  const taxPercentLabel = (taxRate * 100).toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  });

  const isComandaValid = !requireComanda || comandaNumber !== null;
  const actionDisabled = isLoading || items.length === 0 || !isComandaValid;

  const editingItem = editingNotesItemKey
    ? items.find((item) => getItemKey(item) === editingNotesItemKey)
    : null;

  useEffect(() => {
    if (items.length === 0) {
      setIsChargeOpen(false);
    }
  }, [items.length]);

  const summaryContent = (
    <div className="mb-3 space-y-2 rounded-3xl border border-border bg-background/80 p-3 shadow-sm">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Subtotal</span>
        <span className="font-semibold text-foreground">
          {formatBRL(subtotal)}
        </span>
      </div>

      {canApplyTax ? (
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Taxa ({taxPercentLabel}%)</span>
          <span className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {formatBRL(tax)}
            </span>
            <input
              type="checkbox"
              checked={applyTax}
              disabled={isLoading}
              onChange={(e) => onSetApplyTax(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              title="Aplicar taxa"
            />
          </span>
        </label>
      ) : (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Taxa</span>
          <span className="font-semibold text-foreground">Desativada</span>
        </div>
      )}

      <div className="flex justify-between border-t border-border pt-2 text-xl font-black text-foreground">
        <span>Total</span>
        <span className="text-primary">{formatBRL(total)}</span>
      </div>
    </div>
  );

  const paymentButtons = (
    <div className="pdv-order-payment-grid grid grid-cols-2 gap-2">
      <Button
        onClick={() => onCharge("money")}
        disabled={actionDisabled}
        className="pdv-order-payment-button h-12 rounded-2xl text-sm font-black bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Banknote className="mr-2 h-4 w-4" />
        )}
        Dinheiro
      </Button>

      <Button
        onClick={() => onCharge("pix")}
        disabled={actionDisabled}
        className="pdv-order-payment-button h-12 rounded-2xl text-sm font-black bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <QrCode className="mr-2 h-4 w-4" />
        )}
        Pix
      </Button>

      <Button
        onClick={() => onCharge("credit")}
        disabled={actionDisabled}
        className="pdv-order-payment-button h-12 rounded-2xl text-sm font-black bg-secondary text-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        Crédito
      </Button>

      <Button
        onClick={() => onCharge("debit")}
        disabled={actionDisabled}
        className="pdv-order-payment-button h-12 rounded-2xl text-sm font-black bg-secondary text-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        Débito
      </Button>
    </div>
  );

  const comandaWarning =
    items.length > 0 &&
    requireComanda &&
    comandaNumber === null &&
    !isLoading ? (
      <p className="mt-2 rounded-2xl bg-warning/10 px-3 py-2 text-center text-xs font-bold text-warning">
        Informe o número da comanda para finalizar
      </p>
    ) : null;

  function openItemNotes(item: OrderItem) {
    const itemKey = getItemKey(item);
    setEditingNotesItemKey(itemKey);
    setEditingNotesValue(item.notes ?? "");
  }

  function saveItemNotes() {
    if (!editingNotesItemKey) return;

    onSetItemNotes(editingNotesItemKey, editingNotesValue);
    setEditingNotesItemKey(null);
    setEditingNotesValue("");
  }

  return (
    <>
      <div className="flex h-full w-full flex-col overflow-hidden bg-card lg:w-[400px] lg:border-l lg:border-border">
        <div className="shrink-0 border-b border-border bg-gradient-to-br from-primary/12 via-card to-card px-4 py-3 sm:px-5 sm:py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black text-foreground sm:text-lg">
                    Pedido atual
                  </h2>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {orderId ? `#${orderId}` : "Novo pedido"} ·{" "}
                    {items.reduce((sum, item) => sum + item.quantity, 0)} item
                    {items.reduce((sum, item) => sum + item.quantity, 0) !== 1
                      ? "s"
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearOrder}
                  disabled={isLoading}
                  className="h-10 rounded-2xl px-3 text-xs font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="mr-1 h-4 w-4" />
                  Limpar
                </Button>
              )}

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background/80 text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
                  aria-label="Fechar pedido"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[104px_1fr] gap-2 sm:grid-cols-[120px_1fr] sm:gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Comanda
              </label>

              <input
                type="number"
                min="1"
                max="999999"
                value={comandaNumber ?? ""}
                disabled={isLoading}
                onChange={(e) => {
                  const val = e.target.value;
                  onSetComandaNumber(val ? parseInt(val, 10) : null);
                }}
                placeholder="N°"
                className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-base font-black text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Identificação
              </label>

              <input
                type="text"
                value={comandaName}
                disabled={isLoading}
                onChange={(e) => onSetComandaName(e.target.value)}
                placeholder="Mesa 3 / João"
                className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-base text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background/90 shadow-sm">
            <button
              type="button"
              onClick={() => setIsOrderObservationOpen((prev) => !prev)}
              disabled={isLoading}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Observação do pedido
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {orderObservation.trim() || "Opcional"}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  isOrderObservationOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isOrderObservationOpen && (
              <div className="border-t border-border px-3 pb-3 pt-2">
                <textarea
                  value={orderObservation}
                  disabled={isLoading}
                  onChange={(e) => onSetOrderObservation(e.target.value)}
                  placeholder="Ex: entregar tudo junto, pedido urgente..."
                  className="min-h-20 w-full resize-none rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background/35 p-3 sm:p-4">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/70 px-6 py-10 text-center text-muted-foreground">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Receipt className="h-8 w-8" />
              </div>
              <p className="text-base font-bold text-foreground">
                Pedido vazio
              </p>
              <p className="mt-1 max-w-[220px] text-sm">
                Toque nos produtos para adicionar. O painel não abre mais
                sozinho.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => {
                const itemKey = getItemKey(item);
                const itemPrice = getItemPrice(item);
                const variationLabels = getVariationLabels(item);
                const hasNotes = Boolean(item.notes?.trim());
                const printMode = printItemModes[itemKey] ?? "SEPARATE";

                return (
                  <div
                    key={itemKey}
                    className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="p-3 sm:p-3.5">
                      <div className="flex gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-2xl ring-1 ring-border/70">
                          {item.product.emoji}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-sm font-black text-foreground">
                                  {item.product.name}
                                </p>
                                {hasNotes && (
                                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                                    Obs
                                  </span>
                                )}
                              </div>

                              {variationLabels.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {variationLabels.map((label, index) => (
                                    <p
                                      key={`${itemKey}-variation-${index}`}
                                      className="truncate text-xs text-muted-foreground"
                                    >
                                      {label}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>

                            <p className="shrink-0 text-right text-sm font-black text-primary">
                              {formatBRL(itemPrice * item.quantity)}
                            </p>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center rounded-2xl border border-border bg-background p-1 shadow-sm">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(itemKey, -1)}
                                disabled={isLoading}
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Diminuir quantidade"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="min-w-9 text-center text-base font-black text-foreground">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(itemKey, 1)}
                                disabled={isLoading}
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Aumentar quantidade"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openItemNotes(item)}
                                disabled={isLoading}
                                className={`flex h-10 items-center justify-center rounded-2xl px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                  hasNotes
                                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                                    : "bg-secondary text-foreground hover:bg-secondary/80"
                                }`}
                                title="Observação do item"
                              >
                                <MessageSquareText className="mr-1.5 h-4 w-4" />
                                Obs
                              </button>

                              <button
                                type="button"
                                onClick={() => onRemoveItem(itemKey)}
                                disabled={isLoading}
                                className="flex h-10 w-10 items-center justify-center rounded-2xl text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-secondary/45 px-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Impressão
                      </span>

                      <div className="flex shrink-0 rounded-2xl border border-border bg-card p-1 shadow-sm">
                        <button
                          type="button"
                          disabled={isLoading || !onSetItemPrintMode}
                          onClick={() =>
                            onSetItemPrintMode?.(itemKey, "SEPARATE")
                          }
                          className={`rounded-xl px-2.5 py-1.5 text-[10px] font-black transition-colors disabled:opacity-50 ${
                            printMode === "SEPARATE"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                          title="Uma comanda por unidade deste item"
                        >
                          Separado
                        </button>

                        <button
                          type="button"
                          disabled={isLoading || !onSetItemPrintMode}
                          onClick={() =>
                            onSetItemPrintMode?.(itemKey, "GROUPED")
                          }
                          className={`rounded-xl px-2.5 py-1.5 text-[10px] font-black transition-colors disabled:opacity-50 ${
                            printMode === "GROUPED"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                          title="Agrupar este item em uma comanda junto com os outros itens agrupados"
                        >
                          Agrupado
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pdv-order-panel-actions shrink-0 border-t border-border bg-card/95 p-3 shadow-[0_-18px_40px_rgba(0,0,0,0.08)] backdrop-blur sm:p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background/80 px-3 py-2 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Total
              </p>
              <div className="flex items-end justify-between gap-2">
                <p className="truncate text-2xl font-black text-primary">
                  {formatBRL(total)}
                </p>
                <span className="mb-1 shrink-0 text-xs font-bold text-muted-foreground">
                  {items.reduce((sum, item) => sum + item.quantity, 0)} item
                  {items.reduce((sum, item) => sum + item.quantity, 0) !== 1
                    ? "s"
                    : ""}
                </span>
              </div>
            </div>

            <Button
              onClick={() => setIsChargeOpen(true)}
              disabled={items.length === 0 || isLoading}
              className="h-[3.5rem] min-w-[8.5rem] rounded-2xl text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cobrar
            </Button>
          </div>

          {comandaWarning}
        </div>
      </div>

      {isChargeOpen && (
        <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="pdv-charge-modal flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-muted sm:hidden" />

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                  Cobrança
                </p>
                <h3 className="truncate text-lg font-black text-foreground">
                  Revisar e finalizar pedido
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsChargeOpen(false)}
                disabled={isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar cobrança"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="mb-3 rounded-3xl border border-border bg-background/70 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Itens do pedido
                  </p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
                    {items.reduce((sum, item) => sum + item.quantity, 0)} item
                    {items.reduce((sum, item) => sum + item.quantity, 0) !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((item) => {
                    const itemKey = getItemKey(item);
                    const variationLabels = getVariationLabels(item);
                    const itemPrice = getItemPrice(item);

                    return (
                      <div
                        key={`charge-${itemKey}`}
                        className="rounded-2xl bg-card px-3 py-2 ring-1 ring-border/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-foreground">
                              {item.quantity}× {item.product.name}
                            </p>
                            {variationLabels.length > 0 && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {variationLabels.join(" · ")}
                              </p>
                            )}
                            {item.notes?.trim() && (
                              <p className="mt-1 line-clamp-2 rounded-xl bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                                Obs: {item.notes.trim()}
                              </p>
                            )}
                          </div>

                          <p className="shrink-0 text-sm font-black text-primary">
                            {formatBRL(itemPrice * item.quantity)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {summaryContent}
              {comandaWarning}
            </div>

            <div className="shrink-0 border-t border-border bg-card/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:p-5">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Forma de pagamento
              </p>
              {paymentButtons}
            </div>
          </div>
        </div>
      )}

      {editingNotesItemKey && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[90svh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-muted sm:hidden" />
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-black text-foreground">
                  Observação do item
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {editingItem?.product.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingNotesItemKey(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground hover:bg-secondary/80"
                aria-label="Fechar observação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <textarea
                value={editingNotesValue}
                onChange={(e) => setEditingNotesValue(e.target.value)}
                placeholder="Ex: sem gelo, ponto da carne, sem cebola..."
                className="min-h-32 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <div className="flex gap-2 border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingNotesItemKey(null);
                  setEditingNotesValue("");
                }}
                className="h-12 flex-1 rounded-2xl"
              >
                Cancelar
              </Button>

              <Button
                onClick={saveItemNotes}
                className="h-12 flex-1 rounded-2xl font-black"
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
