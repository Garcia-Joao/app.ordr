'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  CheckCircle,
  Clock,
  Laptop,
  Monitor,
  Power,
  Printer,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
  UserRound,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { deleteDevice, listDevices, type CompanyDevice, type DeviceType } from '@/lib/api/devices'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getRelativeLastSeen(value?: string | null) {
  if (!value) return 'Sem atividade'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem atividade'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'Agora mesmo'
  if (diffMinutes === 1) return 'Há 1 minuto'
  if (diffMinutes < 60) return `Há ${diffMinutes} minutos`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours === 1) return 'Há 1 hora'
  if (diffHours < 24) return `Há ${diffHours} horas`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Há 1 dia'
  return `Há ${diffDays} dias`
}

function getDeviceIcon(type: DeviceType) {
  if (type === 'MOBILE') return Smartphone
  if (type === 'TABLET') return Tablet
  if (type === 'DESKTOP') return Monitor
  return Laptop
}

function getDeviceClientLabel(device: CompanyDevice) {
  if (device.clientType === 'ELECTRON') return 'Electron Terminal'
  return 'Web'
}

function getDeviceTypeLabel(type: DeviceType) {
  if (type === 'MOBILE') return 'Celular'
  if (type === 'TABLET') return 'Tablet'
  if (type === 'DESKTOP') return 'Desktop'
  return 'Desconhecido'
}

