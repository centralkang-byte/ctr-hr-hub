# Phase 3a · Batch 07 후보 Surface Inventory

> **base SHA**: `7875fee6` (Session 228, batch 05 Stage 4 pre-flight 완료)
> **작성일**: 2026-05-21 KST
> **목적**: 가디언 default 결정 입력. 사용자 결재 없이 메타룰 정합 채택 (CC 추천 + 차순위 2개).
> **excluded**: batch 01 (휴가) · 02 (근태 my) · 03 (대시보드) · 04 (직원) · 05 (조직)

---

## §1. 남은 surface 인벤토리

### Proto NAV vs Codebase route 매칭

| Proto NAV group | Proto entry | Proto file | Codebase route | 매칭 |
|---|---|---|---|---|
| 글로벌 | dashboard | page-dashboard{,-console,-reports,-workday}.jsx | `/home` | ✅ batch 03 |
| 글로벌 | alerts | page-alerts.jsx | `/notifications` | proto only 한계 |
| 나의공간 | my-tasks | page-mytasks.jsx | `/my/tasks` (MyTasksClient) | 1:1 |
| 나의공간 | attendance-my | page-attendance.jsx | `/attendance` | ✅ batch 02 |
| 나의공간 | leave-req | page-leave.jsx · page-leave-modal.jsx | `/leave` · `/leave-of-absence` | ✅ batch 01 |
| 나의공간 | payslip-my | page-my-space.jsx 부분 | `/payroll/me` (페이지 있음 추정) | 1:N |
| 나의공간 | benefits-my | page-my-space.jsx 부분 | `/my/benefits` (?) · `/benefits` | 1:N |
| 나의공간 | goals-my | page-my-space.jsx 부분 | `/performance/my-*` | 1:N |
| 나의공간 | edu-my | page-my-space.jsx 부분 | `/training` (?) | 1:N |
| 나의공간 | kudos-my | page-my-space.jsx 부분 | `/performance/recognition` | 1:N |
| 나의공간 | docs-my | page-my-space.jsx 부분 | `/employees/[id]/contracts` 등 | 1:N |
| 나의공간 | my-profile | page-my-profile.jsx | `/employees/me` (ProfileSelfServiceClient) | 1:1 |
| 팀 관리 | team-hub | page-team-hub.jsx · page-team-space.jsx | `/team/*` · `/manager-hub` | 1:N |
| 팀 관리 | team-attn | (proto only 추정) | `/team/attendance` (?) | 1:N |
| 팀 관리 | team-goals | (proto only 추정) | `/team/performance` (?) | 1:N |
| 팀 관리 | team-1on1 | (proto only 추정) | `/team/1on1` (?) | proto only? |
| 팀 관리 | team-deleg | (proto only 추정) | `/delegation` | 1:1 |
| HR 관리 | employees | page-employees.jsx · page-employee-detail.jsx | `/employees` · `/directory` | ✅ batch 04 |
| HR 관리 | org | page-org.jsx | `/org` · `/organization` · `/org-studio` | ✅ batch 05 |
| HR 관리 | attendance | page-attendance.jsx | `/attendance/admin` · `/attendance/team` | 1:N |
| HR 관리 | leave | (proto only 추정) | `/leave/admin` | 1:1 |
| HR 관리 | onboarding | page-onboarding.jsx | `/onboarding` · `/offboarding` | 1:2 |
| HR 관리 | discipline | (proto only 추정) | `/discipline` (?) | 1:1 |
| HR 관리 | compliance | (proto only 추정) | `/compliance` | 1:1 |
| 채용 | jobs | page-jobs.jsx | `/recruitment/*` | 1:5+ |
| 채용 | recruit-dash | (proto only 추정) | `/recruitment/dashboard` | 1:1 |
| 채용 | kanban / talent-pool / internal | (proto only 추정) | `/recruitment/{kanban,talent,internal}` | 1:N |
| 성과/보상 | perf-cycle | page-perf-cycle.jsx | `/performance/cycle` · `/performance/admin` | 1:N |
| 성과/보상 | calibration | (proto only 추정) | `/performance/calibration` | 1:1 |
| 성과/보상 | comp / offcycle / benefits | (proto only 추정) | `/compensation` · `/compensation/offcycle` · `/benefits` | 1:N |
| 급여 | payroll-sim | page-payroll-sim.jsx | `/payroll/simulation` | 1:1 |
| 급여 | payroll / manual-adj / global-pay / transfers / yearend | (proto only 추정) | `/payroll/*` | 1:5+ |
| 인사이트 | i-* (8 sub) | page-insights.jsx | `/analytics/*` (8 sub) | 1:1 (8 tab) |
| 설정 | settings | page-settings.jsx | `/settings` (22탭) | 1:1 (대규모 22) |

