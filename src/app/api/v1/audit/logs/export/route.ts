// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/audit/logs/export
// 감사 로그 CSV 내보내기
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { auditLogExportSchema } from '@/lib/schemas/audit'
import type { SessionUser } from '@/types'
import type { Prisma } from '@/generated/prisma/client'

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const GET = withRateLimit(
  withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
      const params = Object.fromEntries(req.nextUrl.searchParams.entries())
      const parsed = auditLogExportSchema.safeParse(params)
      if (!parsed.success) {
        throw badRequest('잘못된 검색 조건입니다.', { issues: parsed.error.issues })
      }

      const { action, resourceType, actorId, sensitivityLevel, dateFrom, dateTo } = parsed.data

      const where: Prisma.AuditLogWhereInput = {
        companyId: user.companyId,
        ...(action ? { action: { contains: action } } : {}),
        ...(resourceType ? { resourceType } : {}),
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

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { name: true, employeeNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      })

      const rows = [
        'Timestamp,Actor,EmployeeNo,Action,ResourceType,ResourceId,IP,SensitivityLevel',
      ]
      for (const log of logs) {
        rows.push(
          [
            escapeCsv(log.createdAt.toISOString()),
            escapeCsv(log.actor.name),
            escapeCsv(log.actor.employeeNo),
            escapeCsv(log.action),
            escapeCsv(log.resourceType),
            escapeCsv(log.resourceId),
            escapeCsv(log.ipAddress ?? ''),
            escapeCsv(log.sensitivityLevel ?? ''),
          ].join(','),
        )
      }

      const csv = rows.join('\n')
      const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    },
    perm(MODULE.SETTINGS, ACTION.VIEW),
  ),
  RATE_LIMITS.EXPORT,
)
