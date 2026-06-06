# 기타(misc) cross-tenant 격리 Implementation Plan (batch6)

> **For agentic workers:** 멀티테넌트 remediation의 "기타" 버킷(어떤 subsystem 배치에도 안 묶인 고아 라우트). #129~#133 선례 패턴 재사용. verify-first로 12 후보 분류 + **Codex Gate 1**(2026-06-06, codex 0.136.0) Request Changes 전부 반영(아래 "Codex Gate 1 반영"). 순 대상 = **13 라우트**(12 + entity-transfers POST). Steps use `- [ ]`.

**Goal:** remediation "기타" P0 라우트의 cross-tenant companyId 누출(파괴적 쓰기 · PII 읽기 · raw param 신뢰 · `_user` 무시)을 전면 차단. 급여·settings·analytics·onboarding/leave/training에 이은 멀티테넌트 격리 마지막 route-level 배치.

**Architecture:** verify-first 전수 분류 + Codex G1 후 4개 가드 패턴 적용. 직접 `companyId` 컬럼 보유 리소스는 **scoped-find → notFound**(오라클 차단). companyId 없는 리소스는 소유 관계(`benefitPlan.companyId`·`employee.assignments`)로 가드. list는 **`resolveCompanyFilter`**(SUPER 전체뷰 보존) 또는 `resolveCompanyId`(단일-default 보존)를 라우트별 기존 SUPER 의미에 맞춰 선택. `_user` 무시(RC-A)는 user 도달 + 대상 스코프. entity-transfers는 코드가 이미 from/to HR **co-approval**이라(execute만 무가드) execute=출발법인 가드 + POST create=source 소유 가드.

**Tech Stack:** Next.js route handlers, Prisma, `withPermission`, `resolveCompanyId`/`resolveCompanyFilter`(SSOT), `verifyCrossCompanyAccess`, Playwright e2e.

---

## 핵심 사실 (schema/코드/Codex G1 확인)

