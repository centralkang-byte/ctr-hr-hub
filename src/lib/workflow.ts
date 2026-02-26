// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Workflow Engine Helper (v3.2)
// 모든 승인 API: workflow_rules에서 현재 단계 조회 → 다음 승인자 결정
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/errors'
import type { ApproverType } from '@/types'

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
      isActive: true,
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

async function resolveApprover(
  approverType: ApproverType,
  stepOrder: number,
  approverEmployeeId: string | null,
  approverRoleId: string | null,
  employeeId: string,
): Promise<ResolvedApprover | null> {
  switch (approverType) {
    case 'DIRECT_MANAGER': {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          managerId: true,
          manager: { select: { id: true, name: true } },
        },
      })
      if (!employee?.manager) return null
      return {
        employeeId: employee.manager.id,
        name: employee.manager.name,
        stepOrder,
        approverType,
      }
    }

    case 'DEPARTMENT_HEAD': {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          department: true,
        },
      })
      if (!employee?.department) return null

      // Find department head (manager of the department's top-level)
      const deptHead = await prisma.employee.findFirst({
        where: {
          departmentId: employee.departmentId,
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
        select: { companyId: true },
      })
      if (!employee) return null

      const hrAdmin = await prisma.employee.findFirst({
        where: {
          companyId: employee.companyId,
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
        select: { companyId: true },
      })
      if (!employee) return null

      // Find the role by ID, then find an employee with that role
      const roleHolder = await prisma.employee.findFirst({
        where: {
          companyId: employee.companyId,
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