### Proto only / codebase only 정리

- **Proto only (deferred)**: page-round1~4.jsx (디자인 변형 실험), page-placeholder*.jsx (mock)
- **Codebase only (batch 04/05 cross-ref 외 신규)**:
  - `/approvals` — 결재 (proto 부재, 별도 처리)
  - `/talent` — 인재 관리 (proto = i-people 일부?)
  - `/succession` — 승계 계획 (proto 부재)
  - `/hr` — HR 허브 (proto 부재)
  - `/manager-hub` — 매니저 허브 (proto = team-hub 매칭)
  - `/training` — 교육 (proto = edu-my 매칭)

---

## §2. 후보별 분석

### 후보 A — HR 근태 관리 (admin) [P0]
- **surface 수**: 2 (`/attendance/admin` + `/attendance/team`)
- **proto vs codebase 결렬 강도**: 중 (proto page-attendance.jsx 단일, codebase 분리)
- **production sensitive**: 중 (operational, 일상 운영)
- **의존성**: batch 02 (myspace 근태) ✅ 완료. 직원 batch 04 ✅ 완료
- **schema 위험**: 낮음 (Attendance + Schedule 모델 well-established)
- **fit**: HR admin 트랙. batch 02와 paradigm 유사 (proto leader 가능성)

### 후보 B — 급여 관리 (HR admin) [P0]
- **surface 수**: 6+ (`/payroll` 관리 / global-pay / sim / manual-adj / transfers / yearend)
- **proto vs codebase 결렬 강도**: 강 (proto = page-payroll-sim 1개만, codebase 5+ surface — batch 05 패턴 = codebase leader)
- **production sensitive**: **매우 높음** (급여 = 실제 돈)
- **의존성**: 큼 (직원/보상/연말정산/이체 cascading)
- **schema 위험**: 낮음 (9-state pipeline 잘 정의 — Completed Features)
- **fit**: 위험. batch 05 paradigm (codebase leader) 적용 가능. 단 surface 6+ = 한 batch에 비대

### 후보 C — 채용 (Recruitment) [P1]
- **surface 수**: 5+ (jobs / recruit-dash / kanban / talent-pool / internal)
- **proto vs codebase 결렬 강도**: 강 (proto = page-jobs 1개만, codebase 5+ — batch 05 paradigm)
- **production sensitive**: 중 (ATS 운영)
- **의존성**: 직원 batch 04 ✅ 완료. 보상 cascading
- **schema 위험**: 낮음 (ATS 모델 well-established)
- **fit**: batch 05 paradigm. 단 surface 5+ = 분할 검토

### 후보 D — 온보딩/오프보딩 [P0] ⭐ CC 추천
- **surface 수**: 2 (`/onboarding` + `/offboarding`)
- **proto vs codebase 결렬 강도**: 중 (proto page-onboarding.jsx 1개, codebase 2 surface)
- **production sensitive**: 중~높음 (입사·퇴사 워크플로)
- **의존성**: 직원 batch 04 ✅ 완료. 단순
- **schema 위험**: 낮음 (OnboardingTask + OffboardingChecklist 모델 well-established)
- **fit**: ⭐ **최적** — 2 surface, P0 핵심 워크플로, 의존성 작음, schema 안전, batch fit

### 후보 E — 성과/보상 사이클 [P1]
- **surface 수**: 5+ (perf-cycle / calibration / comp / offcycle / benefits)
- **proto vs codebase 결렬 강도**: 강 (proto = page-perf-cycle 1개, codebase 5+ — batch 05 paradigm)
- **production sensitive**: **매우 높음** (평가, 보상)
- **의존성**: 큼 (직원/매니저/계산엔진 cascading)
- **schema 위험**: 낮음 (Completed Features)
- **fit**: 위험. surface 5+ + sensitive 매우 높음 → 분할 + 신중 진입

