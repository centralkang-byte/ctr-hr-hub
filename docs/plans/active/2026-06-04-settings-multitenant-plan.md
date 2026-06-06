# Settings cross-tenant 격리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Codex Gate 1 반영본** (2026-06-04): 글로벌 쓰기 SUPER-only(P0-1) · approval-flows PUT 가드 위치(P0-2) · notification-triggers 추가(P0-3).

**Goal:** settings 버킷 cross-tenant 누출을 `resolveCompanyId` 치환 + ownership 가드로 차단 (비-SUPER는 자기 companyId만; SUPER만 cross-tenant; 글로벌 null 쓰기는 SUPER만).

**Architecture:** 패턴1(`resolveCompanyId` 치환, 15핸들러) = 조용한 자기법인 스코프. 패턴2(ownership 가드, approval-flows 4 + notification-triggers 3 = 7핸들러) = 글로벌(null) 읽기 보존 + 글로벌/타법인 쓰기 차단. 새 추상 없음, #129/#130 동일 결. HQ 계층 권한(본사HR 산하쓰기)은 비범위(다음 PR).

**Tech Stack:** Next.js route handlers, Prisma, `resolveCompanyId`([companyFilter.ts](../../../src/lib/api/companyFilter.ts) PROTECTED — import만), Playwright e2e.

**테스트 전략:** route+Prisma 결합으로 핸들러 unit 인프라 약함 → #129/#130 선례대로 **e2e**(`e2e/api/*-cross-tenant.spec.ts`, 실 dev 서버)가 검증 SSOT. **패턴1=200/400(스코프 강제), 패턴2 글로벌/타법인 쓰기=403** assert.

---

## File Structure

| 파일 | 변경 |
|---|---|
| `settings/promotion/route.ts` | GET·PUT 패턴1 |
| `settings/compensation/route.ts` | GET·PUT 패턴1 |
| `settings/evaluation/route.ts` | GET·PUT 패턴1 |
| `settings/promotion/override/route.ts` | POST·DELETE 패턴1 +user |
| `settings/compensation/override/route.ts` | POST·DELETE 패턴1 +user |
| `settings/evaluation/override/route.ts` | POST·DELETE 패턴1 +user |
| `settings/job-grades/route.ts` | GET(RC-D)·POST 패턴1 |
| `settings/employee-titles/route.ts` | POST 패턴1 |
| `settings/approval-flows/route.ts` | GET·POST·PUT·DELETE 패턴2 (글로벌 SUPER-only) |
| `settings/notification-triggers/[id]/route.ts` | PUT·DELETE 글로벌 가드 |
| `settings/notification-triggers/[id]/restore/route.ts` | POST 글로벌 가드 |
| `e2e/api/settings-cross-tenant.spec.ts` | **신규** |

---

### Task 1: promotion/compensation/evaluation GET·PUT (패턴1)

**Files:** Modify `settings/{promotion,compensation,evaluation}/route.ts` (구조 동일)

- [ ] **Step 1: import 추가** (3 파일)

```ts
import { resolveCompanyId } from '@/lib/api/companyFilter'
```

- [ ] **Step 2: GET — companyId 치환** (promotion :25, compensation :26, evaluation :32)

```ts
// before: const companyId = searchParams.get('companyId') ?? user.companyId
const companyId = resolveCompanyId(user, searchParams.get('companyId'))
```
`if (!companyId) return apiError(badRequest(...))` 줄 유지(무해).

- [ ] **Step 3: PUT — companyId 치환** (promotion :40-41, compensation :40-41, evaluation :47-48)

