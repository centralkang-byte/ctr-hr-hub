# Troubleshooting Guide — CTR HR Hub

> **Last Updated:** 2026-03-12 (Q-4 P7)
> **Quick Reference:** Search by error message or symptom keyword

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
