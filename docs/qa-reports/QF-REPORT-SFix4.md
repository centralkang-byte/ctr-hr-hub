# QF-REPORT: S-Fix-4 — Probation Rules + Leave Types Seed

| Field | Value |
|-------|-------|
| Date | 2026-03-18 |
| Tool | Claude Code Desktop (Opus 4.6) |
| Duration | ~20 min |

## Part A: Probation Rules

### New Function

| Function | File | Countries |
|----------|------|-----------|
| `getProbationRulesFromSettings()` | `src/lib/labor/settings.ts` | KR, CN, US, VN, MX, RU, EU, PL |
| `getOrganizationSetting()` | `src/lib/settings/get-setting.ts` | (helper) |

### Country Config Loaders Extended

| # | File | Function | Added |
|---|------|----------|-------|
| 1 | `src/lib/labor/kr.ts` | `getKrLaborConfigFromSettings` | `probation: ProbationRulesSettings` |
| 2 | `src/lib/labor/cn.ts` | `getCnLaborConfigFromSettings` | `probation: ProbationRulesSettings` |
| 3 | `src/lib/labor/us.ts` | `getUsLaborConfigFromSettings` | `probation: ProbationRulesSettings` |
| 4 | `src/lib/labor/vn.ts` | `getVnLaborConfigFromSettings` | `probation: ProbationRulesSettings` |
| 5 | `src/lib/labor/mx.ts` | `getMxLaborConfigFromSettings` | `probation: ProbationRulesSettings` |
| 6 | `src/lib/labor/ru.ts` | `getRuLaborConfigFromSettings` | `probation: ProbationRulesSettings` |
| 7 | `src/lib/labor/eu.ts` | `getEuLaborConfigFromSettings` | `probation: ProbationRulesSettings` |

### Seed Data

| # | companyCode | defaultMonths | maxMonths | leaveEligible | noticeDays |
|---|-------------|--------------|-----------|---------------|------------|
| 0 | GLOBAL | 3 | 6 | 3mo | 14d |
| 1 | CTR-KR | 3 | 3 | 3mo | 30d |
| 2 | CTR-CN | 6 | 6 | 6mo | 3d |
| 3 | CTR-US | 3 | 3 | 0mo | 0d |
| 4 | CTR-VN | 6 | 6 | 6mo | 3d |
| 5 | CTR-MX | 3 | 3 | 3mo | 15d |
| 6 | CTR-RU | 3 | 3 | 6mo | 3d |
| 7 | CTR-EU | 3 | 3 | 3mo | 14d |

Seed execution: **PASS** (1 global + 7 per-company created)
DB verification: **PASS**

## Part B: Leave Types Seed

### Before (existing per company)

| Company | Types |
|---------|-------|
| GLOBAL | annual, sick, bereavement, maternity, paternity, unpaid |
| CTR-KR | annual, sick, bereavement, maternity, paternity, childcare, special, unpaid |
| CTR-US | pto, sick, bereavement, maternity, paternity, unpaid |
| CTR-CN | annual, sick, marriage, maternity, paternity, bereavement, spring_festival, unpaid |
| CTR-VN | (inherited global only) |
| CTR-MX | (inherited global only) |
| CTR-RU | (inherited global only) |
| CTR-EU | (inherited global only) |

### After (added)

| Company | Types Added | Count |
|---------|------------|-------|
| CTR-VN | annual, sick, maternity, paternity, marriage, bereavement, unpaid | 7 |
| CTR-MX | annual, maternity, paternity, bereavement, unpaid | 5 |
| CTR-RU | annual, sick, maternity, bereavement, marriage, unpaid | 6 |
| CTR-EU | annual, sick, maternity, paternity, bereavement, marriage, on_demand, childcare, unpaid | 9 |
| CTR-KR | menstrual, marriage | 2 |
| **Total** | | **29** |

Seed execution: **PASS**
DB verification: **PASS**

### Leave Type Coverage

| Company | Total Types | Has Maternity | Has Paternity | Has Sick |
|---------|------------|---------------|---------------|----------|
| GLOBAL | 6 | Yes | Yes | Yes |
| CTR-KR | 10 | Yes | Yes | Yes |
| CTR-US | 6 | Yes | Yes | Yes |
| CTR-CN | 8 | Yes | Yes | Yes |
| CTR-VN | 7 | Yes | Yes | Yes |
| CTR-MX | 5 | Yes | Yes | No* |
| CTR-RU | 6 | Yes | No* | Yes |
| CTR-EU | 9 | Yes | Yes | Yes |

\* CTR-MX: No statutory sick leave (IMSS social insurance covers it); falls back to GLOBAL sick type.
\* CTR-RU: No statutory paternity leave in Russian labor code; falls back to GLOBAL paternity type.

## Verification

| # | Test | Expected | Actual |
|---|------|----------|--------|
| 1 | leave/type-defs API | 200 | 200 (57 types) |
| 2 | attendance/today | 200 | 200 |
| 3 | payroll/dashboard | 200 | 200 |
| 4 | tsc --noEmit | PASS | PASS |

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/labor/settings.ts` | Added `ProbationRulesSettings` interface + `getProbationRulesFromSettings()` |
| 2 | `src/lib/settings/get-setting.ts` | Added `getOrganizationSetting()` |
| 3 | `src/lib/labor/kr.ts` | Extended async config loader with probation |
| 4 | `src/lib/labor/cn.ts` | Extended async config loader with probation |
| 5 | `src/lib/labor/us.ts` | Extended async config loader with probation |
| 6 | `src/lib/labor/vn.ts` | Extended async config loader with probation |
| 7 | `src/lib/labor/mx.ts` | Extended async config loader with probation |
| 8 | `src/lib/labor/ru.ts` | Extended async config loader with probation |
| 9 | `src/lib/labor/eu.ts` | Extended async config loader with probation |
| 10 | `prisma/seeds/26-process-settings.ts` | Added probation-rules global + 7 per-company seeds |
| 11 | `prisma/seeds/35-statutory-leave-types.ts` | **NEW** — statutory leave types for VN/MX/RU/EU + KR extras |

## Summary

- New FromSettings function: 1 (`getProbationRulesFromSettings`)
- New helper: 1 (`getOrganizationSetting`)
- Probation seed records: 8 (1 global + 7 per-company)
- Leave types added: 29 across 5 companies
- Country config loaders extended: 7 files
- tsc: **PASS**

## Verdict

**PASS**