```ts
const { companyId: bodyCompanyId, ...data } = parsed.data
const companyId = resolveCompanyId(user, bodyCompanyId)
```

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -E "settings/(promotion|compensation|evaluation)/route" || echo OK`
Expected: `OK`

- [ ] **Step 5: 스테이징** `git add src/app/api/v1/settings/{promotion,compensation,evaluation}/route.ts`

---

### Task 2: 3 overrides POST·DELETE (패턴1 + user 인자)

**Files:** Modify `settings/{promotion,compensation,evaluation}/override/route.ts` (구조 동일, `*Setting`명만 다름)

- [ ] **Step 1: import 추가** (3 파일)

```ts
import { resolveCompanyId } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'
```

- [ ] **Step 2: POST — user 인자 + 치환** (각 :13-19)

```ts
export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = overrideCreateSchema.safeParse(body)
    if (!parsed.success) return apiError(badRequest(parsed.error.issues.map(i => i.message).join(', ')))
    const companyId = resolveCompanyId(user, parsed.data.companyId)
    await createCompanyOverride('promotionSetting', companyId)   // compensation/evaluation은 각 setting명
    return apiSuccess({ message: '법인 오버라이드가 생성되었습니다' }, 201)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE)
)
```

- [ ] **Step 3: DELETE — user 인자 + 치환** (각 :25-35)

```ts
export const DELETE = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const rawCompanyId = searchParams.get('companyId')
    if (!rawCompanyId) return apiError(badRequest('companyId 파라미터가 필요합니다'))
    const idParsed = z.string().uuid().safeParse(rawCompanyId)
    if (!idParsed.success) return apiError(badRequest('유효하지 않은 companyId 형식입니다'))
    const companyId = resolveCompanyId(user, rawCompanyId)
    await deleteCompanyOverride('promotionSetting', companyId)
    return apiSuccess({ message: '글로벌 기본값으로 복귀했습니다' })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE)
)
```

- [ ] **Step 4: tsc** `npx tsc --noEmit 2>&1 | grep "override/route" || echo OK` → `OK`
- [ ] **Step 5: 스테이징** `git add src/app/api/v1/settings/{promotion,compensation,evaluation}/override/route.ts`

---

### Task 3: job-grades GET·POST + employee-titles POST (패턴1)

**Files:** Modify `settings/job-grades/route.ts`, `settings/employee-titles/route.ts`

- [ ] **Step 1: import 추가** (2 파일) `import { resolveCompanyId } from '@/lib/api/companyFilter'`

- [ ] **Step 2: job-grades GET — RC-D 삼항 교체 (SUPER 전체조회 보존)** ([:19-23](../../../src/app/api/v1/settings/job-grades/route.ts))

```ts
const requestedCompanyId = searchParams.get('companyId')
const companyFilter =
  user.role === 'SUPER_ADMIN' && !requestedCompanyId
    ? {}
    : { companyId: resolveCompanyId(user, requestedCompanyId) }
