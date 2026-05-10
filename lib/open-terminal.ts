const TERMINAL_PROTOCOL_URL = 'ordr-terminal://open'
const TERMINAL_FALLBACK_URL = '/terminal'

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://api.panelordr.com.br').replace(/\/+$/, '')
}

async function createTerminalLaunchToken() {
  const response = await fetch(`${getApiBaseUrl()}/auth/terminal-launch-token`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Erro ao preparar abertura do terminal.')
  }

  if (!data?.launchToken) {
    throw new Error('Token do terminal não foi retornado.')
  }

  return String(data.launchToken)
}

export async function openOrdrTerminalWithFallback() {
  if (typeof window === 'undefined') return

  let didLeavePage = false

  const markAsOpened = () => {
    didLeavePage = true
  }

  const markAsHidden = () => {
    if (document.hidden) {
      didLeavePage = true
    }
  }

  window.addEventListener('blur', markAsOpened, { once: true })
  document.addEventListener('visibilitychange', markAsHidden, { once: true })

  try {
    const launchToken = await createTerminalLaunchToken()
    const protocolUrl = `${TERMINAL_PROTOCOL_URL}?launchToken=${encodeURIComponent(launchToken)}`

    window.location.href = protocolUrl
  } catch (error) {
    console.error('open terminal error:', error)
    window.location.href = TERMINAL_FALLBACK_URL
    return
  }

  window.setTimeout(() => {
    window.removeEventListener('blur', markAsOpened)
    document.removeEventListener('visibilitychange', markAsHidden)

    if (!didLeavePage) {
      window.location.href = TERMINAL_FALLBACK_URL
    }
  }, 1800)
}
