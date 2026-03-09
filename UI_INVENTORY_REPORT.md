# CTR HR Hub — UI Inventory Report
Date: 2026-03-09

---

## 1. Page Routes (166 total page.tsx files)

### Route Tree

```
/ (root)                          → redirect → /login
/(auth)/login                     → Login Page
/(dashboard)/                     → redirect (to /home or role-specific)

홈 (Home)
  /home                           → 대시보드 홈 (role-based: Employee/Manager/HRAdmin/Executive)

나의 공간 (My Space)
  /my                             → 나의 공간 허브
  /my/profile                     → 내 프로필
  /my/leave                       → 내 휴가
  /my/benefits                    → 복리후생
  /my/skills                      → 역량 자기평가 (NEW)
  /my/training                    → 내 교육
  /my/year-end                    → 연말정산 (KR only, NEW)
  /my/internal-jobs               → 사내 채용 공고
  /my/settings/notifications      → 알림 설정

알림
  /notifications                  → 알림 센터

인사 운영 (HR Ops)
  직원 관리
    /employees                    → 직원 목록
    /employees/new                → 직원 추가
    /employees/[id]               → 직원 상세
    /employees/[id]/contracts     → 계약 관리
    /employees/[id]/work-permits  → 취업비자/허가
    /employees/me                 → 내 직원 프로필
    /directory                    → People Directory

  조직 관리
    /org                          → 조직도 (Org Chart)
    /org-studio                   → Org Studio

  근태
    /attendance                   → 내 근태
    /attendance/admin             → 근태 관리 (HR)
    /attendance/team              → 팀 근태
    /attendance/shift-calendar    → 교대 캘린더
    /attendance/shift-roster      → 교대 로스터
    /approvals/attendance         → 근태 승인

  휴가
    /leave                        → 내 휴가 신청/조회
    /leave/team                   → 팀 휴가 현황
    /leave/admin                  → 휴가 관리 (HR)

  온보딩/오프보딩
    /onboarding                   → 온보딩 관리 (HR)
    /onboarding/me                → 내 온보딩
    /onboarding/checkin           → 체크인
    /onboarding/checkins          → 체크인 현황
    /offboarding                  → 퇴직 관리
    /offboarding/[id]             → 퇴직자 상세

  급여
    /payroll                      → 급여 관리
    /payroll/[runId]/review       → 급여 런 검토
    /payroll/me                   → 내 급여명세서
    /payroll/me/[runId]           → 급여명세서 상세
    /payroll/global               → 글로벌 급여 현황
    /payroll/import               → 해외 급여 업로드
    /payroll/simulation           → 급여 시뮬레이션
    /payroll/anomalies            → 급여 이상 탐지
    /payroll/bank-transfers       → 이체 관리
    /payroll/year-end             → 연말정산 (HR, KR only)

  징계/포상
    /discipline                   → 징계 목록
    /discipline/new               → 징계 추가
    /discipline/[id]              → 징계 상세
    /discipline/rewards           → 포상 목록
    /discipline/rewards/new       → 포상 추가
    /discipline/rewards/[id]      → 포상 상세

인재 관리 (Talent)
  채용 (ATS)
    /recruitment                  → 채용 공고 목록
    /recruitment/new              → 공고 추가
    /recruitment/dashboard        → 채용 대시보드
    /recruitment/board            → 칸반 보드 (NEW)
    /recruitment/talent-pool      → 인재 풀
    /recruitment/requisitions     → 채용 요청
    /recruitment/requisitions/new → 채용 요청 추가
    /recruitment/cost-analysis    → 비용 분석
    /recruitment/[id]             → 공고 상세
    /recruitment/[id]/edit        → 공고 수정
    /recruitment/[id]/applicants  → 지원자 목록
    /recruitment/[id]/applicants/new → 지원자 추가
    /recruitment/[id]/interviews  → 인터뷰 목록
    /recruitment/[id]/interviews/new → 인터뷰 추가
    /recruitment/[id]/pipeline    → 채용 파이프라인

  성과 관리
    /performance                  → 내 성과/목표 (Employee view)
    /performance/admin            → 성과 관리 (HR)
    /performance/goals            → 목표 관리
    /performance/team-goals       → 팀 목표
    /performance/team-results     → 팀 성과
    /performance/results          → 성과 결과
    /performance/self-eval        → 자기평가
    /performance/manager-eval     → 매니저 평가
    /performance/calibration      → 캘리브레이션
    /performance/peer-review      → 동료 평가
    /performance/peer-review/[cycleId]/setup  → 동료 평가 설정
    /performance/peer-review/evaluate/[nominationId] → 동료 평가 수행
    /performance/peer-review/results/[cycleId] → 동료 평가 결과
    /performance/one-on-one       → 1:1 미팅
    /performance/recognition      → 칭찬/인정
    /performance/pulse            → 펄스 서베이
    /performance/pulse/[id]/respond → 서베이 응답
    /performance/pulse/[id]/results → 서베이 결과

  보상/복리후생
    /compensation                 → 보상 관리
    /benefits                     → 복리후생 관리

  교육/개발
    /training                     → 교육 목록
    /training/enrollments         → 내 교육 등록
    /organization/skill-matrix    → 스킬 매트릭스 (NEW)
    /team/skills                  → 팀원 역량 평가

  승계/탤런트
    /talent/succession            → 승계 계획
    /succession                   → 승계 (중복?)

팀 관리 (Team / Manager Hub)
  /manager-hub                    → 팀 현황 허브

컴플라이언스/규정 준수
  /compliance                     → 컴플라이언스 허브
  /compliance/gdpr                → GDPR 관리
  /compliance/data-retention      → 데이터 보관 정책
  /compliance/pii-audit           → PII 감사
  /compliance/dpia                → DPIA
  /compliance/kr                  → 한국 컴플라이언스
  /compliance/ru                  → 러시아 컴플라이언스
  /compliance/cn                  → 중국 컴플라이언스

인사이트 (Analytics)
  /dashboard                      → HR KPI 대시보드
  /dashboard/compare              → 대시보드 비교
  /analytics                      → 전사 개요
  /analytics/workforce            → 인력 분석
  /analytics/turnover             → 이직 분석
  /analytics/attrition            → 이탈 위험
  /analytics/performance          → 성과 분석
  /analytics/attendance           → 근태 분석
  /analytics/recruitment          → 채용 분석
  /analytics/compensation         → 보상 분석
  /analytics/gender-pay-gap       → 성별 임금 격차
  /analytics/team-health          → 팀 건강
  /analytics/report               → AI 보고서
  /analytics/predictive           → 예측 분석 (HR_ADMIN+)
  /analytics/predictive/[employeeId] → 직원별 리스크 상세

설정 (Settings) — 39 dedicated pages + 1 dynamic catch-all
  /settings                       → 설정 허브
  /settings/[category]            → 동적 설정 카테고리 (approval-chain, promotion-rules 등)
  /settings/attendance            → 근태 설정
  /settings/audit-logs            → 감사 로그
  /settings/branding              → 브랜딩
  /settings/calibration           → 캘리브레이션 설정
  /settings/competencies          → 역량 설정
  /settings/contract-rules        → 계약 규칙
  /settings/custom-fields         → 커스텀 필드
  /settings/dashboard-widgets     → 대시보드 위젯 설정
  /settings/data-migration        → 데이터 마이그레이션
  /settings/email-templates       → 이메일 템플릿
  /settings/entity-transfers      → 법인 이동 (3-way approval)
  /settings/enums                 → 열거형 설정
  /settings/evaluation-scale      → 평가 척도
  /settings/exchange-rates        → 환율
  /settings/export-templates      → 내보내기 템플릿
  /settings/holidays              → 공휴일
  /settings/hr-documents          → HR 문서
  /settings/leave-policies        → 휴가 정책
  /settings/leave                 → 휴가 설정
  /settings/m365                  → M365 연동
  /settings/modules               → 모듈 설정
  /settings/monitoring            → 시스템 모니터링
  /settings/notifications         → 알림 트리거 설정
  /settings/offboarding           → 오프보딩 설정
  /settings/onboarding            → 온보딩 설정
  /settings/org-changes           → 조직 변경 설정
  /settings/payroll-items         → 급여 항목
  /settings/performance-cycles    → 성과 사이클 목록
  /settings/performance-cycles/new → 성과 사이클 추가
  /settings/performance-cycles/[id] → 성과 사이클 편집
  /settings/profile-requests      → 프로필 변경 요청
  /settings/salary-bands          → 급여 밴드
  /settings/salary-matrix         → 급여 매트릭스
  /settings/shift-patterns        → 교대 패턴
  /settings/shift-roster          → 교대 로스터
  /settings/tax-brackets          → 세금 구간
  /settings/teams                 → 팀 설정
  /settings/terminals             → 단말기 설정
  /settings/terms                 → 이용 약관
  /settings/work-schedules        → 근무 스케줄
  /settings/workflows             → 워크플로 설정

기타
  /403                            → 접근 거부
  /offline                        → 오프라인 폴백
```

