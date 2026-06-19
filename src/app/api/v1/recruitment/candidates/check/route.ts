// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/candidates/check
// Phase 2 - Session 4: 실시간 중복 후보자 사전 감지 (onBlur)
// 멀티테넌트: Applicant 엔 회사가 없어 지원→공고로 스코프 — 비-SUPER 는 자사 지원이력 후보만.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')?.trim() || null
    const phone = searchParams.get('phone')?.trim() || null

    if (!email && !phone) {
      throw badRequest('email 또는 phone 중 하나 이상을 제공해야 합니다.')
    }

    const isSuper = user.role === ROLE.SUPER_ADMIN
    // 상위: 자사 지원이력이 있는 후보만 매칭(타 법인 후보 존재 여부 노출 차단).
    const companyMatch = isSuper
      ? {}
      : { applications: { some: { posting: { companyId: user.companyId } } } }
    // 중첩: 최근 지원 공고도 자사 한정(타 법인 공고 제목 노출 차단).
    const appWhere = isSuper ? undefined : { posting: { companyId: user.companyId } }

    if (email) {
      // 이메일 정확 매칭 — email 은 unique 지만 회사 스코프 결합 위해 findFirst.
      const found = await prisma.applicant.findFirst({
        where: { email, ...companyMatch },
        select: {
          id: true,
          name: true,
          email: true,
          applications: {
            where: appWhere,
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
        where: { phone, ...companyMatch },
        select: {
          id: true,
          name: true,
          email: true,
          applications: {
            where: appWhere,
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
