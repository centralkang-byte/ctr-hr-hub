// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Module E2E Fixtures
// CRUD helpers for employee API tests.
// ═══════════════════════════════════════════════════════════

import type { APIRequestContext } from '@playwright/test'
import { parseApiResponse, parseRawResponse, type ApiResult } from './api-client'
import { resolveSeedData } from './test-data'

// ─── Types ──────────────────────────────────────────────────

interface CreateEmployeeParams {
  employeeNo?: string
  name?: string
  email?: string
  companyId?: string
  departmentId?: string
  jobGradeId?: string
  jobCategoryId?: string
  hireDate?: string
  employmentType?: string
  status?: string
  nameEn?: string
}

interface EmployeeRecord {
  id: string
  employeeNo: string
  name: string
  email: string
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Create a test employee with unique identifiers.
 * Uses seed data for required FK references (department, grade, company).
 */
export async function createTestEmployee(
  request: APIRequestContext,
  overrides?: CreateEmployeeParams,
): Promise<EmployeeRecord> {
  const seed = await resolveSeedData(request)
  const ts = Date.now()
  const prefix = `e2e-emp-${ts}`

  const payload = {
    employeeNo: overrides?.employeeNo ?? prefix,
    name: overrides?.name ?? `테스트직원 ${ts}`,
    email: overrides?.email ?? `${prefix}@e2e-test.local`,
    companyId: overrides?.companyId ?? seed.companyId,
    departmentId: overrides?.departmentId ?? seed.departmentId,
    jobGradeId: overrides?.jobGradeId ?? seed.jobGradeId,
    jobCategoryId: overrides?.jobCategoryId ?? seed.companyId, // will be resolved
    hireDate: overrides?.hireDate ?? '2026-01-01',
    employmentType: overrides?.employmentType ?? 'FULL_TIME',
    status: overrides?.status ?? 'ACTIVE',
    nameEn: overrides?.nameEn ?? `Test Employee ${ts}`,
  }

  // Resolve jobCategoryId from seed if not provided (Codex P1: correct endpoint path)
  if (!overrides?.jobCategoryId) {
    const catRes = await request.get('/api/v1/org/job-categories?limit=1')
    const catResult = await parseApiResponse<Array<Record<string, unknown>>>(catRes)
    if (catResult.ok && catResult.data && (catResult.data as unknown[]).length > 0) {
      payload.jobCategoryId = ((catResult.data as unknown[])[0] as Record<string, unknown>).id as string
    }
  }

  const res = await request.post('/api/v1/employees', { data: payload })
  const result = await parseApiResponse<EmployeeRecord>(res)

  if (!result.ok || !result.data) {
    throw new Error(`createTestEmployee failed (${result.status}): ${result.error ?? 'unknown'}`)
  }

  return result.data
}

/**
 * GET employee detail by ID.
 */
export async function getEmployee(
  request: APIRequestContext,
  id: string,
): Promise<ApiResult> {
  const res = await request.get(`/api/v1/employees/${id}`)
  return parseApiResponse(res)
}

/**
 * PUT employee update.
 */
export async function updateEmployee(
  request: APIRequestContext,
  id: string,
  updates: Record<string, unknown>,
): Promise<ApiResult> {
  const res = await request.put(`/api/v1/employees/${id}`, { data: updates })
  return parseApiResponse(res)
}

/**
 * DELETE employee (soft delete).
 */
export async function deleteEmployee(
  request: APIRequestContext,
  id: string,
): Promise<ApiResult> {
  const res = await request.delete(`/api/v1/employees/${id}`)
  return parseApiResponse(res)
}

/**
 * Search employees with query params.
 */
export async function searchEmployees(
  request: APIRequestContext,
  params: Record<string, string>,
): Promise<ApiResult> {
  const qs = new URLSearchParams(params).toString()
  const res = await request.get(`/api/v1/employees?${qs}`)
  return parseApiResponse(res)
}

/**
 * GET employee sub-resource.
 */
export async function getEmployeeSubResource(
  request: APIRequestContext,
  employeeId: string,
  subPath: string,
): Promise<ApiResult> {
  const res = await request.get(`/api/v1/employees/${employeeId}/${subPath}`)
  return parseApiResponse(res)
}

/**
 * GET employee export (raw binary).
 */
export async function getEmployeeExport(
  request: APIRequestContext,
  params?: Record<string, string>,
) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  const res = await request.get(`/api/v1/employees/export${qs}`)
  return parseRawResponse(res)
}
