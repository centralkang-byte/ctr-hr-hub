# QF S-0 Pre-flight: Settings Context

> **Generated**: 2026-03-18
> **Purpose**: Audit attachment for S-0 Settings Completeness — identifies what exists, what's missing, and what's hardcoded.

---

## Document 1: Settings Data Dictionary

### 1.1 FromSettings Functions (15)

| # | Function Name | File | Prisma Model | Key/Category | Default Value | companyId-aware? |
|---|---|---|---|---|---|---|
| 1 | `getKrLaborConfigFromSettings` | `src/lib/labor/kr.ts:142` | CompanyProcessSetting | `work-hour-limits`, `min-wage` | MAX_WEEKLY_HOURS, MIN_HOURLY_WAGE | Yes |
| 2 | `getApprovalChainFromSettings` | `src/lib/payroll/approval-chains.ts:33` | CompanyProcessSetting | `approval-chains` | PAYROLL_APPROVAL_CHAINS | Yes |
| 3 | `getBankCodesFromSettings` | `src/lib/payroll/approval-chains.ts:76` | CompanyProcessSetting | `bank-codes` | BANK_CODES constant | Yes |
| 4 | `getPayDayFromSettings` | `src/lib/payroll/approval-chains.ts:91` | CompanyProcessSetting | `pay-schedule` | DEFAULT_PAY_DAY (25) | Yes |
| 5 | `calculateSocialInsuranceFromSettings` | `src/lib/payroll/kr-tax.ts:87` | CompanyProcessSetting | `kr-social-insurance` | NATIONAL_PENSION_RATE, HEALTH_INSURANCE_RATE, etc. | Yes |
| 6 | `calculateIncomeTaxFromSettings` | `src/lib/payroll/kr-tax.ts:196` | CompanyProcessSetting | `kr-tax-brackets` | DEFAULT_TAX_BRACKETS (8-tier) | Yes |
| 7 | `separateTaxableIncomeFromSettings` | `src/lib/payroll/kr-tax.ts:334` | CompanyProcessSetting | `kr-nontaxable-limits` | STATUTORY_NON_TAXABLE_DEFAULTS | Yes |
| 8 | `detectPayrollAnomaliesFromSettings` | `src/lib/payroll/kr-tax.ts:464` | CompanyProcessSetting | `anomaly-thresholds` | grossChangePercent: 20, overtimeBaseRatio: 50 | Yes |
| 9 | `calculateDeductionsKRFromSettings` | `src/lib/payroll/globalDeductions.ts:45` | CompanyProcessSetting | `kr-social-insurance` + `kr-tax-brackets` | KR tax defaults | Yes |
| 10 | `calculateDeductionsUSFromSettings` | `src/lib/payroll/globalDeductions.ts:124` | CompanyProcessSetting | `us-deductions` | US_DEFAULTS | Yes |
| 11 | `calculateDeductionsCNFromSettings` | `src/lib/payroll/globalDeductions.ts:200` | CompanyProcessSetting | `cn-deductions` | CN_DEFAULTS | Yes |
| 12 | `calculateDeductionsVNFromSettings` | `src/lib/payroll/globalDeductions.ts:271` | CompanyProcessSetting | `vn-deductions` | VN_DEFAULTS | Yes |
| 13 | `calculateDeductionsRUFromSettings` | `src/lib/payroll/globalDeductions.ts:302` | CompanyProcessSetting | `ru-deductions` | RU_NDFL_RATE (0.13) | Yes |
| 14 | `calculateDeductionsMXFromSettings` | `src/lib/payroll/globalDeductions.ts:354` | CompanyProcessSetting | `mx-deductions` | MX_IMSS_RATE | Yes |
| 15 | `calculateDeductionsByCountryFromSettings` | `src/lib/payroll/globalDeductions.ts:385` | CompanyProcessSetting | Country-dispatched | Per-country defaults | Yes |

**Pattern**: All 15 functions are async, accept optional `companyId`, query `CompanyProcessSetting` with `(settingType, settingKey)` tuple, and use nullish coalescing (`??`) fallback to hardcoded constants.

---

### 1.2 ProcessSetting DB Contents

#### CompanyProcessSetting Model (prisma/schema.prisma)

