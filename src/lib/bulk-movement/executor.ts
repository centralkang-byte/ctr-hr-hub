// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Movement Executor
// All-or-Nothing 트랜잭션으로 대량 인사발령 실행
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { parseDateOnly } from '@/lib/timezone'
import { sendNotification } from '@/lib/notifications'
import type { EmployeeAssignment } from '@/generated/prisma/client'
import {
  PRIMARY_ASSIGNMENT_RETRY_CODE,
  acquirePrimaryAssignmentDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks,
  assertPrimaryAssignmentReplacement,
  assertPrimaryAssignmentSourceScopeLocked,
  casPrimaryAssignment,
  getOpenPrimaryAssignment,
  getPrimaryAssignmentAtDate,
  readPrimaryAssignmentTimeline,
  revalidatePrimaryAssignmentDepartments,
  revalidatePrimaryAssignmentMasterDataSet,
  withPrimaryAssignmentRetry,
  type PrimaryAssignmentDepartmentScope,
  type PrimaryAssignmentMasterData,
} from '@/lib/employee/primary-assignment-writer'
import { AppError, badRequest } from '@/lib/errors'
import { selectSalaryBand } from '@/lib/payroll/salary-band'
import type { MovementType, ValidatedRow } from './types'

// Prisma 7 interactive transaction client 타입
type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ── HR Admin 비정기 보상 알림 ──────────────────────────────
async function notifyHrAdminsForOffCycle(
  companyId: string,
  employeeId: string,
  employeeName: string,
  reason: 'PROMOTION' | 'ROLE_CHANGE',
) {
  const hrAdmins = await prisma.employee.findMany({
    where: {
      assignments: {
        some: { companyId, endDate: null, isPrimary: true },
      },
      employeeRoles: {
        some: { role: { code: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } }, endDate: null },
      },
      deletedAt: null,
      resignDate: null,
    },
    select: { id: true },
  })

  const reasonLabel = reason === 'PROMOTION' ? '승진' : '법인전환'
  for (const hr of hrAdmins) {
    sendNotification({
      employeeId: hr.id,
      triggerType: 'offCycleComp.bulkTrigger',
      title: '비정기 급여 조정 검토 필요',
      body: `${employeeName}의 ${reasonLabel} 발령에 따른 급여 조정을 검토해 주세요.`,
      titleKey: 'notifications.offCycleComp.bulkTrigger.title',
      bodyKey: 'notifications.offCycleComp.bulkTrigger.body',
      bodyParams: {
        employeeName,
        reason: reasonLabel,
      },
      link: `/compensation/off-cycle/new?employeeId=${employeeId}&reason=${reason}`,
      priority: 'normal',
      companyId,
    })
  }
}

interface AssignmentContext {
  current: EmployeeAssignment
  timeline: EmployeeAssignment[]
}

interface OffCycleNotification {
  companyId: string
  employeeId: string
  employeeName: string
  reason: 'PROMOTION' | 'ROLE_CHANGE'
}

async function closeAssignment(
  tx: TxClient,
  context: AssignmentContext,
  endDate: Date,
  nextEffectiveDate: Date,
) {
  assertPrimaryAssignmentReplacement({
    timeline: context.timeline,
    replacedAssignmentId: context.current.id,
    closeDate: endDate,
    nextEffectiveDate,
  })
  await casPrimaryAssignment(tx, context.current, { endDate })
}

