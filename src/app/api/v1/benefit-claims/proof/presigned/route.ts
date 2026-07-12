// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/benefit-claims/proof/presigned
// 복리후생 청구 증빙 업로드용 self-scoped presigned POST 발급.
// LoA 증빙(#183)과 동일 SSOT 패턴: 키는 서버 생성(세션 식별자만),
// content-length-range 로 크기 강제, FileUpload(PENDING) 단일 소비.
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { withAuth } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { createPresignedUploadPost } from '@/lib/s3'
import { validateFile, getFileSizeLimit } from '@/lib/file-validation'
import {
  BENEFIT_PROOF_PURPOSE,
  PROOF_UPLOAD_EXPIRY_SECONDS,
  isAllowedProofContentType,
  sanitizeFilename,
} from '@/lib/upload/proof-upload'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/types'

const schema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
})

export const POST = withRateLimit(
  withAuth(async (req: NextRequest, _ctx, user: SessionUser) => {
    // FileUpload.uploaderEmployeeId 필수 — 직원 아닌 세션(시스템 계정 등)은 발급 불가
    if (!user.employeeId) {
      throw forbidden('직원 계정만 증빙을 업로드할 수 있습니다.')
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }
    const { filename, contentType, fileSize } = parsed.data

    if (!isAllowedProofContentType(contentType)) {
      throw badRequest('증빙은 PDF 또는 이미지(JPG·PNG·WEBP) 파일만 업로드할 수 있습니다.')
    }
    const validation = validateFile({ filename, contentType, size: fileSize })
    if (!validation.valid) {
      throw badRequest(validation.error ?? '파일 검증에 실패했습니다.')
    }

    const safeName = sanitizeFilename(filename)
    // 키는 세션 식별자만으로 구성 — 클라이언트 입력은 들어가지 않음(크로스테넌트 불가)
    const s3Key = `${user.companyId}/benefit-proof/${randomUUID()}/${safeName}`
    const maxSize = getFileSizeLimit(contentType)

    const post = await createPresignedUploadPost(
      s3Key,
      contentType,
      maxSize,
      PROOF_UPLOAD_EXPIRY_SECONDS,
    )

    const record = await prisma.fileUpload.create({
      data: {
        companyId: user.companyId,
        uploaderEmployeeId: user.employeeId,
        purpose: BENEFIT_PROOF_PURPOSE,
        s3Key,
        filename: safeName,
        contentType,
        declaredSize: fileSize ?? null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + PROOF_UPLOAD_EXPIRY_SECONDS * 1000),
      },
      select: { id: true },
    })

    return apiSuccess({ uploadId: record.id, post, contentType })
  }),
  RATE_LIMITS.FILE_UPLOAD,
)
