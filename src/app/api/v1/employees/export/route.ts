// ═══════════════════════════════════════════════════════════
// GET /api/v1/employees/export — 직원 목록 엑셀 다운로드
// ═══════════════════════════════════════════════════════════
import { type NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { badRequest } from '@/lib/errors'
import { MODULE, ACTION } from '@/lib/constants'
import { employeeSearchSchema } from '@/lib/schemas/employee'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    // omit page and limit for full export
    const { page: _page, limit: _limit, ...exportParams } = params
    const parsed = employeeSearchSchema.safeParse({ ...exportParams, page: 1, limit: 1 })
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.')

    const { companyId, departmentId, jobGradeId, status, employmentType, contractType, hireDateFrom, hireDateTo, search } = parsed.data

    const assignmentFilter: Record<string, unknown> = {}
    if (user.role !== 'SUPER_ADMIN') assignmentFilter.companyId = user.companyId
    else if (companyId) assignmentFilter.companyId = companyId
    if (departmentId) assignmentFilter.departmentId = departmentId
    if (jobGradeId) assignmentFilter.jobGradeId = jobGradeId
    if (status) assignmentFilter.status = status
    if (employmentType) assignmentFilter.employmentType = employmentType
    if (contractType) assignmentFilter.contractType = contractType

    const hireDateRange: Record<string, unknown> = {}
    if (hireDateFrom) hireDateRange.gte = new Date(hireDateFrom)
    if (hireDateTo) hireDateRange.lte = new Date(hireDateTo)

    const hasAssignmentFilter = Object.keys(assignmentFilter).length > 0

    const where = {
      deletedAt: null,
      ...(Object.keys(hireDateRange).length > 0 ? { hireDate: hireDateRange } : {}),
      ...(hasAssignmentFilter ? {
        assignments: { some: { ...assignmentFilter, isPrimary: true, endDate: null } }
      } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { employeeNo: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ]} : {}),
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            company: { select: { name: true } },
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 5000,
    })

    const rows = employees.map((e) => {
      const a = e.assignments[0]
      return {
        사번: e.employeeNo,
        이름: e.name,
        영문이름: e.nameEn ?? '',
        이메일: e.email,
        전화번호: e.phone ?? '',
        법인: a?.company?.name ?? '',
        부서: a?.department?.name ?? '',
        직급: a?.jobGrade?.name ?? '',
        고용형태: a?.employmentType ?? '',
        재직상태: a?.status ?? '',
        입사일: e.hireDate ? new Date(e.hireDate).toLocaleDateString('ko-KR') : '',
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, '직원목록')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="employees_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.EXPORT),
)
