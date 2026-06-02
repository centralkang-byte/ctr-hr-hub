# Phase 3a — 페이지별 적용 Audit (사전커밋 SSOT)

> 선행: Phase 2 종료 (PR #55 merge `29a15d41`, `docs/phase-2-closeout.md`).
> 표준: `CLAUDE.md` "## Phase 3 작업 표준" (`838ee2bd` — Q1 차등우선순위 /
> Q2 4단계 게이트+3경량화 / Q3 운명 카드). 본 문서 = Phase 3a 실행 SSOT.
> 사전커밋 패턴: P1 `5b63e2d9` / P2 `71ee4786` (CLAUDE.md 표준 + plan doc + 상호참조).

## Context

Phase 1(토큰)·Phase 2(시그니처 컴포넌트 + 도메인색 wt SSOT) 완료. Phase 3는
**페이지별로 Workday 외관·IA·KPI 패턴을 실제 적용**하는 단계. Phase 3a =
**audit + 우선순위 확정**(구현 전). 본 사전커밋은 audit이 곧장 시작 가능하도록
(1) 양식 템플릿 3종 (2) 프로토타입 페이지 list(audit 워크시트 골격)을 고정한다.
표준 본문은 CLAUDE.md에 있으므로 여기서 중복하지 않고 참조만 한다.

## Q1/Q2/Q3 — CLAUDE.md 참조 (중복 금지)

`CLAUDE.md` "## Phase 3 작업 표준" SSOT:
- **Q1**: P0(매일 핵심 워크플로) / P1(주요 HR) / P2(리포팅·분석) /
  P3(운영도구·세팅·고급). audit이 페이지별 기능 추출 → CC P0~P3 추정 → 사용자 확정.
- **Q2**: 4단계 게이트 = ① audit(∩공통/프로토타입만/코드베이스만 분류 + P0~P3 +
  불확실 등급) ② 페이지 batch 카드 ③ 사용자 batch 게이트 ④ 구현+N1/N2.
  경량화 ③ 불확실 등급제: 고확실 fast-track 1줄 / 중확실 짧은 카드 /
  저확실 상세 카드.
- **Q3**: 코드베이스만 있는 기능 = 운명 카드(유지/숨김/제거)로 동일 batch 게이트 처리.

## 양식 템플릿 3종 (Phase 3a 산출물 표준 형식)

### A. 스펙 카드 (프로토타입 ∩ 코드베이스 또는 프로토타입만 — 리스킨/구현 대상)

불확실 등급별 분량 (Q2③):

**고확실 (fast-track 1줄)**
```
- [<page>] <기능> — 프로토타입대로 리스킨, 표준 CRUD. N1/N2 결과 라이브 보고에서 OK/정정.
```

**중확실 (짧은 카드)**
```
### [<page>] <기능명>
- 목적: <1줄>
- 추정 동작: <2-3줄>
- 불확실점: <무엇이 확인 필요한가>
```

**저확실 (상세 카드)**
```
### [<page>] <기능명>
- 목적:
- 동작: <UI 흐름·상태>
- 데이터 모델: <prisma 모델/필드 — 백엔드 무변경 전제, 읽기 경로만>
- API: <소비 엔드포인트>
- 권한: <역할별 가시성/액션, RBAC SSOT 참조>
- 불확실점: <결정 필요 항목 — 사용자 게이트에서 판정>
```

### B. 운명 카드 (코드베이스만 — 프로토타입 부재, Q3)

```
### [<page>] <기능명> — 운명 제안: 유지 | 숨김 | 제거
- 현 상태: <코드/라우트 존재 형태>
- 프로토타입 부재 사유 추정: <레거시 / 후속 추가 / 의도적 제외>
- 제안 근거: <왜 유지/숨김/제거인가 — 사용 흔적·중복·전략 정합>
- 영향: <제거 시 회귀 표면 / 숨김 시 복구 비용>
```

### C. 페이지 batch 카드 (게이트 단위 = 1페이지 1장, Q2②)

```
## Batch: <페이지명> (<route>) — 추정 우선순위 P<0~3>

| 기능 | 분류 | 등급 | 카드 |
|---|---|---|---|
| <기능> | ∩공통 / 프로토타입만 / 코드베이스만 | 고/중/저 | A고1줄 / A중 / A상세 / B운명 |
(고확실 다수면 표 1줄로 압축, 중·저확실만 별도 카드 전개)

**사용자 게이트 항목**: 우선순위 OK/정정 · 운명 카드 판정 · 저확실 결정.
**N1/N2**: 카나리 1곳 후 확산 (CLAUDE.md 카나리 표준).
```

## HR Hub 프로토타입 페이지 list (Phase 3a audit 시작점)

출처: `_design-reference/HANDOVER.md §3.3` (페이지 카테고리 그룹) +
`_design-reference/REVIEW_REPORT.md` (프로토타입 자체 P0-P4 + 페이지별 상태
매트릭스) + 실제 `src/config/navigation.ts` IA. audit이 각 행에 (∩분류 /
P0~P3 추정 / 불확실 등급)을 채운다. 백엔드(prisma/API/RLS) 무변경 — 표현·IA만.

> 규모(HANDOVER): 30+ 페이지 · 인사이트 서브 9 · 위저드 5 · 드로어 6 · 통합 래퍼 2.

| # | 카테고리 | 프로토타입 소스 | 실제 라우트(추정) | audit 채움 |
|---|---|---|---|---|
| 1 | 대시보드 | `page-dashboard.jsx`(+console/reports/workday 3스타일) | `/home` | ∩/P/등급 |
| 2 | HR관리·직원 | `page-employees.jsx` | `/employees` | |
| 3 | HR관리·직원상세 | `page-employee-detail.jsx`(banner+7탭) | `/employees/[id]` | |
| 4 | HR관리·조직 | `page-org.jsx` | `/org` | |
| 5 | HR관리·근태 | `page-attendance.jsx` | `/attendance/admin` | |
| 6 | HR관리·휴가 | `page-leave.jsx` | `/leave/admin` | |
| 7 | HR관리·온보딩 | `page-onboarding.jsx` | `/onboarding`·`/offboarding` | |
| 8 | My Space (9) | `page-my-space.jsx` (Attendance/Leave/Loa/Payslip/Benefits/Skills/Edu/Kudos/Docs My) | `/attendance`·`/leave`·`/leave-of-absence`·`/payroll/me`·`/my/*` | |
| 9 | My·프로필 | `page-my-profile.jsx` (isSelf) | `/my/profile` | |
| 10 | 팀 관리 | `page-team-space.jsx`+`page-team-hub.jsx` (Attn/Goals/1on1/Deleg/Hub) | `/team/*` | |
| 11 | 채용 | `page-jobs.jsx`+`round1/3` (Jobs/OffCycle/Kanban/TalentPool/Internal/Dash) | `/recruitment/*` | |
| 12 | 성과/보상 | `page-perf-cycle.jsx`·`round1`(Calibration)·`placeholder-real`(CompMgmt)·`round3` | `/performance/*` | |
| 13 | 급여 | `placeholder-real`(PayrollMgmt/ComplianceMgmt)·`round2`(YearEnd/Global)·`page-payroll-sim.jsx` | `/payroll/*` | |
| 14 | 인사이트 (서브 9) | `page-insights.jsx` | `/analytics/*` | |
| 15 | 설정 | `page-settings.jsx` | `/settings/*` | |
| 16 | 위저드 (5) | `wizards.jsx` | 각 플로우 | |
| 17 | 드로어 (6) | `drawers.jsx`·`wd-drawer.jsx` | 페이지 내 | |
| 18 | 통합 래퍼 (2) | `page-wrappers.jsx` | One Hub류 | |
| 19 | ⌘K | `cmdk.jsx` | 전역 | (REVIEW_REPORT P3 #11 미구현) |

**프로토타입 자체 우선순위 입력**(REVIEW_REPORT 권장순): 1차 P0 3건+P1#4 /
2차 P1 카피·빈상태·라벨 / 3차 ⌘K / 4차 인사이트 콘텐츠 / 5차 P3·P4 폴리시.
→ audit의 P0~P3 추정 시 교차 참조(프로토타입 P0-P4 ≠ Q1 P0~P3, 별 체계 —
Q1은 비즈니스 워크플로 중요도, REVIEW_REPORT는 시각결함 심각도).

## Phase 3a 진행 방식 (Q2 4단계 적용)

1. **audit**: 위 19행 × (페이지별 기능 추출 → ∩공통/프로토타입만/코드베이스만
   분류 → P0~P3 추정 → 불확실 등급). 산출 = 페이지별 batch 카드 초안.
2. **batch 카드**: C 양식, 1페이지 1장. 고확실 표압축·중저확실 카드전개.
3. **사용자 batch 게이트**: 우선순위 OK/정정/보류/제거 + 운명 판정 + 저확실 결정.
4. **구현 + N1/N2**: 우선순위 순(P0 먼저), 카나리 1곳 후 확산. P0 완료 = 실 운영 마일스톤.

## 범위 밖 (Phase 3a 비대상)

- 백엔드(prisma/API/lib/middleware/RLS/companyFilter) — 무변경 불변.
- known-deferred 보드(다크 lavender 3·`--primary-dim` SSOT·chart-colors shim·
  스테일 빌드 아티팩트) = 별도 다크/폴리시 Phase.
- 별도 트랙: (a) Analytics MV 제품 결함(`QF-REPORT-B1`) / (b) e2e-tail(Phase 9) /
  P1-6c i18n / D4 EmployeesPage 다중선택 — Phase 3a와 독립.

## Verify (사전커밋 — docs only)

- `docs/plans/active/2026-05-18-phase3a-audit.md` 신규 + `CLAUDE.md`
  "## Phase 3 작업 표준"에 본 문서 SSOT 상호참조 1줄.
- 코드 0변경 → tsc/lint/e2e 무관. 커밋 `docs: Phase 3a 사전커밋 — audit 양식 +
  프로토타입 페이지 list` (P1 `5b63e2d9`/P2 `71ee4786` 패턴). push.
- Phase 3a audit 본작업은 본 사전커밋 머지 후 별도 트랙으로 착수.
