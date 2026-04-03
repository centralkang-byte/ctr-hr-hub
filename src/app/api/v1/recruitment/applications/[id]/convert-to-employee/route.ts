// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/applications/[id]/convert-to-employee
// 채용 지원자 → 직원 전환 (stage: HIRED)
// E-3 Enhanced:
//   - Idempotency guard: if already HIRED + Employee exists → return existing (200)
//   - Emits EMPLOYEE_HIRED event → triggers onboarding pipeline automatically
//   - Double-submit prevention at API level
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, conflict, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import { mapRequisitionTypeToEmploymentType } from '@/lib/ats/employment-type-mapper'
import type { PrismaTx } from '@/lib/prisma-rls'
import type { SessionUser } from '@/types'

bootstrapEventHandlers()

// ─── Schema ───────────────────────────────────────────────

const convertSchema = z.object({
  employeeNo: z.string().optional(),    // 미입력 시 자동 생성
  startDate: z.string().date(),
  companyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  jobGradeId: z.string().uuid().optional(),
  jobCategoryId: z.string().uuid().optional(),  // 미입력 시 공고에서 자동 설정
  buddyId: z.string().uuid().optional(),        // E-3: 온보딩 버디 지정
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'INTERN']).optional().default('FULL_TIME'),
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
        posting: { select: { companyId: true, departmentId: true, jobGradeId: true, jobCategoryId: true, employmentType: true } },
      },
    })
    if (!application) {
      // B4: Idempotency — 이미 전환된 경우 기존 결과 반환
      const alreadyConverted = await prisma.application.findFirst({
        where: {
          id,
          stage: 'HIRED',
          convertedEmployeeId: { not: null },
        },
        select: { convertedEmployeeId: true },
      })
      if (alreadyConverted?.convertedEmployeeId) {
        return apiSuccess({
          employeeId: alreadyConverted.convertedEmployeeId,
          alreadyConverted: true,
          message: '이미 직원으로 전환된 지원서입니다.',
        })
      }
      throw notFound('지원서를 찾을 수 없거나 이미 전환된 지원서입니다.')
    }

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

    const { employeeNo, startDate, companyId, departmentId, jobGradeId, jobCategoryId, buddyId: _buddyId, employmentType } = parsed.data

    const targetCompanyId = companyId ?? postingCompanyId ?? user.companyId

    // companyFilter 적용 확인
    if (user.role !== 'SUPER_ADMIN' && targetCompanyId !== user.companyId) {
      throw notFound('접근 권한이 없습니다.')
    }

    // 필수 필드 해소 (공고에서 자동 채움, 없으면 요청에 포함 필요)
    const resolvedDepartmentId = departmentId ?? application.posting?.departmentId
    if (!resolvedDepartmentId) {
      throw badRequest('departmentId(부서)는 필수입니다. 공고에 부서가 설정되어 있지 않으므로 요청에 포함해 주세요.')
    }

    const resolvedJobGradeId = jobGradeId ?? application.posting?.jobGradeId
    if (!resolvedJobGradeId) {
      throw badRequest('jobGradeId(직급)는 필수입니다. 공고에 직급이 설정되어 있지 않으므로 요청에 포함해 주세요.')
    }

    const resolvedJobCategoryId = jobCategoryId ?? application.posting?.jobCategoryId
    if (!resolvedJobCategoryId) {
      throw badRequest('jobCategoryId(직군)는 필수입니다. 공고에 직무 카테고리가 설정되어 있지 않으므로 요청에 포함해 주세요.')
    }

    // Track B B-1h: Map ATS posting employmentType (lowercase) to Prisma enum
    const resolvedEmploymentType = employmentType ?? mapRequisitionTypeToEmploymentType(application.posting?.employmentType)

    try {
      // B4: 모든 쓰기 작업을 단일 트랜잭션으로 묶어 원자성 보장
      const newEmployee = await prisma.$transaction(async (tx: PrismaTx) => {
        // B4: Idempotency guard — 트랜잭션 내부에서 재확인 (concurrent request 방어)
        const freshApp = await tx.application.findFirst({
          where: { id, convertedEmployeeId: null },
          select: { id: true },
        })
        if (!freshApp) throw conflict('이미 전환 처리 중이거나 전환된 지원서입니다.')

        // B4: 사번 생성을 트랜잭션 내부에서 수행 (race condition 방어)
        let generatedNo = employeeNo
        if (!generatedNo) {
          generatedNo = await generateEmployeeNoTx(tx, targetCompanyId)
        } else {
          // 사번 중복 체크
          const existing = await tx.employee.findFirst({
            where: {
              employeeNo: generatedNo,
              deletedAt: null,
              assignments: { some: { companyId: targetCompanyId, isPrimary: true, endDate: null } },
            },
          })
          if (existing) throw conflict('이미 사용 중인 사번입니다.')
        }

        // 1. Create employee record
        const emp = await tx.employee.create({
          data: {
            name: application.applicant.name,
            email: application.applicant.email,
            employeeNo: generatedNo,
            hireDate: new Date(startDate),
          },
        })

        // 2. Create initial assignment (inlined — createAssignment uses its own tx)
        await tx.employeeAssignment.create({
          data: {
            employeeId: emp.id,
            effectiveDate: new Date(startDate),
            endDate: null,
            changeType: 'HIRE',
            companyId: targetCompanyId,
            departmentId: resolvedDepartmentId,
            jobGradeId: resolvedJobGradeId,
            jobCategoryId: resolvedJobCategoryId,
            employmentType: resolvedEmploymentType,
            status: 'ACTIVE',
            isPrimary: true,
          },
        })

        // 3. B4: Atomic lock — convertedEmployeeId: null 조건으로 중복 전환 방어
        const updated = await tx.application.updateMany({
          where: { id, convertedEmployeeId: null },
          data: {
            convertedEmployeeId: emp.id,
            convertedAt: new Date(),
          },
        })
        if (updated.count === 0) throw conflict('이미 전환 처리 중이거나 전환된 지원서입니다.')

        return emp
      })

      // B4: eventBus.publish는 트랜잭션 커밋 이후 실행
      void eventBus.publish(DOMAIN_EVENTS.EMPLOYEE_HIRED, {
        ctx: {
          companyId: targetCompanyId,
          actorId: user.employeeId,
          occurredAt: new Date(),
        },
        employeeId: newEmployee.id,
        companyId: targetCompanyId,
        hireDate: new Date(startDate),
        departmentId: resolvedDepartmentId,
        positionId: resolvedJobGradeId,
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

      return apiSuccess({
        employeeId: newEmployee.id,
        employeeNo: newEmployee.employeeNo,
        message: '직원 등록 완료! 온보딩이 자동으로 시작됩니다.',
      }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── Helper ───────────────────────────────────────────────

async function generateEmployeeNoTx(tx: PrismaTx, companyId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `EMP-${year}-`

  const last = await tx.employee.findFirst({
    where: {
      employeeNo: { startsWith: prefix },
      assignments: { some: { companyId, isPrimary: true, endDate: null } },
    },
    orderBy: { employeeNo: 'desc' },
    select: { employeeNo: true },
  })

  const seq = last?.employeeNo
    ? (parseInt(last.employeeNo.slice(prefix.length), 10) + 1)
    : 1

  return `${prefix}${String(seq).padStart(4, '0')}`
}
