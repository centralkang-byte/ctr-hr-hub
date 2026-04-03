// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/applicants/[id]/timeline
// B4: 후보자 지원 히스토리 타임라인
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    { params }: { params: Promise<Record<string, string>> },
    _user: SessionUser,
  ) => {
    const { id } = await params

    // applicantId 기준으로 조회 (id는 applicant.id)
    const applicant = await prisma.applicant.findUnique({
      where: { id },
      include: {
        applications: {
          orderBy: { appliedAt: 'asc' },
          include: {
            posting: {
              select: {
                id: true,
                title: true,
                company: { select: { name: true } },
              },
            },
            interviewSchedules: {
              orderBy: { scheduledAt: 'asc' },
              select: {
                id: true,
                scheduledAt: true,
                interviewType: true,
                status: true,
              },
            },
          },
        },
        talentPoolEntries: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            poolReason: true,
            status: true,
            createdAt: true,
            sourcePosting: { select: { title: true } },
          },
        },
      },
    })

    if (!applicant) throw notFound('후보자를 찾을 수 없습니다.')

    const events: Array<{
      id: string
      type: string
      label: string
      description?: string
      postingTitle?: string
      companyName?: string
      score?: number
      timestamp: string
      isCurrent: boolean
    }> = []

    // 지원 이력 → 스테이지 변환
    for (const app of applicant.applications) {
      // 지원 이벤트
      events.push({
        id: `app-${app.id}-applied`,
        type: 'stage_change',
        label: 'APPLIED',
        postingTitle: app.posting.title,
        companyName: app.posting.company.name,
        timestamp: app.appliedAt.toISOString(),
        isCurrent: app.stage === 'APPLIED',
      })

      // 스크리닝 → 현재 단계까지의 전환점 추정
      const stageOrder = ['APPLIED', 'SCREENING', 'INTERVIEW_1', 'INTERVIEW_2', 'FINAL', 'OFFER', 'HIRED', 'REJECTED']
      const currentIdx = stageOrder.indexOf(app.stage)

      // 면접 일정 이벤트 추가
      for (const iv of app.interviewSchedules) {
        events.push({
          id: `iv-${iv.id}`,
          type: 'interview',
          label: '면접',
          description: `${iv.interviewType ?? ''} 면접 (${iv.status})`,
          postingTitle: app.posting.title,
          companyName: app.posting.company.name,
          timestamp: iv.scheduledAt.toISOString(),
          isCurrent: false,
        })
      }

      // AI 스크리닝 점수 이벤트
      if (app.aiScreeningScore !== null) {
        events.push({
          id: `screen-${app.id}`,
          type: 'stage_change',
          label: 'SCREENING',
          description: app.aiScreeningSummary ?? undefined,
          postingTitle: app.posting.title,
          companyName: app.posting.company.name,
          score: app.aiScreeningScore ?? undefined,
          timestamp: app.updatedAt.toISOString(),
          isCurrent: app.stage === 'SCREENING',
        })
      }

      // 현재 단계 (APPLIED/SCREENING 제외 중간 이후 단계)
      if (currentIdx > 1 && app.stage !== 'REJECTED') {
        events.push({
          id: `app-${app.id}-current`,
          type: 'stage_change',
          label: app.stage,
          postingTitle: app.posting.title,
          companyName: app.posting.company.name,
          timestamp: app.updatedAt.toISOString(),
          isCurrent: true,
        })
      }

      // 불합격
      if (app.stage === 'REJECTED') {
        events.push({
          id: `app-${app.id}-rejected`,
          type: 'stage_change',
          label: 'REJECTED',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (app as any).rejectionReason ?? undefined,
          postingTitle: app.posting.title,
          companyName: app.posting.company.name,
          timestamp: app.updatedAt.toISOString(),
          isCurrent: false,
        })
      }
    }

    // Talent Pool 등록 이벤트
    for (const entry of applicant.talentPoolEntries) {
      const POOL_REASON_LABELS: Record<string, string> = {
        rejected_qualified: '우수 불합격 → Talent Pool 등록',
        withdrawn: '자진 철회 → Talent Pool 등록',
        overqualified: '역량 초과 → Talent Pool 등록',
        manual: 'Talent Pool 수동 등록',
      }
      events.push({
        id: `pool-${entry.id}`,
        type: 'pool_entry',
        label: POOL_REASON_LABELS[entry.poolReason] ?? 'Talent Pool 등록',
        description: `상태: ${entry.status}`,
        postingTitle: entry.sourcePosting?.title,
        timestamp: entry.createdAt.toISOString(),
        isCurrent: entry.status === 'active',
      })
    }

    // 시간순 정렬
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return apiSuccess({
      applicantId: applicant.id,
      applicantName: applicant.name,
      applicantEmail: applicant.email,
      events,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
