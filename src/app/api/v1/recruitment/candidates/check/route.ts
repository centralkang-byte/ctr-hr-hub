// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/candidates/check
// Phase 2 - Session 4: 실시간 중복 후보자 사전 감지 (onBlur)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')?.trim() || null
    const phone = searchParams.get('phone')?.trim() || null

    if (!email && !phone) {
      throw badRequest('email 또는 phone 중 하나 이상을 제공해야 합니다.')
    }

    if (email) {
      // 이메일 정확 매칭
      const found = await prisma.applicant.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          applications: {
            orderBy: { appliedAt: 'desc' },
            take: 1,
            select: {
              appliedAt: true,
              posting: { select: { title: true } },
            },
          },
        },
      })

      if (found) {
        const lastApp = found.applications[0]
        return apiSuccess({
          exists: true,
          field: 'email' as const,
          candidate: {
            name: found.name,
            email: found.email,
            appliedJobTitle: lastApp?.posting?.title ?? null,
          },
        })
      }
    }

    if (phone) {
      // 전화번호 정확 매칭
      const found = await prisma.applicant.findFirst({
        where: { phone },
        select: {
          id: true,
          name: true,
          email: true,
          applications: {
            orderBy: { appliedAt: 'desc' },
            take: 1,
            select: {
              appliedAt: true,
              posting: { select: { title: true } },
            },
          },
        },
      })

      if (found) {
        const lastApp = found.applications[0]
        return apiSuccess({
          exists: true,
          field: 'phone' as const,
          candidate: {
            name: found.name,
            email: found.email,
            appliedJobTitle: lastApp?.posting?.title ?? null,
          },
        })
      }
    }

    return apiSuccess({ exists: false, field: email ? 'email' : 'phone', candidate: null })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
