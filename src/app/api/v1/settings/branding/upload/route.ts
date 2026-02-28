// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Branding Upload API
// POST: S3 presigned URL 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import { getPresignedUploadUrl, buildS3Key } from '@/lib/s3'
import { presignedUploadSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = presignedUploadSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { entityType, filename, contentType } = parsed.data
    const key = buildS3Key(user.companyId, entityType, 'branding', filename)
    const uploadUrl = await getPresignedUploadUrl(key, contentType)

    return apiSuccess({
      uploadUrl,
      key,
      publicUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    }, 201)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