```prisma
model CompanyProcessSetting {
  id           String   @id @default(uuid())
  companyId    String?  @map("company_id")
  company      Company? @relation(fields: [companyId], references: [id])
  settingType  String   @map("setting_type")
  settingKey   String   @map("setting_key")
  settingValue Json     @map("setting_value")
  description  String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([companyId, settingType, settingKey])
  @@index([companyId])
  @@index([settingType])
  @@map("company_process_settings")
}
```

**Key design**: `companyId: null` = global default; specific UUID = company override.

#### Seeded Settings (prisma/seeds/26-process-settings.ts) — 33 records

| Category | Seeded Keys |
|----------|------------|
| PAYROLL (13) | `kr-social-insurance`, `kr-tax-brackets`, `kr-nontaxable-limits`, `us-deductions`, `cn-deductions`, `vn-deductions`, `ru-deductions`, `mx-deductions`, `anomaly-thresholds`, `approval-chains`, `bank-codes`, `pay-schedule`, `account-mapping` |
| ATTENDANCE (6) | `work-hour-thresholds`, `work-hour-limits`, `min-wage`, `overtime-rules`, `leave-accrual`, `leave-promotion` |
| PERFORMANCE (4) | `calibration-distribution`, `grade-scale`, `bias-thresholds`, `ems-config` |
| SYSTEM (5) | `exchange-rates`, `data-retention`, `benchmark-rates`, `locale`, `notification-channels` |
| ORGANIZATION (1) | `assignment-rules` |
| RECRUITMENT (3) | `pipeline-stages`, `ai-screening`, `interview-form` |

---

### 1.3 Settings Prisma Models (43)

| Model | Category | Purpose |
|---|---|---|
| **CompanyProcessSetting** | **CORE** | Master KV store for all configurable policies |
| WorkSchedule | Attendance | Shift patterns/schedules |
| EmployeeSchedule | Attendance | Employee-specific schedule assignments |
| LeavePolicy | Attendance | Company leave policy definitions |
| Holiday | Attendance | Statutory/company holidays |
| ShiftPattern | Attendance | Shift templates (early, late, night) |
| ShiftGroup | Attendance | Group shift assignments |
| ShiftSchedule | Attendance | Generated shift rosters |
| AttendanceApprovalRequest | Attendance | OT/absence approval workflows |
| AttendanceSetting | Attendance | *(Deprecated → use CompanyProcessSetting)* |
| LeaveSetting | Attendance | *(Deprecated → use CompanyProcessSetting)* |
| LeaveTypeDef | Leave | Leave type definitions (annual, sick, maternity) |
| LeaveAccrualRule | Leave | Monthly/annual accrual schedule |
| PayAllowanceType | Payroll | Allowance catalog (meal, transport, etc.) |
| PayDeductionType | Payroll | Deduction catalog (tax, insurance, loan) |
| TaxBracket | Payroll | Income tax/surtax brackets |
| YearEndDeductionConfig | Payroll | Year-end settlement config |
| SocialInsuranceConfig | Payroll | Social insurance rates per company |
| PayrollApproval | Payroll | Approval workflow instances |
| PayrollApprovalStep | Payroll | Individual approval steps |
| BenefitPolicy | Benefits | Insurance/benefit plan definitions |
| AllowanceRecord | Payroll | Linked allowance types to employee |
| ApprovalFlow | Workflow | Approval chain templates |
| ApprovalFlowStep | Workflow | Steps in approval flow |
| WorkflowRule | Workflow | Business logic rules |
| WorkflowStep | Workflow | Workflow steps |
| ApprovalDelegation | Authorization | Temporary delegation of approval rights |
| CustomField | Organization | Custom employee/company fields |
| CustomFieldValue | Organization | Values for custom fields |
| TermOverride | Organization | Override term/definition values |
| EmailTemplate | Communication | Notification/report email templates |
| ExportTemplate | Data Export | Export format definitions |
| TeamsWebhookConfig | Integration | Microsoft Teams webhook URLs |
| OnboardingTemplate | Onboarding | Onboarding checklist templates |
| OnboardingSetting | Onboarding | *(Deprecated → use CompanyProcessSetting)* |
| EmsBlockConfig | Performance | 9-Block EMS configuration |
| CalibrationRule | Performance | Rating calibration rules |
| EvaluationSetting | Performance | Eval cycle & rating settings |
| PromotionSetting | Performance | Promotion eligibility rules |
| CompensationSetting | Payroll | Compensation review settings |
| MandatoryTrainingConfig | Training | Mandatory training requirements |
| DataRetentionPolicy | Compliance | Data retention rules by entity type |
| AnalyticsConfig | Analytics | Dashboard configuration |
| KpiDashboardConfig | Analytics | KPI widget definitions |
| RequisitionApproval | Recruitment | Approval routing for job reqs |

