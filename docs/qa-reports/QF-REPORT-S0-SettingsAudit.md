# QF-REPORT: Run S-0 — Settings Completeness Audit & Fix Blueprint

| Field | Value |
|-------|-------|
| Date | 2026-03-18 |
| Tool | Claude Code Desktop (Opus 4.6) |
| Duration | ~75 min |
| Accounts | SA (super@ctr.co.kr), HK (hr@ctr.co.kr), EA (employee-a@ctr.co.kr) |
| Base URL | http://localhost:3002 |

---

## 1. Inventory Verification (vs Pre-flight)

### 1-A: FromSettings Functions — **16 confirmed** (Pre-flight said 15)

| # | Function Name | File | Key/Category | Fallback | Pre-flight? |
|---|--------------|------|-------------|----------|-------------|
| 1 | `getKrLaborConfigFromSettings` | `lib/labor/kr.ts:142` | ATTENDANCE/work-hour-limits, min-wage | 52h, 40h, 12h, 10030₩ | ✅ |
| 2 | `calculateSocialInsuranceFromSettings` | `lib/payroll/kr-tax.ts:87` | PAYROLL/kr-social-insurance | 4.5%, 3.545%, etc. | ✅ |
| 3 | `calculateIncomeTaxFromSettings` | `lib/payroll/kr-tax.ts:196` | PAYROLL/kr-tax-brackets | 8 bracket table | ✅ |
| 4 | `calculateTotalDeductionsFromSettings` | `lib/payroll/kr-tax.ts:246` | Orchestrator | Calls #2+#3 | ✅ |
| 5 | `separateTaxableIncomeFromSettings` | `lib/payroll/kr-tax.ts:334` | PAYROLL/kr-nontaxable-limits | 200k meal, 100k vehicle | ✅ |
| 6 | `detectPayrollAnomaliesFromSettings` | `lib/payroll/kr-tax.ts:464` | PAYROLL/anomaly-thresholds | 30%, 52h, 20%, 3% | ✅ |
| 7 | `getApprovalChainFromSettings` | `lib/payroll/approval-chains.ts:33` | PAYROLL/approval-chains | Per-company fallback map | ✅ |
| 8 | `getBankCodesFromSettings` | `lib/payroll/approval-chains.ts:76` | PAYROLL/bank-codes | 18 Korean banks | ✅ |
| 9 | `getPayDayFromSettings` | `lib/payroll/approval-chains.ts:91` | PAYROLL/pay-schedule | Day 25 | ✅ |
| 10 | `calculateDeductionsKRFromSettings` | `lib/payroll/globalDeductions.ts:45` | PAYROLL/kr-social-insurance + kr-tax-brackets | Delegates to #2+#3 | ✅ |
| 11 | `calculateDeductionsUSFromSettings` | `lib/payroll/globalDeductions.ts:124` | PAYROLL/us-deductions | SS 6.2%, Medicare 1.45% | ✅ |
| 12 | `calculateDeductionsCNFromSettings` | `lib/payroll/globalDeductions.ts:200` | PAYROLL/cn-deductions | 五险一金 rates | ✅ |
| 13 | `calculateDeductionsVNFromSettings` | `lib/payroll/globalDeductions.ts:271` | PAYROLL/vn-deductions | BHXH+BHYT+BHTN rates | ✅ |
| 14 | `calculateDeductionsRUFromSettings` | `lib/payroll/globalDeductions.ts:302` | PAYROLL/ru-deductions | NDFL 13% | ✅ |
| 15 | `calculateDeductionsMXFromSettings` | `lib/payroll/globalDeductions.ts:354` | PAYROLL/mx-deductions | IMSS + ISR rates | ✅ |
| 16 | `calculateDeductionsByCountryFromSettings` | `lib/payroll/globalDeductions.ts:385` | Dispatcher | Routes by country code | **MISSED** |

**Verdict**: Pre-flight count was 15 — actual is **16** (missed the dispatcher function). Minor undercount.

### 1-B: Additional Settings-Like Patterns Found

| # | Function/Pattern | File | Reads From | Not in Pre-flight Because |
|---|-----------------|------|-----------|--------------------------|
| 1 | `getThresholds()` | `lib/attendance/workHourAlert.ts:~50` | AttendanceSetting + CompanyProcessSetting | Uses 3-tier fallback, not named *FromSettings |
| 2 | `getSettingValue()` | `lib/settings/get-setting.ts:20` | CompanyProcessSetting | Infrastructure accessor, not domain function |
| 3 | `loadWeights()` | `lib/analytics/predictive/turnoverRisk.ts:~40` | AnalyticsConfig model | Reads from different model |

