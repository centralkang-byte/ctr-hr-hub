# Grade System Transition Plan — Prisma Seeds Completion

## Overview
Complete the G1~G6 / G-CHAIR / G-EXEC / G-DIR / G-SM / G-MGR / G-SR / G-ENG / G-ML / G-EL to E1/S1/L2/L1 conversion across ~9 remaining seed files (~429 references).

## Confirmed Mapping (Session 45)
| Old Code(s) | New Code | Korean Name | English Name | rankOrder |
|---|---|---|---|---|
| G1, G-CHAIR, G-EXEC, G-EL | E1 | 경영리더 | Executive Leader | 1 |
| G2 | S1 | 전문리더 | Specialist Leader | 2 |
| G3, G4, G5, G-DIR, G-SM, G-MGR, G-SR, G-ML | L2 | 책임매니저 | Senior Manager | 3 |
| G6, G-ENG | L1 | 매니저 | Manager | 4 |

**Special note for seed.ts positions**: The old 6-tier system (G1~G6) collapses into 4 tiers. Position titles like 대리 (G5), 과장 (G4), 차장 (G3) all become L2. The 부장 (G2) becomes S1. 임원 (G1) becomes E1. 사원 (G6) becomes L1.

## Answers to Design Questions

### Q1: One commit or split into 2-3?
**Answer: 3 commits**, grouped by logical concern:
1. **Commit 1** — Core employee data files (39-employees.ts, 02-employees.ts, 41-concurrent-assignments.ts) — the bulk of named/generated employee records
2. **Commit 2** — seed.ts + seed-dev.ts — the main orchestrator files with jobGradeData, salaryBandData, positions, QA accounts
3. **Commit 3** — Pipeline + year-end cleanup (06-payroll.ts, 17-payroll-pipeline.ts, 18-performance-pipeline.ts, 13-year-end.ts, 07-lifecycle.ts) + delete seed.ts.bak

### Q2: Remove old fallback codes?
**Answer: Yes.** Since 37-job-grades.ts only creates E1/S1/L2/L1, any lookup for G1~G6 will return null. The fallback code creates a false sense of safety while the data is already broken. Remove the old G1~G6 entries from GRADE_BASE, POSITION_ALLOWANCE, GRADE_ANNUAL, and krMappings. Replace with new codes only.

### Q3: seed.ts.bak — delete or leave?
**Answer: Delete.** It is a 1130-line backup from February 27 with stale G1~G6 codes. It serves no purpose and confuses grep searches. Delete in Commit 3.

### Q4: 02-employees.ts G4/G5/G6 mapping?
**Answer: Confirmed correct.** G4 and G5 both map to L2 (책임매니저). G6 maps to L1 (매니저). This file has 70 CTR-KR employees plus ~10 CTR-CN employees using G3~G6.

### Q5: 39-employees.ts executive mapping?
**Answer: Confirmed correct.**
- G-CHAIR → E1 (회장/부회장 level)
- G-ML (Middle Leader = 본부장/CEO/COO/Director level) → L2
- G-EL (Executive Leader = 팀장 level) → E1 (**WAIT — this needs clarification**)

**CRITICAL CORRECTION**: Re-examining the data, G-EL is used for ALL team leaders (팀장). Team leaders are NOT executive-level. Looking at the actual mapping decision:
- G-EL was described as "Executive Leader" in the old system but is actually used for 팀장 (team lead) positions
- G-ML is used for 본부장/CEO/Division Director positions

Per Session 45 confirmed mapping: **G-EL → E1** and **G-ML → L2**. However, this seems semantically inverted for the actual org chart data. The user's requirement doc explicitly states G-EL → E1, so we follow that mapping as given.

## Commit 1: Employee Data Files

### File: prisma/seeds/39-employees.ts (~172 refs)

**Named employees (NAMED array, lines 49-289):**
All domestic Korean companies use G-CHAIR, G-ML, G-EL, G-SM, G-ENG. Apply:
- `'G-CHAIR'` → `'E1'` (1 occurrence — 강상우)
- `'G-ML'` → `'L2'` (all 본부장/CEO/Director/Head positions)
- `'G-EL'` → `'E1'` (all 팀장 positions)
- `'G-SM'` → `'L2'` (all senior manager/plant TL positions)

