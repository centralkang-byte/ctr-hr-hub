// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/disciplinary/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { addMonths } from 'date-fns'

// ─── Update Schema ────────────────────────────────────────

const updateSchema = z.object({
  actionType: z.enum([
    'VERBAL_WARNING', 'WRITTEN_WARNING', 'REPRIMAND',
    'SUSPENSION', 'PAY_CUT', 'DEMOTION', 'TERMINATION',
  ]).optional(),
  category: z.enum([
    'ATTENDANCE', 'SAFETY', 'QUALITY', 'CONDUCT',
    'POLICY_VIOLATION', 'MISCONDUCT', 'HARASSMENT', 'FRAUD', 'OTHER',
  ]).optional(),
  incidentDate: z.string().optional(),
  description: z.string().min(1).optional(),
  evidenceKeys: z.array(z.string()).optional(),
  committeeDate: z.string().optional(),
  committeeMembers: z.array(z.string()).optional(),
  decision: z.string().optional(),
  decisionDate: z.string().optional(),
  suspensionStart: z.string().optional(),
  suspensionEnd: z.string().optional(),
  validMonths: z.number().int().min(1).nullable().optional(),
  demotionGradeId: z.string().uuid().nullable().optional(),
  salaryReductionRate: z.number().min(0).max(100).nullable().optional(),
  salaryReductionMonths: z.number().int().min(1).nullable().optional(),
  status: z.enum(['DISCIPLINE_ACTIVE', 'DISCIPLINE_EXPIRED', 'DISCIPLINE_OVERTURNED']).optional(),
  appealResult: z.string().optional(),
  appealStatus: z.enum(['NONE', 'FILED', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED']).optional(),
})

// ─── GET /api/v1/disciplinary/[id] ────────────────────────

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const record = await prisma.disciplinaryAction.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
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
        issuer: { select: { id: true, name: true } },
        demotionGrade: { select: { id: true, name: true } },
      },
    })

    if (!record) {
      throw notFound('징계 기록을 찾을 수 없습니다.')
    }

    return apiSuccess(record)
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

// ─── PUT /api/v1/disciplinary/[id] ────────────────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.disciplinaryAction.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
    })

    if (!existing) {
      throw notFound('징계 기록을 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    // expiresAt 재계산: validMonths 변경 시
    let expiresAt: Date | null | undefined = undefined
    if (data.validMonths !== undefined) {
      if (data.validMonths === null) {
        expiresAt = null
      } else {
        const baseDate = data.decisionDate
          ? new Date(data.decisionDate)
          : existing.decisionDate ?? new Date()
        expiresAt = addMonths(baseDate, data.validMonths)
      }
    }

    try {
      const updated = await prisma.disciplinaryAction.update({
        where: { id },
        data: {
          ...(data.actionType !== undefined ? { actionType: data.actionType } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.incidentDate !== undefined ? { incidentDate: new Date(data.incidentDate) } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.evidenceKeys !== undefined ? { evidenceKeys: data.evidenceKeys } : {}),
          ...(data.committeeDate !== undefined ? { committeeDate: new Date(data.committeeDate) } : {}),
          ...(data.committeeMembers !== undefined ? { committeeMembers: data.committeeMembers } : {}),
          ...(data.decision !== undefined ? { decision: data.decision } : {}),
          ...(data.decisionDate !== undefined ? { decisionDate: new Date(data.decisionDate) } : {}),
          ...(data.suspensionStart !== undefined ? { suspensionStart: new Date(data.suspensionStart) } : {}),
          ...(data.suspensionEnd !== undefined ? { suspensionEnd: new Date(data.suspensionEnd) } : {}),
          ...(data.validMonths !== undefined ? { validMonths: data.validMonths } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(data.demotionGradeId !== undefined ? { demotionGradeId: data.demotionGradeId } : {}),
          ...(data.salaryReductionRate !== undefined ? { salaryReductionRate: data.salaryReductionRate } : {}),
          ...(data.salaryReductionMonths !== undefined ? { salaryReductionMonths: data.salaryReductionMonths } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.appealResult !== undefined ? { appealResult: data.appealResult } : {}),
          ...(data.appealStatus !== undefined ? { appealStatus: data.appealStatus } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          issuer: { select: { id: true, name: true } },
          demotionGrade: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'disciplinary.update',
        resourceType: 'disciplinary_action',
        resourceId: id,
        companyId: existing.companyId,
        changes: JSON.parse(JSON.stringify(data)),
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.DISCIPLINE, ACTION.UPDATE),
)
