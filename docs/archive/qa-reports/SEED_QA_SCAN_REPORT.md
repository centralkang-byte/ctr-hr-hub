# Seed QA — Empty Menu Scan Report
# Generated: 2026-03-10

> **Method:** Static code tracing — navigation.ts → page.tsx → Client component → API route.ts → Prisma models → seed files 02~09  
> **No dev server or API calls were made. Read-only analysis only.**

---

## Summary

| Metric | Count |
|--------|------:|
| Total menus | 42 |
| PASS ✅ | 22 |
| EMPTY ❌ | 15 |
| PARTIAL ⚠️ | 5 |

> Note: 42 menus counted from `navigation.ts` (country-filtered items counted once; `settings` hub counted as 1).

---

## EMPTY Menus (Need Seed Data)

| # | Section | Menu Label | Route | Primary Prisma Model(s) | Why Empty |
|---|---------|-----------|-------|-------------------------|-----------|
| 1 | 인사 관리 | 징계/포상 | `/discipline` | `DisciplinaryAction`, `RewardRecord` | No seed data in 02~09. `/api/v1/disciplinary` and `/api/v1/rewards` return empty arrays. |
| 2 | 채용 | 채용 대시보드 | `/recruitment/dashboard` | `JobPosting`, `Application` | No JobPosting or Application seed data exists. API returns zeros everywhere. |
| 3 | 채용 | 칸반 보드 | `/recruitment/board` | `JobPosting`, `Application` | Same as above — no posting/application data. |
| 4 | 채용 | 인재 풀 | `/talent/succession` | `SuccessionPlan`, `SuccessionCandidate` | `/api/v1/succession/plans` queries `successionPlan` — zero records seeded. |
| 5 | 성과/보상 | 동료 평가 | `/performance/peer-review` | `PeerReviewNomination` | `/api/v1/peer-review/nominations` — no seed data for `peerReviewNomination`. |
| 6 | 성과/보상 | 보상 관리 | `/compensation` | `SalaryBand`, `CompensationHistory`, `SalaryAdjustmentMatrix` | `/api/v1/compensation/*` — none of these models appear in seeds 02~09. |
| 7 | 성과/보상 | 복리후생 관리 | `/benefits` | `BenefitPlan`, `BenefitClaim`, `BenefitBudget` | `/api/v1/benefit-plans`, `benefit-claims`, `benefit-budgets` — no seed data. |
| 8 | 나의 공간 | 복리후생 | `/my/benefits` | `BenefitPlan`, `BenefitClaim` | Same as above — no benefit seed data. |
| 9 | 급여 | 글로벌 급여 | `/payroll/global` | `PayrollRun`, `ExchangeRate` | `ExchangeRate` model not seeded. `/api/v1/payroll/global` queries exchange rates — returns empty. |
| 10 | 급여 | 급여 이상 탐지 | `/payroll/anomalies` | `PayrollItem`, `SalaryBand`, `ExchangeRate` | `SalaryBand` not seeded → anomaly detection returns no comparison data. |
| 11 | 급여 | 연말정산 (HR) | `/payroll/year-end` | `YearEndSettlement`, `YearEndDeduction`, `YearEndDependent`, `WithholdingReceipt` | `/api/v1/year-end/hr/settlements` — none of these models seeded. |
| 12 | 나의 공간 | 연말 정산 | `/my/year-end` | `YearEndSettlement` | Same — no year-end seed data. |
| 13 | 컴플라이언스 | GDPR/개인정보 | `/compliance/gdpr` | `GdprConsent`, `GdprRequest`, `PiiAccessLog`, `DpiaRecord`, `DataRetentionPolicy` | All compliance models have zero seed data. |
| 14 | 컴플라이언스 | 데이터 보관 | `/compliance/data-retention` | `DataRetentionPolicy` | `/api/v1/compliance/gdpr/retention-policies` — not seeded. |
| 15 | 컴플라이언스 | DPIA | `/compliance/dpia` | `DpiaRecord` | `/api/v1/compliance/gdpr/dpia` — not seeded. |

---

## PARTIAL Menus (Need Additional Seed Data)

| # | Section | Menu Label | Route | What Exists | What's Missing |
|---|---------|-----------|-------|-------------|----------------|
| 1 | 성과/보상 | 캘리브레이션 | `/performance/calibration` | 1 CalibrationSession (2025-H2) seeded in 05-performance.ts | `CalibrationAdjustment` records not seeded — adjustment panel shows empty |
| 2 | 인사이트 | 팀 헬스 | `/analytics/team-health` | Attendance exists (03), employees exist | `teamHealthScore`, `burnoutScore` computed models not pre-calculated — page renders but charts may show zeros until `POST /api/v1/analytics/calculate` is triggered |
| 3 | 인사이트 | 번아웃 감지 | `/analytics/attrition` | `AttritionRiskHistory` queried | `AttritionRiskHistory` not seeded — needs recalculation trigger or seed data |
| 4 | 급여 | 급여 시뮬레이션 | `/payroll/simulation` | Employees + PayrollItems exist | `PayrollSimulation` records not seeded — input form works but no saved simulations shown |
| 5 | 컴플라이언스 | PII 감사 | `/compliance/pii-audit` | `PiiAccessLog` model exists | Zero `piiAccessLog` records — list displays empty (expected to auto-populate on real usage) |

---

## PASS Menus (Data Exists)

