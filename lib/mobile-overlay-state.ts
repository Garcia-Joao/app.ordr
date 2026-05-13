const openMobileOverlayIds = new Set<string>()

function syncMobileOverlayAttribute() {
  if (typeof document === 'undefined') return

  const isOpen = openMobileOverlayIds.size > 0
  document.documentElement.toggleAttribute('data-ordr-mobile-overlay-open', isOpen)
  document.body?.toggleAttribute('data-ordr-mobile-overlay-open', isOpen)
}

export function setMobileOverlayOpen(id: string, open: boolean) {
  if (typeof window === 'undefined') return

  if (open) {
    openMobileOverlayIds.add(id)
  } else {
    openMobileOverlayIds.delete(id)
  }

  syncMobileOverlayAttribute()
}
