// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Simulation Scenarios API
// GET  /api/v1/payroll/simulation/scenarios  — 목록 (비교용 ?ids= 지원)
// POST /api/v1/payroll/simulation/scenarios  — 저장
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { z } from 'zod'

// ─── Validation ──────────────────────────────────────────

const SAVEABLE_MODES = ['SINGLE', 'BULK', 'DIFFERENTIAL', 'HIRING', 'FX'] as const

const saveScenarioSchema = z.object({
  mode: z.enum(SAVEABLE_MODES),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  companyId: z.string().uuid().nullable().optional(),
  parameters: z.record(z.string(), z.unknown()),
  results: z.record(z.string(), z.unknown()),
})

// ─── Results Truncation (AD-1) ───────────────────────────
// employees[] 배열 제거 → 집계 데이터만 저장

function truncateResults(mode: string, raw: Record<string, unknown>): Record<string, unknown> {
  switch (mode) {
    case 'SINGLE':
    case 'BULK': {
      const { employees: _e, ...rest } = raw as Record<string, unknown> & { employees?: unknown }
      const summary = rest.summary as Record<string, unknown> | undefined
      return { summary: summary ?? rest }
    }
    case 'DIFFERENTIAL': {
      const { employees: _e, ...rest } = raw as Record<string, unknown> & { employees?: unknown }
      const summary = rest.summary as Record<string, unknown> | undefined
      if (summary) {
        const { bandViolations, ...summaryRest } = summary as Record<string, unknown> & { bandViolations?: { count?: number } }
        return {
          summary: {
            ...summaryRest,
            bandViolations: { count: bandViolations?.count ?? 0 },
          },
        }
      }
      return rest
    }
    // HIRING, FX: 이미 경량 (summary만 포함)
    default:
      return raw
  }
}

// ─── GET: 목록 조회 / 비교용 다건 조회 ──────────────────

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const ids = searchParams.get('ids')

      // 비교 모드: ?ids=id1,id2
      if (ids) {
        const idList = ids.split(',').slice(0, 2)
        const scenarios = await prisma.simulationScenario.findMany({
          where: { id: { in: idList } },
          select: {
            id: true, mode: true, title: true, description: true,
            companyId: true, createdById: true, createdAt: true,
            parameters: true, results: true,
          },
        })
        return apiSuccess(scenarios)
      }

      // 일반 목록: ?mode=&companyId=
      const mode = searchParams.get('mode')
      const companyId = searchParams.get('companyId')

      const where: Record<string, unknown> = {}
      if (mode && SAVEABLE_MODES.includes(mode as typeof SAVEABLE_MODES[number])) {
        where.mode = mode
      }
      if (companyId) where.companyId = companyId

      const scenarios = await prisma.simulationScenario.findMany({
        where,
        select: {
          id: true, mode: true, title: true, description: true,
          companyId: true, createdById: true, createdAt: true,
          // results 제외 — 경량 목록
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      return apiSuccess(scenarios)
    } catch (error) {
      return apiError(error)
    }
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW },
)

// ─── POST: 시나리오 저장 ─────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user) => {
    try {
      const body = await req.json()
      const parsed = saveScenarioSchema.parse(body)

      const truncated = truncateResults(parsed.mode, parsed.results)

      const scenario = await prisma.simulationScenario.create({
        data: {
          createdById: user.id,
          mode: parsed.mode,
          title: parsed.title,
          description: parsed.description ?? null,
          companyId: parsed.companyId ?? null,
          parameters: parsed.parameters as object,
          results: truncated as object,
        },
        select: {
          id: true, mode: true, title: true, description: true,
          companyId: true, createdById: true, createdAt: true,
        },
      })
      return apiSuccess(scenario, 201)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw badRequest('입력 데이터가 올바르지 않습니다.')
      }
      return apiError(error)
    }
  },
  { module: MODULE.PAYROLL, action: ACTION.CREATE },
)
