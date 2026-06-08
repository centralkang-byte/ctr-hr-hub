# 멀티테넌트 트랙 확정 종료 — 잔여 cross-tenant 누출 9건 + 재발방지 lint

> **트랙**: 멀티테넌트 누출 remediation 최종 마감 (payroll #129·#130 / settings #131 / analytics #132 / batch5 #133 / batch6(misc) #134 완결 후 **버킷 경계 밖 잔존분** + 회귀 방지)
> **브랜치**: `fix/multitenant-residual-leaks` (origin/main 기반)
> **출처**: 잔여 `searchParams.get('companyId')`/`body.companyId` 47개 hit 전수 audit(2026-06-08, 3-way 병렬) → 9건 직접 read 검증(과보고 0)
> **메모리**: [[hrhub-multitenant-leak-systemic]] · [[p0-audit-overreports-wiring]]
> **SSOT 규칙**: `.claude/rules/api.md` §7 "resolveCompanyId 없이 companyId 수동 비교 금지 — 이 함수만 사용"

---

## 1. 배경

6개 배치가 버킷(payroll/settings/analytics/onboarding·leave·training/misc)별로 격리를 끝냈으나, **버킷 라우트 패턴에 안 걸린 라우트**가 잔존. 전수 grep(47 hit) → 38 안전(resolveCompanyId/Filter·SUPER 게이트·자기레코드 파생) / **9 누출** 확정.

근본원인은 기존과 동일 — 클라이언트가 보낸 raw `companyId`(쿼리/바디)를 신뢰:
- **`X ?? user.companyId` 셰입**: `??`는 파라미터가 **없을 때만** 발화 → 비-SUPER가 타 법인 id를 **보내면 그대로 통과**.
- raw `searchParams.get('companyId')` 직접 where 사용 / 무스코프 `findUnique`.

---

## 2. 누출 9건 (직접 read 검증 완료)

| # | 파일 | 핸들러 | 유형 | 근거 | 처방 |
|---|---|---|---|---|---|
| 1 | `dashboard/summary/route.ts` | GET | 읽기집계 | L190-193 ternary가 비-global 분기 누락 → `?companyId=타법인` & `=all` 통과 | 비-global 분기 추가(아래) |
| 2 | `leave-of-absence/types/route.ts` | GET | 읽기 | L18 `?? user.companyId`, 미들웨어 prefix 無 → 임의 인증자 | `resolveCompanyId` |
| 3 | `payroll/simulation/scenarios/route.ts` | GET | 읽기 | L83/89 raw + **L68-78 `ids` 분기 companyId 필터 전무** | `resolveCompanyFilter` 양 분기 + handler에 `user` 인자 추가 |
| 4 | 〃 | POST | **쓰기** | L127 `parsed.companyId ?? null` | `resolveCompanyId(user, parsed.companyId ?? null)` |
| 5 | `skills/gap-report/route.ts` | GET | 읽기 | L29 `?? user.companyId` | `resolveCompanyId` |
| 6 | 〃 | POST | **쓰기** | L178 `parsed.data.companyId ?? user.companyId` (role-only L166) | `resolveCompanyId` |
| 7 | `skills/matrix/route.ts` | GET | 읽기 | L20 `?? user.companyId` | `resolveCompanyId` |
| 8 | `positions/route.ts` | POST | **쓰기** | L69 `companyId ?? user.companyId` (body destructure) | `resolveCompanyId` |
| 9 | `compensation/simulation/ai-recommend/route.ts` | POST | 읽기(PII) | L32 무스코프 `findUnique` → 타 법인 직원 name·salary·compaRatio + AI | findFirst + 비-SUPER assignment companyId 스코프(404) |
| 10 | `payroll/simulation/scenarios/[id]/route.ts` | GET·DELETE | 읽기+**삭제** | **Codex Gate 1 P0**: GET L22 `findUnique({id})` 무스코프 → 타 법인 시뮬 parameters/results; DELETE L50 `isAdmin=SUPER‖HR_ADMIN`이 회사검증 우회 → 타 법인 HR 삭제 | 양 핸들러 `findFirst({id, ...resolveCompanyFilter(user, null)})` (비-SUPER 자기법인, null→404); GET에 `user` 인자 추가 |
| 11 | `leave-of-absence/route.ts` | GET | 읽기(PII) | **lint 규칙이 발견**: L24 `sp.get('companyId') ?? user.companyId`(별칭 `sp` 탓 1차 grep 누락) → 비-SUPER가 타 법인 휴직기록+직원 PII 조회(`perm LEAVE.UPDATE`) | `resolveCompanyId(user, sp.get('companyId'))` |

> 쓰기/삭제 4건(#4·#6·#8·#10-DELETE)이 최위험 — 비-SUPER HR이 타 법인 레코드 생성/삭제 가능. RLS 백스톱 없음(prisma-rls 미커버 모델).
> #10은 `companyId` 파라미터가 아닌 `[id]` IDOR라 1차 grep(`searchParams.get('companyId')`/`body.companyId`)에 안 잡힘 → Codex가 보강. **광의 by-id IDOR 전수 audit은 별 트랙**(settings 플랜 §98 "id 라우트 findFirst scoping known gap"). 본 PR은 내가 건드리는 scenarios 형제만 닫음(반쪽 수정 방지).

### #1 dashboard/summary 처방 (3-state null=전체 보존)
```ts
const companyId: string | null = !isGlobalRole
  ? user.companyId ?? null                                  // 비-global: 항상 자기법인 (타법인·all 차단)
  : requestedCompanyId === 'all' || !requestedCompanyId
    ? null                                                  // global: 미지정/all → 전체
    : requestedCompanyId
```
(`resolveCompanyId` 미사용 사유: 비-SUPER가 표현 못 하는 `null=전체` 3-state 집계뷰. 비-global fail-closed가 핵심.)

### #9 ai-recommend 처방
```ts
const employee = await prisma.employee.findFirst({
  where: {
    id: employeeId,
    ...(user.role === ROLE.SUPER_ADMIN ? {} :
      { assignments: { some: { isPrimary: true, endDate: null, companyId: user.companyId } } }),
  },
  select: { ... },                                          // 기존 select 유지
})
// 비-SUPER가 타 법인 직원 id → null → notFound (기존 L52-54 가드 재사용)
```
> MANAGER dotted-line cross-company 조회는 **별 트랙(Bucket C)** — 본 PR은 fail-closed 베이스라인.

### #3·#4 scenarios 비고
- GET handler 시그니처 `async (req)` → `async (req, _ctx, user)` (withPermission 3-arg). `ids` 분기·일반 목록 both `resolveCompanyFilter(user, raw)` where 병합.
- POST는 `user` 이미 도달. `companyId: resolveCompanyId(user, parsed.companyId ?? null)` (null-global 생성 제거 = 하드닝).

### 비범위 (명시)
- `positions` POST의 `reportsToPositionId`/`jobGradeId` cross-company FK 미검증 = **별 클래스(FK 스코핑)**, 본 누출 트랙 밖. 누출 핵심(`targetCompanyId`)만 가드.
- 안전 38건 중 `?? undefined`(SUPER 게이트형 vacancies/settlements/onboarding) 등은 무변경.

---

## 3. 재발방지 lint (no-restricted-syntax, `.eslintrc.json`)

**의도**: 가장 흔한 누출 셰입 `searchParams.get('companyId') ?? …`(raw 쿼리 + nullish fallback)을 빌드/CI에서 차단. 안전한 SUPER 라우트는 `const x = get('companyId')` 후 role ternary라 `??`를 raw get에 안 붙임 → **미적용(FP 최소)**.

```jsonc
// .eslintrc.json overrides[files: src/app/api/**/*.ts]
"no-restricted-syntax": ["error", {
  "selector": "LogicalExpression[operator='??'][left.callee.property.name='get'][left.arguments.0.value='companyId'][right.object.name='user'][right.property.name='companyId']",
  "message": "멀티테넌트 누출 위험: `searchParams.get('companyId') ?? user.companyId` 패턴 금지 — ??는 파라미터가 없을 때만 발화하므로 비-SUPER가 타 법인 id를 보내면 그대로 통과. resolveCompanyId/resolveCompanyFilter(user, ...) 사용. 의도된 SUPER 예외는 // eslint-disable-line no-restricted-syntax -- <사유>."
}]
```
- AST(`.get('companyId')` receiver 무관)라 **grep이 놓친 별칭(`sp.get`)까지 잡음** → 실제로 **#11(`leave-of-absence/route.ts:24`)을 즉시 발견**(broad 첫 실행 6 flag 중 신규 누출 1). receiver를 `searchParams`로 고정하지 않은 게 핵심.
- **narrow 사유**: 최초 broad(`?? <any>`)는 `?? undefined` SUPER-집계 3사이트(vacancies/settlements/onboarding-instances)도 flag. 이들은 별 idiom(SUPER 게이트, undefined=전체)이라 `?? user.companyId`(실증된 누출 idiom = 11건 중 read-leak 전부의 셰입)로 좁힘. → flag = 누출 셰입만.
- **잔여 2 안전 사이트** `// eslint-disable-line`(동작 변경 0, 사유 명시): `settings/grade-title-mappings:19`(L22-24 수동 badRequest 가드, PR #131 의도적 유지) · `performance/quarterly-reviews/[id]:99`(SUPER 전용 ternary 분기). 둘 다 `resolveCompanyId`와 동치지만 이전 배치 코드 보존 위해 미이관.
- **커버리지 한계(silent cap 금지)**: 규칙은 `?? user.companyId` GET 셰입만. 바디 쓰기(`body.companyId ??`)·무스코프 `findUnique({id})`(by-id IDOR, #10류)·`?? undefined` 무게이트는 **미커버** → audit + e2e가 보강. **광의 by-id IDOR 전수는 별 트랙**(settings 플랜 §98 known gap).

---

## 4. e2e (`e2e/api/residual-cross-tenant.spec.ts`, `misc-cross-tenant.spec.ts` 모델)

CTR-CN HR(`HR_ADMIN_CN`)이 CTR(`HR_ADMIN`) 리소스 접근 차단 + SUPER carve-out + same-company 회귀:
- 읽기(#1·#2·#3·#5·#7): `?companyId=CTR` → CTR 데이터 0건 (leaked filter)
- 쓰기(#4·#6·#8): `companyId=CTR`(또는 타법인) POST → 생성물 companyId가 CTR-CN로 강제 (또는 차단)
- #9: CTR employeeId로 POST → 404
- SUPER carve-out: 대표 1~2개 (`?companyId=CTR` → 데이터 보임)
- 회귀: same-company는 정상(non-404/200)

---

## 5. 검증 게이트

- `npx tsc --noEmit` 0 · `npm run lint` 0 (신규 규칙 포함)
- e2e `residual-cross-tenant.spec.ts` green + 기존 cross-tenant 스펙 회귀 0
- **Codex Gate 1**(본 문서) + **Gate 2**(구현 후, `/verify`) — `.claude/commands/verify.md` SSOT
- 새 추상 도입 없음 — #129~#134와 동일 결(resolveCompanyId/Filter SSOT)

---

## 6. Codex Gate 1 결과 (2026-06-08)

- **P0 (반영)**: `payroll/simulation/scenarios/[id]` GET·DELETE 무스코프 누출 = **#10**으로 추가(위 표).
- **P1 확인/반영**:
  - #3 `ids` 분기는 `resolveCompanyFilter`(SUPER 전체비교 보존, 비-SUPER 차단) — 플랜대로.
  - #4 POST: `resolveCompanyId`가 SUPER의 null-global 시나리오 생성 제거 → 수용(소비처 없음). 기존 `companyId:null` 레거시 행은 비-SUPER에 비가시(SUPER-only)로 처리 = 의도된 하드닝.
  - #9: same-company manager 스코프 적정. cross-company/dotted-line은 별 트랙(Bucket C) — 본 PR fail-closed 베이스라인.
  - **lint 과신 금지**: `??` 규칙은 by-id IDOR(#10류)·바디쓰기 못 잡음 → 커버리지 한계 명시(§3). by-id IDOR 전수는 별 트랙.
- **P2 확인**: dashboard #1 3-state 타당(global=`HR_ADMIN && !companyId`); 안전 38건 spot-check(org/tree cross-company 게이트·leave/requests primary 파생·pay-items 스코프) 모두 진짜 안전 — audit 정확(과보고 0).

## 7. Codex Gate 2 결과 (구현 후, 2026-06-08)

구현 12파일 diff 리뷰 + ai-recommend 타겟 재리뷰. tsc 0·lint 0(규칙 active, 위반 0).
- **P0 (반영)**: `ai-recommend` employee `findFirst` assignment 스코프에 `effectiveDate <= now` 부재 → **미래발령 우회**(B법인 미래발령 직원을 발효 전 조회). batch6 `8f8d2bab`와 동일 클래스. → outer `some` + inner select `where` 양쪽에 `effectiveDate: { lte: new Date() }` + inner `orderBy: effectiveDate desc` 추가(표준 패턴 = `fetchPrimaryAssignment`·training·peer-review).
- **P1 (반영)**: inner `assignments` select가 비-SUPER companyId 미적용 → 동시 다법인 active primary 시 타 법인 assignment 선택 가능(salaryBand·부서 노출). → `ownCompanyScope`(비-SUPER `{companyId}`, SUPER `{}`) 추출해 inner where에 spread.
- **확인**: 미래발령 우회 닫힘·SUPER `{}` 전체접근 유지·나머지 10 fix 회귀/신규 누출 0.
- e2e `residual-cross-tenant.spec.ts`(13 test) 컴파일·`--list` OK → CI 실행(로컬 webServer=prod build 무거움, [[hrhub-e2e-ci-baseline-truth]] CI 권위).
