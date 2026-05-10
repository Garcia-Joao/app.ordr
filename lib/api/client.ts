const DEFAULT_API_URL = 'http://localhost:3000'
const REQUEST_TIMEOUT_MS = 8000

function getApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (apiUrl && apiUrl.trim()) {
    return apiUrl.trim().replace(/\/$/, '')
  }

  return DEFAULT_API_URL
}

function getCompanyIdFromStorage() {
  if (typeof window === 'undefined') return null

  try {
    const rawUser = localStorage.getItem('ordr-user')
    if (!rawUser) return null

    const user = JSON.parse(rawUser)

    return (
      user.companyId ??
      user.company?.id ??
      user.companies?.[0]?.id ??
      null
    )
  } catch {
    return null
  }
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController()

  const timeout = window.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeout),
  }
}

function shouldSendJsonContentType(options?: RequestInit) {
  const method = options?.method?.toUpperCase() ?? 'GET'

  if (method === 'GET' || method === 'HEAD') {
    return false
  }

  if (!options?.body) {
    return false
  }

  if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
    return false
  }

  return true
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const companyId = getCompanyIdFromStorage()
  const apiUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${apiUrl}${normalizedPath}`

  const timeout = createTimeoutSignal(REQUEST_TIMEOUT_MS)

  const headers: HeadersInit = {
    ...(shouldSendJsonContentType(options)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(companyId ? { 'x-company-id': companyId } : {}),
    ...(options?.headers || {}),
  }

  try {
    console.log('[apiFetch]', {
      method: options?.method ?? 'GET',
      url,
      apiUrl,
      path: normalizedPath,
      hasCompanyId: Boolean(companyId),
      hasEnvApiUrl: Boolean(process.env.NEXT_PUBLIC_API_URL),
      sendsContentType: Boolean((headers as Record<string, string>)['Content-Type']),
    })

    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      signal: timeout.signal,
      headers,
    })

    let data: any = null
    const text = await response.text()

    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text ? { raw: text } : null
    }

    if (!response.ok) {
      console.error('[apiFetch] API error', {
        url,
        status: response.status,
        statusText: response.statusText,
        data,
      })

      throw new Error(
        data?.error ||
          response.statusText ||
          `Erro na requisição (${response.status})`
      )
    }

    return data as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[apiFetch] Request timeout', {
        url,
        timeoutMs: REQUEST_TIMEOUT_MS,
      })

      throw new Error(
        `A API não respondeu em ${REQUEST_TIMEOUT_MS / 1000}s. Verifique se ${apiUrl} está acessível.`
      )
    }

    console.error('[apiFetch] Fetch failed', {
      url,
      error,
    })

    throw error instanceof Error
      ? error
      : new Error('Não foi possível conectar ao servidor.')
  } finally {
    timeout.clear()
  }
}