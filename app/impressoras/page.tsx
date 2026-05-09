'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'
import {
  getSystemPrinters,
  getPrinterSettings,
  savePrinterSettings,
  testPrinter,
  type SystemPrinter,
  type RegisteredPrinter,
  type OrderTicketTemplate,
  type PrinterSettings,
} from '@/lib/api'

function createId() {
  return Math.random().toString(36).substring(2, 10)
}

const defaultTemplate: OrderTicketTemplate = {
  showLogo: true,
  showOrderId: true,
  showDate: true,
  showComandaName: true,
  showVariations: true,
  showNotes: true,
  headerText: '*** ORDR ***',
  footerText: '',
}

export default function ImpressorasPage() {
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([])
  const [registeredPrinters, setRegisteredPrinters] = useState<RegisteredPrinter[]>([])
  const [orderPrinterId, setOrderPrinterId] = useState<string | null>(null)
  const [template, setTemplate] = useState<OrderTicketTemplate>(defaultTemplate)

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<RegisteredPrinter | null>(null)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const orderPrinter = useMemo(
    () => registeredPrinters.find((printer) => printer.id === orderPrinterId) ?? null,
    [registeredPrinters, orderPrinterId]
  )

  const blockingMessage = useMemo(() => {
    if (isLoading) return 'Carregando impressoras...'
    if (isRefreshing) return 'Atualizando impressoras...'
    if (isSaving) return 'Salvando configurações...'
    if (isTesting) return 'Enviando teste para a impressora...'
    return null
  }, [isLoading, isRefreshing, isSaving, isTesting])

  const isBlocked = Boolean(blockingMessage)

  async function loadData() {
    try {
      setError(null)

      const [detected, settings] = await Promise.all([
        getSystemPrinters(),
        getPrinterSettings(),
      ])

      setSystemPrinters(detected)
      setRegisteredPrinters(settings.printers ?? [])
      setOrderPrinterId(settings.orderPrinterId ?? null)
      setTemplate({
        ...defaultTemplate,
        ...(settings.orderTicketTemplate ?? {}),
      })
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar as impressoras.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function persist(next?: Partial<PrinterSettings>) {
    const payload: PrinterSettings = {
      printers: next?.printers ?? registeredPrinters,
      orderPrinterId: next?.orderPrinterId ?? orderPrinterId,
      orderTicketTemplate: next?.orderTicketTemplate ?? template,
    }

    const saved = await savePrinterSettings(payload)

    setRegisteredPrinters(saved.printers)
    setOrderPrinterId(saved.orderPrinterId)
    setTemplate({
      ...defaultTemplate,
      ...saved.orderTicketTemplate,
    })

    return saved
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    setMessage(null)
    await loadData()
  }

  function handleAddNew() {
    setEditingPrinter(null)
    setIsModalOpen(true)
  }

  function handleEdit(printer: RegisteredPrinter) {
    setEditingPrinter(printer)
    setIsModalOpen(true)
  }

  async function handleSavePrinter(data: RegisteredPrinter) {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      const nextPrinters = editingPrinter
        ? registeredPrinters.map((printer) =>
            printer.id === editingPrinter.id ? data : printer
          )
        : [...registeredPrinters, data]

      const nextOrderPrinterId =
        orderPrinterId ?? (data.type === 'orders' ? data.id : null)

      await persist({
        printers: nextPrinters,
        orderPrinterId: nextOrderPrinterId,
      })

      setMessage('Impressora salva com sucesso.')
      setIsModalOpen(false)
      setEditingPrinter(null)
    } catch (err) {
      console.error(err)
      setError('Não foi possível salvar a impressora.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(printerId: string) {
    try {
      setError(null)
      setMessage(null)

      const nextPrinters = registeredPrinters.filter((printer) => printer.id !== printerId)
      const nextOrderPrinterId = orderPrinterId === printerId ? null : orderPrinterId

      await persist({
        printers: nextPrinters,
        orderPrinterId: nextOrderPrinterId,
      })

      setMessage('Impressora removida.')
    } catch (err) {
      console.error(err)
      setError('Não foi possível remover a impressora.')
    }
  }

  async function handleSetOrderPrinter(printerId: string) {
    try {
      setError(null)
      setMessage(null)
      await persist({ orderPrinterId: printerId })
      setMessage('Impressora de pedidos definida.')
    } catch (err) {
      console.error(err)
      setError('Não foi possível definir a impressora de pedidos.')
    }
  }

  async function handleTest(printer: RegisteredPrinter) {
    try {
      setIsTesting(printer.id)
      setError(null)
      setMessage(null)

      await testPrinter(printer.systemName)
      setMessage('Teste enviado para a impressora.')
    } catch (err) {
      console.error(err)
      setError('Não foi possível enviar o teste de impressão.')
    } finally {
      setIsTesting(null)
    }
  }

  async function handleSaveTemplate() {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      await persist({
        orderTicketTemplate: template,
      })

      setMessage('Modelo de impressão salvo.')
    } catch (err) {
      console.error(err)
      setError('Não foi possível salvar o modelo de impressão.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative" aria-busy={isBlocked}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Printer className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Impressoras</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre impressoras da máquina e escolha a impressora dos pedidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isBlocked}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            onClick={handleAddNew}
            disabled={isBlocked}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Nova impressora
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

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Impressoras cadastradas
                </h2>
                <p className="text-sm text-muted-foreground">
                  {registeredPrinters.length} impressora
                  {registeredPrinters.length !== 1 ? 's' : ''} cadastrada
                  {registeredPrinters.length !== 1 ? 's' : ''}
                </p>
              </div>

              {orderPrinter && (
                <div className="text-sm text-muted-foreground">
                  Pedidos: <span className="text-foreground font-medium">{orderPrinter.name}</span>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">
                Carregando impressoras...
              </div>
            ) : registeredPrinters.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Printer className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-base font-medium">Nenhuma impressora cadastrada</p>
                <p className="text-sm">Clique em “Nova impressora” para cadastrar uma impressora detectada.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {registeredPrinters.map((printer) => (
                  <div
                    key={printer.id}
                    className="px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Printer className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">
                            {printer.name}
                          </p>

                          {printer.id === orderPrinterId && (
                            <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">
                              Pedidos
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground truncate">
                          {printer.systemName} • {printer.portName || 'Sem porta'} • {printer.paperWidth}mm
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(printer)}
                        disabled={isTesting === printer.id}
                        className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"
                      >
                        {isTesting === printer.id ? 'Testando...' : 'Teste'}
                      </button>

                      <button
                        onClick={() => handleSetOrderPrinter(printer.id)}
                        disabled={printer.id === orderPrinterId}
                        className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"
                      >
                        Usar em pedidos
                      </button>

                      <button
                        onClick={() => handleEdit(printer)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(printer.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Modelo do ticket de pedido
              </h2>
              <p className="text-sm text-muted-foreground">
                Escolha quais informações serão impressas nos tickets.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Cabeçalho</label>
                <input
                  value={template.headerText}
                  onChange={(e) =>
                    setTemplate((prev) => ({ ...prev, headerText: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Rodapé</label>
                <input
                  value={template.footerText}
                  onChange={(e) =>
                    setTemplate((prev) => ({ ...prev, footerText: e.target.value }))
                  }
                  placeholder="Opcional"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Toggle label="Mostrar cabeçalho" checked={template.showLogo} onChange={(v) => setTemplate((p) => ({ ...p, showLogo: v }))} />
              <Toggle label="Mostrar ID do pedido" checked={template.showOrderId} onChange={(v) => setTemplate((p) => ({ ...p, showOrderId: v }))} />
              <Toggle label="Mostrar data" checked={template.showDate} onChange={(v) => setTemplate((p) => ({ ...p, showDate: v }))} />
              <Toggle label="Mostrar nome da comanda" checked={template.showComandaName} onChange={(v) => setTemplate((p) => ({ ...p, showComandaName: v }))} />
              <Toggle label="Mostrar variações" checked={template.showVariations} onChange={(v) => setTemplate((p) => ({ ...p, showVariations: v }))} />
              <Toggle label="Mostrar observações" checked={template.showNotes} onChange={(v) => setTemplate((p) => ({ ...p, showNotes: v }))} />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Salvar modelo
              </button>
            </div>
          </div>
        </div>
      </div>

      {blockingMessage && (
        <BlockingOverlay message={blockingMessage} />
      )}

      {isModalOpen && (
        <PrinterModal
          systemPrinters={systemPrinters}
          printer={editingPrinter}
          onClose={() => {
            setIsModalOpen(false)
            setEditingPrinter(null)
          }}
          onSave={handleSavePrinter}
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer">
      <span className="text-sm text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function PrinterModal({
  systemPrinters,
  printer,
  onClose,
  onSave,
}: {
  systemPrinters: SystemPrinter[]
  printer: RegisteredPrinter | null
  onClose: () => void
  onSave: (printer: RegisteredPrinter) => void
}) {
  const [name, setName] = useState(printer?.name ?? '')
  const [systemName, setSystemName] = useState(printer?.systemName ?? '')
  const [paperWidth, setPaperWidth] = useState<58 | 80>(printer?.paperWidth ?? 80)
  const [type, setType] = useState<RegisteredPrinter['type']>(printer?.type ?? 'orders')

  const selectedSystemPrinter = systemPrinters.find((p) => p.name === systemName)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedSystemPrinter) return

    onSave({
      id: printer?.id ?? createId(),
      name: name.trim() || selectedSystemPrinter.name,
      systemName: selectedSystemPrinter.name,
      driverName: selectedSystemPrinter.driverName,
      portName: selectedSystemPrinter.portName,
      paperWidth,
      type,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {printer ? 'Editar impressora' : 'Nova impressora'}
          </h2>

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nome interno</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Caixa principal"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Impressora do Windows</label>
            <select
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">Selecione uma impressora</option>
              {systemPrinters.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.name} — {printer.portName || 'Sem porta'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RegisteredPrinter['type'])}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              <option value="orders">Pedidos</option>
              <option value="kitchen">Cozinha</option>
              <option value="bar">Bar</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Largura do papel</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={paperWidth === 58}
                  onChange={() => setPaperWidth(58)}
                />
                58mm
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={paperWidth === 80}
                  onChange={() => setPaperWidth(80)}
                />
                80mm
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-accent"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}