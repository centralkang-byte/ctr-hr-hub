# QF-REPORT: S-Fix-2 — Work Hour Limits + Min Wage → Settings

| Field | Value |
|-------|-------|
| Date | 2026-03-18 |
| Tool | Claude Code Desktop (Opus) |
| Duration | ~30 min |

## Phase 1: Pattern Analysis
- KR FromSettings pattern: `getKrLaborConfigFromSettings(companyId?)` calls `getAttendanceSetting<T>('work-hour-limits', companyId)` and `getAttendanceSetting<T>('min-wage', companyId)` with Promise.all, falling back to hardcoded constants
- `getAttendanceSetting` uses `getSettingValue` from `@/lib/settings/get-setting.ts` — wrapped in `cache()` for per-request dedup, does company→global→null fallback
- `LaborModule` interface has sync `getOvertimeLimit()` / `getMinWage()` — kept as-is for sync callers
- New async functions added alongside sync ones for DB-backed lookups
- Key files: `src/lib/labor/kr.ts`, `src/lib/settings/get-setting.ts`

## Phase 2: New Functions Created

| # | Function | File | Signature | Fallback Countries |
|---|----------|------|-----------|-------------------|
| 1 | `getWorkHourLimitsFromSettings` | `src/lib/labor/settings.ts` (NEW) | `(companyId?, countryCode?) → Promise<WorkHourLimitsSettings>` | KR,CN,US,VN,MX,RU,EU,PL |
| 2 | `getMinWageFromSettings` | `src/lib/labor/settings.ts` (NEW) | `(companyId?, countryCode?) → Promise<MinWageSettings>` | KR,CN,US,VN,MX,RU,EU,PL |

Both use `getAttendanceSetting<T>()` internally with 3-tier fallback: company override → global default → hardcoded country constant.

## Phase 3: Hardcoded References Replaced

| # | File | Before | After | Sync→Async? |
|---|------|--------|-------|-------------|
| 1 | `src/lib/labor/kr.ts` | `getAttendanceSetting` direct calls | Uses `getWorkHourLimitsFromSettings` + `getMinWageFromSettings` from settings.ts | Already async |
| 2 | `src/lib/labor/cn.ts` | Hardcoded `44`, `25.3` in sync methods | Added `getCnLaborConfigFromSettings()` async function | New async fn added |
| 3 | `src/lib/labor/us.ts` | Hardcoded `45`, `7.25` in sync methods | Added `getUsLaborConfigFromSettings()` async function | New async fn added |
| 4 | `src/lib/labor/vn.ts` | Hardcoded `48`, `22500` in sync methods | Added `getVnLaborConfigFromSettings()` async function | New async fn added |
| 5 | `src/lib/labor/mx.ts` | Hardcoded `48`, `33.24` in sync methods | Added `getMxLaborConfigFromSettings()` async function | New async fn added |
| 6 | `src/lib/labor/ru.ts` | Hardcoded `40`, `134.17` in sync methods | Added `getRuLaborConfigFromSettings()` async function | New async fn added |
| 7 | `src/lib/labor/eu.ts` | Hardcoded `48`, `28.1` in sync methods | Added `getEuLaborConfigFromSettings()` async function | New async fn added |
| 8 | `src/lib/labor/index.ts` | No settings awareness | Re-exports `getWorkHourLimitsFromSettings`, `getMinWageFromSettings` | N/A |

### Design Decision: Sync LaborModule preserved
The `LaborModule` interface (`getOvertimeLimit()`, `getMinWage()`) remains sync with hardcoded fallback values. This avoids breaking the existing interface contract. New async `get*LaborConfigFromSettings()` functions are added alongside for callers that need DB-backed, configurable values. The sync methods serve as fast, zero-I/O defaults.

## Phase 4: Seed Data

