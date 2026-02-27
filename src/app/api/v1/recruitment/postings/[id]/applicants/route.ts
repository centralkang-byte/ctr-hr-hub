// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/postings/[id]/applicants
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, conflict, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Create Applicant Schema ─────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  phone: z.string().nullable().optional(),
  source: z.enum(['DIRECT', 'REFERRAL', 'AGENCY', 'JOB_BOARD', 'INTERNAL']),
  resumeKey: z.string().nullable().optional(),
  portfolioUrl: z.string().url().nullable().optional(),
  memo: z.string().nullable().optional(),
})

// ─── GET /api/v1/recruitment/postings/[id]/applicants ─────

export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id: postingId } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    // Verify posting exists and user has access
    const posting = await prisma.jobPosting.findFirst({
      where: { id: postingId, deletedAt: null, ...companyFilter },
      select: { id: true },
    })

    if (!posting) {
      throw notFound('채용 공고를 찾을 수 없습니다.')
    }

    // Parse query params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? DEFAULT_PAGE))
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE)),
    )
    const search = searchParams.get('search') ?? undefined
    const stage = searchParams.get('stage') ?? undefined

    // Build where clause
    const where = {
      postingId,
      ...(stage ? { stage: stage as 'APPLIED' | 'SCREENING' | 'INTERVIEW_1' | 'INTERVIEW_2' | 'FINAL' | 'OFFER' | 'HIRED' | 'REJECTED' } : {}),
      ...(search
        ? {
            applicant: {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    }

    const [total, applications] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { appliedAt: 'desc' },
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              source: true,
              portfolioUrl: true,
            },
          },
        },
      }),
    ])

    const data = applications.map((app) => ({
      ...app,
      offeredSalary: app.offeredSalary ? Number(app.offeredSalary) : null,
    }))

    return apiPaginated(data, buildPagination(page, limit, total))
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── POST /api/v1/recruitment/postings/[id]/applicants ────

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id: postingId } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    // Verify posting exists and user has access
    const posting = await prisma.jobPosting.findFirst({
      where: { id: postingId, deletedAt: null, ...companyFilter },
      select: { id: true, companyId: true },
    })

    if (!posting) {
      throw notFound('채용 공고를 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { name, email, phone, source, resumeKey, portfolioUrl, memo } =
      parsed.data

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Upsert applicant by email
        const applicant = await tx.applicant.upsert({
          where: { email },
          create: {
            name,
            email,
            phone: phone ?? null,
            source,
            resumeKey: resumeKey ?? null,
            portfolioUrl: portfolioUrl ?? null,
            memo: memo ?? null,
          },
          update: {
            name,
            phone: phone ?? undefined,
            resumeKey: resumeKey ?? undefined,
            portfolioUrl: portfolioUrl ?? undefined,
            memo: memo ?? undefined,
          },
        })

        // Check if applicant already applied to this posting
        const existingApplication = await tx.application.findUnique({
          where: {
            postingId_applicantId: {
              postingId,
              applicantId: applicant.id,
            },
          },
        })

        if (existingApplication) {
          throw conflict('이 지원자는 이미 해당 공고에 지원하였습니다.')
        }

        // Create application
        const application = await tx.application.create({
          data: {
            postingId,
            applicantId: applicant.id,
            stage: 'APPLIED',
            appliedAt: new Date(),
          },
          include: {
            applicant: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                source: true,
                portfolioUrl: true,
              },
            },
          },
        })

        return application
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.applicant.create',
        resourceType: 'application',
        resourceId: result.id,
        companyId: posting.companyId,
        changes: { applicantEmail: email, postingId },
        ip,
        userAgent,
      })

      return apiSuccess(
        {
          ...result,
          offeredSalary: result.offeredSalary
            ? Number(result.offeredSalary)
            : null,
        },
        201,
      )
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error // Re-throw AppError (e.g., conflict)
      }
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
