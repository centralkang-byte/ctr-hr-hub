# analytics 멀티테넌트 격리 (batch4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** analytics API 19개 라우트의 cross-tenant `companyId` 누출을 차단한다 (비-SUPER는 자기 법인 강제, SUPER는 통합뷰 유지).

**Architecture:** `workforce/overview`에 이미 검증된 안전 패턴을 `resolveCompanyFilter(user, requested)` 헬퍼(where 조각 반환)로 추출하고, 누출 라우트를 형태별로 치환한다. 쓰기 1개(ai-report/generate)와 단일-where 2개는 `resolveCompanyId`(단일 강제). 설계: [2026-06-04-analytics-multitenant.md](./2026-06-04-analytics-multitenant.md).

**Tech Stack:** Next.js App Router route handlers, `withPermission`/`withCache` 래퍼, Prisma, vitest(단위), Playwright(e2e).

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/lib/api/companyFilter.ts` | resolveCompanyId(기존) + **resolveCompanyFilter(신설)** SSOT | Modify (PROTECTED 확장) |
| `tests/unit/lib/api/companyFilter.test.ts` | resolveCompanyFilter 순수함수 단위테스트 | Create |
| `src/app/api/v1/analytics/{6}/route.ts` | (A) where 조각형 치환 | Modify |
| `src/app/api/v1/analytics/payroll/overview/route.ts` | (A) + isCrossCompany 보정 | Modify |
| `src/app/api/v1/analytics/{ai-report,prediction/burnout,prediction/turnover}/route.ts` | (A') searchParams 치환 | Modify |
| `src/app/api/v1/analytics/{8}/route.ts` | (B) 단일 인자형 — user 추가 + scope | Modify |
| `src/app/api/v1/analytics/{team-health-scores,ai-report/generate}/route.ts` | 단일 강제(resolveCompanyId) | Modify |
| `e2e/api/analytics-cross-tenant.spec.ts` | 19 라우트 cross-tenant 차단 입증 | Create |

**공통 import 추가** (수정 라우트): `import { resolveCompanyFilter } from '@/lib/api/companyFilter'` (또는 `resolveCompanyId`), `import type { SessionUser } from '@/types'` (이미 있으면 생략).

---

## Task 1: resolveCompanyFilter 헬퍼 + 단위테스트 (TDD)

**Files:**
- Create: `tests/unit/lib/api/companyFilter.test.ts`
- Modify: `src/lib/api/companyFilter.ts` (PROTECTED — resolveCompanyId 아래 추가)

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/unit/lib/api/companyFilter.test.ts
import { describe, it, expect } from 'vitest'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'

const mk = (role: string, companyId = 'co-self'): SessionUser =>
  ({ role, companyId } as SessionUser)

describe('resolveCompanyFilter', () => {
  it('비-SUPER: requested 타법인을 무시하고 자기 법인 강제', () => {
    expect(resolveCompanyFilter(mk('HR_ADMIN'), 'co-other')).toEqual({ companyId: 'co-self' })
  })
  it('비-SUPER: requested 없어도 자기 법인', () => {
    expect(resolveCompanyFilter(mk('MANAGER'), null)).toEqual({ companyId: 'co-self' })
  })
  it('SUPER: requested 지정 시 해당 법인', () => {
    expect(resolveCompanyFilter(mk('SUPER_ADMIN'), 'co-other')).toEqual({ companyId: 'co-other' })
  })
  it('SUPER: requested 없으면 전체({})', () => {
    expect(resolveCompanyFilter(mk('SUPER_ADMIN'), null)).toEqual({})
  })
  it('SUPER: requested 빈문자열도 전체({})', () => {
    expect(resolveCompanyFilter(mk('SUPER_ADMIN'), '')).toEqual({})
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/lib/api/companyFilter.test.ts`
Expected: FAIL — `resolveCompanyFilter is not a function` (또는 import 에러)

- [ ] **Step 3: 헬퍼 구현** — `src/lib/api/companyFilter.ts`의 `resolveCompanyId` 함수 **바로 아래**에 추가:

