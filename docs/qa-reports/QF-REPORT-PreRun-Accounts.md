# QF-REPORT: Pre-Run — Test Account Setup
Date: 2026-03-18
Tool: Claude Code Desktop (Opus)

## Account Status
| # | Email | User | Employee | Role | Company | Dept | Manager | Login |
|---|-------|------|----------|------|---------|------|---------|-------|
| 1 | super@ctr.co.kr | ✅ | ✅ | SUPER_ADMIN | CTR-HQ | 경영지원본부 | - | ✅ |
| 2 | hr@ctr.co.kr | ✅ | ✅ | HR_ADMIN | CTR-KR | 인사팀 | - | ✅ |
| 3 | hr@ctr-cn.com | ✅ | ✅ | HR_ADMIN | CTR-CN | 行政部 | - | ✅ |
| 4 | manager@ctr.co.kr | ✅ | ✅ | MANAGER | CTR-KR | QA Team A | - | ✅ |
| 5 | manager2@ctr.co.kr | ✅ | ✅ | MANAGER | CTR-KR | QA Team B | - | ✅ |
| 6 | employee-a@ctr.co.kr | ✅ | ✅ | EMPLOYEE | CTR-KR | QA Team A | manager@ctr.co.kr | ✅ |
| 7 | employee-b@ctr.co.kr | ✅ | ✅ | EMPLOYEE | CTR-KR | QA Team A | manager@ctr.co.kr | ✅ |
| 8 | employee-c@ctr.co.kr | ✅ | ✅ | EMPLOYEE | CTR-KR | QA Team B | manager2@ctr.co.kr | ✅ |

## Quick Login UI
- [x] 8 cards visible on /login (dev only, gated by NEXT_PUBLIC_SHOW_TEST_ACCOUNTS)
- [x] 2×4 grid layout with role/company/team badges
- [x] Card click → auto-login via signIn('credentials', { email })
- [x] Production: cards NOT visible (requires env var = 'true')

## Verification Results

### DB Checks (V1-V4)
- V1: All 8 Employee records exist ✅
- V2: All 8 EmployeeAssignment records with correct companyId ✅
- V3: Manager chain via Position.reportsToPositionId:
  - employee-a → manager@ctr.co.kr ✅
  - employee-b → manager@ctr.co.kr ✅
  - employee-c → manager2@ctr.co.kr ✅
- V4: Departments: EA+EB in QA Team A, EC in QA Team B ✅

### Login Checks (V5-V12)
- V5:  super@ctr.co.kr → HTTP 200, session.role=SUPER_ADMIN ✅
- V6:  hr@ctr.co.kr → HTTP 200, session.role=HR_ADMIN ✅
- V7:  hr@ctr-cn.com → HTTP 200, session.role=HR_ADMIN ✅
- V8:  manager@ctr.co.kr → HTTP 200, session.role=MANAGER ✅
- V9:  manager2@ctr.co.kr → HTTP 200 ✅
- V10: employee-a@ctr.co.kr → HTTP 200, session.role=EMPLOYEE ✅
- V11: employee-b@ctr.co.kr → HTTP 200 ✅
- V12: employee-c@ctr.co.kr → HTTP 200 ✅

### TypeScript Check
- `npx tsc --noEmit` → 0 errors ✅

## Files Created/Modified
- **Created:** `prisma/seeds/00-qa-accounts.ts` — 8 QA account seed (idempotent)
- **Created:** `scripts/verify-qa-accounts.ts` — DB verification script
- **Modified:** `prisma/seed.ts` — added import + call for seedQAAccounts
- **Modified:** `src/app/(auth)/login/LoginPageContent.tsx` — expanded to 8 QA accounts in 2×4 grid

## Issues
None.

## Verdict
**PASS**
