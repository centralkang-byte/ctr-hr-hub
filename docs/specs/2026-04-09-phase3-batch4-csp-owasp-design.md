# Phase 3 Batch 4: CSP Hardening + OWASP Audit + P1 Fixes

> **Date**: 2026-04-09
> **Author**: Claude (brainstorming with Sangwoo)
> **Branch**: `staging`
> **Scope**: Security hardening — CSP nonce, OWASP Top 10 checklist, P1 residual issues

---

## Context

Phase 3 (Security Audit) Batches 1-3 addressed RBAC SSOT, route-level auth standardization, and P0 authz fixes across 599 API routes. Batch 4 completes Phase 3 by hardening the Content Security Policy, running a formal OWASP Top 10 audit, and resolving P1 issues deferred from earlier batches.

**Current CSP** (`src/middleware.ts:24-34`):
- `script-src 'self' 'unsafe-eval' 'unsafe-inline'` — allows arbitrary code execution
- `style-src 'self' 'unsafe-inline'` — allows style injection
- `connect-src 'self' https:` — overly broad, any HTTPS domain

**Why now**: CSP with `unsafe-eval` provides negligible XSS protection. With zero unsafe innerHTML usage, zero styled-jsx, and zero `<Script>` components, the codebase is ready for strict nonce-based CSP.

---

## 1. CSP Nonce Implementation

### 1.1 Architecture

```
Request flow:
  middleware(request)
    -> nonce = crypto.randomUUID()        // per-request
    -> buildCspHeader(nonce, isProd)       // env-aware CSP string
    -> response.headers.set('x-nonce', nonce)
    -> response.headers.set('Content-Security-Policy', csp)
  
  layout.tsx (Server Component)
    -> nonce = headers().get('x-nonce')
    -> pass to html / metadata as needed
```

### 1.2 CSP Policies by Environment

**Production:**
```
default-src 'self';
script-src 'nonce-{n}' 'strict-dynamic';
style-src 'nonce-{n}' https://cdn.jsdelivr.net;
img-src 'self' data: blob: https:;
font-src 'self' data: https://cdn.jsdelivr.net;
connect-src 'self' https://*.sentry.io https://*.supabase.co https://*.amazonaws.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
report-uri https://o{ORG_ID}.ingest.sentry.io/api/{PROJECT_ID}/security/
```