### 1-C: Stub Tabs — **1 confirmed** (Pre-flight said 19 — **MAJOR OVERCOUNT**)

Pre-flight dramatically overcounted stubs. Actual implementation status:

| # | Tab Slug | Category | Status | Sub-class | Notes |
|---|---------|----------|--------|-----------|-------|
| 1 | `overtime` | Attendance | **STUB** | Stub-A | Has form layout but no OvertimeRule model; cannot persist custom rules |
| 2–44 | (all others) | Various | **ACTIVE** | — | All 43 remaining tabs have substantive implementation |

**Pre-flight said 19 stubs — reality is 1.** Pre-flight likely classified tabs with limited-but-functional UI as "stubs."

### 1-D: CompanyProcessSetting Seeds — **34 confirmed** (from live API)

| Category | Seed Count (file) | Live Count (API) |
|----------|-------------------|------------------|
| PAYROLL | 13 | 13 |
| ATTENDANCE | 7 | 7 |
| PERFORMANCE | 4 | 4 |
| SYSTEM | 5 | 5 |
| ORGANIZATION | 1 | 1 |
| RECRUITMENT | 4 | 4 |
| **Total** | **34** | **34** |

---

## 2. Module-by-Module Analysis

### 2-A: Employee & Organization

| Requirement | Status | Evidence |
|------------|--------|----------|
| Probation period per company | ⚠️ Hardcoded | `lib/labor/kr.ts:85` → `probation_months: 3`, each country file has own value |
| Employee number format | ✅ DB-driven | Uses `employeeNumber` auto-generation per company code prefix |
| Notice period (resignation) | ⚠️ Hardcoded | `lib/contract/rules.ts:17-38` has per-country constants |
| Max fixed-term contract | ⚠️ Hardcoded | `lib/contract/rules.ts` → KR:24mo, CN:72mo, RU:60mo |

**Gap count**: 3 hardcoded areas

### 2-B: Leave Management

| Requirement | Status | Evidence |
|------------|--------|----------|
| Leave types per country | ⚠️ Hardcoded | `laborConfig.leave_types` in each country file |
| Carry-over rules | ✅ Configurable | Via `LeaveTypeDef.carryOverMaxDays` in Prisma model |
| Maternity/paternity | ⚠️ Hardcoded | KR: 90d/10d in `labor/kr.ts:73-74`, others not defined |
| Accrual engine | ✅ Settings-driven | `LeaveAccrualRule` model + `accrualEngine.ts` |
| Half-day support | ✅ DB field | `LeaveTypeDef.allowHalfDay` |

**Gap count**: 2 hardcoded areas (leave_types in laborConfig, country-specific leave entitlements)

### 2-C: Attendance

| Requirement | Status | Evidence |
|------------|--------|----------|
| Standard work hours | ⚠️ Hardcoded in laborConfig | KR: `lib/labor/kr.ts:60-63`, CN/US/VN/MX/RU/EU all hardcoded |
| Night shift hours | ⚠️ Hardcoded | `22:00-06:00` in all country configs |
| Grace period (lateness) | ⚠️ Hardcoded | `workTypeEngine.ts` → `LATE_TOLERANCE = 10` minutes |
| Overtime multipliers | ⚠️ Hardcoded | Per-country in `laborConfig.overtime_rates` |
| Alert thresholds | ✅ Settings-driven | `workHourAlert.ts` reads from AttendanceSetting + CompanyProcessSetting |
| KR work hour limits | ✅ FromSettings | `getKrLaborConfigFromSettings()` — KR only! |

**Critical finding**: Only Korea has Settings-driven work hour limits. CN/US/VN/MX/RU/EU are **entirely hardcoded**.

**Gap count**: 4 hardcoded areas (non-KR work hours, night shift, grace period, all-country overtime rates)

### 2-D: Payroll

| Requirement | Status | Evidence |
|------------|--------|----------|
| Tax rates (6 countries) | ✅ FromSettings | All 6 country calculators use `*FromSettings` |
| Pay cycle/frequency | ⚠️ Implied monthly | No explicit PayrollFrequency enum or setting |
| Minimum wage | ⚠️ Hardcoded per country | Only KR has `getKrLaborConfigFromSettings` |
| 13th month / Aguinaldo | ❌ Not implemented | No code references found for Mexico/Philippines bonus salary |
| Severance calculation | ⚠️ Hardcoded | `laborConfig.severance.calculate` is a function literal per country |
| Anomaly thresholds | ✅ FromSettings | `detectPayrollAnomaliesFromSettings` |
| Approval chains | ✅ FromSettings | `getApprovalChainFromSettings` |

