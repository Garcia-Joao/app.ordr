export const ORDR_STOCK_UPDATED_EVENT = 'ordr:stock-updated'

export type StockUpdatedEventDetail = {
  productId?: string
}

export function emitStockUpdated(detail?: StockUpdatedEventDetail) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<StockUpdatedEventDetail>(ORDR_STOCK_UPDATED_EVENT, {
      detail,
    })
  )
}

export function listenStockUpdated(
  callback: (detail?: StockUpdatedEventDetail) => void
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: Event) => {
    callback((event as CustomEvent<StockUpdatedEventDetail>).detail)
  }

  window.addEventListener(ORDR_STOCK_UPDATED_EVENT, handler)

  return () => {
    window.removeEventListener(ORDR_STOCK_UPDATED_EVENT, handler)
  }
}