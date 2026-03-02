// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Group Members API
// GET /api/v1/shift-groups/[id]/members — List members
// PUT /api/v1/shift-groups/[id]/members — Bulk assign members
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { shiftGroupMemberSchema } from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

// ─── GET: List members of a shift group ─────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      // Verify group exists
      const group = await prisma.shiftGroup.findFirst({
        where: { id, ...companyFilter },
      })

      if (!group) {
        throw notFound('교대 그룹을 찾을 수 없습니다.')
      }

      const members = await prisma.shiftGroupMember.findMany({
        where: {
          shiftGroupId: id,
          removedAt: null,
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
                select: { departmentId: true, jobGradeId: true },
              },
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      })

      return apiSuccess({
        shiftGroupId: id,
        groupName: group.name,
        memberCount: members.length,
        members: members.map((m) => ({
          id: m.id,
          employeeId: m.employeeId,
          employeeName: m.employee?.name,
          employeeNo: m.employee?.employeeNo,
          departmentId: m.employee?.assignments?.[0]?.departmentId,
          jobGradeId: m.employee?.assignments?.[0]?.jobGradeId,
          assignedAt: m.assignedAt,
        })),
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── PUT: Bulk assign members (upsert: add new, remove old) ─

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params
      const body = await req.json()

      // Override shiftGroupId from URL param
      const parsed = shiftGroupMemberSchema.safeParse({
        ...body,
        shiftGroupId: id,
      })

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      // Verify group exists
      const group = await prisma.shiftGroup.findFirst({
        where: { id, ...companyFilter },
      })

      if (!group) {
        throw notFound('교대 그룹을 찾을 수 없습니다.')
      }

      const { employeeIds } = parsed.data
      const newEmployeeIdSet = new Set(employeeIds)

      // Get current active members
      const currentMembers = await prisma.shiftGroupMember.findMany({
        where: { shiftGroupId: id, removedAt: null },
      })

      const currentEmployeeIdSet = new Set(currentMembers.map((m) => m.employeeId))

      // Determine adds and removes
      const toAdd = employeeIds.filter((eid) => !currentEmployeeIdSet.has(eid))
      const toRemove = currentMembers.filter((m) => !newEmployeeIdSet.has(m.employeeId))

      await prisma.$transaction(async (tx) => {
        // Remove members no longer in the list
        if (toRemove.length > 0) {
          await tx.shiftGroupMember.updateMany({
            where: {
              id: { in: toRemove.map((m) => m.id) },
            },
            data: { removedAt: new Date() },
          })
        }

        // Add new members (upsert to handle previously removed members)
        for (const employeeId of toAdd) {
          await tx.shiftGroupMember.upsert({
            where: {
              shiftGroupId_employeeId: {
                shiftGroupId: id,
                employeeId,
              },
            },
            update: {
              removedAt: null,
              assignedAt: new Date(),
            },
            create: {
              shiftGroupId: id,
              employeeId,
            },
          })
        }
      })

      // Return updated member list
      const updatedMembers = await prisma.shiftGroupMember.findMany({
        where: { shiftGroupId: id, removedAt: null },
        include: {
          employee: {
            select: { id: true, name: true, employeeNo: true },
          },
        },
        orderBy: { assignedAt: 'asc' },
      })

      return apiSuccess({
        shiftGroupId: id,
        memberCount: updatedMembers.length,
        added: toAdd.length,
        removed: toRemove.length,
        members: updatedMembers.map((m) => ({
          id: m.id,
          employeeId: m.employeeId,
          employeeName: m.employee.name,
          employeeNo: m.employee.employeeNo,
          assignedAt: m.assignedAt,
        })),
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.UPDATE),
)
