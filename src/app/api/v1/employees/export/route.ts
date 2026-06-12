// ═══════════════════════════════════════════════════════════
// GET /api/v1/employees/export — 직원 목록 엑셀 다운로드
// ═══════════════════════════════════════════════════════════
import { type NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { badRequest } from '@/lib/errors'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { employeeExportSchema } from '@/lib/schemas/employee'
import { maskPhone } from '@/lib/masking'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const GET = withRateLimit(withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    // omit page and limit for full export
    const { page: _page, limit: _limit, ...exportParams } = params
    const parsed = employeeExportSchema.safeParse({ ...exportParams, page: 1, limit: 1 })
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.')

    const { companyId, departmentId, jobGradeId, status, employmentType, contractType, hireDateFrom, hireDateTo, search, ids } = parsed.data

    const assignmentFilter: Record<string, unknown> = {}
    if (user.role !== 'SUPER_ADMIN') assignmentFilter.companyId = user.companyId
    else if (companyId) assignmentFilter.companyId = companyId
    // 표시용 발령 include 회사 스코프 (super-admin 법인 미지정 시 undefined = cross-company)
    const scopeCompanyId =
      user.role !== 'SUPER_ADMIN' ? user.companyId : companyId ?? undefined
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
      // 선택 내보내기: id IN ids 는 회사 스코프(assignments.some.companyId)와 AND로 결합 —
      // 타 법인 id를 넘겨도 회사 필터에 막혀 0건 (멀티테넌트 누출 방지)
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
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
          // 표시용 발령도 회사 스코프에 묶음 — 다회사 직원의 타 법인 조직정보 노출 방지(HIGH2).
          // super-admin(법인 미지정)만 무스코프 = 의도된 cross-company 뷰.
          where: {
            isPrimary: true,
            endDate: null,
            ...(scopeCompanyId ? { companyId: scopeCompanyId } : {}),
          },
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

    const isPrivileged = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN

    // residentId is never included in export (not selected from DB)
    const rows = employees.map((e) => {
      const a = extractPrimaryAssignment(e.assignments)
      return {
        사번: e.employeeNo,
        이름: e.name,
        영문이름: e.nameEn ?? '',
        이메일: e.email,
        전화번호: isPrivileged ? (e.phone ?? '') : maskPhone(e.phone ?? ''),
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

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'employee.export',
      resourceType: 'employee',
      resourceId: user.companyId,
      companyId: user.companyId,
      changes: { count: employees.length, filters: exportParams },
      ip,
      userAgent,
    })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="employees_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.EXPORT),
), RATE_LIMITS.EXPORT)
