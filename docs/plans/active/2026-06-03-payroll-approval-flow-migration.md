# 급여 승인체인 — 레거시 하드코딩 → ApprovalFlow 기계장치 마이그레이션 (Bucket D #10 / Gap G1)

> 2026-06-03 (S256+). 목표: CTR 급여 2단계 승인이 **실 직무분리(SoD)**로 동작하게 — 현재는 가짜 통제(HR_ADMIN 1인이 양쪽 도장).

## 문제 (근본원인, 증거)

- CTR 급여 승인체인 = `PAYROLL_APPROVAL_CHAINS['CTR'] = ['HR_MANAGER','CFO']` ([approval-chains.ts:17](../../src/lib/payroll/approval-chains.ts)).
- `HR_MANAGER`·`CFO`는 시스템 5-role(SUPER_ADMIN/HR_ADMIN/EXECUTIVE/MANAGER/EMPLOYEE)에 없고 보유 유저 0. `CFO`는 실은 직책(Position) `POS-CTR-SL-CFO`.
- 승인 로직([`[runId]/approve/route.ts:108-124`](../../src/app/api/v1/payroll/[runId]/approve/route.ts))은 `employeeRole.code ∈ [roleRequired, 'HR_ADMIN']` 매칭 + **HR_ADMIN 블랭킷 override**(모든 단계 대행).
- 결과: 두 단계 모두 HR_ADMIN(또는 SUPER) override로만 통과 → 2단계 SoD가 가짜. 런타임 dogfood(S256 조치 #1)에서 확인됨.

## 기존 자산 (재사용 — 새로 만들 것 거의 없음)

1. **위치 인식 resolver 완성**: [`resolve-approval-flow.ts`](../../src/lib/approval/resolve-approval-flow.ts) — `resolveApprovalFlow(module, companyId)` + `resolveApproverByRole(role, target, company)` (`direct_manager`/`dept_head`/`hr_admin`/`ceo`/`finance` → 실 employeeId) + `validateApprover`.
2. **payroll ApprovalFlow 이미 시드**: [`42-approval-flow-defaults.ts:33`](../../prisma/seeds/42-approval-flow-defaults.ts) `module:'payroll', steps:[{dept_head},{ceo}]` (규정 본부장→대표).
3. **완성된 쌍둥이 선례**: off-cycle 보상(`off_cycle_comp`) submit/approve/reject가 이 기계장치로 동작 — 정확한 템플릿.

## 핵심 설계 결정

### D1. 급여 flow는 **회사 단위 role**만 가능 (`dept_head` 부적합)
`resolveApproverByRole`의 `dept_head`·`direct_manager`는 **대상 직원 1명**이 필요. 급여 run은 회사 전체(`payrollItems[]` 다수)라 단일 대상 없음 → `dept_head` 해석 불가(null). **회사 단위로 해석되는 role(`hr_admin`/`finance`/`ceo`)만 적합.** 시드 `[dept_head, ceo]` → `[hr_admin, ceo]`(또는 `[finance, ceo]`)로 변경 필요.

### D2. 추상 role → 보유 자격 매핑 (회사 단위 체크)
off_cycle은 per-employee라 `resolveApproverByRole`이 단일 해석자를 반환하지만, 급여는 회사 단위 → "현재 단계 role을 **보유**한 자인가" 체크가 옳음:
| 추상 role | 보유 자격 |
|---|---|
| `hr_admin` | `employeeRole.code = HR_ADMIN` (companyId scope) |
| `ceo` | `employeeRole.code ∈ {SUPER_ADMIN, EXECUTIVE}` |
| `finance` | `payroll:manage` 권한 보유 |
→ 기존 approve 라우트의 `employeeRole.code` 체크를 **유지**하되, `roleRequired`(추상 role)를 위 매핑으로 확장. 최소 변경.

### D3. 블랭킷 HR_ADMIN override 제거 = 진짜 SoD
`OVERRIDE_ROLES=['HR_ADMIN']` 제거. HR_ADMIN은 `hr_admin` 단계만 만족, `ceo` 단계는 EXECUTIVE/SUPER만. → 한지영이 양쪽 못 함. SUPER_ADMIN은 `ceo` 매핑에 포함(긴급 대행 경로 — **audit 로그 필수**).

### D4. 동일 승인자 양단계 차단 (Codex Gate 1 HIGH #1)
role 보유 체크만으론 부족 — 다중 role 보유자(HR_ADMIN+EXECUTIVE, 또는 ceo에 포함된 SUPER_ADMIN)가 양쪽 단계를 혼자 도장 가능. **현 단계 승인자 `user.employeeId` ≠ 이전 APPROVED 단계들의 `approverId`** 강제(SUPER 긴급 경로만 예외, 별도 audit). 이게 진짜 SoD의 핵심.

### D5. 단계 생성을 submit 시점으로 이동 (Codex Gate 1 HIGH #2)
현재 approve 라우트가 첫 호출 시 lazy 생성 → payroll:approve 보유 누구나 인증 전 PayrollApproval/steps 생성+`requestedBy` 각인 가능(데이터정합 구멍). off_cycle submit처럼 **submit-for-approval에서 결정적 생성**, approve는 **기존 steps 소비만**.

## 변경 파일 (예상 4~6)

1. **[`[runId]/submit-for-approval/route.ts`](../../src/app/api/v1/payroll/[runId]/submit-for-approval/route.ts)** (D5 — 단계 생성 이전):
   - REVIEW→PENDING_APPROVAL 시 `resolveApprovalFlow('payroll', companyId)`로 **PayrollApproval+steps 결정적 생성**(off_cycle submit 미러). flow 미설정 시 `['hr_admin']` fallback. `roleRequired` = 추상 role 저장.
   - 알림: 1단계 role 보유자에게(현 HR_ADMIN+SUPER 블랭킷 → 해석된 승인자).
2. **[`[runId]/approve/route.ts`](../../src/app/api/v1/payroll/[runId]/approve/route.ts)** (핵심 — 소비만):
   - lazy 생성 블록 **제거**(D5) → 기존 steps만 소비. 없으면 badRequest.
   - 권한 체크: 현 단계 `roleRequired`(추상 role) → D2 매핑 `role.code IN (...)` 보유 확인. 블랭킷 HR_ADMIN override 제거(D3). **+ D4: `user.employeeId` ≠ 이전 APPROVED `approverId`**(SUPER 긴급 예외+audit).
   - 기존 atomic PENDING→APPROVED updateMany race guard + finalize-on-no-remaining-PENDING 유지.
   - **PAYROLL_APPROVED 이중 publish 정리**(Gate1 P1 #5): tx 내+후 중복 → 핸들러 멱등성 확인 후 단일화(또는 dedupe).
3. **[`42-approval-flow-defaults.ts`](../../prisma/seeds/42-approval-flow-defaults.ts)**: payroll steps `[dept_head, ceo]` → `[hr_admin, ceo]` (D1, fresh seed용).
4. **백필 스크립트** (Gate1 #4): `scripts/`에 일회성 — 글로벌 payroll flow의 steps가 **정확히 old `[dept_head, ceo]`일 때만** `[hr_admin, ceo]`로 교체, 영향 row 수 로그, 커스텀 법인 flow 불변. (idempotent seed의 existing-skip 우회.)
5. **[`approval-chains.ts`](../../src/lib/payroll/approval-chains.ts)**: 하드코딩 `PAYROLL_APPROVAL_CHAINS` CTR 값 정리. `getApprovalChain`(sync) 소비처 = approve 라우트뿐 → 마이그 후 dead → 제거.
6. **approval-status / review·publish UI** (필요시): 표시를 해석된 승인자/단계로 정합 (소).
7. **e2e**: `e2e/api/payroll-*.spec.ts`에 2단계 SoD 케이스(step1 hr_admin 200·step2 ceo 200·동일인 step2 403·HR_ADMIN step2 403).

## 검증 (런타임 + 회귀)

- **핵심 리스크 확인 (구현 1단계)**: CTR에서 `hr_admin`→한지영(hr@ctr.co.kr)·`ceo`→강대표(executive@ctr.co.kr) 런타임 해석 확인. (QA 계정상 존재 — 거의 확실하나 실측 필수.)
- **dogfood (실 세션 HTTP, dev :3002)**: 마감→계산→리뷰→submit→**step1 한지영(hr_admin) 승인 200 → step2 강대표(ceo) 승인 200 → APPROVED**. **SoD 증명**: step2를 한지영이 시도 → **403**(블랭킷 override 제거 확인). SUPER(대조영)는 긴급 통과 가능.
- tsc·eslint·신규 e2e·Codex Gate 2.

## 열린 결정 (CEO)

- **Q1. CTR 1단계 승인자 = `hr_admin`(한지영, 관리/HR) vs `finance`(재무/CFO 권한자)?** 규정 "본부장→대표"의 본부장 해석. 기본 제안 = `hr_admin`(현 dogfood 행위자·즉시 동작).
- **Q2. HR_ADMIN 블랭킷 override 제거 시 운영 갭**: 강대표 부재 시 급여 stall(궐위/대행 G7 미구현). SUPER_ADMIN 긴급 경로는 보존. 수용 가능?

## 비범위 (별 트랙)

- 규정 정합성 G2~G10 (증명서·징계·근태·합의·궐위대행 등) = 별 컴플라이언스 트랙.
- 해외 법인 체인(`GENERAL_MANAGER`/`CONTROLLER`/`COUNTRY_HEAD`) = 동일 패턴이나 해외 급여는 외부 처리라 우선순위 낮음. 본 PR은 CTR(국내) 중심, DEFAULT/해외는 후속.

## Codex Gate 1 (완료 — HIGH/P1 5건 전부 반영)

1. ✅ 동일 승인자 양단계 차단(D4) — role 보유만으론 다중role/SUPER가 혼자 도장 가능.
2. ✅ 단계 생성 submit으로 이동(D5) — lazy 생성은 인증 전 변조 구멍.
3. ✅ current-step-only(validateApprover any-match 부적합) — D2.
4. ✅ 시드 갱신 = narrow 백필(old-shape guard·count 로그·커스텀 보존) — 변경 #4.
5. ✅ PAYROLL_APPROVED 이중 publish 정리 — 변경 #2.

답변: (a) current-step-only 맞음 (b) override 제거 맞음(ceo resolver 검증+SUPER audit 조건) (c) 명시적 백필 (d) 3대 구멍=동일인·lazy생성·이중이벤트 (e) 생성 submit 이동 = yes.

## 효과 규모 = **중간** (1 집중 PR). 보안 민감(승인 authz) → ✅Gate 1 → 구현 → 런타임 SoD 검증 → Gate 2.

---

## 구현 결과 (S256+) — 2-PR 분리

### PR #1 (코어, 본 PR) — 진짜 SoD 달성, 검증 완료
**파일**: submit-for-approval(단계 생성)·approve(소비+D2/D3/D4)·reject(동일 마이그)·approval-status(flow 미리보기)·approval-chains(레거시 제거)·seed 42([hr_admin,ceo])·approval-step-roles.ts(공유 헬퍼)·backfill 스크립트·obsolete 단위테스트 제거.

**Codex Gate 2 P1 2건 반영**:
- #1 fail-CLOSED: flow 미설정 시 1인 승인 fallback 금지 → submit 거부.
- #2 반려 후 재요청: stale approval 제거+재생성 + REVIEW→PENDING 조건부 전이(race 방어) → step1 skip 구멍 차단.

**런타임 검증 (dev :3002, 실 세션, run 2026-02)**:
- 한지영(HR) step1(hr_admin) 200 → **한지영 step2(ceo) 403**(D3 미보유+D4 이전승인자) → 대조영(SUPER) step2 200 → **APPROVED**. ⇒ "HR 1인 급여 밀어붙이기" 차단 = 진짜 SoD.
- reject: employee 403 · 한지영 step1 reject 200 → REVIEW 복귀. 재요청 → fresh [hr_admin,ceo] (step1 미skip).
- 기존 e2e `payroll-approval-exports.spec` **54 pass**(회귀 0). tsc·eslint 0.

### PR #2 (별, 미착수) — EXECUTIVE(법인 대표) 승인자 활성화
현 RBAC는 **미들웨어 rbac-spec `/api/v1/payroll`→HR_UP**가 EXECUTIVE를 전 payroll 엔드포인트에서 차단. CEO 결정 = 강대표(EXECUTIVE)가 승인해야 함 → 별 PR로 분리(다표면·보안 크리티컬):
- inbox payroll 가시성 `isHrUp`→EXECUTIVE 포함.
- rbac-spec 카브아웃: prefix가 `/[runId]/approve|reject` 접미사 못 잡음(동적 uuid) → findRouteRule 패턴/메서드 매칭 강화 **또는** 좁은 carve-out.
- inbox 인라인 승인 `apiClient.put`(PUT) vs payroll approve/reject(POST) **메서드 불일치** 정합.
- 코어가 `ceo=[SUPER_ADMIN, EXECUTIVE]`라 미들웨어만 열리면 강대표 즉시 동작 (forward-ready).
- 그동안 step2 = SUPER_ADMIN(대조영)로 운영 가능(진짜 SoD 성립).
