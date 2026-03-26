# R7~R9: STEP 7~9 FLEX 디자인 통일 리팩토링

## Context

R1~R6에서 STEP 1~6A 파일을 FLEX 디자인(green `#00C853`, hex 기반)으로 전환 완료했다.
STEP 7~9 파일은 CLAUDE.md의 이전 디자인(blue-600, slate, shadow-sm)으로 개발되었다.
QA-3 감사 결과, R1~R6 파일은 금지패턴 0건이나 미리팩 파일 143개에 2,130건 잔존.
**tailwind.config.ts의 `ctr-primary: '#00C853'`이 최종 기준**이므로 전체 통일이 필요하다.

또한 CLAUDE.md 섹션 3(디자인 토큰)이 아직 blue-600/slate 기반이므로 업데이트 필요.

---

## 변환 매핑 테이블

### Neutrals (slate → hex)

| Before | After | 용도 |
|--------|-------|------|
| `text-slate-900` | `text-[#1A1A1A]` | 제목, 주요 텍스트 |
| `text-slate-800` | `text-[#1A1A1A]` | 제목 |
| `text-slate-700` | `text-[#333]` | 강조 텍스트 |
| `text-slate-600` | `text-[#555]` | 본문 텍스트 |
| `text-slate-500` | `text-[#666]` | 보조 텍스트 |
| `text-slate-400` | `text-[#999]` | 약화 텍스트, 플레이스홀더 |
| `text-slate-300` | `text-[#D4D4D4]` | 비활성 |
| `bg-slate-900` | `bg-[#111]` | 다크 배경 |
| `bg-slate-50` | `bg-[#FAFAFA]` | 카드 배경, 호버 |
| `bg-slate-100` | `bg-[#F5F5F5]` | 약간 어두운 배경 |
| `bg-slate-200` | `bg-[#E8E8E8]` | 구분선 배경 |
| `border-slate-200` | `border-[#E8E8E8]` | 표준 보더 |
| `border-slate-300` | `border-[#D4D4D4]` | 인풋 보더 |
| `border-slate-100` | `border-[#F5F5F5]` | 연한 보더 |
| `hover:bg-slate-50` | `hover:bg-[#FAFAFA]` | 호버 |
| `hover:bg-slate-100` | `hover:bg-[#F5F5F5]` | 호버 |
| `placeholder:text-slate-400` | `placeholder:text-[#999]` | 플레이스홀더 |

### Primary (blue → green)

| Before | After | 용도 |
|--------|-------|------|
| `bg-blue-600` | `bg-[#00C853]` | 프라이머리 버튼 |
| `bg-blue-700` | `bg-[#00A844]` | 호버 상태 |
| `bg-blue-500` | `bg-[#00C853]` | 프라이머리 |
| `bg-blue-50` | `bg-[#E8F5E9]` | 프라이머리 라이트 배경 |
| `bg-blue-100` | `bg-[#E8F5E9]` | 프라이머리 라이트 |
| `text-blue-600` | `text-[#00C853]` | 프라이머리 텍스트, 링크 |
| `text-blue-700` | `text-[#00A844]` | 프라이머리 다크 텍스트 |
| `text-blue-500` | `text-[#00C853]` | 프라이머리 텍스트 |
| `text-blue-800` | `text-[#00A844]` | 다크 프라이머리 |
| `border-blue-600` | `border-[#00C853]` | 프라이머리 보더 |
| `border-blue-500` | `border-[#00C853]` | 프라이머리 보더 |
| `border-blue-200` | `border-[#E8F5E9]` | 프라이머리 라이트 보더 |
| `ring-blue-500` | `ring-[#00C853]/10` | 포커스 링 |
| `focus:ring-blue-500` | `focus:ring-[#00C853]/10` | 포커스 |
| `focus:border-blue-500` | `focus:border-[#00C853]` | 포커스 보더 |
| `hover:bg-blue-700` | `hover:bg-[#00A844]` | 호버 |
| `hover:bg-blue-50` | `hover:bg-[#E8F5E9]` | 라이트 호버 |

### Semantic (유지하되 hex로 전환)