**Gap count**: 3 (min wage non-KR, severance logic, 13th month missing)

### 2-E: Performance

| Requirement | Status | Evidence |
|------------|--------|----------|
| Evaluation methodology | ✅ DB-driven | `EvaluationSetting.methodology` (MBO_BEI, OKR, etc.) |
| Grade scale | ✅ Settings | `process-settings/performance/grade-scale` |
| Distribution guidelines | ✅ Settings | `process-settings/performance/calibration-distribution` |
| Bias thresholds | ✅ Settings | `process-settings/performance/bias-thresholds` |
| Review cycle frequency | ✅ DB field | `EvaluationCycle.frequency` |

**Gap count**: 0 — Performance is well-configured

### 2-F: Recruitment

| Requirement | Status | Evidence |
|------------|--------|----------|
| Pipeline stages | ✅ Settings | `process-settings/recruitment/pipeline-stages` |
| AI screening config | ✅ Settings | `process-settings/recruitment/ai-screening` |
| Interview form template | ✅ Settings | `process-settings/recruitment/interview-form` |
| Offer templates | ⚠️ Not found | No `OfferTemplate` model or setting |
| Scorecard structure | ✅ Via interview form | Part of interview-form setting |

**Gap count**: 1 (offer templates)

### 2-G: Onboarding / Offboarding

| Requirement | Status | Evidence |
|------------|--------|----------|
| Onboarding templates | ✅ DB-driven | `OnboardingTemplate` + `OnboardingTask` models |
| Exit interview | ⚠️ Not configurable | No setting for mandatory/optional per company |
| Crossboarding | ❌ Not implemented | No code references found |

**Gap count**: 2

### 2-H: Compliance

| Requirement | Status | Evidence |
|------------|--------|----------|
| Data retention periods | ✅ Settings | `process-settings/system/data-retention` |
| GDPR consent management | ✅ DB-driven | `ConsentRecord` + `DataProcessingPurpose` models |
| Mandatory training requirements | ⚠️ Partial | `MandatoryConfigTab` exists but country-specific requirements hardcoded |

**Gap count**: 1

### 2-I: Notifications & System

| Requirement | Status | Evidence |
|------------|--------|----------|
| Default locale | ✅ Settings | `process-settings/system/locale` |
| Notification channels | ✅ Settings | `process-settings/system/notification-channels` |
| Session timeout | ❌ Not configurable | No setting found; uses NextAuth default |
| Exchange rates | ✅ Settings | `process-settings/system/exchange-rates` |

**Gap count**: 1

---

## 3. Infrastructure Quality

### 3-A: Bootstrap — **PARTIAL**

- **No automatic bootstrapping**: When a new Company is created, no `initSettings()` or `bootstrapSettings()` function exists to copy global defaults.
- **Fallback saves the day**: `getSettingValue()` falls back to `companyId: null` (global), so new companies inherit defaults at read-time.
- **Risk**: If someone creates a company-specific override for Company A, Company B still gets global. This is correct behavior. However, **there's no UI to trigger "copy global → customize for this company"** in bulk.

**Verdict**: ACCEPTABLE but could improve. The global-fallback pattern means no company will ever get 500s from missing settings.

### 3-B: Validation — **PARTIAL (6/34 routes have Zod)**

**Routes WITH Zod validation** (✅):
1. `settings/attendance/route.ts`
2. `settings/branding/route.ts`
3. `settings/company/route.ts`
4. `settings/custom-fields/route.ts`
5. `settings/email-templates/route.ts`
6. `settings/enums/route.ts`

**Routes WITHOUT Zod validation** (⚠️):
1. `settings/compensation/route.ts` — manual destructuring
2. `settings/evaluation/route.ts` — manual destructuring
3. `settings/approval-flows/route.ts` — manual destructuring
4. All `[id]` dynamic routes — manual handling

**Destructive payload test results**:

| Payload | Expected | Actual | Issue |
|---------|----------|--------|-------|
| `{"maxOvertimeHours": -5}` | 400 | 200 | Unknown field silently ignored (not corrupted) |
| `{"maxOvertimeHours": 999999}` | 400 | 200 | Same — field not in schema, ignored |
| `{"maxOvertimeHours": "not-a-number"}` | 400 | 200 | Same — ignored |