Overseas companies use company-prefixed codes (G-CN-DIR, G-CN-MGR, G-CN-SR, G-US-DIR, etc.) — these are NOT part of the Korean 4-tier system and should be LEFT AS-IS. They represent overseas grade systems that are TBD per-entity (confirmed in 37-job-grades.ts line 88).

**Auto-generated employees (lines 556-561):**
- `'G-MGR'` → `'L2'` (office full-time, domestic)
- `'G-ENG'` → `'L1'` (production full-time + dispatch, domestic)
- `'G-SM'` → `'L2'` (contract, domestic)

### File: prisma/seeds/02-employees.ts (~71 refs)

All 70 CTR-KR employees use G3~G6 codes. The type annotation on line 107 says `grade: string // 'G3'~'G6'`. Apply:
- `'G4'` → `'L2'` (과장 level)
- `'G5'` → `'L2'` (대리 level)
- `'G6'` → `'L1'` (사원 level)

Update the type comment to `// 'L2' | 'L1'`

The 18 CTR-CN employees on lines 440-460+ also use G3~G6 — BUT these are Chinese entity employees. The question is whether CTR-CN has its own grade system. Looking at 39-employees.ts, CTR-CN uses G-CN-DIR/G-CN-MGR/G-CN-SR (overseas prefixed). In 02-employees.ts and seed-dev.ts, these Chinese employees incorrectly use the generic G3~G6 codes. Since 37-job-grades.ts does NOT create G3~G6 for any company, these will fail lookup. **Convert CTR-CN employees the same way**: G3→L2, G4→L2, G5→L2, G6→L1. Or better: leave a comment noting these should eventually use the CTR-CN grade system.

### File: prisma/seeds/41-concurrent-assignments.ts (6 refs)

Lines 31-36 have 6 concurrent assignment records using G-ML and G-EL:
- `'G-ML'` → `'L2'`
- `'G-EL'` → `'E1'`

## Commit 2: Orchestrator Files

### File: prisma/seed.ts (~91 refs)

**Section 9 — jobGradeData (lines 222-229):**
Replace 6-tier G1~G6 with 4-tier:
```
{ code: 'E1', name: '경영리더', rankOrder: 1 },
{ code: 'S1', name: '전문리더', rankOrder: 2 },
{ code: 'L2', name: '책임매니저', rankOrder: 3 },
{ code: 'L1', name: '매니저', rankOrder: 4 },
```

**Section 12 — salaryBandData (lines 260-267):**
Replace 6 bands with 4:
```
{ gradeCode: 'E1', min: 120_000_000, mid: 160_000_000, max: 200_000_000 },
{ gradeCode: 'S1', min: 80_000_000, mid: 120_000_000, max: 160_000_000 },
{ gradeCode: 'L2', min: 40_000_000, mid: 75_000_000, max: 130_000_000 },
{ gradeCode: 'L1', min: 32_000_000, mid: 38_500_000, max: 45_000_000 },
```

**Section — empConfig / QA accounts (lines 759-763):**
- `admin@ctr.co.kr`: `'G1'` → `'E1'`
- `hr@ctr.co.kr`: `'G4'` → `'L2'`
- `manager@ctr.co.kr`: `'G3'` → `'L2'`
- `employee@ctr.co.kr`: `'G6'` → `'L1'`

**Section — krPositions (lines 1442-1530+):**
All ~60 position records use G1~G6. Apply mapping:
- G1 → E1
- G2 → S1
- G3 → L2
- G4 → L2
- G5 → L2
- G6 → L1

### File: prisma/seed-dev.ts (~60 refs)

This is a near-duplicate of seed.ts for development. Has same pattern of employee records with G1~G6 grades on lines 279-451+. Apply identical G→new mapping. Also has jobGradeData, salaryBandData, positions sections — same transformations as seed.ts.

## Commit 3: Pipeline + Year-End + Cleanup

### File: prisma/seeds/06-payroll.ts (fallback removal)

Lines 32-45: Remove old G1~G6 entries from GRADE_BASE and POSITION_ALLOWANCE. Keep only E1/S1/L2/L1 entries. The fallback comment on line 31 should also be removed.

### File: prisma/seeds/17-payroll-pipeline.ts (fallback removal)

Lines 33-35: Remove old G1~G6 entries from the GRADE_BASE equivalent. Lines 214/217/347: Update the grade assignment logic from G1~G6 to E1/S1/L2/L1.

