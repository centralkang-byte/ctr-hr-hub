// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Military Registration Detail & Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { militaryUpdateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/ru/military/[employeeId] ────
// Single military registration by employeeId

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { employeeId } = await context.params

    const registration = await prisma.militaryRegistration.findFirst({
      where: { employeeId, companyId: user.companyId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!registration) throw notFound('군복무 등록 정보를 찾을 수 없습니다.')

    return apiSuccess(registration)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

// ─── PUT /api/v1/compliance/ru/military/[employeeId] ────
// Update military registration

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { employeeId } = await context.params
    const body: unknown = await req.json()
    const parsed = militaryUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.militaryRegistration.findFirst({
        where: { employeeId, companyId: user.companyId },
      })
      if (!existing) throw notFound('군복무 등록 정보를 찾을 수 없습니다.')

      const data = parsed.data
      const result = await prisma.militaryRegistration.update({
        where: { id: existing.id },
        data: {
          ...(data.category !== undefined && { category: data.category }),
          ...(data.rank !== undefined && { rank: data.rank }),
          ...(data.specialtyCode !== undefined && { specialtyCode: data.specialtyCode }),
          ...(data.fitnessCategory !== undefined && { fitnessCategory: data.fitnessCategory }),
          ...(data.militaryOffice !== undefined && { militaryOffice: data.militaryOffice }),
          ...(data.registrationDate !== undefined && {
            registrationDate: data.registrationDate ? new Date(data.registrationDate) : null,
          }),
          ...(data.deregistrationDate !== undefined && {
            deregistrationDate: data.deregistrationDate ? new Date(data.deregistrationDate) : null,
          }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.ru.military.update',
        resourceType: 'militaryRegistration',
        resourceId: result.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.UPDATE),
)
