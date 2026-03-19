# QF-C1a-SeedFix: Permission & Seed Remediation

Generated: 2026-03-19T08:31+09:00

## Problem Statement

Across Phase A, S, and C-1a, multiple issues were deferred as "seed data problem."
These blocked C-1b (Horizontal Isolation) and C-2 (Integration Pipelines) testing.

## Fixes Applied

| # | Issue | Root Cause | Fix | Verified |
|---|-------|-----------|-----|----------|
| 1 | HR_ADMIN 403 on ALL settings routes | `modules` array missing `settings` | Added `settings`, `training`, `pulse`, `succession` to seed modules | HR Admin has all 4 new modules |
| 2 | HR_ADMIN 403 on Leave Type Defs | Route uses `MODULE.SETTINGS` — no `settings` perms existed | Resolved by Fix #1 | Uses `perm(MODULE.SETTINGS, ACTION.VIEW)` |
| 3 | HR_ADMIN 403 on Calibration Rules | Route uses `MODULE.SETTINGS` — no `settings` perms existed | Resolved by Fix #1 | Uses `perm(MODULE.SETTINGS, ACTION.VIEW)` |
| 4 | Salary Bands page empty | Seed data already existed (6 KR + 4 CN + 4 from seed.ts) | No change needed — 14 records confirmed in DB | `SalaryBand.count() = 14` |
| 5 | CFR Settings page client defaults | No `cfr-config` or `one-on-one-config` in CompanyProcessSetting | Added 2 PERFORMANCE settings to `26-process-settings.ts` | 2 global CFR settings created |
| 6 | EMPLOYEE reaches AI endpoints (500 not 403) | AI routes used `ACTION.VIEW`/`ACTION.CREATE` — EMPLOYEE has these | Changed to `ACTION.APPROVE` (maps to `manage`) on 4 AI routes | EMPLOYEE manage perms = 0 |

## Files Modified

### Seed / Permissions
- `prisma/seed.ts` — Added 4 modules to permissions array (line 116-120)
  - `settings`, `training`, `pulse`, `succession`
  - Comment updated: 13 modules -> 17 modules (102 permission combos)

### CFR Settings
- `prisma/seeds/26-process-settings.ts` — Added 2 new PERFORMANCE settings:
  - `cfr-config`: Recognition visibility, badge types, performance weight
  - `one-on-one-config`: Meeting frequency, agenda template, notes visibility

### AI Route Permission Tightening
- `src/app/api/v1/ai/eval-comment/route.ts` — `ACTION.CREATE` -> `ACTION.APPROVE`
- `src/app/api/v1/ai/payroll-anomaly/route.ts` — `ACTION.VIEW` -> `ACTION.APPROVE`
- `src/app/api/v1/ai/peer-review-summary/route.ts` — `ACTION.VIEW` -> `ACTION.APPROVE`
- `src/app/api/v1/ai/pulse-analysis/route.ts` — `ACTION.VIEW` -> `ACTION.APPROVE`

## Verification Results

```
Fix #1 — HR Admin new module perms: 42 (all 4 modules covered)
Fix #4 — SalaryBands: 14
Fix #5 — CFR settings: 2
Fix #6 — Employee manage perms: 0 (expected: 0)
Total permissions in DB: 120
tsc --noEmit: PASS (0 errors)
Seed: PASS (ran successfully)
```

## Regression Check
- `npx tsc --noEmit`: PASS
- Existing seed data: No deletions, all upsert-safe
- AI routes not affected: `calibration-analysis`, `one-on-one-notes`, `onboarding-checkin-summary`, `executive-report`, `job-description`, `resume-analysis` (these already used `ACTION.APPROVE` or `ACTION.CREATE` on non-EMPLOYEE modules)

## Notes
- Total DB permissions = 120 (not 102) due to pre-existing duplicate entries for `training`, `pulse`, `succession` from earlier seed runs. These duplicates are harmless — permission checks match on `module + action`, and the role-permission mappings reference the correct IDs.
- Salary bands (Fix #4) were already seeded by both `seed.ts` and `seeds/11-compensation.ts`. No additional data needed.
