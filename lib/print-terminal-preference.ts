function getStoredUserCompanyId() {
  if (typeof window === 'undefined') return null

  try {
    const rawUser = localStorage.getItem('ordr-user')
    if (rawUser) {
      const user = JSON.parse(rawUser)
      return user.companyId ?? user.company?.id ?? user.companies?.[0]?.id ?? null
    }
  } catch {
    // ignore malformed cached session
  }

  return localStorage.getItem('ordr-company-id')
}

function getPreferenceKey(companyId?: string | null) {
  const resolvedCompanyId = companyId ?? getStoredUserCompanyId()
  return resolvedCompanyId ? `ordr-preferred-print-terminal:${resolvedCompanyId}` : null
}

export function getCurrentCompanyDeviceId(companyId?: string | null) {
  if (typeof window === 'undefined') return null

  const resolvedCompanyId = companyId ?? getStoredUserCompanyId()
  if (!resolvedCompanyId) return null

  return localStorage.getItem(`ordr-device-id:${resolvedCompanyId}`)
}

export function getPreferredPrintTerminalId(companyId?: string | null) {
  if (typeof window === 'undefined') return null

  const key = getPreferenceKey(companyId)
  if (!key) return null

  const value = localStorage.getItem(key)
  return value?.trim() || null
}

export function setPreferredPrintTerminalId(terminalDeviceId: string, companyId?: string | null) {
  if (typeof window === 'undefined') return

  const key = getPreferenceKey(companyId)
  const value = terminalDeviceId.trim()
  if (!key || !value) return

  localStorage.setItem(key, value)
  window.dispatchEvent(new Event('ordr-print-terminal-preference-updated'))
}

export function clearPreferredPrintTerminalId(companyId?: string | null) {
  if (typeof window === 'undefined') return

  const key = getPreferenceKey(companyId)
  if (!key) return

  localStorage.removeItem(key)
  window.dispatchEvent(new Event('ordr-print-terminal-preference-updated'))
}
