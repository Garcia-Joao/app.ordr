'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  MonitorCheck,
  MonitorOff,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Unplug,
  X,
} from 'lucide-react'
import {
  createPrintPort,
  deletePrintPort,
  getPrinterSettings,
  listPrintPorts,
  listPrintTerminals,
  savePrinterSettings,
  updatePrintPort,
  type PrintPort,
  type PrintTemplate,
  type PrintTemplates,
  type PrintTerminal,
} from '@/lib/api/printers'
import { openOrdrTerminalWithFallback } from '@/lib/open-terminal'
import {
  clearPreferredPrintTerminalId,
  getPreferredPrintTerminalId,
  setPreferredPrintTerminalId,
} from '@/lib/print-terminal-preference'

const TERMINAL_ONLINE_THRESHOLD_MS = 45 * 1000

const DEFAULT_PRINT_TEMPLATES: PrintTemplates = {
  orderTicket: {
    kind: 'ORDER_TICKET',
    config: {
      headerText: '*** ORDR ***',
      footerText: '',
      enabledFields: {
        logo: true,
        portName: true,
        orderId: true,
        comanda: true,
        comandaName: true,
        observation: true,
        items: true,
        variations: true,
        notes: true,
        date: true,
      },
    },
  },
  buyList: {
    kind: 'BUY_LIST',
    config: {
      headerText: '*** LISTA DE COMPRAS ***',
      footerText: '',
      enabledFields: {
        requestTitle: true,
        requestId: true,
        supplierName: true,
        eventName: true,
        notes: true,
        date: true,
        checklistBoxes: true,
        categories: true,
        itemNotes: true,
      },
    },
  },
}

function mergeTemplate(defaultTemplate: PrintTemplate, template?: PrintTemplate | null): PrintTemplate {
  return {
    ...defaultTemplate,
    ...(template ?? {}),
    config: {
      ...defaultTemplate.config,
      ...(template?.config ?? {}),
      enabledFields: {
        ...defaultTemplate.config.enabledFields,
        ...(template?.config?.enabledFields ?? {}),
      },
    },
  }
}

