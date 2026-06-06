# onboarding/leave/training cross-tenant 격리 Implementation Plan

> **For agentic workers:** 멀티테넌트 remediation 우선순위4. #129/#130/#131/#132 선례 패턴 재사용. Codex Gate 1 (2026-06-06, codex 0.136.0) Request Changes → P0 9 + P1 3 전부 반영(아래). Steps use `- [ ]`.

**Goal:** onboarding/leave/training API의 cross-tenant companyId 누출(파괴적 쓰기 · raw companyId 읽기/쓰기 · HR·관계 경로 법인 무결합 · FK 신뢰)을 전면 차단.

**Architecture:** verify-first로 후보 라우트를 전수 분류(GUARDED/LEAK) 후, 6개 가드 패턴을 적용. 글로벌(null) 쓰기 SUPER-only. onboarding은 비-SUPER 전 경로를 sameCompany로 결합. crossboarding은 비-SUPER 전면 차단(임시; 완전 HQ계층은 stage2). #129/#130 미러 e2e(상태변경 결과까지 검증).

**Tech Stack:** Next.js route handlers, Prisma, `withPermission`/`withAuth`, `resolveCompanyId`, Playwright e2e.

---

## 핵심 사실 (코드 확인)
- `resolveCompanyId(user, req?): string` — **null 반환 안 함**. SUPER+truthy→req, 그 외→`user.companyId`. → 글로벌 생성엔 부적합 → create는 명시 ternary.
- `LeaveTypeDef.companyId`·`MandatoryTrainingConfig.companyId` nullable(NULL=전사 공통, 의도된 글로벌).
- **`EmployeeOnboarding.companyId` null = 글로벌 아님 = 레거시/미완 데이터** (글로벌 의미는 `OnboardingTemplate`). → onboarding은 robust resolver로 직원 법인 유도.
- `LeaveAccrualRule`·`EmployeeOnboardingTask` companyId 없음 → 부모로 가드.
- `ROLE` from `@/lib/constants`.

## Codex Gate 1 반영 요지 (P0/P1)
- crossboarding fromCompany-only 부족 → **비-SUPER 전면 차단**(CEO 승인).
- 범위 밖 읽기 누출: `leave/type-defs` GET·`leave/designated-days` GET·`training/mandatory-status` GET·`training/recommendations` GET.
- 범위 밖 쓰기 누출: `leave/requests/[id]/cancel`·`leave/bulk-grant`·`training/enrollments` POST·`onboarding/plans` POST·`onboarding/[id]/force-complete`.
- FK 신뢰: mandatory-config `courseId`, leave request `policyId/leaveTypeDefId` 동일법인/글로벌 검증.
- P3는 HR 분기만으론 부족 → **비-SUPER 전 경로 sameCompany 결합**(stale 매니저·타법인 buddy 차단).
- pre-hire: `fetchPrimaryAssignment`(active-only)는 미래발령 온보딩을 null화 → robust resolver(active→any primary).
- e2e: 응답코드뿐 아니라 타 법인 레코드 불변·생성물 실제 companyId·FK 미연결 검증, 전용 레코드 생성/정리.

---

## Patterns (exact code)

### P1w — Class 1 파괴적 쓰기 (leave/type-defs/[id] PUT·DELETE, accrual-rules PUT(부모), training/mandatory-config/[id] PATCH·DELETE)
```ts
const writeFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }
const existing = await prisma.<model>.findFirst({ where: { id, ...writeFilter } })
if (!existing) throw notFound('<msg>')   // 오라클 없음
// update/delete by { id } 그대로
```

### P1r — Class 1 읽기 스코프 (leave/type-defs GET list & [id] GET, accrual-rules GET, designated-days GET, mandatory-status GET)
```ts
// detail
const readFilter = user.role === ROLE.SUPER_ADMIN ? {} : { OR: [{ companyId: user.companyId }, { companyId: null }] }
const row = await prisma.<model>.findFirst({ where: { id, ...readFilter } }); if (!row) throw notFound('<msg>')
// list: resolveCompanyFilter로 where 구성 (SUPER 지정/전체, 비-SUPER 자기법인+글로벌). 단 비-SUPER가 임의 companyId 파라미터로 타법인 못 보게.
```

