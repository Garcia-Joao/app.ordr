'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrderItem, PaymentMethod } from '@/lib/pos-types'
import { formatBRL, getItemPrice } from '@/lib/pos-types'

type PrintItemMode = 'SEPARATE' | 'GROUPED'

type OrderPanelProps = {
  items: OrderItem[]
  orderId: string | null
  comandaNumber: number | null
  comandaName: string
  orderObservation: string
  applyTax: boolean
  requireComanda: boolean
  taxRate: number
  onUpdateQuantity: (itemKey: string, delta: number) => void
  onRemoveItem: (itemKey: string) => void
  onClearOrder: () => void
  onCharge: (paymentMethod: PaymentMethod) => void
  onSetComandaNumber: (value: number | null) => void
  onSetComandaName: (value: string) => void
  onSetOrderObservation: (value: string) => void
  onSetItemNotes: (itemKey: string, notes: string) => void
  onSetApplyTax: (value: boolean) => void
  printItemModes?: Record<string, PrintItemMode>
  onSetItemPrintMode?: (itemKey: string, mode: PrintItemMode) => void
  isLoading?: boolean
}

function getItemKey(item: OrderItem): string {
  const selections = (item.variationSelections ?? [])
    .map((selection) => ({
      groupId: selection.groupId,
      selectedOptionIds: [...selection.selectedOptionIds].sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId))

  return `${item.product.id}-${JSON.stringify(selections)}`
}

function getVariationLabels(item: OrderItem): string[] {
  if (!item.variationSelections?.length || !item.product.variationGroups?.length) {
    return []
  }

  return item.variationSelections.flatMap((selection) => {
    const group = item.product.variationGroups?.find(
      (group) => group.id === selection.groupId
    )

    if (!group) return []

    return selection.selectedOptionIds
      .map((optionId) => {
        const option = group.options.find((option) => option.id === optionId)
        return option ? `${group.name}: ${option.name}` : null
      })
      .filter((value): value is string => value !== null)
  })
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
}: OrderPanelProps) {
  const [isOrderObservationOpen, setIsOrderObservationOpen] = useState(false)
  const [editingNotesItemKey, setEditingNotesItemKey] = useState<string | null>(null)
  const [editingNotesValue, setEditingNotesValue] = useState('')

  const subtotal = items.reduce(
    (sum, item) => sum + getItemPrice(item) * item.quantity,
    0
  )

  const tax = applyTax ? subtotal * taxRate : 0
  const total = subtotal + tax

  const isComandaValid = !requireComanda || comandaNumber !== null
  const actionDisabled = isLoading || items.length === 0 || !isComandaValid

  const editingItem = editingNotesItemKey
    ? items.find((item) => getItemKey(item) === editingNotesItemKey)
    : null

  function openItemNotes(item: OrderItem) {
    const itemKey = getItemKey(item)
    setEditingNotesItemKey(itemKey)
    setEditingNotesValue(item.notes ?? '')
  }

  function saveItemNotes() {
    if (!editingNotesItemKey) return

    onSetItemNotes(editingNotesItemKey, editingNotesValue)
    setEditingNotesItemKey(null)
    setEditingNotesValue('')
  }

  return (
    <>
      <div className="flex h-full w-full flex-col bg-card lg:w-[380px] lg:border-l lg:border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pedido Atual</h2>
            {orderId && (
              <p className="text-sm text-muted-foreground font-mono" suppressHydrationWarning>
                #{orderId}
              </p>
            )}
          </div>

          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearOrder}
              disabled={isLoading}
              className="text-muted-foreground hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <div className="space-y-3 border-b border-border bg-secondary/50 px-4 py-3 sm:px-5">
          <div className="grid grid-cols-[96px_1fr] gap-2 sm:grid-cols-[110px_1fr] sm:gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Comanda
              </label>

              <input
                type="number"
                min="1"
                max="999999"
                value={comandaNumber ?? ''}
                disabled={isLoading}
                onChange={(e) => {
                  const val = e.target.value
                  onSetComandaNumber(val ? parseInt(val, 10) : null)
                }}
                placeholder="N°"
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Nome
              </label>

              <input
                type="text"
                value={comandaName}
                disabled={isLoading}
                onChange={(e) => onSetComandaName(e.target.value)}
                placeholder="Mesa 3 / João"
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background">
            <button
              type="button"
              onClick={() => setIsOrderObservationOpen((prev) => !prev)}
              disabled={isLoading}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquareText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Observação do pedido
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {orderObservation.trim() || 'Opcional'}
                  </p>
                </div>
              </div>
            </button>

            {isOrderObservationOpen && (
              <div className="px-3 pb-3">
                <textarea
                  value={orderObservation}
                  disabled={isLoading}
                  onChange={(e) => onSetOrderObservation(e.target.value)}
                  placeholder="Ex: entregar tudo junto, pedido urgente..."
                  className="w-full min-h-20 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Receipt className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum item no pedido</p>
              <p className="text-xs mt-1">Toque nos produtos para adicionar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const itemKey = getItemKey(item)
                const itemPrice = getItemPrice(item)
                const variationLabels = getVariationLabels(item)
                const hasNotes = Boolean(item.notes?.trim())

                return (
                  <div
                    key={itemKey}
                    className="bg-secondary rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.product.emoji}</span>

                      <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.product.name}
                        </p>

                        {hasNotes && (
                          <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 shrink-0">
                            Obs
                          </span>
                        )}
                      </div>

                      {variationLabels.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {variationLabels.map((label, index) => (
                            <p
                              key={`${itemKey}-variation-${index}`}
                              className="text-xs text-muted-foreground truncate"
                            >
                              {label}
                            </p>
                          ))}
                        </div>
                      )}

                      <p className="text-sm text-primary font-semibold">
                        {formatBRL(itemPrice * item.quantity)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openItemNotes(item)}
                        disabled={isLoading}
                        className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          hasNotes
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'bg-muted hover:bg-muted/80 text-foreground'
                        }`}
                        title="Observação do item"
                      >
                        <MessageSquareText className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => onUpdateQuantity(itemKey, -1)}
                        disabled={isLoading}
                        className="h-8 w-8 flex items-center justify-center rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="w-8 text-center text-sm font-semibold text-foreground">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => onUpdateQuantity(itemKey, 1)}
                        disabled={isLoading}
                        className="h-8 w-8 flex items-center justify-center rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => onRemoveItem(itemKey)}
                        disabled={isLoading}
                        className="h-8 w-8 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/20 transition-colors ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border/70 bg-background/60 px-2 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Impressão
                      </span>

                      <div className="flex shrink-0 rounded-md border border-border bg-card p-0.5">
                        <button
                          type="button"
                          disabled={isLoading || !onSetItemPrintMode}
                          onClick={() => onSetItemPrintMode?.(itemKey, 'SEPARATE')}
                          className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                            (printItemModes[itemKey] ?? 'SEPARATE') === 'SEPARATE'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                          title="Uma comanda por unidade deste item"
                        >
                          Separado
                        </button>

                        <button
                          type="button"
                          disabled={isLoading || !onSetItemPrintMode}
                          onClick={() => onSetItemPrintMode?.(itemKey, 'GROUPED')}
                          className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                            (printItemModes[itemKey] ?? 'SEPARATE') === 'GROUPED'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                          title="Agrupar este item em uma comanda junto com os outros itens agrupados"
                        >
                          Agrupado
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-border p-4 sm:p-5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Taxa ({Math.round(taxRate * 100)}%)</span>
              <input
                type="checkbox"
                checked={applyTax}
                disabled={isLoading}
                onChange={(e) => onSetApplyTax(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                title="Aplicar taxa"
              />
            </div>

            <span>{formatBRL(tax)}</span>
          </div>

          <div className="flex justify-between text-xl font-bold text-foreground pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{formatBRL(total)}</span>
          </div>
        </div>

        <div className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onCharge('money')} disabled={actionDisabled} className="h-12 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4 mr-2" />}
              Dinheiro
            </Button>

            <Button onClick={() => onCharge('pix')} disabled={actionDisabled} className="h-12 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Pix
            </Button>

            <Button onClick={() => onCharge('credit')} disabled={actionDisabled} className="h-12 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Crédito
            </Button>

            <Button onClick={() => onCharge('debit')} disabled={actionDisabled} className="h-12 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Débito
            </Button>
          </div>

          {items.length > 0 && requireComanda && comandaNumber === null && !isLoading && (
            <p className="text-xs text-center text-warning mt-2">
              Informe o número da comanda
            </p>
          )}
        </div>
      </div>

      {editingNotesItemKey && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Observação do item
                </h3>
                <p className="text-xs text-muted-foreground">
                  {editingItem?.product.name}
                </p>
              </div>

              <button
                onClick={() => setEditingNotesItemKey(null)}
                className="rounded-lg p-2 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <textarea
                value={editingNotesValue}
                onChange={(e) => setEditingNotesValue(e.target.value)}
                placeholder="Ex: sem gelo, ponto da carne, sem cebola..."
                className="w-full min-h-28 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingNotesItemKey(null)
                    setEditingNotesValue('')
                  }}
                >
                  Cancelar
                </Button>

                <Button onClick={saveItemNotes}>
                  Salvar observação
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}