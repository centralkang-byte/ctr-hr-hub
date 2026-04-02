// ═══════════════════════════════════════════════════════════
// E2E Helpers — Calibration Batch Adjust Fixtures
//
// Uses 46-calibration-qa seed data (CALIBRATION cycle + 20 evals)
// ═══════════════════════════════════════════════════════════

import type { APIRequestContext } from '@playwright/test'

const BASE = '/api/v1/performance/calibration'

// ─── Types ──────────────────────────────────────────────────

interface CalibrationSession {
  id: string
  cycleId: string
  companyId: string
  name: string
  status: string
}

interface Evaluation {
  id: string
  employeeId: string
  emsBlock: string | null
}

interface BatchAdjustResult {
  batchId: string
  totalProcessed: number
  succeeded: number
  failed: number
  results: Array<{ employeeId: string; status: 'success' | 'failed'; error?: string }>
}

// ─── Helpers ────────────────────────────────────────────────

export async function getCalibrationSessions(
  request: APIRequestContext,
): Promise<CalibrationSession[]> {
  const res = await request.get(`${BASE}/sessions`)
  if (!res.ok()) throw new Error(`getCalibrationSessions failed: ${res.status()}`)
  const body = await res.json() as { data?: CalibrationSession[] }
  return body.data ?? []
}

export async function getEvaluationsForCycle(
  request: APIRequestContext,
  cycleId: string,
): Promise<Evaluation[]> {
  // Use the distribution endpoint which returns evaluations for the cycle
  const res = await request.get(`${BASE}/adjustments?cycleId=${cycleId}`)
  if (res.ok()) {
    const body = await res.json() as { data?: Evaluation[] }
    return body.data ?? []
  }
  // Fallback: query evaluations directly via the sessions endpoint
  return []
}

export async function submitBatchAdjust(
  request: APIRequestContext,
  sessionId: string,
  adjustments: Array<{ employeeId: string; fromBlock: string; toBlock: string; reason?: string }>,
  sharedReason: string,
): Promise<{ status: number; ok: boolean; data?: BatchAdjustResult; error?: string }> {
  const res = await request.post(`${BASE}/${sessionId}/batch-adjust`, {
    data: { adjustments, sharedReason },
  })
  const status = res.status()
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  const errorObj = body.error as { message?: string } | string | undefined
  const error = typeof errorObj === 'string' ? errorObj : errorObj?.message
  return { status, ok: res.ok(), data: body.data as BatchAdjustResult | undefined, error }
}

export async function getSessionDistribution(
  request: APIRequestContext,
  sessionId: string,
): Promise<Evaluation[]> {
  const res = await request.get(`${BASE}/${sessionId}/distribution`)
  if (!res.ok()) return []
  const body = await res.json() as { data?: { evaluations?: Evaluation[] } }
  return body.data?.evaluations ?? []
}
