// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/applicants/check-duplicate
// B4: 후보자 중복 감지 (3-tier: email > phone > name+birthDate)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const checkSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(), // ISO date string
})

interface DuplicateMatch {
  applicantId: string
  name: string
  email: string
  phone: string | null
  matchType: 'email' | 'phone' | 'name_dob'
  matchScore: number
  applicationCount: number
  lastApplicationAt: string | null
}

export const POST = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = checkSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.')
    }

    const { name, email, phone, birthDate } = parsed.data
    const matches: DuplicateMatch[] = []
    const seenIds = new Set<string>()

    // ── Tier 1: 이메일 정확 매칭 (score = 1.0) ─────────────────
    const emailMatch = await prisma.applicant.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        _count: { select: { applications: true } },
        applications: {
          orderBy: { appliedAt: 'desc' },
          take: 1,
          select: { appliedAt: true },
        },
      },
    })

    if (emailMatch) {
      seenIds.add(emailMatch.id)
      matches.push({
        applicantId: emailMatch.id,
        name: emailMatch.name,
        email: emailMatch.email,
        phone: emailMatch.phone,
        matchType: 'email',
        matchScore: 1.0,
        applicationCount: emailMatch._count.applications,
        lastApplicationAt: emailMatch.applications[0]?.appliedAt?.toISOString() ?? null,
      })
    }

    // ── Tier 2: 전화번호 정확 매칭 (score = 0.9) ──────────────────
    if (phone) {
      const phoneMatches = await prisma.applicant.findMany({
        where: {
          phone,
          NOT: { id: { in: [...seenIds] } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          _count: { select: { applications: true } },
          applications: {
            orderBy: { appliedAt: 'desc' },
            take: 1,
            select: { appliedAt: true },
          },
        },
        take: 5,
      })

      for (const match of phoneMatches) {
        seenIds.add(match.id)
        matches.push({
          applicantId: match.id,
          name: match.name,
          email: match.email,
          phone: match.phone,
          matchType: 'phone',
          matchScore: 0.9,
          applicationCount: match._count.applications,
          lastApplicationAt: match.applications[0]?.appliedAt?.toISOString() ?? null,
        })
      }
    }

    // ── Tier 3: 이름 + 생년월일 매칭 (score = 0.7) ──────────────
    if (birthDate) {
      const dob = new Date(birthDate)
      // Check valid date
      if (!isNaN(dob.getTime())) {
        const dobMatches = await prisma.applicant.findMany({
          where: {
            name: { equals: name, mode: 'insensitive' },
            birthDate: dob,
            NOT: { id: { in: [...seenIds] } },
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            _count: { select: { applications: true } },
            applications: {
              orderBy: { appliedAt: 'desc' },
              take: 1,
              select: { appliedAt: true },
            },
          },
          take: 5,
        })

        for (const match of dobMatches) {
          seenIds.add(match.id)
          matches.push({
            applicantId: match.id,
            name: match.name,
            email: match.email,
            phone: match.phone,
            matchType: 'name_dob',
            matchScore: 0.7,
            applicationCount: match._count.applications,
            lastApplicationAt: match.applications[0]?.appliedAt?.toISOString() ?? null,
          })
        }
      }
    }

    // 중복 로그 기록 (백그라운드 — 현재 applicant ID 없으므로 나중에 연결)
    // POST 시점에는 신규 지원자 ID가 없어 로그 생략, 실제 등록 후 처리

    return apiSuccess({
      hasDuplicates: matches.length > 0,
      matches,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