| Before | After | 용도 |
|--------|-------|------|
| `bg-emerald-50` | `bg-[#D1FAE5]` | 성공 배경 |
| `bg-emerald-600` | `bg-[#059669]` | 승인 버튼 |
| `bg-emerald-700` | `bg-[#047857]` | 승인 호버 |
| `text-emerald-600` | `text-[#059669]` | 성공 텍스트 |
| `text-emerald-700` | `text-[#047857]` | 성공 강조 |
| `border-emerald-200` | `border-[#A7F3D0]` | 성공 보더 |
| `bg-amber-50` | `bg-[#FEF3C7]` | 경고 배경 |
| `text-amber-700` | `text-[#B45309]` | 경고 텍스트 |
| `border-amber-200` | `border-[#FCD34D]` | 경고 보더 |
| `bg-indigo-50` | `bg-[#E0E7FF]` | AI/정보 배경 |
| `text-indigo-700` | `text-[#4338CA]` | AI/정보 텍스트 |
| `border-indigo-200` | `border-[#C7D2FE]` | AI/정보 보더 |
| `text-red-500` | 유지 또는 `text-[#EF4444]` | 폼 에러 |
| `bg-red-50` | `bg-[#FEE2E2]` | 위험 배경 |
| `text-red-700` | `text-[#B91C1C]` | 위험 텍스트 |
| `border-red-200` | `border-[#FECACA]` | 위험 보더 |

### Shadow & Radius

| Before | After |
|--------|-------|
| `shadow-sm` | 제거 |
| `shadow-md` | 제거 |
| `shadow-lg` | 제거 (모달 제외) |
| `shadow-xl` | 제거 (모달 제외) |

### Gray (Tailwind 기본 gray)

| Before | After |
|--------|-------|
| `bg-gray-50` | `bg-[#FAFAFA]` |
| `bg-gray-100` | `bg-[#F5F5F5]` |
| `text-gray-500` | `text-[#666]` |
| `text-gray-700` | `text-[#333]` |
| `border-gray-200` | `border-[#E8E8E8]` |
| `border-gray-300` | `border-[#D4D4D4]` |

---

## 세션 분할 (6세션)

### Session R7: Analytics + Home (19 files)

**Analytics Client Pages (11):**
- `src/app/(dashboard)/analytics/AnalyticsOverviewClient.tsx`
- `src/app/(dashboard)/analytics/attendance/AttendanceAnalyticsClient.tsx`
- `src/app/(dashboard)/analytics/attrition/AttritionRiskClient.tsx`
- `src/app/(dashboard)/analytics/compensation/CompensationAnalyticsClient.tsx`
- `src/app/(dashboard)/analytics/gender-pay-gap/GenderPayGapClient.tsx`
- `src/app/(dashboard)/analytics/performance/PerformanceClient.tsx`
- `src/app/(dashboard)/analytics/recruitment/RecruitmentAnalyticsClient.tsx`
- `src/app/(dashboard)/analytics/executive-report/ExecutiveReportClient.tsx`
- `src/app/(dashboard)/analytics/team-health/TeamHealthClient.tsx`
- `src/app/(dashboard)/analytics/turnover/TurnoverClient.tsx`
- `src/app/(dashboard)/analytics/workforce/WorkforceClient.tsx`

**Analytics Components (5):**
- `src/components/analytics/AnalyticsKpiCard.tsx`
- `src/components/analytics/AnalyticsPageLayout.tsx`
- `src/components/analytics/BurnoutBadge.tsx`
- `src/components/analytics/ChartCard.tsx`
- `src/components/analytics/EmptyChart.tsx`

**Home Components (3):**
- `src/components/home/ExecutiveHome.tsx`
- `src/components/home/HrAdminHome.tsx`
- `src/components/home/PendingActionsPanel.tsx`

### Session R8-A: Payroll + Compensation + Succession (21 files)

**Payroll Pages (5):**
- `src/app/(dashboard)/payroll/PayrollClient.tsx`
- `src/app/(dashboard)/payroll/[runId]/review/PayrollReviewClient.tsx`
- `src/app/(dashboard)/payroll/me/PayrollMeClient.tsx`
- `src/app/(dashboard)/payroll/me/[runId]/PayStubDetailClient.tsx`
- `src/app/(dashboard)/payroll/bank-transfers/BankTransfersClient.tsx`

