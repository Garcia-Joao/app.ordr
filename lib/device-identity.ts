import type { DeviceType, LocalPrinterInfo } from './api/devices'

function hasNavigator() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined'
}

export function getStoredDeviceId(companyId?: string | null) {
  if (typeof window === 'undefined' || !companyId) return null
  return localStorage.getItem(`ordr-device-id:${companyId}`)
}

export function setStoredDeviceId(companyId: string, deviceId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`ordr-device-id:${companyId}`, deviceId)
}

export function getCurrentCompanyDeviceId() {
  if (typeof window === 'undefined') return null
  const companyId = localStorage.getItem('ordr-company-id')
  return getStoredDeviceId(companyId)
}

export function detectDeviceType(): DeviceType {
  if (!hasNavigator()) return 'UNKNOWN'

  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() ?? ''
  const maxTouchPoints = navigator.maxTouchPoints ?? 0

  if (/ipad|tablet/.test(ua) || (platform.includes('mac') && maxTouchPoints > 1)) {
    return 'TABLET'
  }

  if (/mobile|iphone|ipod|android.*mobile/.test(ua)) {
    return 'MOBILE'
  }

  if (/android/.test(ua)) {
    return 'TABLET'
  }

  return 'DESKTOP'
}

export function detectBrowser() {
  if (!hasNavigator()) return null

  const ua = navigator.userAgent

  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua)) return 'Opera'
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'

  return 'Navegador desconhecido'
}

export function detectOS() {
  if (!hasNavigator()) return null

  const ua = navigator.userAgent

  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'

  return 'Sistema desconhecido'
}

export function isElectronTerminalRuntime() {
  return typeof window !== 'undefined' && Boolean(window.ordrTerminal?.isElectron)
}

export async function getElectronLocalPrinters(): Promise<LocalPrinterInfo[] | null> {
  if (!isElectronTerminalRuntime()) return null

  try {
    return await window.ordrTerminal!.getPrinters()
  } catch {
    return null
  }
}

export async function getElectronDeviceNameFallback() {
  if (!isElectronTerminalRuntime()) return null

  try {
    const info = await window.ordrTerminal!.getDeviceInfo()
    return info?.hostname ? `Terminal · ${info.hostname}` : null
  } catch {
    return null
  }
}

export function getDeviceDisplayName() {
  const type = detectDeviceType()
  const browser = detectBrowser()
  const os = detectOS()

  const typeLabel = {
    DESKTOP: 'Desktop',
    MOBILE: 'Celular',
    TABLET: 'Tablet',
    UNKNOWN: 'Dispositivo',
  }[type]

  return [typeLabel, os, browser].filter(Boolean).join(' · ')
}

export async function getDeviceHeartbeatPayload(companyId?: string | null) {
  const isElectron = isElectronTerminalRuntime()
  const electronName = isElectron ? await getElectronDeviceNameFallback() : null
  const localPrinters = isElectron ? await getElectronLocalPrinters() : null

  return {
    deviceId: getStoredDeviceId(companyId),
    name: electronName ?? getDeviceDisplayName(),
    type: detectDeviceType(),
    browser: detectBrowser(),
    os: detectOS(),
    userAgent: hasNavigator() ? navigator.userAgent : null,
    clientType: isElectron ? 'ELECTRON' as const : 'WEB' as const,
    isPrintTerminal: isElectron,
    printTerminalEnabled: isElectron,
    localPrinters,
  }
}
