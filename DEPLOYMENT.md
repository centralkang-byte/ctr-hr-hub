# Deployment Guide — CTR HR Hub

> **Last Updated:** 2026-03-12 (Q-4 P7)
> **Platform:** Vercel (Frontend + API) + Supabase (PostgreSQL)

---

## 1. Vercel Setup

### 1.1 Initial Deployment

1. **Connect Repository**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import the `centralkang-byte/ctr-hr-hub` repository from GitHub
   - Framework Preset: **Next.js** (auto-detected)

2. **Build Settings** (auto-configured via `vercel.json`)
   ```json
   {
     "framework": "nextjs",
     "buildCommand": "npm run build",
     "installCommand": "npm install",
     "outputDirectory": ".next"
   }
   ```

3. **Environment Variables** — Add ALL required variables in Vercel Dashboard → Settings → Environment Variables:

   | Variable | Required | Notes |
   |----------|:---:|-------|
   | `DATABASE_URL` | ✅ | **CRITICAL:** Must use Direct Connection (port `5432`). Pooler (port `6543`) blocks DDL and causes build hangs. See Section 2 below. |
   | `DIRECT_URL` | ✅ | Same as DATABASE_URL for Supabase |
   | `NEXTAUTH_URL` | ✅ | Your Vercel production URL (e.g., `https://ctr-hr-hub.vercel.app`) |
   | `NEXTAUTH_SECRET` | ✅ | Generate: `openssl rand -base64 32` |
   | `AZURE_AD_CLIENT_ID` | ✅ | Microsoft Entra ID app registration |
   | `AZURE_AD_CLIENT_SECRET` | ✅ | Entra ID client secret |
   | `AZURE_AD_TENANT_ID` | ✅ | Entra ID tenant ID |
   | `CRON_SECRET` | ✅ | Used by cron jobs for authentication |
   | `ANTHROPIC_API_KEY` | ⬜ | For AI reports (optional) |
   | `OPENAI_API_KEY` | ⬜ | For document embedding (optional) |
   | `REDIS_URL` | ⬜ | For caching (optional, falls back to in-memory) |

4. **Deploy**
   ```bash
   npx vercel --prod --yes
   ```

### 1.2 Auto-Deploy

After initial setup, every `git push origin main` triggers an automatic Vercel deployment.

```bash
git add -A
git commit -m "your message"
git push origin main
# → Vercel auto-deploys in ~2 minutes
```

---

## 2. Critical Database Configuration

### Direct Connection vs Pooler — THIS IS THE #1 DEPLOYMENT ISSUE

Supabase provides two connection strings:

| Type | Port | Use For | Prisma Compatible |
|------|:---:|---------|:---:|
| **Direct Connection** | `5432` | Schema changes, migrations, `prisma db push` | ✅ |
| **Pooler (PgBouncer)** | `6543` | Runtime queries at scale | ⚠️ Partial |

**The Problem:** If `DATABASE_URL` uses the Pooler (port `6543`), these operations will **hang indefinitely** or fail:
- `npx prisma db push` — DDL operations blocked
- `npx prisma migrate deploy` — migration execution blocked
- `npm run build` (if Prisma generates schema on build) — build times out

**The Fix:** Always use Direct Connection (port `5432`) for `DATABASE_URL`:

```env
# ✅ CORRECT — Direct Connection
DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

# ❌ WRONG — Pooler (will hang on db push)
DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
```

**Where to find it:**
1. Supabase Dashboard → Project Settings → Database
2. Copy the "Direct Connection" string (port 5432)
3. URL-encode the password if it contains special characters

### Prisma Schema Configuration

The `prisma/schema.prisma` file has a `postinstall` hook in `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

This ensures `@prisma/client` is generated during Vercel's `npm install` step, preventing the "Module not found: Can't resolve '@prisma/client'" error.

---

## 3. Database Migration

**Always run migrations SEPARATELY from deployment** — never during the Vercel build.

### Schema Push (Development)

```bash
# Push schema changes to Supabase
npx prisma db push

# Verify
npx prisma studio
```

### Seed Data

```bash
# Run all 26 seed scripts
npm run seed:dev

# This executes prisma/seed.ts which runs:
# 02-employees → 03-attendance → ... → 26-process-settings
```

### Migration Best Practice

1. Make schema changes in `prisma/schema.prisma`
2. Run `npx prisma db push` locally (against Supabase Direct Connection)
3. Verify in Prisma Studio
4. Commit and push code changes
5. Vercel auto-deploys (build runs `prisma generate` via postinstall, NOT `db push`)

---

## 4. Post-Deploy Verification Checklist

After each deployment, verify these items:

| Check | How | Expected |
|-------|-----|----------|
| Login page loads | Visit `https://your-domain.vercel.app/login` | Microsoft SSO button visible |
| Login succeeds | Click SSO → authenticate | Redirect to dashboard |
| Sidebar renders | Check left sidebar | All menu items with correct Korean/English labels |
| Dashboard data | Visit home page | Stats cards show seeded data |
| API health | `curl /api/v1/health` (if exists) or check browser Network tab | 200 OK responses |
| i18n works | Switch locale in settings | UI text changes language |
| No console errors | Open browser DevTools → Console | No runtime errors |

### Stale Cache Fix

If you see stale data or old UI after deployment:

1. **Browser:** Clear site data (DevTools → Application → Clear site data)
2. **Vercel:** Redeploy from dashboard (Deployments → ... → Redeploy)
3. **Force revalidation:** Add `?_v=timestamp` to URL for one-time cache bust
4. **Nuclear option:** In Vercel Dashboard → Settings → Functions → Purge Edge Cache