**Payroll Components (7):**
- `src/components/payroll/PayrollStatusBadge.tsx`
- `src/components/payroll/PayStubBreakdown.tsx`
- `src/components/payroll/PayrollKpiCards.tsx`
- `src/components/payroll/PayrollCreateDialog.tsx`
- `src/components/payroll/PayrollAdjustDialog.tsx`
- `src/components/payroll/AnomalyPanel.tsx`
- `src/components/payroll/SeveranceCalculator.tsx`

**Compensation Components (5):**
- `src/components/compensation/SimulationTab.tsx`
- `src/components/compensation/ConfirmTab.tsx`
- `src/components/compensation/HistoryTab.tsx`
- `src/components/compensation/HighRiskList.tsx`
- `src/components/compensation/AttritionKpiCards.tsx`

**Succession Components (4):**
- `src/components/succession/PlansTab.tsx`
- `src/components/succession/PlanDetailDialog.tsx`
- `src/components/succession/CandidateCard.tsx`
- `src/components/succession/SuccessionDashboard.tsx`

### Session R8-B: Compliance (23 files)

**Compliance Pages (8):**
- `src/app/(dashboard)/compliance/ComplianceClient.tsx`
- `src/app/(dashboard)/compliance/kr/KrComplianceClient.tsx`
- `src/app/(dashboard)/compliance/gdpr/GdprClient.tsx`
- `src/app/(dashboard)/compliance/dpia/DpiaClient.tsx`
- `src/app/(dashboard)/compliance/data-retention/DataRetentionClient.tsx`
- `src/app/(dashboard)/compliance/pii-audit/PiiAuditClient.tsx`
- `src/app/(dashboard)/compliance/ru/RuComplianceClient.tsx`
- `src/app/(dashboard)/compliance/cn/CnComplianceClient.tsx`

**GDPR Components (5):**
- `src/components/compliance/gdpr/PiiAccessLogTable.tsx`
- `src/components/compliance/gdpr/PiiAccessDashboard.tsx`
- `src/components/compliance/gdpr/DataRequestForm.tsx`
- `src/components/compliance/gdpr/RetentionPolicyForm.tsx`
- `src/components/compliance/gdpr/DpiaForm.tsx`
- `src/components/compliance/gdpr/ConsentForm.tsx`

**KR/RU/CN Components (10):**
- `src/components/compliance/kr/SeveranceInterimForm.tsx`
- `src/components/compliance/kr/MandatoryTrainingTab.tsx`
- `src/components/compliance/kr/WorkHoursEmployeeList.tsx`
- `src/components/compliance/ru/RuReportsTab.tsx`
- `src/components/compliance/ru/MilitaryRegistrationTab.tsx`
- `src/components/compliance/ru/MilitaryRegistrationForm.tsx`
- `src/components/compliance/ru/KedoDocumentsTab.tsx`
- `src/components/compliance/ru/KedoSignDialog.tsx`
- `src/components/compliance/cn/SocialInsuranceReportTab.tsx`
- `src/components/compliance/cn/EmployeeRegistryTab.tsx`
- + 기타 CN 컴포넌트

### Session R9-A: Settings (21 files)

- `src/app/(dashboard)/settings/audit-logs/AuditLogClient.tsx`
- `src/app/(dashboard)/settings/custom-fields/CustomFieldsClient.tsx`
- `src/app/(dashboard)/settings/dashboard-widgets/DashboardWidgetsClient.tsx`
- `src/app/(dashboard)/settings/data-migration/DataMigrationClient.tsx`
- `src/app/(dashboard)/settings/email-templates/EmailTemplatesClient.tsx`
- `src/app/(dashboard)/settings/entity-transfers/EntityTransfersClient.tsx`
- `src/app/(dashboard)/settings/enums/EnumManagementClient.tsx`
- `src/app/(dashboard)/settings/evaluation-scale/EvaluationScaleClient.tsx`
- `src/app/(dashboard)/settings/export-templates/ExportTemplatesClient.tsx`
- `src/app/(dashboard)/settings/m365/M365Client.tsx`
- `src/app/(dashboard)/settings/modules/ModuleToggleClient.tsx`
- `src/app/(dashboard)/settings/monitoring/MonitoringClient.tsx`
- `src/app/(dashboard)/settings/notifications/NotificationTriggersClient.tsx`
- `src/app/(dashboard)/settings/offboarding/OffboardingSettingsClient.tsx`
- `src/app/(dashboard)/settings/org-changes/OrgChangesClient.tsx`
- `src/app/(dashboard)/settings/payroll-items/PayrollItemsClient.tsx`
- `src/app/(dashboard)/settings/salary-matrix/SalaryMatrixClient.tsx`
- `src/app/(dashboard)/settings/shift-patterns/ShiftPatternsClient.tsx`
- `src/app/(dashboard)/settings/shift-roster/ShiftRosterClient.tsx`
- `src/app/(dashboard)/settings/tax-brackets/TaxBracketsClient.tsx`
- `src/app/(dashboard)/settings/terminals/TerminalSettingsClient.tsx`

