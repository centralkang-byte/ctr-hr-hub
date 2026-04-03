// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Workflow Engine Helper (v3.2)
// 모든 승인 API: workflow_rules에서 현재 단계 조회 → 다음 승인자 결정
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/errors'
import type { ApproverType } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

// ─── Types ───────────────────────────────────────────────

export interface ResolvedApprover {
  employeeId: string
  name: string
  stepOrder: number
  approverType: ApproverType
}

// ─── Get Applicable Workflow ─────────────────────────────

export async function getApplicableWorkflow(
  companyId: string,
  workflowType: string,
  _context?: Record<string, unknown>,
) {
  const rule = await prisma.workflowRule.findFirst({
    where: {
      companyId,
      workflowType,
      deletedAt: null,
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  })

  return rule
}

// ─── Get Next Approver ───────────────────────────────────

export async function getNextApprover(
  workflowRuleId: string,
  currentStepOrder: number,
  employeeId: string,
): Promise<ResolvedApprover | null> {
  const nextStep = await prisma.workflowStep.findFirst({
    where: {
      ruleId: workflowRuleId,
      stepOrder: currentStepOrder + 1,
    },
  })

  if (!nextStep) return null

  // Resolve approver based on type
  const approver = await resolveApprover(
    nextStep.approverType as ApproverType,
    nextStep.stepOrder,
    nextStep.approverEmployeeId,
    nextStep.approverRoleId,
    employeeId,
  )
  return approver
}

// ─── Resolve Approver by Type ────────────────────────────
// B-3h: 겸직자도 Primary Assignment 기준으로만 결재라인 결정

async function resolveApprover(
  approverType: ApproverType,
  stepOrder: number,
  approverEmployeeId: string | null,
  approverRoleId: string | null,
  employeeId: string,
): Promise<ResolvedApprover | null> {
  switch (approverType) {
    case 'DIRECT_MANAGER': {
      // managerId no longer exists on Employee; use position-based manager lookup
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
            take: 1,
            include: {
              position: {
                include: {
                  reportsTo: {
                    include: {
                      assignments: {
                        where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
                        take: 1,
                        include: { employee: { select: { id: true, name: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
      const empPrimary = extractPrimaryAssignment(employee?.assignments ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrAssignments = (empPrimary as any)?.position?.reportsTo?.assignments ?? []
      const mgrPrimary = extractPrimaryAssignment(mgrAssignments)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const managerEmployee = (mgrPrimary as any)?.employee
      if (!managerEmployee) return null
      return {
        employeeId: managerEmployee.id,
        name: managerEmployee.name,
        stepOrder,
        approverType,
      }
    }

    case 'DEPARTMENT_HEAD': {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
            take: 1,
            include: { department: true },
          },
        },
      })
      const assignment = extractPrimaryAssignment(employee?.assignments ?? [])
      if (!assignment?.department) return null

      // Find department head (manager of the department's top-level)
      const deptHead = await prisma.employee.findFirst({
        where: {
          assignments: {
            some: {
              departmentId: assignment.departmentId,
              isPrimary: true,
              endDate: null,
              effectiveDate: { lte: new Date() },
            },
          },
          employeeRoles: {
            some: {
              role: { code: 'MANAGER' },
            },
          },
        },
        select: { id: true, name: true },
      })
      if (!deptHead) return null
      return {
        employeeId: deptHead.id,
        name: deptHead.name,
        stepOrder,
        approverType,
      }
    }

    case 'HR_ADMIN': {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
            take: 1,
            select: { companyId: true },
          },
        },
      })
      if (!employee) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const empCompanyId = (extractPrimaryAssignment(employee.assignments ?? []) as any)?.companyId

      const hrAdmin = await prisma.employee.findFirst({
        where: {
          assignments: {
            some: {
              companyId: empCompanyId,
              isPrimary: true,
              endDate: null,
              effectiveDate: { lte: new Date() },
            },
          },
          employeeRoles: {
            some: {
              role: { code: 'HR_ADMIN' },
            },
          },
        },
        select: { id: true, name: true },
      })
      if (!hrAdmin) return null
      return {
        employeeId: hrAdmin.id,
        name: hrAdmin.name,
        stepOrder,
        approverType,
      }
    }

    case 'SPECIFIC_EMPLOYEE': {
      if (!approverEmployeeId) return null
      const specific = await prisma.employee.findUnique({
        where: { id: approverEmployeeId },
        select: { id: true, name: true },
      })
      if (!specific) return null
      return {
        employeeId: specific.id,
        name: specific.name,
        stepOrder,
        approverType,
      }
    }

    case 'SPECIFIC_ROLE': {
      if (!approverRoleId) return null
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
            take: 1,
            select: { companyId: true },
          },
        },
      })
      if (!employee) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roleEmpCompanyId = (extractPrimaryAssignment(employee.assignments ?? []) as any)?.companyId

      // Find the role by ID, then find an employee with that role
      const roleHolder = await prisma.employee.findFirst({
        where: {
          assignments: {
            some: {
              companyId: roleEmpCompanyId,
              isPrimary: true,
              endDate: null,
              effectiveDate: { lte: new Date() },
            },
          },
          employeeRoles: {
            some: {
              roleId: approverRoleId,
            },
          },
        },
        select: { id: true, name: true },
      })
      if (!roleHolder) return null
      return {
        employeeId: roleHolder.id,
        name: roleHolder.name,
        stepOrder,
        approverType,
      }
    }

    default:
      return null
  }
}

// ─── Check if All Approval Steps are Complete ────────────

export async function isApprovalComplete(
  _entityId: string,
  workflowType: string,
  companyId: string,
): Promise<boolean> {
  const workflow = await getApplicableWorkflow(companyId, workflowType)
  if (!workflow) {
    throw notFound(`워크플로우를 찾을 수 없습니다: ${workflowType}`)
  }

  // Check workflow total steps — actual approval status will be checked
  // against the entity's approval records in the calling service
  return workflow.totalSteps === 0
}

// ─── Get Workflow Steps Summary ──────────────────────────

export async function getWorkflowStepsSummary(
  workflowRuleId: string,
): Promise<
  { stepOrder: number; approverType: ApproverType }[]
> {
  const steps = await prisma.workflowStep.findMany({
    where: { ruleId: workflowRuleId },
    orderBy: { stepOrder: 'asc' },
  })

  return steps.map((step) => ({
    stepOrder: step.stepOrder,
    approverType: step.approverType as ApproverType,
  }))
}
