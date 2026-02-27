// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/applications/[id]/convert-to-employee
// 채용 지원자 → 직원 전환 (stage: HIRED)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, conflict, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schema ───────────────────────────────────────────────

const convertSchema = z.object({
  employeeNo: z.string().optional(),    // 미입력 시 자동 생성
  startDate: z.string().date(),
  companyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  jobGradeId: z.string().uuid().optional(),
  jobCategoryId: z.string().uuid().optional(),  // 미입력 시 공고에서 자동 설정
})

// ─── POST /api/v1/recruitment/applications/[id]/convert-to-employee ───

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    // stage가 HIRED이고 아직 convertedEmployeeId가 없는 지원서
    const application = await prisma.application.findFirst({
      where: {
        id,
        stage: 'HIRED',
        convertedEmployeeId: null,
      },
      include: {
        applicant: { select: { name: true, email: true } },
        posting: { select: { companyId: true, departmentId: true, jobGradeId: true, jobCategoryId: true } },
      },
    })
    if (!application) throw notFound('지원서를 찾을 수 없거나 이미 전환된 지원서입니다.')

    // companyId scope 검증
    const postingCompanyId = application.posting?.companyId
    if (
      user.role !== 'SUPER_ADMIN' &&
      postingCompanyId &&
      postingCompanyId !== user.companyId
    ) {
      throw notFound('지원서를 찾을 수 없거나 이미 전환된 지원서입니다.')
    }

    const body: unknown = await req.json()
    const parsed = convertSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeNo, startDate, companyId, departmentId, jobGradeId, jobCategoryId } = parsed.data

    const targetCompanyId = companyId ?? postingCompanyId ?? user.companyId

    // companyFilter 적용 확인
    if (user.role !== 'SUPER_ADMIN' && targetCompanyId !== user.companyId) {
      throw notFound('접근 권한이 없습니다.')
    }

    // 필수 필드 해소 (공고에서 자동 채움, 없으면 요청에 포함 필요)
    const resolvedDepartmentId = departmentId ?? application.posting?.departmentId
    if (!resolvedDepartmentId) {
      throw badRequest('departmentId가 필요합니다. 공고에 부서가 설정되어 있지 않습니다.')
    }

    const resolvedJobGradeId = jobGradeId ?? application.posting?.jobGradeId
    if (!resolvedJobGradeId) {
      throw badRequest('jobGradeId가 필요합니다. 공고에 직급이 설정되어 있지 않습니다.')
    }

    const resolvedJobCategoryId = jobCategoryId ?? application.posting?.jobCategoryId
    if (!resolvedJobCategoryId) {
      throw badRequest('jobCategoryId가 필요합니다. 공고에 직무 카테고리가 설정되어 있지 않습니다.')
    }

    // 사번 중복 체크
    if (employeeNo) {
      const existing = await prisma.employee.findFirst({
        where: { employeeNo, companyId: targetCompanyId, deletedAt: null },
      })
      if (existing) throw conflict('이미 사용 중인 사번입니다.')
    }

    const generatedNo = employeeNo ?? await generateEmployeeNo(targetCompanyId)

    try {
      const newEmployee = await prisma.$transaction(async (tx) => {
        const emp = await tx.employee.create({
          data: {
            name: application.applicant.name,
            email: application.applicant.email,
            employeeNo: generatedNo,
            companyId: targetCompanyId,
            departmentId: resolvedDepartmentId,
            jobGradeId: resolvedJobGradeId,
            jobCategoryId: resolvedJobCategoryId,
            hireDate: new Date(startDate),
            employmentType: 'FULL_TIME',
            status: 'ACTIVE',
          },
        })

        await tx.application.update({
          where: { id },
          data: {
            convertedEmployeeId: emp.id,
            convertedAt: new Date(),
          },
        })

        return emp
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'application.convertToEmployee',
        resourceType: 'employee',
        resourceId: newEmployee.id,
        companyId: targetCompanyId,
        ip,
        userAgent,
      })

      return apiSuccess({ employeeId: newEmployee.id, employeeNo: newEmployee.employeeNo }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── Helper ───────────────────────────────────────────────

async function generateEmployeeNo(companyId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `EMP-${year}-`

  const last = await prisma.employee.findFirst({
    where: { companyId, employeeNo: { startsWith: prefix } },
    orderBy: { employeeNo: 'desc' },
    select: { employeeNo: true },
  })

  const seq = last?.employeeNo
    ? (parseInt(last.employeeNo.slice(prefix.length), 10) + 1)
    : 1

  return `${prefix}${String(seq).padStart(4, '0')}`
}
