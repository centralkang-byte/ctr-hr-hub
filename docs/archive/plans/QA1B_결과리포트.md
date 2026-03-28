# QA-1B 기능 정합성 감사 리포트 — STEP 6B~9 + AI/Cron/MV

## 감사일: 2026-03-01
## 감사 범위: 코드 레벨 읽기 전용 (수정 없음)

---

## 요약

| 구분 | 전체 | ✅ 완료 | ⚠️ 부분 | ❌ 미구현 |
|------|------|---------|---------|----------|
| STEP 6B (연봉/복리/Attrition/L&D/Succession) | 25 | 22 | 3 | 0 |
| STEP 7 (Payroll/Analytics/알림) | 21 | 19 | 2 | 0 |
| STEP 8 (설정/홈/Teams/Cron/PWA) | 48 | 48 | 0 | 0 |
| STEP 9 (i18n/컴플라이언스/연동/보안) | 31 | 25 | 3 | 3 |
| AI 기능 (11개 스펙 + 3개 보너스) | 14 | 9 | 0 | 5 |
| Cron (3개 스펙 + 1 보너스) | 4 | 4 | 0 | 0 |
| MV (8개) | 8 | 8 | 0 | 0 |
| **합계** | **151** | **135 (89%)** | **8 (5%)** | **8 (5%)** |

---

## STEP 6B: 연봉·보상 + 복리후생 + Attrition + L&D + Succession

### 6B-① 연봉·보상

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 6B-1 | 급여 밴드 관리 | /settings/salary-bands | ✅ | 688줄, CRUD + Compa-Ratio 5단계 컬러 |
| 6B-2 | 연봉 조정 매트릭스 | /settings/salary-matrix | ✅ | 603줄, 3×3 (Performance×Compa) 9블록, 이전 사이클 복사 |
| 6B-3 | 연봉 조정 시뮬레이션 | /compensation | ✅ | SimulationTab + ConfirmTab + HistoryTab |
| 6B-4 | AI 연봉 추천 | lib/claude.ts | ✅ | `compensationRecommendation()` — compaRatio/emsBlock/tenureMonths/budgetConstraint |
| 6B-5 | 연봉 조정 확정 | /compensation | ✅ | ConfirmTab에서 일괄 승인 |
| 6B-6 | 연봉 이력 조회 | /employees/[id] | ⚠️ | 탭 존재하나 "coming soon" EmptyState — API/모델은 구현됨 |
| 6B-7 | 보상 구조 | (보상 내) | ✅ | CompensationHistory Prisma 모델 + API |

### 6B-② 복리후생

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 6B-8 | 복리후생 정책 관리 | /benefits | ✅ | BenefitPoliciesTab + BenefitEnrollmentsTab |
| 6B-9 | 직원 복리후생 | /benefits | ✅ | 탭으로 통합 처리 |
| 6B-10 | 복리후생 관리 (HR) | /benefits | ✅ | 탭으로 통합 처리 |
| 6B-11 | 수당 기록 | (payroll 내부) | ⚠️ | AllowanceRecord 모델은 payroll calculator에서 사용, 별도 CRUD API 없음 |

### 6B-③ Attrition Risk

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6B-12 | 위험 점수 산출 | ✅ | 6요인 모델 구현 |
| 6B-13 | AI 보정 | ✅ | `attritionRiskAssessment()` — 6요인+compaRatio+emsBlock |
| 6B-14 | Attrition 대시보드 | ✅ | KPI + 도넛 + 히트맵 + 추이 + 고위험 목록 |
| 6B-15 | 매니저 뷰 | ✅ | ManagerInsightsHub에서 attritionRisk 카운트 표시 |
| 6B-16 | 예측 정확도 피드백 | ✅ | AttritionRiskHistory 모델 + 퇴직 연동 |

### 6B-④ L&D 교육관리

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 6B-17 | 교육 과정 관리 | /training | ✅ | CoursesTab + EnrollmentsTab (설정 분리 없이 직접 관리) |
| 6B-18 | 수강 현황 | /training/enrollments | ✅ | 별도 라우트 |
| 6B-19 | 직원 교육 | /training | ✅ | 탭으로 통합 |
| 6B-20 | 매니저 교육 현황 | /training | ✅ | 탭으로 통합 |
| 6B-21 | 교육→성과 연계 | (프로필 내) | ⚠️ | 별도 연계 UI 없음 — 데이터는 모델 레벨에서 연결 |

### 6B-⑤ Succession Planning

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 6B-22 | 핵심 직책 관리 | /succession | ✅ | PlansTab (258줄) |
| 6B-23 | 후계자 후보 관리 | /succession | ✅ | PlanDetailDialog + CandidateCard |
| 6B-24 | EMS 연계 | /succession | ✅ | 후보 적격성 데이터 포함 |
| 6B-25 | Succession 대시보드 | /succession | ✅ | SuccessionDashboard (164줄) + API |

