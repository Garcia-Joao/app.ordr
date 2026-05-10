import { apiFetch } from '@/lib/api/client'

type TerminalLaunchTokenResponse = {
  launchToken: string
}

let openingTerminal = false
let lastOpenStartedAt = 0

function createRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function getTerminalLaunchToken() {
  try {
    const result = await apiFetch<TerminalLaunchTokenResponse>('/auth/terminal-launch-token', {
      method: 'POST',
    })

    return result.launchToken || null
  } catch (error) {
    // Do not block opening the terminal because of a token failure.
    // If the terminal is already running/logged in, it only needs to be focused.
    console.warn('[ORDR] Failed to create terminal launch token:', error)
    return null
  }
}

export async function openOrdrTerminalWithFallback() {
  if (typeof window === 'undefined') return

  const now = Date.now()

  if (openingTerminal || now - lastOpenStartedAt < 1800) {
    return
  }

  openingTerminal = true
  lastOpenStartedAt = now

  const fallbackUrl = '/terminal'
  const requestId = createRequestId()
  const launchToken = await getTerminalLaunchToken()

  const params = new URLSearchParams({ requestId })

  if (launchToken) {
    params.set('launchToken', launchToken)
  }

  const protocolUrl = `ordr-terminal://open?${params.toString()}`
  let didLeavePage = false

  const markAsOpened = () => {
    didLeavePage = true
  }

  window.addEventListener('blur', markAsOpened, { once: true })

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        didLeavePage = true
      }
    },
    { once: true }
  )

  window.location.href = protocolUrl

  window.setTimeout(() => {
    window.removeEventListener('blur', markAsOpened)
    openingTerminal = false

    if (!didLeavePage) {
      window.location.href = fallbackUrl
    }
  }, 1800)
}
