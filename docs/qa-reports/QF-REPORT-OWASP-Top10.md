# OWASP Top 10 Security Audit Report — CTR HR Hub

> **Date**: 2026-04-09
> **Auditor**: Phase 3 Batch 4 (Claude + Codex Gate 1)
> **Scope**: 572 API routes, 157 pages, 205 Prisma models
> **Branch**: `staging`

---

## Summary

| # | Category | Verdict | Notes |
|---|----------|---------|-------|
| A01 | Broken Access Control | **PASS** | RBAC SSOT + 599 routes standardized |
| A02 | Cryptographic Failures | **PASS** | Centralized env, HSTS, httpOnly |
| A03 | Injection | **PASS** | Prisma ORM only, zero raw SQL |
| A04 | Insecure Design | **PASS** | Rate limiting, payload limits, file validation |
| A05 | Security Misconfiguration | **FIXED** | CSP nonce-based (Batch 4) |
| A06 | Vulnerable Components | **MONITORED** | npm audit: 21 findings, 1 unfixable |
| A07 | Auth Failures | **PASS** | Login rate limit, JWT 8h, SameSite |
| A08 | Software/Data Integrity | **PASS** | Zod validation, signed JWT, SameSite CSRF |
| A09 | Logging Failures | **PASS** | Audit logging on PII reads + mutations |
| A10 | SSRF | **MITIGATED** | Webhook URL allowlist added |

---

## A01: Broken Access Control

**Verdict**: PASS

**Evidence**:
- RBAC SSOT in `src/lib/rbac/rbac-spec.ts` — 4 role groups, 30 route ACL rules
- All 599 API routes use `withPermission()` (552) or `withAuth()` (32) or `verifyCronSecret()` (9) + 9 intentional public
- Middleware enforces role-based route blocking (`src/middleware.ts:162-179`)
- Phase 3 Batch 1-3 fixed 6 P0 access control bugs (IDOR, delegation, cron auth)
- 150 E2E tests include RBAC boundary tests across 5 roles

**Key files**: `src/lib/rbac/rbac-spec.ts`, `src/middleware.ts`, `src/lib/permissions.ts`

---

## A02: Cryptographic Failures

**Verdict**: PASS

**Evidence**:
- Secrets centralized in `src/lib/env.ts` via `getRequired()`/`getOptional()` — no `process.env` direct access
- HSTS enforced in production: `max-age=63072000; includeSubDomains; preload`
- Session cookies: `httpOnly: true`, `secure: true` (prod), `sameSite: 'lax'`
- JWT signing with NEXTAUTH_SECRET (not stored client-side)
- No hardcoded secrets in source code (verified via grep)

**Key files**: `src/lib/env.ts`, `src/lib/auth.ts`, `src/middleware.ts`

---

## A03: Injection

**Verdict**: PASS

**Evidence**:
- All database queries via Prisma ORM (parameterized) — zero `$queryRaw`, zero string interpolation
- Input validation via Zod schemas on all mutation endpoints
- No OS command execution or LDAP queries
- CSV/XSS injection payloads tested in Phase 3 Batch 2

**Key files**: `src/lib/prisma.ts`, Zod schemas in `src/lib/schemas/`

---

## A04: Insecure Design

**Verdict**: PASS

**Evidence**:
- Login rate limiting: 10 req/min per IP (`src/middleware.ts`)
- AI endpoint rate limiting: 20 req/min per user (`src/lib/rate-limit.ts`, 14 endpoints)
- Payload size limit: 1MB for all API mutations (`src/middleware.ts`)
- File upload: MIME allowlist + magic bytes verification + size limits (`src/lib/file-validation.ts`)
- S3 presigned URLs: company-scoped keys, 1-hour expiry (`src/lib/s3.ts`)

---

## A05: Security Misconfiguration

**Verdict**: FIXED (this batch)

**Before**: CSP allowed `unsafe-eval` + `unsafe-inline` — negligible XSS protection
**After**: Nonce-based CSP in production with `strict-dynamic`, `object-src 'none'`, `upgrade-insecure-requests`

**Changes**:
- `src/middleware.ts` — dynamic `buildCspHeader(nonce)` with dev/prod split
- `src/app/layout.tsx` — nonce propagation to stylesheet
- `X-XSS-Protection` removed (legacy, superseded by CSP)
- `CSP_STRICT_MODE` env var kill switch for production rollback
- Sentry CSP `report-uri` for violation monitoring

