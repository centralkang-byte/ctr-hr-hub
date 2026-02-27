// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/org/snapshots
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const snapshotQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  date: z.string().date().optional(),
})

const snapshotCreateSchema = z.object({
  companyId: z.string().uuid(),
})

// ─── GET /api/v1/org/snapshots ────────────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = snapshotQuerySchema.safeParse(rawParams)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { companyId, date } = parsed.data

    // Company scope enforcement
    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? companyId
          ? { companyId }
          : {}
        : { companyId: user.companyId }

    const snapshots = await prisma.orgSnapshot.findMany({
      where: {
        ...companyFilter,
        ...(date ? { snapshotDate: new Date(date) } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { snapshotDate: 'desc' },
    })

    return apiSuccess(snapshots)
  },
  perm(MODULE.ORG, ACTION.VIEW),
)

// ─── POST /api/v1/org/snapshots ───────────────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const body: unknown = await req.json()
    const parsed = snapshotCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { companyId } = parsed.data

    // Non-SUPER_ADMIN can only create snapshots for their own company
    if (user.role !== 'SUPER_ADMIN' && user.companyId !== companyId) {
      throw badRequest('본인 회사의 스냅샷만 생성할 수 있습니다.')
    }

    // Gather current department/headcount data for snapshot
    const [departments, totalHeadcount] = await Promise.all([
      prisma.department.findMany({
        where: { companyId, deletedAt: null, isActive: true },
        include: {
          _count: {
            select: {
              employees: {
                where: { deletedAt: null, status: 'ACTIVE' },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.employee.count({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
      }),
    ])

    const snapshotData = {
      totalHeadcount,
      capturedAt: new Date().toISOString(),
      departments: departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        level: dept.level,
        parentId: dept.parentId,
        headcount: dept._count.employees,
      })),
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
      const snapshot = await prisma.orgSnapshot.upsert({
        where: {
          companyId_snapshotDate: {
            companyId,
            snapshotDate: today,
          },
        },
        create: {
          companyId,
          snapshotDate: today,
          snapshotData,
          createdBy: user.employeeId,
        },
        update: {
          snapshotData,
          createdBy: user.employeeId,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'orgSnapshot.create',
        resourceType: 'orgSnapshot',
        resourceId: snapshot.id,
        companyId,
        ip,
        userAgent,
      })

      return apiSuccess(snapshot, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.CREATE),
)
