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
import {
  acquirePrimaryAssignmentDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks,
  readPrimaryAssignmentTimeline,
  revalidatePrimaryAssignmentDepartments,
  revalidatePrimaryAssignmentMasterData,
} from '@/lib/employee/primary-assignment-writer'
import type { PrismaTx } from '@/lib/prisma-rls'
import type { SessionUser } from '@/types'

bootstrapEventHandlers()

const EMPLOYEE_NUMBER_REGISTRY_LOCK = 'employee-number:global-registry'

// ─── Schema ───────────────────────────────────────────────

const convertSchema = z.object({
  employeeNo: z.string().optional(),    // 미입력 시 자동 생성
  startDate: z.string().date(),
  companyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  jobGradeId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),     // 직위 (optional — 미입력 시 발령에서 배정)
  jobCategoryId: z.string().uuid().optional(),  // 미입력 시 공고에서 자동 설정
  buddyId: z.string().uuid().optional(),        // E-3: 온보딩 버디 지정
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'INTERN']).optional(),
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

    const { employeeNo, startDate, companyId, departmentId, jobGradeId, positionId, jobCategoryId, buddyId: _buddyId, employmentType } = parsed.data

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

    // positionId(직위)가 대상 법인 소속인지 검증 (직접 API로 타 법인 position 연결 방지)
    if (positionId) {
      const pos = await prisma.position.findFirst({
        where: { id: positionId, companyId: targetCompanyId, deletedAt: null },
        select: { id: true },
      })
      if (!pos) throw badRequest('positionId(직위)가 해당 법인에 속하지 않습니다.')
    }

    try {
      // B4: 모든 쓰기 작업을 단일 트랜잭션으로 묶어 원자성 보장
      const newEmployee = await prisma.$transaction(async (tx: PrismaTx) => {
        const lockedApplication = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM applications
          WHERE id = ${id}
          FOR UPDATE
        `
        if (lockedApplication.length !== 1) throw notFound('지원서를 찾을 수 없습니다.')
        const freshApp = await tx.application.findUnique({
          where: { id },
          include: {
            applicant: { select: { name: true, email: true } },
            posting: {
              select: {
                companyId: true,
                departmentId: true,
                jobGradeId: true,
                jobCategoryId: true,
                employmentType: true,
              },
            },
          },
        })
        if (
          !freshApp ||
          freshApp.stage !== 'HIRED' ||
          freshApp.convertedEmployeeId !== null
        ) {
          throw conflict('이미 전환 처리 중이거나 전환된 지원서입니다.')
        }

        const freshTargetCompanyId = companyId
          ?? freshApp.posting?.companyId
          ?? user.companyId
        const freshDepartmentId = departmentId ?? freshApp.posting?.departmentId
        const freshJobGradeId = jobGradeId ?? freshApp.posting?.jobGradeId
        const freshJobCategoryId = jobCategoryId ?? freshApp.posting?.jobCategoryId
        const freshEmploymentType = employmentType
          ?? mapRequisitionTypeToEmploymentType(freshApp.posting?.employmentType)
        if (
          freshTargetCompanyId !== targetCompanyId ||
          freshDepartmentId !== resolvedDepartmentId ||
          freshJobGradeId !== resolvedJobGradeId ||
          freshJobCategoryId !== resolvedJobCategoryId ||
          freshEmploymentType !== resolvedEmploymentType
        ) {
          throw conflict('지원서 또는 채용 공고의 소속 정보가 변경되었습니다.')
        }
        if (user.role !== 'SUPER_ADMIN' && freshTargetCompanyId !== user.companyId) {
          throw notFound('접근 권한이 없습니다.')
        }

        // Employee.employeeNo is globally unique. Serialize both generated and
        // caller-supplied numbers before department/employee locks so every
        // recruitment conversion observes the same registry state.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${EMPLOYEE_NUMBER_REGISTRY_LOCK}, 0)
          )
        `

        const departmentScopes = [{
          companyId: freshTargetCompanyId,
          departmentId: freshDepartmentId,
        }]
        await acquirePrimaryAssignmentDepartmentLocks(tx, departmentScopes)
        await revalidatePrimaryAssignmentDepartments(tx, departmentScopes)
        await revalidatePrimaryAssignmentMasterData(tx, {
          companyId: freshTargetCompanyId,
          jobGradeId: freshJobGradeId,
          jobCategoryId: freshJobCategoryId,
          positionId,
        })

        const newEmployeeId = crypto.randomUUID()
        await acquirePrimaryAssignmentEmployeeLocks(tx, [newEmployeeId])
        const initialTimeline = await readPrimaryAssignmentTimeline(tx, newEmployeeId)
        if (initialTimeline.length !== 0) {
          throw conflict('신규 직원 ID에 기존 주 발령이 존재합니다.')
        }

        // B4: 사번 생성을 트랜잭션 내부에서 수행 (race condition 방어)
        let generatedNo = employeeNo
        if (!generatedNo) {
          generatedNo = await generateEmployeeNoTx(tx)
        } else {
          // 사번 중복 체크
          const existing = await tx.employee.findUnique({
            where: { employeeNo: generatedNo },
            select: { id: true },
          })
          if (existing) throw conflict('이미 사용 중인 사번입니다.')
        }

        // 1. Create employee record
        const emp = await tx.employee.create({
          data: {
            id: newEmployeeId,
            name: freshApp.applicant.name,
            email: freshApp.applicant.email,
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
            companyId: freshTargetCompanyId,
            departmentId: freshDepartmentId,
            jobGradeId: freshJobGradeId,
            jobCategoryId: freshJobCategoryId,
            positionId: positionId ?? null,
            employmentType: freshEmploymentType,
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
        positionId: positionId ?? undefined,
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

async function generateEmployeeNoTx(tx: PrismaTx): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `EMP-${year}-`

  const last = await tx.employee.findFirst({
    where: {
      employeeNo: { startsWith: prefix },
    },
    orderBy: { employeeNo: 'desc' },
    select: { employeeNo: true },
  })

  const seq = last?.employeeNo
    ? (parseInt(last.employeeNo.slice(prefix.length), 10) + 1)
    : 1

  return `${prefix}${String(seq).padStart(4, '0')}`
}
