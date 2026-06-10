// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Evaluation E2E Test Fixtures
// API helpers for creating/advancing/cleaning up test cycles.
// Uses Playwright APIRequestContext for direct API calls.
// ═══════════════════════════════════════════════════════════

import type { APIRequestContext } from '@playwright/test'

// ─── Types ──────────────────────────────────────────────────

export type CycleStatus =
  | 'DRAFT' | 'ACTIVE' | 'CHECK_IN' | 'EVAL_OPEN'
  | 'CALIBRATION' | 'FINALIZED' | 'CLOSED'
  | 'COMP_REVIEW' | 'COMP_COMPLETED'

// 서버 파이프라인은 half-aware (src/lib/performance/pipeline.ts 평가 파이프라인 재설계 Phase A):
//   H1: DRAFT → ACTIVE → EVAL_OPEN → CLOSED                       (CHECK_IN 없음)
//   H2: DRAFT → ACTIVE → EVAL_OPEN → CLOSED → CALIBRATION → COMP_REVIEW → COMP_COMPLETED
// 고정 상태표 인덱스 산술로 advance 횟수를 미리 계산하면 파이프라인이 바뀔 때마다
// 목표를 지나친다 (실제 사고: 구 9-state 표 기준 3 스텝 = 신 H1에선 EVAL_OPEN을 지나
// CLOSED 도달 → nominate "EVAL_OPEN 단계에서만" 400). advanceTo는 서버가 돌려주는
// 상태를 보고 멈추는 피드백 루프로 동작한다 — 여기에 상태표를 다시 만들지 말 것.

interface CreateCycleParams {
  name?: string
  year?: number
  half?: 'H1' | 'H2' | 'ANNUAL'
  goalStart?: string
  goalEnd?: string
  evalStart?: string
  evalEnd?: string
  excludeProbation?: boolean
}

interface SelfEvalParams {
  cycleId: string
  goalScores: Array<{ goalId: string; score: number; comment?: string }>
  competencyScores: Array<{ competencyId: string; score: number; comment?: string }>
  overallComment?: string
  status: 'DRAFT' | 'SUBMITTED'
}

interface ManagerEvalParams {
  cycleId: string
  employeeId: string
  goalScores: Array<{ goalId: string; score: number; comment?: string }>
  competencyScores: Array<{ competencyId: string; score: number; comment?: string }>
  performanceGrade?: string
  competencyGrade?: string
  overallComment?: string
  status: 'DRAFT' | 'SUBMITTED'
}

// ─── API Response Helper (shared) ───────────────────────────

// Re-export from shared api-client (single source of truth)
import { parseApiResponse } from './api-client'
export { parseApiResponse }

// ─── Cycle Management ───────────────────────────────────────

/**
 * Create a test performance cycle (DRAFT status).
 * Returns the cycle ID.
 */
export async function createTestCycle(
  request: APIRequestContext,
  overrides?: CreateCycleParams,
): Promise<string> {
  const now = Date.now()
  const payload = {
    name: overrides?.name ?? `E2E Test Cycle ${now}`,
    year: overrides?.year ?? 2026,
    half: overrides?.half ?? 'H1',
    goalStart: overrides?.goalStart ?? '2026-01-01T00:00:00.000Z',
    goalEnd: overrides?.goalEnd ?? '2026-03-31T00:00:00.000Z',
    evalStart: overrides?.evalStart ?? '2026-04-01T00:00:00.000Z',
    evalEnd: overrides?.evalEnd ?? '2026-06-30T00:00:00.000Z',
    excludeProbation: overrides?.excludeProbation ?? false,
  }

  const res = await request.post('/api/v1/performance/cycles', { data: payload })
  const { ok, data, status, error } = await parseApiResponse(res)

  if (!ok || !data) {
    throw new Error(`createTestCycle failed (${status}): ${error ?? 'unknown'}`)
  }

  return (data as { id: string }).id
}

/**
 * Initialize a DRAFT cycle → ACTIVE (creates PerformanceReview records).
 */
export async function initializeCycle(
  request: APIRequestContext,
  cycleId: string,
): Promise<void> {
  const res = await request.post(`/api/v1/performance/cycles/${cycleId}/initialize`)
  const { ok, status, error } = await parseApiResponse(res)

  if (!ok) {
    throw new Error(`initializeCycle failed (${status}): ${error ?? 'unknown'}`)
  }
}

/**
 * Advance cycle to next state (PUT, not POST).
 * Returns the new status.
 */
export async function advanceCycle(
  request: APIRequestContext,
  cycleId: string,
): Promise<string> {
  const res = await request.put(`/api/v1/performance/cycles/${cycleId}/advance`)
  const { ok, data, status, error } = await parseApiResponse(res)

  if (!ok) {
    throw new Error(`advanceCycle failed (${status}): ${error ?? 'unknown'}`)
  }

  return (data as { status: string })?.status ?? 'unknown'
}

