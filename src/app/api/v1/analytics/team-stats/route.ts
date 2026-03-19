// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Stats API (Manager Org Tree Aggregation)
// GET /api/v1/analytics/team-stats
//
// 매니저/본부장/대표의 하위 조직 통합 통계.
// ★ Prisma nested relation 사용 금지 — WITH RECURSIVE CTE 사용.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

interface SubordinateRow {
  employee_id: string
}

interface StatsRow {
  total_subordinates: bigint
  avg_tenure_years: number
  exit_count_12m: bigint
}

interface DepartmentBreakdownRow {
  department_name: string
  count: bigint
}

// ─── GET /api/v1/analytics/team-stats ─────────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    // EMPLOYEE 차단 — MANAGER, EXECUTIVE, SUPER_ADMIN만 접근
    if (user.role === ROLE.EMPLOYEE) {
      throw forbidden('매니저 이상 권한이 필요합니다.')
    }

    const { searchParams } = new URL(req.url)
    const targetPositionId = searchParams.get('positionId') ?? undefined

    // 1. 현재 사용자의 positionId 조회
    const myAssignment = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId: user.employeeId,
        isPrimary: true,
        endDate: null,
      },
      select: { positionId: true },
    })

    const myPositionId = targetPositionId ?? myAssignment?.positionId
    if (!myPositionId) {
      throw badRequest('직위 정보를 찾을 수 없습니다.')
    }

    // 2. WITH RECURSIVE CTE로 하위 position → 직원 ID 수집
    const start = Date.now()

    const subordinateIds = await prisma.$queryRaw<SubordinateRow[]>`
      WITH RECURSIVE org_tree AS (
        SELECT id FROM positions WHERE id = ${myPositionId}
        UNION ALL
        SELECT p.id FROM positions p
        JOIN org_tree ot ON p.reports_to_position_id = ot.id
        WHERE p.is_active = true
      )
      SELECT DISTINCT ea.employee_id
      FROM org_tree ot
      JOIN employee_assignments ea ON ea.position_id = ot.id
      WHERE ea.end_date IS NULL
        AND ea.is_primary = true
        AND ea.employee_id != ${user.employeeId}
    `

    const queryTime = Date.now() - start
    console.log(`[team-stats] CTE query: ${queryTime}ms, subordinates: ${subordinateIds.length}`)

    if (subordinateIds.length === 0) {
      return apiSuccess({
        teamSize: 0,
        directReports: 0,
        totalSubordinates: 0,
        avgTenureYears: 0,
        turnoverRate: 0,
        departmentBreakdown: [],
        queryTimeMs: queryTime,
      })
    }

    const empIds = subordinateIds.map((r) => r.employee_id)

    // 3. 직속 보고 인원 수 (직접 reportsToPositionId = myPositionId)
    const directReportCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT ea.employee_id)::bigint AS count
      FROM positions p
      JOIN employee_assignments ea ON ea.position_id = p.id
      WHERE p.reports_to_position_id = ${myPositionId}
        AND p.is_active = true
        AND ea.end_date IS NULL
        AND ea.is_primary = true
    `

    // 4. 통계 집계 (단일 쿼리)
    const [stats] = await prisma.$queryRaw<StatsRow[]>`
      SELECT
        COUNT(DISTINCT ea.employee_id)::bigint AS total_subordinates,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - e.hire_date)) / (365.25 * 24 * 3600))::numeric, 1) AS avg_tenure_years,
        (
          SELECT COUNT(DISTINCT eo.employee_id)::bigint
          FROM employee_offboarding eo
          WHERE eo.employee_id = ANY(${empIds})
            AND eo.status = 'COMPLETED'
            AND eo.last_working_date >= CURRENT_DATE - INTERVAL '12 months'
        ) AS exit_count_12m
      FROM employee_assignments ea
      JOIN employees e ON e.id = ea.employee_id
      WHERE ea.employee_id = ANY(${empIds})
        AND ea.is_primary = true
        AND ea.end_date IS NULL
    `

    // 5. 부서별 인원 분포
    const deptBreakdown = await prisma.$queryRaw<DepartmentBreakdownRow[]>`
      SELECT
        COALESCE(d.name, '미배정') AS department_name,
        COUNT(DISTINCT ea.employee_id)::bigint AS count
      FROM employee_assignments ea
      LEFT JOIN departments d ON d.id = ea.department_id
      WHERE ea.employee_id = ANY(${empIds})
        AND ea.is_primary = true
        AND ea.end_date IS NULL
      GROUP BY d.name
      ORDER BY count DESC
    `

    const totalSubordinates = Number(stats?.total_subordinates ?? 0)
    const exitCount12m = Number(stats?.exit_count_12m ?? 0)
    const turnoverRate = totalSubordinates > 0
      ? Math.round((exitCount12m / totalSubordinates) * 1000) / 10
      : 0

    return apiSuccess({
      teamSize: totalSubordinates + 1, // 본인 포함
      directReports: Number(directReportCount[0]?.count ?? 0),
      totalSubordinates,
      avgTenureYears: Number(stats?.avg_tenure_years ?? 0),
      turnoverRate,
      departmentBreakdown: deptBreakdown.map((d) => ({
        name: d.department_name,
        count: Number(d.count),
      })),
      queryTimeMs: queryTime,
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