**Root cause**: The attendance PUT only processes known fields from the Zod schema. Unknown fields are silently dropped. This is **safe but surprising** — no data corruption, but no error feedback to the client either.

### 3-C: Downstream Impact — **Point-of-use reads (no cache staleness)**

- `getSettingValue()` uses React `cache()` for per-request deduplication only
- No global cache layer → settings changes take effect on next request
- No `effectiveDate` field on `CompanyProcessSetting` → changes are immediate, no scheduling
- **Risk**: Payroll recalculation after mid-month rate change could produce inconsistent results

### 3-D: Cross-Setting Conflicts — **No detection exists**

No cross-validation between settings. Potential conflicts documented:

| Setting A | Setting B | Conflict Risk |
|----------|----------|---------------|
| `attendance/work-hour-limits` (maxWeekly: 40) | `attendance/overtime-rules` (maxOT: 20) | Sum could exceed legal limit |
| `payroll/kr-social-insurance` rates | `payroll/kr-tax-brackets` | Rate changes could make effective tax > 100% |
| `performance/grade-scale` (5 grades) | `performance/calibration-distribution` (expects 4 buckets) | Mismatch = calibration error |

---

## 4. Hardcoded Value Inventory

### Critical Hardcoded Business Rules (NOT covered by FromSettings)

| # | File:Line | Value | Context | Gap Class |
|---|-----------|-------|---------|-----------|
| 1 | `labor/kr.ts:85` | `3` | KR probation months | P1 |
| 2 | `labor/cn.ts` | `6` | CN probation months | P1 |
| 3 | `labor/us.ts` | `3` | US probation months | P1 |
| 4 | `labor/vn.ts` | `6` | VN probation months | P1 |
| 5 | `labor/mx.ts` | `3` | MX probation months | P1 |
| 6 | `labor/ru.ts` | `2` | RU probation months (**has TR data!**) | P0-Bug |
| 7 | `labor/cn.ts:48` | `44` | CN max weekly hours | P0 |
| 8 | `labor/us.ts:39` | `45` | US max weekly hours | P0 |
| 9 | `labor/vn.ts` | `48` | VN max weekly hours | P0 |
| 10 | `labor/mx.ts` | `48` | MX max weekly hours | P0 |
| 11 | `labor/ru.ts` | `45` | RU max weekly hours | P0 |
| 12 | `labor/eu.ts` | `48` | EU max weekly hours | P0 |
| 13 | `labor/cn.ts:14-17` | `1.5/2.0/3.0` | CN OT multipliers | P1 |
| 14 | `labor/mx.ts` | `2.0/3.0` | MX OT multipliers | P1 |
| 15 | `labor/kr.ts:73-78` | `90/10/5/5/12` | KR leave types (mat/pat/wedding/berv/menstrual days) | P1 |
| 16 | `labor/cn.ts:18` | `25.3` | CN min wage (Shanghai region) | P1 |
| 17 | `labor/us.ts:39` | `7.25` | US federal min wage | P1 |
| 18 | `labor/mx.ts:18` | `33.24` | MX min wage | P1 |
| 19 | `labor/vn.ts` | `22500` | VN min wage (Region I) | P1 |
| 20 | `labor/ru.ts` | `134.17` | RU min wage | P1 |
| 21 | `labor/eu.ts` | `28.1` | PL min wage | P1 |
| 22 | `labor/kr.ts:15` | `10030` | KR min wage 2025 | ✅ FromSettings exists |
| 23 | `attendance/workTypeEngine.ts` | `10` | Late tolerance minutes | P2 |
| 24 | `attendance/workTypeEngine.ts` | `9*60, 18*60` | Standard 09:00-18:00 shift | P2 |
| 25 | `nudge/rules/leave-pending.rule.ts:26-28` | `3, 2, 3` | Trigger/repeat/max nudges | P2 |
| 26 | `nudge/rules/payroll-review.rule.ts:28-30` | `1, 1, 5` | Trigger/repeat/max nudges | P2 |
| 27 | `pending-actions.ts:43-44` | `1, 3` | Urgent/high priority day thresholds | P2 |
| 28 | `pending-actions.ts:292` | `30` | Contract expiry alert days | P2 |
| 29 | `pending-actions.ts:322` | `60` | Work permit expiry alert days | P2 |
| 30 | `analytics/predictive/turnoverRisk.ts:70+` | `3/2/1` → scores | Score boundaries | P2 |
| 31 | `analytics/predictive/teamHealth.ts:104+` | `0.3/0.2/0.1` | Team health thresholds | P2 |
| 32 | `contract/rules.ts:17-38` | Various | Probation ranges per country | P1 |

