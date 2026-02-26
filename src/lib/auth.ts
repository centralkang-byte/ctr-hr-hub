// ═══════════════════════════════════════════════════════════
// CTR HR Hub — NextAuth Configuration (Microsoft Entra ID)
// ═══════════════════════════════════════════════════════════

import type { NextAuthOptions, Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import type { Permission, SessionUser } from '@/types'

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
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      // SSO 이메일로 직원 조회
      const ssoIdentity = await prisma.ssoIdentity.findFirst({
        where: { email: user.email },
        include: { employee: true },
      })

      if (!ssoIdentity?.employee) {
        return false
      }

      const employee = ssoIdentity.employee
      if (employee.status === 'RESIGNED' || employee.status === 'TERMINATED') {
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
          token.companyId = companyId || employee.companyId
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
