import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { commandSearchSchema } from '@/lib/schemas/command-search'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const params = Object.fromEntries(req.nextUrl.searchParams.entries())
      const parsed = commandSearchSchema.safeParse(params)
      if (!parsed.success) {
        throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
      }

      const { q, limit } = parsed.data
      const companyId = user.companyId

      const [employees, documents] = await Promise.all([
        prisma.employee.findMany({
          where: {
            companyId,
            status: 'ACTIVE',
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { employeeNo: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            employeeNo: true,
            email: true,
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
          take: limit,
        }),
        prisma.hrDocument.findMany({
          where: {
            companyId,
            isActive: true,
            deletedAt: null,
            title: { contains: q, mode: 'insensitive' },
          },
          select: {
            id: true,
            title: true,
            docType: true,
          },
          take: limit,
        }),
      ])

      return apiSuccess({
        employees: employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeNo: e.employeeNo,
          email: e.email,
          department: e.department?.name ?? null,
          position: e.jobGrade?.name ?? null,
        })),
        documents: documents.map((d) => ({
          id: d.id,
          title: d.title,
          docType: d.docType,
        })),
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