### Bug Found

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `labor/ru.ts` | `laborConfig` has Turkey (`country_code: 'TR'`) data, not Russia | **P0-Bug** |
| 2 | `labor/vn.ts` | OT label says "India OT" instead of Vietnam | P2-Bug |

---

## 5. Country-Risk Fallback Matrix

| # | Function | Setting | Fallback | KR | CN | US | VN | MX | RU | Risk |
|---|----------|---------|---------|----|----|----|----|----|----|------|
| 1 | `getKrLaborConfigFromSettings` | work-hour-limits | 52/40/12 | ✅ | ❌44 | ❌40 | ❌48 | ❌48 | ❌40* | **P0** — wrong for 5/6 |
| 2 | `getKrLaborConfigFromSettings` | min-wage | 10030₩ | ✅ | ❌25.3¥ | ❌7.25$ | ❌22500₫ | ❌33.24$ | ❌134₽ | **P0** — KR-only |
| 3 | `calculateSocialInsuranceFromSettings` | kr-social-insurance | KR rates | ✅ | N/A | N/A | N/A | N/A | N/A | OK — KR-specific |
| 4 | `calculateIncomeTaxFromSettings` | kr-tax-brackets | KR 8-bracket | ✅ | N/A | N/A | N/A | N/A | N/A | OK — KR-specific |
| 5 | `separateTaxableIncomeFromSettings` | kr-nontaxable-limits | 200k/100k/100k | ✅ | N/A | N/A | N/A | N/A | N/A | OK — KR-specific |
| 6 | `detectPayrollAnomaliesFromSettings` | anomaly-thresholds | 30%/52h/20%/3% | ✅ | ⚠️52→36 | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **P1** — OT limit varies |
| 7 | `getApprovalChainFromSettings` | approval-chains | Per-code map | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| 8 | `getBankCodesFromSettings` | bank-codes | 18 KR banks | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **P1** — KR-only |
| 9 | `getPayDayFromSettings` | pay-schedule | Day 25 | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **P1** — varies by country |
| 10-15 | `calculateDeductions*FromSettings` | [country]-deductions | Per-country rates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK — each has own setting |
| 16 | `calculateDeductionsByCountryFromSettings` | Dispatcher | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OK |

**Key risk**: Functions #1-2 are KR-centric with KR defaults. Non-KR companies calling these get wrong values unless they have company-specific overrides (which don't exist for labor configs).

*Russia has a bug — `laborConfig` has Turkey data.

---

## 6. Live Test Results

### 6-A: Propagation Tests

| # | Setting | Action | Result | Notes |
|---|---------|--------|--------|-------|
| 1 | Attendance alertThresholds | GET | ✅ 200 | Returns caution:44, warning:48, blocked:52 |
| 2 | Attendance PUT (negative) | PUT `{"maxOvertimeHours": -5}` | ⚠️ 200 | Unknown field silently ignored — no 400 |
| 3 | Attendance PUT (absurd) | PUT `{"maxOvertimeHours": 999999}` | ⚠️ 200 | Same |
| 4 | Attendance PUT (type) | PUT `{"maxOvertimeHours": "str"}` | ⚠️ 200 | Same |
| 5 | Evaluation scale | GET | ✅ 200 | Returns 1-5 scale + grade labels |
| 6 | Evaluation (no companyId) | GET | ⚠️ 400 | Requires explicit companyId param |
| 7 | Compensation (no companyId) | GET | ⚠️ 400 | Same |
| 8 | Evaluation (with companyId) | GET | ✅ 200 | Returns MBO_BEI methodology + grades |
| 9 | Compensation (with companyId) | GET | ✅ 200 | Returns payComponents array |

**Finding**: Evaluation & Compensation routes don't auto-detect companyId from session — requires explicit param. Attendance auto-detects. Inconsistency.

### 6-B: Bootstrap Tests

