// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/disciplinary + POST /api/v1/disciplinary
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { addMonths } from 'date-fns'

// ─── Validation Schemas ──────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  status: z.enum(['DISCIPLINE_ACTIVE', 'DISCIPLINE_EXPIRED', 'DISCIPLINE_OVERTURNED']).optional(),
  category: z.enum([
    'ATTENDANCE', 'SAFETY', 'QUALITY', 'CONDUCT',
    'POLICY_VIOLATION', 'MISCONDUCT', 'HARASSMENT', 'FRAUD', 'OTHER',
  ]).optional(),
})

const createSchema = z.object({
  employeeId: z.string().uuid(),
  actionType: z.enum([
    'VERBAL_WARNING', 'WRITTEN_WARNING', 'REPRIMAND',
    'SUSPENSION', 'PAY_CUT', 'DEMOTION', 'TERMINATION',
  ]),
  category: z.enum([
    'ATTENDANCE', 'SAFETY', 'QUALITY', 'CONDUCT',
    'POLICY_VIOLATION', 'MISCONDUCT', 'HARASSMENT', 'FRAUD', 'OTHER',
  ]),
  incidentDate: z.string(),
  description: z.string().min(1),
  evidenceKeys: z.array(z.string()).optional(),
  committeeDate: z.string().optional(),
  committeeMembers: z.array(z.string()).optional(),
  decision: z.string().optional(),
  decisionDate: z.string().optional(),
  suspensionStart: z.string().optional(),
  suspensionEnd: z.string().optional(),
  validMonths: z.number().int().min(1).optional(),
  demotionGradeId: z.string().uuid().optional(),
  salaryReductionRate: z.number().min(0).max(100).optional(),
  salaryReductionMonths: z.number().int().min(1).optional(),
})

// ─── GET /api/v1/disciplinary ─────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, search, status, category } = parsed.data

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      deletedAt: null,
      ...companyFilter,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { employee: { name: { contains: search, mode: 'insensitive' as const } } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.disciplinaryAction.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          issuer: { select: { id: true, name: true } },
          demotionGrade: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.disciplinaryAction.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

// ─── POST /api/v1/disciplinary ────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    // expiresAt 계산: validMonths 설정 시
    let expiresAt: Date | null = null
    if (data.validMonths) {
      const baseDate = data.decisionDate ? new Date(data.decisionDate) : new Date()
      expiresAt = addMonths(baseDate, data.validMonths)
    }

    try {
      const record = await prisma.disciplinaryAction.create({
        data: {
          employeeId: data.employeeId,
          companyId: user.companyId,
          actionType: data.actionType,
          category: data.category,
          incidentDate: new Date(data.incidentDate),
          description: data.description,
          evidenceKeys: data.evidenceKeys ?? undefined,
          committeeDate: data.committeeDate ? new Date(data.committeeDate) : null,
          committeeMembers: data.committeeMembers ?? undefined,
          decision: data.decision ?? null,
          decisionDate: data.decisionDate ? new Date(data.decisionDate) : null,
          suspensionStart: data.suspensionStart ? new Date(data.suspensionStart) : null,
          suspensionEnd: data.suspensionEnd ? new Date(data.suspensionEnd) : null,
          validMonths: data.validMonths ?? null,
          expiresAt,
          demotionGradeId: data.demotionGradeId ?? null,
          salaryReductionRate: data.salaryReductionRate ?? null,
          salaryReductionMonths: data.salaryReductionMonths ?? null,
          issuedBy: user.employeeId,
          status: 'DISCIPLINE_ACTIVE',
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          issuer: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'disciplinary.create',
        resourceType: 'disciplinary_action',
        resourceId: record.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(record, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.DISCIPLINE, ACTION.CREATE),
)