---

## STEP 7: Payroll + HR Analytics + 알림

### 7-① Payroll 급여처리

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 7-1 | 급여 실행 관리 | /payroll | ⚠️ | 5단계: DRAFT→CALCULATING→REVIEW→APPROVED→PAID (스펙 6단계와 명칭 차이) |
| 7-2 | 급여 계산 엔진 | lib/payroll/ | ✅ | calculator.ts + 기본급+수당-공제 |
| 7-3 | 한국 4대보험 | lib/payroll/kr-tax.ts | ✅ | 국민연금 4.5%, 건보 3.545%, 장기요양 12.81%, 고용 0.9% |
| 7-4 | 국가별 세율 | src/lib/tax/ | ✅ | kr/cn/ru/us/vn/mx/pl 7개국 |
| 7-5 | AI 이상 감지 | lib/payroll/ai-anomaly.ts | ✅ | callClaude() 호출 — claude.ts 외부 분리 구조 |
| 7-6 | 급여 검토+승인 | /payroll/[runId]/review | ✅ | PayrollReviewClient |
| 7-7 | 급여 명세서 | /payroll/me | ✅ | PayrollMeClient + PayStubDetailClient |
| 7-8 | PDF 생성 | lib/payroll/pdf.ts | ✅ | 147줄, 한국 급여명세서 HTML→PDF |
| 7-9 | 퇴직금 정산 | lib/payroll/severance.ts | ✅ | SeveranceCalculator 컴포넌트 + 계산 로직 |

### 7-② HR Analytics (10개 대시보드)

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 7-10 | Analytics 메인 | /analytics | ✅ | AnalyticsOverviewClient |
| 7-11 | 인력 분석 | /analytics/workforce | ✅ | |
| 7-12 | 이직 분석 | /analytics/turnover | ✅ | |
| 7-13 | 성과 분석 | /analytics/performance | ✅ | EMS 3×3 읽기전용 그리드 포함 |
| 7-14 | 근태 분석 | /analytics/attendance | ✅ | |
| 7-15 | 채용 분석 | /analytics/recruitment | ✅ | |
| 7-16 | 보상 분석 | /analytics/compensation | ✅ | |
| 7-17 | 팀 건강 분석 | /analytics/team-health | ✅ | BurnoutBadge 컴포넌트 |
| 7-18 | AI Executive Summary | /analytics/report | ✅ | ai-report.ts — 12개 MV 데이터 → Claude 생성 |
| 7-19 | 성별 급여 격차 | /analytics/gender-pay-gap | ✅ | 스펙 외 추가 구현 |

### 7-③ 알림 시스템

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 7-20 | 알림 트리거 관리 | ✅ | /settings/notifications + NotificationTriggersClient |
| 7-21 | 벨 아이콘+드롭다운 | ✅ | NotificationBell (210줄) — unread badge + 최근 20건 |
| 7-22 | 알림 목록 페이지 | ✅ | /notifications + NotificationsClient |

---

## STEP 8: 고도화 & 자동화

### 8-① 설정 (18개 페이지)

모든 18개 설정 페이지 ✅ 확인:
branding, terms, enums, custom-fields, workflows, email-templates, evaluation-scale, modules, export-templates, dashboard-widgets, audit-logs, monitoring, data-migration, m365, contract-rules, entity-transfers, payroll-items, tax-brackets

### 8-② Task-Centric 홈 + Manager Hub + 챗봇

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 8-12 | Task-Centric 홈 | ✅ | PendingActionsPanel — HrAdminHome/ManagerHome에서 사용 |
| 8-13 | Manager Insights Hub | ✅ | 5개 API (summary/alerts/pending-approvals/performance/team-health) |
| 8-14 | HR 챗봇 UI | ✅ | HrChatbot.tsx |
| 8-15 | 챗봇 RAG 엔진 | ✅ | vector-search.ts (pgvector `<=>`) + embedding.ts (text-embedding-3-small) |
| 8-16 | HR 문서 관리 | ✅ | HrDocumentManager.tsx |
| 8-17 | Command Palette | ✅ | CommandPalette.tsx (321줄) |

### 8-③ Teams 연동 (13개)

모든 Teams 연동 항목 ✅ 확인:
- `microsoft-graph.ts` (262줄), `teams-bot.ts` (226줄), `teams-actions.ts` (166줄), `adaptive-cards.ts` (333줄)
- Teams API: bot/channels/config/digest/recognition/webhook
- TeamsIntegration/TeamsCardAction Prisma 모델
- NotificationChannel enum: IN_APP/EMAIL/TEAMS
- `public/teams-manifest.json`
- 5개 Teams 컴포넌트 (AdaptiveCardPreview, DigestPreview 등)

