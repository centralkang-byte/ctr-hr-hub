import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { getPresignedUploadUrl } from '@/lib/s3'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const requestSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  fileName: z.string().min(1).max(200),
})

// POST — 아바타 업로드용 Presigned URL 발급 + DB에 경로 저장
export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) throw badRequest('입력값이 올바르지 않습니다.', { issues: parsed.error.issues })

    const { contentType } = parsed.data
    const ext = contentType.split('/')[1]
    const key = `avatars/${user.employeeId}/${Date.now()}.${ext}`

    const uploadUrl = await getPresignedUploadUrl(key, contentType, 300)

    // Save path to DB (optimistic — frontend uploads and then calls confirm)
    await prisma.employeeProfileExtension.upsert({
      where: { employeeId: user.employeeId },
      create: { employeeId: user.employeeId, avatarPath: key },
      update: { avatarPath: key },
    })

    return apiSuccess({ uploadUrl, key })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW), // Self-service: scoped to user.employeeId
)
