// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/employees/[id]/work-permits
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const workPermitCreateSchema = z.object({
  permitType: z.enum(['WORK_VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT', 'I9_VERIFICATION', 'OTHER']),
  permitNumber: z.string().optional(),
  issuingCountry: z.string().min(2).max(3),
  issuingAuthority: z.string().optional(),
  issueDate: z.string().date(),
  expiryDate: z.string().date().optional(),
  documentKey: z.string().optional(),
  notes: z.string().optional(),
})

// ─── GET /api/v1/employees/[id]/work-permits ──────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const assignmentFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...assignmentFilter },
      select: { id: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const workPermits = await prisma.workPermit.findMany({
      where: { employeeId: id, deletedAt: null },
      orderBy: { issueDate: 'desc' },
      include: {
        creator: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(workPermits)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/employees/[id]/work-permits ─────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const assignmentFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...assignmentFilter },
      select: {
        id: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { companyId: true },
        },
      },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const primary = extractPrimaryAssignment(employee.assignments)
    const companyId = primary?.companyId ?? ''

    const body: unknown = await req.json()
    const parsed = workPermitCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      permitType,
      permitNumber,
      issuingCountry,
      issuingAuthority,
      issueDate,
      expiryDate,
      documentKey,
      notes,
    } = parsed.data

    try {
      const workPermit = await prisma.workPermit.create({
        data: {
          employeeId: id,
          companyId,
          permitType,
          permitNumber: permitNumber ?? null,
          issuingCountry,
          issuingAuthority: issuingAuthority ?? null,
          issueDate: new Date(issueDate),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          documentKey: documentKey ?? null,
          notes: notes ?? null,
          createdById: user.employeeId,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'workPermit.create',
        resourceType: 'workPermit',
        resourceId: workPermit.id,
        companyId,
        ip,
        userAgent,
      })

      return apiSuccess(workPermit, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.CREATE),
)