---

## 5. Cron Jobs

CTR HR Hub uses 6 scheduled cron jobs. These must be configured in Vercel Cron or an external scheduler.

| Job | Endpoint | Schedule | Purpose |
|-----|----------|----------|---------|
| Leave Promotion | `GET /api/v1/cron/leave-promotion` | Daily 01:00 KST | Promote probation employees' leave balance after tenure threshold |
| Auto-Acknowledge | `GET /api/v1/cron/auto-acknowledge` | Daily 02:00 KST | Auto-acknowledge performance results after 7-day grace period |
| Org Snapshot | `GET /api/v1/cron/org-snapshot` | Monthly 1st 03:00 KST | Capture organization structure snapshot for historical comparison |
| Overdue Check | `GET /api/v1/cron/overdue-check` | Daily 06:00 KST | Check for overdue onboarding/offboarding tasks, trigger nudges |
| Eval Reminder | `GET /api/v1/cron/eval-reminder` | Daily 09:00 KST | Send reminders for pending performance evaluations |
| Data Retention | `GET /api/v1/compliance/cron/retention` | Weekly Sun 04:00 KST | Execute GDPR data retention policies, purge expired records |

### Cron Authentication

All cron endpoints require `CRON_SECRET` authentication:

```bash
# Manual trigger
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/v1/cron/overdue-check
```

### Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/v1/cron/leave-promotion", "schedule": "0 16 * * *" },
    { "path": "/api/v1/cron/auto-acknowledge", "schedule": "0 17 * * *" },
    { "path": "/api/v1/cron/org-snapshot", "schedule": "0 18 1 * *" },
    { "path": "/api/v1/cron/overdue-check", "schedule": "0 21 * * *" },
    { "path": "/api/v1/cron/eval-reminder", "schedule": "0 0 * * *" },
    { "path": "/api/v1/compliance/cron/retention", "schedule": "0 19 * * 0" }
  ]
}
```

> Note: Vercel Cron uses UTC. KST = UTC+9, so `01:00 KST` = `16:00 UTC` previous day.

---

## 6. Monitoring

### Vercel Dashboard
- **Deployments tab:** Build status, deploy logs, error tracking
- **Analytics tab:** Page views, Web Vitals (LCP, FID, CLS)
- **Functions tab:** Serverless function execution logs, cold starts, timeouts
- **Logs tab:** Real-time function logs (filter by route)

### Supabase Dashboard
- **Table Editor:** Browse data, verify seed content
- **SQL Editor:** Run custom queries, verify RLS policies
- **Logs → Postgres:** Database query logs, slow query detection
- **Auth → Users:** User accounts, session management
- **Database → Replication:** Point-in-Time Recovery (PITR) status

### Key Metrics to Monitor

| Metric | Concern Threshold | Action |
|--------|:---:|--------|
| API response time | > 5s | Check N+1 queries, add pagination |
| Database connections | > 80% pool | Switch to Pooler for runtime, keep Direct for migrations |
| Build time | > 5 min | Check if `prisma db push` accidentally in build |
| Error rate | > 1% | Check Vercel Functions logs |
| Serverless invocations | > 100K/month (free tier) | Upgrade Vercel plan |

---

## 7. Rollback Procedures

### Vercel Rollback

1. Go to Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click `...` → **Promote to Production**
4. Traffic immediately shifts to the previous version

### Database Rollback (Supabase PITR)

Supabase Pro plans include Point-in-Time Recovery:

1. Go to Supabase Dashboard → Database → Backups
2. Select a recovery point before the issue
3. Restore to a new project or in-place (destructive)

> ⚠️ **Caution:** Database rollback does NOT roll back the application code. Always coordinate Vercel + Supabase rollbacks together.

### Emergency Procedure

If production is broken and users are affected:

1. **Immediate:** Vercel rollback to last good deployment (< 30 seconds)
2. **If DB issue:** Check Supabase dashboard for connection errors
3. **If schema mismatch:** Run `npx prisma db push` against Direct Connection
4. **Notify:** Update team on status

---

## 8. Environment-Specific Notes

### Development (Local)
- Port: `3002` (configured in `package.json` dev script)
- Database: Can use local PostgreSQL or Supabase cloud
- Auth: Microsoft login redirects to `http://localhost:3002/api/auth/callback/azure-ad`

### Staging (Vercel Preview)
- Every PR creates a preview deployment with a unique URL
- Preview deployments use the same env vars as production (unless overridden)
- Use Vercel Preview URLs for QA before merging to main

### Production (Vercel)
- Auto-deploys on `git push origin main`
- `export const dynamic = 'force-dynamic'` in `(dashboard)/layout.tsx` — all dashboard pages are dynamically rendered (no static caching)
- Serverless function timeout: 10s (Vercel Hobby), 60s (Vercel Pro)

---

## 9. Deployment Checklist

Before any production deployment:

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run build` — passes locally
- [ ] Database schema up-to-date (`npx prisma db push`)
- [ ] Seed data consistent (if schema changed, re-seed)
- [ ] Environment variables set in Vercel
- [ ] Microsoft Entra ID redirect URI includes production URL
- [ ] CRON_SECRET set for cron job authentication
- [ ] Test login flow on preview deployment
- [ ] Check sidebar renders all menu items
- [ ] Verify Korean and English locale display correctly