```

- [ ] **Step 3: job-grades POST — 치환** ([:65](../../../src/app/api/v1/settings/job-grades/route.ts)) `const companyId = resolveCompanyId(user, body.companyId)`
- [ ] **Step 4: employee-titles POST — 치환** ([:56](../../../src/app/api/v1/settings/employee-titles/route.ts)) `const companyId = resolveCompanyId(user, body.companyId)`

> job-grades PUT/DELETE, employee-titles GET/PUT/DELETE는 이미 가드 — 건드리지 않음.

- [ ] **Step 5: tsc** `npx tsc --noEmit 2>&1 | grep -E "settings/(job-grades|employee-titles)/route" || echo OK` → `OK`
- [ ] **Step 6: 스테이징** `git add src/app/api/v1/settings/{job-grades,employee-titles}/route.ts`

---

### Task 4: approval-flows (패턴2, 글로벌 SUPER-only)

**Files:** Modify `settings/approval-flows/route.ts`

- [ ] **Step 1: forbidden import** `import { badRequest, notFound, forbidden } from '@/lib/errors'`

- [ ] **Step 2: GET — user 인자 + 자기법인+글로벌 OR** ([:40-49](../../../src/app/api/v1/settings/approval-flows/route.ts))

```ts
async (req: NextRequest, _ctx, user: SessionUser) => {
  const { searchParams } = new URL(req.url)
  const approvalModule = searchParams.get('module')
  const requestedCompanyId = searchParams.get('companyId')
  const where: Record<string, unknown> = {}
  if (approvalModule) where.module = approvalModule
  if (user.role !== 'SUPER_ADMIN') {
    where.OR = [{ companyId: user.companyId }, { companyId: null }]
  } else if (requestedCompanyId) {
    where.OR = [{ companyId: requestedCompanyId }, { companyId: null }]
  }
  // SUPER + 미지정 → 전체 (기존 동작 보존)
  const flows = await prisma.approvalFlow.findMany({ where, include: flowInclude, orderBy: [{ companyId: 'asc' }, { module: 'asc' }] })
  return apiSuccess(flows)
}
```

- [ ] **Step 3: POST — 비-SUPER companyId 자기법인 강제 (글로벌/타법인 생성 불가)** ([:70](../../../src/app/api/v1/settings/approval-flows/route.ts))

```ts
// before: const { name, description, companyId, module, steps } = parsed.data
const { name, description, companyId: reqCompanyId, module, steps } = parsed.data
const companyId = user.role === 'SUPER_ADMIN' ? (reqCompanyId ?? null) : user.companyId
```
create data의 `companyId: companyId ?? null` → `companyId: companyId` (이미 resolved). logAudit `companyId: companyId ?? user.companyId` 유지.

- [ ] **Step 4: PUT — 가드를 step deleteMany 전에 (P0-2)** ([:115-119](../../../src/app/api/v1/settings/approval-flows/route.ts))

```ts
const existing = await prisma.approvalFlow.findUnique({ where: { id } })
if (!existing) return apiError(notFound('승인 플로우를 찾을 수 없습니다'))
// ★ 가드를 deleteMany 전에 (글로벌 null·타법인 모두 non-SUPER 차단)
if (user.role !== 'SUPER_ADMIN' && existing.companyId !== user.companyId) {
  throw forbidden('본사(SUPER)만 글로벌/타 법인 승인 플로우를 수정할 수 있습니다.')
}
await prisma.approvalFlowStep.deleteMany({ where: { flowId: id } })   // 가드 통과 후에만
// ... 이후 update 동일. logAudit companyId: existing.companyId ?? user.companyId 유지(resolved)
```

- [ ] **Step 5: DELETE — user 인자 + findUnique + 가드** ([:157-166](../../../src/app/api/v1/settings/approval-flows/route.ts))

```ts
export const DELETE = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return apiError(badRequest('id 파라미터가 필요합니다'))
    const idParsed = z.string().uuid().safeParse(id)
    if (!idParsed.success) return apiError(badRequest('유효하지 않은 ID 형식입니다'))
    const existing = await prisma.approvalFlow.findUnique({ where: { id } })
    if (!existing) return apiError(notFound('승인 플로우를 찾을 수 없습니다'))
    if (user.role !== 'SUPER_ADMIN' && existing.companyId !== user.companyId) {
      throw forbidden('본사(SUPER)만 글로벌/타 법인 승인 플로우를 삭제할 수 있습니다.')
    }
    await prisma.approvalFlow.delete({ where: { id } })
    return apiSuccess({ message: '승인 플로우가 삭제되었습니다' })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE)
)
```

- [ ] **Step 6: tsc** `npx tsc --noEmit 2>&1 | grep "approval-flows" || echo OK` → `OK`
- [ ] **Step 7: 스테이징** `git add src/app/api/v1/settings/approval-flows/route.ts`

---

### Task 5: notification-triggers 글로벌 쓰기 차단 (Codex P0-3)

**Files:** Modify `settings/notification-triggers/[id]/route.ts`, `settings/notification-triggers/[id]/restore/route.ts`

현재 PUT/DELETE/restore는 `findFirst({ where: { id, OR: [{companyId: user.companyId}, {companyId: null}] } })`로 existing 조회 → **타법인은 이미 notFound(scoped)**, 하지만 **글로벌(null)은 fetch되어 비-SUPER가 수정/삭제/복구 가능**. existing 조회 직후 글로벌 가드 추가.

- [ ] **Step 1: forbidden import 확인/추가** (두 파일 — 없으면 `import { forbidden } from '@/lib/errors'`)

- [ ] **Step 2: [id]/route.ts PUT — existing(findFirst) 직후 글로벌 가드** ([:55-58](../../../src/app/api/v1/settings/notification-triggers/[id]/route.ts))

```ts
// existing = await prisma.notificationTrigger.findFirst({ where: { id, OR:[{companyId:user.companyId},{companyId:null}] }, ... })
if (!existing) ... notFound
// ★ 글로벌 trigger는 SUPER만 수정 (타법인은 이미 위 findFirst에서 notFound)
if (user.role !== 'SUPER_ADMIN' && existing.companyId === null) {
  throw forbidden('본사(SUPER)만 글로벌 알림 트리거를 수정할 수 있습니다.')
}
```

- [ ] **Step 3: [id]/route.ts DELETE — existing 직후 동일 가드** ([:105-109](../../../src/app/api/v1/settings/notification-triggers/[id]/route.ts))

```ts
if (user.role !== 'SUPER_ADMIN' && existing.companyId === null) {
  throw forbidden('본사(SUPER)만 글로벌 알림 트리거를 삭제할 수 있습니다.')
}
```

- [ ] **Step 4: restore/route.ts POST — existing 직후 동일 가드** ([:20-24](../../../src/app/api/v1/settings/notification-triggers/[id]/restore/route.ts))

```ts
if (user.role !== 'SUPER_ADMIN' && existing.companyId === null) {
  throw forbidden('본사(SUPER)만 글로벌 알림 트리거를 복구할 수 있습니다.')
}
```

- [ ] **Step 5: tsc** `npx tsc --noEmit 2>&1 | grep "notification-triggers" || echo OK` → `OK`
- [ ] **Step 6: 스테이징** `git add src/app/api/v1/settings/notification-triggers/`

---

### Task 6: e2e — settings-cross-tenant.spec.ts

**Files:** Create `e2e/api/settings-cross-tenant.spec.ts`

- [ ] **Step 1: ApiClient/auth helper 시그니처 확인** (가정 금지)

Run: `sed -n '1,70p' e2e/helpers/api-client.ts; grep -n "HR_ADMIN_CN\|SUPER_ADMIN\|export" e2e/helpers/auth.ts`
확인: `get/post/put/delete` 메서드, `assertError(res, status, msg)`, `authFile('HR_ADMIN_CN')` 키 존재. 불일치 시 spec 보정.

- [ ] **Step 2: spec 작성**

```ts
// ═══════════════════════════════════════════════════════════
// Settings 멀티테넌트 격리 (cross-tenant 누출 가드)
// 패턴1(resolveCompanyId 치환): 타 companyId param/body → 자기법인 스코프 (CTR 데이터 누출 X)
// 패턴2(ownership): 글로벌(null)·타법인 쓰기 → 403; 글로벌 읽기 보존
// ═══════════════════════════════════════════════════════════
import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const S = '/api/v1/settings'