### P2r — resolveCompanyId (필수 회사: leave/accrual POST, training/mandatory-config/enroll POST)
```ts
import { resolveCompanyId } from '@/lib/api/companyFilter'
const companyId = resolveCompanyId(user, parsed.data.companyId ?? null)
```

### P2c — create 글로벌 가능 (leave/type-defs POST, training/mandatory-config POST)
```ts
const companyId = user.role === ROLE.SUPER_ADMIN ? (parsed.data.companyId ?? null) : user.companyId
// 중복체크 where·create data 모두 이 companyId 사용 (raw body 금지)
```

### P-FK — 참조 FK 소유권 (mandatory-config courseId, leave request policyId/leaveTypeDefId, enrollments courseId, bulk-grant policyId)
```ts
const ref = await prisma.<refModel>.findFirst({ where: { id: refId, OR: [{ companyId }, { companyId: null }] } })
if (!ref) throw badRequest('유효하지 않은 참조입니다.')
```

### P-emp — 직원 소유권 (employeeIds/employeeId가 본인 법인인지: bulk-grant, enrollments POST, onboarding/plans POST, recommendations GET, crossboarding)
```ts
// 단건
const emp = await prisma.employeeAssignment.findFirst({ where: { employeeId, companyId: user.companyId, isPrimary: true } })
if (user.role !== ROLE.SUPER_ADMIN && !emp) throw forbidden('타 법인 직원입니다.')
// 배치: employeeIds 중 user.companyId 소속만 통과 (count 일치 검사)
```

### P-cross — crossboarding 비-SUPER 차단 (임시)
```ts
if (user.role !== ROLE.SUPER_ADMIN) {
  throw forbidden('크로스보딩은 현재 SUPER_ADMIN만 실행할 수 있습니다. (법인 간 이동 권한은 준비 중)')
}
```

### P3 — onboarding 전 경로 sameCompany 결합 (instances/[id] GET·sign-off·sign-off-summary·tasks status/block/unblock·tasks/[id]/complete·force-complete)
신규 `src/lib/onboarding/tenant-guard.ts`:
```ts
import { prisma } from '@/lib/prisma'

/** 온보딩 소속 법인 — companyId(레거시 null 가능)이면 직원 primary assignment로 fallback(active→any, pre-hire 안전) */
export async function resolveOnboardingCompanyId(o: { companyId: string | null; employeeId: string }): Promise<string | null> {
  if (o.companyId) return o.companyId
  const active = await prisma.employeeAssignment.findFirst({
    where: { employeeId: o.employeeId, isPrimary: true, endDate: null },
    orderBy: { effectiveDate: 'desc' }, select: { companyId: true },
  })
  if (active) return active.companyId
  const anyPrimary = await prisma.employeeAssignment.findFirst({
    where: { employeeId: o.employeeId, isPrimary: true },
    orderBy: { effectiveDate: 'desc' }, select: { companyId: true },
  })
  return anyPrimary?.companyId ?? null
}
```
각 라우트 게이트(관계+HR 전부 법인 결합):
```ts
import { resolveOnboardingCompanyId } from '@/lib/onboarding/tenant-guard'
const onboardingCompanyId = await resolveOnboardingCompanyId({ companyId: <o>.companyId, employeeId: <o>.employeeId })
const isSuperAdmin = user.role === ROLE.SUPER_ADMIN
const sameCompany = onboardingCompanyId != null && onboardingCompanyId === user.companyId
if (!isSuperAdmin) {
  if (!sameCompany) throw forbidden('<기존 메시지>')
  if (!isEmployee && !isManager && !isAssignee && !isHrAdmin) throw forbidden('<기존 메시지>')
}
```
- block/unblock: fetch include에 `employeeOnboarding: { select: { companyId: true, employeeId: true } }` 추가.
- complete(withAuth): `isOwner || isHr` → 위 게이트(isOwner=isEmployee).
- force-complete: 현재 assignment 판정 제거 → resolveOnboardingCompanyId 기반 sameCompany.

