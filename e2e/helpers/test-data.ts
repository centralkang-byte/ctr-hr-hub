// ═══════════════════════════════════════════════════════════
// CTR HR Hub — E2E Test Data Helpers
// Unique prefixes + test account mapping for data isolation
// ═══════════════════════════════════════════════════════════

/**
 * Generate a unique prefix for test data to avoid collisions.
 */
export function uniquePrefix(specName: string) {
  return `e2e-${specName}-${Date.now()}`
}

/**
 * QA test accounts from seed data.
 * Must match prisma/seed.ts and CLAUDE.md QA accounts.
 */
export const TEST_ACCOUNTS = {
  SUPER_ADMIN: {
    email: 'super@ctr.co.kr',
    name: '최상우',
    company: 'CTR-HOLD',
  },
  HR_ADMIN: {
    email: 'hr@ctr.co.kr',
    name: '한지영',
    company: 'CTR',
  },
  HR_ADMIN_CN: {
    email: 'hr@ctr-cn.com',
    name: '陈美玲',
    company: 'CTR-CN',
  },
  MANAGER: {
    email: 'manager@ctr.co.kr',
    name: '박준혁',
    company: 'CTR',
  },
  MANAGER2: {
    email: 'manager2@ctr.co.kr',
    name: '김서연',
    company: 'CTR',
  },
  EMPLOYEE_A: {
    email: 'employee-a@ctr.co.kr',
    name: '이민준',
    company: 'CTR',
  },
  EMPLOYEE_B: {
    email: 'employee-b@ctr.co.kr',
    name: '정다은',
    company: 'CTR',
  },
  EMPLOYEE_C: {
    email: 'employee-c@ctr.co.kr',
    name: '송현우',
    company: 'CTR',
  },
} as const

// ─── Seed Data Discovery ────────────────────────────────────

import type { APIRequestContext } from '@playwright/test'
import { parseApiResponse } from './api-client'

export interface SeedData {
  employeeId: string
  employeeName: string
  departmentId: string
  jobGradeId: string
  companyId: string
  leavePolicyId?: string
  leaveTypeDefId?: string
}

let _seedDataCache: SeedData | null = null

/**
 * Invalidate the cached seed data.
 * Call after creating leave policies/type-defs in tests
 * to avoid stale leavePolicyId/leaveTypeDefId (Codex P2).
 */
export function invalidateSeedDataCache(): void {
  _seedDataCache = null
}

/**
 * One-shot resolver: fetches a seed employee (이민준) and extracts
 * department, grade, company IDs from their primary assignment.
 * Also discovers an active leave policy + type def for leave tests.
 * Cached — safe to call multiple times.
 */
export async function resolveSeedData(request: APIRequestContext): Promise<SeedData> {
  if (_seedDataCache) return _seedDataCache

  // 1. Find 이민준 (EMPLOYEE_A) via search
  const empRes = await request.get('/api/v1/employees?search=이민준&limit=1')
  const empResult = await parseApiResponse<Array<Record<string, unknown>>>(empRes)
  if (!empResult.ok || !empResult.data || (empResult.data as unknown[]).length === 0) {
    throw new Error('resolveSeedData: could not find 이민준 in employee list')
  }

  const emp = (empResult.data as unknown[])[0] as Record<string, unknown>
  const empId = emp.id as string

  // Extract assignment data (primary assignment is included in list response)
  const assignments = emp.assignments as Array<Record<string, unknown>> | undefined
  const primary = assignments?.find((a) => a.isPrimary && !a.endDate) ?? assignments?.[0]

  // The employees list API returns relations as nested objects (e.g. jobGrade: { id, name })
  // rather than raw foreign keys (jobGradeId). Handle both shapes for resilience.
  const departmentId = (
    primary?.departmentId ??
    (primary?.department as Record<string, unknown> | undefined)?.id ??
    ''
  ) as string
  const jobGradeId = (
    primary?.jobGradeId ??
    (primary?.jobGrade as Record<string, unknown> | undefined)?.id ??
    ''
  ) as string
  const companyId = (primary?.companyId ?? emp.companyId ?? '') as string

  // 2. Discover leave policy
  let leavePolicyId: string | undefined
  let leaveTypeDefId: string | undefined
  try {
    const policyRes = await request.get('/api/v1/leave/policies?limit=1')
    const policyResult = await parseApiResponse<Array<Record<string, unknown>>>(policyRes)
    if (policyResult.ok && policyResult.data && (policyResult.data as unknown[]).length > 0) {
      const policy = (policyResult.data as unknown[])[0] as Record<string, unknown>
      leavePolicyId = policy.id as string
    }
  } catch {
    // Leave policies may not exist — that's OK
  }

  try {
    const typeDefRes = await request.get('/api/v1/leave/type-defs?limit=1')
    const typeDefResult = await parseApiResponse<Array<Record<string, unknown>>>(typeDefRes)
    if (typeDefResult.ok && typeDefResult.data && (typeDefResult.data as unknown[]).length > 0) {
      const typeDef = (typeDefResult.data as unknown[])[0] as Record<string, unknown>
      leaveTypeDefId = typeDef.id as string
    }
  } catch {
    // Leave type defs may not exist — that's OK
  }

  _seedDataCache = {
    employeeId: empId,
    employeeName: '이민준',
    departmentId,
    jobGradeId,
    companyId,
    leavePolicyId,
    leaveTypeDefId,
  }

  return _seedDataCache
}

/**
 * Resolve a specific employee's ID by name.
 */
export async function resolveEmployeeId(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.get(`/api/v1/employees?search=${encodeURIComponent(name)}&limit=1`)
  const result = await parseApiResponse<Array<Record<string, unknown>>>(res)
  if (!result.ok || !result.data || (result.data as unknown[]).length === 0) {
    throw new Error(`resolveEmployeeId: could not find employee "${name}"`)
  }
  return ((result.data as unknown[])[0] as Record<string, unknown>).id as string
}