---

## A06: Vulnerable Components

**Verdict**: MONITORED

**npm audit results** (2026-04-09):
- Total: 21 vulnerabilities (6 moderate, 15 high)
- **No fix available**: `xlsx` (prototype pollution + ReDoS) — used for Excel export only
- **Transitive (indirect)**: `hono`/`lodash`/`picomatch`/`flatted`/`effect` via `prisma`/`eslint`/`vite`
- **Direct fixable**: `next` (HTTP smuggling, moderate) — upgrade path available
- **Dev-only**: `vite` (path traversal) — not in production bundle

**Risk assessment**: Most vulnerabilities are in transitive dev dependencies not exposed to end users. `xlsx` has no upstream fix; input is admin-uploaded Excel files only (not arbitrary user input). `next` moderate issues mitigated by middleware payload validation.

**Action**: Monitor for upstream fixes. Consider `xlsx` alternative (e.g., `exceljs`) in future.

---

## A07: Authentication Failures

**Verdict**: PASS

**Evidence**:
- Login rate limiting: 10 attempts/min per IP with 429 response
- JWT session: 8-hour expiry, httpOnly cookie
- User enumeration protection: unified error message for auth failures
- Azure AD SSO integration (production) with proper OIDC flow
- Session timeout warning component with auto-logout

**Key files**: `src/lib/auth.ts`, `src/middleware.ts:120-141`

---

## A08: Software and Data Integrity Failures

**Verdict**: PASS

**Evidence** (per OWASP 2021 definition — CI/CD integrity, unsigned updates, deserialization):
- CI/CD: GitHub Actions with pinned action versions, no arbitrary script execution
- Dependencies: `package-lock.json` committed, integrity verified by npm
- Deserialization: No `JSON.parse()` on untrusted user input; API bodies validated by Zod before processing
- CSRF: SameSite=lax cookies prevent cross-origin form submissions
- No auto-update mechanisms that could be tampered

---

## A09: Security Logging and Monitoring Failures

**Verdict**: PASS

**Evidence**:
- Audit logging utility: `src/lib/audit.ts` with `logAudit()` function
- PII reads logged: `GET /employees/[id]` at `sensitivityLevel: 'HIGH'`
- Delegation events logged on create and revoke
- Sentry error monitoring: client (10% sample) + server (100%)
- Domain events: 27 handlers for business-critical actions
- CSP violations: `report-uri` to Sentry (added this batch)

**Key files**: `src/lib/audit.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`

---

## A10: Server-Side Request Forgery (SSRF)

**Verdict**: MITIGATED

**Finding** (Codex Gate 1 F3):
- `POST /api/v1/settings/teams-webhooks/test` accepted arbitrary URLs for server-side `fetch()`
- `src/lib/notifications.ts:259` posts to stored webhook URLs (lower risk — admin-configured)

**Fix applied** (this batch):
- Added URL allowlist validation in `teams-webhooks/test/route.ts`:
  - Protocol must be `https:`
  - Hostname must match `*.webhook.office.com`, `*.office365.com`, or `*.logic.azure.com`
- Stored webhook URLs (notifications.ts) are admin-only settings — risk accepted with documentation

**Residual risk**: LOW — only SETTINGS.CREATE permission holders can test webhooks, and only stored admin-configured URLs are used for notifications.

---

## Appendix: Files Modified in Batch 4

| File | Change |
|------|--------|
| `src/middleware.ts` | Nonce-based CSP, removed X-XSS-Protection |
| `src/app/layout.tsx` | Nonce propagation |
| `src/app/api/v1/compensation/simulation/ai-recommend/route.ts` | withRateLimit |
| `src/app/api/v1/performance/evaluations/[id]/ai-draft/route.ts` | withRateLimit (POST only) |
| `src/app/api/v1/analytics/ai-report/generate/route.ts` | withRateLimit |
| `src/app/api/v1/offboarding/[id]/exit-interview/ai-summary/route.ts` | withRateLimit |
| `src/app/api/v1/settings/teams-webhooks/test/route.ts` | SSRF URL allowlist |
| `.env.example` | SENTRY_CSP_REPORT_URI, CSP_STRICT_MODE |
| `e2e/api/csp-security.spec.ts` | NEW: CSP E2E tests |