---

### 1.4 Settings API Route Map

#### Direct Settings Routes (src/app/api/v1/settings/) — 35 endpoints

| Route | GET | POST | PUT | DELETE | Connected FromSettings? | UI Tab? |
|---|---|---|---|---|---|---|
| `/settings/attendance` | ✅ | | ✅ | | Yes | `attendance:work-schedules` |
| `/settings/compensation` | ✅ | | ✅ | | | `payroll:salary-bands` |
| `/settings/compensation/override` | ✅ | ✅ | ✅ | | | |
| `/settings/evaluation` | ✅ | | ✅ | | | `performance:cycle` |
| `/settings/evaluation/override` | ✅ | ✅ | ✅ | | | |
| `/settings/promotion` | ✅ | | ✅ | | | |
| `/settings/promotion/override` | ✅ | ✅ | ✅ | | | |
| `/settings/approval-flows` | ✅ | ✅ | | | | `system:notification-rules` |
| `/settings/custom-fields` | ✅ | ✅ | | | | `organization:custom-fields` |
| `/settings/custom-fields/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/email-templates` | ✅ | ✅ | | | | |
| `/settings/email-templates/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/enums` | ✅ | ✅ | | | | `organization:code-management` |
| `/settings/enums/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/terms` | ✅ | ✅ | | | | |
| `/settings/terms/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/workflows` | ✅ | ✅ | | | | |
| `/settings/workflows/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/notification-triggers` | ✅ | ✅ | | | | `system:notification-rules` |
| `/settings/notification-triggers/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/job-grades` | ✅ | | | | | `organization:job-grades` |
| `/settings/company` | ✅ | | | | | `organization:company-info` |
| `/settings/branding` | ✅ | | ✅ | | | |
| `/settings/branding/upload` | | ✅ | | | | |
| `/settings/dashboard-layout` | ✅ | | ✅ | | | |
| `/settings/evaluation-scale` | ✅ | | ✅ | | | `performance:grade-scale` |
| `/settings/export-templates` | ✅ | ✅ | | | | |
| `/settings/export-templates/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/modules` | ✅ | | | | | |
| `/settings/teams-webhooks` | ✅ | ✅ | | | | `system:integrations` |
| `/settings/teams-webhooks/[id]` | ✅ | | ✅ | ✅ | | |
| `/settings/teams-webhooks/test` | | ✅ | | | | |
| `/settings/performance/merit-matrix` | ✅ | | ✅ | | | `payroll:merit-matrix` |
| `/settings/performance/grade-scale` | ✅ | | ✅ | | | `performance:grade-scale` |
| `/settings/performance/level-mapping` | ✅ | | ✅ | | | |

#### Config-Related Routes (Non-Settings Paths) — 16 endpoints

| Route | GET | POST | PUT | DELETE | UI Tab? |
|---|---|---|---|---|---|
| `/shift-patterns` | ✅ | ✅ | | | `attendance:shift-patterns` |
| `/shift-patterns/[id]` | ✅ | | ✅ | ✅ | |
| `/shift-groups` | ✅ | ✅ | | | |
| `/shift-groups/[id]/members` | ✅ | ✅ | | | |
| `/shift-schedules/[year]/[month]` | ✅ | | | | |
| `/shift-schedules/generate` | | ✅ | | | |
| `/shift-roster/[year]/[month]` | ✅ | | | | |
| `/shift-roster/assign` | | ✅ | | | |
| `/shift-roster/warnings` | ✅ | | | | |
| `/shift-change-requests` | ✅ | ✅ | | | |
| `/shift-change-requests/[id]/approve` | | ✅ | | | |
| `/holidays` | ✅ | ✅ | | | `attendance:holidays` |
| `/holidays/[id]` | ✅ | | ✅ | ✅ | |
| `/work-schedules` | ✅ | ✅ | | | `attendance:work-schedules` |
| `/work-schedules/[id]` | ✅ | | ✅ | ✅ | |
| `/attendance/shifts` | ✅ | | | | |

