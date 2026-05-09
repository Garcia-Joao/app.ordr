import type { EventDate } from '@/lib/api/events'

const ACTIVE_EVENT_ID_STORAGE_KEY = 'ordr-active-event-date-id'
const ACTIVE_EVENT_STORAGE_KEY = 'ordr-active-event-date'
const ACTIVE_EVENT_CHANGED_EVENT = 'ordr-active-event-changed'

export function getActiveEventDateId(): string | null {
  if (typeof window === 'undefined') return null

  return localStorage.getItem(ACTIVE_EVENT_ID_STORAGE_KEY) || null
}

export function getActiveEventDate(): EventDate | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(ACTIVE_EVENT_STORAGE_KEY)
    if (!raw) return null

    return JSON.parse(raw) as EventDate
  } catch {
    localStorage.removeItem(ACTIVE_EVENT_ID_STORAGE_KEY)
    localStorage.removeItem(ACTIVE_EVENT_STORAGE_KEY)
    return null
  }
}

export function setActiveEventDate(eventDate: EventDate | null) {
  if (typeof window === 'undefined') return

  if (eventDate) {
    localStorage.setItem(ACTIVE_EVENT_ID_STORAGE_KEY, eventDate.id)
    localStorage.setItem(ACTIVE_EVENT_STORAGE_KEY, JSON.stringify(eventDate))
  } else {
    localStorage.removeItem(ACTIVE_EVENT_ID_STORAGE_KEY)
    localStorage.removeItem(ACTIVE_EVENT_STORAGE_KEY)
  }

  window.dispatchEvent(
    new CustomEvent(ACTIVE_EVENT_CHANGED_EVENT, {
      detail: {
        eventDate,
        eventDateId: eventDate?.id ?? null,
      },
    })
  )
}

export function setActiveEventDateId(eventDateId: string | null) {
  if (typeof window === 'undefined') return

  if (eventDateId) {
    localStorage.setItem(ACTIVE_EVENT_ID_STORAGE_KEY, eventDateId)
  } else {
    localStorage.removeItem(ACTIVE_EVENT_ID_STORAGE_KEY)
    localStorage.removeItem(ACTIVE_EVENT_STORAGE_KEY)
  }

  window.dispatchEvent(
    new CustomEvent(ACTIVE_EVENT_CHANGED_EVENT, {
      detail: {
        eventDate: getActiveEventDate(),
        eventDateId,
      },
    })
  )
}

export function clearActiveEventDate() {
  setActiveEventDate(null)
}

export function listenActiveEventChanged(
  callback: (eventDate: EventDate | null) => void
) {
  if (typeof window === 'undefined') return () => {}

  function handler(event: Event) {
    const customEvent = event as CustomEvent<{
      eventDate?: EventDate | null
      eventDateId?: string | null
    }>

    callback(customEvent.detail?.eventDate ?? getActiveEventDate())
  }

  window.addEventListener(ACTIVE_EVENT_CHANGED_EVENT, handler)

  return () => {
    window.removeEventListener(ACTIVE_EVENT_CHANGED_EVENT, handler)
  }
}