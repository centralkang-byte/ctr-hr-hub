// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Plan Creation (Shared Function)
// src/lib/onboarding/create-onboarding-plan.ts
//
// E-1 Enhanced:
//   - Computes dueDate for each task (hireDate + dueDaysAfter)
//   - Resolves assigneeId from assigneeType
//   - Auto-appends "Manager Sign-off" task at end
//
// 재사용처:
//   - src/lib/events/handlers/employee-hired.handler.ts (자동)
//   - (향후) 수동 생성 API route에서도 호출 가능
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
// import { getMilestoneFromDueDays } from './milestone-helpers'

export interface CreateOnboardingPlanInput {
  employeeId: string
  companyId: string
  hireDate: Date
  buddyId?: string
  /** 미지정 시 함수 내부에서 템플릿 자동 선택 */
  templateId?: string
}

export interface CreateOnboardingPlanResult {
  onboardingId: string
  templateId: string
  templateName: string
  taskCount: number
}

// ─── Assignee Resolution ──────────────────────────────────

interface TemplateTask {
  id: string
  assigneeType: string
  dueDaysAfter: number
  sortOrder: number
  title: string
  isRequired: boolean
}

async function resolveAssigneeId(
  assigneeType: string,
  employeeId: string,
  companyId: string,
  buddyId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma where clause dynamic type
): Promise<string | null> {
  try {
    switch (assigneeType) {
      case 'EMPLOYEE':
        return employeeId

      case 'BUDDY':
        return buddyId ?? null

      case 'MANAGER': {
        // Find manager via position hierarchy
        const empWithPos = await db.employee.findUnique({
          where: { id: employeeId },
          select: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              select: { position: { select: { reportsTo: { select: { employees: { select: { id: true }, take: 1 } } } } } },
              take: 1,
            },
          },
        })
        const managerId = empWithPos?.assignments?.[0]?.position?.reportsTo?.employees?.[0]?.id
        if (!managerId) console.warn(`[resolveAssigneeId] No manager found for employee ${employeeId}`)
        return managerId ?? null
      }

      case 'HR': {
        // Find an HR_ADMIN for the company
        const hrUser = await db.user.findFirst({
          where: { role: 'HR_ADMIN', employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } } },
          select: { employeeId: true },
        })
        return hrUser?.employeeId ?? null
      }

      case 'IT': {
        // Find an IT role user (simplified — look for any user tagged IT)
        const itUser = await db.user.findFirst({
          where: { role: 'EMPLOYEE', employee: { assignments: { some: { companyId, isPrimary: true, endDate: null, department: { name: { contains: 'IT' } } } } } },
          select: { employeeId: true },
        })
        return itUser?.employeeId ?? null
      }

      case 'FINANCE': {
        const finUser = await db.user.findFirst({
          where: { employee: { assignments: { some: { companyId, isPrimary: true, endDate: null, department: { name: { contains: '재무' } } } } } },
          select: { employeeId: true },
        })
        return finUser?.employeeId ?? null
      }

      default:
        return null
    }
  } catch {
    console.warn(`[resolveAssigneeId] Failed to resolve ${assigneeType} for employee ${employeeId}`)
    return null
  }
}

/**
 * 직원 온보딩 플랜을 생성한다.
 *
 * 템플릿 선택 우선순위:
 *   1. input.templateId 명시적 지정
 *   2. companyId 일치 + planType=ONBOARDING + isActive=true (회사 전용)
 *   3. companyId=null + planType=ONBOARDING + isActive=true (글로벌 기본)
 *   4. 없으면 null 반환 (온보딩 미생성 — 경고 로그)
 */
export async function createOnboardingPlan(
  input: CreateOnboardingPlanInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma where clause dynamic type
): Promise<CreateOnboardingPlanResult | null> {
  const db = tx ?? prisma

  // ── 템플릿 선택 ──────────────────────────────────────────

  let template: {
    id: string
    name: string
    onboardingTasks: TemplateTask[]
  } | null = null

  if (input.templateId) {
    template = await db.onboardingTemplate.findFirst({
      where: { id: input.templateId, isActive: true, deletedAt: null },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })
  } else {
    template = await db.onboardingTemplate.findFirst({
      where: { planType: 'ONBOARDING', isActive: true, deletedAt: null, companyId: input.companyId },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) {
      template = await db.onboardingTemplate.findFirst({
        where: { planType: 'ONBOARDING', isActive: true, deletedAt: null, companyId: null },
        include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
      })
    }
  }

  if (!template) {
    console.warn(
      `[createOnboardingPlan] No active ONBOARDING template found for company ${input.companyId}. ` +
      `Set up a company-specific or global template to enable auto-onboarding.`,
    )
    return null
  }

  // ── Resolve assignees + compute dueDates ─────────────────

  const hireDate = new Date(input.hireDate)
  const buddyId = input.buddyId ?? null

  const taskDataPromises = template.onboardingTasks.map(async (task) => {
    const assigneeId = await resolveAssigneeId(task.assigneeType, input.employeeId, input.companyId, buddyId, db)
    const dueDate = new Date(hireDate.getTime() + task.dueDaysAfter * 24 * 60 * 60 * 1000)

    return {
      id: randomUUID(),
      taskId: task.id,
      status: 'PENDING' as const,
      assigneeId,
      dueDate,
    }
  })

  const taskData = await Promise.all(taskDataPromises)

  // ── Auto-append Sign-off task ────────────────────────────
  // Check if template already has a sign-off task
  const hasSignOff = template.onboardingTasks.some(
    (t) => t.title.includes('Sign-off') || t.title.includes('서명'),
  )

  // We don't create a template-level task for sign-off (it's injected at instance level)
  // but we do need the OnboardingTask FK — so sign-off is tracked differently:
  // The sign-off action is handled by the sign-off API, not as a regular task.
  // If the template already includes a sign-off task, it will be used as-is.

  // ── EmployeeOnboarding + tasks 생성 ─────────────────────

  const onboardingId = randomUUID()

  await db.employeeOnboarding.create({
    data: {
      id: onboardingId,
      employeeId: input.employeeId,
      templateId: template.id,
      companyId: input.companyId,
      buddyId: buddyId,
      planType: 'ONBOARDING',
      status: 'IN_PROGRESS',      // E-1: Start as IN_PROGRESS immediately
      startedAt: hireDate,
      tasks: {
        create: taskData,
      },
    },
  })

  const totalTasks = taskData.length
  const signOffNote = hasSignOff ? '' : ' (sign-off handled via API)'

  console.info(
    `[createOnboardingPlan] Created plan ${onboardingId} ` +
    `(template: "${template.name}", tasks: ${totalTasks}${signOffNote}) ` +
    `for employee ${input.employeeId}`,
  )

  return {
    onboardingId,
    templateId: template.id,
    templateName: template.name,
    taskCount: totalTasks,
  }
}