| # | Endpoint | companyId | HTTP | Pass? |
|---|---------|-----------|------|-------|
| 1 | `/api/v1/settings/attendance` | auto | 200 | ✅ |
| 2 | `/api/v1/settings/company` | auto | 200 | ✅ |
| 3 | `/api/v1/settings/evaluation-scale` | auto | 200 | ✅ |
| 4 | `/api/v1/payroll/dashboard` | auto | 200 | ✅ |
| 5 | `/api/v1/analytics/workforce/overview` | auto | 200 | ✅ |
| 6 | `/api/v1/leave/type-defs` | auto | 200 | ✅ |

**All pass** — global fallback pattern works. No 500s even without company-specific settings.

---

## 7. ★ FIX BLUEPRINT ★

### 7-A: Stub Tab Implementation Specs

#### Tab: `overtime` — 초과근무 규칙
- **Category:** Attendance
- **Purpose:** Allows admin to define OT rate tiers (weekday/weekend/holiday/night multipliers) per company
- **Data Model:** No `OvertimeRule` model exists. Use `CompanyProcessSetting` key `ATTENDANCE/overtime-rules` (already seeded with basic structure)
- **API Route:** Existing `process-settings/attendance` endpoint handles read. Need: dedicated PUT for overtime rules with validation
- **API Contract:**
  - GET: Already works via `process-settings/attendance` → `overtime-rules` key
  - PUT: `{ rates: [{ label: string, multiplier: number, condition: string }], nightShift: { startHour: number, endHour: number } }`
- **Global + Override:** Yes — global default + per-company override
- **FromSettings function needed?** Yes — `getOvertimeRatesFromSettings(companyId)` → used by `calculator.ts`
- **UI Component:** Table of OT tiers with multiplier inputs + night shift time range
- **Seed Data:** Already partially seeded as `overtime-rules`
- **Dependencies:** `calculator.ts` currently reads `laborConfig.overtime_rates` → must be updated to call FromSettings
- **Estimated effort:** M (2-3 hours)

### 7-B: Hardcoded → Settings Conversion Specs

#### HC-1: Country-Specific Work Hour Limits (P0)
- **Current location:** `lib/labor/{cn,us,vn,mx,ru,eu}.ts` — each has `standard_hours_weekly`, `max_overtime_weekly` etc.
- **Current values:** CN:40/36, US:40/20, VN:48/12, MX:48/9, RU:45/11, EU:40/8
- **Target:** `CompanyProcessSetting` key `ATTENDANCE/work-hour-limits` with per-company overrides
- **Conversion pattern:**
  1. Extend existing `ATTENDANCE/work-hour-limits` seed to include all 6 country variants
  2. Create `getWorkHourLimitsFromSettings(companyId, countryCode)` in `lib/labor/index.ts`
  3. Replace hardcoded references in `getLaborModule().getOvertimeLimit()` and `validateWorkHours()`
  4. Each country gets a company-specific override seed
- **Country values:** KR=52/12, CN=44/36, US=40/20, VN=48/12, MX=48/9, RU=40/11, EU=48/8
- **Files to change:** `lib/labor/index.ts`, all 7 country files, `prisma/seeds/26-process-settings.ts`
- **Estimated effort:** M (2-3 hours)

#### HC-2: Minimum Wage Per Country (P1)
- **Current location:** `lib/labor/{cn,us,vn,mx,ru,eu}.ts` — `getMinWage()` methods
- **Current values:** CN:25.3¥, US:7.25$, VN:22500₫, MX:33.24$, RU:134.17₽, EU:28.1zł
- **Target:** `CompanyProcessSetting` key `ATTENDANCE/min-wage` with per-country overrides
- **Conversion:** Extend existing KR `min-wage` seed, add per-country records
- **Estimated effort:** S (1 hour)

#### HC-3: Probation Period Per Country (P1)
- **Current location:** `lib/labor/*.ts` → `probation_months` + `lib/contract/rules.ts`
- **Current values:** KR:3mo, CN:1-6mo, US:3mo(at-will), VN:2-6mo, MX:1mo, RU:3mo
- **Target:** `CompanyProcessSetting` key `ORGANIZATION/probation-rules`
- **Conversion:** New setting key + `getProbationRulesFromSettings(companyId)`
- **Dependencies:** `contract/rules.ts` reads these for contract validation
- **Estimated effort:** S (1 hour)

#### HC-4: Overtime Multipliers Per Country (P1)
- **Current location:** `lib/labor/*.ts` → `laborConfig.overtime_rates`
- **Target:** Part of Stub-A `overtime` tab fix (see 7-A)
- **Estimated effort:** Included in Tab: overtime