### Structured Status Table (Core Routes)

| Route | Title (KR) | Status | Data Source |
|-------|-----------|--------|-------------|
| `/` | 루트 | ✅ Active (redirect → /login) | — |
| `/(auth)/login` | 로그인 | ✅ Active | NextAuth |
| `/home` | 대시보드 홈 | ✅ Active (role-branched) | `/api/v1/home/summary`, `/api/v1/home/pending-actions` |
| `/my` | 나의 공간 | ✅ Active | `/api/v1/home/summary` |
| `/my/profile` | 내 프로필 | ✅ Active | Employee profile API |
| `/my/leave` | 내 휴가 | ✅ Active | Leave API |
| `/my/benefits` | 복리후생 | ✅ Active | Benefits API |
| `/my/skills` | 역량 자기평가 | ✅ Active (NEW badge) | Skills API |
| `/my/training` | 내 교육 | ✅ Active | Training API |
| `/my/year-end` | 연말정산 (개인) | ✅ Active (NEW, KR only) | Payroll API |
| `/my/internal-jobs` | 사내 채용 | ✅ Active | Recruitment API |
| `/notifications` | 알림 센터 | ✅ Active | `/api/v1/notifications` |
| `/employees` | 직원 관리 | ✅ Active | `/api/v1/employees` |
| `/employees/[id]` | 직원 상세 | ✅ Active | Employee API |
| `/directory` | People Directory | ✅ Active | Employees API |
| `/org` | 조직도 | ✅ Active | Org API |
| `/org-studio` | Org Studio | ✅ Active | Org Studio API |
| `/attendance` | 내 근태 | ✅ Active | Attendance API |
| `/attendance/admin` | 근태 관리 | ✅ Active | Attendance Admin API |
| `/attendance/team` | 팀 근태 | ✅ Active | Attendance Team API |
| `/approvals/attendance` | 근태 승인 | ✅ Active | Approval API |
| `/leave` | 내 휴가 신청 | ✅ Active | Leave API |
| `/leave/team` | 팀 휴가 | ✅ Active | Leave Team API |
| `/leave/admin` | 휴가 관리 | ✅ Active | Leave Admin API |
| `/onboarding` | 온보딩 관리 | ✅ Active | Onboarding API |
| `/onboarding/me` | 내 온보딩 | ✅ Active | Onboarding API |
| `/onboarding/checkin` | 체크인 | ✅ Active | Onboarding Checkin API |
| `/onboarding/checkins` | 체크인 현황 | ✅ Active | Onboarding Checkin API |
| `/offboarding` | 퇴직 관리 | ✅ Active | Offboarding API |
| `/offboarding/[id]` | 퇴직자 상세 | ✅ Active | Offboarding API |
| `/payroll` | 급여 관리 | ✅ Active | Payroll API |
| `/payroll/me` | 내 급여명세서 | ✅ Active | Payroll API |
| `/payroll/global` | 글로벌 급여 | ✅ Active | Payroll Global API |
| `/payroll/import` | 해외 급여 업로드 | ✅ Active | Payroll Import API |
| `/payroll/simulation` | 급여 시뮬레이션 | ✅ Active | Payroll Simulation API |
| `/payroll/anomalies` | 급여 이상 탐지 | ✅ Active | Payroll Anomalies API |
| `/payroll/year-end` | 연말정산 (HR) | ✅ Active (KR only) | Payroll Year-end API |
| `/discipline` | 징계 관리 | ✅ Active | Discipline API |
| `/discipline/rewards` | 포상 관리 | ✅ Active | Discipline API |
| `/recruitment` | 채용 목록 | ✅ Active | Recruitment API |
| `/recruitment/dashboard` | 채용 대시보드 | ✅ Active | Recruitment API |
| `/recruitment/board` | 칸반 보드 | ✅ Active (NEW) | Recruitment API |
| `/recruitment/[id]/pipeline` | 파이프라인 | ✅ Active | Recruitment API |
| `/performance` | 내 성과/목표 | ✅ Active | Performance API |
| `/performance/admin` | 성과 관리 (HR) | ✅ Active | Performance API |
| `/performance/calibration` | 캘리브레이션 | ✅ Active | Performance Calibration API |
| `/performance/peer-review` | 동료 평가 | ✅ Active | Peer Review API |
| `/performance/one-on-one` | 1:1 미팅 | ✅ Active | CFR API |
| `/performance/pulse` | 펄스 서베이 | ✅ Active | Pulse API |
| `/compensation` | 보상 관리 | ✅ Active | Compensation API |
| `/benefits` | 복리후생 관리 | ✅ Active | Benefits API |
| `/training` | 교육 목록 | ✅ Active | Training API |
| `/training/enrollments` | 내 교육 등록 | ✅ Active | Training API |
| `/talent/succession` | 승계 계획 | ✅ Active | Succession API |
| `/organization/skill-matrix` | 스킬 매트릭스 | ✅ Active (NEW) | Skills API |
| `/manager-hub` | 팀 현황 허브 | ✅ Active | Manager Hub API |
| `/dashboard` | HR KPI 대시보드 | ✅ Active | Analytics API |
| `/analytics` | 전사 인력 개요 | ✅ Active | Analytics API |
| `/analytics/workforce` | 인력 분석 | ✅ Active | Analytics API |
| `/analytics/turnover` | 이직 분석 | ✅ Active | Analytics API |
| `/analytics/attrition` | 이탈 위험 | ✅ Active | Analytics API |
| `/analytics/performance` | 성과 분석 | ✅ Active | Analytics API |
| `/analytics/attendance` | 근태 분석 | ✅ Active | Analytics API |
| `/analytics/compensation` | 보상 분석 | ✅ Active | Analytics API |
| `/analytics/gender-pay-gap` | 성별 임금 격차 | ✅ Active | Analytics API |
| `/analytics/team-health` | 팀 건강 | ✅ Active | Analytics API |
| `/analytics/recruitment` | 채용 분석 | ✅ Active | Analytics API |
| `/analytics/report` | AI 보고서 | ✅ Active | Analytics AI API |
| `/analytics/predictive` | 예측 분석 | ✅ Active (HR_ADMIN+ only) | Analytics Predictive API |
| `/compliance` | 컴플라이언스 허브 | ✅ Active | Compliance API |
| `/compliance/gdpr` | GDPR 관리 | ✅ Active | Compliance API |
| `/settings` | 설정 허브 | ✅ Active | Settings API |
| `/settings/*` | 개별 설정 페이지들 | ✅ Active (39 pages) | Settings API |
| `/payroll/me` | 내 급여명세서 (`/my/payslip` nav target) | ⚠️ Nav href mismatch | — |
| `/succession` | 승계 (root, duplicate?) | ⚠️ Possible duplicate of `/talent/succession` | — |
| `/my/settings/notifications` | 알림 수신 설정 | ✅ Active | `/api/v1/notifications/preferences` |
| `/403` | 접근 거부 | ✅ Active | — |
| `/offline` | 오프라인 | ✅ Active | — |

