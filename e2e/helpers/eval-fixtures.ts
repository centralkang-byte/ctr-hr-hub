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

// 9-state pipeline (from src/lib/performance/pipeline.ts)
const TRANSITION_ORDER: CycleStatus[] = [
  'DRAFT', 'ACTIVE', 'CHECK_IN', 'EVAL_OPEN',
  'CALIBRATION', 'FINALIZED', 'CLOSED',
  'COMP_REVIEW', 'COMP_COMPLETED',
]

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

  const currentIdx = TRANSITION_ORDER.indexOf(currentStatus)
  const targetIdx = TRANSITION_ORDER.indexOf(targetStatus)

  if (currentIdx >= targetIdx) return // Already at or past target

  for (let i = currentIdx; i < targetIdx; i++) {
    if (TRANSITION_ORDER[i] === 'DRAFT') {
      // DRAFT → ACTIVE requires initialize, not advance
      await initializeCycle(request, cycleId)
      currentStatus = 'ACTIVE'
    } else {
      const newStatus = await advanceCycle(request, cycleId)
      currentStatus = newStatus as CycleStatus
    }
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
