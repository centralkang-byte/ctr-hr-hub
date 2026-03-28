// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/entity-transfers/[id]/execute
// Execute the actual cross-company transfer after EXEC_APPROVED
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

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

    if (transfer.status !== 'EXEC_APPROVED') {
      throw badRequest(
        `현재 상태(${transfer.status})에서는 전환을 실행할 수 없습니다. 경영진 승인(EXEC_APPROVED) 상태여야 합니다.`,
      )
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Set status to TRANSFER_PROCESSING
        await tx.entityTransfer.update({
          where: { id },
          data: { status: 'TRANSFER_PROCESSING' },
        })

        const employee = transfer.employee
        const currentAsgn = extractPrimaryAssignment(employee.assignments ?? []) as Record<string, any>
        const now = new Date()

        // 2. Update employeeNo if changed
        if (transfer.newEmployeeNo) {
          await tx.employee.update({
            where: { id: employee.id },
            data: { employeeNo: transfer.newEmployeeNo },
          })
        }

        // 3. Create new EmployeeAssignment for the target company
        // First close the current primary assignment
        await tx.employeeAssignment.updateMany({
          where: { employeeId: employee.id, isPrimary: true, endDate: null },
          data: { endDate: transfer.transferDate },
        })
        // Then create the new assignment for the target company
        await tx.employeeAssignment.create({
          data: {
            employeeId: employee.id,
            effectiveDate: transfer.transferDate,
            endDate: null,
            changeType: 'TRANSFER_CROSS_COMPANY',
            companyId: transfer.toCompanyId,
            departmentId: transfer.newDepartmentId ?? currentAsgn?.departmentId ?? null,
            jobGradeId: transfer.newJobGradeId ?? currentAsgn?.jobGradeId ?? null,
            jobCategoryId: currentAsgn?.jobCategoryId ?? null,
            employmentType: currentAsgn?.employmentType ?? 'FULL_TIME',
            contractType: currentAsgn?.contractType ?? null,
            status: currentAsgn?.status ?? 'ACTIVE',
            positionId: currentAsgn?.positionId ?? null,
            isPrimary: true,
            reason: `Cross-company transfer from ${transfer.fromCompanyId} to ${transfer.toCompanyId}`,
            approvedById: user.employeeId,
          },
        })

        // 4. Create EmployeeHistory record
        await tx.employeeHistory.create({
          data: {
            employeeId: employee.id,
            changeType: 'TRANSFER_CROSS_COMPANY',
            fromCompanyId: transfer.fromCompanyId,
            toCompanyId: transfer.toCompanyId,
            fromDeptId: currentAsgn?.departmentId ?? null,
            toDeptId: transfer.newDepartmentId ?? currentAsgn?.departmentId ?? null,
            fromGradeId: currentAsgn?.jobGradeId ?? null,
            toGradeId: transfer.newJobGradeId ?? currentAsgn?.jobGradeId ?? null,
            effectiveDate: transfer.transferDate,
            reason: `Cross-company transfer from ${transfer.fromCompanyId} to ${transfer.toCompanyId}`,
            approvedById: user.employeeId,
          },
        })

        // 4. Update each data log to DATA_MIGRATED
        for (const log of transfer.dataLogs) {
          try {
            await tx.entityTransferDataLog.update({
              where: { id: log.id },
              data: {
                status: 'DATA_MIGRATED',
                migratedAt: now,
              },
            })
          } catch (logError) {
            // If any data log migration fails, mark it as DATA_FAILED
            const errorMsg =
              logError instanceof Error
                ? logError.message
                : '데이터 마이그레이션 실패'
            await tx.entityTransferDataLog.update({
              where: { id: log.id },
              data: {
                status: 'DATA_FAILED',
                errorMsg,
              },
            })
          }
        }

        // 5. Set status to TRANSFER_COMPLETED
        const completed = await tx.entityTransfer.update({
          where: { id },
          data: {
            status: 'TRANSFER_COMPLETED',
            completedAt: now,
          },
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

        return completed
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
      // If the entire transaction fails, mark transfer as failed
      // and update data logs with error info
      const errorMsg =
        error instanceof Error ? error.message : '전환 실행 중 오류 발생'

      await prisma.entityTransfer
        .update({
          where: { id },
          data: {
            status: 'TRANSFER_CANCELLED',
            cancellationReason: `실행 실패: ${errorMsg}`,
          },
        })
        .catch(() => {
          // Swallow error if cleanup update also fails
        })

      throw badRequest(`전환 실행 중 오류가 발생했습니다: ${errorMsg}`)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
