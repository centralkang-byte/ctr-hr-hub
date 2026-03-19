# QF-REPORT: S-Fix-3 — OT Rates → Settings + Overtime Tab

| Field | Value |
|-------|-------|
| Date | 2026-03-18 |
| Tool | Claude Code Desktop (Opus) |
| Duration | ~35 min |

## Phase 1: OT Rate Structure Analysis
- Current structure: `LaborConfig.overtime_rates: OvertimeRate[]` with `{label, multiplier, condition}` per country
- Conditions: `WEEKDAY_OT`, `WEEKEND`, `HOLIDAY`, `NIGHT`, `FIRST_9H`, `AFTER_9H`
- Night shift: `NightShiftRule {start_hour, end_hour}` — uniformly 22:00-06:00 across all countries
- Callers: Only `src/lib/payroll/calculator.ts:50` directly reads `laborConfig.overtime_rates`
- Existing global seed: `ATTENDANCE/overtime-rules` already existed with flat `multipliers` object

## Phase 2: FromSettings Function
| Function | File | Fallback Countries |
|----------|------|-------------------|
| getOvertimeRatesFromSettings | lib/labor/settings.ts | 8 (KR,CN,US,VN,MX,RU,EU,PL) |

Interface: `OvertimeRateSettings { rates: OvertimeRate[], nightShift: NightShiftRule }`
DB format support: Both flat `multipliers` object and full `rates[]` array
Fallback: company override → global default → hardcoded country constant

## Phase 3: Calculator Connection
| # | Caller File | Before | After | Sync→Async? |
|---|------------|--------|-------|-------------|
| 1 | lib/payroll/calculator.ts | `laborConfig.overtime_rates[0..3]` by index | `findRate(condition, fallback)` by condition name | No (caller already async, inner fn stays sync with rates param) |

Design: `calculateOvertimePay()` now accepts optional `otRates` param. The async caller `calculatePayrollForEmployee()` loads rates from settings and passes them down. No sync→async cascade needed.

## Phase 4: Seed Data
| # | companyCode | OT Rates Summary |
|---|-------------|-----------------|
| 1 | CTR-KR | weekday 1.5x, weekend 1.5x, holiday 2.0x, night +0.5x |
| 2 | CTR-CN | weekday 1.5x, weekend 2.0x, holiday 3.0x |
| 3 | CTR-US | weekday 1.5x, weekend 1.5x, holiday 1.5x |
| 4 | CTR-VN | weekday 2.0x, weekend 2.0x, holiday 3.0x, night +0.3x |
| 5 | CTR-MX | weekday 2.0x, weekend 2.0x, holiday 3.0x |
| 6 | CTR-RU | weekday 1.5x, weekend 2.0x, holiday 2.0x, night +0.2x |
| 7 | CTR-EU | weekday 1.5x, weekend 2.0x, holiday 2.0x |

Seed execution: ✅ (7 created, 14 updated)
DB verification: ✅ (8 rows: 7 per-company + 1 global)

## Phase 5: Overtime Tab UI
- Component file: `src/app/(dashboard)/settings/attendance/tabs/OvertimeTab.tsx`
- API connection: `useProcessSetting` hook → GET/PUT `/api/v1/process-settings/attendance` with key `overtime-rules`
- i18n keys: Reused existing 10+ keys from ko.json (no new keys needed)
- Features:
  - ✅ Pre-approval toggle (requiresApproval checkbox)
  - ✅ Night shift hours (numeric inputs for start/end hour)
  - ✅ Editable rate table (weekday, weekend, holiday, night — numeric inputs)
  - ✅ Country reference table (7 countries, read-only)
  - ✅ Save with change detection (disabled until changes)
  - ✅ Revert button (appears when changes detected)
  - ✅ isOverridden status from API
  - ✅ Loading spinner
  - ✅ CRAFTUI design (#5E81F4 primary)

## Phase 6: Verification
| # | Test | Expected | Actual |
|---|------|----------|--------|
| 1 | tsc --noEmit | 0 errors | ✅ 0 errors |
| 2 | eslint (changed files) | 0 errors | ✅ 0 errors |
| 3 | Seed execution | 7 OT records | ✅ 7 created |
| 4 | DB verification | 8 rows (7+global) | ✅ 8 rows |
| 5 | US maxWeekly | 40 | ✅ 40 (corrected from 45) |

### US maxWeekly Correction
- Before: 45 (incorrect — company policy, not FLSA standard)
- After: 40 (FLSA standard — OT starts at 40h)
- Seed updated: ✅ (description also updated)

## Files Modified
| File | Change |
|------|--------|
| src/lib/labor/settings.ts | +OvertimeRateSettings interface, +getOvertimeRatesFromSettings(), +OT_RATE_DEFAULTS (8 countries) |
| src/lib/labor/kr.ts | +getOvertimeRatesFromSettings import, extended return type |
| src/lib/labor/cn.ts | Same pattern |
| src/lib/labor/us.ts | Same pattern |
| src/lib/labor/vn.ts | Same pattern |
| src/lib/labor/mx.ts | Same pattern |
| src/lib/labor/ru.ts | Same pattern |
| src/lib/labor/eu.ts | Same pattern |
| src/lib/labor/index.ts | +getOvertimeRatesFromSettings re-export |
| src/lib/payroll/calculator.ts | Replaced hardcoded `laborConfig.overtime_rates` with settings-aware rates param |
| prisma/seeds/26-process-settings.ts | +7 per-company OT seed records, fixed US maxWeekly 45→40 |
| src/app/(dashboard)/settings/attendance/tabs/OvertimeTab.tsx | Full rewrite: stub → useProcessSetting CRUD |

## Summary
- OT FromSettings function: ✅
- Country modules updated: 7/7
- Calculator connected: ✅
- Seed records: 7 per-company + 1 global = 8
- Overtime tab: STUB → ACTIVE (useProcessSetting, editable rates, save/revert)
- Stub tabs remaining: 0/44
- tsc: PASS
- lint: PASS (changed files)

## Verdict
**PASS**