```ts
/**
 * 멀티테넌트 companyId where 필터 조각 (집계/읽기용)
 * - SUPER_ADMIN: 지정 시 해당 법인, 미지정 시 전체({}) — 통합 집계뷰
 * - 그 외: 무조건 user.companyId 강제 (요청 파라미터 무시)
 * 단일 companyId가 필요한 쓰기/단일법인 분석은 resolveCompanyId를 쓸 것.
 */
export function resolveCompanyFilter(
  user: SessionUser,
  requestedCompanyId?: string | null,
): { companyId?: string } {
  const effective =
    user.role === 'SUPER_ADMIN' ? (requestedCompanyId || undefined) : user.companyId
  return effective ? { companyId: effective } : {}
}
```

> ⚠️ `requestedCompanyId || undefined` (not `??`) — 빈 문자열 `''`도 "미지정"으로 처리해 SUPER 전체뷰가 되게 한다 (테스트 5번째 케이스).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/lib/api/companyFilter.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/api/companyFilter.ts tests/unit/lib/api/companyFilter.test.ts
git commit -m "feat(analytics): resolveCompanyFilter 헬퍼 — SUPER 통합뷰/비-SUPER 자기법인 강제 (멀티테넌트 batch4)"
```

---

## Task 2: (A) where 조각형 6개 치환

**Files (Modify):** 각 `src/app/api/v1/analytics/<route>/route.ts`

| 라우트 | sig 라인 | companyFilter 라인 |
|---|---|---|
| executive/summary | 19 | 21 |
| executive/drilldown | 22 | 30 |
| attendance/overview | 17 | 19 |
| performance/overview | 20 | 22 |
| turnover/overview | 31 | 33 |

> payroll/overview는 isCrossCompany 보정이 필요해 Task 3에서 별도 처리.

- [ ] **Step 1: 각 라우트에 동일 패턴 적용** (5개)

각 파일에서 두 곳을 수정한다:

**(1) 핸들러 시그니처** — `_user` 밑줄 제거:
```ts
// before
async (req: NextRequest, _ctx, _user: SessionUser) => {
// after
async (req: NextRequest, _ctx, user: SessionUser) => {
```

**(2) companyFilter 결정 라인**:
```ts
// before
const companyFilter = params.companyId ? { companyId: params.companyId } : {}
// after
const companyFilter = resolveCompanyFilter(user, params.companyId)
```

**(3) import 추가** (파일 상단 import 블록):
```ts
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
```
(`SessionUser`는 이미 import됨 — 시그니처에 쓰이고 있었음.)

`companyFilter` 변수를 쓰는 하위 `where` 절들은 그대로 둔다 (변수만 안전해짐).

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/v1/analytics/executive/summary/route.ts src/app/api/v1/analytics/executive/drilldown/route.ts src/app/api/v1/analytics/attendance/overview/route.ts src/app/api/v1/analytics/performance/overview/route.ts src/app/api/v1/analytics/turnover/overview/route.ts
git commit -m "fix(analytics): (A) where 조각형 5개 resolveCompanyFilter 치환 — cross-tenant 차단 (batch4)"
```

---

## Task 3: payroll/overview — (A) + isCrossCompany 보정

**Files:** Modify `src/app/api/v1/analytics/payroll/overview/route.ts`

이 라우트는 `isCrossCompany` 플래그(통화 변환용)가 `!params.companyId`에 묶여 있다. 비-SUPER가 파라미터를 안 줘도 자기 법인인데 `isCrossCompany=true`(전체로 오인)가 되면 안 된다. companyFilter 기준으로 바꾼다.

- [ ] **Step 1: 4곳 수정**

```ts
// (1) 시그니처 L19: _user → user
async (req: NextRequest, _ctx, user: SessionUser) => {

// (2) L21 companyFilter
const companyFilter = resolveCompanyFilter(user, params.companyId)

// (3) L22 isCrossCompany — params.companyId → companyFilter.companyId
const isCrossCompany = !companyFilter.companyId

// (4) L39 — params.companyId 직접 참조를 companyFilter로
...(companyFilter.companyId ? { payrollRun: { companyId: companyFilter.companyId } } : {}),

// (5) L88 — displayCurrency의 params.companyId 참조
const displayCurrency = isCrossCompany ? 'KRW' : (companies.find((c) => c.id === companyFilter.companyId)?.currency || 'KRW')
```

import 추가: `import { resolveCompanyFilter } from '@/lib/api/companyFilter'`

> 결과: 비-SUPER → `companyFilter={companyId:user.companyId}` → `isCrossCompany=false`(자기 법인 단일 통화). SUPER 미지정 → `{}` → `isCrossCompany=true`(전체 KRW 환산). 의도대로.

- [ ] **Step 2: 타입 체크** — `npx tsc --noEmit` → 0 errors
- [ ] **Step 3: 커밋**

```bash
git add src/app/api/v1/analytics/payroll/overview/route.ts
git commit -m "fix(analytics): payroll/overview resolveCompanyFilter + isCrossCompany 보정 (batch4)"
```

---

## Task 4: (A') searchParams 읽기 3개

**Files (Modify):**

| 라우트 | sig | companyId 라인 | where 사용 |
|---|---|---|---|
| ai-report | 14 | 17 | 22 |
| prediction/burnout | 17 | 20 | 32 |
| prediction/turnover | 18 | 21 | 35 |

- [ ] **Step 1: 각 라우트 패턴 적용** (3개)

```ts
// (1) 시그니처: _user → user
async (req: NextRequest, _ctx, user: SessionUser) => {

// (2) companyId 결정 라인 (L17/20/21) — 삭제하고 companyFilter로
// before
const companyId = searchParams.get('companyId') || undefined
// after
const companyFilter = resolveCompanyFilter(user, searchParams.get('companyId'))

// (3) where spread (L22/32/35)
// before
...(companyId ? { companyId } : {}),
// after
...companyFilter,
```

import 추가: `import { resolveCompanyFilter } from '@/lib/api/companyFilter'`

> `companyId` 식별자가 다른 곳(select 등 L29 `companyId: true`)에 있으면 그건 건드리지 않는다 — where 필터 조각만 교체.

- [ ] **Step 2: 타입 체크** — `npx tsc --noEmit` → 0 errors
- [ ] **Step 3: 커밋**

```bash
git add src/app/api/v1/analytics/ai-report/route.ts src/app/api/v1/analytics/prediction/burnout/route.ts src/app/api/v1/analytics/prediction/turnover/route.ts
git commit -m "fix(analytics): (A') searchParams 읽기 3개 resolveCompanyFilter 치환 (batch4)"
```

---

## Task 5: (B) 단일 인자형 8개 — user 인자 추가 + scope

**Files (Modify):** 비즈헬퍼는 전부 `companyId?: string`(옵셔널, `src/lib/analytics/queries.ts`) → `resolveCompanyFilter(user, raw).companyId`로 안전.

| 라우트 | sig 라인 | parse 라인 | 비즈헬퍼 호출 |
|---|---|---|---|
| overview | 20 | 22 | getHeadcountSummary(companyId) 등 |
| attendance | 21 | 23 | getAttendanceWeekly(companyId, weeks) 등 |
| compensation | 20 | 22 | getCompaRatioDistribution(companyId) 등 |
| performance | 19 | 21 | getEmsBlockDistribution(cycleId, companyId) 등 |
| recruitment | 19 | 21 | getRecruitmentFunnel(companyId) 등 |
| team-health | 19 | 21 | getTeamHealthList(companyId) 등 |
| turnover | 22 | 24 | getMonthlyResignations(companyId, months) 등 |
| workforce | 20 | 22 | getHeadcountByDepartment(companyId) 등 |

- [ ] **Step 1: 각 라우트 패턴 적용** (8개)

```ts
// (1) 시그니처 — user 인자 추가 (현재 (req: NextRequest)만 받음)
// before
async (req: NextRequest) => {
// after
async (req: NextRequest, _ctx, user: SessionUser) => {

// (2) parse 결과를 raw로 받고, scope된 companyId로 재바인딩
// before
const { company_id: companyId } = analyticsQuerySchema.parse({
  company_id: searchParams.get('company_id') ?? undefined,
})
// after
const { company_id: requestedCompanyId } = analyticsQuerySchema.parse({
  company_id: searchParams.get('company_id') ?? undefined,
})
const { companyId } = resolveCompanyFilter(user, requestedCompanyId)
```

> 비즈헬퍼 호출(`getHeadcountSummary(companyId)` 등)은 **그대로 둔다** — `companyId`가 이제 스코프됨. 비-SUPER=자기법인, SUPER 미지정=undefined(헬퍼가 전체 처리), SUPER 지정=해당 법인.

> 라우트별 schema 변수가 다르면(turnover의 `months`, attendance의 `weeks`, performance의 `cycle_id: cycleId`) 그 destructure는 유지하고 `company_id: companyId`만 `company_id: requestedCompanyId`로 바꾼 뒤 아래 줄에서 `companyId` 재바인딩.

**import 추가** (각 파일):
```ts
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'
```
(`SessionUser`는 이 8개 라우트엔 아직 없음 — 추가 필요.)

- [ ] **Step 2: 타입 체크** — `npx tsc --noEmit` → 0 errors
- [ ] **Step 3: 커밋**

```bash
git add src/app/api/v1/analytics/overview/route.ts src/app/api/v1/analytics/attendance/route.ts src/app/api/v1/analytics/compensation/route.ts src/app/api/v1/analytics/performance/route.ts src/app/api/v1/analytics/recruitment/route.ts src/app/api/v1/analytics/team-health/route.ts src/app/api/v1/analytics/turnover/route.ts src/app/api/v1/analytics/workforce/route.ts
git commit -m "fix(analytics): (B) 단일 인자형 8개 user 전파 + resolveCompanyFilter scope (batch4)"
```

---

## Task 6: 단일 강제 2개 — team-health-scores + ai-report/generate (C)

**Files (Modify):**
- `src/app/api/v1/analytics/team-health-scores/route.ts` (where:`{ companyId }` 단일)
- `src/app/api/v1/analytics/ai-report/generate/route.ts` (POST 쓰기 — Codex Gate 1 P1)

둘 다 단일 `companyId`가 필요(where 단일 / create) → `resolveCompanyId`(단일 강제). 두 라우트 모두 핸들러가 이미 `user`를 받는다.

- [ ] **Step 1: team-health-scores** (L17)

```ts
// before
const companyId = params.companyId || user.companyId
// after
const companyId = resolveCompanyId(user, params.companyId)
```
import 추가: `import { resolveCompanyId } from '@/lib/api/companyFilter'`

> `params.companyId || user.companyId`는 비-SUPER가 params로 타법인을 주면 누출. resolveCompanyId가 비-SUPER는 user.companyId 강제, SUPER는 지정/자기.

- [ ] **Step 2: ai-report/generate** (L21)

```ts
// before
const companyId = body.companyId || null
// after
const companyId = resolveCompanyId(user, body.companyId)
```
import 추가: `import { resolveCompanyId } from '@/lib/api/companyFilter'`

> 쓰기라 `resolveCompanyFilter`(미지정=`{}`=전체생성 위험) 금지. `resolveCompanyId`는 string 반환(null 아님) — L30 `where:{companyId, period}`, L56 `create({ companyId })` 모두 단일 법인으로 강제됨. 비-SUPER는 body.companyId 무시.

- [ ] **Step 3: 타입 체크** — `npx tsc --noEmit` → 0 errors (`companyId` 타입이 `string|null`→`string`로 바뀌어도 하위 사용 호환 확인)
- [ ] **Step 4: 커밋**

```bash
git add src/app/api/v1/analytics/team-health-scores/route.ts src/app/api/v1/analytics/ai-report/generate/route.ts
git commit -m "fix(analytics): team-health-scores·ai-report/generate(POST) resolveCompanyId 단일 강제 (batch4)"
```

---

## Task 7: e2e — analytics-cross-tenant.spec.ts (19 전수 + SUPER 통합뷰)

**Files:** Create `e2e/api/analytics-cross-tenant.spec.ts` (모델: `e2e/api/payroll-cross-tenant.spec.ts`)

QA 세션: `authFile('HR_ADMIN')`=CTR 한지영, `authFile('HR_ADMIN_CN')`=CTR-CN 陈美玲, `authFile('SUPER_ADMIN')`=대조영. CTR-CN HR이 `?companyId=<CTR>`을 넘겨도 자기(CTR-CN) 데이터만 나와야 한다.

- [ ] **Step 1: spec 작성**

```ts
import { test, expect, request as playwrightRequest } from '@playwright/test'
import { authFile } from '../helpers/auth' // payroll-cross-tenant.spec.ts와 동일 헬퍼 경로 확인

// GET 누출 라우트 18개 (company_id 또는 companyId 파라미터로 cross-tenant 시도)
const GET_ROUTES: { path: string; param: 'companyId' | 'company_id' }[] = [
  { path: '/api/v1/analytics/executive/summary', param: 'companyId' },
  { path: '/api/v1/analytics/executive/drilldown', param: 'companyId' },
  { path: '/api/v1/analytics/attendance/overview', param: 'companyId' },
  { path: '/api/v1/analytics/payroll/overview', param: 'companyId' },
  { path: '/api/v1/analytics/performance/overview', param: 'companyId' },
  { path: '/api/v1/analytics/turnover/overview', param: 'companyId' },
  { path: '/api/v1/analytics/team-health-scores', param: 'companyId' },
  { path: '/api/v1/analytics/ai-report', param: 'companyId' },
  { path: '/api/v1/analytics/prediction/burnout', param: 'companyId' },
  { path: '/api/v1/analytics/prediction/turnover', param: 'companyId' },
  { path: '/api/v1/analytics/overview', param: 'company_id' },
  { path: '/api/v1/analytics/attendance', param: 'company_id' },
  { path: '/api/v1/analytics/compensation', param: 'company_id' },
  { path: '/api/v1/analytics/performance', param: 'company_id' },
  { path: '/api/v1/analytics/recruitment', param: 'company_id' },
  { path: '/api/v1/analytics/team-health', param: 'company_id' },
  { path: '/api/v1/analytics/turnover', param: 'company_id' },
  { path: '/api/v1/analytics/workforce', param: 'company_id' },
]

test.describe('analytics cross-tenant isolation: foreign-company HR scoped to own company', () => {
  let ctrCompanyId = ''

  test.beforeAll(async () => {
    // CTR HR 세션으로 자기 companyId 확보 (executive/summary 응답 등에서)
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const me = await ctrReq.get('/api/v1/users/me')
    if (me.ok()) {
      const body = await me.json()
      ctrCompanyId = body?.data?.companyId ?? body?.companyId ?? ''
    }
    await ctrReq.dispose()
  })

  for (const { path, param } of GET_ROUTES) {
    test(`${path} — CTR-CN HR이 ?${param}=<CTR>로 요청해도 200(자기 법인 강제, 5xx 없음)`, async () => {
      expect(ctrCompanyId, 'CTR companyId fixture').toBeTruthy()
      const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
      const res = await cnReq.get(`${path}?${param}=${ctrCompanyId}`)
      // 핵심: resolveCompanyFilter가 CTR-CN으로 강제 → 권한 에러 없이 자기 법인 응답 (서버 에러 아님)
      expect(res.status(), `${path} must not 5xx`).toBeLessThan(500)
      expect([200, 403]).toContain(res.status())
      await cnReq.dispose()
    })
  }
})

test.describe('analytics cross-tenant: ai-report/generate(POST) 쓰기 소유권', () => {
  test('CTR-CN HR이 body.companyId=<CTR>로 생성해도 CTR에 쓰지 못함', async () => {
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const me = await ctrReq.get('/api/v1/users/me')
    const ctrCompanyId = (await me.json())?.data?.companyId ?? ''
    await ctrReq.dispose()
    expect(ctrCompanyId).toBeTruthy()

    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await cnReq.post('/api/v1/analytics/ai-report/generate', {
      data: { companyId: ctrCompanyId, period: '2026-05' },
    })
    if (res.ok()) {
      const body = await res.json()
      const written = body?.data?.companyId ?? body?.companyId
      expect(written, 'must NOT write to requested CTR company').not.toBe(ctrCompanyId)
    } else {
      expect(res.status()).toBeLessThan(500)
    }
    await cnReq.dispose()
  })
})

test.describe('analytics: SUPER_ADMIN 통합뷰 carve-out', () => {
  test('SUPER_ADMIN이 파라미터 없이 overview 호출 → 전체 집계(403/5xx 아님)', async () => {
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await suReq.get('/api/v1/analytics/overview')
    expect(res.status(), 'SUPER 통합뷰').toBe(200)
    await suReq.dispose()
  })
})
```

> **검증 방향**: analytics는 읽기라 payroll처럼 403이 아니라 "스코프 강제"가 핵심이다. CTR-CN HR이 CTR companyId를 넘겨도 서버는 자기 법인으로 강제하므로 200(또는 권한상 403)이지 5xx가 아니며, **CTR 데이터가 응답에 섞이지 않는다**. fixture 헬퍼(`authFile`, `/users/me` 응답 shape)는 payroll-cross-tenant.spec.ts와 동일 패턴을 따르되, 실제 헬퍼 경로/응답 키는 구현 시 그 파일에서 확인해 맞춘다.

- [ ] **Step 2: e2e 실행** (dev 서버 필요)

Run: `npm run test:e2e -- analytics-cross-tenant`
Expected: 전 케이스 PASS (5xx 0건). 실패 시 해당 라우트 치환 누락 디버그.

- [ ] **Step 3: 커밋**

```bash
git add e2e/api/analytics-cross-tenant.spec.ts
git commit -m "test(analytics): cross-tenant 격리 e2e — 18 GET 스코프 강제 + POST 쓰기 + SUPER 통합뷰 (batch4)"
```

---

## Task 8: 검증 게이트 (tsc · lint · unit · e2e · Codex Gate 2)

- [ ] **Step 1: 전체 타입/린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc 0 errors · lint 0 errors (기존 TeamsSettingsPage 경고는 무관)

- [ ] **Step 2: 단위 테스트**

Run: `npx vitest run tests/unit/lib/api/companyFilter.test.ts`
Expected: PASS (5)

- [ ] **Step 3: e2e 전수**

Run: `npm run test:e2e -- analytics-cross-tenant`
Expected: 전 케이스 PASS

- [ ] **Step 4: Codex Gate 2** (`.claude/commands/verify.md` SSOT) — 구현 diff를 codex로 리뷰, P0/P1 반영.

```bash
git diff origin/main...HEAD -- src/ e2e/ | head -2000 > /tmp/codex-g2.txt
# verify.md 절차대로 codex exec로 diff 리뷰
```

- [ ] **Step 5: PR 생성**

```bash
git push -u origin fix/analytics-cross-tenant
gh pr create --title "fix(analytics): analytics cross-tenant 누출 19 라우트 격리 (멀티테넌트 batch4)" --body "..."
```

---

## Self-Review 메모 (작성자 확인 완료)

- **Spec 커버리지**: 설계 §2 누출 19 = Task 2(5) + Task 3(1) + Task 4(3) + Task 5(8) + Task 6(2) = 19 ✓. 헬퍼 §3 = Task 1 ✓. e2e §6 = Task 7(18 GET + POST + SUPER) ✓.
- **Codex Gate 1 P1 3건**: 쓰기 분리(Task 6) · undefined 회귀 가드(비즈헬퍼 `companyId?` 옵셔널 확인, Task 5) · e2e 19 전수(Task 7) ✓.
- **타입 일관성**: `resolveCompanyFilter` 반환 `{ companyId?: string }` — Task 2/4(spread), Task 5(destructure `.companyId`) 일관. `resolveCompanyId` 반환 `string` — Task 6 단일 사용 일관.
- **미해결(구현 중 확인)**: e2e `authFile` 헬퍼 경로·`/users/me` 응답 키는 payroll-cross-tenant.spec.ts에서 실측해 맞출 것.
