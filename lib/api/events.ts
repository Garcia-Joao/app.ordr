import { apiFetch } from '@/lib/api/client'

export const EVENTS_UPDATED_EVENT = 'ordr-events-updated'

export function emitEventsUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTS_UPDATED_EVENT))
}

export type EventDateStatus = 'scheduled' | 'done' | 'cancelled'
export type EventDisplayStatus = EventDateStatus | 'active'
export type EventPersonStatus = 'pending' | 'confirmed' | 'declined' | 'maybe'

export type EventSalesEnvironment = {
  id: string
  name: string
  color?: string | null
  isDefault?: boolean
}

export type EventPerson = {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  city?: string | null
  active: boolean
  rateType?: string | null
  rateAmount?: number | string | null
  functions?: Array<{
    function: {
      id: string
      name: string
    }
    detail?: string | null
  }>
}

export type EventLinkedPerson = {
  id: string
  personId: string
  functionName?: string | null
  status?: EventPersonStatus
  notes?: string | null
  worksFullEvent?: boolean
  workHours?: number | string | null
  costOverride?: number | string | null
  costNotes?: string | null
  person: EventPerson
}

export type EventTemplate = {
  id: string
  title: string
  description?: string | null
  notes?: string | null
  defaultExpectedAudience?: number | null
  defaultStartTime?: string | null
  defaultEndTime?: string | null
  salesEnvironmentId?: string | null
  salesEnvironment?: EventSalesEnvironment | null
  active: boolean
  fixedPeople: EventLinkedPerson[]
  eventDates?: EventDate[]
  stats?: EventTemplateStats
}

export type EventTemplateStats = {
  eventCount: number
  finishedEventCount: number
  orderCount: number
  grossRevenue: number
  averageTicket: number
  confirmedPeople: number
  expectedAudience: number
  estimatedPeopleCost: number
  estimatedYield: number
  estimatedProfit?: number
}

export type EventDate = {
  id: string
  eventTemplateId?: string | null
  title: string
  description?: string | null
  notes?: string | null
  startAt: string
  endAt?: string | null
  expectedAudience?: number | null
  salesEnvironmentId?: string | null
  salesEnvironment?: EventSalesEnvironment | null
  status: EventDateStatus
  runtimeStatus?: EventDisplayStatus
  isActiveNow?: boolean
  eventTemplate?: EventTemplate | null
  people: EventLinkedPerson[]
}

export type SaveEventPersonInput = {
  personId: string
  functionName?: string | null
  status?: EventPersonStatus
  notes?: string | null
  worksFullEvent?: boolean
  workHours?: number | string | null
  costOverride?: number | string | null
  costNotes?: string | null
}

export type SaveEventTemplateInput = {
  title: string
  description?: string | null
  notes?: string | null
  defaultExpectedAudience?: number | null
  defaultStartTime?: string | null
  defaultEndTime?: string | null
  salesEnvironmentId?: string | null
  fixedPeople?: SaveEventPersonInput[]
}

export type SaveEventDateInput = {
  eventTemplateId?: string | null
  title?: string | null
  description?: string | null
  notes?: string | null
  startAt: string
  endAt?: string | null
  expectedAudience?: number | null
  salesEnvironmentId?: string | null
  status?: EventDateStatus
  people?: SaveEventPersonInput[]
}

export async function getEventPeople(): Promise<EventPerson[]> {
  return apiFetch('/events/people')
}

export async function getEventTemplates(): Promise<EventTemplate[]> {
  return apiFetch('/events/templates')
}

export async function createEventTemplate(
  data: SaveEventTemplateInput
): Promise<EventTemplate> {
  const created = await apiFetch<EventTemplate>('/events/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  emitEventsUpdated()
  return created
}

export async function updateEventTemplate(
  id: string,
  data: Partial<SaveEventTemplateInput> & { active?: boolean }
): Promise<EventTemplate> {
  const updated = await apiFetch<EventTemplate>(`/events/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  emitEventsUpdated()
  return updated
}

export async function deleteEventTemplate(id: string) {
  const result = await apiFetch(`/events/templates/${id}`, {
    method: 'DELETE',
  })
  emitEventsUpdated()
  return result
}

export async function getEventDates(params?: {
  from?: string
  to?: string
  status?: EventDateStatus | 'active' | 'all'
}): Promise<EventDate[]> {
  const search = new URLSearchParams()

  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  if (params?.status && params.status !== 'all') {
    search.set('status', params.status)
  }

  const query = search.toString()
  return apiFetch(`/events/dates${query ? `?${query}` : ''}`)
}

export async function createEventDate(
  data: SaveEventDateInput
): Promise<EventDate> {
  const created = await apiFetch<EventDate>('/events/dates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  emitEventsUpdated()
  return created
}

export async function updateEventDate(
  id: string,
  data: Partial<SaveEventDateInput>
): Promise<EventDate> {
  const updated = await apiFetch<EventDate>(`/events/dates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  emitEventsUpdated()
  return updated
}

export async function cancelEventDate(id: string): Promise<EventDate> {
  const result = await apiFetch<EventDate>(`/events/dates/${id}/cancel`, {
    method: 'PATCH',
  })
  emitEventsUpdated()
  return result
}

export async function deleteEventDate(id: string) {
  const result = await apiFetch(`/events/dates/${id}`, {
    method: 'DELETE',
  })
  emitEventsUpdated()
  return result
}

export async function updateEventDatePersonStatus(
  eventDateId: string,
  personId: string,
  data: {
    functionName?: string | null
    status?: EventPersonStatus
    notes?: string | null
    worksFullEvent?: boolean
    workHours?: number | string | null
    costOverride?: number | string | null
    costNotes?: string | null
  }
) {
  return apiFetch(`/events/dates/${eventDateId}/people/${personId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getCurrentEventDates(): Promise<EventDate[]> {
  return apiFetch('/events/dates/current')
}