#### HC-5: Leave Types in laborConfig (P1)
- **Current location:** `lib/labor/*.ts` → `laborConfig.leave_types`
- **Issue:** These define statutory leave types (maternity, paternity, etc.) per country as hardcoded arrays
- **Target:** `LeaveTypeDef` model already exists and is configurable. The laborConfig leave_types are only used in `calculateLeaveAccrual()` which already has a DB-driven path.
- **Conversion:** Ensure all country-specific leave types are seeded as `LeaveTypeDef` records
- **Estimated effort:** S (1 hour — seed data only)

#### HC-6: Nudge Rule Thresholds (P2)
- **Current location:** `lib/nudge/rules/leave-pending.rule.ts:26-28`, `payroll-review.rule.ts:28-30`
- **Target:** `CompanyProcessSetting` key `SYSTEM/nudge-rules`
- **Conversion:** New setting + `getNudgeRulesFromSettings(companyId, ruleType)`
- **Estimated effort:** S (1 hour)

#### HC-7: Pending Action Priority Thresholds (P2)
- **Current location:** `lib/pending-actions.ts:43-44, 292, 322`
- **Target:** `CompanyProcessSetting` key `SYSTEM/alert-thresholds`
- **Estimated effort:** S (30 min)

#### HC-8: Analytics Score Boundaries (P2)
- **Current location:** `lib/analytics/predictive/turnoverRisk.ts:70+`, `teamHealth.ts:104+`
- **Target:** `CompanyProcessSetting` key `SYSTEM/analytics-thresholds`
- **Estimated effort:** S (30 min)

### 7-C: Missing Feature Specs

#### Missing-1: 13th Month / Aguinaldo Salary (MX)
- **Countries requiring:** Mexico (legal), Philippines (if added)
- **Legal requirement?** Yes — Mexico LFT Art. 87 requires 15-day aguinaldo
- **Scope:** New calculation in payroll calculator + seed data for MX deductions
- **Can launch without?** Yes with workaround — HR can manually add as bonus
- **Estimated effort:** M (2-3 hours)

#### Missing-2: Crossboarding (Internal Transfer Onboarding)
- **Countries:** All
- **Legal requirement?** No
- **Can launch without?** Yes — manual process via onboarding templates
- **Estimated effort:** L (6+ hours — new module)

#### Missing-3: Session Timeout Configuration
- **Scope:** Add `SYSTEM/session-config` setting + apply in middleware
- **Can launch without?** Yes — uses NextAuth default
- **Estimated effort:** S (1 hour)

#### Missing-4: Offer Letter Templates
- **Scope:** `RECRUITMENT/offer-templates` setting + template engine
- **Can launch without?** Yes — manual offer letters
- **Estimated effort:** M (3-4 hours)

### 7-D: Bug Fixes Required

#### Bug-1: Russia laborConfig Has Turkey Data (P0)
- **File:** `lib/labor/ru.ts`
- **Issue:** `laborConfig` object has `country_code: 'TR'`, Turkey probation (2mo), Turkey OT rates
- **Fix:** Replace entire `laborConfig` with correct Russia values
- **Russia values:** standard_hours_weekly: 40, max_overtime_weekly: 4h/day, probation: 3mo, annual leave: 28d, OT: 1.5x first 2h then 2x
- **Estimated effort:** S (30 min)

#### Bug-2: Vietnam OT Label Says "India OT"
- **File:** `lib/labor/vn.ts`
- **Issue:** Copy-paste error — OT rate label says "India OT"
- **Fix:** Change label to "Làm thêm giờ" or "VN OT"
- **Estimated effort:** XS (5 min)

### 7-E: Validation Gaps to Fix

| # | Route | Issue | Fix |
|---|-------|-------|-----|
| 1 | `settings/compensation/route.ts` | No Zod validation on PUT | Add compensationUpdateSchema |
| 2 | `settings/evaluation/route.ts` | No Zod validation on PUT | Add evaluationUpdateSchema |
| 3 | `settings/approval-flows/route.ts` | No Zod validation on POST | Add approvalFlowCreateSchema |
| 4 | `settings/evaluation` & `settings/compensation` | No auto-detect companyId from session | Align with attendance pattern |

**Estimated effort:** S (1 hour for all)

### 7-F: S-Fix Session Plan

