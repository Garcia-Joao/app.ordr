'use client'

import { Check, Clock, X, ChevronRight, Eye } from 'lucide-react'
import type { Order } from '@/lib/pos-types'
import { formatBRL } from '@/lib/pos-types'

interface OrdersListProps {
  orders: Order[]
  onSelectOrder: (order: Order) => void
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pendente',
    color: 'text-warning bg-warning/20',
    dot: 'bg-warning',
  },
  paid: {
    icon: Check,
    label: 'Pago',
    color: 'text-success bg-success/20',
    dot: 'bg-success',
  },
  cancelled: {
    icon: X,
    label: 'Cancelado',
    color: 'text-destructive bg-destructive/20',
    dot: 'bg-destructive',
  },
}

export function OrdersList({ orders, onSelectOrder }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Clock className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">Nenhum pedido ainda</p>
        <p className="text-xs mt-1">Os pedidos aparecerao aqui</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => {
        const config = statusConfig[order.status]
        const Icon = config.icon

        return (
          <button
            key={order.id}
            onClick={() => onSelectOrder(order)}
            className="w-full flex items-center gap-3 p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors text-left group"
          >
            <div className={`flex items-center justify-center h-10 w-10 rounded-full ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Comanda #{order.comanda}</span>
                <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {order.items.length} {order.items.length !== 1 ? 'itens' : 'item'} &bull; {formatBRL(order.total)}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {order.createdAt.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Ver detalhes
              </span>
              <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </button>
        )
      })}
    </div>
  )
}
