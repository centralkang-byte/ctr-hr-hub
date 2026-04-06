// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation E2E Fixtures
// Helpers for creating/managing off-cycle requests in tests
// ════════════════════════════════════════════════════════���══

import type { APIRequestContext, APIResponse } from '@playwright/test'

// ─── Types ──────────────────────────────────────────────────

export interface OffCycleRequest {
  id: string
  status: string
  employeeId: string
  reasonCategory: string
  currentBaseSalary: number
  proposedBaseSalary: number
  changePct: number
  effectiveDate: string
}

interface CreateParams {
  employeeId: string
  reasonCategory?: string
  proposedBaseSalary?: number
  effectiveDate?: string
  reason?: string
}

// ─── Helpers ────────────────────────────────────────────────

const BASE_URL = '/api/v1/compensation/off-cycle'

/**
 * Create a DRAFT off-cycle request.
 * Uses Date.now() in salary to ensure uniqueness across test runs.
 */
export async function createOffCycleDraft(
  request: APIRequestContext,
  params: CreateParams,
): Promise<OffCycleRequest> {
  const salary = params.proposedBaseSalary ?? 50_000_000 + (Date.now() % 100_000)
  const effectiveDate = params.effectiveDate ?? '2026-06-01T00:00:00.000Z'
  const postData = {
    employeeId: params.employeeId,
    reasonCategory: params.reasonCategory ?? 'PROMOTION',
    proposedBaseSalary: salary,
    effectiveDate,
    reason: params.reason ?? 'E2E test off-cycle request',
  }
  const res = await request.post(BASE_URL, { data: postData })
  const body = await res.json()
  if (res.status() !== 201 && res.status() !== 409) {
    console.error(`[off-cycle-fixtures] POST failed: ${res.status()}`, JSON.stringify(body).slice(0, 300))
  }
  if (res.status() === 409) {
    // Duplicate guard — cancel existing DRAFT or PENDING_APPROVAL, then retry
    let existing: OffCycleRequest | undefined
    for (const s of ['DRAFT', 'PENDING_APPROVAL'] as const) {
      const listRes = await request.get(BASE_URL, {
        params: { employeeId: params.employeeId, status: s, limit: 1 },
      })
      const listBody = await listRes.json()
      existing = listBody.data?.[0]
      if (existing) break
    }
    if (existing) {
      const cancelRes = await cancelOffCycle(request, existing.id)
      if (cancelRes.status() >= 400) {
        console.error(`[off-cycle-fixtures] cancel failed: ${cancelRes.status()}`)
        return body.data
      }
      const retryRes = await request.post(BASE_URL, { data: postData })
      const retryBody = await retryRes.json()
      if (retryRes.status() !== 201) {
        console.error(`[off-cycle-fixtures] retry failed: ${retryRes.status()}`, JSON.stringify(retryBody).slice(0, 300))
      }
      return retryBody.data
    }
    console.error('[off-cycle-fixtures] 409 but no DRAFT/PENDING_APPROVAL found')
  }
  return body.data
}

/**
 * Submit a DRAFT request for approval.
 */
export async function submitOffCycle(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  await request.post(`${BASE_URL}/${id}/submit`)
}

/**
 * Approve a PENDING_APPROVAL request.
 */
export async function approveOffCycle(
  request: APIRequestContext,
  id: string,
  comment?: string,
): Promise<void> {
  await request.post(`${BASE_URL}/${id}/approve`, {
    data: comment ? { comment } : {},
  })
}

/**
 * Reject a PENDING_APPROVAL request.
 */
export async function rejectOffCycle(
  request: APIRequestContext,
  id: string,
  comment: string,
): Promise<void> {
  await request.post(`${BASE_URL}/${id}/reject`, {
    data: { comment },
  })
}

/**
 * Cancel a DRAFT or PENDING_APPROVAL request.
 * Returns the APIResponse for error checking by callers.
 */
export async function cancelOffCycle(
  request: APIRequestContext,
  id: string,
): Promise<APIResponse> {
  return request.post(`${BASE_URL}/${id}/cancel`)
}

/**
 * Revise a REJECTED request back to DRAFT.
 */
export async function reviseOffCycle(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  await request.post(`${BASE_URL}/${id}/revise`)
}

/**
 * Get off-cycle request detail.
 */
export async function getOffCycleDetail(
  request: APIRequestContext,
  id: string,
): Promise<OffCycleRequest & { approvalSteps: unknown[] }> {
  const res = await request.get(`${BASE_URL}/${id}`)
  const body = await res.json()
  return body.data
}
