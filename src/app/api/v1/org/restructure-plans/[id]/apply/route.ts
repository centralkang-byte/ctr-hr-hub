// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/org/restructure-plans/[id]/apply
// B8-1 Task 6: 조직 개편 플랜 적용 (Effective Dating)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<Record<string, string>> }

// ─── Change type definitions (mirrors RestructureModal) ─────

interface OrgChange {
  id: string
  type: 'create' | 'move' | 'merge' | 'rename' | 'close' | 'transfer_employee'
  // create
  newDeptName?: string
  newDeptCode?: string
  newDeptParentId?: string | null
  // move
  deptId?: string
  targetParentId?: string | null
  // merge
  sourceDeptId?: string
  targetDeptId?: string
  // rename
  renameDeptId?: string
  newName?: string
  newNameEn?: string
  // close
  closeDeptId?: string
  // transfer_employee
  employeeId?: string
  fromDeptId?: string
  toDeptId?: string
}

// ─── POST /api/v1/org/restructure-plans/[id]/apply ──────────

export const POST = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params

    const plan = await prisma.orgRestructurePlan.findUnique({ where: { id } })
    if (!plan) throw notFound('개편 계획을 찾을 수 없습니다.')

    if (user.role !== ROLE.SUPER_ADMIN && plan.companyId !== user.companyId) {
      throw notFound('개편 계획을 찾을 수 없습니다.')
    }
    if (plan.appliedAt) {
      throw badRequest('이미 적용된 계획입니다.')
    }

    const changes = plan.changes as unknown as OrgChange[]
    const effectiveDate = plan.effectiveDate

    try {
      await prisma.$transaction(async (tx) => {
        for (const change of changes) {
          switch (change.type) {
            // ── 1. 부서 신설 ────────────────────────────────────────
            case 'create': {
              if (!change.newDeptName || !change.newDeptCode) break

              // Determine level from parent
              let level = 0
              if (change.newDeptParentId) {
                const parent = await tx.department.findUnique({
                  where: { id: change.newDeptParentId },
                  select: { level: true },
                })
                if (parent) level = parent.level + 1
              }

              await tx.department.create({
                data: {
                  companyId: plan.companyId,
                  name: change.newDeptName,
                  code: change.newDeptCode,
                  level,
                  parentId: change.newDeptParentId ?? null,
                  deletedAt: null,
                  sortOrder: 999,
                },
              })
              break
            }

            // ── 2. 부서 이동 ────────────────────────────────────────
            case 'move': {
              if (!change.deptId) break

              // Determine new level
              let newLevel = 0
              if (change.targetParentId) {
                const parent = await tx.department.findUnique({
                  where: { id: change.targetParentId },
                  select: { level: true },
                })
                if (parent) newLevel = parent.level + 1
              }

              await tx.department.update({
                where: { id: change.deptId, companyId: plan.companyId },
                data: { parentId: change.targetParentId ?? null, level: newLevel },
              })
              break
            }

            // ── 3. 부서 통합 ────────────────────────────────────────
            case 'merge': {
              if (!change.sourceDeptId || !change.targetDeptId) break

              // Move all active employees from source to target — updateMany + createMany로 N+1 제거
              const sourceEmployees = await tx.employeeAssignment.findMany({
                where: {
                  departmentId: change.sourceDeptId,
                  endDate: null,
                  isPrimary: true,
                },
              })

              if (sourceEmployees.length > 0) {
                await tx.employeeAssignment.updateMany({
                  where: { id: { in: sourceEmployees.map((a) => a.id) } },
                  data: { endDate: effectiveDate },
                })
                await tx.employeeAssignment.createMany({
                  data: sourceEmployees.map((assignment) => ({
                    employeeId: assignment.employeeId,
                    effectiveDate,
                    companyId: assignment.companyId,
                    departmentId: change.targetDeptId!,
                    jobGradeId: assignment.jobGradeId,
                    jobCategoryId: assignment.jobCategoryId,
                    employmentType: assignment.employmentType,
                    contractType: assignment.contractType,
                    status: assignment.status,
                    positionId: assignment.positionId,
                    isPrimary: true,
                    changeType: 'REORGANIZATION',
                    reason: `조직 개편: ${plan.title}`,
                  })),
                })
              }

              // Mark source department inactive
              await tx.department.update({
                where: { id: change.sourceDeptId, companyId: plan.companyId },
                data: { deletedAt: new Date() },
              })
              break
            }

            // ── 4. 부서 명칭 변경 ───────────────────────────────────
            case 'rename': {
              if (!change.renameDeptId || !change.newName) break

              await tx.department.update({
                where: { id: change.renameDeptId, companyId: plan.companyId },
                data: {
                  name: change.newName,
                  nameEn: change.newNameEn ?? undefined,
                },
              })
              break
            }

            // ── 5. 부서 폐지 ────────────────────────────────────────
            case 'close': {
              if (!change.closeDeptId) break

              // Find parent dept for reassignment
              const closingDept = await tx.department.findUnique({
                where: { id: change.closeDeptId },
                select: { parentId: true },
              })

              // Move employees to parent dept — updateMany + createMany로 N+1 제거
              const closingEmployees = await tx.employeeAssignment.findMany({
                where: {
                  departmentId: change.closeDeptId,
                  endDate: null,
                  isPrimary: true,
                },
              })

              if (closingEmployees.length > 0) {
                await tx.employeeAssignment.updateMany({
                  where: { id: { in: closingEmployees.map((a) => a.id) } },
                  data: { endDate: effectiveDate },
                })
                await tx.employeeAssignment.createMany({
                  data: closingEmployees.map((assignment) => ({
                    employeeId: assignment.employeeId,
                    effectiveDate,
                    companyId: assignment.companyId,
                    departmentId: closingDept?.parentId ?? null,
                    jobGradeId: assignment.jobGradeId,
                    jobCategoryId: assignment.jobCategoryId,
                    employmentType: assignment.employmentType,
                    contractType: assignment.contractType,
                    status: assignment.status,
                    positionId: assignment.positionId,
                    isPrimary: true,
                    changeType: 'REORGANIZATION',
                    reason: `조직 개편(폐지): ${plan.title}`,
                  })),
                })
              }

              await tx.department.update({
                where: { id: change.closeDeptId, companyId: plan.companyId },
                data: { deletedAt: new Date() },
              })
              break
            }

            // ── 6. 인원 이동 ────────────────────────────────────────
            case 'transfer_employee': {
              if (!change.employeeId || !change.toDeptId) break

              const currentAssignment = await tx.employeeAssignment.findFirst({
                where: {
                  employeeId: change.employeeId,
                  endDate: null,
                  isPrimary: true,
                },
                orderBy: { effectiveDate: 'desc' },
              })

              if (!currentAssignment) break

              // End current assignment
              await tx.employeeAssignment.update({
                where: { id: currentAssignment.id },
                data: { endDate: effectiveDate },
              })

              // Create new assignment
              await tx.employeeAssignment.create({
                data: {
                  employeeId: change.employeeId,
                  effectiveDate,
                  companyId: currentAssignment.companyId,
                  departmentId: change.toDeptId,
                  jobGradeId: currentAssignment.jobGradeId,
                  jobCategoryId: currentAssignment.jobCategoryId,
                  employmentType: currentAssignment.employmentType,
                  contractType: currentAssignment.contractType,
                  status: currentAssignment.status,
                  positionId: currentAssignment.positionId,
                  isPrimary: true,
                  changeType: 'TRANSFER',
                  reason: `조직 개편: ${plan.title}`,
                },
              })
              break
            }
          }
        }

        // Record in OrgChangeHistory
        await tx.orgChangeHistory.create({
          data: {
            companyId: plan.companyId,
            changeType: 'RESTRUCTURE',
            effectiveDate,
            reason: plan.title,
            approvedById: user.employeeId,
          },
        })

        // Mark plan as applied
        await tx.orgRestructurePlan.update({
          where: { id: plan.id },
          data: {
            status: 'applied',
            appliedAt: new Date(),
            approvedById: plan.approvedById ?? user.employeeId,
            approvedAt: plan.approvedAt ?? new Date(),
          },
        })
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.restructure.apply',
        resourceType: 'org_restructure_plan',
        resourceId: plan.id,
        companyId: plan.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ applied: true, planId: plan.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.APPROVE),
)