// ── 부서 이동 (TRANSFER) ────────────────────────────────────
async function executeTransfer(
  tx: TxClient,
  row: ValidatedRow,
  context: AssignmentContext,
) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)
  const { current } = context
  if (current.effectiveDate >= effectiveDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 발령일이 현재 발령일 이전입니다`)
  }

  await closeAssignment(tx, context, effectiveDate, effectiveDate)

  await tx.employeeAssignment.create({
    data: {
      employeeId: row.employeeId,
      effectiveDate,
      endDate: null,
      changeType: 'TRANSFER',
      companyId: current.companyId,
      departmentId: data.departmentId,
      jobGradeId: data.jobGradeId ?? current.jobGradeId,
      jobCategoryId: data.jobCategoryId ?? current.jobCategoryId,
      positionId: data.positionId ?? current.positionId,
      employmentType: current.employmentType,
      workLocationId: data.workLocationId ?? current.workLocationId,
      contractType: current.contractType,
      status: current.status,
      isPrimary: true,
      reason: data.reason ?? null,
    },
  })
}

// ── 승진 (PROMOTION) ───────────────────────────────────────
async function executePromotion(
  tx: TxClient,
  row: ValidatedRow,
  context: AssignmentContext,
  notifications: OffCycleNotification[],
) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)
  const { current } = context
  if (current.effectiveDate >= effectiveDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 발령일이 현재 발령일 이전입니다`)
  }

  await closeAssignment(tx, context, effectiveDate, effectiveDate)

  await tx.employeeAssignment.create({
    data: {
      employeeId: row.employeeId,
      effectiveDate,
      endDate: null,
      changeType: 'PROMOTION',
      companyId: current.companyId,
      departmentId: data.departmentId ?? current.departmentId,
      jobGradeId: data.jobGradeId,
      jobCategoryId: data.jobCategoryId ?? current.jobCategoryId,
      positionId: data.positionId ?? current.positionId,
      employmentType: current.employmentType,
      workLocationId: data.workLocationId ?? current.workLocationId,
      contractType: current.contractType,
      status: current.status,
      isPrimary: true,
      reason: data.reason ?? null,
    },
  })

  notifications.push({
    companyId: current.companyId,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    reason: 'PROMOTION',
  })
}

