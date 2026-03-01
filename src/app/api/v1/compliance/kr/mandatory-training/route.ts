// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mandatory Training Settings CRUD
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { mandatoryTrainingSearchSchema, mandatoryTrainingCreateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = mandatoryTrainingSearchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, year, trainingType } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(year ? { year } : {}),
      ...(trainingType ? { trainingType } : {}),
    }

    const [trainings, total] = await Promise.all([
      prisma.mandatoryTraining.findMany({
        where,
        include: { course: { select: { id: true, title: true, category: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mandatoryTraining.count({ where }),
    ])

    const serialized = trainings.map((t) => ({
      ...t,
      requiredHours: Number(t.requiredHours),
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = mandatoryTrainingCreateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    try {
      const training = await prisma.mandatoryTraining.create({
        data: {
          companyId: user.companyId,
          courseId: parsed.data.courseId,
          trainingType: parsed.data.trainingType,
          year: parsed.data.year,
          dueDate: new Date(parsed.data.dueDate),
          requiredHours: parsed.data.requiredHours,
        },
        include: { course: { select: { id: true, title: true } } },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.kr.mandatory-training.create',
        resourceType: 'mandatoryTraining',
        resourceId: training.id,
        companyId: user.companyId,
        changes: { trainingType: parsed.data.trainingType, year: parsed.data.year },
        ip, userAgent,
      })

      return apiSuccess({ ...training, requiredHours: Number(training.requiredHours) }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
