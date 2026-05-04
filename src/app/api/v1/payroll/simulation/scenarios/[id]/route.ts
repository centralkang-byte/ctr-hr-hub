// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Simulation Scenario Detail API
// GET    /api/v1/payroll/simulation/scenarios/:id  — 단건 조회
// DELETE /api/v1/payroll/simulation/scenarios/:id  — 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'

type RouteContext = { params: Promise<Record<string, string>> }

// ─── GET: 단건 상세 (results 포함) ──────────────────────

export const GET = withPermission(
  async (_req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params
      const scenario = await prisma.simulationScenario.findUnique({
        where: { id },
      })
      if (!scenario) throw notFound('시나리오를 찾을 수 없습니다.')
      return apiSuccess(scenario)
    } catch (error) {
      return apiError(error)
    }
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW },
)

// ─── DELETE: 삭제 (본인 것만) ────────────────────────────

export const DELETE = withPermission(
  async (_req: NextRequest, context: RouteContext, user) => {
    try {
      const { id } = await context.params
      const scenario = await prisma.simulationScenario.findUnique({
        where: { id },
        select: { id: true, createdById: true },
      })
      if (!scenario) throw notFound('시나리오를 찾을 수 없습니다.')

      // SUPER_ADMIN / HR_ADMIN은 모두 삭제 가능, 나머지는 본인 것만.
      // 양방향 호환 (Codex Gate 1 P1): 신규 row는 user.employeeId(Session 203 후속 cleanup),
      // legacy row는 user.id(NextAuth subject). dev에선 동일하지만 Azure SSO prod에서 분기.
      // Backfill 후 단방향으로 좁힐 follow-up 예정.
      const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'
      const isOwner =
        scenario.createdById === user.employeeId || scenario.createdById === user.id
      if (!isAdmin && !isOwner) {
        throw forbidden('본인이 생성한 시나리오만 삭제할 수 있습니다.')
      }

      await prisma.simulationScenario.delete({ where: { id } })
      return apiSuccess({ deleted: true })
    } catch (error) {
      return apiError(error)
    }
  },
  { module: MODULE.PAYROLL, action: ACTION.DELETE },
)
