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
import { ROUTE_ACL, findRouteRule } from '@/lib/rbac/rbac-spec'
import type { RouteRule } from '@/lib/rbac/rbac-spec'

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

// ─── RBAC SSOT ────────────────────────────────────────────
// Role groups + Route ACL은 src/lib/rbac/rbac-spec.ts에서 중앙 관리.
// navigation.ts, page guard, 테스트 모두 동일 소스 참조.

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

// ─── Login Rate Limit (in-memory sliding window) ────────────
// Applied at middleware level so it returns 429 BEFORE NextAuth handles the request.
// NextAuth's own callbacks cannot return custom HTTP status codes.
const loginAttemptsByIp = new Map<string, number[]>()
const LOGIN_RATE_WINDOW_MS = 60_000 // 1 minute
const LOGIN_RATE_MAX = 10

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - LOGIN_RATE_WINDOW_MS
  let timestamps = loginAttemptsByIp.get(ip)
  if (!timestamps) {
    timestamps = []
    loginAttemptsByIp.set(ip, timestamps)
  }
  // Remove expired entries
  const filtered = timestamps.filter((t) => t > windowStart)
  filtered.push(now)
  loginAttemptsByIp.set(ip, filtered)

  // Probabilistic cleanup (1% chance)
  if (Math.random() < 0.01) {
    const cutoff = now - LOGIN_RATE_WINDOW_MS * 2
    for (const [k, v] of loginAttemptsByIp) {
      if (v.every((t) => t < cutoff)) loginAttemptsByIp.delete(k)
    }
  }

  return filtered.length > LOGIN_RATE_MAX
}

// ─── Middleware ──────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 0. Body size limit (Fix 4-7) — reject oversized API payloads before processing
  if (pathname.startsWith('/api/') && request.method !== 'GET' && request.method !== 'HEAD') {
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      if (size > 1_000_000) { // 1MB limit
        return applySecurityHeaders(
          NextResponse.json(
            { error: { code: 'PAYLOAD_TOO_LARGE', message: '요청 본문이 너무 큽니다. 최대 1MB까지 허용됩니다.' } },
            { status: 413 },
          ),
        )
      }
    }
  }

  // 0b. Login rate limit — POST to credentials callback only
  if (
    pathname === '/api/auth/callback/credentials' &&
    request.method === 'POST'
  ) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'
    if (checkLoginRateLimit(ip)) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: '로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요.',
            },
          },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      )
    }
  }

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
