// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuarterlyReview E2E Test Fixtures
// API helpers for creating/updating/submitting quarterly reviews.
// ═══════════════════════════════════════════════════════════

import type { APIRequestContext } from '@playwright/test'

// ─── Types ──────────────────────────────────────────────────

interface CreateReviewParams {
  employeeId: string
  managerId?: string
  year?: number
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  cycleId?: string
}

interface BulkCreateParams {
  employeeIds: string[]
  year?: number
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  cycleId?: string
}

interface UpdateEmployeeParams {
  goalHighlights?: string
  challenges?: string
  developmentNeeds?: string
  employeeComments?: string
  goalProgress?: Array<{
    goalProgressId: string
    progressPct: number
    employeeComment?: string
  }>
}

interface UpdateManagerParams {
  managerFeedback?: string
  coachingNotes?: string
  developmentPlan?: string
  overallSentiment?: 'POSITIVE' | 'NEUTRAL' | 'CONCERN'
  actionItems?: Array<{ description: string; dueDate?: string; assignee?: 'EMPLOYEE' | 'MANAGER' }>
  goalProgress?: Array<{
    goalProgressId: string
    managerComment?: string
    trackingStatus?: 'ON_TRACK' | 'AT_RISK' | 'BEHIND'
  }>
}

// ─── API Response Helper ────────────────────────────────────

async function parseApiResponse(response: { ok: () => boolean; status: () => number; json: () => Promise<unknown> }) {
  const status = response.status()
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  const errorObj = body.error as { message?: string; code?: string } | string | undefined
  const errorMessage = typeof errorObj === 'string'
    ? errorObj
    : errorObj?.message ?? `HTTP ${status}`
  return { status, data: body.data as Record<string, unknown> | undefined, error: errorMessage, ok: response.ok() }
}

// ─── Quarterly Review API Helpers ───────────────────────────

const BASE = '/api/v1/performance/quarterly-reviews'

export async function createReview(
  request: APIRequestContext,
  params: CreateReviewParams,
) {
  const res = await request.post(BASE, {
    data: {
      employeeId: params.employeeId,
      ...(params.managerId ? { managerId: params.managerId } : {}),
      year: params.year ?? 2026,
      quarter: params.quarter ?? 'Q2',
      ...(params.cycleId ? { cycleId: params.cycleId } : {}),
    },
  })
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`createReview failed: ${parsed.error}`)
  return parsed.data as { id: string; status: string; [key: string]: unknown }
}

export async function bulkCreateReviews(
  request: APIRequestContext,
  params: BulkCreateParams,
) {
  const res = await request.post(`${BASE}/bulk-create`, {
    data: {
      employeeIds: params.employeeIds,
      year: params.year ?? 2026,
      quarter: params.quarter ?? 'Q2',
      ...(params.cycleId ? { cycleId: params.cycleId } : {}),
    },
  })
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`bulkCreateReviews failed: ${parsed.error}`)
  return parsed.data as { created: number; skipped: number; total: number }
}

export async function getReview(request: APIRequestContext, reviewId: string) {
  const res = await request.get(`${BASE}/${reviewId}`)
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`getReview failed: ${parsed.error}`)
  return parsed.data as Record<string, unknown>
}

export async function listReviews(request: APIRequestContext, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await request.get(`${BASE}${qs}`)
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`listReviews failed: ${parsed.error}`)
  return {
    data: (parsed.data ?? body(parsed)) as unknown[],
    pagination: (parsed as Record<string, unknown>).pagination,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function body(parsed: any) {
  return parsed.data ?? []
}

export async function updateReviewAsEmployee(
  request: APIRequestContext,
  reviewId: string,
  data: UpdateEmployeeParams,
) {
  const res = await request.put(`${BASE}/${reviewId}`, { data })
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`updateReview(employee) failed: ${parsed.error}`)
  return parsed.data as Record<string, unknown>
}

export async function updateReviewAsManager(
  request: APIRequestContext,
  reviewId: string,
  data: UpdateManagerParams,
) {
  const res = await request.put(`${BASE}/${reviewId}`, { data })
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`updateReview(manager) failed: ${parsed.error}`)
  return parsed.data as Record<string, unknown>
}

export async function submitReview(request: APIRequestContext, reviewId: string) {
  const res = await request.put(`${BASE}/${reviewId}/submit`)
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`submitReview failed: ${parsed.error}`)
  return parsed.data as { id: string; status: string; submittedAt: string }
}

export async function reopenReview(request: APIRequestContext, reviewId: string, reason: string) {
  const res = await request.put(`${BASE}/${reviewId}/reopen`, {
    data: { reason },
  })
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`reopenReview failed: ${parsed.error}`)
  return parsed.data as { id: string; status: string; reopenedAt: string }
}

export async function getDashboard(request: APIRequestContext, year: number, quarter?: string) {
  const params = new URLSearchParams({ year: String(year) })
  if (quarter) params.set('quarter', quarter)
  const res = await request.get(`${BASE}/dashboard?${params}`)
  const parsed = await parseApiResponse(res)
  if (!parsed.ok) throw new Error(`getDashboard failed: ${parsed.error}`)
  return parsed.data as Record<string, unknown>
}

export async function deleteReview(request: APIRequestContext, reviewId: string) {
  // Clean up via direct DB call is not available in E2E — reviews stay for the test run.
  // This is a no-op placeholder; test isolation relies on unique year/quarter.
}