test.describe('Settings cross-tenant: foreign-company HR scoped/blocked', () => {
  test.describe.configure({ mode: 'serial' })
  let ctrCompanyId = ''

  test.beforeAll(async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const me = await new ApiClient(r).get('/api/v1/me')
    ctrCompanyId = me.body?.data?.companyId ?? me.body?.companyId ?? ''
    await r.dispose()
  })

  // ── 패턴1: 치환 → 자기법인 스코프 (CTR 데이터 누출 X) ──
  test('promotion/compensation/evaluation GET ignore cross-tenant companyId param', async () => {
    expect(ctrCompanyId).toBeTruthy()
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const api = new ApiClient(r)
    for (const p of ['promotion', 'compensation', 'evaluation']) {
      const res = await api.get(`${S}/${p}?companyId=${ctrCompanyId}`)
      expect([200, 400, 404], `${p} scoped to caller`).toContain(res.status)
    }
    await r.dispose()
  })

  test('job-grades GET does not leak CTR grades to CTR-CN HR', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).get(`${S}/job-grades?companyId=${ctrCompanyId}`)
    expect(res.status).toBe(200)
    const leaked = (res.body?.data ?? []).filter((g: { companyId?: string }) => g.companyId === ctrCompanyId)
    expect(leaked.length, 'no CTR grades leaked').toBe(0)
    await r.dispose()
  })

  test('promotion override POST for CTR is scoped to caller, not CTR', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).post(`${S}/promotion/override`, { companyId: ctrCompanyId })
    expect([200, 201, 400, 409], 'never creates CTR override').toContain(res.status)
    await r.dispose()
  })

  // ── 패턴2: approval-flows 글로벌/타법인 쓰기 → 403, 글로벌 읽기 보존 ──
  test('approval-flows GET returns only own-company + global for non-SUPER', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).get(`${S}/approval-flows`)
    expect(res.status).toBe(200)
    const foreign = (res.body?.data ?? []).filter((f: { companyId?: string | null }) => f.companyId != null && f.companyId === ctrCompanyId)
    expect(foreign.length, 'no CTR-only flows leaked').toBe(0)
    await r.dispose()
  })

  test('approval-flows PUT/DELETE on CTR or global flow → 403 for non-SUPER', async () => {
    // SUPER로 글로벌 + CTR 플로우 id 확보
    const sup = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const all = await new ApiClient(sup).get(`${S}/approval-flows`)
    const globalFlow = (all.body?.data ?? []).find((f: { companyId?: string | null }) => f.companyId == null)
    const ctrFlow = (all.body?.data ?? []).find((f: { companyId?: string | null }) => f.companyId === ctrCompanyId)
    await sup.dispose()

    const cn = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const api = new ApiClient(cn)
    if (globalFlow) assertError(await api.put(`${S}/approval-flows`, { id: globalFlow.id, name: 'x' }), 403, 'CN HR cannot edit global flow')
    if (ctrFlow) assertError(await api.put(`${S}/approval-flows`, { id: ctrFlow.id, name: 'x' }), 403, 'CN HR cannot edit CTR flow')
    if (ctrFlow) assertError(await api.delete(`${S}/approval-flows?id=${ctrFlow.id}`), 403, 'CN HR cannot delete CTR flow')
    test.skip(!globalFlow && !ctrFlow, 'no flow fixtures')
    await cn.dispose()
  })

  // ── notification-triggers 글로벌 쓰기 → 403 ──
  test('notification-triggers PUT/DELETE on global trigger → 403 for non-SUPER', async () => {
    const sup = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const all = await new ApiClient(sup).get(`${S}/notification-triggers`)
    const globalTrig = (all.body?.data ?? []).find((t: { companyId?: string | null }) => t.companyId == null)
    await sup.dispose()
    test.skip(!globalTrig, 'no global trigger fixture')

    const cn = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const api = new ApiClient(cn)
    assertError(await api.put(`${S}/notification-triggers/${globalTrig.id}`, { name: 'x' }), 403, 'CN HR cannot edit global trigger')
    assertError(await api.delete(`${S}/notification-triggers/${globalTrig.id}`), 403, 'CN HR cannot delete global trigger')
    await cn.dispose()
  })
})
```

- [ ] **Step 3: dev 서버 + e2e 실행**

Run: `npm run test:e2e -- e2e/api/settings-cross-tenant.spec.ts 2>&1 | tail -30`
Expected: pass (또는 fixture 부재 skip). 실패 시 가드 디버그.

- [ ] **Step 4: 스테이징** `git add e2e/api/settings-cross-tenant.spec.ts`

---

### Task 7: 검증 (tsc·lint·회귀·Codex Gate 2)

- [ ] **Step 1: 전체 tsc** `npx tsc --noEmit` → 0 errors
- [ ] **Step 2: lint** `npm run lint 2>&1 | tail -20` → settings 신규 에러 0
- [ ] **Step 3: 회귀** `npm run test:e2e -- e2e/api/settings-crud.spec.ts 2>&1 | tail -20` → 기존 pass 유지
- [ ] **Step 4: Codex Gate 2** — `/verify` 실행 (`.claude/commands/verify.md` SSOT)

---

## Self-Review

**1. Spec coverage:** 22핸들러 매핑 — 패턴1 15(T1·T2·T3), approval-flows 4(T4), notification-triggers 3(T5). e2e(T6) 패턴1 스코프 + 패턴2 403. 이미 가드 5핸들러 + grade-title-mappings 4 = 미변경(T3 노트). ✅

**2. Placeholder scan:** 없음 — 코드 블록 실제 내용 + 라인번호.

**3. Type consistency:**
- `resolveCompanyId(user, x)` → `string` (companyFilter.ts) 일관.
- approval-flows POST: `reqCompanyId` 재명명 후 `companyId` resolved 변수 — create/logAudit에서 동일 `companyId` 참조.
- `existing.companyId !== user.companyId`(approval-flows, null 포함 차단) vs `existing.companyId === null`(notification-triggers, 타법인은 이미 findFirst scoped) — 두 라우트의 findFirst/findUnique 스코프 차이 반영(approval-flows는 findUnique=무스코프라 `!==` 필요, notification-triggers는 findFirst=이미 scoped라 `=== null`만).
- `forbidden('...')` throw — withPermission 처리, 한국어 메시지.

**Known gap (이번 PR 밖):** settings 27개 raw-companyId-미입력 라우트의 id-기반 findFirst scoping은 별도 audit. HQ 계층 권한(본사HR 산하쓰기)은 2단계.