// ── 법인 전환 (ENTITY TRANSFER / COMPANY_TRANSFER) ─────────
async function executeEntityTransfer(
  tx: TxClient,
  row: ValidatedRow,
  context: AssignmentContext,
  notifications: OffCycleNotification[],
) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)
  const { current } = context
  if (current.effectiveDate >= effectiveDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 발령일이 현재 발령일 이전입니다`)
  }

  await closeAssignment(tx, context, effectiveDate, effectiveDate)

  await tx.employeeAssignment.create({
    data: {
      employeeId: row.employeeId,
      effectiveDate,
      endDate: null,
      changeType: 'COMPANY_TRANSFER',
      companyId: data.companyId,
      departmentId: data.departmentId,
      // 법인 스코프 FK(직급/직무군/직위/근무지)는 구법인 값을 승계하지 않는다 —
      // 타법인 참조가 새 발령에 박히는 것 차단 (Codex G1 r2). 새 법인 값은 CSV 코드로만.
      jobGradeId: data.jobGradeId ?? null,
      jobCategoryId: null,
      positionId: data.positionId ?? null,
      employmentType: data.employmentType ?? current.employmentType,
      workLocationId: data.workLocationId ?? null,
      contractType: current.contractType,
      status: current.status,
      isPrimary: true,
      reason: data.reason ?? null,
    },
  })

  notifications.push({
    companyId: data.companyId,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    reason: 'ROLE_CHANGE',
  })
}

// ── 퇴직 (TERMINATION) ────────────────────────────────────
async function executeTermination(
  tx: TxClient,
  row: ValidatedRow,
  context: AssignmentContext,
) {
  const data = row.data as Record<string, string>
  const lastWorkingDate = parseDateOnly(data.lastWorkingDate)
  const { current } = context
  if (current.effectiveDate >= lastWorkingDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 퇴직일이 현재 발령일 이전입니다`)
  }

  // 새 발령: effectiveDate = lastWorkingDate + 1 day
  const newEffective = new Date(lastWorkingDate.getTime())
  newEffective.setUTCDate(newEffective.getUTCDate() + 1)
  await closeAssignment(tx, context, newEffective, newEffective)

  // resignType에 따라 status 결정
  const resignType = data.resignType as string
  const resignedStatuses = ['VOLUNTARY', 'RETIREMENT']
  const newStatus = resignedStatuses.includes(resignType) ? 'RESIGNED' : 'TERMINATED'

  await tx.employeeAssignment.create({
    data: {
      employeeId: row.employeeId,
      effectiveDate: newEffective,
      endDate: null,
      changeType: 'STATUS_CHANGE',
      companyId: current.companyId,
      departmentId: current.departmentId,
      jobGradeId: current.jobGradeId,
      jobCategoryId: current.jobCategoryId,
      positionId: current.positionId,
      employmentType: current.employmentType,
      workLocationId: current.workLocationId,
      contractType: current.contractType,
      status: newStatus,
      isPrimary: true,
      reason: data.reason ?? `일괄 퇴직 처리 (${resignType})`,
    },
  })

  // Employee.resignDate 업데이트
  await tx.employee.update({
    where: { id: row.employeeId },
    data: { resignDate: lastWorkingDate },
  })

  // OffboardingChecklist 조회 — 법인의 기본 체크리스트 사용
  const checklist = await tx.offboardingChecklist.findFirst({
    where: { companyId: current.companyId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  if (checklist) {
    await tx.employeeOffboarding.create({
      data: {
        employeeId: row.employeeId,
        checklistId: checklist.id,
        // 소유 법인 = 시작 시점 primary assignment 법인 (테넌트 스코핑 SSOT)
        companyId: current.companyId,
        resignType: resignType as 'VOLUNTARY' | 'INVOLUNTARY' | 'RETIREMENT' | 'CONTRACT_END' | 'MUTUAL_AGREEMENT',
        lastWorkingDate,
        resignReasonCode: data.resignReasonCode ?? null,
        resignReasonDetail: data.reason ?? null,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })
  }
}

// ── 보상 변경 (COMPENSATION) ──────────────────────────────
async function executeCompensation(
  tx: TxClient,
  row: ValidatedRow,
  current: EmployeeAssignment,
) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)

  const newBaseSalary = parseFloat(data.newBaseSalary)
  const currency = data.currency ?? 'KRW'

  // 이전 보상 이력에서 현재 연봉 조회
  const latestComp = await tx.compensationHistory.findFirst({
    where: {
      employeeId: row.employeeId,
      companyId: current.companyId,
      effectiveDate: { lte: effectiveDate },
    },
    orderBy: { effectiveDate: 'desc' },
  })
  const previousBaseSalary = latestComp
    ? Number(latestComp.newBaseSalary)
    : 0

  const changePct = previousBaseSalary > 0
    ? ((newBaseSalary - previousBaseSalary) / previousBaseSalary) * 100
    : 0

  // SalaryBand 기준 예외 판단
  let isException = false
  if (current.jobGradeId) {
    const bands = await tx.salaryBand.findMany({
      where: {
        companyId: current.companyId,
        jobGradeId: current.jobGradeId,
        effectiveFrom: { lte: effectiveDate },
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: effectiveDate } },
            ],
          },
          current.jobCategoryId === null
            ? { jobCategoryId: null }
            : {
                OR: [
                  { jobCategoryId: current.jobCategoryId },
                  { jobCategoryId: null },
                ],
              },
        ],
        deletedAt: null,
      },
    })
    const band = selectSalaryBand(
      bands,
      current.jobGradeId,
      current.jobCategoryId,
    )
    if (band) {
      isException = newBaseSalary < Number(band.minSalary) || newBaseSalary > Number(band.maxSalary)
    }
  }

  await tx.compensationHistory.create({
    data: {
      employeeId: row.employeeId,
      companyId: current.companyId,
      changeType: (data.changeType as 'ANNUAL_INCREASE' | 'PROMOTION' | 'MARKET_ADJUSTMENT' | 'OTHER') ?? 'OTHER',
      previousBaseSalary,
      newBaseSalary,
      currency,
      changePct,
      effectiveDate,
      reason: data.reason ?? null,
      isException,
      exceptionReason: isException ? `SalaryBand 범위 초과 (일괄 보상)` : null,
    },
  })
}

// ── 메인 실행기 ─────────────────────────────────────────────

/** 실행 감사로그 컨텍스트 — 발령과 같은 트랜잭션에서 기록 (원자성, S276) */
export interface ExecuteAuditContext {
  actorEmployeeId: string
  companyId: string
  authorizedCompanyId?: string
  ip?: string
  userAgent?: string
}