### 8-④ Cron + PWA

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 8-32 | Calendar Scheduler | ✅ | calendar-scheduler.ts (Outlook 연동) |
| 8-33 | 연차 촉진 Cron | ✅ | cron/leave-promotion — 60/30/10일 3단계 |
| 8-34 | 조직도 스냅샷 Cron | ✅ | cron/org-snapshot — 월간 |
| 8-35 | 평가 미이행 알림 Cron | ✅ | cron/eval-reminder — D-7/D-3/D-day |
| 8-36 | PWA manifest | ✅ | public/manifest.json + sw.js |
| 8-37 | Push 구독 | ✅ | PushSubscription 모델 + web-push.ts + API |
| 8-38 | PwaInstallBanner | ✅ | 컴포넌트 존재 |
| 보너스 | GDPR 보존기간 Cron | ✅ | compliance/cron/retention |

---

## STEP 9: 다국어 + 컴플라이언스 + 연동 + 보안

### 9-① i18n

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 9-1 | next-intl 설정 | ✅ | createNextIntlPlugin + src/i18n/request.ts |
| 9-2 | 7개 언어 메시지 파일 | ⚠️ | ko/en/zh/ru/vi/es/**pt** — **pl(폴란드) 대신 pt(포르투갈)** |
| 9-3 | 번역 키 수 | ✅ | **2,638개** 리프 키 × 7개 언어 = 18,466 키 |
| 9-4 | 언어 선택기 | ✅ | LanguageSwitcher 컴포넌트 |
| 9-5 | 포맷터 | ✅ | src/lib/i18n/formatters.ts |
| 9-6 | HR 용어 사전 | ✅ | src/lib/i18n/ko.ts + locale-config.ts |
| 9-7 | API 에러 다국어 | ⚠️ | 에러 메시지 번역 키 일부만 적용 |

### 9-② 국가별 컴플라이언스

모든 17개 항목 ✅ 확인:
- 8개 페이지: /compliance (메인), /kr, /ru, /cn, /gdpr, /data-retention, /dpia, /pii-audit
- KR 컴포넌트: SeveranceInterimForm, MandatoryTrainingTab, WorkHoursEmployeeList
- RU 컴포넌트: RuReportsTab, MilitaryRegistrationTab, KedoDocumentsTab, KedoSignDialog
- CN 컴포넌트: SocialInsuranceReportTab, EmployeeRegistryTab

### 9-③ 외부 시스템 연동

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 9-14 | M365 설정 | ✅ | /settings/m365 페이지 |
| 9-15 | 더존 ERP | ❌ | 미구현 (CLAUDE.md: "급여: 외부 연동") |
| 9-16 | SAP | ❌ | 미구현 |
| 9-17 | eformsign | ❌ | 미구현 — KEDO 서명이 대체 |
| 보너스 | KPMG 인터페이스 | ✅ | payroll/kpmg-interface.ts (폴란드 급여) |
| 보너스 | Bank Transfer | ✅ | integrations/bank-transfer.ts |
| 보너스 | M365 Account | ✅ | integrations/m365-account.ts |

### 9-④ 보안/성능

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 9-19 | 교대근무 | ✅ | /settings/shift-patterns + /attendance/shift-calendar |
| 9-21 | 은행 자동이체 | ✅ | /payroll/bank-transfers + BankTransferBatch 모델 |
| 9-22 | M365 계정 비활성화 | ✅ | integrations/m365-account.ts |
| 9-23 | RLS (Row Level Security) | ❌ | **마이그레이션에 RLS 정책 0건** — 앱 레이어에서만 company_id 격리 |
| 9-24 | MV refresh | ⚠️ | 8개 MV 정의 완료, pg_cron 스케줄은 주석 상태 |

---

## AI 기능 전수 점검

| # | 기능 | STEP | 함수명 (실제) | 상태 |
|---|------|------|-------------|------|
| AI-1 | 이력서 스크리닝 | 5 | `analyzeResume` | ✅ |
| AI-2 | 평가 코멘트 | 6A | — | ❌ enum만 존재 |
| AI-3 | 캘리브레이션 분석 | 6A | — | ❌ enum만 존재 |
| AI-4 | 1:1 미팅 노트 | 6A | — | ❌ enum만 존재 |
| AI-5 | Pulse 분석 | 6A | — | ❌ enum만 존재 |
| AI-6 | 다면평가 요약 | 6A | — | ❌ enum만 존재 |
| AI-7 | 연봉 추천 | 6B | `compensationRecommendation` | ✅ |
| AI-8 | Attrition 예측 | 6B | `attritionRiskAssessment` | ✅ |
| AI-9 | 급여 이상 감지 | 7 | `payrollAnomalyCheck` (ai-anomaly.ts) | ✅ |
| AI-10 | Executive Summary | 7 | `generateExecutiveReport` (ai-report.ts) | ✅ |
| AI-11 | HR 챗봇 RAG | 8 | pgvector + callClaude | ✅ |
| B-1 | 온보딩 체크인 요약 | 3 | `onboardingCheckinSummary` | ✅ |
| B-2 | JD 자동 생성 | 5 | `generateJobDescription` | ✅ |
| B-3 | 퇴직 면담 요약 | 3 | `exitInterviewSummary` | ✅ |

> **AiFeature enum에만 등록된 미구현 키워드:** ONE_ON_ONE_GUIDE, ONE_ON_ONE_SUMMARY, PULSE_INSIGHT, SELF_EVAL_DRAFT, BIAS_DETECT, GOAL_DRAFT, TRAINING_RECOMMEND, ATTRITION_RISK_CALC

---

## Cron Job 전수 점검

| # | Cron | 경로 | 상태 |
|---|------|------|------|
| C-1 | 연차 촉진 3단계 | api/v1/cron/leave-promotion | ✅ |
| C-2 | 조직도 스냅샷 | api/v1/cron/org-snapshot | ✅ |
| C-3 | 평가 미이행 알림 | api/v1/cron/eval-reminder | ✅ |
| C-4 | GDPR 보존기간 | api/v1/compliance/cron/retention | ✅ (보너스) |
| C-5 | MV refresh (8개) | pg_cron (mv_analytics.sql) | ⚠️ 주석 상태 |
| C-6 | cron-auth 유틸 | lib/cron-auth.ts | ✅ verifyCronSecret |

---

## MV (Materialized View) 전수 점검

| # | MV | 인덱스 | pg_cron 스케줄 | 상태 |
|---|-----|--------|---------------|------|
| MV-1 | mv_headcount_daily | uq_headcount | 04:00 KST daily | ✅ |
| MV-2 | mv_attendance_weekly | uq_att_weekly | 15:00 KST Mon | ✅ |
| MV-3 | mv_performance_summary | uq_perf_summary | 04:30 KST daily | ✅ |
| MV-4 | mv_recruitment_funnel | uq_recruit_funnel | 05:00 KST daily | ✅ |
| MV-5 | mv_burnout_risk | uq_burnout_risk | 05:30 KST daily | ✅ |
| MV-6 | mv_team_health | uq_team_health | 06:00 KST daily | ✅ |
| MV-7 | mv_exit_reason_monthly | uq_exit_reason | 04:00 KST daily | ✅ |
| MV-8 | mv_compa_ratio_distribution | uq_compa_dist | 04:30 KST daily | ✅ |

> 모든 MV에 UNIQUE INDEX 존재 (CONCURRENT refresh 지원). pg_cron 스케줄은 주석 상태로 수동 활성화 필요.

---

## 판정 요약

### 🔴 Critical — 즉시 조치 필요

1. **RLS 정책 0건** — PostgreSQL 레벨 Row Level Security 미적용. multi-tenant company_id 격리가 앱 레이어에만 의존. 최소 employees, payroll_runs, payroll_items 테이블에 RLS 필요.

2. **AI 함수 5건 미구현** (STEP 6A 전체)
   - suggestEvalComment, calibrationAnalysis, generateOneOnOneNotes, pulseSurveyAnalysis, generatePeerReviewSummary
   - AiFeature enum에만 등록되어 있고 실제 로직/API 없음

3. **STEP 6A CFR/Pulse/다면평가 전체 미구현** (QA-1A에서 이미 식별) — UI/API 모두 없음

### 🟡 Non-Critical — 차후 보완

1. Payroll 상태머신 명칭 차이 (REVIEW vs REVIEWING, PROCESSING 없음)
2. Employee 프로필 보상 이력 탭 "coming soon"
3. AllowanceRecord 별도 CRUD API 없음 (payroll 내부에서만 사용)
4. 폴란드(pl) UI 언어 없음 — 포르투갈(pt)로 대체됨
5. ERP/SAP/Douzone 연동 미구현 (의도적 — "급여: 외부 연동")
6. pg_cron 스케줄 주석 상태 (DB 배포 시 활성화 필요)

### 🟢 양호

- STEP 6B: 22/25 (88%) — Attrition/Succession 완전 구현
- STEP 7: 19/21 (90%) — Payroll/Analytics 10개 대시보드 완전
- STEP 8: 48/48 (100%) — 설정/Teams/Cron/PWA 전원 완료
- STEP 9 컴플라이언스: 17/17 (100%) — KR/RU/CN/GDPR 완전
- Cron/MV: 전원 정의 완료