---

## 2. Sidebar IA Coverage

| Section (nav.ts key) | Label | visibleTo | Nav Items | Pages Exist? | Status |
|---------------------|-------|-----------|-----------|-------------|--------|
| `home` | 홈 | ALL_ROLES | 대시보드 (`/home`), 알림 (`/notifications`) | ✅ Both exist | ✅ Full |
| `my-space` | 나의 공간 | ALL_ROLES | 14 items: profile, attendance, leave, goals, payslip, benefits, onboarding, feedback, self-eval, recognition, skills, training, year-end | ✅ All pages exist | ✅ Full |
| `team` | 팀 관리 | MANAGER+ | 8 items: hub, attendance, leave, goals, results, manager-eval, 1:1, skills | ✅ All pages exist | ✅ Full |
| `hr-ops` | 인사 운영 | HR_UP | 16 items: employees, org, attendance-admin, leave-admin, onboarding, checkin, checkins, offboarding, payroll×5, discipline, rewards | ✅ All pages exist | ✅ Full |
| `talent` | 인재 관리 | HR_UP | 14 items: recruitment×3, performance×4, calibration, peer-review, pulse, compensation, benefits, training, succession, skill-matrix | ✅ All pages exist | ✅ Full |
| `insights` | 인사이트 | MANAGER+ | 19 items: kpi-dashboard, analytics×10, compliance×5, directory | ✅ All pages exist | ✅ Full |
| `settings` | 설정 | HR_UP | 1 item in nav (hub only) — 39 dedicated sub-pages not in sidebar | ✅ Hub exists, sub-pages via internal routing | ⚠️ Partial (sub-pages not in sidebar nav) |

