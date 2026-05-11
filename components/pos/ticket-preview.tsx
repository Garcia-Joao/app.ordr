'use client'

import { Printer, X, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Order, OrderItem } from '@/lib/pos-types'
import { formatBRL, getItemPrice } from '@/lib/pos-types'

interface TicketPreviewProps {
  order: Order
  onClose: () => void
  onPrint: () => void
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

export function TicketPreview({ order, onClose, onPrint }: TicketPreviewProps) {
  const items = Array.isArray(order.items) ? order.items : []
  const orderTotal = Number(order.total ?? 0)
  const createdAt =
    order.createdAt instanceof Date
      ? order.createdAt
      : new Date(order.createdAt)

  const calculatedSubtotal = items.reduce(
    (sum, item) => sum + Number(getItemPrice(item) ?? 0) * item.quantity,
    0
  )
  const taxApplied = Boolean(order.taxApplied)
  const subtotal = taxApplied && orderTotal > 0
    ? orderTotal / 1.1
    : calculatedSubtotal
  const tax = taxApplied ? Math.max(0, orderTotal - subtotal) : 0

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground sm:text-lg">
              Detalhes do pedido
            </h3>
            <p className="text-xs text-muted-foreground sm:hidden">
              Arraste a lista ou toque em fechar para voltar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fechar recibo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="mx-auto max-w-[340px] rounded-xl bg-foreground p-4 font-mono text-xs text-background sm:p-6 sm:text-sm">
            <div className="mb-4 border-b border-dashed border-background/30 pb-4 text-center">
              <h4 className="text-lg font-bold sm:text-xl">ORDR</h4>
              <p className="mt-1 text-xs opacity-70">Bar & Eventos POS</p>
            </div>

            <div className="mb-4 space-y-1 border-b border-dashed border-background/30 pb-4">
              <div className="flex justify-between gap-3 text-xs">
                <span>Pedido</span>
                <span className="font-semibold">#{order.id}</span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span>Comanda</span>
                <span className="text-base font-semibold sm:text-lg">#{order.comanda}</span>
              </div>
              {order.comandaName && (
                <div className="flex justify-between gap-3 text-xs">
                  <span>Nome</span>
                  <span className="max-w-[180px] truncate font-semibold">{order.comandaName}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-xs">
                <span>Data</span>
                <span>
                  {createdAt.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span>Hora</span>
                <span>
                  {createdAt.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <div className="mb-4 space-y-2 border-b border-dashed border-background/30 pb-4">
              <p className="mb-2 text-xs opacity-70">ITENS</p>

              {items.map((item) => {
                const itemPrice = getItemPrice(item)
                const itemKey = getItemKey(item)
                const variationLabels = getVariationLabels(item)

                return (
                  <div key={itemKey} className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <span className="break-words">
                        {item.quantity}x {item.product.name}
                      </span>

                      {variationLabels.length > 0 && (
                        <div className="ml-3 mt-1 sm:ml-4">
                          {variationLabels.map((label, index) => (
                            <span
                              key={`${itemKey}-variation-${index}`}
                              className="block text-[11px] opacity-70 sm:text-xs"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="shrink-0">{formatBRL(itemPrice * item.quantity)}</span>
                  </div>
                )
              })}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between gap-3 text-xs opacity-70">
                <span>Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              {taxApplied && (
                <div className="flex justify-between gap-3 text-xs opacity-70">
                  <span>Taxa (10%)</span>
                  <span>{formatBRL(tax)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-dashed border-background/30 pt-2 text-base font-bold sm:text-lg">
                <span>TOTAL</span>
                <span>{formatBRL(orderTotal)}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-center">
              {order.status === 'paid' && (
                <span className="rounded-full bg-background/20 px-3 py-1 text-xs font-semibold uppercase">
                  PAGO
                </span>
              )}
              {order.status === 'pending' && (
                <span className="rounded-full bg-background/20 px-3 py-1 text-xs font-semibold uppercase">
                  PENDENTE
                </span>
              )}
              {order.status === 'cancelled' && (
                <span className="rounded-full bg-background/20 px-3 py-1 text-xs font-semibold uppercase">
                  CANCELADO
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-col items-center border-t border-dashed border-background/30 pt-4 sm:mt-6">
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-background/20 sm:h-16 sm:w-16">
                <QrCode className="h-9 w-9 text-background sm:h-10 sm:w-10" />
              </div>
              <p className="text-xs opacity-70">Escaneie para recibo digital</p>
            </div>

            <div className="mt-4 border-t border-dashed border-background/30 pt-4 text-center text-xs opacity-50">
              <p>Obrigado pela preferência!</p>
              <p className="mt-1">Powered by Ordr POS</p>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-card p-4 sm:p-5">
          <Button variant="outline" onClick={onClose} className="h-11">
            Fechar
          </Button>
          <Button
            onClick={onPrint}
            className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>
    </div>
  )
}
