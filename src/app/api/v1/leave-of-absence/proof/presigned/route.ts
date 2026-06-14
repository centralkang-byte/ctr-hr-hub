// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/leave-of-absence/proof/presigned
// 휴직 증빙 업로드용 self-scoped presigned POST 발급.
// - 키는 서버에서 {companyId}/loa-proof/{uuid}/{filename} 로 생성(세션 식별자만).
// - presigned POST 의 content-length-range 로 업로드 크기를 S3 수집 시점에 강제.
// - FileUpload(PENDING) 레코드를 만들어 제출 시 단일 소비·검증.
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { withAuth, hasPermission, perm } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { MODULE, ACTION } from '@/lib/constants'
import { createPresignedUploadPost } from '@/lib/s3'
import { validateFile, getFileSizeLimit } from '@/lib/file-validation'
import {
  LOA_PROOF_PURPOSE,
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
    // 휴직 신청 가능자(self: create/update/manage 중 하나, 대리: manage)만 증빙 업로드 발급
    const canWriteLeave =
      hasPermission(user, perm(MODULE.LEAVE, ACTION.CREATE)) ||
      hasPermission(user, perm(MODULE.LEAVE, ACTION.UPDATE)) ||
      hasPermission(user, perm(MODULE.LEAVE, ACTION.APPROVE))
    if (!canWriteLeave) {
      throw forbidden('휴직 증빙 업로드 권한이 없습니다.')
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }
    const { filename, contentType, fileSize } = parsed.data

    // 증빙 허용 형식(pdf/사진)만
    if (!isAllowedProofContentType(contentType)) {
      throw badRequest('증빙은 PDF 또는 이미지(JPG·PNG·WEBP) 파일만 업로드할 수 있습니다.')
    }
    // 확장자·MIME·크기 검증 (서버 1차)
    const validation = validateFile({ filename, contentType, size: fileSize })
    if (!validation.valid) {
      throw badRequest(validation.error ?? '파일 검증에 실패했습니다.')
    }

    const safeName = sanitizeFilename(filename)
    // 키는 세션 식별자만으로 구성 — 클라이언트 입력은 들어가지 않음(크로스테넌트 불가)
    const s3Key = `${user.companyId}/loa-proof/${randomUUID()}/${safeName}`
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
        purpose: LOA_PROOF_PURPOSE,
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