/**
 * Advance cycle repeatedly until it reaches the target status.
 * Handles initialize for DRAFT → ACTIVE transition.
 */
export async function advanceTo(
  request: APIRequestContext,
  cycleId: string,
  targetStatus: CycleStatus,
): Promise<void> {
  // First, get current status
  const getRes = await request.get(`/api/v1/performance/cycles/${cycleId}`)
  const { data } = await parseApiResponse(getRes)
  let currentStatus = ((data as { status: string })?.status ?? 'DRAFT') as CycleStatus

  // 피드백 루프: 서버가 보고하는 상태가 목표와 같아지면 즉시 멈춘다 (위 파이프라인 주석).
  // H2 최장 체인이 7단계라 guard 10이면 충분 — 목표 미도달이면 명시적으로 throw.
  for (let guard = 0; guard < 10 && currentStatus !== targetStatus; guard++) {
    if (currentStatus === 'DRAFT') {
      // DRAFT → ACTIVE requires initialize, not advance
      await initializeCycle(request, cycleId)
      currentStatus = 'ACTIVE'
      continue
    }
    const newStatus = await advanceCycle(request, cycleId)
    if (newStatus === 'unknown' || newStatus === currentStatus) {
      throw new Error(`advanceTo: stuck at ${currentStatus} while targeting ${targetStatus} (cycle ${cycleId})`)
    }
    currentStatus = newStatus as CycleStatus
  }

  if (currentStatus !== targetStatus) {
    throw new Error(`advanceTo: did not reach ${targetStatus} — ended at ${currentStatus} (cycle ${cycleId}; target가 해당 half 파이프라인에 없거나 이미 지나침)`)
  }
}

// ─── Goal Management ────────────────────────────────────────

interface CreateGoalParams {
  cycleId: string
  title: string
  weight: number
  description?: string
}

/**
 * Create an MBO goal for the current user in a cycle.
 * Returns the goal ID.
 */
export async function createGoal(
  request: APIRequestContext,
  params: CreateGoalParams,
): Promise<string> {
  const res = await request.post('/api/v1/performance/goals', { data: params })
  const { ok, data, status, error } = await parseApiResponse(res)

  if (!ok || !data) {
    throw new Error(`createGoal failed (${status}): ${error ?? 'unknown'}`)
  }

  return (data as { id: string }).id
}

// ─── Evaluation Submission ──────────────────────────────────

/**
 * Submit self-evaluation for the current user.
 */
export async function submitSelfEval(
  request: APIRequestContext,
  params: SelfEvalParams,
): Promise<{ status: number; ok: boolean }> {
  const res = await request.post('/api/v1/performance/evaluations/self', { data: params })
  return { status: res.status(), ok: res.ok() }
}

/**
 * Submit manager evaluation for a specific employee.
 */
export async function submitManagerEval(
  request: APIRequestContext,
  params: ManagerEvalParams,
): Promise<{ status: number; ok: boolean }> {
  const res = await request.post('/api/v1/performance/evaluations/manager', { data: params })
  return { status: res.status(), ok: res.ok() }
}

// ─── Query Helpers ──────────────────────────────────────────

/**
 * Get cycle details by ID.
 */
export async function getCycle(
  request: APIRequestContext,
  cycleId: string,
): Promise<{ status: CycleStatus; name: string; id: string }> {
  const res = await request.get(`/api/v1/performance/cycles/${cycleId}`)
  const { ok, data, status, error } = await parseApiResponse(res)

  if (!ok || !data) {
    throw new Error(`getCycle failed (${status}): ${error ?? 'unknown'}`)
  }

  return data as { status: CycleStatus; name: string; id: string }
}

/**
 * Get self-evaluation for the current user in a cycle.
 */
export async function getSelfEval(
  request: APIRequestContext,
  cycleId: string,
): Promise<Record<string, unknown> | null> {
  const res = await request.get(`/api/v1/performance/evaluations/self?cycleId=${cycleId}`)
  const { ok, data } = await parseApiResponse(res)
  if (!ok) return null
  return data as Record<string, unknown> | null
}

// ─── Cleanup ────────────────────────────────────────────────

/**
 * Delete a test cycle (afterAll cleanup).
 * Silently fails if cycle doesn't exist.
 */
export async function cleanupTestCycle(
  request: APIRequestContext,
  cycleId: string,
): Promise<void> {
  try {
    await request.delete(`/api/v1/performance/cycles/${cycleId}`)
  } catch {
    // Cleanup is best-effort
  }
}