### Key Sidebar Observations
- **홈 section**: Renders items directly (no accordion) — `isSingleItemSection` logic in Sidebar.tsx
- **설정 section**: Only 1 nav item (`/settings`); all sub-pages are navigated from within settings hub, not from sidebar directly
- **`/my/settings/notifications`**: Not in sidebar — accessed from within `/my` page
- **Nav href mismatch**: `my-payslip` nav item points to `/payroll/me` ✅ (page exists), but the route is `payroll/me` not `my/payslip`
- **Compliance items**: In the `insights` section but logically belong to HR Ops — architectural decision noted

---

## 3. Engine → UI Wiring

| Engine / Service | API Exists | UI Connected | How | Gap |
|-----------------|-----------|-------------|-----|-----|
| **UnifiedTask** (`/api/v1/unified-tasks`) | ✅ Full API with 5 mappers (Leave, Payroll, Onboarding, Offboarding, Performance) | ❌ No UI consumer | API exists but **zero** `.tsx` files call `/api/v1/unified-tasks` | Need "My Tasks" widget on Home dashboards + dedicated `/my/tasks` page |
| **PendingActions** (`/api/v1/home/pending-actions`) | ✅ API exists | ✅ Connected | `PendingActionsPanel.tsx` in `EmployeeHome`, `ManagerHome`, `HrAdminHome` | Home dashboards call this — partial substitute for UnifiedTask; covers different scope |
| **Event Cascade / EventBus** (`bootstrapEventHandlers`) | ✅ Bootstrap in `instrumentation.ts` | ✅ Backend only (N/A for UI) | Fires on performance lifecycle events (advance, finalize, manager-eval, offboarding task completion) | Backend-only by design. No actionable UI gap. |
| **Nudge Engine** (`checkNudgesForUser`) | ✅ Implemented in `/lib/nudge` | ✅ Lazily connected | `checkNudgesForUser` called **fire-and-forget** inside `/api/v1/notifications/unread-count` — triggers on every NotificationBell poll (60s interval) | Working but invisible to user — no "nudge card" UI on home dashboard showing what nudge fired |
| **Notification Bell** (`NotificationBell.tsx`) | ✅ Polls `/api/v1/notifications/unread-count` every 60s | ✅ Fully wired | In `Header.tsx`, shows badge + popover + "전체 보기" → `/notifications` | Polling only (no SSE/WebSocket) — notifications are real-time only on 60s delay |
| **Notification Center** (`/notifications`) | ✅ Page exists | ✅ Connected | `NotificationsClient.tsx` calls `/api/v1/notifications` | ✅ |
| **Notification Preferences** | ✅ API + UI | ✅ Connected | `/my/settings/notifications` → `NotificationPreferenceClient` → `/api/v1/notifications/preferences` | ✅ |
| **Notification Triggers (Admin)** | ✅ API + UI | ✅ Connected | `/settings/notifications` → `NotificationTriggersClient` → `/api/v1/settings/notification-triggers` | ✅ |
| **Approval Unified Inbox** | ❌ No dedicated page | ❌ Not wired | `ApprovalFlowManagerClient` exists only in `/settings/[category]` (approval-chain config, not inbox) | **No unified approval inbox page** — approvals are module-specific (leave admin, attendance approval) only |