| # | settingKey | companyCode | Values | Method |
|---|-----------|-------------|--------|--------|
| 1 | work-hour-limits | GLOBAL (null) | 52/40/12 (KR defaults) | upsert (pre-existing) |
| 2 | work-hour-limits | CTR-KR | 52/40/12 | create |
| 3 | work-hour-limits | CTR-CN | 44/40/36 | create |
| 4 | work-hour-limits | CTR-US | 45/40/20 | create |
| 5 | work-hour-limits | CTR-VN | 48/48/12 | create |
| 6 | work-hour-limits | CTR-MX | 48/48/9 | create |
| 7 | work-hour-limits | CTR-RU | 40/40/4 | create |
| 8 | work-hour-limits | CTR-EU | 48/40/8 | create |
| 9 | min-wage | GLOBAL (null) | 10030 KRW | upsert (pre-existing) |
| 10 | min-wage | CTR-KR | 10030 KRW | create |
| 11 | min-wage | CTR-CN | 25.3 CNY | create |
| 12 | min-wage | CTR-US | 7.25 USD | create |
| 13 | min-wage | CTR-VN | 22500 VND | create |
| 14 | min-wage | CTR-MX | 33.24 MXN | create |
| 15 | min-wage | CTR-RU | 134.17 RUB | create |
| 16 | min-wage | CTR-EU | 28.1 PLN | create |

Seed execution: ✅ (14 created, 0 updated per-company; 0 created, 32 updated global)
DB verification: ✅ (16 rows found: 7 work-hour-limits + 7 min-wage per-company + 2 global)

## Phase 5: Integration Verification

| # | Test | Expected | Actual |
|---|------|----------|--------|
| 1 | Per-company value CTR-CN work-hour-limits | maxWeekly=44 | ✅ 44 |
| 2 | Per-company value CTR-US work-hour-limits | maxWeekly=45 | ✅ 45 |
| 3 | Per-company value CTR-RU work-hour-limits | maxWeekly=40 | ✅ 40 |
| 4 | Per-company value CTR-KR work-hour-limits | maxWeekly=52 | ✅ 52 |
| 5 | Global fallback (nonexistent companyId) | maxWeekly=52 | ✅ 52 |
| 6 | Per-company min-wage CTR-CN | 25.3 CNY | ✅ 25.3 CNY |
| 7 | Per-company min-wage CTR-US | 7.25 USD | ✅ 7.25 USD |
| 8 | attendance/today API | 200 | ✅ 200 |
| 9 | payroll/dashboard API | 200 | ✅ 200 |
| 10 | tsc --noEmit | PASS | ✅ PASS |

## Summary
- New FromSettings functions: 2 (generalized) + 7 (per-country convenience wrappers)
- New file: `src/lib/labor/settings.ts`
- Hardcoded references: All 7 country modules now have async DB-backed alternatives
- Seed records added: 14 per-company (7 work-hour-limits + 7 min-wage)
- Callers updated: KR's `getKrLaborConfigFromSettings` refactored to use shared functions
- tsc: PASS (0 errors)
- No interface breaks: sync `LaborModule` methods preserved

## Files Modified
1. `src/lib/labor/settings.ts` — **NEW** — Generalized FromSettings functions
2. `src/lib/labor/kr.ts` — Refactored to use shared settings functions
3. `src/lib/labor/cn.ts` — Added `getCnLaborConfigFromSettings()`
4. `src/lib/labor/us.ts` — Added `getUsLaborConfigFromSettings()`
5. `src/lib/labor/vn.ts` — Added `getVnLaborConfigFromSettings()`
6. `src/lib/labor/mx.ts` — Added `getMxLaborConfigFromSettings()`
7. `src/lib/labor/ru.ts` — Added `getRuLaborConfigFromSettings()`
8. `src/lib/labor/eu.ts` — Added `getEuLaborConfigFromSettings()`
9. `src/lib/labor/index.ts` — Re-exports generalized functions
10. `prisma/seeds/26-process-settings.ts` — Added 14 per-company labor settings

## Verdict
**PASS**