### 후보 F — 나의 공간 보조 (myspace 잔여) [P1]
- **surface 수**: 7 (payslip-my / benefits-my / goals-my / edu-my / kudos-my / docs-my / my-profile)
- **proto vs codebase 결렬 강도**: 강 (proto = page-my-space + page-my-profile 통합 vs codebase 7 분리)
- **production sensitive**: 낮음 (read-only 위주)
- **의존성**: 큼 (각 도메인 의존 — payroll/benefits/perf/training/recognition/contracts)
- **schema 위험**: 낮음 (read-only, 기존 모델 재사용)
- **fit**: 7 surface = batch 비대. **분할 권고** (예: 07a = profile + docs, 07b = payslip + benefits, 07c = goals + edu + kudos)

### 후보 G — 팀 관리 [P1]
- **surface 수**: 5 (team-hub / attn / goals / 1on1 / deleg)
- **proto vs codebase 결렬 강도**: 중 (proto page-team-{hub,space}.jsx 2개, codebase 5)
- **production sensitive**: 중 (매니저 워크플로)
- **의존성**: 직원 ✅ + 근태/휴가 ✅ + perf cascading
- **schema 위험**: 낮음
- **fit**: batch 05 paradigm 가능. surface 5 = 분할 검토 (예: team-hub+attn 1차 / team-goals+1on1+deleg 2차)