---

## 4. Golden Path UI Completeness

| Golden Path | Steps | Page Coverage | UI Coverage | Missing |
|-------------|-------|--------------|-------------|---------|
| **Leave Pipeline** | Submit → Manager Approve → HR Deduct → Employee Notified | `/leave` (submit) ✅, `/leave/team` (manager view) ✅, `/leave/admin` (HR view) ✅, NotificationBell (notified) ✅ | **~90%** | No unified approval inbox — manager approves from `/leave/team` sidebar, not a dedicated approval queue |
| **Onboarding** | HR Create → Employee Receives Tasks → Complete Checklist → Check-in | `/onboarding` (HR create) ✅, `/onboarding/me` (employee tasks) ✅, `/onboarding/checkin` (check-in) ✅, `/onboarding/checkins` (status) ✅ | **~95%** | "My Onboarding Tasks" not visible on home dashboard (not wired to UnifiedTask widget) |
| **Performance Cycle** | HR Create Cycle → Employees Self-eval → Manager Eval → Calibration → Results | `/settings/performance-cycles` (create) ✅, `/performance/self-eval` ✅, `/performance/manager-eval` ✅, `/performance/calibration` ✅, `/performance/results` ✅ | **~90%** | No "pending self-eval" nudge card on home; cycle advance is API-only (no UI trigger visible to HR) |
| **Offboarding** | HR Initiate → Task Assignment → Task Completion → Archive | `/offboarding` (list) ✅, `/offboarding/[id]` (detail+tasks) ✅ | **~80%** | No employee-facing "my exit tasks" page; offboarding task completion triggers EventBus but no UI confirmation |
| **Payroll Run** | HR Run → AI Anomaly Check → Review → Bank Transfer | `/payroll` (run) ✅, `/payroll/anomalies` ✅, `/payroll/[runId]/review` ✅, `/payroll/bank-transfers` ✅ | **~95%** | ✅ Full pipeline covered |
| **Recruitment** | Create Req → Post → Applicants → Interview → Offer | `/recruitment/requisitions/new` ✅, `/recruitment` ✅, `/recruitment/[id]/applicants` ✅, `/recruitment/[id]/interviews` ✅, `/recruitment/[id]/pipeline` ✅ | **~90%** | No offer letter page; offer flow may be implicit |
| **Calibration** | HR Sets Scale → Manager Rates → Calibration Session → Finalize | `/settings/calibration` ✅, `/settings/evaluation-scale` ✅, `/performance/calibration` ✅, `/performance/results` ✅ | **~85%** | Calibration session participation UI may need peer-view |