| Session | Theme | Gaps Covered | Files (~) | Model | Time | Depends On |
|---------|-------|-------------|-----------|-------|------|------------|
| **S-Fix-1** | Bug fixes + validation | Bug-1 (RU data), Bug-2 (VN label), Validation gaps 1-4 | 5 files | Sonnet | ~30 min | — |
| **S-Fix-2** | Work hour limits → Settings | HC-1 (country work hours), HC-2 (min wage) | 10 files | Opus | ~40 min | — |
| **S-Fix-3** | Overtime rates → Settings | HC-4 (OT multipliers), Stub-A (overtime tab) | 8 files | Opus | ~40 min | S-Fix-2 |
| **S-Fix-4** | Organization settings | HC-3 (probation), HC-5 (leave types seed) | 6 files | Sonnet | ~30 min | — |
| **S-Fix-5** | System settings | HC-6 (nudge rules), HC-7 (priority thresholds), HC-8 (analytics) | 6 files | Sonnet | ~30 min | — |
| **S-Fix-6** | Missing features | Missing-1 (aguinaldo), Missing-3 (session timeout) | 4 files | Opus | ~40 min | S-Fix-2 |

**Dependency graph:**
```
S-Fix-1 ─┐
S-Fix-2 ─┤──→ S-Fix-3 ──→ S-Fix-6
S-Fix-4 ─┘
S-Fix-5 ─────────────────────────── (independent)
```

**Parallelization**: S-Fix-1, S-Fix-2, S-Fix-4, S-Fix-5 can run in parallel. S-Fix-3 depends on S-Fix-2. S-Fix-6 depends on S-Fix-2.

---

## 8. Summary Counts

| Metric | Count |
|--------|-------|
| **FromSettings functions** | 16 (confirmed, Pre-flight said 15) |
| **Settings API routes** | 34 (under `/api/v1/settings/` + `/api/v1/process-settings/`) |
| **CompanyProcessSetting records** | 34 (13 payroll + 7 attendance + 4 perf + 5 system + 1 org + 4 recruit) |
| **UI tabs** | 44 total (43 Active + 1 Stub-A) |
| **Stub tabs to implement** | 1 (Stub-A: overtime) |
| **P0 gaps** | 7 (6 country work hour limits + 1 RU bug) |
| **P1 gaps** | 12 (min wages × 5, probation, OT multipliers, leave types, bank codes, pay day, anomaly OT limit, offer templates) |
| **P2 gaps** | 8 (nudge rules, priority thresholds, analytics scores, grace period, late tolerance, contract expiry alert) |
| **Bugs** | 2 (RU→Turkey data, VN→India label) |
| **Validation gaps** | 4 routes missing Zod |
| **Hardcoded values to convert** | 8 categories (HC-1 through HC-8) |
| **Missing features** | 4 (aguinaldo, crossboarding, session timeout, offer templates) |
| **S-Fix sessions needed** | 6 |
| **Estimated total S-Fix time** | ~3.5 hours |

---

## 9. Pre-flight Accuracy Assessment

| Pre-flight Claim | Actual | Accuracy |
|-----------------|--------|----------|
| 15 FromSettings functions | 16 | ✅ Close (missed dispatcher) |
| 33 CompanyProcessSetting records | 34 (live) | ✅ Close |
| 43 Settings/Config Prisma models | Not recounted (accepted) | — |
| 51 Settings API endpoints | 34 direct settings routes | ⚠️ Overcounted (included config-related) |
| 25 Active / 19 Stub tabs | 43 Active / 1 Stub | ❌ **Major overcount of stubs** |
| ~45 hardcoded country requirements | 32 confirmed business rules | ⚠️ Inflated but directionally correct |
| ~18 missing features | 4 confirmed missing | ❌ **Major overcount** |

**Key correction**: Pre-flight's stub tab count (19) was dramatically wrong — actual is 1. Most "stubs" were partially-implemented tabs that Pre-flight misclassified. This changes the Fix Blueprint significantly: instead of 19 tabs to build, only the OT tab needs work.

---

## Verdict

**{AUDIT COMPLETE — Blueprint ready for S-Fix execution}**

The codebase has a solid settings infrastructure (global-fallback pattern, React cache dedup, CompanyProcessSetting unified model). The primary gap is that **only Korea has Settings-driven labor configs** — the other 5 countries run entirely on hardcoded constants. The Fix Blueprint targets 6 sessions (~3.5h total) to bring all countries to parity.

Critical path: **S-Fix-1** (bugs) → **S-Fix-2** (work hours) → **S-Fix-3** (OT rates) is the highest-priority chain.
