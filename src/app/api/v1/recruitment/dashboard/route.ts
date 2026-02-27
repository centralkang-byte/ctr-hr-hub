// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/dashboard
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Funnel Stage Labels ─────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '지원완료',
  SCREENING: '서류심사',
  INTERVIEW_1: '1차면접',
  INTERVIEW_2: '2차면접',
  FINAL: '최종심사',
  OFFER: '오퍼',
  HIRED: '합격',
  REJECTED: '탈락',
}

const STAGE_ORDER = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW_1',
  'INTERVIEW_2',
  'FINAL',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const

// ─── GET /api/v1/recruitment/dashboard ───────────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    // ── KPI: Active Postings ──────────────────────────────
    const activePostings = await prisma.jobPosting.count({
      where: {
        ...companyFilter,
        status: 'OPEN',
        deletedAt: null,
      },
    })

    // ── KPI: Total Applicants (for OPEN postings) ─────────
    const totalApplicants = await prisma.application.count({
      where: {
        posting: {
          ...companyFilter,
          status: 'OPEN',
          deletedAt: null,
        },
      },
    })

    // ── KPI: Avg Time to Hire ─────────────────────────────
    const hiredApplications = await prisma.application.findMany({
      where: {
        stage: 'HIRED',
        convertedAt: { not: null },
        posting: {
          ...companyFilter,
          deletedAt: null,
        },
      },
      select: {
        appliedAt: true,
        convertedAt: true,
      },
    })

    let avgTimeToHire: number | null = null
    if (hiredApplications.length > 0) {
      const totalDays = hiredApplications.reduce((sum, app) => {
        if (!app.convertedAt) return sum
        const diffMs = app.convertedAt.getTime() - app.appliedAt.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)
        return sum + diffDays
      }, 0)
      avgTimeToHire = Math.round((totalDays / hiredApplications.length) * 10) / 10
    }

    // ── KPI: Hire Rate ────────────────────────────────────
    const totalApplications = await prisma.application.count({
      where: {
        posting: {
          ...companyFilter,
          deletedAt: null,
        },
      },
    })

    const hiredCount = await prisma.application.count({
      where: {
        stage: 'HIRED',
        posting: {
          ...companyFilter,
          deletedAt: null,
        },
      },
    })

    const hireRate =
      totalApplications > 0
        ? Math.round((hiredCount / totalApplications) * 1000) / 10
        : 0

    // ── Funnel: Application Stage Distribution ────────────
    // Include active (OPEN) + recently closed postings
    const stageGroups = await prisma.application.groupBy({
      by: ['stage'],
      where: {
        posting: {
          ...companyFilter,
          deletedAt: null,
          status: { in: ['OPEN', 'CLOSED'] },
        },
      },
      _count: { id: true },
    })

    const stageCountMap = new Map(
      stageGroups.map((g) => [g.stage, g._count.id]),
    )

    const funnel = STAGE_ORDER.map((stage) => ({
      stage,
      count: stageCountMap.get(stage) ?? 0,
      label: STAGE_LABELS[stage] ?? stage,
    }))

    // ── Recent Postings: Top 5 OPEN ───────────────────────
    const recentPostings = await prisma.jobPosting.findMany({
      where: {
        ...companyFilter,
        status: 'OPEN',
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        postedAt: true,
        _count: { select: { applications: true } },
      },
      orderBy: { postedAt: 'desc' },
      take: 5,
    })

    const formattedPostings = recentPostings.map((p) => ({
      id: p.id,
      title: p.title,
      applicantCount: p._count.applications,
      postedAt: p.postedAt,
    }))

    return apiSuccess({
      kpis: {
        activePostings,
        totalApplicants,
        avgTimeToHire,
        hireRate,
      },
      funnel,
      recentPostings: formattedPostings,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