---

## Document 2: Country Requirements Matrix

**Legend**: ✅ = Configurable per entity | ⚠️ = Hardcoded in code | ❌ = No code at all | N/A = Not applicable

### 2.1 Attendance & Working Hours

| Requirement | KR | CN | US | VN | MX | RU | EU/PL | Setting Location | Status |
|---|---|---|---|---|---|---|---|---|---|
| Standard hours/week | ✅ 40 | ⚠️ 40 | ⚠️ 40 | ⚠️ 48 | ⚠️ 48 | ⚠️ 45 | ⚠️ 40 | `laborConfig` + KR override via `work-hour-limits` | KR configurable, others hardcoded |
| Max weekly hours | ⚠️ 52 | ⚠️ 44 | ⚠️ 45 | ⚠️ 48 | ⚠️ 48 | ⚠️ 45 | ⚠️ 48 | `laborConfig` hardcoded | KR: overrideable via FromSettings |
| Max overtime/week | ⚠️ 12 | ⚠️ 36 | ⚠️ 20 | ⚠️ 12 | ⚠️ 9 | ⚠️ 11 | ⚠️ 8 | `laborConfig` hardcoded | No per-company override |
| OT multiplier (weekday) | ⚠️ 1.5x | ⚠️ 1.5x | ⚠️ 1.5x | ⚠️ 2.0x | ⚠️ 2.0x–3.0x | ⚠️ 1.5x | ⚠️ 1.5x | `laborConfig.overtime_rates` | All hardcoded |
| OT multiplier (weekend) | ⚠️ 1.5x | ⚠️ 2.0x | N/A | N/A | ⚠️ 2.0x | N/A | ⚠️ 2.0x | `laborConfig.overtime_rates` | All hardcoded |
| OT multiplier (holiday) | ⚠️ 2.0x | ⚠️ 3.0x | N/A | N/A | ⚠️ 3.0x | N/A | N/A | `laborConfig.overtime_rates` | All hardcoded |
| Night premium hours | ⚠️ 22-06 (0.5x) | ⚠️ None | ⚠️ None | ⚠️ None | ⚠️ None | ⚠️ None | ⚠️ None | KR only in labor/kr.ts | Hardcoded |
| Mandatory breaks | ⚠️ 30–60min | ⚠️ 60min | ⚠️ 30min | ⚠️ 30min | ⚠️ 30min | ⚠️ 60min | ⚠️ 15min | `mandatory_break` rules | All hardcoded |
| Rest day definition | ✅ Configurable | ⚠️ Sat-Sun | ⚠️ Sat-Sun | ⚠️ Sun | ⚠️ Sun | ⚠️ Sat-Sun | ⚠️ Sat-Sun | KR via AttendanceSetting | Others hardcoded |
| 52-hour monitoring | ✅ API exists | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `/compliance/kr/work-hours` | KR only |

### 2.2 Leave

