// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/benefit-claims/[id]/proof
// 청구 증빙 presigned 다운로드 URL 발급.
// authz: 본인 OR (HR/SUPER + 소유 법인 일치) — [id] GET 과 동일 파생
// (소유 법인 = benefitPlan.companyId ?? 직원 현재 primary 발령 법인).
// 서버 생성 불변 키(-final prefix)만 서명 — 레거시 자유 문자열 proofPaths 는 제외.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { ROLE } from '@/lib/constants'
import { getPresignedDownloadUrl } from '@/lib/s3'
import {
  BENEFIT_PROOF_PURPOSE,
  parseBenefitFinalKey,
  isServerIssuedBenefitFinalKey,
} from '@/lib/upload/proof-upload'
import type { SessionUser } from '@/types'

const DOWNLOAD_EXPIRY_SECONDS = 300

export const GET = withRateLimit(
  withAuth(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
      const { id } = await context.params
      const claim = await prisma.benefitClaim.findUnique({
        where: { id },
        select: {
          employeeId: true,
          proofPaths: true,
          benefitPlan: { select: { companyId: true } },
          employee: {
            select: {
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                select: { companyId: true },
              },
            },
          },
        },
      })
      if (!claim) throw notFound('신청 내역을 찾을 수 없습니다.')

      const isSelf = claim.employeeId === user.employeeId
      const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
      const ownerCompany = claim.benefitPlan.companyId ?? claim.employee.assignments[0]?.companyId
      const sameCompany = user.role === ROLE.SUPER_ADMIN || ownerCompany === user.companyId
      if (!isSelf && (!isHR || !sameCompany)) throw forbidden()

      // 레거시 proofPaths(자유 문자열 시절)에 위조 final-형태 키가 있을 수 있으므로,
      // 키에서 uploadId 를 추출해 "이 청구에 소비된 FileUpload" 와 등치 대조한 것만 서명.
      const parsed = claim.proofPaths
        .map((key, index) => ({ key, index, parts: parseBenefitFinalKey(key) }))
        .filter((p): p is typeof p & { parts: NonNullable<typeof p.parts> } => p.parts !== null)

      const uploads = parsed.length
        ? await prisma.fileUpload.findMany({
            where: {
              id: { in: parsed.map((p) => p.parts.uploadId) },
              purpose: BENEFIT_PROOF_PURPOSE,
              status: 'CONSUMED',
              consumedById: id,
            },
            select: { id: true, companyId: true, filename: true },
          })
        : []
      const uploadById = new Map(uploads.map((u) => [u.id, u]))

      const files = await Promise.all(
        parsed
          .filter(({ key, parts }) => {
            const fu = uploadById.get(parts.uploadId)
            return fu !== undefined && isServerIssuedBenefitFinalKey(key, fu)
          })
          .map(async ({ key, index }) => ({
            index,
            filename: key.split('/').pop() ?? 'proof',
            url: await getPresignedDownloadUrl(key, DOWNLOAD_EXPIRY_SECONDS),
          })),
      )

      return apiSuccess({ files })
    },
  ),
  RATE_LIMITS.GENERAL,
)