| # | Section | Menu Label | Route | Data Source |
|---|---------|-----------|-------|-------------|
| 1 | 홈 | 대시보드 | `/home` | 02-employees.ts, 03-attendance.ts, 04-leave.ts |
| 2 | 홈 | 알림 | `/notifications` | 08-notifications.ts (262 records) |
| 3 | 홈 | 승인함 | `/approvals/inbox` | 04-leave.ts (LeaveRequest approvals) |
| 4 | 나의 공간 | 내 프로필 | `/my/profile` | 02-employees.ts + 09-qa-fixes.ts (profileExtension) |
| 5 | 나의 공간 | 출퇴근 | `/attendance` | 03-attendance.ts (12,369 + 620 records) |
| 6 | 나의 공간 | 휴가 신청 | `/leave` | 04-leave.ts (255 requests, 384 balances) |
| 7 | 나의 공간 | 급여명세서 | `/payroll/me` | 06-payroll.ts + 09-qa-fixes.ts (459 payslips) |
| 8 | 나의 공간 | 목표/평가 | `/performance` | 05-performance.ts (524 goals, 128 evals) |
| 9 | 나의 공간 | 나의 퇴직처리 | `/my/offboarding` | 07-lifecycle.ts (2 offboarding processes) |
| 10 | 팀 관리 | 팀 현황 | `/manager-hub` | 02-employees.ts, 03-attendance.ts |
| 11 | 팀 관리 | 팀 근태 | `/attendance/team` | 03-attendance.ts |
| 12 | 팀 관리 | 팀 휴가 | `/leave/team` | 04-leave.ts |
| 13 | 팀 관리 | 팀 목표/성과 | `/performance/team-goals` | 05-performance.ts (MboGoal, APPROVED) |
| 14 | 팀 관리 | 매니저 평가 | `/performance/manager-eval` | 05-performance.ts (PerformanceEvaluation MANAGER type) |
| 15 | 팀 관리 | 1:1 미팅 | `/performance/one-on-one` | 08-notifications.ts triggers; OneOnOne model needs seed → **edge case** — see note |
| 16 | 인사 관리 | 직원 관리 | `/employees` | 02-employees.ts (138 employees) |
| 17 | 인사 관리 | 구성원 디렉토리 | `/directory` | 02-employees.ts + 09-qa-fixes.ts (profileExtension) |
| 18 | 인사 관리 | 조직 관리 | `/org` | 02-employees.ts (dept + position hierarchy) |
| 19 | 인사 관리 | 근태 관리 | `/attendance/admin` | 03-attendance.ts |
| 20 | 인사 관리 | 휴가 관리 | `/leave/admin` | 04-leave.ts |
| 21 | 인사 관리 | 온보딩/오프보딩 | `/onboarding` | 07-lifecycle.ts (4 onboarding, 2 offboarding) |
| 22 | 인사이트 | HR KPI 대시보드 | `/dashboard` | Aggregated from existing employee/leave/attendance/payroll |

> **Note on 1:1 미팅:** `OneOnOne` model is not seeded. The page renders but the meeting list will be empty. Add to PARTIAL if you want to count it — left as PASS since the page framework works and the form is functional.

---

## Key Findings

### Highest Priority (Revenue/Compliance Impact)
1. **Compensation (`SalaryBand` + `CompensationHistory`)** — blocks `/compensation` and payroll anomaly detection
2. **Benefits (`BenefitPlan` + `BenefitClaim`)** — blocks 2 menus (admin + my/benefits)
3. **Recruitment (`JobPosting` + `Application`)** — blocks 2 menus (dashboard + kanban)

### Medium Priority
4. **Succession (`SuccessionPlan`)** — 1 menu empty
5. **Year-End Settlement** — 2 menus empty (HR admin + employee self-service)
6. **Peer Review** — 1 menu empty

### Low Priority (by design or auto-populated)
7. **Discipline/Rewards** — intentionally empty until actual events occur
8. **GDPR/Compliance** — expected to be empty in dev; real data populated by usage
9. **Analytics computed scores** — trigger `POST /api/v1/analytics/calculate` to pre-populate

---

## Recommended Seed Files to Create

| New File | Models to Seed | Menus Unlocked |
|----------|---------------|----------------|
| `prisma/seeds/10-recruitment.ts` | `JobPosting` (5~10), `Application` (20~30) per posting | `/recruitment`, `/recruitment/dashboard`, `/recruitment/board` |
| `prisma/seeds/11-compensation.ts` | `SalaryBand` (per grade), `CompensationHistory` (per employee) | `/compensation`, `/payroll/anomalies` |
| `prisma/seeds/12-benefits.ts` | `BenefitPlan` (5~8 plans), `BenefitClaim` (per employee) | `/benefits`, `/my/benefits` |
| `prisma/seeds/13-succession.ts` | `SuccessionPlan` (3~5), `SuccessionCandidate` | `/talent/succession` |
| `prisma/seeds/14-peer-review.ts` | `PeerReviewNomination` (using existing performanceCycle 2025-H2) | `/performance/peer-review` |
| `prisma/seeds/15-year-end.ts` | `YearEndSettlement` (for KR employees, 2024 tax year) | `/payroll/year-end`, `/my/year-end` |

> Discipline/Rewards, GDPR/Compliance left unseeded intentionally — these are event-driven and not expected to have pre-populated data.
