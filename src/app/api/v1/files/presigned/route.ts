// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/files/presigned
// S3 Presigned Upload URL 발급
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { getPresignedUploadUrl, buildS3Key } from '@/lib/s3'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { z } from 'zod'

const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  entityType: z.string().min(1), // e.g. 'handover', 'document'
  entityId: z.string().uuid(),
})

export const POST = withPermission(
  async (req: NextRequest, _ctx: unknown, user: SessionUser) => {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const { filename, contentType, entityType, entityId } = parsed.data
    const key = buildS3Key(user.companyId, entityType, entityId, filename)
    const uploadUrl = await getPresignedUploadUrl(key, contentType)

    return apiSuccess({ uploadUrl, key })
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
