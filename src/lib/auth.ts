// ═══════════════════════════════════════════════════════════
// CTR HR Hub — NextAuth Configuration (Microsoft Entra ID)
// ═══════════════════════════════════════════════════════════

import type { NextAuthOptions, Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import type { Permission, SessionUser } from '@/types'

// ─── Login Rate Limit (Fix 4-5) ──────────────────────────
// In-memory sliding window rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const LOGIN_WINDOW_MS = 60_000 // 1 minute
const LOGIN_MAX_ATTEMPTS = 10

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return true
  }
  return false
}

// Cleanup stale entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of loginAttempts) {
    if (now >= entry.resetAt) loginAttempts.delete(key)
  }
}, 5 * 60_000).unref()

// ─── Extend next-auth types ──────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    employeeId?: string
    companyId?: string
    role?: string
    permissions?: Permission[]
  }
}

// ─── Helper: Load permissions for an employee ────────────

async function loadEmployeePermissions(employeeId: string): Promise<{
  role: string
  companyId: string
  permissions: Permission[]
}> {
  // Session 209: Primary assignment 우선 조회 → role lookup의 companyId scope으로 사용.
  // Pre-hire(active primary 없음)는 EMPLOYEE/no-perms로 강등 — Codex Gate 1 MED 3:
  // 입사 전 role pre-provisioning만으로 권한이 세션에 핀되는 경로 차단.
  const primaryAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      endDate: null,
      effectiveDate: { lte: new Date() }, // Exclude future assignments (pre-hire)
    },
    select: { companyId: true },
  })

  if (!primaryAssignment) {
    return { role: 'EMPLOYEE', companyId: '', permissions: [] }
  }

  // Session 209: endDate=null + companyId scope으로 role lookup 정합화.
  // - endDate=null: 만료된 (acting/임시) role row가 session pin되는 silent-fail 차단.
  // - companyId scope: 멀티 법인 employee에서 cross-company role drift 차단
  //   (예: company A primary + company B HR_ADMIN 보유 시 session.role=HR_ADMIN /
  //   session.companyId=A drift 가능).
  const employeeRole = await prisma.employeeRole.findFirst({
    where: {
      employeeId,
      endDate: null,
      companyId: primaryAssignment.companyId,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  })

  if (!employeeRole) {
    return { role: 'EMPLOYEE', companyId: primaryAssignment.companyId, permissions: [] }
  }

  const permissions: Permission[] = employeeRole.role.rolePermissions.map(
    (rp) => ({
      module: rp.permission.module,
      action: rp.permission.action,
    }),
  )

  return {
    role: employeeRole.role.code,
    companyId: primaryAssignment.companyId,
    permissions,
  }
}

// ─── NextAuth Options ────────────────────────────────────

// ─── Credentials provider gating ─────────────────────────
// Email-only login authorizes without password — only safe in non-production
// or when explicitly opted in via ALLOW_CREDENTIALS_LOGIN=true.
// Production default = disabled (prevents SUPER_ADMIN backdoor via curl).
const allowCredentialsLogin =
  env.NODE_ENV !== 'production' || env.ALLOW_CREDENTIALS_LOGIN === 'true'

const credentialsProvider = CredentialsProvider({
  id: 'credentials',
  name: 'Test Login',
  credentials: { email: { label: 'Email', type: 'email' } },
  async authorize(credentials) {
    // Fix 4-6: Unified error message to prevent user enumeration
    // Note: Rate limiting is handled in middleware (returns 429 before reaching here)
    if (!credentials?.email) return null
    const sso = await prisma.ssoIdentity.findFirst({
      where: { email: credentials.email },
      include: {
        employee: {
          include: {
            assignments: {
              // Session 209 (Codex Gate 2 P2): effectiveDate <= now 추가 — pre-hire
              // (future-dated primary)는 loadEmployeePermissions에서 EMPLOYEE/[]로
              // 강등되므로, 로그인 callback도 동일 정책으로 통일해 사용 불가 세션 차단.
              where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
    })
    // Return null for all failure cases (same generic message shown to user)
    if (!sso?.employee) return null
    const emp = sso.employee
    // Session 209: active primary 부재(pre-hire 또는 종료자) 시 로그인 차단.
    if (!emp.assignments?.[0]) return null
    const empStatus = emp.assignments[0].status
    if (empStatus === 'RESIGNED' || empStatus === 'TERMINATED') return null
    return { id: emp.id, email: credentials.email, name: emp.name }
  },
})

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: env.AZURE_AD_CLIENT_ID,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
      tenantId: env.AZURE_AD_TENANT_ID,
    }),
    ...(allowCredentialsLogin ? [credentialsProvider] : []),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  cookies: {
    sessionToken: {
      name: env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: env.NODE_ENV === 'production',
      },
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      // Fix 4-5: Rate limit login attempts by IP
      try {
        const hdrs = await headers()
        const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        if (isLoginRateLimited(ip)) {
          return '/login?error=TooManyAttempts'
        }
      } catch {
        // headers() may fail in certain contexts — proceed without rate limiting
      }

      // SSO 이메일로 직원 조회
      const ssoIdentity = await prisma.ssoIdentity.findFirst({
        where: { email: user.email },
        include: {
          employee: {
            include: {
              assignments: {
                // Session 209 (Codex Gate 2 P2): effectiveDate <= now 추가 (authorize와 정합).
                where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
                take: 1,
                select: { status: true },
              },
            },
          },
        },
      })

      // Fix 4-6: Return same false for all failure cases (no user enumeration)
      if (!ssoIdentity?.employee) {
        return false
      }

      const employee = ssoIdentity.employee
      // Session 209: active primary 부재(pre-hire 또는 종료자) 시 로그인 차단.
      if (!employee.assignments?.[0]) {
        return false
      }
      const employeeStatus = employee.assignments[0].status
      if (employeeStatus === 'RESIGNED' || employeeStatus === 'TERMINATED') {
        return false
      }

      return true
    },

    async jwt({ token, user, trigger }) {
      if (user?.email || trigger === 'update') {
        const email = user?.email ?? token.email
        if (!email) return token

        const ssoIdentity = await prisma.ssoIdentity.findFirst({
          where: { email },
          include: { employee: true },
        })

        if (ssoIdentity?.employee) {
          const employee = ssoIdentity.employee
          const { role, companyId, permissions } =
            await loadEmployeePermissions(employee.id)

          token.employeeId = employee.id
          token.companyId = companyId
          token.role = role
          token.permissions = permissions
          token.name = employee.name
          token.email = email
        }
      }

      return token
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (token.employeeId) {
        session.user = {
          id: token.sub ?? '',
          employeeId: token.employeeId,
          companyId: token.companyId ?? '',
          name: token.name ?? '',
          email: token.email ?? '',
          role: token.role ?? 'EMPLOYEE',
          permissions: token.permissions ?? [],
        }
      }

      return session
    },
  },
}
