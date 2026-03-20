# QF-REPORT: S-Fix-5 — System Thresholds → Settings

| Field | Value |
|-------|-------|
| Date | 2026-03-18 |
| Tool | Claude Code Desktop (Opus) |
| Duration | ~15 min |

## Part A: Nudge Rules
| Rule | Before (hardcoded) | After (setting key) | Default Values |
|------|-------------------|--------------------|----------------|
| leave-pending | 3/2/3 | SYSTEM/nudge-rules → leavePending | triggerAfterDays:3, repeatEveryDays:2, maxNudges:3 |
| payroll-review | 1/1/5 | SYSTEM/nudge-rules → payrollReview | triggerAfterDays:1, repeatEveryDays:1, maxNudges:5 |
Files changed: 2 (get-setting.ts, nudge-engine.ts)

**Approach**: Added `getNudgeRulesSettings()` to `get-setting.ts`. Modified `NudgeEngine.run()` to load SYSTEM/nudge-rules and apply threshold overrides per ruleId. Rule files retain static thresholds as documentation/fallback defaults; engine overrides them at runtime.

## Part B: Alert Thresholds
| Threshold | Before | After | Default |
|-----------|--------|-------|---------|
| urgentDays | 1 (hardcoded in calcPriority) | SYSTEM/alert-thresholds → priority.urgentDays | 1 |
| highPriorityDays | 3 (hardcoded in calcPriority) | SYSTEM/alert-thresholds → priority.highPriorityDays | 3 |
| contractExpiry | 30 (line 292) | SYSTEM/alert-thresholds → contractExpiryAlertDays | 30 |
| workPermitExpiry | 60 (line 322) | SYSTEM/alert-thresholds → workPermitExpiryAlertDays | 60 |
Files changed: 2 (get-setting.ts, pending-actions.ts)

**Approach**: Added `getAlertThresholdsSettings()`. Modified `calcPriority()` to accept threshold parameter. Loaded settings at start of `getPendingActions()` and passed to all 6 `calcPriority()` call sites + replaced 30/60 day literals.

## Part C: Analytics Thresholds
| Metric | Before | After | Default |
|--------|--------|-------|---------|
| turnoverRisk | >=75 critical, >=55 high, >=35 medium | SYSTEM/analytics-thresholds → turnoverRisk | criticalScore:75, highScore:55, mediumScore:35 |
| teamHealth | >=70 critical, >=50 high, >=30 medium | SYSTEM/analytics-thresholds → teamHealth | criticalScore:70, highScore:50, mediumScore:30 |
Files changed: 3 (get-setting.ts, turnoverRisk.ts, teamHealth.ts)

**Approach**: Added `getAnalyticsThresholdsSettings()`. Both `calculateTurnoverRisk()` and `calculateTeamHealth()` already have `companyId` parameter and are async, so added settings load before risk level classification.

## Seed Data
| # | settingKey | Scope | Values |
|---|-----------|-------|--------|
| 1 | nudge-rules | Global | {leavePending:{3,2,3}, payrollReview:{1,1,5}} |
| 2 | alert-thresholds | Global | {priority:{1,3}, contractExpiry:30, workPermit:60} |
| 3 | analytics-thresholds | Global | {turnoverRisk:{75,55,35}, teamHealth:{70,50,30}} |

Seed file: `prisma/seeds/26-process-settings.ts` (3 entries appended)
Seed execution: N/A (placeholder DATABASE_URL — will run on next full seed against hosted DB)
DB verification: N/A (same reason)

## Verification
| # | Test | Expected | Actual |
|---|------|----------|--------|
| 1 | tsc --noEmit | PASS | PASS (0 errors) |
| 2 | Seed script syntax | Valid TS | PASS |
| 3 | No regression in API types | Backward compatible | PASS (calcPriority has default param) |

## Summary
- New FromSettings functions: 3 (`getNudgeRulesSettings`, `getAlertThresholdsSettings`, `getAnalyticsThresholdsSettings`)
- New type interfaces: 4 (`NudgeRuleConfig`, `NudgeRulesSettings`, `AlertThresholdsSettings`, `AnalyticsThresholdsSettings`)
- Hardcoded values converted: 10 (2 nudge rules × 3 thresholds + 4 alert thresholds + 2 analytics × 3 boundaries → overlapping via object destructuring)
- Seed records: 3 (global defaults, companies can override)
- Files changed: 5 (get-setting.ts, nudge-engine.ts, pending-actions.ts, turnoverRisk.ts, teamHealth.ts) + 1 seed file
- tsc: PASS

## Verdict
**PASS**