function mergeTemplates(templates?: PrintTemplates | null): PrintTemplates {
  return {
    orderTicket: mergeTemplate(DEFAULT_PRINT_TEMPLATES.orderTicket, templates?.orderTicket),
    buyList: mergeTemplate(DEFAULT_PRINT_TEMPLATES.buyList, templates?.buyList),
  }
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

function isTerminalOnline(terminal: PrintTerminal) {
  if (!terminal.printTerminalEnabled) return false
  if (terminal.status === 'online') return true
  if (!terminal.lastSeenAt) return false

  const lastSeen = new Date(terminal.lastSeenAt).getTime()
  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen <= TERMINAL_ONLINE_THRESHOLD_MS
}

function getTerminalKey(terminal: PrintTerminal) {
  return terminal.name?.trim().toLowerCase() || terminal.id
}

function getLatestOnlineTerminals(terminals: PrintTerminal[]) {
  const latestByName = new Map<string, PrintTerminal>()

  for (const terminal of terminals) {
    if (!isTerminalOnline(terminal)) continue

    const key = getTerminalKey(terminal)
    const current = latestByName.get(key)

    if (!current) {
      latestByName.set(key, terminal)
      continue
    }

    const currentLastSeen = new Date(current.lastSeenAt || 0).getTime()
    const nextLastSeen = new Date(terminal.lastSeenAt || 0).getTime()

    if (nextLastSeen > currentLastSeen) {
      latestByName.set(key, terminal)
    }
  }

  return Array.from(latestByName.values()).sort((a, b) => {
    const aDate = new Date(a.lastSeenAt || 0).getTime()
    const bDate = new Date(b.lastSeenAt || 0).getTime()
    return bDate - aDate
  })
}

function getTerminalUserLabel(terminal?: PrintTerminal | null) {
  if (!terminal) return '—'
  return terminal.currentUser?.name || terminal.currentUser?.username || '—'
}

function getPortStatus(port: PrintPort) {
  if (!port.active) {
    return { label: 'Inativa', tone: 'warning' as const, description: 'Esta port está cadastrada, mas marcada como inativa.', icon: Unplug }
  }

  const bindingCount = port.bindings?.length ?? 0

  if (bindingCount === 0) {
    return { label: 'Livre', tone: 'neutral' as const, description: 'Port lógica criada. Vincule impressoras pelo ORDR Terminal.', icon: Settings2 }
  }

  return { label: `${bindingCount} vínculo(s)`, tone: 'success' as const, description: 'Esta port possui impressora(s) vinculada(s) no ORDR Terminal.', icon: CheckCircle }
}

function getPortStats(ports: PrintPort[]) {
  return ports.reduce(
    (acc, port) => {
      const status = getPortStatus(port)
      acc.total += 1
      if (status.tone === 'success') acc.bound += 1
      if (status.tone === 'warning') acc.warning += 1
      if ((port.bindings?.length ?? 0) === 0) acc.free += 1
      return acc
    },
    { total: 0, bound: 0, warning: 0, free: 0 }
  )
}

export default function ImpressorasPage() {
  const [ports, setPorts] = useState<PrintPort[]>([])
  const [terminals, setTerminals] = useState<PrintTerminal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingPort, setEditingPort] = useState<PrintPort | null>(null)
  const [isPortModalOpen, setIsPortModalOpen] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [printTemplates, setPrintTemplates] = useState<PrintTemplates>(DEFAULT_PRINT_TEMPLATES)
  const [preferredTerminalId, setPreferredTerminalIdState] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onlineTerminals = useMemo(() => getLatestOnlineTerminals(terminals), [terminals])
  const preferredTerminal = onlineTerminals.find((terminal) => terminal.id === preferredTerminalId) ?? null
  const hasOnlineTerminal = onlineTerminals.length > 0
  const portStats = useMemo(() => getPortStats(ports), [ports])

  async function loadData(options?: { silent?: boolean }) {
    try {
      setError(null)
      if (options?.silent) setIsRefreshing(true)

      const [portsResult, terminalsResult, settingsResult] = await Promise.all([
        listPrintPorts(),
        listPrintTerminals(),
        getPrinterSettings(),
      ])

      setPorts(portsResult.ports)
      setTerminals(terminalsResult.terminals)
      setPrintTemplates(mergeTemplates(settingsResult.printTemplates))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível carregar ports e terminais.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setPreferredTerminalIdState(getPreferredPrintTerminalId())

    function syncPreference() {
      setPreferredTerminalIdState(getPreferredPrintTerminalId())
    }

    window.addEventListener('ordr-print-terminal-preference-updated', syncPreference)
    window.addEventListener('storage', syncPreference)

    return () => {
      window.removeEventListener('ordr-print-terminal-preference-updated', syncPreference)
      window.removeEventListener('storage', syncPreference)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadData({ silent: true })
    }, 15_000)

    return () => window.clearInterval(interval)
  }, [])

  function handleSelectPreferredTerminal(terminalId: string) {
    setPreferredPrintTerminalId(terminalId)
    setPreferredTerminalIdState(terminalId)
    setMessage('Terminal de impressão deste computador atualizado.')
  }

  function handleClearPreferredTerminal() {
    clearPreferredPrintTerminalId()
    setPreferredTerminalIdState(null)
    setMessage('Este computador voltou para o modo automático de impressão.')
  }

  function handleCreatePort() {
    setEditingPort(null)
    setIsPortModalOpen(true)
  }

  function handleEditPort(port: PrintPort) {
    setEditingPort(port)
    setIsPortModalOpen(true)
  }

  async function handleSavePort(data: {
    name: string
    description: string
    active: boolean
  }) {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      const payload = {
        name: data.name.trim(),
        description: data.description.trim() || null,
        active: data.active,
      }

      if (editingPort) {
        await updatePrintPort(editingPort.id, payload)
        setMessage('Port atualizada com sucesso.')
      } else {
        await createPrintPort(payload)
        setMessage('Port criada com sucesso.')
      }

      setIsPortModalOpen(false)
      setEditingPort(null)
      await loadData({ silent: true })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a port.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveTemplates(nextTemplates: PrintTemplates) {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      const result = await savePrinterSettings({ printTemplates: nextTemplates })
      setPrintTemplates(mergeTemplates(result.printTemplates))
      setIsTemplateModalOpen(false)
      setMessage('Templates de impressão salvos com sucesso.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os templates.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeletePort(port: PrintPort) {
    if (port.isDefaultReceipt || port.isSystem) {
      setError('A Port Caixa/Recibos é fixa do sistema e não pode ser removida.')
      return
    }

    const confirmed = window.confirm(
      `Remover a port "${port.name}"? Categorias e produtos ligados a ela voltarão a ficar sem port configurada.`
    )
    if (!confirmed) return

    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)
      await deletePrintPort(port.id)
      setMessage('Port removida.')
      await loadData({ silent: true })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível remover a port.')
    } finally {
      setIsSaving(false)
    }
  }

  const blockingMessage = isLoading ? 'Carregando impressoras...' : isSaving ? 'Salvando...' : null

  return (
    <div className="h-full flex flex-col overflow-hidden relative" aria-busy={Boolean(blockingMessage)}>
      <div className="flex flex-col gap-4 border-b border-border bg-card/95 px-6 py-5 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">ORDR Print</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Impressões</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Configure ports, vínculos e templates de impressão. O vínculo com impressoras físicas é feito no ORDR Terminal.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openOrdrTerminalWithFallback}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent/10"
          >
            <MonitorCheck className="h-4 w-4" />
            Abrir terminal
          </button>
          <button
            onClick={() => loadData({ silent: true })}
            disabled={isRefreshing}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent/10"
          >
            <Settings2 className="h-4 w-4" />
            Templates
          </button>
          <button
            onClick={handleCreatePort}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nova port
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {message && (
            <div className="flex items-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-700 dark:text-green-300">
              <CheckCircle className="h-4 w-4" />
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <section
            className={`overflow-hidden rounded-3xl border p-5 shadow-sm ${
              hasOnlineTerminal
                ? 'border-green-500/30 bg-green-500/[0.06]'
                : 'border-warning/40 bg-warning/[0.08]'
            }`}
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
                    hasOnlineTerminal ? 'bg-green-500/15 text-green-600 dark:text-green-300' : 'bg-warning/15 text-warning'
                  }`}
                >
                  {hasOnlineTerminal ? <MonitorCheck className="h-7 w-7" /> : <MonitorOff className="h-7 w-7" />}
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Status do terminal
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">
                    {hasOnlineTerminal ? 'Terminal conectado' : 'Terminal desconectado'}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {hasOnlineTerminal
                      ? 'Somente terminais online aparecem abaixo. Escolha qual deles este computador deve usar ao vender no PDV.'
                      : 'Nenhum ORDR Terminal está online agora. Abra o terminal no computador conectado às impressoras para vincular ports.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                  <span className="block text-xs font-bold text-muted-foreground">Online agora</span>
                  <strong className="text-xl font-black text-foreground">{onlineTerminals.length}</strong>
                </div>
                <button
                  type="button"
                  onClick={openOrdrTerminalWithFallback}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
                >
                  {hasOnlineTerminal ? <MonitorCheck className="h-4 w-4" /> : <Unplug className="h-4 w-4" />}
                  {hasOnlineTerminal ? 'Abrir terminal' : 'Conectar terminal'}
                </button>
              </div>
            </div>

            {hasOnlineTerminal && (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                        Terminal deste computador
                      </p>
                      <h3 className="mt-1 text-lg font-black text-foreground">
                        {preferredTerminal ? preferredTerminal.name : 'Modo automático'}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Esta escolha fica salva só neste navegador/computador. O PDV enviará as impressões preferencialmente para o terminal escolhido.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearPreferredTerminal}
                      disabled={!preferredTerminalId}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent/10 disabled:opacity-50"
                    >
                      Usar automático
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                {onlineTerminals.map((terminal) => (
                  <article key={terminal.id} className={`rounded-2xl border bg-card p-4 shadow-sm ${preferredTerminalId === terminal.id ? 'border-primary ring-2 ring-primary/20' : 'border-green-500/20'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-foreground">{terminal.name}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Usuário: {getTerminalUserLabel(terminal)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Último sinal: {formatDateTime(terminal.lastSeenAt)}
                        </p>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-black text-green-700 dark:text-green-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Online
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-muted/40 px-3 py-2">
                        <span className="block font-bold text-muted-foreground">Impressoras locais</span>
                        <strong className="text-foreground">{(terminal.localPrinters ?? []).length}</strong>
                      </div>
                      <div className="rounded-xl bg-muted/40 px-3 py-2">
                        <span className="block font-bold text-muted-foreground">Device ID</span>
                        <strong className="block truncate text-foreground">{terminal.id}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectPreferredTerminal(terminal.id)}
                      disabled={preferredTerminalId === terminal.id}
                      className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-black transition ${
                        preferredTerminalId === terminal.id
                          ? 'bg-primary/10 text-primary'
                          : 'border border-border bg-background text-foreground hover:bg-accent/10'
                      }`}
                    >
                      {preferredTerminalId === terminal.id ? 'Selecionado para este computador' : 'Usar este terminal neste computador'}
                    </button>
                  </article>
                ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard label="Ports" value={portStats.total} icon={<Printer className="h-5 w-5" />} />
            <MetricCard label="Vinculadas" value={portStats.bound} tone="success" icon={<CheckCircle className="h-5 w-5" />} />
            <MetricCard label="Atenção" value={portStats.warning} tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
            <MetricCard label="Livres" value={portStats.free} icon={<Settings2 className="h-5 w-5" />} />
          </section>

          <section className="rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Ports lógicas</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Rotas de impressão</h2>
                <p className="text-sm text-muted-foreground">
                  Use nas categorias e produtos. Ex: Bebidas → Bar, Comidas → Cozinha.
                </p>
              </div>

              <button
                onClick={handleCreatePort}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Criar port
              </button>
            </div>

            {ports.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-muted text-muted-foreground">
                  <Printer className="h-8 w-8" />
                </div>
                <p className="mt-4 text-base font-black text-foreground">Nenhuma port cadastrada</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Crie Port 1, Cozinha, Bar ou outro nome lógico. Depois vincule no ORDR Terminal.
                </p>
                <button
                  onClick={handleCreatePort}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Nova port
                </button>
              </div>
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {ports.map((port) => {
                  const status = getPortStatus(port)
                  const StatusIcon = status.icon

                  return (
                    <article key={port.id} className="group rounded-2xl border border-border bg-background p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-foreground">{port.name}</p>
                          {(port.isDefaultReceipt || port.isSystem) && (
                            <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-primary">Port caixa fixa</span>
                          )}
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {port.description || 'Sem descrição'}
                          </p>
                        </div>

                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${getStatusClass(status.tone)}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-4 rounded-2xl border border-border bg-card px-3 py-3">
                        <p className="text-sm font-semibold text-foreground">{status.description}</p>
                        <div className="mt-3 grid gap-2 text-xs">
                          <InfoLine label="Tipo" value={port.isDefaultReceipt ? "Port caixa / recibos" : "Port lógica"} />
                          <InfoLine
                            label="Vínculos"
                            value={(port.bindings?.length ?? 0) > 0 ? `${port.bindings?.length ?? 0} impressora(s)` : 'Configurado no Terminal'}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleEditPort(port)}
                          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground transition hover:bg-accent/10"
                        >
                          Editar
                        </button>
                        {!(port.isDefaultReceipt || port.isSystem) && (
                          <button
                            onClick={() => handleDeletePort(port)}
                            className="rounded-xl border border-red-500/20 px-3 py-2 text-red-600 transition hover:bg-red-500/10"
                            title="Remover port"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">Templates de impressão</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Defina cabeçalho, rodapé e quais informações aparecem em pedidos e listas de compras.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
              >
                <Settings2 className="h-4 w-4" />
                Configurar templates
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Como usar</h2>
                <ol className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <li><strong className="text-foreground">1.</strong> Crie ports lógicas nesta tela.</li>
                  <li><strong className="text-foreground">2.</strong> Abra o ORDR Terminal no computador das impressoras.</li>
                  <li><strong className="text-foreground">3.</strong> No Terminal, vincule cada port a uma impressora local.</li>
                  <li><strong className="text-foreground">4.</strong> Nas categorias/produtos, escolha a port de destino.</li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      </div>

      {blockingMessage && <BlockingOverlay message={blockingMessage} />}

      {isTemplateModalOpen && (
        <TemplateModal
          templates={printTemplates}
          onClose={() => setIsTemplateModalOpen(false)}
          onSave={handleSaveTemplates}
        />
      )}

      {isPortModalOpen && (
        <PortModal
          port={editingPort}
          onClose={() => {
            setIsPortModalOpen(false)
            setEditingPort(null)
          }}
          onSave={handleSavePort}
        />
      )}
    </div>
  )
}

function getStatusClass(tone: 'success' | 'warning' | 'neutral') {
  if (tone === 'success') return 'border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300'
  if (tone === 'warning') return 'border border-warning/40 bg-warning/10 text-warning-foreground dark:text-yellow-300'
  return 'border border-border bg-muted text-muted-foreground'
}

function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: 'success' | 'warning' | 'neutral'
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-green-500/10 text-green-700 dark:text-green-300'
      : tone === 'warning'
        ? 'bg-warning/15 text-warning-foreground dark:text-yellow-300'
        : 'bg-primary/10 text-primary'

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
          <strong className="mt-1 block text-3xl font-black text-foreground">{value}</strong>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass}`}>{icon}</div>
      </div>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/45 px-3 py-2">
      <span className="font-bold text-muted-foreground">{label}</span>
      <strong className="truncate text-right font-black text-foreground">{value}</strong>
    </div>
  )
}

function BlockingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-2xl">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">{message}</p>
          <p className="text-xs text-muted-foreground">Aguarde enquanto finalizamos a operação.</p>
        </div>
      </div>
    </div>
  )
}

function TemplateModal({
  templates,
  onClose,
  onSave,
}: {
  templates: PrintTemplates
  onClose: () => void
  onSave: (templates: PrintTemplates) => void
}) {
  const [draft, setDraft] = useState<PrintTemplates>(() => mergeTemplates(templates))
  const orderFields = [
    ['portName', 'Nome da port'],
    ['orderId', 'ID do pedido'],
    ['comanda', 'Comanda'],
    ['comandaName', 'Nome da comanda'],
    ['observation', 'Observação do pedido'],
    ['items', 'Itens'],
    ['variations', 'Variações'],
    ['notes', 'Observações dos itens'],
    ['date', 'Data/hora'],
  ] as const
  const buyFields = [
    ['requestTitle', 'Título da requisição'],
    ['requestId', 'ID da requisição'],
    ['supplierName', 'Local/fornecedor'],
    ['eventName', 'Evento vinculado'],
    ['notes', 'Observações da requisição'],
    ['date', 'Data/hora'],
    ['checklistBoxes', 'Quadradinhos de checklist'],
    ['categories', 'Categorias dos itens'],
    ['itemNotes', 'Observações dos itens'],
  ] as const

  function patchTemplate(kind: keyof PrintTemplates, patch: Partial<PrintTemplate['config']>) {
    setDraft((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        config: {
          ...current[kind].config,
          ...patch,
          enabledFields: {
            ...current[kind].config.enabledFields,
            ...(patch.enabledFields ?? {}),
          },
        },
      },
    }))
  }

  function toggleField(kind: keyof PrintTemplates, field: string) {
    patchTemplate(kind, {
      enabledFields: {
        [field]: !draft[kind].config.enabledFields[field],
      },
    })
  }

  function renderTemplateCard(
    kind: keyof PrintTemplates,
    title: string,
    description: string,
    fields: readonly (readonly [string, string])[],
  ) {
    const template = draft[kind]

    return (
      <section className="rounded-3xl border border-border bg-background p-4">
        <div>
          <h3 className="text-lg font-black text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-foreground">
            Texto de cabeçalho
            <textarea
              value={template.config.headerText}
              onChange={(event) => patchTemplate(kind, { headerText: event.target.value })}
              rows={3}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-foreground">
            Texto de rodapé
            <textarea
              value={template.config.footerText}
              onChange={(event) => patchTemplate(kind, { footerText: event.target.value })}
              rows={3}
              placeholder="Opcional"
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {fields.map(([field, label]) => (
            <label key={field} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2 text-sm">
              <span className="font-bold text-foreground">{label}</span>
              <input
                type="checkbox"
                checked={template.config.enabledFields[field] !== false}
                onChange={() => toggleField(kind, field)}
              />
            </label>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="mobile-modal-shell flex h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Templates</p>
            <h2 className="mt-1 text-xl font-black text-foreground">Configurar impressões</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Essas opções ficam salvas no banco e serão usadas pelo Terminal, mesmo com API hospedada na nuvem.
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition hover:bg-accent/10 hover:text-foreground" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {renderTemplateCard('orderTicket', 'Pedidos / comandas', 'Define como os pedidos normais serão impressos.', orderFields)}
          {renderTemplateCard('buyList', 'Lista de compras', 'Define a impressão de compras em formato checklist.', buyFields)}
        </div>

        <div className="ordr-mobile-modal-footer flex justify-end gap-2 border-t border-border bg-card p-4 sm:p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:bg-accent/10">
            Cancelar
          </button>
          <button type="button" onClick={() => onSave(draft)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition hover:bg-primary/90">
            <Save className="h-4 w-4" />
            Salvar templates
          </button>
        </div>
      </div>
    </div>
  )
}

function PortModal({
  port,
  onClose,
  onSave,
}: {
  port: PrintPort | null
  onClose: () => void
  onSave: (data: {
    name: string
    description: string
    active: boolean
  }) => void
}) {
  const [name, setName] = useState(port?.name ?? '')
  const [description, setDescription] = useState(port?.description ?? '')
  const [active, setActive] = useState(port?.active ?? true)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave({
      name,
      description,
      active,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="mobile-modal-shell flex h-auto max-h-[94svh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Port lógica</p>
            <h2 className="mt-1 text-xl font-black text-foreground">{port ? 'Editar port' : 'Nova port'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre apenas a rota lógica. A impressora física é escolhida no ORDR Terminal.
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition hover:bg-accent/10 hover:text-foreground" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <label className="grid gap-2 text-sm font-bold text-foreground">
            Nome da port
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Ex: Cozinha / Bar / Port 1"
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-foreground">
            Descrição
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex: Tickets da cozinha"
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
            <div>
              <span className="text-sm font-black text-foreground">Port ativa</span>
              <p className="text-xs text-muted-foreground">
                Ports inativas continuam cadastradas, mas não devem gerar novos jobs.
              </p>
            </div>
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          </label>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            Depois de salvar, abra o ORDR Terminal para escolher qual impressora local atende esta port.
          </div>

          <div className="ordr-mobile-modal-footer -mx-4 flex justify-end gap-2 border-t border-border bg-card px-4 pt-4 sm:-mx-5 sm:px-5">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:bg-accent/10">
              Cancelar
            </button>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition hover:bg-primary/90">
              <Save className="h-4 w-4" />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
