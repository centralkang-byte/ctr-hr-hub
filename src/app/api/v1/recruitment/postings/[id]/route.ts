// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT/DELETE /api/v1/recruitment/postings/[id]
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

// ─── Update Schema ────────────────────────────────────────

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  requirements: z.string().nullable().optional(),
  preferred: z.string().nullable().optional(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'DISPATCH', 'INTERN']).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  jobGradeId: z.string().uuid().nullable().optional(),
  jobCategoryId: z.string().uuid().nullable().optional(),
  location: z.string().nullable().optional(),
  salaryRangeMin: z.number().nullable().optional(),
  salaryRangeMax: z.number().nullable().optional(),
  salaryHidden: z.boolean().optional(),
  headcount: z.number().int().min(1).optional(),
  workMode: z.enum(['OFFICE', 'REMOTE', 'HYBRID']).nullable().optional(),
  recruiterId: z.string().uuid().nullable().optional(),
  deadlineDate: z.string().nullable().optional(),
  requiredCompetencies: z.array(z.string()).nullable().optional(),
})

// ─── GET /api/v1/recruitment/postings/[id] ────────────────

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const record = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      include: {
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
        jobCategory: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        recruiter: { select: { id: true, name: true } },
        _count: { select: { applications: true } },
      },
    })

    if (!record) {
      throw notFound('채용 공고를 찾을 수 없습니다.')
    }

    return apiSuccess({
      ...record,
      salaryRangeMin: record.salaryRangeMin ? Number(record.salaryRangeMin) : null,
      salaryRangeMax: record.salaryRangeMax ? Number(record.salaryRangeMax) : null,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── PUT /api/v1/recruitment/postings/[id] ────────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
    })

    if (!existing) {
      throw notFound('채용 공고를 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const updated = await prisma.jobPosting.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.requirements !== undefined ? { requirements: data.requirements } : {}),
          ...(data.preferred !== undefined ? { preferred: data.preferred } : {}),
          ...(data.employmentType !== undefined ? { employmentType: data.employmentType } : {}),
          ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
          ...(data.jobGradeId !== undefined ? { jobGradeId: data.jobGradeId } : {}),
          ...(data.jobCategoryId !== undefined ? { jobCategoryId: data.jobCategoryId } : {}),
          ...(data.location !== undefined ? { location: data.location } : {}),
          ...(data.salaryRangeMin !== undefined ? { salaryRangeMin: data.salaryRangeMin } : {}),
          ...(data.salaryRangeMax !== undefined ? { salaryRangeMax: data.salaryRangeMax } : {}),
          ...(data.salaryHidden !== undefined ? { salaryHidden: data.salaryHidden } : {}),
          ...(data.headcount !== undefined ? { headcount: data.headcount } : {}),
          ...(data.workMode !== undefined ? { workMode: data.workMode } : {}),
          ...(data.recruiterId !== undefined ? { recruiterId: data.recruiterId } : {}),
          ...(data.deadlineDate !== undefined
            ? { deadlineDate: data.deadlineDate ? new Date(data.deadlineDate) : null }
            : {}),
          ...(data.requiredCompetencies !== undefined
            ? { requiredCompetencies: data.requiredCompetencies ?? undefined }
            : {}),
        },
        include: {
          department: { select: { id: true, name: true } },
          jobGrade: { select: { id: true, name: true } },
          jobCategory: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          recruiter: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.posting.update',
        resourceType: 'job_posting',
        resourceId: id,
        companyId: existing.companyId,
        changes: JSON.parse(JSON.stringify(data)),
        ip,
        userAgent,
      })

      return apiSuccess({
        ...updated,
        salaryRangeMin: updated.salaryRangeMin ? Number(updated.salaryRangeMin) : null,
        salaryRangeMax: updated.salaryRangeMax ? Number(updated.salaryRangeMax) : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── DELETE /api/v1/recruitment/postings/[id] ─────────────

export const DELETE = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
    })

    if (!existing) {
      throw notFound('채용 공고를 찾을 수 없습니다.')
    }

    await prisma.jobPosting.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'recruitment.posting.delete',
      resourceType: 'job_posting',
      resourceId: id,
      companyId: existing.companyId,
      ip,
      userAgent,
    })

    return apiSuccess({ id })
  },
  perm(MODULE.RECRUITMENT, ACTION.DELETE),
)
