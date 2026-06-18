// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/talent-pool
// B4: Talent Pool 목록 + 수동 등록
// 멀티테넌트: company_id anchor 로 스코프 — 비-SUPER 는 자사 풀만, SUPER 는 전사.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  status: z.enum(['active', 'contacted', 'expired', 'hired']).optional(),
  poolReason: z.string().optional(),
  tags: z.string().optional(), // comma-separated
})

const createSchema = z.object({
  applicantId: z.string().uuid(),
  sourcePostingId: z.string().uuid().optional(),
  // SUPER 가 출처 공고 없이 등록할 때만 사용(비-SUPER 는 무시·자사 강제). 지원이력 없는 후보 등록용.
  companyId: z.string().uuid().optional(),
  poolReason: z.enum(['rejected_qualified', 'withdrawn', 'overqualified', 'manual']),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  consentGiven: z.boolean().default(false),
})

// ─── GET: Talent Pool 목록 ────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.')

    const { page, limit, search, status, poolReason, tags } = parsed.data
    const skip = (page - 1) * limit

    // 만료된 항목 자동 상태 업데이트 (비동기, 결과 무시) — 회사 스코프(SUPER 는 전사).
    prisma.talentPoolEntry.updateMany({
      where: { ...resolveCompanyFilter(user), status: 'active', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    }).catch(() => {})

    const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []

    // 멀티테넌트: 비-SUPER 는 자사 풀만(NULL-company 행도 제외=fail-closed), SUPER 는 전사({}).
    const where: Record<string, unknown> = { ...resolveCompanyFilter(user) }
    if (status) where.status = status
    if (poolReason) where.poolReason = poolReason
    if (tagList.length > 0) where.tags = { hasSome: tagList }
    if (search) {
      where.applicant = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    // 중첩 지원이력도 회사 스코프(공유 다법인 후보의 타 법인 이력 노출 차단). SUPER 는 전체.
    const appWhere =
      user.role === ROLE.SUPER_ADMIN ? undefined : { posting: { companyId: user.companyId } }

    const [total, data] = await Promise.all([
      prisma.talentPoolEntry.count({ where }),
      prisma.talentPoolEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              source: true,
              applications: {
                where: appWhere,
                select: {
                  stage: true,
                  posting: { select: { title: true, company: { select: { name: true } } } },
                  appliedAt: true,
                },
                orderBy: { appliedAt: 'desc' },
                take: 3,
              },
            },
          },
          sourcePosting: { select: { id: true, title: true } },
        },
      }),
    ])

    return apiPaginated(data, buildPagination(page, limit, total))
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── POST: 수동 Talent Pool 등록 ──────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const { applicantId, sourcePostingId, companyId: requestedCompanyId, poolReason, tags, notes, consentGiven } = parsed.data

    // ── 회사 결정 + 소유권 검증 (멀티테넌트 anchor) ──
    let targetCompanyId: string

    if (user.role === ROLE.SUPER_ADMIN) {
      if (sourcePostingId) {
        const posting = await prisma.jobPosting.findUnique({
          where: { id: sourcePostingId },
          select: { companyId: true },
        })
        if (!posting) throw badRequest('출처 공고를 찾을 수 없습니다.')
        if (requestedCompanyId && requestedCompanyId !== posting.companyId) {
          throw badRequest('지정한 회사와 출처 공고의 회사가 일치하지 않습니다.')
        }
        targetCompanyId = posting.companyId
      } else if (requestedCompanyId) {
        targetCompanyId = requestedCompanyId
      } else {
        // 지원이력의 회사가 단 하나일 때만 자동 귀속 — 다법인/무이력은 명시 요구.
        const apps = await prisma.application.findMany({
          where: { applicantId },
          select: { posting: { select: { companyId: true } } },
        })
        const distinct = [...new Set(apps.map((a) => a.posting.companyId))]
        if (distinct.length !== 1) {
          throw badRequest('회사를 특정할 수 없습니다. companyId 또는 출처 공고를 지정하세요.')
        }
        targetCompanyId = distinct[0]
      }
    } else {
      // 비-SUPER: 자사 강제. 후보자가 자사 공고에 지원한 이력이 **항상** 있어야 등록 가능.
      // ⚠️ sourcePosting 자사검증만으론 우회 가능(자사 공고 + 타 법인 후보 조합으로 PII 흡수) → Codex G2 P0.
      targetCompanyId = user.companyId
      if (sourcePostingId) {
        const posting = await prisma.jobPosting.findFirst({
          where: { id: sourcePostingId, companyId: user.companyId },
          select: { id: true },
        })
        if (!posting) throw forbidden('해당 공고에 대한 권한이 없습니다.')
      }
      // 핵심 소유권 게이트: 후보자가 자사 공고에 지원한 이력이 있어야 함(타 법인 후보 차단).
      const ownApp = await prisma.application.findFirst({
        where: { applicantId, posting: { companyId: user.companyId } },
        select: { id: true },
      })
      if (!ownApp) throw forbidden('해당 후보자를 풀에 등록할 권한이 없습니다.')
    }

    // 동일 회사 active 중복 방지(다법인 동일후보는 허용). DB partial-unique 가 race 백스톱.
    const existing = await prisma.talentPoolEntry.findFirst({
      where: { companyId: targetCompanyId, applicantId, status: 'active' },
    })
    if (existing) throw badRequest('이미 Talent Pool에 등록된 후보자입니다.')

    // 2년 만료 (GDPR 기준)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 2)

    try {
      const entry = await prisma.talentPoolEntry.create({
        data: {
          companyId: targetCompanyId,
          applicantId,
          sourcePostingId: sourcePostingId ?? null,
          poolReason,
          tags,
          notes: notes ?? null,
          consentGiven,
          expiresAt,
          status: 'active',
        },
      })
      return apiSuccess(entry, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
