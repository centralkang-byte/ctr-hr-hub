// src/app/api/v1/benefit-claims/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { ROLE } from '@/lib/constants'
import { z } from 'zod'
import { getObjectRange, copyObject } from '@/lib/s3'
import { validateMagicBytes } from '@/lib/file-validation'
import { BENEFIT_PROOF_PURPOSE } from '@/lib/upload/proof-upload'
import type { SessionUser } from '@/types'

const CONSUMED_BY_BENEFIT = 'BENEFIT_CLAIM'

const createSchema = z.object({
  benefitPlanId: z.string().uuid(),
  claimAmount: z.number().int().positive(),
  eventDate: z.string().optional(),
  eventDetail: z.string().max(500).optional(),
  // 증빙은 자유 문자열이 아니라 FileUpload(presigned 업로드) id 단일 소비·검증 (#183 SSOT)
  proofUploadIds: z.array(z.string().uuid()).max(5).default([]),
  notes: z.string().max(500).optional(),
})

export const GET = withAuth(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'mine'
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit

    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

    let where: Record<string, unknown> = {}

    if (!isHR || view === 'mine') {
      where.employeeId = user.employeeId
    } else if (view === 'pending') {
      where = {
        status: 'pending',
        employee: {
          assignments: {
            some: { companyId: user.companyId, isPrimary: true, endDate: null },
          },
        },
      }
    } else {
      // view === 'all'
      where = {
        employee: {
          assignments: {
            some: { companyId: user.companyId, isPrimary: true, endDate: null },
          },
        },
      }
    }

    if (status && view !== 'pending') where.status = status

    const [claims, total] = await Promise.all([
      prisma.benefitClaim.findMany({
        where,
        include: {
          benefitPlan: { select: { id: true, name: true, category: true, benefitType: true, currency: true } },
          employee: { select: { id: true, name: true, employeeNo: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.benefitClaim.count({ where }),
    ])

    return apiPaginated(claims, buildPagination(page, limit, total))
  },
)

export const POST = withAuth(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { benefitPlanId, claimAmount, eventDate, eventDetail, proofUploadIds, notes } = parsed.data

    // 같은 uploadId 중복 제출은 사전 거부 (사전 copy 후 tx 소비 실패로 orphan만 남김)
    if (new Set(proofUploadIds).size !== proofUploadIds.length) {
      throw badRequest('중복된 증빙 업로드가 포함되어 있습니다.')
    }

    const plan = await prisma.benefitPlan.findFirst({
      where: { id: benefitPlanId, companyId: user.companyId, deletedAt: null },
    })
    if (!plan) throw badRequest('복리후생 항목을 찾을 수 없습니다.')

    if (plan.requiresProof && proofUploadIds.length === 0) {
      throw badRequest('이 복리후생 항목은 증빙 서류가 필요합니다.')
    }

    if (plan.benefitType === 'fixed_amount' && plan.amount && claimAmount !== plan.amount) {
      throw badRequest(`고정금액 항목입니다. 신청금액: ${plan.amount.toLocaleString()}`)
    }
    if (plan.maxAmount && claimAmount > plan.maxAmount) {
      throw badRequest(`최대 신청 한도(${plan.maxAmount.toLocaleString()})를 초과했습니다.`)
    }

    if (plan.frequency === 'annual' && plan.maxAmount) {
      const year = new Date().getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year + 1, 0, 1)
      const usedThisYear = await prisma.benefitClaim.aggregate({
        where: {
          benefitPlanId,
          employeeId: user.employeeId,
          status: { in: ['pending', 'approved', 'paid'] },
          createdAt: { gte: startOfYear, lt: endOfYear },
        },
        _sum: { claimAmount: true },
      })
      const usedAmount = usedThisYear._sum.claimAmount ?? 0
      if (usedAmount + claimAmount > plan.maxAmount) {
        throw badRequest(
          `연간 한도 초과. 잔여 한도: ${(plan.maxAmount - usedAmount).toLocaleString()}`
        )
      }
    }

    // 증빙 사전 검증(트랜잭션 밖): 소유권·상태·만료(DB) + magic-byte(형식 위조 차단)
    // + ETag 고정 복사(불변 키) — LoA(#183)와 동일 패턴. 롤백 시 -final orphan은 허용.
    const finalProofs: { uploadId: string; finalKey: string }[] = []
    for (const uploadId of proofUploadIds) {
      const fu = await prisma.fileUpload.findFirst({
        where: {
          id: uploadId,
          companyId: user.companyId,
          uploaderEmployeeId: user.employeeId,
          purpose: BENEFIT_PROOF_PURPOSE,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        select: { s3Key: true, filename: true, contentType: true },
      })
      if (!fu) throw badRequest('유효하지 않거나 만료된 증빙 업로드입니다. 다시 업로드해 주세요.')
      const head = await getObjectRange(fu.s3Key, 16)
      if (!head) throw badRequest('증빙 파일이 업로드되지 않았습니다. 다시 시도해 주세요.')
      if (!head.etag) throw badRequest('증빙 검증에 실패했습니다. 다시 시도해 주세요.')
      const magic = validateMagicBytes(head.bytes, fu.contentType)
      if (!magic.valid) throw badRequest(magic.error ?? '증빙 파일 형식이 올바르지 않습니다.')
      const finalKey = `${user.companyId}/benefit-proof-final/${uploadId}/${fu.filename}`
      try {
        await copyObject(fu.s3Key, finalKey, head.etag)
      } catch (e) {
        const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
        const name = (e as { name?: string })?.name
        if (status === 412 || name === 'PreconditionFailed') {
          throw badRequest('증빙 파일이 검증 중 변경되었습니다. 다시 업로드해 주세요.')
        }
        throw e
      }
      finalProofs.push({ uploadId, finalKey })
    }

    const claim = await prisma.$transaction(async (tx) => {
      // 단일 소비: PENDING → CONSUMED 원자적 조건부 갱신. count!==1 이면 롤백.
      for (const { uploadId } of finalProofs) {
        const consumed = await tx.fileUpload.updateMany({
          where: {
            id: uploadId,
            companyId: user.companyId,
            uploaderEmployeeId: user.employeeId,
            purpose: BENEFIT_PROOF_PURPOSE,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
          data: {
            status: 'CONSUMED',
            consumedAt: new Date(),
            consumedByType: CONSUMED_BY_BENEFIT,
          },
        })
        if (consumed.count !== 1) {
          throw badRequest('증빙 업로드가 이미 사용되었거나 만료되었습니다. 다시 업로드해 주세요.')
        }
      }

      const created = await tx.benefitClaim.create({
        data: {
          benefitPlanId,
          employeeId: user.employeeId,
          claimAmount,
          eventDate: eventDate ? new Date(eventDate) : null,
          eventDetail: eventDetail ?? null,
          proofPaths: finalProofs.map((p) => p.finalKey),
          notes: notes ?? null,
          status: 'pending',
        },
        include: {
          benefitPlan: { select: { id: true, name: true, category: true, benefitType: true, currency: true } },
        },
      })

      if (finalProofs.length > 0) {
        await tx.fileUpload.updateMany({
          where: { id: { in: finalProofs.map((p) => p.uploadId) } },
          data: { consumedById: created.id },
        })
      }

      return created
    })

    return apiSuccess(claim, 201)
  },
)
