// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Military Registration List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { militarySearchSchema, militaryCreateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/ru/military ─────────────────
// Paginated list of military registrations with filters

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = militarySearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, category, search } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      ...(category ? { category } : {}),
      ...(search
        ? {
            employee: {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { employeeNo: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    }

    const [registrations, total] = await Promise.all([
      prisma.militaryRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
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
      }),
      prisma.militaryRegistration.count({ where }),
    ])

    return apiPaginated(registrations, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

// ─── POST /api/v1/compliance/ru/military ────────────────
// Create military registration record

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = militaryCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const {
      employeeId,
      category,
      rank,
      specialtyCode,
      fitnessCategory,
      militaryOffice,
      registrationDate,
      deregistrationDate,
      notes,
    } = parsed.data

    try {
      const registration = await prisma.militaryRegistration.create({
        data: {
          employeeId,
          companyId: user.companyId,
          category,
          rank,
          specialtyCode,
          fitnessCategory,
          militaryOffice,
          ...(registrationDate ? { registrationDate: new Date(registrationDate) } : {}),
          ...(deregistrationDate ? { deregistrationDate: new Date(deregistrationDate) } : {}),
          notes,
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
        action: 'compliance.ru.military.create',
        resourceType: 'militaryRegistration',
        resourceId: registration.id,
        companyId: user.companyId,
        changes: { employeeId, category, fitnessCategory },
        ip,
        userAgent,
      })

      return apiSuccess(registration, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
