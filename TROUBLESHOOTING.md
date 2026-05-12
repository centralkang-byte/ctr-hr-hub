# Troubleshooting Guide — CTR HR Hub

> **Last Updated:** 2026-05-12 (Session 218 — Sessions 168~217 신규 패턴 추가)
> **Quick Reference:** Search by error message or symptom keyword
> **Related**: `docs/handover/02_운영런북/10_장애_대응.md` (장애 대응 시나리오)

---

## Table of Contents

1. [Build & TypeScript](#1-build--typescript)
2. [Database](#2-database)
3. [Authentication](#3-authentication)
4. [UI & Frontend](#4-ui--frontend)
5. [Performance](#5-performance)
6. [Multi-Tenant](#6-multi-tenant)
7. [i18n (Internationalization)](#7-i18n-internationalization)
8. [Known Issues & Limitations](#8-known-issues--limitations)
9. [Approval & Workflow (Sessions 168~217 신규)](#9-approval--workflow)
10. [Cron & Background Jobs](#10-cron--background-jobs)
11. [Notifications](#11-notifications)
12. [Vercel & Environment (Session 212 패턴)](#12-vercel--environment)

---

## 1. Build & TypeScript

### 1.1 `Module not found: Can't resolve '@prisma/client'`

**Symptom:** Build fails on Vercel with Prisma client not found.

**Cause:** `prisma generate` was not run before the build.

**Fix:**
```bash
# Verify package.json has postinstall script
grep "postinstall" package.json
# Should show: "postinstall": "prisma generate"

# If missing, add it:
# "scripts": { "postinstall": "prisma generate" }
```

This ensures `@prisma/client` is generated during `npm install` on Vercel.

---

### 1.2 `npx tsc --noEmit` shows errors

**Symptom:** TypeScript reports errors that weren't there before.

**Common causes and fixes:**

| Error Pattern | Cause | Fix |
|---------------|-------|-----|
| `Property 'X' does not exist on type 'Y'` | Prisma schema changed but client not regenerated | `npx prisma generate` |
| `Type 'any' is not assignable...` | Missing type annotation after Prisma update | Add proper type or `// eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| `Cannot find module '@/...'` | Path alias issue | Check `tsconfig.json` paths, run `npm install` |
| `'X' is declared but never used` | Unused import after refactoring | Remove the unused import (ESLint warning, not error) |

**Quick validation:**
```bash
npx tsc --noEmit 2>&1 | head -20
```

---

### 1.3 Build hangs indefinitely (no progress for 5+ minutes)

**Symptom:** `npm run build` or `npx prisma db push` freezes with no output.

**Cause:** `DATABASE_URL` is using the Supabase Pooler (port `6543`) instead of Direct Connection (port `5432`). PgBouncer blocks DDL operations.

**Fix:**
```bash
# Check your DATABASE_URL
grep "DATABASE_URL" .env.local

# If it shows port 6543, change to 5432:
# ❌ ...pooler.supabase.com:6543/postgres
# ✅ ...pooler.supabase.com:5432/postgres
```

See [DEPLOYMENT.md Section 2](DEPLOYMENT.md#2-critical-database-configuration) for details.

---

### 1.4 ESLint EPERM error (Node.js v24)

**Symptom:**
```
Error: EPERM: operation not permitted, lstat 'node_modules'
```

**Cause:** Node.js v24.x has a known issue with `lstat` permissions on `node_modules`.

**Workaround:**
```bash
# Option 1: Use Node.js v20 or v22
nvm use 20

# Option 2: Skip ESLint (TypeScript checks are more important)
npx tsc --noEmit  # Use this instead of npm run lint
```

**Status:** This is a Node.js runtime issue, not a project bug. ESLint works on Vercel (uses Node.js 20).

---

## 2. Database

### 2.1 `prisma db push` hangs or times out

See [Section 1.3](#13-build-hangs-indefinitely-no-progress-for-5-minutes) — almost always a Pooler vs Direct Connection issue.

**Additional checks:**
```bash
# Test database connectivity
npx prisma db execute --stdin <<< "SELECT 1"

# If that fails, check:
# 1. DATABASE_URL is correct
# 2. Supabase project is not paused (free tier pauses after 7 days of inactivity)
# 3. IP is not blocked by Supabase network restrictions
```

---

### 2.2 Seed data fails

**Symptom:** `npm run seed:dev` errors out partway through.

**Common causes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Unique constraint failed on 'email'` | Re-running seed without cleanup | Drop all data first: `npx prisma db push --force-reset` then re-seed |
| `Foreign key constraint failed` | Seed order dependency broken | Seeds must run in order (02 → 03 → ... → 26). Check `prisma/seed.ts` |
| `Record not found` | Dependent data missing | Ensure all previous seed scripts ran successfully |
| `Connection refused` | DB not accessible | Check DATABASE_URL, Supabase project status |

**Nuclear reset:**
```bash
# WARNING: This drops ALL data
npx prisma db push --force-reset
npm run seed:dev
```

---

### 2.3 BigInt serialization error

**Symptom:**
```
TypeError: Do not know how to serialize a BigInt
```

**Cause:** PostgreSQL returns `BigInt` for `COUNT(*)` results, but JSON doesn't support BigInt.

**Fix:** Use `Number()` wrapper on count results:
```typescript
// ❌ Broken
const count = await prisma.employee.count(...)
return apiSuccess({ count })

// ✅ Fixed
const count = Number(await prisma.employee.count(...))
return apiSuccess({ count })
```

---

### 2.4 Prisma schema drift

**Symptom:** API returns unexpected data structure or missing fields.

**Cause:** `prisma/schema.prisma` was changed but `prisma generate` or `prisma db push` was not run.

**Fix:**
```bash
# Regenerate client (for code changes)
npx prisma generate

# Push schema to DB (for DB structure changes)
npx prisma db push

# Verify
npx prisma studio
```

---

## 3. Authentication

### 3.1 Login fails (Microsoft SSO)

**Symptom:** Clicking "Sign in with Microsoft" shows an error or redirects back to login.

**Checks:**

| Check | How | Fix |
|-------|-----|-----|
| Env vars set | `echo $AZURE_AD_CLIENT_ID` | Set all 3 Azure AD vars in `.env.local` |
| Redirect URI | Azure Portal → App Registration → Authentication | Add `https://your-domain/api/auth/callback/azure-ad` |
| NEXTAUTH_URL | `.env.local` | Must match your actual domain (include `https://`) |
| NEXTAUTH_SECRET | `.env.local` | Must be set. Generate: `openssl rand -base64 32` |
| User exists | Supabase → Auth → Users | User's email must match an Employee record in DB |

**Debug:**
```bash
# Check NextAuth debug logs
# Add to .env.local:
NEXTAUTH_DEBUG=true
# Then check browser console and server logs
```

---

### 3.2 403 Forbidden on API routes

**Symptom:** API returns 403 even though user is logged in.

**Cause:** The user's role doesn't have permission for the requested action.

**RBAC Roles (highest to lowest):**
1. `SUPER_ADMIN` — cross-company access, all permissions
2. `HR_ADMIN` — all HR operations within their company
3. `EXECUTIVE` — view-only access to company-wide data
4. `MANAGER` — team management, approvals for direct reports
5. `EMPLOYEE` — self-service only

**Debug:**
```bash
# Check user's role in DB
npx prisma studio
# → Open EmployeeRole table
# → Find user by employeeId
# → Check role column
```

**Fix:** Assign the correct role by updating the `EmployeeRole` record.

---

### 3.3 Session expired / "Please log in again"

**Symptom:** User is logged out after some time and must re-authenticate.

**Cause:** NextAuth session token has expired.

**Configuration:**
- Default session max age: 30 days
- JWT token rotation: automatic
- If sessions expire too quickly, check `NEXTAUTH_SECRET` hasn't changed between deployments

---

## 4. UI & Frontend

### 4.1 Sidebar shows raw i18n keys (e.g., `nav.employees`)

**Symptom:** Menu items display translation keys instead of labels.

**Cause:** Locale file is missing the corresponding key, or the locale is not loaded.

**Fix:**
```bash
# Check if key exists
grep "nav.employees" messages/ko.json

# If missing, add the key to all 7 locale files:
# messages/ko.json, en.json, zh.json, ru.json, vi.json, es.json, pt.json
```

---

### 4.2 Page shows stale data after update

**Symptom:** Editing a record shows old data until page is manually refreshed.

**Cause:** SWR/fetch cache not invalidated after mutation.

**Fix (for developers):**
```typescript
// After successful mutation, refresh the data:
router.refresh()
// or, if using SWR:
mutate('/api/v1/employees')
```

**Fix (for users):** Hard refresh the page (`Cmd+Shift+R` on Mac, `Ctrl+Shift+R` on Windows).

---

### 4.3 EmptyState shows even when data exists

**Symptom:** `<EmptyState>` component renders despite data being loaded.

**Cause:** The empty check runs before data finishes loading, or uses incorrect optional chaining.

**Check:** The empty condition MUST use optional chaining to prevent crashes when data is `undefined`:
```typescript
// ✅ Correct — safe when data is undefined
{!data?.length && <EmptyState ... />}

// ❌ Wrong — crashes if data is undefined
{!data.length && <EmptyState ... />}
```

**If data exists but EmptyState shows:** Check if the data variable is the correct one (could be a filtered/derived array that's empty due to active filters).

---

### 4.4 Charts not rendering (blank area)

**Symptom:** Recharts charts show a blank space.

**Common causes:**
- Data array is empty → check API response in Network tab
- Container has zero height → ensure parent element has explicit height
- Browser zoom level → recharts can break at non-standard zoom levels

**Debug:**
```javascript
// In browser console:
// Check if data is reaching the chart
console.log(document.querySelector('.recharts-surface'))
```

---

### 4.5 ConfirmDialog not appearing

**Symptom:** Destructive actions execute without confirmation dialog.

**Cause:** `useConfirmDialog` hook or `<ConfirmDialog>` component not imported.

**Check:**
```typescript
// Component must have:
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// And render ConfirmDialog in JSX:
<ConfirmDialog {...confirmDialog} />
```

---

## 5. Performance

### 5.1 Page loads slowly (> 3 seconds)

**Symptom:** Dashboard or list pages take too long to load.

**Common causes:**

| Cause | Detection | Fix |
|-------|-----------|-----|
| N+1 queries | Multiple sequential `await prisma` in API route | Use `include:` to eager-load relations, or `Promise.all` for independent queries |
| No pagination | `findMany` without `take/skip` on large tables | Add `take: 20, skip: page * 20` |
| Missing index | Slow query in Supabase logs | Add database index on frequently queried columns |
| Large payload | Network tab shows > 1MB response | Add `select:` to limit returned fields |

**Detection tool:**
```bash
# Find API routes with many sequential queries
grep -c "await prisma\." src/app/api/v1/home/summary/route.ts
# If > 5 and no Promise.all, consider parallelizing
```

---

### 5.2 API times out on Vercel (504 Gateway Timeout)

**Symptom:** API returns 504 after ~10 seconds (Hobby plan) or ~60 seconds (Pro plan).

**Cause:** Serverless function execution exceeds time limit.

**Fixes:**
1. Optimize the query (see 5.1 above)
2. Add caching (`withCache` wrapper from `src/lib/cache.ts`)
3. Break into smaller queries with pagination
4. Upgrade to Vercel Pro (60s timeout)

---

### 5.3 Dashboard home page is slow

**Symptom:** Home page takes 3-5 seconds to load.

**Context:** The `home/summary` API route runs multiple count queries. As of Q-4 P5, the HR Admin branch uses `Promise.all` for 4 parallel count queries. Employee and Manager branches are still sequential (they have data dependencies).

**If still slow:** Check Supabase connection latency. Consider adding a Redis cache layer.

---

## 6. Multi-Tenant

### 6.1 User sees data from another company

**Symptom:** An employee in Company A can see records belonging to Company B.

**Severity:** 🔴 CRITICAL — This is a data privacy breach.

**Cause:** An API route is missing the `companyId` filter in its Prisma query.

**Immediate action:**
1. Identify which API route returns the wrong data (check Network tab)
2. Open the route file
3. Verify it uses `resolveCompanyId(user)` and passes `companyId` to the Prisma `where` clause
4. Fix and deploy immediately

**How `resolveCompanyId` works:**
```typescript
// src/lib/api/companyFilter.ts
export function resolveCompanyId(user, requestedCompanyId?) {
  // SUPER_ADMIN: can use any companyId (from query param)
  // Everyone else: forced to their own companyId
  if (user.role === 'SUPER_ADMIN' && requestedCompanyId) {
    return requestedCompanyId
  }
  return user.companyId
}
```

**Prevention:** RLS (Row-Level Security) is designed but not yet implemented. See `docs/RLS_POLICY_DESIGN.md` for the plan. Once implemented, PostgreSQL itself will enforce isolation even if application code has bugs.

---

### 6.2 SUPER_ADMIN can't see other companies' data

**Symptom:** Super admin always sees only their own company's data.

**Cause:** The API route doesn't accept/use the `companyId` query parameter.

**Fix:** Ensure the route passes `req.nextUrl.searchParams.get('companyId')` to `resolveCompanyId()`:
```typescript
const companyId = resolveCompanyId(user, req.nextUrl.searchParams.get('companyId'))
```

---

## 7. i18n (Internationalization)

### 7.1 Translations not loading

**Symptom:** Page shows raw key strings like `common.save` or `leavePage.title`.

**Checks:**
1. Verify locale file exists: `ls messages/en.json`
2. Check key exists in the file: `grep "save" messages/en.json`
3. Component uses correct namespace: `useTranslations('common')` for `common.save`
4. next-intl provider is properly configured in root layout

---

### 7.2 Missing translations in non-Korean locales

**Symptom:** English/Chinese/Russian shows Korean fallback or raw keys.

**Cause:** Translation key exists in `ko.json` but was not added to other locale files.

**Fix:** Add the missing key to all 7 locale files in `messages/`. The key structure must be identical across all files.

---

## 8. Known Issues & Limitations

### Active Known Issues

| Issue | Impact | Workaround | Target Fix |
|-------|--------|------------|------------|
| ESLint EPERM on Node.js v24 | ESLint cannot run locally | Use `npx tsc --noEmit` instead | Wait for Node.js fix |
| 111 `any` type annotations | All annotated with `eslint-disable`, no runtime risk | Type guards where possible | Low priority |
| 577 tab label/option constants in Korean | Non-Korean locales show Korean options | Move inside components + `t()` | Q-5 |
| 29 `h1` page titles in Korean | Some pages show Korean titles regardless of locale | Convert to `t()` or `getTranslations()` | Q-5 |
| 45 domain-specific placeholders in Korean | Form hints like "(예: 시니어 개발자)" in Korean | Add locale translations | Q-5 |
| 58 EmptyState import-only files | EmptyState imported but no JSX (dashboards, settings) | Manual insertion where needed | Q-5 |

### Architecture Limitations

| Limitation | Description | Planned Fix |
|------------|-------------|-------------|
| RLS not implemented | Multi-tenant isolation is application-level only (resolveCompanyId) | RLS design complete, implementation in Q-5 (see `docs/RLS_POLICY_DESIGN.md`) |
| In-process event bus | Domain events execute synchronously, no retry/dead-letter | Acceptable at current scale (< 5K employees) |
| No automated E2E tests | E2E verification is code-review-based | Playwright tests planned |
| Prisma session variables | PostgreSQL session variables not natively supported by Prisma | Prisma Client Extension required for RLS |

### E2E Flow Gaps (from `docs/E2E_VERIFICATION.md`)

| Scenario | Gap | Severity |
|----------|-----|:---:|
| Performance Cycle | No data masking for pre-FINALIZED results in my-result API | 🟡 Medium |
| Offboarding | Duplicate completion files (`offboarding-complete.ts` vs `complete-offboarding.ts`) | 🟢 Low |
| Crossboarding | Missing auto-crossboarding template (departure + arrival onboarding) | 🟡 Medium |

---

## 9. Approval & Workflow

### 9.1 Off-cycle 보상 결재 `PENDING_APPROVAL` stuck (Session 210 PR #19 fix됨)

**Symptom**: HR_ADMIN이 off-cycle 보상 발의 후 매니저 결재(step 1) 완료했는데 status가 `APPROVED`로 finalize 안 되고 `PENDING_APPROVAL` 그대로.

**Cause** (Session 210 분석): `[direct_manager → hr_admin]` flow에서 HR_ADMIN 발의 시 self-skip으로 step 2 자동 APPROVED. 매니저가 step 1 결재 시 `currentStep + 1` (1→2)만 advance하나 step 2 이미 APPROVED라 후속 트리거 없음 → finalize 안 됨.

**Fix** (PR #19): `currentStep >= totalSteps` boolean을 "남은 PENDING step 존재?" 쿼리로 교체. atomic transition (`updateMany` + `status='PENDING'` race protection).

**재발 시**: 다른 모듈(probation, contract_conversion)도 self-skip trailing step audit 필요. PR #19 패턴 적용.

### 9.2 `Role.name` 매칭 silent-fail (Session 207-208 fix됨)

**Symptom**: 결재 routing이 작동 안 함 (HR 챗봇 에스컬레이션 미발송, 매니저 nudge 0건 등). 코드는 에러 없이 0 row 반환.

**Cause**: 코드가 `role: { name: 'HR_ADMIN' }` 매칭. 시드는 display name `'HR Admin'` (공백). 항상 0 row → silent fail.

**Fix**: `Role.code`가 unique SSOT. `code: 'HR_ADMIN'` 매칭 사용. Helper: `src/lib/employee/active-roles.ts` `findActiveRoleHolderId()`.

**재발 방지**: 신규 결재 라우팅 코드 작성 시 항상 `role.code` 사용. `role.name` grep audit 권장.

### 9.3 `EmployeeRole.endDate` 만료된 row 매칭 (Session 209 fix됨)

**Symptom**: 만료된 role row가 결재자에 포함됨 (cross-company role drift).

**Cause**: `employeeRoles.some` 매칭에 `endDate: null` 필터 누락. 만료된 role + 다른 법인 role도 매칭 가능.

**Fix**: `employeeRoles.some({ endDate: null, companyId: <scope> })` 패턴 필수. Session 209에서 7 사이트 fix.

### 9.4 Multi-role employee detail page false-deny (Session 210 PR #18 fix됨)

**Symptom**: HR_ADMIN base + 보조 MANAGER active EmployeeRole 사용자가 채용요청서 detail page에서 결재 버튼이 비활성화됨.

**Cause**: client helper `canApproveRequisition`이 단일 role만 검사.

**Fix** (PR #18): GET `/api/v1/recruitment/requisitions/[id]` 응답에 server-derived `canApprove` 추가. validator(`isRequisitionApproverAllowed`)가 multi-role 인지. List page는 myApprovals matcher SSOT가 처리.

### 9.5 동시 결재 race condition

**Symptom**: 같은 사용자가 결재 버튼 2회 연속 클릭 또는 mixed approve/reject 시 status 일관성 깨짐.

**Cause**: Session 211 audit. `payroll/approve`, `payroll/reject`, `requisition/approve`, `off-cycle reject`, `attendance/approve` 등 6 라우트가 race-vulnerable이었음.

**Fix** (PR #20): `updateMany` + `status='PENDING'` 조건으로 row lock. PostgreSQL READ COMMITTED 격리에서 race-safe. 첫 tx만 count=1, 둘째 count=0.

---

## 10. Cron & Background Jobs

### 10.1 미등록 cron 5건 — silent fail

**Symptom**: 다음 기능이 발생 안 함:
- 연차 사용촉진 통보 발송
- 평가 마감 D-day 알림
- 결재 over-due 알림
- 조직도 일별 스냅샷
- acknowledge 큐 자동 처리

**Cause**: 코드는 `src/app/api/v1/cron/{leave-promotion,eval-reminder,overdue-check,org-snapshot,auto-acknowledge}/route.ts` 존재하나 `vercel.json` crons 배열에 미등록.

**Fix (임시)**: 수동 트리거 — `docs/handover/02_운영런북/11_Cron_수동_트리거.md` 참조. `curl -H "Authorization: Bearer $CRON_SECRET" ...`

**Fix (영구)**: `vercel.json` crons에 추가 + 배포. `leave-promotion`은 한국 §61 시점 정합화(6개월/2개월 전) 함께 검토 — `docs/handover/04_위험_결함_등록부.md` §1.4

### 10.2 cron 실행 확인

```bash
# Vercel logs에서 cron path 호출 추적
vercel logs --follow | grep "/api/v1/cron/"

# 또는 대시보드 UI에서 path filter
```

각 cron은 200 + `{ ok: true, processed: N }` 반환.

---

## 11. Notifications

### 11.1 Teams / SES / Web Push 알림 미발송

**점검 순서**:
1. DB `NotificationLog` 또는 동등 테이블에 row 생성됐는지 — 안 됐으면 코드 진입 부분 문제
2. row 있는데 발송 안 됨 — 외부 채널 (Teams webhook secret 만료? SES sandbox 한도? Firebase 키 만료?)
3. Sentry에 발송 관련 에러 확인
4. AWS SES sending statistics 확인 (CloudWatch alarm 설정 권장)

### 11.2 알림 디버깅 진입점

- 코드: `src/lib/email.ts`, `src/lib/notifications/` 또는 동등
- Teams: `src/lib/notifications/teams.ts` 또는 동등 (`TEAMS_*` envs)
- Web Push: `src/lib/push.ts` 또는 동등 (`VAPID_*` envs)
- Firebase: 사용 중인지 확인 후 (현재 활성 여부 불명확 — handover 작성 시 CEO 확인)

---

## 12. Vercel & Environment

### 12.1 `vercel env rm` 후 preview/development에서도 변수 사라짐 (Session 212 패턴)

**Symptom**: `vercel env rm VAR_NAME` 후 preview/development 환경에서도 해당 변수가 사라져 빌드 실패.

**Cause**: `vercel env rm`에 environment 명시 안 하면 전체 환경에서 제거됨.

**Fix**: 항상 environment 명시 — `vercel env rm VAR_NAME production` (production만), `vercel env rm VAR_NAME preview` (preview만).

### 12.2 Service Worker 새 버전 toast 안 뜸

**Symptom**: 배포 후 사용자에게 "새 버전이 있습니다 / 새로고침" toast 미노출.

**Cause**: `predev`/`prebuild` 시 `scripts/bump-sw-version.mjs` 실행 안 됨.

**Fix**: `package.json` scripts에 hook 등록 확인. 강제: `node scripts/bump-sw-version.mjs && npm run build`.

Session 199 prod 검증됨 — v1 → versioned cache swap + 1-click flow.

### 12.3 Pre-hire 로그인 차단 (Session 209)

**Symptom**: 입사일 전 신규 직원 계정으로 로그인 시도 → 빈 권한 세션이 아니라 로그인 자체 차단.

**Cause/Fix**: Session 209에서 의도된 정책. `loadEmployeePermissions` + `authorize`/`signIn` callbacks 모두 active primary assignment + `effectiveDate <= now` 강제.

**운영 영향**: 입사일 전 시스템 체험이 안 됨. 운영 시 HR에 사전 안내 필요.

---

## 13. Phase 9 잔존 E2E Fail (Cluster D)

[STATUS Phase 9](../../Documents/Obsidian%20Vault/projects/hr-hub/STATUS.md) Session 214 이후 14건 잔존.

| Cluster | 패턴 | 처리 |
|---------|------|------|
| 503 rate limit | AI rate limit 호출 | 테스트 환경 limit 완화 / fixture mock |
| boolean drift | spec 미동기화 | 코드 변경 후 spec 재정렬 |
| 409 sequence | cleanup 누락 | always-cleanup pattern |
| 500 server error | log 분석 필요 | root cause 추적 |
| edge case 2 | evaluation-forms:49, onboarding:24 | spec 케이스 재현 |

**Mystery**: Next.js 15 production build의 server-side console.log 미해결 — escape hatch 우회 (Session 214).
