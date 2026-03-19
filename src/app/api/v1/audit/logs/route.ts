// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/audit/logs
// 감사 로그 조회 (페이지네이션 + 필터)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { auditLogSearchSchema } from '@/lib/schemas/audit'
import type { SessionUser } from '@/types'
import type { Prisma } from '@/generated/prisma/client'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = auditLogSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 검색 조건입니다.', { issues: parsed.error.issues })
    }

    const {
      page,
      limit,
      action,
      resourceType,
      actorId,
      sensitivityLevel,
      dateFrom,
      dateTo,
    } = parsed.data

    // SUPER_ADMIN은 전체 법인 감사 로그 조회 가능
    const companyFilter =
      user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const where: Prisma.AuditLogWhereInput = {
      ...companyFilter,
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...(resourceType ? { resourceType: { equals: resourceType, mode: 'insensitive' as const } } : {}),
      ...(actorId ? { actorId } : {}),
      ...(sensitivityLevel ? { sensitivityLevel } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return apiPaginated(logs, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
