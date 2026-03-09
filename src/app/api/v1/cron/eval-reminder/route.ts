// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/eval-reminder
// 평가 미이행 리마인더 (D-7/D-3/D-day)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { sendNotification } from '@/lib/notifications'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

const REMINDER_DAYS = [7, 3, 0] // D-7, D-3, D-day

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  let sentCount = 0

  // ACTIVE 평가 사이클 조회
  const cycles = await prisma.performanceCycle.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      companyId: true,
      goalEnd: true,
      evalEnd: true,
    },
  })

  for (const cycle of cycles) {
    // 목표 마감 리마인더
    const goalDaysLeft = Math.ceil(
      (cycle.goalEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    // 평가 마감 리마인더
    const evalDaysLeft = Math.ceil(
      (cycle.evalEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    const checkpoints: { type: string; daysLeft: number; deadline: Date }[] = []

    if (REMINDER_DAYS.includes(goalDaysLeft)) {
      checkpoints.push({
        type: 'goal',
        daysLeft: goalDaysLeft,
        deadline: cycle.goalEnd,
      })
    }
    if (REMINDER_DAYS.includes(evalDaysLeft)) {
      checkpoints.push({
        type: 'eval',
        daysLeft: evalDaysLeft,
        deadline: cycle.evalEnd,
      })
    }

    if (checkpoints.length === 0) continue

    for (const cp of checkpoints) {
      // 미이행 직원 조회
      if (cp.type === 'goal') {
        // 목표 미설정 직원
        const employeesWithGoals = await prisma.mboGoal.findMany({
          where: { cycleId: cycle.id },
          select: { employeeId: true },
          distinct: ['employeeId'],
        })
        const goalEmployeeIds = new Set(employeesWithGoals.map((e) => e.employeeId))

        const allEmployees = await prisma.employee.findMany({
          where: {
            deletedAt: null,
            assignments: {
              some: {
                companyId: cycle.companyId,
                status: 'ACTIVE',
                isPrimary: true,
                endDate: null,
              },
            },
          },
          select: { id: true, name: true },
        })

        const missing = allEmployees.filter((e) => !goalEmployeeIds.has(e.id))
        const label = cp.daysLeft === 0 ? 'D-day' : `D-${cp.daysLeft}`

        for (const emp of missing) {
          sendNotification({
            employeeId: emp.id,
            triggerType: 'EVAL_REMINDER',
            title: `목표 설정 마감 ${label} (${cycle.name})`,
            body: `${emp.name}님, ${cycle.name} 목표 설정 마감일이 ${label}입니다. 목표를 설정해 주세요.`,
            link: '/performance',
          })
          sentCount++
        }

        // D-day 경과 시 HR_ADMIN 에스컬레이션
        if (cp.daysLeft <= 0 && missing.length > 0) {
          const hrAdmins = await prisma.employee.findMany({
            where: {
              deletedAt: null,
              assignments: {
                some: {
                  companyId: cycle.companyId,
                  status: 'ACTIVE',
                  isPrimary: true,
                  endDate: null,
                },
              },
              employeeRoles: {
                some: { role: { name: 'HR_ADMIN' } },
              },
            },
            select: { id: true },
          })

          for (const admin of hrAdmins) {
            sendNotification({
              employeeId: admin.id,
              triggerType: 'EVAL_ESCALATION',
              title: `[에스컬레이션] 목표 미설정 ${missing.length}명 (${cycle.name})`,
              body: `${cycle.name} 목표 설정 마감일이 경과했습니다. ${missing.length}명이 아직 목표를 설정하지 않았습니다.`,
              link: '/performance',
            })
          }
        }
      }

      if (cp.type === 'eval') {
        // 평가 미제출 직원
        const employeesWithEvals = await prisma.performanceEvaluation.findMany({
          where: { cycleId: cycle.id },
          select: { employeeId: true },
          distinct: ['employeeId'],
        })
        const evalEmployeeIds = new Set(employeesWithEvals.map((e) => e.employeeId))

        const allEmployees = await prisma.employee.findMany({
          where: {
            deletedAt: null,
            assignments: {
              some: {
                companyId: cycle.companyId,
                status: 'ACTIVE',
                isPrimary: true,
                endDate: null,
              },
            },
          },
          select: { id: true, name: true },
        })

        const missing = allEmployees.filter((e) => !evalEmployeeIds.has(e.id))
        const label = cp.daysLeft === 0 ? 'D-day' : `D-${cp.daysLeft}`

        for (const emp of missing) {
          sendNotification({
            employeeId: emp.id,
            triggerType: 'EVAL_REMINDER',
            title: `평가 제출 마감 ${label} (${cycle.name})`,
            body: `${emp.name}님, ${cycle.name} 평가 제출 마감일이 ${label}입니다. 평가를 제출해 주세요.`,
            link: '/performance',
          })
          sentCount++
        }

        // D-day 경과 시 HR_ADMIN 에스컬레이션
        if (cp.daysLeft <= 0 && missing.length > 0) {
          const hrAdmins = await prisma.employee.findMany({
            where: {
              deletedAt: null,
              assignments: {
                some: {
                  companyId: cycle.companyId,
                  status: 'ACTIVE',
                  isPrimary: true,
                  endDate: null,
                },
              },
              employeeRoles: {
                some: { role: { name: 'HR_ADMIN' } },
              },
            },
            select: { id: true },
          })

          for (const admin of hrAdmins) {
            sendNotification({
              employeeId: admin.id,
              triggerType: 'EVAL_ESCALATION',
              title: `[에스컬레이션] 평가 미제출 ${missing.length}명 (${cycle.name})`,
              body: `${cycle.name} 평가 제출 마감일이 경과했습니다. ${missing.length}명이 아직 평가를 제출하지 않았습니다.`,
              link: '/performance',
            })
          }
        }
      }
    }
  }

  return apiSuccess({ cyclesChecked: cycles.length, remindersSent: sentCount })
}