Specifically:
- Line 214: `idx <= 1 ? 'G1' : idx <= 3 ? 'G2' : idx <= 6 ? 'G3' : 'G4'` → `idx <= 1 ? 'E1' : idx <= 3 ? 'S1' : 'L2'`
- Line 217: `idx <= 10 ? 'G4' : idx <= 30 ? 'G5' : 'G6'` → `idx <= 30 ? 'L2' : 'L1'`
- Line 347: `'G5'` fallback → `'L2'` fallback

### File: prisma/seeds/18-performance-pipeline.ts (6 refs)

Lines 40-47 — krMappings: Replace old G1~G6 level mapping with new 4-tier:
```
{ code: 'L1', level: 'L1', mbo: null, bei: null },
{ code: 'L2', level: 'L2', mbo: null, bei: null },
{ code: 'S1', level: 'L5', mbo: null, bei: null },
{ code: 'E1', level: 'EXEC', mbo: 70, bei: 30 },
```
Note: The "level" field (L1~L5, EXEC) is the performance evaluation level — distinct from the grade code. Need to decide how 4 grades map to the evaluation levels. Suggest: L1→L1, L2→L3, S1→L5, E1→EXEC.

### File: prisma/seeds/13-year-end.ts (3 refs)

Lines 41-43 — GRADE_ANNUAL: Replace G1~G6 with new codes:
```
E1: 159_600_000, S1: 105_000_000, L2: 75_000_000, L1: 38_520_000,
```
Line 98 — fallback: `'G6'` → `'L1'`

### File: prisma/seeds/07-lifecycle.ts (1 ref)

Line 98: `code: 'G5'` → `code: 'L2'` (departed employee grade lookup)

### File: prisma/seed.ts.bak

Delete this file entirely. It is a 1130-line stale backup.

## Execution Order

1. **Pre-flight**: Run `npx tsc --noEmit` to confirm current build is clean
2. **Commit 1**: Edit 39-employees.ts, 02-employees.ts, 41-concurrent-assignments.ts → `npx tsc --noEmit` → commit
3. **Commit 2**: Edit seed.ts, seed-dev.ts → `npx tsc --noEmit` → commit
4. **Commit 3**: Edit 06-payroll.ts, 17-payroll-pipeline.ts, 18-performance-pipeline.ts, 13-year-end.ts, 07-lifecycle.ts, delete seed.ts.bak → `npx tsc --noEmit` → commit
5. **Post-flight**: `npx tsx prisma/seed.ts` to re-seed DB, verify no FK errors

## Commit Messages

```
refactor(seeds): 직원 시드 Grade 전환 — G-ML/G-EL/G-SM/G-ENG → E1/S1/L2/L1

refactor(seeds): seed.ts/seed-dev.ts Grade 전환 — jobGradeData/salaryBand/positions/QA계정

refactor(seeds): Pipeline/Year-End Grade 전환 완료 + 옛코드 fallback 제거 + seed.ts.bak 삭제
```

## Risk Assessment

- **LOW RISK**: 39-employees.ts, 02-employees.ts — simple string replacements in data arrays
- **LOW RISK**: seed.ts, seed-dev.ts — straightforward data array changes
- **MEDIUM RISK**: 06-payroll.ts, 17-payroll-pipeline.ts — removing fallback changes runtime behavior; if any employee still has old grade code in DB, payroll lookup will return `undefined`. Mitigated by re-seeding.
- **MEDIUM RISK**: 18-performance-pipeline.ts — the performance level mapping (L1~L5, EXEC) is a separate concept from grade codes. Need to decide correct mapping.
- **LOW RISK**: 13-year-end.ts, 07-lifecycle.ts — minimal changes

## Overseas Grade Codes (NOT in scope)

These company-prefixed codes in 39-employees.ts are NOT part of this conversion:
- G-CN-DIR, G-CN-MGR, G-CN-SR (CTR-CN)
- G-US-DIR, G-US-MGR, G-US-SR (CTR-US)
- G-VN-DIR, G-VN-MGR (CTR-VN)
- G-RU-DIR, G-RU-MGR (CTR-RU)
- G-EU-DIR (CTR-EU)

These will be defined when overseas entity grade systems are finalized.