| Requirement | KR | CN | US | VN | MX | RU | EU/PL | Setting Location | Status |
|---|---|---|---|---|---|---|---|---|---|
| Annual leave min (days) | ✅ 15 (base) | ⚠️ 5–15 | ⚠️ 10 (PTO) | ⚠️ 12 | ⚠️ 12 | ⚠️ 28 | ⚠️ 20–26 | `laborConfig.leave_types[].days_per_year` | All hardcoded except KR override |
| Accrual rule | ✅ TENURE_BASED | ⚠️ TENURE_BASED | ⚠️ FRONT_LOADED | ⚠️ MONTHLY | ⚠️ TENURE_BASED | ⚠️ Fixed | ⚠️ TENURE_BASED | Hardcoded in config | No per-company override |
| Sick leave | ⚠️ Unpaid | ⚠️ Tenure-based | ⚠️ 5 days | ⚠️ 12 days | ❌ | ⚠️ Unlimited | ⚠️ Null days | Hardcoded | Missing MX |
| Maternity leave | ✅ 90 days | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | KR only hardcoded | Missing all non-KR |
| Paternity leave | ✅ 10 days | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | KR only hardcoded | Missing all non-KR |
| Probation leave eligible | ⚠️ 3 months | ⚠️ 6 months | ⚠️ 3 months | ⚠️ 6 months | ⚠️ 3 months | ⚠️ 2 months | ⚠️ 3 months | `probation_months` in config | All hardcoded |
| Leave carry-over | ✅ `LeavePolicy.carryOverAllowed` | ⚠️ Unclear | ⚠️ Unclear | ⚠️ Unclear | ⚠️ Unclear | ⚠️ Unclear | ⚠️ Unclear | Per-policy DB field exists | Not country-enforced |
| Leave promotion (연차촉진) | ✅ 3-step system | N/A | N/A | N/A | N/A | N/A | N/A | `KR_LEAVE_PROMOTION` setting | KR only |

### 2.3 Payroll

| Requirement | KR | CN | US | VN | MX | RU | EU/PL | Setting Location | Status |
|---|---|---|---|---|---|---|---|---|---|
| Currency | ✅ KRW | ✅ CNY | ✅ USD | ✅ VND | ✅ MXN | ✅ RUB | ✅ PLN | `Company.currency` + `laborConfig.currency` | DB column per company |
| Pay cycle | ⚠️ Monthly | ⚠️ Monthly | ⚠️ Monthly | ⚠️ Monthly | ⚠️ Monthly | ⚠️ Monthly | ⚠️ Monthly | `PayrollFrequency` enum | No bi-weekly/quarterly support |
| Tax method | ✅ Progressive 8-tier | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `kr-tax-brackets` setting | KR only configurable |
| Social insurance | ✅ 4대보험 | ✅ 五险一金 (per-city) | ❌ | ❌ | ❌ | ❌ | ❌ | KR: `kr-social-insurance`; CN: `SocialInsuranceConfig` table | KR/CN only |
| 13th month salary | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Not implemented | Feature gap |
| Non-taxable limits | ✅ Meal/Vehicle/Childcare | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `kr-nontaxable-limits` setting | KR only |
| Pay day | ✅ 25th (default) | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | `pay-schedule` setting | Configurable via FromSettings |
| Anomaly detection | ⚠️ Default thresholds | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | `anomaly-thresholds` setting | Defaults hardcoded, overrideable |
| Country deductions | ✅ FromSettings | ✅ FromSettings | ✅ FromSettings | ✅ FromSettings | ✅ FromSettings | ✅ FromSettings | ❌ | `globalDeductions.ts` | EU/PL missing |
| Severance formula | ✅ 30days×years | ⚠️ N+1 month | ❌ | ❌ | ⚠️ 3mo×yr | ❌ | ❌ | KR: `calculateSeverance()`; CN/MX: hardcoded | Gaps: US, VN, RU, EU |

### 2.4 Performance

| Requirement | KR | CN | US | VN | MX | RU | EU/PL | Setting Location | Status |
|---|---|---|---|---|---|---|---|---|---|
| Review cycle | ✅ Configurable | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | `performance/cycles` API | Global, not country-specific |
| Rating scale | ✅ 4-grade (E/M+/M/B) | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | `grade-scale` setting | Org-wide, not country-specific |
| Calibration | ✅ Configurable | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | ✅ Shared | `calibration-distribution` setting | Global |

### 2.5 Compliance