export default function DispositivosPage() {
  const [devices, setDevices] = useState<CompanyDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function loadDevices({ silent = false } = {}) {
    try {
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setError('')
      const result = await listDevices()
      setDevices(result.devices)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dispositivos.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadDevices()

    const interval = window.setInterval(() => {
      loadDevices({ silent: true })
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [])

  async function handleDeleteDevice(device: CompanyDevice) {
    const confirmed = window.confirm(
      `Remover o dispositivo "${device.name}" desta empresa? O histórico de pedidos continua salvo, mas ele deixa de aparecer como dispositivo cadastrado.`
    )

    if (!confirmed) return

    try {
      setError('')
      await deleteDevice(device.id)
      setDevices((prev) => prev.filter((item) => item.id !== device.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover dispositivo.')
    }
  }

  const onlineDevices = devices.filter((device) => device.status === 'online').length
  const totalSales = devices.reduce((sum, device) => sum + device.totalSales, 0)
  const totalOrders = devices.reduce((sum, device) => sum + device.salesCount, 0)
  const printTerminals = devices.filter((device) => device.isPrintTerminal && device.printTerminalEnabled).length

  const devicesByStatus = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'online' ? -1 : 1
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    })
  }, [devices])

  return (
    <div className="flex min-h-full flex-col overflow-visible bg-background lg:h-full lg:overflow-hidden mobile-page-scroll">
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-foreground">Dispositivos</h1>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
                  {onlineDevices} de {devices.length} online
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Veja quais computadores, celulares e tablets estão conectados à empresa, quem está logado em cada um e as vendas registradas hoje por dispositivo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadDevices({ silent: true })}
            disabled={isRefreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground shadow-sm transition hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-border bg-card/50 p-4 sm:gap-4 sm:p-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Power className="h-5 w-5" />}
          label="Dispositivos online"
          value={`${onlineDevices}`}
          detail={`${devices.length} dispositivo(s) conhecidos`}
        />
        <MetricCard
          icon={<Activity className="h-5 w-5" />}
          label="Pedidos hoje"
          value={`${totalOrders}`}
          detail="Pedidos pagos vinculados a dispositivos"
        />
        <MetricCard
          icon={<Monitor className="h-5 w-5" />}
          label="Vendas hoje"
          value={formatCurrency(totalSales)}
          detail="Total pago hoje por dispositivo"
        />
        <MetricCard
          icon={<Printer className="h-5 w-5" />}
          label="Terminais de impressão"
          value={`${printTerminals}`}
          detail="Electron conectado e autorizado"
        />
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive sm:mx-6">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-visible p-4 sm:p-6 lg:overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-3xl border border-border bg-card" />
            ))}
          </div>
        ) : devicesByStatus.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {devicesByStatus.map((device) => (
              <DeviceCard key={device.id} device={device} onDelete={() => handleDeleteDevice(device)} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
            <Monitor className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-lg font-bold text-foreground">Nenhum dispositivo conectado ainda</p>
            <p className="mt-1 max-w-md text-sm">
              Quando alguém acessar o ORDR nesta empresa, o dispositivo aparecerá aqui automaticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-black text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function DeviceCard({ device, onDelete }: { device: CompanyDevice; onDelete: () => void }) {
  const Icon = getDeviceIcon(device.type)
  const isOnline = device.status === 'online'
  const currentUserName = device.currentUser?.name || device.currentUser?.username || 'Nenhum usuário identificado'

  return (
    <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/45 hover:shadow-lg sm:rounded-3xl sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-foreground">{device.name}</h3>
            <p className="truncate text-sm text-muted-foreground">
              {getDeviceTypeLabel(device.type)} · {getDeviceClientLabel(device)}{device.os ? ` · ${device.os}` : ''}{device.browser ? ` · ${device.browser}` : ''}
            </p>
          </div>
        </div>

        {isOnline ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Online
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" />
            Offline
          </span>
        )}
      </div>

      {device.clientType === 'ELECTRON' && (
        <div className="mb-5 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-sky-700 dark:text-sky-300">
            <Printer className="h-4 w-4" />
            Terminal Electron
          </div>
          <p className="text-sm text-muted-foreground">
            {device.printTerminalEnabled
              ? 'Este dispositivo pode receber jobs e imprimir localmente.'
              : 'Electron detectado, mas ainda não está habilitado como terminal de impressão.'}
          </p>
          {device.terminalApprovedAt && (
            <p className="mt-1 text-xs text-muted-foreground">Autorizado em {formatDateTime(device.terminalApprovedAt)}</p>
          )}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-border bg-background p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-black text-foreground">
          <UserRound className="h-4 w-4 text-primary" />
          Usuário logado
        </div>
        <p className="truncate text-sm text-muted-foreground">{currentUserName}</p>
        {device.currentUser?.username && device.currentUser.name && (
          <p className="mt-1 text-xs text-muted-foreground">@{device.currentUser.username}</p>
        )}
      </div>

      {device.localPrinters && device.localPrinters.length > 0 && (
        <div className="mb-5 rounded-2xl border border-border bg-background p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-foreground">
            <Printer className="h-4 w-4 text-primary" />
            Impressoras locais
          </div>
          <div className="space-y-2">
            {device.localPrinters.slice(0, 4).map((printer) => (
              <div key={printer.name} className="rounded-xl border border-border bg-card px-3 py-2">
                <p className="truncate text-sm font-bold text-foreground">
                  {printer.displayName || printer.name}
                  {printer.isDefault ? ' · padrão' : ''}
                </p>
                <p className="truncate text-xs text-muted-foreground">{printer.name}</p>
              </div>
            ))}
            {device.localPrinters.length > 4 && (
              <p className="text-xs font-semibold text-muted-foreground">+{device.localPrinters.length - 4} impressora(s)</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <InfoTile label="Pedidos hoje" value={`${device.salesCount}`} />
        <InfoTile label="Vendas hoje" value={formatCurrency(device.totalSales)} />
        <InfoTile label="Último sinal" value={getRelativeLastSeen(device.lastSeenAt)} />
        <InfoTile label="Registrado" value={formatDateTime(device.firstSeenAt)} />
      </div>

      <div className="mt-4 space-y-2 rounded-2xl border border-border bg-background p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {isOnline ? <Clock className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span>Última atividade: {formatDateTime(device.lastSeenAt)}</span>
        </div>
        {device.ipAddress && <p className="truncate">IP: {device.ipAddress}</p>}
      </div>

      <div className="mt-4 flex items-center justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Remover
        </button>
      </div>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-foreground">{value}</p>
    </div>
  )
}
