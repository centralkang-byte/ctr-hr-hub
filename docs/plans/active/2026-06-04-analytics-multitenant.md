# analytics 멀티테넌트 격리 (batch4) — 설계

> **트랙**: 멀티테넌트 누출 remediation 우선순위 3 (급여 #129·#130 완결, settings #131 진행 후 analytics)
> **브랜치**: `fix/analytics-cross-tenant` (origin/main 기반 — settings #131과 파일 독립, 충돌 0)
> **출처**: `multi-tenant-leak-hunt` 트리아지 + 전수 코드 검증(2026-06-04)
> **메모리**: [[hrhub-multitenant-leak-systemic]] · [[phase3a-audit-drift]]

---

## 1. 배경 / 근본원인

analytics API는 대부분 **읽기 집계**다. 누출 라우트는 클라이언트가 보낸 생 `companyId`(쿼리/바디 파라미터)를 신뢰해서:

- **비-SUPER가 `?companyId=타법인`을 넘기면 그 법인 데이터를 봄** (cross-tenant 읽기 노출)
- **파라미터를 안 넘기면 `{}` = 전 법인 노출** (가장 광범위 — `executive/summary`·`drilldown`은 경영진 화면에 전 법인 급여·이직·인원이 통째로 샘)

### 트리아지 정정 2건 (코드 실측)

1. **근본원인 분류 정정**: remediation 문서는 RC-A를 "핸들러 `async (req)` → `user` 도달불가"라 했으나, 실제 핸들러 시그니처는 전부 `async (req, _ctx, user: SessionUser)`. **`user`는 3번째 인자로 항상 도달**한다. 진짜 원인은 "user를 받고도 안 쓰고 생 companyId를 신뢰"(RC-B). → 핸들러 시그니처 변경 불필요, 수정이 단순함.
2. **범위 정정**: 트리아지의 analytics 17~22는 과대. **이미 안전한 라우트 11개**가 섞임. 확정 누출 = **19개**.

---

## 2. 범위 — 누출 19 / 안전 11 (전수 확정)

### 안전(제외) 11개

| 분류 | 라우트 |
|---|---|
| `resolveCompanyId` 이미 사용 (4) | burnout, calculate, payroll/compa-ratio, turnover-risk |
| SUPER 가드 + `user.companyId` (3) | employee-risk(L49 forbidden 가드), gender-pay-gap, gender-pay-gap/export |
| 패턴 이미 구현 (1) | **workforce/overview** (L20-23 — `resolveCompanyFilter`의 레퍼런스) |
| 자기기반 (2) | team-health/overview(자기 position), team-stats(자기 employeeId) |
| MV 전체갱신 HR-only (1) | refresh |

### 누출(수정) 19개

| 형태 | 라우트 (수) |
|---|---|
| `params.companyId ? {…} : {}` (읽기) | executive/summary, executive/drilldown, attendance/overview, payroll/overview, performance/overview, turnover/overview, team-health-scores (7) |
| `searchParams.get` 생신뢰 (읽기) | ai-report, prediction/burnout, prediction/turnover (3) |
| `body.companyId` 생신뢰 (**POST 쓰기**) | ai-report/generate (1) — 규칙 (C) |
| `company_id` 스키마 → 비즈헬퍼 단일 인자 (읽기) | overview, attendance, compensation, performance, recruitment, team-health, turnover, workforce (8) |

---

## 3. 설계 — `resolveCompanyFilter` 헬퍼

`workforce/overview/route.ts:20-23`에 **이미 검증된 안전 패턴**이 인라인으로 돌고 있다. 이를 SSOT로 승격(발명이 아니라 추출):

```ts
// src/lib/api/companyFilter.ts (resolveCompanyId 바로 옆 — PROTECTED 확장)
/**
 * 멀티테넌트 companyId where 필터 조각
 * - SUPER_ADMIN: 지정 시 해당 법인, 미지정 시 전체({}) — 통합 집계뷰
 * - 그 외: 무조건 user.companyId 강제 (요청 파라미터 무시)
 */
export function resolveCompanyFilter(
  user: SessionUser,
  requestedCompanyId?: string | null,
): { companyId?: string } {
  const effective =
    user.role === 'SUPER_ADMIN' ? (requestedCompanyId ?? undefined) : user.companyId
  return effective ? { companyId: effective } : {}
}
```

- **비-SUPER**: params 무시, 자기 법인 강제 → 누출 차단
- **SUPER**: 지정=해당 법인, 미지정=전체 → 경영 통합뷰 유지
- `resolveCompanyId`(단일 반환, 급여·settings용)와 **용도 분리 공존**: 단일 companyId가 필요한 쓰기/단일법인 분석은 `resolveCompanyId`, where 필터 조각이 필요한 집계는 `resolveCompanyFilter`.

> **PROTECTED 가드**: `companyFilter.ts`는 `// PROTECTED` 파일. 이 확장은 SSOT 강화(멀티테넌트 격리 아키텍처 작업 본령)이며 Codex Gate 1/2가 아키텍처 리뷰 역할. 사용자 승인 완료(2026-06-04).

---

## 4. 적용 규칙 (두 형태)

### (A) where 조각형 11개 — 직접 치환

`const companyFilter = params.companyId ? { companyId: params.companyId } : {}`
→ `const companyFilter = resolveCompanyFilter(user, params.companyId)`

`searchParams.get('companyId')`(GET 읽기)도 동일하게 `resolveCompanyFilter(user, …)`로 감쌈. SUPER 통합뷰 그대로 유지. **POST 바디 쓰기는 (A) 금지 — (C) 참조.**

### (B) 단일 인자형 8개 — 비즈헬퍼 시그니처에 의존

`company_id` 스키마로 받은 단일 `companyId`를 비즈니스 헬퍼(`getAttendanceWeekly(companyId, …)` 등)에 넘기는 구조. where 조각이 아니라 단일 값이라 SUPER 전체(`{}`)를 표현 못 함.

- **비즈헬퍼가 `companyId?`(undefined=전체) 지원** → `resolveCompanyFilter(user, raw).companyId`를 넘김 (SUPER 전체뷰 유지). ⚠️ **비즈헬퍼의 "undefined=전체" 계약이 코드/주석에 명시된 경우만** — 명시 안 됐으면 단일 필수로 간주(아래).
- **미지원(단일 필수)** → `resolveCompanyId(user, raw)` 단일 강제. 반환은 항상 `string`(undefined 불가)이라 비-SUPER 차단 보장 + 비즈헬퍼에 `undefined`가 "전체"로 falls-through 하는 회귀 차단. SUPER 전체뷰는 포기(단일 법인 분석으로 수용).

> **(Codex Gate 1 P1 반영)** "전체 지원 / 단일 필수"를 plan 매핑표에 라우트별로 **명시 기록**한다. 애매하면 안전한 쪽(단일 필수 = `resolveCompanyId`)을 택해 미지정-전체 회귀를 원천 차단.

→ **plan 단계에서 8개 비즈헬퍼 시그니처 전수검증 후 라우트별 확정.**

### (C) POST 쓰기형 1개 — `ai-report/generate` (Codex Gate 1 P1)

생성 대상 `companyId`는 **쓰기**라 `resolveCompanyFilter`(미지정=`{}`=전체 생성 위험) 금지. `resolveCompanyId(user, body.companyId)`로 **단일 강제**:
- 비-SUPER: `body.companyId` 무시, 자기 법인으로 생성
- SUPER: `body.companyId` 지정 시 해당 법인, 미지정 시 자기(지주) 법인 — **전체 일괄 생성 불가**

---

## 5. 베이스 / 통합

- 브랜치 `fix/analytics-cross-tenant` (origin/main 기반). settings #131과 파일 독립이라 병렬 PR 가능.
- 단일 PR = "analytics subsystem 완전 격리" (급여·settings batch 모델 연속).

## 6. 검증 게이트

- `npx tsc --noEmit` 0 · `npm run lint` 0
- **e2e** `e2e/api/analytics-cross-tenant.spec.ts` 신설 (settings-cross-tenant.spec.ts 모델):
  - **(Codex Gate 1 P1 반영) 19개 누출 라우트 전부**에 대해 "비-SUPER가 `?companyId=<타법인>`/`company_id=<타법인>`/body로 넘겨도 자기 법인으로 강제됨" 차단 테스트 (3개 읽기 형태 + POST 쓰기가 각각 다르게 실패할 수 있어 전수)
  - SUPER 통합뷰(미지정=전체) 동작은 대표 1~2개만 입증
  - `ai-report/generate`(C): 비-SUPER가 body로 타법인 생성 시도 차단 입증
  - 회귀: 기존 analytics e2e green 유지
- **Codex Gate 1**(이 설계) + **Gate 2**(구현 후) — `.claude/commands/verify.md` SSOT

## 7. plan 단계 미결정 (전수검증 항목)

1. 단일 인자형 8개 비즈헬퍼의 `companyId` 옵셔널 지원 여부 → (B) "전체 지원 / 단일 필수" 매핑표 작성 (애매 시 단일 필수)
2. `team-health-scores`의 `params.companyId || user.companyId` 정확한 치환 형태
3. `team-health/overview`·`team-stats`·`refresh` 구현 재확인 — 응답 payload·후속조회가 무필터인지 (Codex: 클라 입력만 안 받으면 안전, 단 payload 확인 권고)
4. e2e: 19개 전수 차단 + SUPER 통합뷰 대표 1~2개 (§6)

## 8. Codex Gate 1 결과 (2026-06-04)

- **P0 없음.** P1 3건 전부 반영:
  - ai-report/generate POST 쓰기 → 규칙 (C) 단일 강제 분리
  - 단일 인자형 (B) `undefined`=전체 회귀 위험 → 매핑표 명시 + 애매 시 단일 필수
  - e2e 대표 샘플 → 19개 전수 차단
- **결함 아님(Codex 확인)**: `resolveCompanyFilter`의 SUPER 미지정 전체뷰는 비-SUPER `user.companyId` 강제라 권한 상승 아님 · SUPER `requestedCompanyId` 미검증도 SUPER가 전체권한이라 무해 · 안전 11개 분류 타당(단 §7-3 payload 확인).
