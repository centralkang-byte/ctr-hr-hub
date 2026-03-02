// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/talent-pool
// B4: Talent Pool 목록 + 수동 등록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
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

    // 만료된 항목 자동 상태 업데이트 (비동기, 결과 무시)
    prisma.talentPoolEntry.updateMany({
      where: { status: 'active', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    }).catch(() => {})

    const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []

    const where: Record<string, unknown> = {}
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
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const { applicantId, sourcePostingId, poolReason, tags, notes, consentGiven } = parsed.data

    // 동일 applicant가 이미 active 상태면 중복 등록 방지
    const existing = await prisma.talentPoolEntry.findFirst({
      where: { applicantId, status: 'active' },
    })
    if (existing) throw badRequest('이미 Talent Pool에 등록된 후보자입니다.')

    // 2년 만료 (GDPR 기준)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 2)

    try {
      const entry = await prisma.talentPoolEntry.create({
        data: {
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
