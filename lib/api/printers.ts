import { apiFetch } from './client'

export type DeviceStatus = 'online' | 'offline'

export type LocalPrinter = {
  name: string
  displayName?: string | null
  description?: string | null
  isDefault?: boolean | null
}

export type PrintTerminal = {
  id: string
  name: string
  type?: string
  clientType?: 'WEB' | 'ELECTRON'
  isPrintTerminal?: boolean
  printTerminalEnabled?: boolean
  terminalApprovedAt?: string | null
  localPrinters?: LocalPrinter[]
  browser?: string | null
  os?: string | null
  ipAddress?: string | null
  lastSeenAt?: string
  status: DeviceStatus
  currentUser?: {
    id: string
    username: string
    name?: string | null
  } | null
}

export type PrintPortBinding = {
  id: string
  portId: string
  terminalDeviceId: string
  localPrinterName: string
  localPrinterLabel?: string | null
}

export type PrintPort = {
  id: string
  companyId?: string
  name: string
  description?: string | null
  active: boolean
  sortOrder: number
  terminalDeviceId?: string | null
  localPrinterName?: string | null
  localPrinterLabel?: string | null
  paperWidth?: number | null
  isDefaultReceipt?: boolean
  isSystem?: boolean
  createdAt?: string
  updatedAt?: string
  terminalDevice?: PrintTerminal | null
  bindings?: PrintPortBinding[]
}

export type PrintPortInput = {
  name?: string | null
  description?: string | null
  active?: boolean
  sortOrder?: number | null
  terminalDeviceId?: string | null
  localPrinterName?: string | null
  localPrinterLabel?: string | null
  paperWidth?: number | null
}


export type PrintTemplateConfig = {
  enabledFields: Record<string, boolean>
  headerText: string
  footerText: string
}

export type PrintTemplate = {
  kind: 'ORDER_TICKET' | 'BUY_LIST'
  config: PrintTemplateConfig
  updatedAt?: string | null
}

export type PrintTemplates = {
  orderTicket: PrintTemplate
  buyList: PrintTemplate
}

export type OrderTicketTemplate = {
  showLogo: boolean
  showOrderId: boolean
  showDate: boolean
  showComandaName: boolean
  showVariations: boolean
  showNotes: boolean
  headerText: string
  footerText: string
}

export function listPrintPorts() {
  return apiFetch<{ ports: PrintPort[] }>('/printers/ports', { method: 'GET' })
}

export function createPrintPort(data: PrintPortInput) {
  return apiFetch<{ port: PrintPort }>('/printers/ports', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updatePrintPort(portId: string, data: PrintPortInput) {
  return apiFetch<{ port: PrintPort }>(`/printers/ports/${portId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function bindPrintPort(portId: string, data: PrintPortInput) {
  return apiFetch<{ port: PrintPort }>(`/printers/ports/${portId}/binding`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function setPrintPortBindings(portId: string, data: {
  terminalDeviceId: string
  printers: Array<{ localPrinterName: string; localPrinterLabel?: string | null }>
}) {
  return apiFetch<{ port: PrintPort }>(`/printers/ports/${portId}/bindings`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deletePrintPort(portId: string) {
  return apiFetch<{ ok: true }>(`/printers/ports/${portId}`, { method: 'DELETE' })
}

export function listPrintTerminals() {
  return apiFetch<{ terminals: PrintTerminal[] }>('/printers/terminals', { method: 'GET' })
}

export function createOrderPrintJobs(orderId: string) {
  return apiFetch<{ jobs: unknown[] }>(`/print-jobs/orders/${orderId}`, { method: 'POST' })
}

// Legacy type/function names kept so old imports do not break immediately.
export type SystemPrinter = LocalPrinter & {
  driverName?: string
  portName?: string | null
  printerStatus?: number | string | null
  shared?: boolean
  shareName?: string | null
  isGenericTextOnly?: boolean
}

export type RegisteredPrinter = {
  id: string
  name: string
  systemName: string
  driverName?: string | null
  portName?: string | null
  paperWidth: 58 | 80
  type: 'orders' | 'kitchen' | 'bar'
}

export type PrinterSettings = {
  printers: RegisteredPrinter[]
  ports?: PrintPort[]
  terminals?: PrintTerminal[]
  orderPrinterId: string | null
  orderTicketTemplate: OrderTicketTemplate
  printTemplates?: PrintTemplates
}

export function getSystemPrinters() {
  return apiFetch<SystemPrinter[]>('/printers/system', { method: 'GET' })
}

export function getPrinterSettings() {
  return apiFetch<PrinterSettings>('/printers/settings', { method: 'GET' })
}

export function savePrinterSettings(data: Partial<PrinterSettings> & { printTemplates?: PrintTemplates }) {
  return apiFetch<PrinterSettings>('/printers/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function testPrinter(printerName?: string) {
  return apiFetch<{ ok: true }>('/printers/test', {
    method: 'POST',
    body: JSON.stringify(printerName ? { printerName } : {}),
  })
}
