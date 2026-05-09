import { apiFetch } from './client'

export type SystemPrinter = {
  name: string
  driverName: string
  portName: string | null
  printerStatus: number | string | null
  shared: boolean
  shareName: string | null
  isGenericTextOnly: boolean
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

export type PrinterSettings = {
  printers: RegisteredPrinter[]
  orderPrinterId: string | null
  orderTicketTemplate: OrderTicketTemplate
}

export function getSystemPrinters() {
  return apiFetch<SystemPrinter[]>('/printers/system', {
    method: 'GET',
  })
}

export function getPrinterSettings() {
  return apiFetch<PrinterSettings>('/printers/settings', {
    method: 'GET',
  })
}

export function savePrinterSettings(data: PrinterSettings) {
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