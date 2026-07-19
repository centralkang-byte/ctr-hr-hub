// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/entity-transfers/[id]/execute
// Execute the actual cross-company transfer after EXEC_APPROVED
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import {
  badRequest,
  conflict,
  handlePrismaError,
  isAppError,
  notFound,
} from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import {
  acquirePrimaryAssignmentDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks,
  assertPrimaryAssignmentReplacement,
  assertPrimaryAssignmentSourceScopeLocked,
  casPrimaryAssignment,
  getOpenPrimaryAssignment,
  readPrimaryAssignmentTimeline,
  revalidatePrimaryAssignmentDepartments,
  revalidatePrimaryAssignmentMasterData,
  withPrimaryAssignmentRetry,
} from '@/lib/employee/primary-assignment-writer'

// ─── PUT /api/v1/entity-transfers/[id]/execute ───────────

export const PUT = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    // Fetch the transfer with employee and data logs
    const transfer = await prisma.entityTransfer.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { companyId: true, departmentId: true, jobGradeId: true, jobCategoryId: true, employmentType: true, contractType: true, status: true, positionId: true },
            },
          },
        },
        dataLogs: true,
      },
    })

    if (!transfer) {
      throw notFound('전환 요청을 찾을 수 없습니다.')
    }

    // 출발 법인 소유 가드 — 비-SUPER는 출발 법인 HR만 실행(status 체크 앞 = 오라클 차단)
    if (user.role !== ROLE.SUPER_ADMIN && transfer.fromCompanyId !== user.companyId) {
      throw notFound('전환 요청을 찾을 수 없습니다.')
    }

    if (transfer.status !== 'EXEC_APPROVED') {
      throw badRequest(
        `현재 상태(${transfer.status})에서는 전환을 실행할 수 없습니다. 경영진 승인(EXEC_APPROVED) 상태여야 합니다.`,
      )
    }

    // stale 가드 — 직원의 현재 소속이 출발 법인과 일치해야(이미 이동된 직원 재실행 차단)
    const currentCompanyId = transfer.employee.assignments[0]?.companyId
    if (currentCompanyId && currentCompanyId !== transfer.fromCompanyId) {
      throw badRequest('직원의 현재 소속이 전환 출발 법인과 일치하지 않습니다.')
    }

    try {
      const result = await withPrimaryAssignmentRetry(async () => {
        const transferHint = await prisma.entityTransfer.findUnique({
          where: { id },
          select: {
            employeeId: true,
            toCompanyId: true,
            newDepartmentId: true,
          },
        })
        if (!transferHint) throw notFound('전환 요청을 찾을 수 없습니다.')
        const sourceHint = await prisma.employeeAssignment.findFirst({
          where: {
            employeeId: transferHint.employeeId,
            isPrimary: true,
            endDate: null,
          },
        })
        if (!sourceHint) throw badRequest('직원의 현재 주 발령을 찾을 수 없습니다.')
        const departmentScopes = [
          { companyId: sourceHint.companyId, departmentId: sourceHint.departmentId },
          {
            companyId: transferHint.toCompanyId,
            departmentId: transferHint.newDepartmentId,
          },
        ]

        return prisma.$transaction(async (tx) => {
          const lockedTransfer = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM entity_transfers
            WHERE id = ${id}
            FOR UPDATE
          `
          if (lockedTransfer.length !== 1) throw notFound('전환 요청을 찾을 수 없습니다.')

          const freshTransfer = await tx.entityTransfer.findUnique({
            where: { id },
            include: { dataLogs: { orderBy: { id: 'asc' } } },
          })
          if (!freshTransfer) throw notFound('전환 요청을 찾을 수 없습니다.')
          if (freshTransfer.status !== 'EXEC_APPROVED') {
            throw conflict('전환 요청 상태가 변경되었습니다.')
          }
          const processing = await tx.entityTransfer.updateMany({
            where: { id, status: 'EXEC_APPROVED' },
            data: { status: 'TRANSFER_PROCESSING' },
          })
          if (processing.count !== 1) throw conflict('전환 요청 상태가 변경되었습니다.')

          const lockedDepartmentKeys = await acquirePrimaryAssignmentDepartmentLocks(
            tx,
            departmentScopes,
          )
          await revalidatePrimaryAssignmentDepartments(tx, departmentScopes)
          assertPrimaryAssignmentSourceScopeLocked(lockedDepartmentKeys, {
            companyId: freshTransfer.toCompanyId,
            departmentId: freshTransfer.newDepartmentId,
          })
          await revalidatePrimaryAssignmentMasterData(tx, {
            companyId: freshTransfer.toCompanyId,
            jobGradeId: freshTransfer.newJobGradeId,
          })
          await acquirePrimaryAssignmentEmployeeLocks(tx, [freshTransfer.employeeId])
          const timeline = await readPrimaryAssignmentTimeline(tx, freshTransfer.employeeId)
          const current = getOpenPrimaryAssignment(timeline)
          if (!current) throw badRequest('직원의 현재 주 발령을 찾을 수 없습니다.')
          assertPrimaryAssignmentSourceScopeLocked(lockedDepartmentKeys, current)
          if (
            current.id !== sourceHint.id ||
            current.updatedAt.getTime() !== sourceHint.updatedAt.getTime()
          ) {
            throw conflict('직원의 주 발령 후보가 변경되었습니다.')
          }
          if (current.companyId !== freshTransfer.fromCompanyId) {
            throw conflict('직원의 현재 소속이 전환 출발 법인과 일치하지 않습니다.')
          }
          assertPrimaryAssignmentReplacement({
            timeline,
            replacedAssignmentId: current.id,
            closeDate: freshTransfer.transferDate,
            nextEffectiveDate: freshTransfer.transferDate,
          })

          const now = new Date()
          if (freshTransfer.newEmployeeNo) {
            await tx.employee.update({
              where: { id: freshTransfer.employeeId },
              data: { employeeNo: freshTransfer.newEmployeeNo },
            })
          }
          await casPrimaryAssignment(tx, current, { endDate: freshTransfer.transferDate })
          await tx.employeeAssignment.create({
            data: {
              employeeId: freshTransfer.employeeId,
              effectiveDate: freshTransfer.transferDate,
              endDate: null,
              changeType: 'TRANSFER_CROSS_COMPANY',
              companyId: freshTransfer.toCompanyId,
              departmentId: freshTransfer.newDepartmentId,
              jobGradeId: freshTransfer.newJobGradeId,
              jobCategoryId: null,
              employmentType: current.employmentType,
              contractType: current.contractType,
              status: current.status,
              positionId: null,
              workLocationId: null,
              isPrimary: true,
              reason: `Cross-company transfer from ${freshTransfer.fromCompanyId} to ${freshTransfer.toCompanyId}`,
              approvedById: user.employeeId,
            },
          })

          await tx.employeeHistory.create({
            data: {
              employeeId: freshTransfer.employeeId,
              changeType: 'TRANSFER_CROSS_COMPANY',
              fromCompanyId: freshTransfer.fromCompanyId,
              toCompanyId: freshTransfer.toCompanyId,
              fromDeptId: current.departmentId,
              toDeptId: freshTransfer.newDepartmentId,
              fromGradeId: current.jobGradeId,
              toGradeId: freshTransfer.newJobGradeId,
              effectiveDate: freshTransfer.transferDate,
              reason: `Cross-company transfer from ${freshTransfer.fromCompanyId} to ${freshTransfer.toCompanyId}`,
              approvedById: user.employeeId,
            },
          })

          for (const log of freshTransfer.dataLogs) {
            try {
              await tx.entityTransferDataLog.update({
                where: { id: log.id },
                data: { status: 'DATA_MIGRATED', migratedAt: now },
              })
            } catch (logError) {
              const errorMsg = logError instanceof Error
                ? logError.message
                : '데이터 마이그레이션 실패'
              await tx.entityTransferDataLog.update({
                where: { id: log.id },
                data: { status: 'DATA_FAILED', errorMsg },
              })
            }
          }

          const completed = await tx.entityTransfer.updateMany({
            where: { id, status: 'TRANSFER_PROCESSING' },
            data: { status: 'TRANSFER_COMPLETED', completedAt: now },
          })
          if (completed.count !== 1) throw conflict('전환 완료 상태가 변경되었습니다.')
          return tx.entityTransfer.findUniqueOrThrow({
            where: { id },
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  employeeNo: true,
                  assignments: {
                    where: { isPrimary: true, endDate: null },
                    take: 1,
                    select: { companyId: true, departmentId: true, jobGradeId: true },
                  },
                },
              },
              fromCompany: { select: { id: true, name: true } },
              toCompany: { select: { id: true, name: true } },
              dataLogs: true,
            },
          })
        })
      })

      // Check if any data logs failed
      const failedLogs = result?.dataLogs?.filter(
        (log) => log.status === 'DATA_FAILED',
      )
      if (failedLogs && failedLogs.length > 0) {
        return apiSuccess({
          ...result,
          _warnings: failedLogs.map(
            (log) => `${log.dataType}: ${log.errorMsg}`,
          ),
        })
      }

      return apiSuccess(result)
    } catch (error) {
      // The transaction already rolls TRANSFER_PROCESSING back to EXEC_APPROVED.
      // Keep the approved request retryable; cancellation is an explicit workflow action.
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
