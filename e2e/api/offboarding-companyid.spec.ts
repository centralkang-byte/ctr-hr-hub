// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding companyId tenant-scope (S273)
// EmployeeOffboarding.companyId 직접 스코핑 검증:
//  ① 완료 퇴사 가시성 (구: active-assignment 조인 → 완료 시 404·완료탭 0건)
//  ② A/B 법인 HR 격리 (타법인 상세 404)
//  ③ task-status fail-open 차단 (구: 활성발령 없으면 가드 스킵 → cross-tenant 변경)
// 읽기 전용·멱등 — 시드 COMPLETED 행(07-lifecycle 박진혁)에 의존하되 id는 동적 조회.
// 정산 invariant(409)·정산 비제로 검증은 라이브 dogfood로 별도 실증 (S273 세션 로그).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

interface OffboardingDetail {
    id: string
    status: string
    employeeName: string
    company: string
    tasks: Array<{ id: string }>
}

interface DashboardRow {
    id: string
    status: string
    employee?: { name?: string }
}

test.describe('Offboarding companyId tenant-scope', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let completedId: string
    let completedTaskId: string | undefined

    test('완료 퇴사가 dashboard COMPLETED 탭에 보인다 (구: 0건)', async ({ request }) => {
        const client = new ApiClient(request)
        const result = await client.get<DashboardRow[]>('/api/v1/offboarding/dashboard', {
            status: 'COMPLETED',
        })
        expect(result.ok).toBe(true)
        const rows = result.data ?? []
        expect(rows.length).toBeGreaterThan(0)
        completedId = rows[0].id
    })

    test('완료 퇴사 상세가 열리고 회사·부서가 렌더된다 (구: 404·"—")', async ({ request }) => {
        const client = new ApiClient(request)
        const result = await client.get<OffboardingDetail>(
            `/api/v1/offboarding/instances/${completedId}`,
        )
        expect(result.ok).toBe(true)
        expect(result.data?.status).toBe('COMPLETED')
        // 표시용 assignment가 endDate 무관 최신 primary → 완료 후에도 회사명 노출
        expect(result.data?.company).not.toBe('—')
        completedTaskId = result.data?.tasks?.[0]?.id
    })

    test('완료 퇴사가 instances 리스트에도 보인다', async ({ request }) => {
        const client = new ApiClient(request)
        const result = await client.get<Array<{ id: string }>>('/api/v1/offboarding/instances', {
            status: 'COMPLETED',
        })
        expect(result.ok).toBe(true)
        expect((result.data ?? []).some((r) => r.id === completedId)).toBe(true)
    })

    test('타법인(CN) HR은 상세 404 — A/B 격리', async ({ playwright, baseURL }) => {
        const cn = await playwright.request.newContext({
            baseURL: baseURL ?? undefined,
            storageState: authFile('HR_ADMIN_CN'),
        })
        try {
            const res = await cn.get(`/api/v1/offboarding/instances/${completedId}`)
            expect(res.status()).toBe(404)
        } finally {
            await cn.dispose()
        }
    })

    test('타법인(CN) HR의 task-status 변경 = 404 — fail-open 차단 (P0)', async ({ playwright, baseURL }) => {
        test.skip(!completedTaskId, '시드 COMPLETED 행에 태스크 없음')
        const cn = await playwright.request.newContext({
            baseURL: baseURL ?? undefined,
            storageState: authFile('HR_ADMIN_CN'),
        })
        try {
            // 구 코드: 완료 퇴사자 = 활성발령 없음 → taskCompanyId undefined → 가드 스킵(fail-open).
            // 신 코드: scoped findFirst → 존재 자체 비노출(404).
            const res = await cn.put(
                `/api/v1/offboarding/instances/${completedId}/tasks/${completedTaskId}/status`,
                { data: { status: 'IN_PROGRESS' } },
            )
            expect(res.status()).toBe(404)
        } finally {
            await cn.dispose()
        }
    })

    test('SUPER_ADMIN은 법인 무관 상세 조회 가능', async ({ playwright, baseURL }) => {
        const su = await playwright.request.newContext({
            baseURL: baseURL ?? undefined,
            storageState: authFile('SUPER_ADMIN'),
        })
        try {
            const res = await su.get(`/api/v1/offboarding/instances/${completedId}`)
            expect(res.status()).toBe(200)
        } finally {
            await su.dispose()
        }
    })
})