### Session R9-B: 나머지 + 에러 페이지 (30+ files)

**Dashboard Pages:**
- `src/app/(dashboard)/benefits/BenefitsClient.tsx` + 탭 컴포넌트
- `src/app/(dashboard)/notifications/NotificationsClient.tsx`
- `src/app/(dashboard)/offboarding/*` (2 files)
- `src/app/(dashboard)/org/OrgClient.tsx`
- `src/app/(dashboard)/training/*` (2 files)
- `src/app/(dashboard)/attendance/shift-calendar/ShiftCalendarClient.tsx`
- `src/app/(dashboard)/employees/[id]/contracts/ContractsClient.tsx`
- `src/app/(dashboard)/employees/[id]/work-permits/WorkPermitsClient.tsx`

**Other Components:**
- `src/components/hr-chatbot/HrChatbot.tsx`
- `src/components/hr-chatbot/HrDocumentManager.tsx`
- `src/components/layout/NotificationBell.tsx`
- `src/components/manager-hub/ManagerInsightsHub.tsx`
- `src/components/teams/*` (5 files)
- `src/components/training/*` (2 files)
- `src/components/shared/PwaInstallBanner.tsx`

**에러/로그인 페이지:**
- `src/app/(auth)/login/page.tsx`
- `src/app/403/page.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `src/app/offline/page.tsx`

### Session R-Final: CLAUDE.md 업데이트 + 빌드 검증

- CLAUDE.md 섹션 3 디자인 토큰을 FLEX 기준으로 업데이트
- `npx tsc --noEmit` → 0 errors
- `npm run build` → 성공
- grep 으로 slate/blue/gray 잔존 0 확인

---

## 제외 대상

| 파일 | 사유 |
|------|------|
| `src/components/ui/*.tsx` (shadcn) | CSS 변수 기반, 테마 설정으로 제어됨 |
| `src/generated/**` | Prisma 자동 생성 |
| Recharts `fill`/`stroke` 속성 | 이미 hex 값 사용 중이거나 별도 차트 팔레트로 관리 |

---

## 작업 원칙

1. **CSS 클래스만 변경** — 기능 코드, API, DB 변경 금지
2. **매핑 테이블 기계적 적용** — `replace_all`로 일괄 변환
3. **세션마다 `tsc --noEmit` 검증**
4. **의미적 컬러 보존** — red(에러), emerald(성공), amber(경고)도 hex로 전환하되 색조 유지
5. **모달 shadow는 유지** — shadcn Dialog의 `shadow-lg`는 의도적 예외

---

## 검증 방법

```bash
# 1. 타입 체크
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l  # → 0

# 2. 금지 패턴 잔존 체크
grep -rn "bg-slate-\|text-slate-\|border-slate-" src/ --include="*.tsx" | grep -v "components/ui/" | wc -l  # → 0
grep -rn "bg-blue-\|text-blue-\|border-blue-" src/ --include="*.tsx" | grep -v "components/ui/" | wc -l  # → 0
grep -rn "bg-gray-\|text-gray-\|border-gray-" src/ --include="*.tsx" | grep -v "components/ui/" | wc -l  # → 0
grep -rn "shadow-sm\|shadow-md" src/ --include="*.tsx" | grep -v "components/ui/" | wc -l  # → 0

# 3. 프로덕션 빌드
npm run build
```
