// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Movement Executor
// All-or-Nothing 트랜잭션으로 대량 인사발령 실행
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { parseDateOnly } from '@/lib/timezone'
import type { MovementType, ValidatedRow } from './types'

// Prisma 7 interactive transaction client 타입
type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ── 현재 active assignment 조회 (트랜잭션 내부용) ──────────
async function getActiveAssignment(tx: TxClient, employeeId: string) {
  return tx.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      endDate: null,
    },
  })
}

// ── 현재 assignment 종료 ────────────────────────────────────
async function closeAssignment(tx: TxClient, employeeId: string, endDate: Date) {
  await tx.employeeAssignment.updateMany({
    where: {
      employeeId,
      isPrimary: true,
      endDate: null,
    },
    data: { endDate },
  })
}

// ── 부서 이동 (TRANSFER) ────────────────────────────────────
async function executeTransfer(tx: TxClient, row: ValidatedRow) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)
  const current = await getActiveAssignment(tx, row.employeeId)
  if (!current) throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 활성 발령이 없습니다`)
  if (current.effectiveDate >= effectiveDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 발령일이 현재 발령일 이전입니다`)
  }

  await closeAssignment(tx, row.employeeId, effectiveDate)

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
async function executePromotion(tx: TxClient, row: ValidatedRow) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)
  const current = await getActiveAssignment(tx, row.employeeId)
  if (!current) throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 활성 발령이 없습니다`)
  if (current.effectiveDate >= effectiveDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 발령일이 현재 발령일 이전입니다`)
  }

  await closeAssignment(tx, row.employeeId, effectiveDate)

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
}

// ── 법인 전환 (ENTITY TRANSFER / COMPANY_TRANSFER) ─────────
async function executeEntityTransfer(tx: TxClient, row: ValidatedRow) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)
  const current = await getActiveAssignment(tx, row.employeeId)
  if (!current) throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 활성 발령이 없습니다`)
  if (current.effectiveDate >= effectiveDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 발령일이 현재 발령일 이전입니다`)
  }

  await closeAssignment(tx, row.employeeId, effectiveDate)

  await tx.employeeAssignment.create({
    data: {
      employeeId: row.employeeId,
      effectiveDate,
      endDate: null,
      changeType: 'COMPANY_TRANSFER',
      companyId: data.companyId,
      departmentId: data.departmentId,
      jobGradeId: data.jobGradeId ?? current.jobGradeId,
      jobCategoryId: data.jobCategoryId ?? current.jobCategoryId,
      positionId: data.positionId ?? null,
      employmentType: data.employmentType ?? current.employmentType,
      workLocationId: data.workLocationId ?? null,
      contractType: current.contractType,
      status: current.status,
      isPrimary: true,
      reason: data.reason ?? null,
    },
  })
}

// ── 퇴직 (TERMINATION) ────────────────────────────────────
async function executeTermination(tx: TxClient, row: ValidatedRow) {
  const data = row.data as Record<string, string>
  const lastWorkingDate = parseDateOnly(data.lastWorkingDate)
  const current = await getActiveAssignment(tx, row.employeeId)
  if (!current) throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 활성 발령이 없습니다`)
  if (current.effectiveDate >= lastWorkingDate) {
    throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 퇴직일이 현재 발령일 이전입니다`)
  }

  // 현재 발령 종료 (endDate = lastWorkingDate)
  await closeAssignment(tx, row.employeeId, lastWorkingDate)

  // 새 발령: effectiveDate = lastWorkingDate + 1 day
  const newEffective = new Date(lastWorkingDate.getTime())
  newEffective.setUTCDate(newEffective.getUTCDate() + 1)

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
    where: { companyId: current.companyId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (checklist) {
    await tx.employeeOffboarding.create({
      data: {
        employeeId: row.employeeId,
        checklistId: checklist.id,
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
async function executeCompensation(tx: TxClient, row: ValidatedRow) {
  const data = row.data as Record<string, string>
  const effectiveDate = parseDateOnly(data.effectiveDate)
  const current = await getActiveAssignment(tx, row.employeeId)
  if (!current) throw new Error(`[Row ${row.rowNum}] ${row.employeeName}: 활성 발령이 없습니다`)

  const newBaseSalary = parseFloat(data.newBaseSalary)
  const currency = data.currency ?? 'KRW'

  // 이전 보상 이력에서 현재 연봉 조회
  const latestComp = await tx.compensationHistory.findFirst({
    where: { employeeId: row.employeeId },
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
    const band = await tx.salaryBand.findFirst({
      where: {
        companyId: current.companyId,
        jobGradeId: current.jobGradeId,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveDate } },
        ],
        deletedAt: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    })
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
export async function executeMovements(
  type: MovementType,
  rows: ValidatedRow[],
  executedBy: string,
  userCompanyId: string,
  fileName: string,
) {
  const executionId = crypto.randomUUID()
  let applied = 0

  await prisma.$transaction(
    async (tx) => {
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
            await executeTransfer(tx, row)
            break
          case 'promotion':
            await executePromotion(tx, row)
            break
          case 'entity-transfer':
            await executeEntityTransfer(tx, row)
            break
          case 'termination':
            await executeTermination(tx, row)
            break
          case 'compensation':
            await executeCompensation(tx, row)
            break
          default:
            throw new Error(`지원하지 않는 발령 유형: ${type}`)
        }

        applied++
      }
    },
    { timeout: 60_000 },
  )

  // Audit log: 트랜잭션 외부에서 기록 (project convention)
  await prisma.$executeRawUnsafe(
    `INSERT INTO bulk_movement_executions (id, company_id, movement_type, file_name, total_rows, applied_rows, status, executed_by, executed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    executionId,
    userCompanyId,
    type,
    fileName,
    rows.length,
    applied,
    'COMPLETED',
    executedBy,
  )

  return { success: true, applied, executionId }
}
