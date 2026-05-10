export function openOrdrTerminalWithFallback() {
  if (typeof window === 'undefined') return

  const fallbackUrl = '/terminal'
  const protocolUrl = 'ordr-terminal://open'

  let didLeavePage = false

  const markAsOpened = () => {
    didLeavePage = true
  }

  window.addEventListener('blur', markAsOpened, { once: true })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      didLeavePage = true
    }
  }, { once: true })

  window.location.href = protocolUrl

  window.setTimeout(() => {
    window.removeEventListener('blur', markAsOpened)

    if (!didLeavePage) {
      window.location.href = fallbackUrl
    }
  }, 1800)
}