// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/org/restructure
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { restructureSchema } from '@/lib/schemas/org'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/org/restructure ─────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = restructureSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      changeType,
      companyId: rawCompanyId,
      effectiveDate,
      affectedDepartmentId,
      fromData,
      toData,
      reason,
      approvedBy,
      documentKey,
    } = parsed.data

    // Non-SUPER_ADMIN: silently force companyId to their own company
    const companyId =
      user.role === 'SUPER_ADMIN' ? rawCompanyId : user.companyId

    try {
      const record = await prisma.$transaction(async (tx) => {
        // 1. Create the org change history record
        const history = await tx.orgChangeHistory.create({
          data: {
            companyId,
            changeType,
            effectiveDate: new Date(effectiveDate),
            affectedDepartmentId: affectedDepartmentId ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fromData: fromData ? (JSON.parse(JSON.stringify(fromData)) as any) : undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toData: toData ? (JSON.parse(JSON.stringify(toData)) as any) : undefined,
            reason: reason ?? null,
            approvedBy: approvedBy ?? null,
            documentKey: documentKey ?? null,
          },
        })

        // 2. Apply side effects based on changeType
        if (changeType === 'CLOSE' && affectedDepartmentId) {
          await tx.department.update({
            where: { id: affectedDepartmentId, companyId },
            data: { isActive: false },
          })
        } else if (changeType === 'RENAME' && affectedDepartmentId && toData) {
          const newName = (toData as Record<string, unknown>).name
          if (typeof newName === 'string') {
            await tx.department.update({
              where: { id: affectedDepartmentId, companyId },
              data: { name: newName },
            })
          }
        } else if (changeType === 'CREATE' && toData) {
          const td = toData as Record<string, unknown>
          if (
            typeof td.code === 'string' &&
            typeof td.name === 'string' &&
            typeof td.level === 'number'
          ) {
            await tx.department.create({
              data: {
                companyId,
                code: td.code,
                name: td.name,
                level: td.level,
                nameEn: typeof td.nameEn === 'string' ? td.nameEn : null,
                parentId: typeof td.parentId === 'string' ? td.parentId : null,
                sortOrder: typeof td.sortOrder === 'number' ? td.sortOrder : 0,
              },
            })
          }
        }
        // MERGE, SPLIT, RESTRUCTURE: history record only — no automated side effects

        return history
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.restructure',
        resourceType: 'org',
        resourceId: record.id,
        companyId: record.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(record, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.UPDATE),
)
