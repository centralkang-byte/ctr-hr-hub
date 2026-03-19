// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Next.js Middleware (Security Headers + RBAC)
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: auth flow for all 523 API routes + RBAC enforcement
// Last verified: 2026-03-18 (P0 RBAC fix)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// ─── Security Headers ──────────────────────────────────────

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'on',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

// ─── Public routes (no auth required) ──────────────────────

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/health',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// ─── Role hierarchy (mirrors src/config/navigation.ts) ─────
// These role groups MUST stay in sync with navigation.ts:
//   ALL_ROLES  = EMPLOYEE, MANAGER, EXECUTIVE, HR_ADMIN, SUPER_ADMIN
//   MANAGER_UP = MANAGER, EXECUTIVE, HR_ADMIN, SUPER_ADMIN
//   HR_UP      = HR_ADMIN, SUPER_ADMIN

const ALL_ROLES = ['EMPLOYEE', 'MANAGER', 'EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN']
const MANAGER_UP = ['MANAGER', 'EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN']
const HR_UP = ['HR_ADMIN', 'SUPER_ADMIN']

// ─── Route ACL (path prefix → allowed roles) ──────────────
// Derived from navigation.ts section visibleTo mappings.
// Order matters: more specific prefixes must come first.
// Routes not listed here require authentication but allow any role.

interface RouteRule {
  prefix: string
  allowedRoles: string[]
}

const ROUTE_ACL: RouteRule[] = [
  // ── HR_ADMIN+ only sections ──────────────────────────
  // Settings (section 10)
  { prefix: '/settings', allowedRoles: HR_UP },
  // Payroll admin (section 7) — but /payroll/me is employee self-service
  { prefix: '/payroll/me', allowedRoles: ALL_ROLES },
  { prefix: '/payroll', allowedRoles: HR_UP },
  // Compliance (section 9)
  { prefix: '/compliance', allowedRoles: HR_UP },
  // HR Management (section 4)
  { prefix: '/employees', allowedRoles: HR_UP },
  { prefix: '/directory', allowedRoles: HR_UP },
  { prefix: '/org', allowedRoles: HR_UP },
  { prefix: '/attendance/admin', allowedRoles: HR_UP },
  { prefix: '/leave/admin', allowedRoles: HR_UP },
  { prefix: '/onboarding', allowedRoles: HR_UP },
  { prefix: '/offboarding/exit-interviews', allowedRoles: HR_UP },
  { prefix: '/discipline', allowedRoles: HR_UP },
  // Recruitment (section 5)
  { prefix: '/recruitment', allowedRoles: HR_UP },
  { prefix: '/talent', allowedRoles: HR_UP },
  // Performance & Compensation admin (section 6)
  { prefix: '/performance/admin', allowedRoles: HR_UP },
  { prefix: '/performance/goals', allowedRoles: HR_UP },
  { prefix: '/performance/calibration', allowedRoles: HR_UP },
  { prefix: '/performance/results', allowedRoles: HR_UP },
  { prefix: '/performance/peer-review', allowedRoles: HR_UP },
  { prefix: '/compensation', allowedRoles: HR_UP },
  { prefix: '/benefits', allowedRoles: HR_UP },

  // ── MANAGER+ sections ────────────────────────────────
  // Team management (section 3)
  { prefix: '/manager-hub', allowedRoles: MANAGER_UP },
  { prefix: '/attendance/team', allowedRoles: MANAGER_UP },
  { prefix: '/leave/team', allowedRoles: MANAGER_UP },
  { prefix: '/performance/team-goals', allowedRoles: MANAGER_UP },
  { prefix: '/performance/manager-eval', allowedRoles: MANAGER_UP },
  { prefix: '/performance/one-on-one', allowedRoles: MANAGER_UP },
  { prefix: '/delegation', allowedRoles: MANAGER_UP },
  // Insights (section 8)
  { prefix: '/analytics', allowedRoles: MANAGER_UP },

  // ── API routes mirroring page ACL ────────────────────
  { prefix: '/api/v1/settings', allowedRoles: HR_UP },
  { prefix: '/api/v1/payroll/me', allowedRoles: ALL_ROLES },
  { prefix: '/api/v1/payroll', allowedRoles: HR_UP },
  { prefix: '/api/v1/compliance', allowedRoles: HR_UP },
  // Recruitment: internal-jobs available to all (self-service internal mobility)
  { prefix: '/api/v1/recruitment/internal-jobs', allowedRoles: ALL_ROLES },
  // Recruitment: interview evaluate available to managers (interviewers)
  { prefix: '/api/v1/recruitment/interviews', allowedRoles: MANAGER_UP },
  { prefix: '/api/v1/recruitment', allowedRoles: HR_UP },
  { prefix: '/api/v1/year-end/hr', allowedRoles: HR_UP },
  { prefix: '/api/v1/analytics', allowedRoles: MANAGER_UP },
]

function findRouteRule(pathname: string): RouteRule | null {
  for (const rule of ROUTE_ACL) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      return rule
    }
  }
  return null
}

// ─── Helper: apply security headers ────────────────────────

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }
  return response
}

// ─── Middleware ──────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Public routes — apply headers only, no auth check
  if (isPublicPath(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  // 2. Get JWT token (lightweight, no DB call)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // 3. Unauthenticated → redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  // 4. RBAC check — find matching route rule
  const rule = findRouteRule(pathname)
  if (rule) {
    const userRole = (token.role as string) || 'EMPLOYEE'
    if (!rule.allowedRoles.includes(userRole)) {
      // API routes → JSON 403; pages → redirect to home
      if (pathname.startsWith('/api/')) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' } },
            { status: 403 },
          ),
        )
      }
      const homeUrl = new URL('/', request.url)
      homeUrl.searchParams.set('error', 'forbidden')
      return applySecurityHeaders(NextResponse.redirect(homeUrl))
    }
  }

  // 5. Authorized — proceed with security headers
  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    // Match all paths except static files and _next internals
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/).*)',
  ],
}
