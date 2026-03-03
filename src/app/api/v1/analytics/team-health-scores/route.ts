// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 팀 건강 스코어 목록 조회 API
// GET /api/v1/analytics/team-health-scores
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string; companyId?: string }
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('company_id') ?? user.companyId ?? ''

  try {
    const departments = await prisma.department.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        teamHealthScores: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            overallScore: true,
            riskLevel: true,
            memberCount: true,
            metrics: true,
            calculatedAt: true,
          },
        },
      },
    })

    const data = departments
      .map((d) => ({
        departmentId: d.id,
        departmentName: d.name,
        latestScore: d.teamHealthScores[0] ?? null,
      }))
      .filter((d) => d.latestScore !== null)
      .sort((a, b) => (b.latestScore?.overallScore ?? 0) - (a.latestScore?.overallScore ?? 0))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[team-health-scores GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
