// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Permission Helpers (RBAC)
// ═══════════════════════════════════════════════════════════

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { forbidden, unauthorized } from '@/lib/errors'
import { apiError } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { Permission, SessionUser } from '@/types'

// ─── Check if session has specific permission ─────────────

export function hasPermission(
  user: SessionUser,
  permission: Permission,
): boolean {
  // SUPER_ADMIN bypasses all permission checks
  if (user.role === ROLE.SUPER_ADMIN) return true

  return user.permissions.some(
    (p) => p.module === permission.module && p.action === permission.action,
  )
}

// ─── Throw 403 if missing permission ──────────────────────

export function requirePermission(
  user: SessionUser | null | undefined,
  permission: Permission,
): asserts user is SessionUser {
  if (!user) {
    throw unauthorized()
  }

  if (!hasPermission(user, permission)) {
    throw forbidden(
      `${permission.module}:${permission.action} 권한이 필요합니다.`,
    )
  }
}

// ─── API Route wrapper with permission check ──────────────

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>

export function withPermission(
  handler: (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => Promise<NextResponse>,
  permission: Permission,
): RouteHandler {
  return async (req, context) => {
    try {
      const session = await getServerSession(authOptions)

      if (!session?.user) {
        return apiError(unauthorized())
      }

      const user = session.user as SessionUser

      if (!hasPermission(user, permission)) {
        return apiError(
          forbidden(
            `${permission.module}:${permission.action} 권한이 필요합니다.`,
          ),
        )
      }

      return await handler(req, context, user)
    } catch (error) {
      return apiError(error)
    }
  }
}

// ─── Get all permissions for a role from DB ───────────────

export async function getPermissionsForRole(
  roleId: string,
): Promise<Permission[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  })

  return rolePermissions.map((rp) => ({
    module: rp.permission.module,
    action: rp.permission.action,
  }))
}

// ─── Check permission with company scope ──────────────────

export function hasCompanyScopedPermission(
  user: SessionUser,
  permission: Permission,
  targetCompanyId: string,
): boolean {
  // SUPER_ADMIN can access all companies
  if (user.role === ROLE.SUPER_ADMIN) return true

  // Other roles: must match company
  if (user.companyId !== targetCompanyId) return false

  return hasPermission(user, permission)
}

// ─── Helper: build permission object ──────────────────────

export function perm(module: string, action: string): Permission {
  return { module, action }
}
