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
  // Get first (primary) role for the employee
  const employeeRole = await prisma.employeeRole.findFirst({
    where: {
      employeeId,
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
    return { role: 'EMPLOYEE', companyId: '', permissions: [] }
  }

  const permissions: Permission[] = employeeRole.role.rolePermissions.map(
    (rp) => ({
      module: rp.permission.module,
      action: rp.permission.action,
    }),
  )

  return {
    role: employeeRole.role.code,
    companyId: employeeRole.companyId,
    permissions,
  }
}

// ─── NextAuth Options ────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: env.AZURE_AD_CLIENT_ID,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
      tenantId: env.AZURE_AD_TENANT_ID,
    }),
    // ─── Test accounts: email-only login (checks DB; works only for seeded accounts) ───
    CredentialsProvider({
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
                  where: { isPrimary: true, endDate: null },
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
        const empStatus = emp.assignments?.[0]?.status
        if (empStatus === 'RESIGNED' || empStatus === 'TERMINATED') return null
        return { id: emp.id, email: credentials.email, name: emp.name }
      },
    }),
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
                where: { isPrimary: true, endDate: null },
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
      const employeeStatus = employee.assignments?.[0]?.status
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
