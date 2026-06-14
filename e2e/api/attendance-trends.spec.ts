// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Trends API Tests (PR-4 + PR-4b 출근율)
// GET /api/v1/attendance/admin/trends — HR 전용, 멀티테넌트, cohort 억제
// PR-4b 추가: 출근율%(부서 칸 30일 + 12개월 직군 2선) rate-point 계약·표본억제·미지원 가드.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import { getAdminTrends } from '../helpers/attendance-fixtures'

interface TrendsShape {
  timezone: string
  cohortMin: number
  window: { deptStart: string; deptEnd: string; trendStart: string }
  departments: Array<{
    departmentId: string
    departmentName: string
    employeeCount: number
    lateCount: number
    absentCount: number
    avgClockIn: string | null
    avgClockOut: string | null
    avgOvertimeHours: number | null
    attendanceRate: number | null
    attendanceRateDenom: number | null
    attendanceRateCohort: number
    attendanceRateSuppressed: boolean
  }>
  arrival: {
    workStartTime: string | null
    shiftEnabled: boolean
    buckets: Array<{ label: string; count: number; afterStart: boolean }>
  }
  typeTrend: Array<{
    month: string
    normal: number
    late: number
    earlyOut: number
    absent: number
    leaveRequests: number
  }>
  rateTrend: Array<{
    month: string
    management: RatePoint
    production: RatePoint
  }>
  rateMeta: {
    supported: boolean
    reason: 'SHIFT' | 'NON_STANDARD_WEEK' | null
    cohortMin: number
    rosterCount: number
    unclassifiedCount: number
    anomalyCount: number
    classMix: { management: number; production: number }
    basisNote: string
  }
}

interface RatePoint {
  rate: number | null
  denom: number | null
  cohort: number
  suppressed: boolean
}

/** rate-point 계약 검증: rate≠null ⇒ denom≠null·0..100; suppressed ⇒ rate=null; cohort≥0 정수 */
function assertRatePoint(p: RatePoint): void {
  expect(p.cohort).toBeGreaterThanOrEqual(0)
  expect(Number.isInteger(p.cohort)).toBe(true)
  expect(typeof p.suppressed).toBe('boolean')
  if (p.rate != null) {
    expect(p.denom).not.toBeNull()
    expect(p.rate).toBeGreaterThanOrEqual(0)
    expect(p.rate).toBeLessThanOrEqual(100)
    expect(p.suppressed).toBe(false)
  }
  if (p.suppressed) expect(p.rate).toBeNull()
}

