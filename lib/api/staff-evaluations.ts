import { apiFetch } from '@/lib/api/client'
import type { EventDate } from '@/lib/api/events'
import type { ManagedPerson } from '@/lib/api/people'

export type StaffEvaluationCriterion = {
  id: string
  companyId: string
  name: string
  description?: string | null
  active: boolean
}

export type StaffEvaluationScore = {
  id: string
  criterionId: string
  score: number
  notes?: string | null
  criterion: StaffEvaluationCriterion
}

export type StaffEvaluation = {
  id: string
  companyId: string
  eventDateId: string
  personId: string
  functionName: string
  functionScore?: number | null
  generalNotes?: string | null
  scores: StaffEvaluationScore[]
  eventDate?: EventDate
  person?: ManagedPerson
}

export type EventStaffReviewItem = {
  eventDatePersonId: string
  personId: string
  person: ManagedPerson
  functionName: string
  status: 'confirmed'
  evaluation?: StaffEvaluation | null
}

export type PersonEvaluationEventSummary = {
  eventDateId: string
  eventTitle: string
  eventStartAt: string
  eventEndAt?: string | null
  average: number
  count: number
  evaluations: StaffEvaluation[]
}

export type PersonEvaluationSummary = {
  person: {
    id: string
    name: string
  }
  totalEvaluations: number
  overallAverage: number
  averageByCriterion: Array<{
    criterionId: string
    criterionName: string
    average: number
    count: number
  }>
  averageByFunction: Array<{
    functionName: string
    average: number
    count: number
  }>
  averageByEvent: PersonEvaluationEventSummary[]
  evaluations: StaffEvaluation[]
}

export type PersonEvaluationRating = {
  personId: string
  average: number
  count: number
}

export async function getStaffEvaluationCriteria(): Promise<StaffEvaluationCriterion[]> {
  return apiFetch('/staff-evaluations/criteria')
}

export async function createStaffEvaluationCriterion(data: {
  name: string
  description?: string | null
}): Promise<StaffEvaluationCriterion> {
  return apiFetch('/staff-evaluations/criteria', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getEventStaffForReview(eventDateId: string): Promise<EventStaffReviewItem[]> {
  return apiFetch(`/staff-evaluations/events/${eventDateId}/staff`)
}

export async function saveStaffEvaluation(
  eventDateId: string,
  data: {
    personId: string
    functionName: string
    functionScore?: number | null
    generalNotes?: string | null
    scores: Array<{
      criterionId: string
      score: number
      notes?: string | null
    }>
  }
): Promise<StaffEvaluation> {
  return apiFetch(`/staff-evaluations/events/${eventDateId}/staff/evaluations`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getPersonEvaluationSummary(personId: string): Promise<PersonEvaluationSummary> {
  return apiFetch(`/staff-evaluations/people/${personId}/summary`)
}

export async function getPeopleEvaluationRatings(): Promise<PersonEvaluationRating[]> {
  return apiFetch('/staff-evaluations/people/ratings')
}
