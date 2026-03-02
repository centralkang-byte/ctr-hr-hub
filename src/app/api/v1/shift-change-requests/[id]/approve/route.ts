// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Change Request Approve/Reject API
// PUT /api/v1/shift-change-requests/[id]/approve
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { shiftChangeRequestActionSchema } from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params
      const body = await req.json()

      const { action } = body as { action?: string }

      if (!action || !['approve', 'reject'].includes(action)) {
        throw badRequest('action은 "approve" 또는 "reject" 이어야 합니다.')
      }

      const parsed = shiftChangeRequestActionSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      // Load the change request
      const changeRequest = await prisma.shiftChangeRequest.findFirst({
        where: { id, status: 'SCR_PENDING', ...companyFilter },
      })

      if (!changeRequest) {
        throw notFound('대기 중인 교대 변경 요청을 찾을 수 없습니다.')
      }

      if (action === 'reject') {
        const rejected = await prisma.shiftChangeRequest.update({
          where: { id },
          data: {
            status: 'SCR_REJECTED',
            approvedBy: user.employeeId,
            approvedAt: new Date(),
            rejectionReason: parsed.data.rejectionReason ?? null,
          },
          include: {
            requester: {
              select: { id: true, name: true, employeeNo: true },
            },
          },
        })

        return apiSuccess(rejected)
      }

      // action === 'approve'
      const result = await prisma.$transaction(async (tx) => {
        // 1. Update the change request status
        const approved = await tx.shiftChangeRequest.update({
          where: { id },
          data: {
            status: 'SCR_APPROVED',
            approvedBy: user.employeeId,
            approvedAt: new Date(),
          },
        })

        // 2. Swap schedules if target employee exists (shift swap)
        if (changeRequest.targetEmployeeId && changeRequest.requestedDate) {
          // Load requester's original schedule
          const requesterSchedule = await tx.shiftSchedule.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: changeRequest.requesterId,
                workDate: changeRequest.originalDate,
              },
            },
          })

          // Load target's schedule on the requested date
          const targetSchedule = await tx.shiftSchedule.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: changeRequest.targetEmployeeId,
                workDate: changeRequest.requestedDate,
              },
            },
          })

          if (requesterSchedule && targetSchedule) {
            // Swap: update requester's schedule with target's slot info
            await tx.shiftSchedule.update({
              where: { id: requesterSchedule.id },
              data: {
                slotIndex: targetSchedule.slotIndex,
                slotName: targetSchedule.slotName,
                startTime: targetSchedule.startTime,
                endTime: targetSchedule.endTime,
                breakMinutes: targetSchedule.breakMinutes,
                isNightShift: targetSchedule.isNightShift,
                status: 'SWAPPED',
                note: `교대 교환 승인 (요청 ID: ${id})`,
              },
            })

            // Swap: update target's schedule with requester's slot info
            await tx.shiftSchedule.update({
              where: { id: targetSchedule.id },
              data: {
                slotIndex: requesterSchedule.slotIndex,
                slotName: requesterSchedule.slotName,
                startTime: requesterSchedule.startTime,
                endTime: requesterSchedule.endTime,
                breakMinutes: requesterSchedule.breakMinutes,
                isNightShift: requesterSchedule.isNightShift,
                status: 'SWAPPED',
                note: `교대 교환 승인 (요청 ID: ${id})`,
              },
            })
          }
        } else if (changeRequest.requestedSlotIndex !== null) {
          // Simple slot change for the requester
          const requesterSchedule = await tx.shiftSchedule.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: changeRequest.requesterId,
                workDate: changeRequest.originalDate,
              },
            },
            include: {
              shiftPattern: true,
            },
          })

          if (requesterSchedule) {
            const slots = requesterSchedule.shiftPattern.slots as unknown as Array<{
              name: string
              start: string
              end: string
              breakMin: number
              nightPremium: boolean
            }>
            const newSlotIndex = changeRequest.requestedSlotIndex!
            const newSlot = slots[newSlotIndex]

            if (newSlot) {
              await tx.shiftSchedule.update({
                where: { id: requesterSchedule.id },
                data: {
                  slotIndex: newSlotIndex,
                  slotName: newSlot.name,
                  startTime: newSlot.start,
                  endTime: newSlot.end,
                  breakMinutes: newSlot.breakMin ?? 0,
                  isNightShift: newSlot.nightPremium ?? false,
                  status: 'SWAPPED',
                  note: `교대 슬롯 변경 승인 (요청 ID: ${id})`,
                },
              })
            }
          }
        }

        return approved
      })

      // Reload with relations
      const updated = await prisma.shiftChangeRequest.findUnique({
        where: { id: result.id },
        include: {
          requester: {
            select: { id: true, name: true, employeeNo: true },
          },
          targetEmployee: {
            select: { id: true, name: true, employeeNo: true },
          },
          approver: {
            select: { id: true, name: true },
          },
        },
      })

      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