| Requirement | KR | CN | US | VN | MX | RU | EU/PL | Setting Location | Status |
|---|---|---|---|---|---|---|---|---|---|
| Data protection law | ⚠️ PIPA | ⚠️ PIPL | ❌ | ❌ | ❌ | ⚠️ FZ-152 | ✅ GDPR full | GDPR module only | Non-EU gaps |
| Mandatory training | ✅ `MandatoryTraining` table | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | KR only | Feature gap |
| Notice period (resign) | ⚠️ Implied | ⚠️ 6mo probation | ⚠️ 3mo | ⚠️ 6mo | ⚠️ 3mo | ⚠️ 2mo | ⚠️ 3mo | `probation_months` only | No statutory notice period config |
| Military registration | N/A | N/A | N/A | N/A | N/A | ✅ T-2 form | N/A | `/compliance/ru/military` | RU only |
| Quarterly reports | N/A | N/A | N/A | N/A | N/A | ✅ P-4 form | N/A | `/compliance/ru/reports/p4` | RU only |
| Employee registry (花名册) | N/A | ✅ Export API | N/A | N/A | N/A | N/A | N/A | `/compliance/cn/employee-registry` | CN only |
| KEDO e-signature | N/A | N/A | N/A | N/A | N/A | ✅ PEP/UNEP/UKEP | N/A | `compliance/ru.ts` | RU only |

---

## Document 3: Settings UI Tab Map

### 3.1 Tab Structure

**Master config**: `src/components/settings/settings-config.ts` (single source of truth)
**Routing**: Hub at `/settings` → Category at `/settings/{category}?tab={slug}`

### 3.2 Tab → API Mapping

#### Category 1: Organization (조직/인사) — 8 tabs

| Tab Slug | Korean Label | API Route | Status |
|---|---|---|---|
| `company-info` | 법인 기본정보 | `/api/v1/companies` | Active |
| `departments` | 부서 구조 | `/api/v1/org/departments?limit=200` | Active |
| `job-grades` | 직급 체계 | `/api/v1/settings/job-grades` | Stub |
| `job-families` | 직종/직무 | — | Stub |
| `assignment-rules` | 발령 규칙 | — | Stub |
| `probation` | 수습 기간 | — | Stub |
| `custom-fields` | 커스텀 필드 | `/api/v1/settings/custom-fields?limit=100` | Active |
| `code-management` | 코드 관리 | `/api/v1/settings/enums?limit=200` | Active |

#### Category 2: Attendance & Leave (근태/휴가) — 8 tabs

| Tab Slug | Korean Label | API Route | Status |
|---|---|---|---|
| `work-schedules` | 근무 스케줄 | `/api/v1/settings/attendance` | Active |
| `weekly-hours` | 주간 근무한도 | — | Not yet implemented |
| `shift-patterns` | 교대근무 | `/api/v1/shift-patterns` | Active |
| `leave-types` | 휴가 유형 | `/api/v1/leave/type-defs` | Active |
| `leave-accrual` | 휴가 부여 규칙 | `/api/v1/leave/type-defs` | Active |
| `leave-promotion` | 연차촉진 | — | Stub |
| `holidays` | 법정 공휴일 | `/api/v1/holidays` | Active |
| `overtime` | 초과근무 | `/api/v1/settings/attendance` | Active |

#### Category 3: Payroll & Compensation (급여/보상) — 8 tabs

| Tab Slug | Korean Label | API Route | Status |
|---|---|---|---|
| `earnings` | 급여 항목 | `/api/v1/payroll/allowance-types?limit=100` | Active |
| `deductions` | 공제 항목 | `/api/v1/payroll/deduction-types?limit=100` | Active |
| `tax-free` | 비과세 한도 | `/api/v1/process-settings/payroll` | Active |
| `salary-bands` | 연봉 밴드 | `/api/v1/compensation/salary-bands?limit=50` | Active |
| `merit-matrix` | 인상률 매트릭스 | `/api/v1/settings/performance/merit-matrix` | Active |
| `bonus-rules` | 성과급 규칙 | `/api/v1/process-settings/compensation` | Active |
| `pay-schedule` | 급여일 | `/api/v1/process-settings/payroll` | Active |
| `currency` | 통화/환율 | `/api/v1/payroll/exchange-rates` | Active |

#### Category 4: Performance (성과/평가) — 7 tabs

| Tab Slug | Korean Label | API Route | Global Only? | Status |
|---|---|---|---|---|
| `cycle` | 평가 주기 | `/api/v1/performance/cycles?limit=20` | No | Active |
| `methodology` | 평가 방법론 | — | No | Stub |
| `grade-scale` | 등급 체계 | `/api/v1/settings/performance/grade-scale` | No | Active |
| `distribution` | 배분 가이드라인 | — | No | Stub |
| `calibration` | 캘리브레이션 | — | No | Stub |
| `cfr` | CFR 설정 | — | No | Stub |
| `competency` | 역량 라이브러리 | `/api/v1/competencies?limit=50` | **Yes** | Active |