### 후보 H — 인사이트 / Analytics [P2] ⭐ 차순위 1
- **surface 수**: 1 page + 8 sub-tab (executive/people/pay/perf/attn/churn/health/ai)
- **proto vs codebase 결렬 강도**: 중~약 (proto page-insights.jsx 단일, codebase `/analytics/*` 8 surface)
- **production sensitive**: 낮음 (read-only, MV 기반)
- **의존성**: 낮음 (MV PR #57 머지 완료 — Session 226 SHA `5376387e`)
- **schema 위험**: 낮음 (read-only, MV)
- **fit**: ⭐ **단일 mental model + 8 chart 패턴 = batch fit**. proto = 1 page (8 tab), codebase = 8 sub-page → paradigm 결정 게이트 의제 풍부

### 후보 I — 설정 (Settings) [P3]
- **surface 수**: 1 page (22탭)
- **proto vs codebase 결렬 강도**: 강 (proto = page-settings 단일, codebase = global override 시맨틱 결함 + 22탭 광범위 결함 = memory `hrhub-settings-global-override.md`)
- **production sensitive**: **매우 높음** (시스템 전역 설정)
- **의존성**: 모든 도메인 cross-ref
- **schema 위험**: 중~높음 (global vs company 시맨틱 재설계 가능성)
- **fit**: **별도 메모리 등록 광범위 결함 트랙** — Phase 3a batch 적합 미. 전용 세션 권장 (메모리에 명시됨)

### 후보 J — 알림 (alerts/notifications) + 나의 업무 (my-tasks) [P1] ⭐ 차순위 2
- **surface 수**: 2 (`/notifications` + `/my/tasks`)
- **proto vs codebase 결렬 강도**: 중 (proto page-alerts + page-mytasks 2개, codebase 2 surface — 1:1 매칭)
- **production sensitive**: 낮음 (read-only + 단순 액션)
- **의존성**: 낮음 (단독)
- **schema 위험**: 낮음
- **fit**: ⭐ 가벼운 batch, 빠른 진입 가능. surface 2 + 의존성 0 = 카나리 적합

### 후보 K — 컴플라이언스 / 징계 [P3]
- **surface 수**: 2 (`/compliance` + `/discipline`)
- **proto vs codebase 결렬 강도**: 알 수 없음 (proto entry 만, 페이지 파일 부재 — proto 한계)
- **production sensitive**: 매우 높음 (법규 정합성)
- **의존성**: 직원 ✅
- **schema 위험**: 중간 (법규 트랙 — Session 221 이미 §61/퇴직금 항목 4건 진행 중)
- **fit**: 별도 법규 정합성 트랙 (Session 221) 진행 중. **현재 batch 부적합** — 진행 중 트랙 종료 후 재평가

---

## §3. CC 권고 우선순위

기준 (가중치):
1. **surface 응집도** (단일 mental model, batch fit)
2. **proto-codebase gap 데이터 가용성** (proto 페이지 파일 존재 여부)
3. **blast radius** (small first, 의존성 작음)
4. **의존성 cascading** (선행 batch 완료 여부)
5. **schema 위험** (Prisma migration 없을수록 우위)

**우선순위 정렬 (high → low)**:

| 순위 | 후보 | surface | gap | blast | 의존 | schema | 비고 |
|---|---|---|---|---|---|---|---|
| 1 | **D 온보딩/오프보딩** | 2 | 데이터 가용 | 작음 | 직원 ✅ | 안전 | ⭐ 최적 fit |
| 2 | **J 알림+my-tasks** | 2 | 데이터 가용 | 가장 작음 | 단독 | 안전 | 가벼운 카나리 |
| 3 | **H 인사이트 / Analytics** | 1 page+8 sub | 데이터 가용 | 작음 (read-only) | MV ✅ | 안전 | 단일 mental model, batch 05 paradigm |
| 4 | **A HR 근태 관리** | 2 | 중 | 중간 | batch 02 ✅ | 안전 | P0 |
| 5 | **G 팀 관리** | 5 | 중 | 중간 | multi-cascade | 안전 | 분할 권고 |
| 6 | **C 채용** | 5+ | 강 (proto 1개만) | 큼 | 직원 ✅ | 안전 | batch 05 paradigm + 분할 |
| 7 | **F myspace 잔여** | 7 | 강 | 큼 | multi-cascade | 안전 | 분할 권고 |
| 8 | **E 성과/보상 사이클** | 5+ | 강 | 매우 큼 | 매우 multi | 안전 | sensitive 매우 높음, 분할 |
| 9 | **B 급여 관리** | 6+ | 강 | 매우 큼 | 매우 multi | 안전 | sensitive 매우 높음, 마지막 |
| — | I 설정 | 1 (22탭) | 강 | 매우 큼 | cross-domain | 위험 | **전용 세션 권장** (memory) |
| — | K 컴플라이언스/징계 | 2 | 부재 | 미정 | 직원 ✅ | 중간 | Session 221 법규 트랙 진행 중 |

---

## §4. 가디언 결정 받을 의제

**Batch 07 = D 온보딩/오프보딩** (CC 1순위 추천).

**근거**:
- ⭐ surface 응집도 최적 (2 surface, 단일 입사·퇴사 mental model)
- proto page-onboarding.jsx 데이터 가용 (proto 1개 ↔ codebase 2 = 1:2 paradigm)
- blast 작음 + 의존성 단순 (직원 batch 04 ✅ 완료)
- schema 안전 (OnboardingTask + OffboardingChecklist 모델 well-established, Completed Features)
- P0 (실 운영 마일스톤) — Phase 3a Q1 P0 정합

**차순위 2개**:

1. **J 알림 + 나의 업무** — 가장 가벼운 batch, 1-2일 작업. surface 2 + 의존성 0 = 카나리 진입에 최적. PR-5A 머지 직후 즉시 진입 가능
2. **H 인사이트 / Analytics** — 단일 mental model + 8 chart 패턴. batch 05 paradigm 정합 (codebase leader). MV 적용 완료 → 실 데이터 가용. **단** 8 sub-surface 분량은 batch 06+ 격상 후보 고려 필요

**제외 권고**:
- **B 급여 / E 성과보상 / F myspace 잔여 / C 채용**: surface 5+ = 분할 권고. 향후 batch 08-12 트랙
- **I 설정**: 별도 메모리 등록 광범위 결함 트랙 (전용 세션 권장)
- **K 컴플라이언스/징계**: Session 221 법규 정합성 트랙 진행 중, 종료 후 재평가

---

## §5. 가디언 default 결정

(가디언이 별도 turn 에서 결정 후 추가 commit. 본 섹션은 CC 미작성 placeholder.)

```
batch 07 = ___
근거: ___
RECORD 후보 SHA reserve: N+31~ (또는 별도)
```

---

**상태**: DRAFT (CC inventory 완료, 가디언 default 결정 대기)
**다음 갱신**: 가디언 default 결정 수신 시 §5 채움 + batch 07 본문 audit 작성 별도 turn