export async function executeMovements(
  type: MovementType,
  rows: ValidatedRow[],
  fileName: string,
  audit: ExecuteAuditContext,
) {
  const executionId = crypto.randomUUID()
  const duplicateEmployeeId = rows.find(
    (row, index) => rows.findIndex((candidate) => candidate.employeeId === row.employeeId) !== index,
  )?.employeeId
  if (duplicateEmployeeId) {
    throw badRequest('같은 직원에 대한 일괄 발령을 한 파일에서 중복 실행할 수 없습니다.')
  }

  const usesAssignmentWriter = type !== 'compensation'
  const runTransaction = async () => {
    const sourceHints = usesAssignmentWriter
      ? await prisma.employeeAssignment.findMany({
          where: {
            employeeId: { in: rows.map((row) => row.employeeId) },
            isPrimary: true,
            endDate: null,
          },
        })
      : []
    const hintByEmployee = new Map(
      sourceHints.map((assignment) => [assignment.employeeId, assignment]),
    )
    const departmentScopes: PrimaryAssignmentDepartmentScope[] = []
    const masterDataScopes: PrimaryAssignmentMasterData[] = []
    if (usesAssignmentWriter) {
      for (const row of rows) {
        const source = hintByEmployee.get(row.employeeId)
        if (!source) {
          throw badRequest(`[Row ${row.rowNum}] ${row.employeeName}: 활성 발령이 없습니다`)
        }
        const data = row.data as Record<string, string>
        departmentScopes.push({
          companyId: source.companyId,
          departmentId: source.departmentId,
        })
        if (type === 'entity-transfer') {
          departmentScopes.push({ companyId: data.companyId, departmentId: data.departmentId })
          masterDataScopes.push({
            companyId: data.companyId,
            jobGradeId: data.jobGradeId ?? null,
            jobCategoryId: null,
            positionId: data.positionId ?? null,
            workLocationId: data.workLocationId ?? null,
          })
        } else if (type === 'transfer') {
          departmentScopes.push({ companyId: source.companyId, departmentId: data.departmentId })
          masterDataScopes.push({
            companyId: source.companyId,
            jobGradeId: data.jobGradeId ?? source.jobGradeId,
            jobCategoryId: data.jobCategoryId ?? source.jobCategoryId,
            positionId: data.positionId ?? source.positionId,
            workLocationId: data.workLocationId ?? source.workLocationId,
          })
        } else {
          departmentScopes.push({
            companyId: source.companyId,
            departmentId: data.departmentId ?? source.departmentId,
          })
          masterDataScopes.push({
            companyId: source.companyId,
            jobGradeId: type === 'promotion' ? data.jobGradeId : source.jobGradeId,
            jobCategoryId: data.jobCategoryId ?? source.jobCategoryId,
            positionId: data.positionId ?? source.positionId,
            workLocationId: data.workLocationId ?? source.workLocationId,
          })
        }
      }
    }

    return prisma.$transaction(
      async (tx) => {
        const contexts = new Map<string, AssignmentContext>()
        if (usesAssignmentWriter) {
          const lockedDepartmentKeys = await acquirePrimaryAssignmentDepartmentLocks(
            tx,
            departmentScopes,
          )
          await revalidatePrimaryAssignmentDepartments(tx, departmentScopes)
          await revalidatePrimaryAssignmentMasterDataSet(tx, masterDataScopes)
          await acquirePrimaryAssignmentEmployeeLocks(
            tx,
            rows.map((row) => row.employeeId),
          )
          for (const row of rows) {
            const timeline = await readPrimaryAssignmentTimeline(tx, row.employeeId)
            const current = getOpenPrimaryAssignment(timeline)
            if (!current) {
              throw badRequest(`[Row ${row.rowNum}] ${row.employeeName}: 활성 발령이 없습니다`)
            }
            assertPrimaryAssignmentSourceScopeLocked(lockedDepartmentKeys, current)
            const sourceHint = hintByEmployee.get(row.employeeId)
            if (
              !sourceHint ||
              sourceHint.id !== current.id ||
              sourceHint.updatedAt.getTime() !== current.updatedAt.getTime()
            ) {
              throw new AppError(
                409,
                PRIMARY_ASSIGNMENT_RETRY_CODE,
                `[Row ${row.rowNum}] ${row.employeeName}: 주 발령 후보가 변경되었습니다.`,
                { employeeId: row.employeeId },
              )
            }
            contexts.set(row.employeeId, { current, timeline })
          }
        } else {
          await acquirePrimaryAssignmentEmployeeLocks(
            tx,
            rows.map((row) => row.employeeId),
          )
          for (const row of rows) {
            const timeline = await readPrimaryAssignmentTimeline(tx, row.employeeId)
            const data = row.data as Record<string, string>
            const effectiveDate = parseDateOnly(data.effectiveDate)
            const current = getPrimaryAssignmentAtDate(timeline, effectiveDate)
            if (!current) {
              throw badRequest(
                `[Row ${row.rowNum}] ${row.employeeName}: 보상 적용일의 주 발령이 없습니다`,
              )
            }
            if (
              audit.authorizedCompanyId &&
              current.companyId !== audit.authorizedCompanyId
            ) {
              throw badRequest(
                `[Row ${row.rowNum}] ${row.employeeName}: 보상 적용일의 소속 법인에 대한 권한이 없습니다`,
              )
            }
            contexts.set(row.employeeId, { current, timeline })
          }
        }

        let applied = 0
        const notifications: OffCycleNotification[] = []
        for (const row of rows) {
          // Re-validation (Gemini Patch 3): 직원 존재 및 활성 발령 확인
          const employee = await tx.employee.findUnique({
            where: { id: row.employeeId },
            select: { id: true, deletedAt: true },
          })
          if (!employee || employee.deletedAt) {
            throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 직원을 찾을 수 없습니다`)
          }

          switch (type) {
            case 'transfer':
              await executeTransfer(tx, row, contexts.get(row.employeeId)!)
              break
            case 'promotion':
              await executePromotion(tx, row, contexts.get(row.employeeId)!, notifications)
              break
            case 'entity-transfer':
              await executeEntityTransfer(tx, row, contexts.get(row.employeeId)!, notifications)
              break
            case 'termination':
              await executeTermination(tx, row, contexts.get(row.employeeId)!)
              break
            case 'compensation':
              await executeCompensation(
                tx,
                row,
                contexts.get(row.employeeId)!.current,
              )
              break
            default:
              throw new Error(`지원하지 않는 발령 유형: ${type}`)
          }

          applied += 1
        }

        // 감사 로그를 발령과 같은 트랜잭션에서 기록 — audit 실패 시 발령도 롤백 (원자성).
        // 라우트 사후 fire-and-forget은 audit 유실 시 실행 이력이 사라짐 (S276 Codex r2-2)
        await tx.auditLog.create({
          data: {
            actorId: audit.actorEmployeeId,
            action: 'bulk_movement.execute',
            resourceType: 'bulk_movement',
            resourceId: executionId,
            companyId: audit.companyId,
            changes: {
              movementType: type,
              fileName,
              totalRows: rows.length,
              applied,
              targets: rows.map((r) => ({
                employeeId: r.employeeId,
                employeeNo: r.employeeNo,
                effectiveDate: (r.data.effectiveDate as string | undefined) ?? null,
              })),
            },
            ipAddress: audit.ip ?? null,
            userAgent: audit.userAgent ?? null,
            sensitivityLevel: 'HIGH',
          },
        })
        return { applied, notifications }
      },
      { timeout: 60_000 },
    )
  }

  const result = usesAssignmentWriter
    ? await withPrimaryAssignmentRetry(runTransaction)
    : await runTransaction()
  for (const notification of result.notifications) {
    void notifyHrAdminsForOffCycle(
      notification.companyId,
      notification.employeeId,
      notification.employeeName,
      notification.reason,
    )
  }

  return { success: true, applied: result.applied, executionId }
}