- `resolveCompanyId(user, req?): string` — null 안 냄. SUPER+truthy→param, 그 외→`user.companyId`. **SUPER no-param→user.companyId**(전체조회 X).
- `resolveCompanyFilter(user, req?): { companyId? }` — 비-SUPER→`{companyId: user.companyId}`(fail-closed), **SUPER no-param→`{}`(전체)**, SUPER+param→`{companyId: param}`. list 전체뷰 보존용(#132).
- **라우트별 기존 SUPER 의미 보존**(Codex P1-6): `directory`·`departments`·`job-grades` 현재 SUPER no-param=**전체** → `resolveCompanyFilter`. `grade-title-mappings` 현재 `?? user.companyId`=**단일** → `resolveCompanyId`. `ai/executive-report` 현재 `__GROUP_ALL__`(undefined)=**그룹전체** → 명시 ternary(`SUPER ? body.company_id ?? undefined : user.companyId`).
- 직접 `companyId`: `EmployeeDocument`·`CertificateRequest`(non-null) · `Department`·`JobGrade`·`GradeTitleMapping`(non-null=전역행 없음).
- `WorkHourAlert` companyId 없음 → `employee` 관계. `BenefitClaim` companyId 없음 → **`benefitPlan.companyId`(nullable!)** 가 소유 회사; null(글로벌 플랜)이면 직원 현재회사로 폴백.
- `EntityTransfer.fromCompanyId`/`toCompanyId`. **코드=from/to HR co-approval**(`[id]/approve` 80-97줄 단계별 회사 가드 존재, `[id]` GET·list GET 스코프됨). **`execute`만 무가드**(누출). `POST` create는 `fromCompanyId`를 직원에서 유도하나 source 소유 미검증.
- ⚠️ **매뉴얼 드리프트**: `docs/manuals/employee.md §11.5`는 ENTITY_TRANSFER=SUPER 전용이라 기술하나 **코드는 co-approval로 진화**(stale). 본 배치는 코드(co-approval) 기준 → execute=출발법인 가드(CEO 결정과 일치). 매뉴얼 갱신은 별 follow-up.
- `severance` 헬퍼 `calculateSeveranceInterim(employeeId)`(`kr.ts:225`)는 companyId 없이 최신 comp 조회. **라우트 가드를 최신 primary assignment 회사 === user.companyId로 조이면**(=`some` 금지) 현 법인 HR만 도달 → 그들에겐 최신 comp가 정답이라 **헬퍼 미수정**(접근게이트=보안경계). 전 법인 HR은 게이트서 notFound.
- `verifyCrossCompanyAccess(ctx, targetEmployeeId): {allowed}` — MANAGER+ dotted-line 읽기 허용(readonly). peer-review 회귀 방지에 사용.
- `ROLE` from `@/lib/constants`. 에러 팩토리 from `@/lib/errors`.

## 오라클/가드순서 원칙 (#130)

- 읽기·by-id: where에 companyId/소유관계 결합 → `findFirst` → 못 찾으면 `notFound`(존재여부 누출 차단). `forbidden` 금지.
- 파괴적 쓰기: 소유 가드를 상태/검증 체크 **앞**에.
- SUPER_ADMIN 전 법인: `user.role === ROLE.SUPER_ADMIN ? {} : { <scope> }`.

---

## Patterns (exact code)

### P1d — 직접 companyId, by-id (scoped-find → notFound)
대상: `documents/[docId]/download` GET · `certificate-requests/[requestId]/approve` POST
```ts
const scope = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }
const doc = await prisma.employeeDocument.findFirst({ where: { id: docId, employeeId: id, deletedAt: null, ...scope } })
if (!doc) throw notFound('문서를 찾을 수 없습니다.')
// certificate: certRequest findFirst where에 ...scope (employee/S3 로직 앞). 기존 employeeId 조건 유지.
```

### P1rel — companyId 없음, 소유 관계 가드
대상: `work-hour-alerts/[id]` PATCH(employee 관계) · `benefit-claims/[id]` GET·PATCH(benefitPlan 소유)
```ts
// work-hour-alerts PATCH: findUnique→findFirst(현재 primary assignment 관계)
const scope = user.role === ROLE.SUPER_ADMIN ? {}
  : { employee: { assignments: { some: { isPrimary: true, endDate: null, companyId: user.companyId } } } }
const alert = await prisma.workHourAlert.findFirst({ where: { id, ...scope } })
if (!alert) throw notFound('경고 기록을 찾을 수 없습니다.')
// benefit-claims GET·PATCH: 소유=benefitPlan.companyId ?? 직원 현재회사. self-service 보존.
const claim = await prisma.benefitClaim.findUnique({
  where: { id },
  include: { benefitPlan: { select: { companyId: true } },
             employee: { select: { assignments: { where: { isPrimary: true, endDate: null }, take: 1, select: { companyId: true } } } } },
})
if (!claim) throw notFound('청구 내역을 찾을 수 없습니다.')
const ownerCompany = claim.benefitPlan.companyId ?? claim.employee.assignments[0]?.companyId
const isSelf = claim.employeeId === user.employeeId
const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
const sameCompany = user.role === ROLE.SUPER_ADMIN || ownerCompany === user.companyId
// GET: self 허용; 아니면 HR & sameCompany. PATCH(approve/reject): HR & sameCompany 필수.
if (!isSelf && (!isHR || !sameCompany)) throw forbidden()   // PATCH는 self 분기 없음
```

### P2 — list/param (라우트별 filter 선택)
대상: `directory`·`departments`·`job-grades`(resolveCompanyFilter) · `grade-title-mappings`(resolveCompanyId) · `ai/executive-report`(ternary)
```ts
// directory/departments/job-grades: SUPER 전체뷰 보존
const filter = resolveCompanyFilter(user, searchParams.get('companyId'))  // { companyId? }
// directory: assignmentFilter = { ...assignmentFilter, ...filter } (기존 param-override 분기 제거)
// departments/job-grades: where = { deletedAt: null, ...filter }
// grade-title-mappings: 단일-default 보존
const companyId = resolveCompanyId(user, searchParams.get('companyId')); where.companyId = companyId
// ai/executive-report: group-all 보존
const companyId = user.role === ROLE.SUPER_ADMIN ? (body.company_id ?? undefined) : user.companyId
generateExecutiveReport(companyId, user)
```

### P3 — RC-A 교정 (`_user`→user + 대상 스코프)
대상: `severance-interim/calculate` GET · `peer-review/candidates` GET
```ts
// severance: 최신 primary assignment 회사로 가드(some 금지 — 과거소속 통과 방지)
const emp = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId },
  select: { assignments: { where: { isPrimary: true }, orderBy: { effectiveDate: 'desc' }, take: 1, select: { companyId: true } } } })
const empCompany = emp?.assignments[0]?.companyId
if (!emp || (user.role !== ROLE.SUPER_ADMIN && empCompany !== user.companyId)) throw notFound('직원을 찾을 수 없습니다.')
const result = await calculateSeveranceInterim(parsed.data.employeeId)  // 헬퍼 미수정(게이트=경계)
// peer-review: 대상 회사 확인 후 own-company OR cross-company-access(dotted-line 보존)
const targetAsgn = await prisma.employeeAssignment.findFirst({ where: { employeeId, isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } }, select: { companyId: true } })
if (!targetAsgn) throw notFound('직원 발령 정보를 찾을 수 없습니다.')
if (user.role !== ROLE.SUPER_ADMIN && targetAsgn.companyId !== user.companyId) {
  const { allowed } = await verifyCrossCompanyAccess({ callerRole: user.role, callerEmployeeId: user.employeeId, callerCompanyId: user.companyId }, employeeId)
  if (!allowed) throw notFound('직원 발령 정보를 찾을 수 없습니다.')
}
// 이후 employeeAssignment.companyId 대신 targetAsgn.companyId 사용
```
> ctx 필드는 `CrossCompanyContext`(cross-company-access.ts:24) 실제 정의에 맞춰 impl 시 확정.

### P4 — entity-transfers (co-approval, execute=출발법인 + POST=source 소유)
```ts
// [id]/execute PUT: fromCompany 가드 — status 체크 앞(오라클)
if (user.role !== ROLE.SUPER_ADMIN && transfer.fromCompanyId !== user.companyId) throw notFound('전환 요청을 찾을 수 없습니다.')
// + 트랜잭션 진입 전 stale 가드: 현재 primary assignment 회사 === fromCompanyId 확인(이미 employee.assignments 조회됨)
if (currentAsgn?.companyId && currentAsgn.companyId !== transfer.fromCompanyId) throw badRequest('직원의 현재 소속이 전환 출발 법인과 일치하지 않습니다.')
// + update where에 status 가드(동시성): updateMany({ where: { id, status: 'EXEC_APPROVED' }, ... }) 또는 기존 update 유지 + 위 상태체크
// POST create: source 소유 가드(employeeCompanyId 유도 후)
if (user.role !== ROLE.SUPER_ADMIN && employeeCompanyId !== user.companyId) throw forbidden('본인 법인 소속 직원만 전환을 요청할 수 있습니다.')
```
- **무변경**(이미 가드): `[id]/approve`(from/to 단계 가드)·`[id]` GET·list GET. (Codex "approve 무가드"는 오탐.)

---

## Steps

- [ ] **P1d-1** `employees/[id]/documents/[docId]/download/route.ts` GET — findFirst에 ...scope
- [ ] **P1d-2** `employees/[id]/certificate-requests/[requestId]/approve/route.ts` POST — certRequest findFirst에 ...scope(앞)
- [ ] **P1rel-1** `attendance/work-hour-alerts/[id]/route.ts` PATCH — findUnique→findFirst(관계 스코프)
- [ ] **P1rel-2** `benefit-claims/[id]/route.ts` GET·PATCH — benefitPlan.companyId ?? 직원회사, self 보존
- [ ] **P2-1** `directory/route.ts` GET — resolveCompanyFilter(param-override 제거)
- [ ] **P2-2** `departments/route.ts` GET — resolveCompanyFilter
- [ ] **P2-3** `job-grades/route.ts` GET — resolveCompanyFilter(필터 신규)
- [ ] **P2-4** `grade-title-mappings/route.ts` GET — resolveCompanyId(`??` 제거)
- [ ] **P2-5** `ai/executive-report/route.ts` POST — group-all 보존 ternary
- [ ] **P3-1** `compliance/kr/severance-interim/calculate/route.ts` GET — `_user`→user, 최신 assignment 회사 가드
- [ ] **P3-2** `performance/peer-review/candidates/route.ts` GET — `_user`→user, own-company OR cross-access
- [ ] **P4-1** `entity-transfers/[id]/execute/route.ts` PUT — fromCompany 가드 + stale 가드 + status 동시성
- [ ] **P4-2** `entity-transfers/route.ts` POST — source 소유 가드
- [ ] **검증** tsc 0 · lint 0 · 실 dev e2e · Codex Gate 2(/verify)

## Testing (실 dev e2e, #133 방식 + Codex P2-10 시나리오)

CTR-CN HR(`hr@ctr-cn.com`) → CTR 리소스 차단 + 회귀:
- [ ] P1d: 타법인 문서 download / 증명서 approve → 404
- [ ] P1rel: 타법인 52h alert PATCH → 404 · 타법인(=benefitPlan.companyId) benefit-claim GET·PATCH → 404/403 · **전출 직원 과거 청구를 도착법인 HR이 승인 못 함**
- [ ] P2: 타법인 `?companyId=CTR` directory/departments/job-grades/grade-title → 본인법인만(타법인 0) · **SUPER no-param 전체뷰 회귀 없음** · ai-report **`__GROUP_ALL__`(SUPER) 회귀 없음**
- [ ] P3: 타법인 employeeId severance → 404 · **전 법인 HR이 전출자 최신급여 severance 조회 못 함** · peer-candidates 타법인 → 404 · **cross-company dotted-line manager는 정상 조회**
- [ ] P4: 타법인 출발 execute → 404 · 동일 출발법인 → 정상 · SUPER → 정상 · **stale transfer(직원 이미 이동) 실행 차단** · **무관 법인 HR의 create 차단**
- [ ] 오라클: 존재하는 타법인 id와 임의 id가 동일 404
- [ ] 회귀: 동일 법인·SUPER 200(파괴적 쓰기 결과 정상 반영)

## Out of scope (명시)

- **#9 근태 overtime 재계산** + **WorkHourAlert 전환주 회사혼합**(getWeeklyHours가 companyId 없이 합산; alert에 companyId 컬럼 없어 전환주 소유 모호 — 본 배치는 현재-assignment 관계가드로 일반케이스 차단, 완전 해소는 `companyId` 컬럼 migration 별트랙)
- **entity-transfers dept/grade가 toCompany 소속인지 검증**(데이터정합, 테넌트 격리 아님 — fromCompany/SUPER 게이트가 테넌트 누출은 차단; 별 하드닝)
- **certificate PDF 전출자 과거데이터 정확도**(certRequest 회사 스코프로 cross-tenant 승인은 차단; PDF 시점정확도는 별건)
- **severance 헬퍼 companyId 인자화**(접근게이트가 경계라 불필요; G2가 이의 시 재고)
- **HQ 계층 권한**(`parentCompanyId`) · **RLS/MV 재적용** · **매뉴얼 §11.5 co-approval 갱신** — 별 트랙
- 메시지(i18n)·스키마·UI 무변경

## Codex Gate 1 반영 (2026-06-06, codex 0.136.0 — Request changes)

- **P0-1 severance 전출자 급여 누출** → 라우트 가드 `some`→**최신 primary assignment 회사 일치**(과거소속 차단). 헬퍼는 게이트로 충분(미수정·근거 명시).
- **P0-2 execute 재검증** → fromCompany 가드 + **현재 assignment 회사===fromCompanyId**(stale 차단) + status 동시성 가드. dept/grade-toCompany 검증은 데이터정합이라 out-of-scope(명시).
- **P0-3 형제 라우트** → POST create **source 소유 가드 포함**. **approve는 이미 from/to 가드 존재=오탐**. GET들 이미 스코프.
- **P1-4 benefit 소유** → 현재 assignment가 아니라 **`benefitPlan.companyId`(nullable→직원회사 폴백)**.
- **P1-5 certificate** → approve certRequest 회사 스코프(반영). list는 이미 employee-회사 게이트(무변경). PDF 과거데이터는 out-of-scope.
- **P1-6 resolveCompanyId SUPER 전체뷰 파괴** → 라우트별 `resolveCompanyFilter`(전체뷰)/`resolveCompanyId`(단일)/ternary(group-all) 선택.
- **P1-7 peer-review dotted-line 회귀** → own-company OR `verifyCrossCompanyAccess`, 실패 notFound.
- **P1-8 WorkHourAlert 전환주** → 관계가드 유지 + 한계 문서화(migration 별트랙).
- **P2-9 매뉴얼 SUPER-only 충돌** → 코드=co-approval(stale 매뉴얼) 확인 → execute fromCompany 유지. 매뉴얼 갱신 follow-up.
- **P2-10 e2e 갭** → 위 Testing에 전출/stale/group-all/dotted-line/오라클 시나리오 추가.