---

## Scope — 후보 라우트 (verify-first: 각 라우트 읽고 GUARDED/LEAK 분류 후 패턴 적용; codex 오탐 가능 — leak-hunt 53 오탐 전력)

**LEAVE**: type-defs(GET P1r·POST P2c) · type-defs/[id](GET P1r·PUT/DELETE P1w) · type-defs/[id]/accrual-rules(GET P1r·PUT P1w 부모) · accrual(POST P2r) · designated-days(GET P1r) · designated-days/[id](DELETE P1w) · bulk-grant(POST P-emp+P-FK) · requests/[id]/cancel(PUT P1w) · requests/[id]/approve·reject(PUT verify) · requests(POST P-FK) · policies(POST verify)

**TRAINING**: mandatory-config(POST P2c+P-FK courseId) · mandatory-config/[id](PATCH/DELETE P1w) · mandatory-config/enroll(POST P2r) · mandatory-status(GET P1r) · enrollments(POST P-emp+P-FK) · recommendations(GET P-emp)

**ONBOARDING**: crossboarding(POST P-cross) · plans(POST P-emp) · [id]/force-complete(PUT P3) · instances/[id](GET P3) · instances/[id]/sign-off(POST P3) · instances/[id]/sign-off-summary(GET P3) · instances/[id]/tasks/[taskId]/status(PUT P3) · …/block(POST P3) · …/unblock(POST P3) · tasks/[id]/complete(PUT P3)

**제외(검증 SAFE):** `leave/requests/[id]` GET(본인 한정). **범위 외:** HQ 계층 완전 정책 · settings 28 · RLS/MV.

---

## File Structure
- Create: `src/lib/onboarding/tenant-guard.ts`
- Create: `e2e/onboarding-leave-training-cross-tenant.spec.ts`
- Modify: 위 후보 중 LEAK 분류된 route.ts (~25)

## Tasks (subsystem 단위, TDD)

### Task 1: 헬퍼 + e2e 스캐폴드
- [ ] `e2e/payroll-cross-tenant.spec.ts` 읽어 로그인/구조 파악.
- [ ] `tenant-guard.ts` 작성(위 코드). `npx tsc --noEmit`.
- [ ] Commit: `feat(onboarding): resolveOnboardingCompanyId tenant 헬퍼 (batch5)`

### Task 2: LEAVE — verify+fix+e2e
- [ ] LEAVE 후보 전수 읽기 → GUARDED/LEAK 분류(하단 결과표 기록).
- [ ] e2e leave 케이스(실패) → 패턴 적용 → PASS. 상태검증 포함(타법인 레코드 불변·생성물 companyId).
- [ ] tsc+lint. Commit: `fix(leave): cross-tenant 격리 — type-defs/accrual/designated/bulk/requests (batch5)`

### Task 3: TRAINING — verify+fix+e2e
- [ ] TRAINING 후보 전수 분류 → 패턴 적용 + courseId/employee FK 검증.
- [ ] e2e training 케이스. tsc+lint. Commit: `fix(training): cross-tenant 격리 — mandatory-config/enrollments/recommendations (batch5)`

### Task 4: ONBOARDING — verify+fix+e2e
- [ ] crossboarding 차단 + plans/force-complete + instances/tasks P3 전 경로 게이트.
- [ ] e2e onboarding 케이스(HR 타법인 403·SUPER 200·동일법인 200·pre-hire HR 정상).
- [ ] tsc+lint. Commit: `fix(onboarding): cross-tenant 격리 — crossboarding 차단 + instance/task sameCompany 게이트 (batch5)`

### Task 5: 검증 게이트
- [ ] `npx tsc --noEmit`=0 · `npm run lint`=0(신규) · e2e 전체 실 dev 통과(타입/직렬 함정 S264).
- [ ] Codex Gate 2 (`/verify`) → P0/P1 반영.
- [ ] PR: `fix(multitenant): onboarding/leave/training cross-tenant 격리 (batch5)`.

## 분류 결과표 (구현 시 기록)
| 라우트 | 분류 | 적용 패턴 |
|---|---|---|
| (TBD) | | |
