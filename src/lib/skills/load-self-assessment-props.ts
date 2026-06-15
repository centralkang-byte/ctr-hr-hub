// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 자기평가(역량) 서버 데이터 로더 (SSOT)
// /my/skills/page.tsx 와 /performance/growth/page.tsx(허브)가 공유 — 드리프트 차단.
// 역량 목록 + 직급별 기대수준(requirementMap) + 직급코드.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { buildRequirementMap } from '@/lib/skills/requirement-map'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface CompetencyCategory {
  id: string
  name: string
  code: string
}
interface CompetencyLevel {
  level: number
  label: string
  description: string | null
}
export interface SelfAssessmentCompetency {
  id: string
  name: string
  code: string
  category: CompetencyCategory
  levels: CompetencyLevel[]
}

export interface SelfAssessmentProps {
  competencies: SelfAssessmentCompetency[]
  requirementMap: Record<string, number>
  grade: string
}

// ─── Loader ─────────────────────────────────────────────────

export async function loadSelfAssessmentProps(user: SessionUser): Promise<SelfAssessmentProps> {
  const [competencies, employee] = await Promise.all([
    prisma.competency.findMany({
      where: { deletedAt: null },
      include: {
        category: { select: { id: true, name: true, code: true } },
        levels: { orderBy: { level: 'asc' } },
      },
      orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
    }),
    // 본인 레코드 (세션 employeeId 기준 self 조회 — Employee 에 직접 companyId 컬럼 없음)
    prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: { jobGrade: { select: { code: true, name: true } } },
        },
      },
    }),
  ])

  const primary = extractPrimaryAssignment(employee?.assignments ?? [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grade = (primary as any)?.jobGrade?.code ?? ''

  // 역량 요건 (기대 수준): 회사 + 글로벌(null) 중 해당 직급.
  // FIX(Codex G1 P1-3): 무배정(grade 없음) → 전 직급 과조회 대신 jobLevelCode:null(전직급 공통)만.
  // 동일 competency 에 회사+글로벌 요건이 함께 있으면 회사가 글로벌을 덮어쓰도록 명시 (순서의존 제거).
  const requirements = await prisma.competencyRequirement.findMany({
    where: {
      OR: [{ companyId: user.companyId }, { companyId: null }],
      jobLevelCode: grade || null,
    },
    select: { competencyId: true, expectedLevel: true, companyId: true },
  })

  return { competencies, requirementMap: buildRequirementMap(requirements), grade }
}