---

## 5. Component Inventory

### Components per Module
| Module | File Count |
|--------|-----------|
| `ui/` (shadcn/ui base) | 27 |
| `shared/` (cross-cutting) | 16 |
| `settings/` | 13 |
| `compensation/` | 10 |
| `compliance/` | 7 (large — split by jurisdiction) |
| `payroll/` | 7 |
| `teams/` | 6 |
| `employees/` | 6 |
| `home/` | 5 |
| `analytics/` | 5 |
| `layout/` | 5 |
| `dashboard/` | 4 |
| `succession/` | 4 |
| `recruitment/` | 4 |
| `performance/` | 3 |
| `training/` | 3 |
| `attendance/` | 3 |
| `benefits/` | 2 |
| `org/` | 2 |
| `org-studio/` | 2 |
| `hr-chatbot/` | 2 |
| `manager-hub/` | 1 |
| `command-palette/` | 1 |
| `icons/` | 1 |
| **TOTAL** | **~166 components** |

### Key Shared UI Components (`src/components/ui/`)
`alert-dialog`, `alert`, `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `tooltip`, `switch`, `table`, `tabs`, `textarea` (27 total)

### Key Layout Components (`src/components/layout/`)
| Component | Purpose |
|-----------|---------|
| `Sidebar.tsx` | 7-section accordion sidebar, role-filtered, collapsible |
| `Header.tsx` | Top bar with NotificationBell, search, user menu |
| `NotificationBell.tsx` | **Wired** — polls unread-count (60s), popover with 20 notifications, lazy nudge trigger |
| `MobileBottomNav.tsx` | Mobile navigation bar |
| `LanguageSwitcher.tsx` | i18n language toggle |

### Key Shared Components (`src/components/shared/`)
| Component | Reuse Potential |
|-----------|----------------|
| `DataTable.tsx` | Universal table — used across all list pages |
| `PageHeader.tsx` | Consistent page title + actions layout |
| `EmptyState.tsx` | Empty list states |
| `ModuleGate.tsx` | Feature-flag gating by module |
| `PermissionGate.tsx` | Role-based rendering |
| `DetailPanel.tsx` | Slide-in detail panels |
| `AssignmentTimeline.tsx` | Task/event timelines |
| `WidgetSkeleton.tsx` | Loading skeleton for dashboard widgets |
| `AiGeneratedBadge.tsx` | AI-generated content badge |
| `LoadingSpinner.tsx` | Global loading indicator |
| `PwaInstallBanner.tsx` | PWA install prompt |

---

## 6. Key Gaps (Priority Ordered)

### GAP-1 🔴 UnifiedTask API → No UI Consumer
**Impact: HIGH**
- `/api/v1/unified-tasks` exists with full mappers for Leave, Payroll, Onboarding, Offboarding, Performance
- **Zero UI files call this API**
- Home dashboards use `PendingActionsPanel` (which calls `/api/v1/home/pending-actions`) as a hand-built alternative
- Gap: No "My Tasks" widget driven by UnifiedTask; no `/my/tasks` dedicated page; no cross-module task aggregation visible to user

### GAP-2 🔴 No Unified Approval Inbox
**Impact: HIGH**
- Approvals are fragmented: leave approved in `/leave/team`, attendance in `/approvals/attendance`, entity transfers in `/settings/entity-transfers`
- `ApprovalFlowManagerClient` is only used in `/settings/[category]` for workflow configuration (not an inbox)
- Gap: No `/approvals` or `/approvals/inbox` page aggregating pending approvals across modules

### GAP-3 🟡 Home Dashboard — No UnifiedTask Widget / No Cross-Module Task Summary
**Impact: MEDIUM**
- `EmployeeHome`, `ManagerHome`, `HrAdminHome`, `ExecutiveHome` exist and call `/api/v1/home/summary`
- `PendingActionsPanel` calls `/api/v1/home/pending-actions` and renders actionable items
- But: items are limited to what `getPendingActions()` queries — not backed by UnifiedTask engine
- Gap: Home dashboard widget count ≠ UnifiedTask count; they are 2 separate systems potentially showing inconsistent data

### GAP-4 🟡 Nudge Engine — Invisible to User
**Impact: MEDIUM**
- Nudges fire correctly (lazy, in `unread-count` endpoint) and create notifications
- But: No dedicated "Nudge Center" / "AI Recommendation" card on home dashboard
- User only sees nudges if they open NotificationBell or visit `/notifications`
- Gap: No proactive nudge surface on home; no visual indicator that "AI noticed something"

### GAP-5 🟡 Offboarding — No Employee-Facing Tasks Page
**Impact: MEDIUM**
- HR manages offboarding via `/offboarding` and `/offboarding/[id]`
- `onboarding/me` exists for employee onboarding tasks
- Gap: No `/offboarding/me` or similar page for the departing employee to track their exit tasks

### GAP-6 🟡 `/succession` vs `/talent/succession` — Possible Duplicate
**Impact: LOW-MEDIUM**
- Both `src/app/(dashboard)/succession/page.tsx` and `src/app/(dashboard)/talent/succession/page.tsx` exist
- Navigation config points to `/talent/succession` only
- Gap: `/succession` may be an orphaned legacy route; needs audit

### GAP-7 🟢 Notification Polling — No Real-Time Push
**Impact: LOW**
- `NotificationBell` polls every 60 seconds (setInterval)
- Gap: No SSE (Server-Sent Events) or WebSocket — time-sensitive notifications (emergency leave, payroll deadline) can be delayed up to 60s

### GAP-8 🟢 Settings Sidebar — Single Entry Point
**Impact: LOW**
- Sidebar `설정` section has only 1 nav item (`/settings` hub)
- 39 sub-setting pages are navigated from within the hub, not from sidebar
- Gap: Deep-link navigation to specific settings pages (e.g., `/settings/leave-policies`) has no sidebar highlight/breadcrumb support

### GAP-9 🟢 `/dashboard/compare` — No Nav Entry
**Impact: LOW**
- `src/app/(dashboard)/dashboard/compare/page.tsx` exists
- Not referenced in `navigation.ts`
- Gap: Orphaned comparison page with no navigation path from sidebar

---

## 7. Existing Components Reusable for Stage 5

| Existing Component | Can Be Reused For |
|-------------------|------------------|
| `PendingActionsPanel.tsx` | Refactor as UnifiedTask widget — replace `pending-actions` API call with `unified-tasks` API |
| `NotificationBell.tsx` | Add nudge-type filtering; surface AI nudges with distinct icon (already has `triggerType` in NotificationItem) |
| `DataTable.tsx` | Unified approval inbox list; task list page |
| `DetailPanel.tsx` | Approval detail side panel without page navigation |
| `AssignmentTimeline.tsx` | Offboarding task progress / Onboarding step visualization |
| `WidgetSkeleton.tsx` | Loading states for new Stage 5 dashboard widgets |
| `AiGeneratedBadge.tsx` | Tag nudge-generated notifications on home dashboard |
| `ModuleGate.tsx` + `PermissionGate.tsx` | Gate unified approval inbox to MANAGER+ roles |
| `PageHeader.tsx` | Consistent header for new pages (`/my/tasks`, `/approvals/inbox`) |
| `EmptyState.tsx` | "No pending approvals" / "No tasks" empty states |
| `Sidebar.tsx` accordion pattern | Add new nav items (e.g., "나의 할 일", "승인 요청") without layout changes |
| `Header.tsx` + `NotificationBell` | Can be extended with "task count" badge (separate from notification count) |

---

## 8. Architecture Summary

```
Layouts
  app/layout.tsx              — Root layout (fonts, providers)
  (auth)/layout.tsx           — Auth layout (no sidebar)
  (dashboard)/layout.tsx      — Main layout (Sidebar + Header)
  (dashboard)/settings/layout.tsx — Settings sub-layout

Navigation
  src/config/navigation.ts    — Single source of truth (7 sections, role-filtered)
  src/hooks/useNavigation.ts  — Runtime filtering by role and countryCode
  src/components/layout/Sidebar.tsx — Renders NAVIGATION sections as accordion

Engine Bootstrap
  src/instrumentation.ts      — Next.js register() → bootstrapEventHandlers()
  src/lib/events/bootstrap.ts — EventBus handlers for performance/offboarding lifecycle
  Inline bootstrap             — Also called in performance/offboarding API routes

Notification Pipeline
  NotificationBell (60s poll) → /api/v1/notifications/unread-count → checkNudgesForUser (fire-forget) → creates notifications → next poll shows badge
```

---

*Report generated: 2026-03-09. READ-ONLY analysis. No files were modified.*
