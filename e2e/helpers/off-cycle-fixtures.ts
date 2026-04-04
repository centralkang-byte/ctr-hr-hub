// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation E2E Fixtures
// Helpers for creating/managing off-cycle requests in tests
// ════════════════════════════════════════════════════════���══

import type { APIRequestContext } from '@playwright/test'

// ─── Types ──────────────────────────────────────────────────

export interface OffCycleRequest {
  id: string
  status: string
  employeeId: string
  reasonCategory: string
  currentSalary: number
  proposedSalary: number
  changePct: number
  effectiveDate: string
}

interface CreateParams {
  employeeId: string
  reasonCategory?: string
  proposedSalary?: number
  effectiveDate?: string
  justification?: string
  submitForApproval?: boolean
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
  const salary = params.proposedSalary ?? 50_000_000 + (Date.now() % 100_000)
  const res = await request.post(BASE_URL, {
    data: {
      employeeId: params.employeeId,
      reasonCategory: params.reasonCategory ?? 'PROMOTION',
      proposedSalary: salary,
      effectiveDate: params.effectiveDate ?? '2026-06-01',
      justification: params.justification ?? 'E2E test off-cycle request',
      submitForApproval: params.submitForApproval ?? false,
    },
  })
  const body = await res.json()
  if (res.status() === 409) {
    // Duplicate guard — cancel existing and retry
    const listRes = await request.get(BASE_URL, {
      params: {
        employeeId: params.employeeId,
        status: 'DRAFT',
        limit: 1,
      },
    })
    const listBody = await listRes.json()
    const existing = listBody.data?.[0]
    if (existing) {
      await cancelOffCycle(request, existing.id)
      // Retry
      const retryRes = await request.post(BASE_URL, {
        data: {
          employeeId: params.employeeId,
          reasonCategory: params.reasonCategory ?? 'PROMOTION',
          proposedSalary: salary,
          effectiveDate: params.effectiveDate ?? '2026-06-01',
          justification: params.justification ?? 'E2E test off-cycle request',
          submitForApproval: params.submitForApproval ?? false,
        },
      })
      const retryBody = await retryRes.json()
      return retryBody.data
    }
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
 */
export async function cancelOffCycle(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  await request.post(`${BASE_URL}/${id}/cancel`)
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
