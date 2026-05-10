'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle,
  Loader2,
  MonitorCheck,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import {
  bindPrintPort,
  createPrintPort,
  deletePrintPort,
  listPrintPorts,
  listPrintTerminals,
  updatePrintPort,
  type LocalPrinter,
  type PrintPort,
  type PrintTerminal,
} from '@/lib/api/printers'

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

function openTerminal() {
  window.location.href = 'ordr://terminal'
}

function getPrinterLabel(printer: LocalPrinter) {
  return printer.displayName || printer.name
}

export default function ImpressorasPage() {
  const [ports, setPorts] = useState<PrintPort[]>([])
  const [terminals, setTerminals] = useState<PrintTerminal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingPort, setEditingPort] = useState<PrintPort | null>(null)
  const [isPortModalOpen, setIsPortModalOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onlineTerminals = useMemo(
    () => terminals.filter((terminal) => terminal.status === 'online' && terminal.printTerminalEnabled),
    [terminals]
  )

  async function loadData() {
    try {
      setError(null)
      const [portsResult, terminalsResult] = await Promise.all([
        listPrintPorts(),
        listPrintTerminals(),
      ])
      setPorts(portsResult.ports)
      setTerminals(terminalsResult.terminals)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar impressoras e terminais.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
        name: data.name,
        description: data.description || null,
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
      await loadData()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a port.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBindPort(port: PrintPort, terminalDeviceId: string, localPrinterName: string) {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      const terminal = terminals.find((item) => item.id === terminalDeviceId)
      const printer = terminal?.localPrinters?.find((item) => item.name === localPrinterName)

      await bindPrintPort(port.id, {
        terminalDeviceId: terminalDeviceId || null,
        localPrinterName: localPrinterName || null,
        localPrinterLabel: printer ? getPrinterLabel(printer) : localPrinterName || null,
        paperWidth: port.paperWidth ?? 80,
      })

      setMessage('Vínculo da port atualizado.')
      await loadData()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível vincular a impressora.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeletePort(portId: string) {
    const confirmed = window.confirm('Remover esta port? Categorias e produtos ligados a ela voltarão a ficar sem port configurada.')
    if (!confirmed) return

    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)
      await deletePrintPort(portId)
      setMessage('Port removida.')
      await loadData()
    } catch (err) {
      console.error(err)
      setError('Não foi possível remover a port.')
    } finally {
      setIsSaving(false)
    }
  }

  const blockingMessage = isLoading ? 'Carregando impressoras...' : isSaving ? 'Salvando...' : null

  return (
    <div className="h-full flex flex-col overflow-hidden relative" aria-busy={Boolean(blockingMessage)}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Printer className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Impressoras</h1>
            <p className="text-sm text-muted-foreground">
              Configure ports lógicas e vincule cada port a uma impressora local do terminal Electron.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openTerminal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <MonitorCheck className="h-4 w-4" />
            Abrir terminal
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={handleCreatePort}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova port
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {message && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Ports de impressão</h2>
                  <p className="text-sm text-muted-foreground">
                    Use as ports nas categorias e produtos. Ex: Bebidas → Port 1, Cozinha → Port 2.
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">{ports.length} port(s)</span>
              </div>

              {ports.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Printer className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-base font-medium">Nenhuma port cadastrada</p>
                  <p className="text-sm">Crie Port 1, Port 2 etc. e vincule cada uma a uma impressora local.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {ports.map((port) => {
                    const selectedTerminal = terminals.find((terminal) => terminal.id === port.terminalDeviceId)
                    const localPrinters = selectedTerminal?.localPrinters ?? []

                    return (
                      <div key={port.id} className="px-5 py-4 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground truncate">{port.name}</h3>
                              <span className={`text-xs rounded-full px-2 py-0.5 ${port.active ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                {port.active ? 'Ativa' : 'Inativa'}
                              </span>
                              {selectedTerminal && (
                                <span className={`text-xs rounded-full px-2 py-0.5 ${selectedTerminal.status === 'online' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-600'}`}>
                                  Terminal {selectedTerminal.status === 'online' ? 'online' : 'offline'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {port.description || 'Sem descrição'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Impressora: {port.localPrinterLabel || port.localPrinterName || 'não vinculada'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => handleEditPort(port)} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent">
                              Editar
                            </button>
                            <button onClick={() => handleDeletePort(port.id)} className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-500/10">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 rounded-lg border border-border bg-background/50 p-3">
                          <label className="grid gap-1 text-sm">
                            <span className="font-medium text-foreground">Terminal</span>
                            <select
                              value={port.terminalDeviceId ?? ''}
                              onChange={(event) => handleBindPort(port, event.target.value, '')}
                              className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
                            >
                              <option value="">Sem terminal</option>
                              {terminals.map((terminal) => (
                                <option key={terminal.id} value={terminal.id}>
                                  {terminal.name} · {terminal.status === 'online' ? 'online' : 'offline'}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-1 text-sm">
                            <span className="font-medium text-foreground">Impressora local</span>
                            <select
                              value={port.localPrinterName ?? ''}
                              disabled={!selectedTerminal}
                              onChange={(event) => handleBindPort(port, port.terminalDeviceId ?? '', event.target.value)}
                              className="h-10 px-3 rounded-lg border border-border bg-background text-sm disabled:opacity-50"
                            >
                              <option value="">Sem impressora</option>
                              {localPrinters.map((printer) => (
                                <option key={printer.name} value={printer.name}>
                                  {getPrinterLabel(printer)}{printer.isDefault ? ' · padrão' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Terminal conectado</h2>
                    <p className="text-sm text-muted-foreground">
                      Apenas o Electron Terminal consegue acessar impressoras locais.
                    </p>
                  </div>
                  <span className="text-sm rounded-full bg-primary/10 text-primary px-3 py-1">
                    {onlineTerminals.length} online
                  </span>
                </div>

                <div className="space-y-3">
                  {terminals.map((terminal) => (
                    <div key={terminal.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{terminal.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Usuário: {terminal.currentUser?.name || terminal.currentUser?.username || '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Último sinal: {formatDateTime(terminal.lastSeenAt)}
                          </p>
                        </div>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${terminal.status === 'online' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-600'}`}>
                          {terminal.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {(terminal.localPrinters ?? []).length} impressora(s) local(is)
                      </div>
                    </div>
                  ))}

                  {terminals.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Nenhum terminal Electron registrado. Abra o ORDR Terminal no computador das impressoras e faça login como admin.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold text-foreground">Como usar</h2>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Abra o Electron Terminal no computador conectado às impressoras.</li>
                  <li>Crie ports lógicas: Port 1, Port 2, Cozinha, Bar etc.</li>
                  <li>Vincule cada port a uma impressora local listada pelo terminal.</li>
                  <li>Nas categorias/produtos, escolha a port de destino.</li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      </div>

      {blockingMessage && <BlockingOverlay message={blockingMessage} />}

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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{port ? 'Editar port' : 'Nova port'}</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre apenas a port lógica. O vínculo com terminal e impressora local é feito na lista de ports.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <label className="grid gap-2 text-sm font-medium">
            Nome da port
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Ex: Port 1 / Cozinha / Bar"
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Descrição
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex: Impressão da cozinha"
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3 cursor-pointer">
            <div>
              <span className="text-sm font-medium text-foreground">Port ativa</span>
              <p className="text-xs text-muted-foreground">
                Ports inativas continuam cadastradas, mas não devem ser usadas para novos jobs.
              </p>
            </div>
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          </label>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-muted-foreground">
            Depois de salvar, selecione na lista qual terminal Electron e qual impressora local esta port deve usar.
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border hover:bg-accent">Cancelar</button>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              <Save className="h-4 w-4" />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
