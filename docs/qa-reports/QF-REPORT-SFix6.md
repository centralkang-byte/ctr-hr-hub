# QF-REPORT: S-Fix-6 — Aguinaldo + PL Deductions + Session Timeout

| Field | Value |
|-------|-------|
| Date | 2026-03-18 |
| Tool | Claude Code Desktop (Opus) |
| Duration | ~25 min |

## Phase 0: S-Fix-5 Seed Execution
| settingKey | Status |
|-----------|--------|
| nudge-rules | ✅ Verified (global) |
| alert-thresholds | ✅ Verified (global) |
| analytics-thresholds | ✅ Verified (global) |

## Part A: PL Deductions
- Function: `calculateDeductionsPL()` + `calculateDeductionsPLFromSettings()`
- Dispatcher updated: PL/EU branch added to both sync and async dispatchers
- Rates: ZUS (pension 9.76%, disability 1.5%, sickness 2.45%) + Health 9% + PIT 12%/32% (progressive, 30k tax-free) + PPK 2%
- Health insurance calculated on post-ZUS basis (monthlyGross - pension - disability - sickness)
- Seed: pl-deductions (global + CTR-EU)
- tsc: PASS

## Part B: Aguinaldo
- Function: `calculateAguinaldo()` in new file `src/lib/payroll/aguinaldo.ts`
- Exported via `src/lib/payroll/index.ts`
- Formula: dailySalary × (daysWorked/365) × 15 days (proportional for partial year)
- Tax exempt: 30 × UMA daily (113.14 MXN) = 3,394.20 MXN
- Seed: aguinaldo-config (global + CTR-MX)
- tsc: PASS

## Part C: Session Timeout
- Function: `getSessionConfigFromSettings()` in `src/lib/settings/get-setting.ts`
- Interface: `SessionConfigSettings` (maxAgeMinutes, idleTimeoutMinutes, extendOnActivity)
- NextAuth maxAge: Already static 8h at `src/lib/auth.ts:117` (no async injection — avoids NextAuth trap)
- idleTimeoutMinutes: Available for client-side idle detection
- Seed: session-config (global)
- tsc: PASS

## Seed Data
| # | settingKey | Scope | Source |
|---|-----------|-------|--------|
| 1 | nudge-rules | Global | S-Fix-5 backlog |
| 2 | alert-thresholds | Global | S-Fix-5 backlog |
| 3 | analytics-thresholds | Global | S-Fix-5 backlog |
| 4 | pl-deductions | Global + CTR-EU | ZUS+PIT+PPK 2025 |
| 5 | aguinaldo-config | Global + CTR-MX | LFT Art.87 |
| 6 | session-config | Global | Enterprise default |

Total DB records: 8 (6 global + 2 per-company)

## Verification
| # | Test | Expected | Actual |
|---|------|----------|--------|
| 1 | tsc --noEmit | PASS | PASS |
| 2 | Seeds created | 6+ records | 8 records (3 created Phase 0 + 3+2 new) |
| 3 | PL dispatcher | PL/EU mapped | ✅ Both sync and async |
| 4 | Aguinaldo export | In payroll index | ✅ |

## Files Modified
| File | Change |
|------|--------|
| `src/lib/payroll/globalDeductions.ts` | Added PL calculator (sync+async) + PL/EU dispatcher branch |
| `src/lib/payroll/aguinaldo.ts` | NEW — Mexico Aguinaldo calculator |
| `src/lib/payroll/index.ts` | Added calculateAguinaldo export |
| `src/lib/settings/get-setting.ts` | Added SessionConfigSettings + getSessionConfigSettings() |
| `prisma/seeds/26-process-settings.ts` | Added 3 global + 2 per-company seed entries |

## Summary
- New functions: 5 (calculateDeductionsPL, calculateDeductionsPLFromSettings, calculateAguinaldo, calculateIncomeTaxPL, getSessionConfigSettings)
- Dispatcher updated: PL/EU branch in both sync and async
- Seed records: 8 total (3 S-Fix-5 backlog + 5 S-Fix-6)
- tsc: PASS

## Verdict
**PASS**
