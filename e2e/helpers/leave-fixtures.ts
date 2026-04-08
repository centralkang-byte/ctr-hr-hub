// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Module E2E Fixtures
// CRUD + workflow helpers for leave API tests.
// ═══════════════════════════════════════════════════════════

import type { APIRequestContext } from '@playwright/test'
import { parseApiResponse, type ApiResult } from './api-client'
// resolveSeedData available if needed for future fixtures
// import { resolveSeedData } from './test-data'

// ─── Types ──────────────────────────────────────────────────

interface CreateLeaveRequestParams {
  policyId: string
  leaveTypeDefId?: string
  startDate: string
  endDate: string
  days: number
  halfDayType?: 'AM' | 'PM'
  reason?: string
}

interface LeaveRequestRecord {
  id: string
  status: string
  days: number
}

// ─── Cleanup Registry ───────────────────────────────────────

// Track created request IDs for compensating cleanup in afterAll
const _createdRequestIds: string[] = []

/**
 * Cancel all leave requests created during tests.
 * Call in afterAll to restore seed balance state.
 */
export async function cleanupLeaveRequests(request: APIRequestContext): Promise<void> {
  for (const id of _createdRequestIds) {
    try {
      const res = await request.put(`/api/v1/leave/requests/${id}/cancel`, {
        data: { reason: 'E2E test cleanup' },
      })
      // Ignore errors — request may already be cancelled/rejected
      void res
    } catch {
      // Best-effort cleanup
    }
  }
  _createdRequestIds.length = 0
}

// ─── Leave Policy / TypeDef Discovery ───────────────────────

/**
 * Find an active leave policy from seed data.
 * Returns the first available policy.
 */
export async function resolveLeavePolicy(
  request: APIRequestContext,
): Promise<{ id: string; name: string } | null> {
  const res = await request.get('/api/v1/leave/policies?limit=5')
  const result = await parseApiResponse<Array<Record<string, unknown>>>(res)
  if (!result.ok || !result.data || (result.data as unknown[]).length === 0) return null
  const policy = (result.data as unknown[])[0] as Record<string, unknown>
  return { id: policy.id as string, name: (policy.name ?? '') as string }
}

/**
 * Find an active leave type def from seed data.
 */
export async function resolveLeaveTypeDef(
  request: APIRequestContext,
): Promise<{ id: string; code: string } | null> {
  const res = await request.get('/api/v1/leave/type-defs?limit=5')
  const result = await parseApiResponse<Array<Record<string, unknown>>>(res)
  if (!result.ok || !result.data || (result.data as unknown[]).length === 0) return null
  const typeDef = (result.data as unknown[])[0] as Record<string, unknown>
  return { id: typeDef.id as string, code: (typeDef.code ?? '') as string }
}

// ─── Leave Request CRUD ─────────────────────────────────────

/**
 * Create a leave request. Registers it for cleanup.
 */
export async function createLeaveRequest(
  request: APIRequestContext,
  params: CreateLeaveRequestParams,
): Promise<LeaveRequestRecord> {
  const payload = {
    policyId: params.policyId,
    leaveTypeDefId: params.leaveTypeDefId,
    startDate: params.startDate,
    endDate: params.endDate,
    days: params.days,
    halfDayType: params.halfDayType,
    reason: params.reason ?? `E2E test request ${Date.now()}`,
  }

  const res = await request.post('/api/v1/leave/requests', { data: payload })
  const result = await parseApiResponse<LeaveRequestRecord>(res)

  if (!result.ok || !result.data) {
    throw new Error(`createLeaveRequest failed (${result.status}): ${result.error ?? 'unknown'}`)
  }

  // Register for cleanup
  _createdRequestIds.push(result.data.id)
  return result.data
}

/**
 * Cancel a leave request.
 */
export async function cancelLeaveRequest(
  request: APIRequestContext,
  id: string,
  reason?: string,
): Promise<ApiResult> {
  const res = await request.put(`/api/v1/leave/requests/${id}/cancel`, {
    data: { reason: reason ?? 'E2E test cancel' },
  })
  return parseApiResponse(res)
}

/**
 * Approve a leave request (HR_ADMIN/MANAGER auth required).
 */
export async function approveLeaveRequest(
  request: APIRequestContext,
  id: string,
): Promise<ApiResult> {
  const res = await request.put(`/api/v1/leave/requests/${id}/approve`)
  return parseApiResponse(res)
}

/**
 * Reject a leave request with reason.
 */
export async function rejectLeaveRequest(
  request: APIRequestContext,
  id: string,
  reason: string,
): Promise<ApiResult> {
  const res = await request.put(`/api/v1/leave/requests/${id}/reject`, {
    data: { reason },
  })
  return parseApiResponse(res)
}

// ─── Leave Balance / List ───────────────────────────────────

/**
 * GET leave requests list.
 */
export async function listLeaveRequests(
  request: APIRequestContext,
  params?: Record<string, string>,
): Promise<ApiResult> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  const res = await request.get(`/api/v1/leave/requests${qs}`)
  return parseApiResponse(res)
}

/**
 * GET leave balances.
 */
export async function getLeaveBalances(
  request: APIRequestContext,
  params?: Record<string, string>,
): Promise<ApiResult> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  const res = await request.get(`/api/v1/leave/balances${qs}`)
  return parseApiResponse(res)
}

/**
 * GET year balances.
 */
export async function getYearBalances(
  request: APIRequestContext,
  params?: Record<string, string>,
): Promise<ApiResult> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  const res = await request.get(`/api/v1/leave/year-balances${qs}`)
  return parseApiResponse(res)
}