**Development:**
```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
img-src 'self' data: blob: https:;
font-src 'self' data: https://cdn.jsdelivr.net;
connect-src 'self' https: ws: wss:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

Dev retains `unsafe-eval`/`unsafe-inline` for HMR + hot reload. `ws:`/`wss:` added for webpack dev server WebSocket.

### 1.3 Key Changes

| Directive | Before | After (Prod) | Reason |
|-----------|--------|--------------|--------|
| `script-src` | `'self' 'unsafe-eval' 'unsafe-inline'` | `'nonce-{n}' 'strict-dynamic'` | Blocks XSS injection |
| `style-src` | `'self' 'unsafe-inline'` | `'nonce-{n}' cdn.jsdelivr.net` | Blocks style injection |
| `connect-src` | `'self' https:` | `'self' *.sentry.io *.supabase.co` | Principle of least privilege |
| `X-XSS-Protection` | `1; mode=block` | **Removed** | Legacy, superseded by CSP |
| `upgrade-insecure-requests` | absent | added | Force HTTPS subresources |
| `report-uri` | absent | Sentry endpoint | Violation monitoring |

### 1.4 Files to Modify

| File | Change |
|------|--------|
| `src/middleware.ts` | Add `buildCspHeader(nonce, isProd)`, modify `applySecurityHeaders()` to accept nonce, generate nonce in `middleware()` |
| `src/app/layout.tsx` | Read `x-nonce` from `headers()`, pass to metadata/scripts if needed |
| `next.config.mjs` | Remove redundant CSP from fallback headers (middleware is authoritative) |

### 1.5 Sentry CSP Reporting

- Use Sentry's built-in CSP reporting endpoint (no additional infra)
- `report-uri` directive points to Sentry project's `/security/` endpoint
- Violations appear in Sentry dashboard under "Security" tab
- Env var: `SENTRY_CSP_REPORT_URI` (already have SENTRY_ORG/PROJECT in env)

---

## 2. OWASP Top 10 Audit

Formal verification of all 10 categories with evidence. Most are already secure; this section documents the audit trail.

| # | Category | Verdict | Evidence |
|---|----------|---------|----------|
| A01 | Broken Access Control | PASS | Batch 1-3: RBAC SSOT, 599 routes auth-standardized, P0 IDOR fixes |
| A02 | Cryptographic Failures | PASS | `env.ts` centralized secrets, HSTS enforced, httpOnly cookies |
| A03 | Injection | PASS | Prisma ORM only, zero raw SQL, zero string interpolation in queries |
| A04 | Insecure Design | PASS | Rate limiting, payload size limits, file validation with magic bytes |
| A05 | Security Misconfiguration | FIX | CSP unsafe-eval/unsafe-inline to nonce-based (this batch) |
| A06 | Vulnerable Components | AUDIT | Run `npm audit`, resolve findings |
| A07 | Auth Failures | PASS | Login rate limit (10/min), JWT 8h expiry, unified error messages |
| A08 | Data Integrity Failures | PASS | Zod validation on all inputs, CSRF via SameSite cookies |
| A09 | Logging Failures | FIX | Audit trail gaps in employee reads, delegation (P1 fixes below) |
| A10 | SSRF | PASS | Zero user-controlled URL fetching, S3 presigned URLs server-generated |

**Deliverable**: `docs/qa-reports/QF-REPORT-OWASP-Top10.md` with per-category evidence and file references.

### 2.1 npm audit

- Run `npm audit` and `npm audit fix`
- Document findings in OWASP report
- Any unfixable CVEs: document with risk assessment and mitigation plan

---

## 3. P1 Residual Issue Fixes

### P1-1: AI Endpoint Rate Limiting

**Problem**: AI endpoints (`/api/v1/*/ai*`) have no rate limit. Anthropic API abuse risk.
**Fix**: Add per-user rate limit in middleware (10 requests/minute, keyed by user token sub).

```
Pattern: pathname matches /api/v1/ + contains /ai
Limit: 10 req/min per authenticated user (token.sub)
Response: 429 + Retry-After: 60
```

**File**: `src/middleware.ts` — new `checkAiRateLimit()` function alongside existing `checkLoginRateLimit()`.

### P1-2: Employee Detail Read Audit Logging

**Problem**: `GET /api/v1/employees/[id]` does not log PII access.
**Fix**: Add audit log entry on successful employee detail retrieval.

**File**: `src/app/api/v1/employees/[id]/route.ts` — add `createAuditLog()` call in GET handler.

### P1-3: Delegation Audit Log Gap

**Problem**: Delegation create/update publishes domain events but doesn't write to `audit_logs` table.
**Fix**: Add `createAuditLog()` in delegation POST/PATCH handlers.

**File**: `src/app/api/v1/delegation/route.ts` — add audit log entries.

---

## 4. Verification Plan

### 4.1 Automated

- `npx tsc --noEmit` — type check
- `npm run lint` — ESLint
- `npm audit` — dependency vulnerabilities
- Existing E2E tests (150) — regression check
- New test: `e2e/api/csp-security.spec.ts` — verify CSP headers in response, nonce presence, no unsafe-* in prod

### 4.2 Manual / Staging

- Deploy to staging (Vercel preview)
- Open browser DevTools Console: verify zero CSP violations
- Check Network tab: verify CSP header contains nonce, no unsafe-eval
- Verify Sentry CSP report-uri receives test violation (if any)
- Test all major pages: dashboard, employees, payroll, settings, my-space

### 4.3 Regression Risks

| Risk | Mitigation |
|------|------------|
| Sentry SDK needs eval | Sentry v9+ supports nonce natively; strict-dynamic propagates trust |
| Next.js inline scripts | Next.js 15 injects nonce automatically when detected in headers |
| cdn.jsdelivr.net blocked | Explicitly allowed in style-src and font-src |
| WebSocket in dev blocked | Dev CSP includes ws: / wss: |

---

## 5. Out of Scope

- Data Integrity Audit (205 models) — Phase 6
- RBAC YAML spec conversion — deferred (TS spec sufficient for current needs)
- `connect-src` domain audit for all external APIs — future hardening

---

## Summary of Deliverables

| # | Deliverable | Type |
|---|-------------|------|
| 1 | Nonce-based CSP (middleware + layout) | Code |
| 2 | Dev/Prod CSP split | Code |
| 3 | Sentry CSP report-uri | Config |
| 4 | AI endpoint rate limiting | Code |
| 5 | Employee read audit logging | Code |
| 6 | Delegation audit logging | Code |
| 7 | npm audit + fix | Maintenance |
| 8 | OWASP Top 10 report | Document |
| 9 | CSP security E2E test | Test |
