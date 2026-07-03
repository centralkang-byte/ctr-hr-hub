// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 매니저 역량 평가 API (B8-3 스킬 매트릭스)
// ═══════════════════════════════════════════════════════════
//
// GET  /api/v1/skills/team-assessments  팀원 목록 + 자기평가 현황
// POST /api/v1/skills/team-assessments  매니저가 팀원 역량 평가

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma/client'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import {
  canWriteEmployeeSkills,
  activePrimaryAssignmentWhere,
  activeReportAssignmentWhere,
  SKILL_ROSTER_VIEW_ROLES,
} from '@/lib/skills/skill-access'

const managerAssessmentSchema = z.object({
  employeeId: z.string().uuid(),
  competencyId: z.string().uuid(),
  assessmentPeriod: z.string().min(1).max(20),
  managerLevel: z.number().int().min(1).max(5),
  managerComment: z.string().max(1000).optional(),
})

const bulkManagerAssessmentSchema = z.object({
  employeeId: z.string().uuid(),
  assessmentPeriod: z.string().min(1).max(20),
  items: z.array(
    z.object({
      competencyId: z.string().uuid(),
      managerLevel: z.number().int().min(1).max(5),
      managerComment: z.string().max(1000).optional(),
    }),
  ).min(1),
})

// ─── GET /api/v1/skills/team-assessments ────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    // 팀 스킬 평가 뷰는 매니저+ 전용 (EMPLOYEES.VIEW만으로는 self-view와 구분 부족)
    if (!SKILL_ROSTER_VIEW_ROLES.includes(user.role)) {
      throw forbidden('팀 스킬 평가는 매니저 이상만 볼 수 있습니다.')
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? 'latest'
    const employeeId = searchParams.get('employeeId') // 특정 팀원 조회

    // 로스터 스코프 (cross-tenant 차단 + GET/POST 정합):
    // - MANAGER: 현재 직속부하만(getDirectReportIds) — 평가(POST) 가능 대상과 동일 스코프로
    //   GET-노출/POST-403 드리프트 방지 (Codex Gate1 P1). 부서 fallback은 제거.
    // - HR_ADMIN/EXECUTIVE/SUPER: 자사 전체(SUPER는 전사/지정 법인) — resolveCompanyFilter로
    //   비-SUPER 타사 누출 차단(기존 deptId null → 무스코프 leak도 해소).
    //   status 필터는 두지 않음 — HR 은 오프보딩 진행중 직원도 열람/평가 대상(쓰기 게이트와 정합).
    const isPrivileged = ['HR_ADMIN', 'SUPER_ADMIN', 'EXECUTIVE'].includes(user.role)

    let teamWhere: Prisma.EmployeeWhereInput
    if (isPrivileged) {
      teamWhere = {
        AND: [
          employeeId ? { id: employeeId } : {},
          { id: { not: user.employeeId } },
          {
            assignments: {
              some: {
                ...activePrimaryAssignmentWhere(),
                ...resolveCompanyFilter(user, searchParams.get('companyId')),
              },
            },
          },
        ],
      }
    } else {
      // MANAGER — S324 재필터: getDirectReportIds 는 발령 status·companyId 미필터라
      // 오프보딩 진행중·타법인 직속부하가 섞임 → 자사 active primary 발령으로 재필터
      // (canWriteEmployeeSkills 와 동일 집합). 겸직 위계에서 자기 자신 포함 방지도 함께
      // (POST self=403 이므로 로스터에서도 제외해 드리프트 차단).
      const reportIds = await getDirectReportIds(user.employeeId ?? '')
      const allowedIds = (employeeId ? reportIds.filter((id) => id === employeeId) : reportIds)
        .filter((id) => id !== user.employeeId)
      teamWhere = {
        id: { in: allowedIds },
        assignments: { some: activeReportAssignmentWhere(user.companyId) },
      }
    }

    const teamMembers = await prisma.employee.findMany({
      where: teamWhere,
      include: {
        assignments: {
          where: activePrimaryAssignmentWhere(),
          take: 1,
          include: {
            jobGrade: { select: { code: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        skillAssessments: {
          where: { assessmentPeriod: period },
          include: {
            competency: {
              select: {
                id: true,
                name: true,
                code: true,
                category: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    })

    // 역량 목록 (평가 가능한 역량)
    const competencies = await prisma.competency.findMany({
      where: { deletedAt: null },
      include: { category: { select: { id: true, name: true, code: true } } },
      orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
    })

    // 역량 요건 — 기대수준 오버레이는 각 대상 직원의 회사 요건 사용 (actor 회사 혼입
    // 방지, assessments/radar 와 동일 Codex Gate1 P1 클래스). SUPER 전사/타사 로스터는
    // 법인이 혼재하므로 로스터에 등장하는 회사 집합으로 조회해 per-member 키로 매칭.
    const memberCompanyIds = [
      ...new Set(
        teamMembers
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((m) => (extractPrimaryAssignment(m.assignments ?? []) as any)?.companyId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ]
    const requirements = await prisma.competencyRequirement.findMany({
      where: { OR: [{ companyId: { in: memberCompanyIds } }, { companyId: null }] },
      select: { competencyId: true, expectedLevel: true, jobLevelCode: true, companyId: true },
    })
    // 회사별 요건과 글로벌(null) 요건을 키로 분리 — 조회 시 회사별 우선, 글로벌 fallback
    const requirementMap = new Map(
      requirements.map((r) => [
        `${r.companyId ?? 'global'}_${r.competencyId}_${r.jobLevelCode ?? ''}`,
        r.expectedLevel,
      ]),
    )

    return apiSuccess({
      period,
      teamMembers: teamMembers.map((m) => {
        const mPrimary = extractPrimaryAssignment(m.assignments ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const grade = (mPrimary as any)?.jobGrade?.code ?? ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mCompanyId = (mPrimary as any)?.companyId as string | undefined
        const assessmentMap = new Map(m.skillAssessments.map((a) => [a.competencyId, a]))
        return {
          id: m.id,
          name: m.name,
          nameEn: m.nameEn,
          grade,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          department: (mPrimary as any)?.department,
          assessments: competencies.map((c) => {
            const assessment = assessmentMap.get(c.id)
            const expectedLevel =
              (mCompanyId !== undefined
                ? requirementMap.get(`${mCompanyId}_${c.id}_${grade}`)
                : undefined) ??
              requirementMap.get(`global_${c.id}_${grade}`) ??
              null
            return {
              competencyId: c.id,
              competency: c,
              selfLevel: assessment?.selfLevel ?? null,
              managerLevel: assessment?.managerLevel ?? null,
              finalLevel: assessment?.finalLevel ?? null,
              expectedLevel,
              gap:
                expectedLevel != null && (assessment?.finalLevel ?? assessment?.selfLevel) != null
                  ? expectedLevel - (assessment?.finalLevel ?? assessment?.selfLevel ?? 0)
                  : null,
            }
          }),
        }
      }),
      competencies,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/skills/team-assessments ─── (매니저 평가)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()

    // 일괄 평가 지원
    const bulkParsed = bulkManagerAssessmentSchema.safeParse(body)
    if (bulkParsed.success) {
      // cross-tenant/수평권한 방어: SUPER 전사·HR 자사·MANAGER 직속부하만 평가 가능.
      // bulk는 단일 employeeId를 공유하므로 1회 검증으로 충분 (Codex Gate1 P2 확인).
      if (!(await canWriteEmployeeSkills(user, bulkParsed.data.employeeId))) {
        throw forbidden('해당 직원의 역량을 평가할 권한이 없습니다.')
      }
      try {
        const results = await prisma.$transaction(
          bulkParsed.data.items.map((item) =>
            prisma.employeeSkillAssessment.upsert({
              where: {
                employeeId_competencyId_assessmentPeriod: {
                  employeeId: bulkParsed.data.employeeId,
                  competencyId: item.competencyId,
                  assessmentPeriod: bulkParsed.data.assessmentPeriod,
                },
              },
              update: {
                managerLevel: item.managerLevel,
                managerComment: item.managerComment,
                finalLevel: item.managerLevel, // 매니저 평가 우선
                assessedById: user.employeeId,
                assessedAt: new Date(),
              },
              create: {
                employeeId: bulkParsed.data.employeeId,
                competencyId: item.competencyId,
                assessmentPeriod: bulkParsed.data.assessmentPeriod,
                managerLevel: item.managerLevel,
                managerComment: item.managerComment,
                finalLevel: item.managerLevel,
                assessedById: user.employeeId,
                assessedAt: new Date(),
              },
            }),
          ),
        )
        return apiSuccess({ count: results.length, employeeId: bulkParsed.data.employeeId }, 201)
      } catch (error) {
        throw handlePrismaError(error)
      }
    }

    // 단건 평가
    const parsed = managerAssessmentSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    if (!(await canWriteEmployeeSkills(user, parsed.data.employeeId))) {
      throw forbidden('해당 직원의 역량을 평가할 권한이 없습니다.')
    }

    try {
      const assessment = await prisma.employeeSkillAssessment.upsert({
        where: {
          employeeId_competencyId_assessmentPeriod: {
            employeeId: parsed.data.employeeId,
            competencyId: parsed.data.competencyId,
            assessmentPeriod: parsed.data.assessmentPeriod,
          },
        },
        update: {
          managerLevel: parsed.data.managerLevel,
          managerComment: parsed.data.managerComment,
          finalLevel: parsed.data.managerLevel,
          assessedById: user.employeeId,
          assessedAt: new Date(),
        },
        create: {
          employeeId: parsed.data.employeeId,
          competencyId: parsed.data.competencyId,
          assessmentPeriod: parsed.data.assessmentPeriod,
          managerLevel: parsed.data.managerLevel,
          managerComment: parsed.data.managerComment,
          finalLevel: parsed.data.managerLevel,
          assessedById: user.employeeId,
          assessedAt: new Date(),
        },
        include: {
          competency: { select: { id: true, name: true, code: true } },
          employee: { select: { id: true, name: true, nameEn: true } },
        },
      })
      return apiSuccess(assessment, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
