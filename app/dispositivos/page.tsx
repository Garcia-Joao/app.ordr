'use client'

import { useState } from 'react'
import { Monitor, Plus, Trash2, CheckCircle, XCircle, Smartphone, Tablet, Power } from 'lucide-react'

interface Device {
  id: string
  name: string
  type: 'terminal' | 'tablet' | 'mobile'
  serialNumber: string
  status: 'online' | 'offline'
  lastActivity?: Date
  operator?: string
  salesCount: number
  totalSales: number
}

const SAMPLE_DEVICES: Device[] = [
  {
    id: '1',
    name: 'Terminal 01',
    type: 'terminal',
    serialNumber: 'TRM-001-2024',
    status: 'online',
    lastActivity: new Date(),
    operator: 'Carlos',
    salesCount: 45,
    totalSales: 2890,
  },
  {
    id: '2',
    name: 'Terminal 02',
    type: 'terminal',
    serialNumber: 'TRM-002-2024',
    status: 'online',
    lastActivity: new Date(Date.now() - 1000 * 60 * 2),
    operator: 'Maria',
    salesCount: 32,
    totalSales: 1850,
  },
  {
    id: '3',
    name: 'Tablet Bar',
    type: 'tablet',
    serialNumber: 'TAB-001-2024',
    status: 'online',
    lastActivity: new Date(Date.now() - 1000 * 60 * 5),
    operator: 'João',
    salesCount: 28,
    totalSales: 1420,
  },
  {
    id: '4',
    name: 'Mobile Garçom',
    type: 'mobile',
    serialNumber: 'MOB-001-2024',
    status: 'offline',
    salesCount: 0,
    totalSales: 0,
  },
]

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DispositivosPage() {
  const [devices, setDevices] = useState<Device[]>(SAMPLE_DEVICES)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)

  const handleDeleteDevice = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId))
  }

  const handleAddNew = () => {
    setEditingDevice(null)
    setIsModalOpen(true)
  }

  const handleSaveDevice = (deviceData: Omit<Device, 'id' | 'status' | 'lastActivity' | 'salesCount' | 'totalSales'>) => {
    if (editingDevice) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === editingDevice.id
            ? { ...d, ...deviceData }
            : d
        )
      )
    } else {
      const newDevice: Device = {
        ...deviceData,
        id: Math.random().toString(36).substring(2, 9),
        status: 'offline',
        salesCount: 0,
        totalSales: 0,
      }
      setDevices((prev) => [...prev, newDevice])
    }
    setIsModalOpen(false)
    setEditingDevice(null)
  }

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'terminal':
        return Monitor
      case 'tablet':
        return Tablet
      case 'mobile':
        return Smartphone
    }
  }

  const onlineDevices = devices.filter((d) => d.status === 'online').length
  const totalSales = devices.reduce((sum, d) => sum + d.totalSales, 0)
  const totalOrders = devices.reduce((sum, d) => sum + d.salesCount, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Dispositivos</h1>
          <span className="text-sm text-muted-foreground">
            {onlineDevices} de {devices.length} online
          </span>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Dispositivo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-6 border-b border-border bg-card/50">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Power className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dispositivos Online</p>
              <p className="text-2xl font-bold text-foreground">{onlineDevices}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pedidos Hoje</p>
              <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Monitor className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendas Hoje</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSales)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((device) => {
            const Icon = getDeviceIcon(device.type)
            return (
              <div
                key={device.id}
                className="bg-card rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${device.status === 'online' ? 'bg-success/10' : 'bg-muted'}`}>
                      <Icon className={`h-6 w-6 ${device.status === 'online' ? 'text-success' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{device.name}</h3>
                      <p className="text-sm text-muted-foreground">{device.serialNumber}</p>
                    </div>
                  </div>
                  {device.status === 'online' ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded-full text-xs font-medium">
                      <CheckCircle className="h-3 w-3" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                      <XCircle className="h-3 w-3" />
                      Offline
                    </span>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  {device.operator && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Operador</span>
                      <span className="text-foreground font-medium">{device.operator}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vendas Hoje</span>
                    <span className="text-foreground">{device.salesCount} pedidos</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono text-foreground">{formatCurrency(device.totalSales)}</span>
                  </div>
                  {device.lastActivity && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Última Atividade</span>
                      <span className="text-foreground">
                        {device.lastActivity.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => handleDeleteDevice(device.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="text-sm">Remover</span>
                  </button>
                </div>
              </div>
            )
          })}

          {devices.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Monitor className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum dispositivo cadastrado</p>
              <p className="text-sm">Adicione um dispositivo para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* Device Modal */}
      {isModalOpen && (
        <DeviceModal
          device={editingDevice}
          onSave={handleSaveDevice}
          onClose={() => {
            setIsModalOpen(false)
            setEditingDevice(null)
          }}
        />
      )}
    </div>
  )
}

function DeviceModal({
  device,
  onSave,
  onClose,
}: {
  device: Device | null
  onSave: (data: Omit<Device, 'id' | 'status' | 'lastActivity' | 'salesCount' | 'totalSales'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(device?.name || '')
  const [type, setType] = useState<Device['type']>(device?.type || 'terminal')
  const [serialNumber, setSerialNumber] = useState(device?.serialNumber || '')
  const [operator, setOperator] = useState(device?.operator || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name,
      type,
      serialNumber,
      operator: operator || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {device ? 'Editar Dispositivo' : 'Novo Dispositivo'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ex: Terminal 01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Device['type'])}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="terminal">Terminal</option>
              <option value="tablet">Tablet</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Número de Série</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ex: TRM-001-2024"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Operador (opcional)</label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Nome do operador"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {device ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