#### Category 5: Recruitment & Onboarding (채용/온보딩) — 6 tabs

| Tab Slug | Korean Label | API Route | Global Only? | Status |
|---|---|---|---|---|
| `pipeline` | 채용 파이프라인 | — | No | Stub |
| `interview-form` | 면접 평가항목 | — | No | Stub |
| `ai-screening` | AI 스크리닝 | — | **Yes** | Stub |
| `onboarding-templates` | 온보딩 템플릿 | `/api/v1/onboarding/templates` | No | Active |
| `offboarding-checklist` | 오프보딩 체크리스트 | `/api/v1/offboarding/checklists` | No | Active |
| `probation-eval` | 수습 평가 | — | No | Stub |

#### Category 6: System (시스템) — 7 tabs

| Tab Slug | Korean Label | API Route | Global Only? | Status |
|---|---|---|---|---|
| `notification-channels` | 알림 채널 | — | No | Stub |
| `notification-rules` | 알림 규칙 | `/api/v1/settings/notification-triggers?limit=100` | No | Active |
| `locale` | 언어/타임존 | — | No | Stub |
| `roles` | 역할/권한 | — | **Yes** | Stub |
| `audit` | 감사 로그 | `/api/v1/settings-audit-log` | No | Active |
| `data-retention` | 데이터 보존 | — | No | Stub |
| `integrations` | 연동 | — | No | Stub |

### 3.3 Tab Count: 44 / 44

| Category | Tab Count | Active | Stub | Global-Only |
|---|---|---|---|---|
| Organization (조직/인사) | 8 | 4 | 4 | 0 |
| Attendance & Leave (근태/휴가) | 8 | 6 | 2 | 0 |
| Payroll & Compensation (급여/보상) | 8 | 8 | 0 | 0 |
| Performance (성과/평가) | 7 | 3 | 4 | 1 |
| Recruitment & Onboarding (채용/온보딩) | 6 | 2 | 4 | 1 |
| System (시스템) | 7 | 2 | 5 | 1 |
| **TOTAL** | **44** | **25** | **19** | **3** |

---

## Summary

| Metric | Count | Notes |
|---|---|---|
| **FromSettings functions found** | 15 | All in payroll/labor domain; all companyId-aware |
| **CompanyProcessSetting seeds** | 33 | 6 categories, global defaults only |
| **Settings/Config Prisma models** | 43 | 3 deprecated (→ CompanyProcessSetting) |
| **Settings API routes** | 35 | Direct `/settings/` endpoints |
| **Config-related routes** | 16 | shift/holiday/work-schedule paths |
| **Total API endpoints** | 51 | |
| **UI tabs total** | 44 / 44 | Matches expected count |
| **UI tabs active** | 25 | Have connected API + working UI |
| **UI tabs stub** | 19 | Tab exists, content placeholder |
| **Global-only tabs** | 3 | competency, ai-screening, roles |
| **Countries with settings** | 2 (KR, CN) | Most features configurable |
| **Countries hardcoded** | 5 (US, VN, MX, RU, EU) | Defaults only, no per-company override |
| **Country requirements hardcoded (⚠️)** | ~45 | OT rates, leave rules, breaks, probation |
| **Country requirements missing (❌)** | ~18 | 13th month, maternity (non-KR), tax (non-KR), etc. |

### Critical Gaps for S-0 Audit

1. **19 stub tabs** — UI shells with no backend implementation
2. **OT multipliers hardcoded** for all 7 countries — no per-company override
3. **13th month salary** — not implemented for any country (VN, MX require it)
4. **Tax calculations** — only KR has configurable brackets; all others return hardcoded defaults
5. **Maternity/paternity leave** — only KR; missing for CN (98-158d), VN (180d), MX (84d), RU (140d)
6. **Pay cycle** — monthly only; no bi-weekly support (US, MX convention)
7. **EU/PL deductions** — `calculateDeductionsByCountryFromSettings` has no EU/PL branch
8. **Notice periods** — no statutory notice period field; only `probation_months` exists