test.describe('Attendance Trends API', () => {
  // ─── HR_ADMIN: shape + invariants ─────────────────────────

  test.describe('HR_ADMIN: trends', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('GET /attendance/admin/trends returns the 3-block shape', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertOk(res, 'admin trends')
      const d = res.data as TrendsShape
      expect(typeof d.timezone).toBe('string')
      expect(d.cohortMin).toBe(5)
      expect(d.window.deptStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(d.window.trendStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Array.isArray(d.departments)).toBe(true)
      expect(Array.isArray(d.arrival.buckets)).toBe(true)
      expect(Array.isArray(d.typeTrend)).toBe(true)
    })

    test('cohort suppression: every returned dept has >= cohortMin members', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertOk(res, 'cohort')
      const d = res.data as TrendsShape
      for (const dept of d.departments) {
        expect(dept.employeeCount).toBeGreaterThanOrEqual(d.cohortMin)
        // avg 시간 필드는 string|null (per-metric cohort 게이트로 null 가능)
        expect(dept.avgClockIn === null || typeof dept.avgClockIn === 'string').toBe(true)
        expect(dept.avgClockOut === null || typeof dept.avgClockOut === 'string').toBe(true)
        expect(dept.avgOvertimeHours === null || typeof dept.avgOvertimeHours === 'number').toBe(true)
      }
    })

    test('arrival buckets are well-formed; counts are non-negative numbers', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertOk(res, 'arrival')
      const d = res.data as TrendsShape
      for (const b of d.arrival.buckets) {
        expect(typeof b.count).toBe('number')
        expect(b.count).toBeGreaterThanOrEqual(0)
        expect(typeof b.afterStart).toBe('boolean')
      }
      // 교대제면 기준선(workStartTime) null
      if (d.arrival.shiftEnabled) expect(d.arrival.workStartTime).toBeNull()
    })

    test('typeTrend is exactly 6 zero-filled months (YYYY-MM, numeric, no future)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertOk(res, 'typeTrend')
      const d = res.data as TrendsShape
      // Codex Gate2 P1-2: 정확히 6개월 (데이터 없는 월도 0으로)
      expect(d.typeTrend).toHaveLength(6)
      const nowMonth = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7) // KST 현재 월 근사
      for (const m of d.typeTrend) {
        expect(m.month).toMatch(/^\d{4}-\d{2}$/)
        // Codex Gate2 P1-1: 미래 월 없음
        expect(m.month <= nowMonth).toBe(true)
        for (const v of [m.normal, m.late, m.earlyOut, m.absent, m.leaveRequests]) {
          expect(typeof v).toBe('number')
          expect(v).toBeGreaterThanOrEqual(0)
        }
      }
      // 오름차순 정렬
      const months = d.typeTrend.map((m) => m.month)
      expect([...months].sort()).toEqual(months)
    })

    // ─── PR-4b: 출근율 ─────────────────────────────────────
    test('rate: rateTrend = 12 zero-filled months, two series, rate-point 계약', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertOk(res, 'rateTrend')
      const d = res.data as TrendsShape
      expect(d.rateTrend).toHaveLength(12)
      const months = d.rateTrend.map((m) => m.month)
      expect([...months].sort()).toEqual(months) // 오름차순
      const nowMonth = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)
      for (const m of d.rateTrend) {
        expect(m.month).toMatch(/^\d{4}-\d{2}$/)
        expect(m.month <= nowMonth).toBe(true) // 미래 월 없음
        assertRatePoint(m.management)
        assertRatePoint(m.production)
      }
    })

    test('rate: rateMeta shape (supported·classMix·counts)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertOk(res, 'rateMeta')
      const { rateMeta: meta } = res.data as TrendsShape
      expect(typeof meta.supported).toBe('boolean')
      expect(meta.cohortMin).toBe(5)
      expect(meta.rosterCount).toBeGreaterThanOrEqual(0)
      expect(meta.unclassifiedCount).toBeGreaterThanOrEqual(0)
      expect(meta.anomalyCount).toBeGreaterThanOrEqual(0)
      expect(meta.classMix.management + meta.classMix.production).toBe(meta.rosterCount)
      // 미지원이면 추세 point 전부 null·미억제 (고정 tuple)
      if (!meta.supported) {
        for (const m of (res.data as TrendsShape).rateTrend) {
          expect(m.management.rate).toBeNull()
          expect(m.production.rate).toBeNull()
        }
      }
    })

    test('rate: dept 출근율 rate-point 계약 준수', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertOk(res, 'dept rate')
      for (const dept of (res.data as TrendsShape).departments) {
        assertRatePoint({
          rate: dept.attendanceRate,
          denom: dept.attendanceRateDenom,
          cohort: dept.attendanceRateCohort,
          suppressed: dept.attendanceRateSuppressed,
        })
      }
    })

    test('HR cannot scope to another company (companyId param ignored)', async ({ request }) => {
      const api = new ApiClient(request)
      const own = await getAdminTrends(api)
      assertOk(own, 'own company')
      // 비-SUPER가 타사 companyId를 줘도 resolveCompanyId가 자사로 강제 → 동일 부서 집합
      const foreign = await getAdminTrends(api, {
        companyId: '00000000-0000-0000-0000-000000000999',
      })
      assertOk(foreign, 'foreign companyId ignored')
      const ownIds = (own.data as TrendsShape).departments.map((d) => d.departmentId).sort()
      const foreignIds = (foreign.data as TrendsShape).departments.map((d) => d.departmentId).sort()
      expect(foreignIds).toEqual(ownIds)
    })
  })

  // ─── SUPER_ADMIN: cross-company ───────────────────────────

  test.describe('SUPER_ADMIN: cross-company trends', () => {
    test.use({ storageState: authFile('SUPER_ADMIN') })

    test('GET /attendance/admin/trends?companyId returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const seed = await resolveSeedData(request)
      const res = await getAdminTrends(api, { companyId: seed.companyId })
      assertOk(res, 'super trends cross-company')
    })
  })

  // ─── RBAC: HR 전용 (att-05) ───────────────────────────────

  test.describe('MANAGER: trends denied', () => {
    test.use({ storageState: authFile('MANAGER') })
    test('GET /attendance/admin/trends → 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertError(res, 403, 'manager trends denied')
    })
  })

  test.describe('EXECUTIVE: trends denied (att-05 — HR 전용)', () => {
    test.use({ storageState: authFile('EXECUTIVE') })
    test('GET /attendance/admin/trends → 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertError(res, 403, 'executive trends denied')
    })
  })

  test.describe('EMPLOYEE: trends denied', () => {
    test.use({ storageState: authFile('EMPLOYEE') })
    test('GET /attendance/admin/trends → 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminTrends(api)
      assertError(res, 403, 'employee trends denied')
    })
  })
})
