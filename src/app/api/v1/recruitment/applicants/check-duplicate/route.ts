// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/applicants/check-duplicate
// B4: 후보자 중복 감지 (3-tier: email > phone > name+birthDate)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// Route-local role allowlist — duplicate check is a VIEW-level utility for recruiters,
// including MANAGER (for their own requisitions / pre-screening support).
// EXECUTIVE intentionally excluded — seed only granted *_export, not recruitment:read.
// NOTE: Duplicate matches are scoped to company via `applications.some.posting.companyId`.
// Per-MANAGER posting/requisition ownership scoping is deferred (follow-up) — current spec treats
// check-duplicate as a company-wide recruiter utility (Issue #11 spec: "VIEW perm").
const CHECK_DUPLICATE_ROLES: ReadonlyArray<SessionUser['role']> = [
  ROLE.SUPER_ADMIN,
  ROLE.HR_ADMIN,
  ROLE.MANAGER,
]

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

export const POST = withAuth(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    if (!CHECK_DUPLICATE_ROLES.includes(user.role)) {
      throw forbidden('후보자 중복 확인 권한이 없습니다.')
    }
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }
    const parsed = checkSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.')
    }

    const { name, email, phone, birthDate } = parsed.data
    const matches: DuplicateMatch[] = []
    const seenIds = new Set<string>()

    // Company isolation: Applicant has no companyId, filter via applications → posting
    const companyFilter = user.role === ROLE.SUPER_ADMIN
      ? {}
      : { applications: { some: { posting: { companyId: user.companyId } } } }

    // ── Tier 1: 이메일 정확 매칭 (score = 1.0) ─────────────────
    const emailMatch = await prisma.applicant.findFirst({
      where: { email, ...companyFilter },
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
          ...companyFilter,
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
            ...companyFilter,
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

    // ── Do-Not-Rehire 체크 ─────────────────────────────────
    // 이메일로 기존 퇴직 직원 중 재고용 방지 플래그 확인
    // Company scope: 오프보딩 소유 법인(EmployeeOffboarding.companyId) 직접 — 구 historical-assignment
    // 조인은 전출 이력만 있어도 타법인 퇴직 플래그·사유까지 노출됐음.
    const doNotRehire = await prisma.employeeOffboarding.findFirst({
      where: {
        isDoNotRehire: true,
        status: 'COMPLETED',
        ...(user.role !== ROLE.SUPER_ADMIN ? { companyId: user.companyId } : {}),
        employee: { email },
      },
      select: {
        doNotRehireReason: true,
        completedAt: true,
        employee: { select: { name: true, id: true } },
      },
    })

    return apiSuccess({
      hasDuplicates: matches.length > 0,
      matches,
      doNotRehire: doNotRehire
        ? {
            flagged: true,
            employeeName: doNotRehire.employee.name ?? '—',
            reason: doNotRehire.doNotRehireReason,
            offboardedAt: doNotRehire.completedAt,
          }
        : null,
    })
  },
)
