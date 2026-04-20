// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/postings
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withAuth, withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// Route-local role allowlist for listing job postings.
// Module-wide recruitment:read was too broad (dashboard/talent-pool/costs etc.);
// list + detail views are opened to MANAGER explicitly.
// EXECUTIVE intentionally excluded — seed only granted *_export, not recruitment:read.
const POSTINGS_READ_ROLES: ReadonlyArray<SessionUser['role']> = [
  ROLE.SUPER_ADMIN,
  ROLE.HR_ADMIN,
  ROLE.MANAGER,
]

// ─── Validation Schemas ──────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED']).optional(),
})

const createSchema = z.object({
  title: z.string().min(1, '공고 제목을 입력해주세요.'),
  description: z.string().min(1, '공고 설명을 입력해주세요.'),
  requirements: z.string().optional(),
  preferred: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'DISPATCH', 'INTERN']),
  departmentId: z.string().uuid().optional(),
  jobGradeId: z.string().uuid().optional(),
  jobCategoryId: z.string().uuid().optional(),
  location: z.string().optional(),
  salaryRangeMin: z.number().optional(),
  salaryRangeMax: z.number().optional(),
  salaryHidden: z.boolean().optional(),
  headcount: z.number().int().min(1).default(1),
  workMode: z.enum(['OFFICE', 'REMOTE', 'HYBRID']).optional(),
  recruiterId: z.string().uuid().optional(),
  deadlineDate: z.string().optional(),
  requiredCompetencies: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (data.salaryRangeMin != null && data.salaryRangeMax != null) {
      return data.salaryRangeMin <= data.salaryRangeMax
    }
    return true
  },
  { message: '최소 급여가 최대 급여보다 클 수 없습니다.', path: ['salaryRangeMax'] },
)

// ─── GET /api/v1/recruitment/postings ─────────────────────

export const GET = withAuth(
  async (req: NextRequest, _context, user: SessionUser) => {
    if (!POSTINGS_READ_ROLES.includes(user.role)) {
      throw forbidden('채용 공고 조회 권한이 없습니다.')
    }
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, search, status } = parsed.data

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      deletedAt: null,
      ...companyFilter,
      ...(status ? { status } : {}),
      ...(search
        ? {
            title: { contains: search, mode: 'insensitive' as const },
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          jobGrade: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobPosting.count({ where }),
    ])

    // Convert Decimal fields to number
    const serialized = items.map((item) => ({
      ...item,
      salaryRangeMin: item.salaryRangeMin ? Number(item.salaryRangeMin) : null,
      salaryRangeMax: item.salaryRangeMax ? Number(item.salaryRangeMax) : null,
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
)

// ─── POST /api/v1/recruitment/postings ────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const record = await prisma.jobPosting.create({
        data: {
          title: data.title,
          description: data.description,
          requirements: data.requirements ?? null,
          preferred: data.preferred ?? null,
          employmentType: data.employmentType,
          departmentId: data.departmentId ?? null,
          jobGradeId: data.jobGradeId ?? null,
          jobCategoryId: data.jobCategoryId ?? null,
          location: data.location ?? null,
          salaryRangeMin: data.salaryRangeMin ?? null,
          salaryRangeMax: data.salaryRangeMax ?? null,
          salaryHidden: data.salaryHidden ?? false,
          headcount: data.headcount,
          workMode: data.workMode ?? null,
          recruiterId: data.recruiterId ?? null,
          deadlineDate: data.deadlineDate ? new Date(data.deadlineDate) : null,
          requiredCompetencies: data.requiredCompetencies ?? undefined,
          companyId: user.companyId,
          createdById: user.employeeId,
          status: 'DRAFT',
        },
        include: {
          department: { select: { id: true, name: true } },
          jobGrade: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.posting.create',
        resourceType: 'job_posting',
        resourceId: record.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({
        ...record,
        salaryRangeMin: record.salaryRangeMin ? Number(record.salaryRangeMin) : null,
        salaryRangeMax: record.salaryRangeMax ? Number(record.salaryRangeMax) : null,
      }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
