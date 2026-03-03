import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().max(50)).max(20).optional(),
  languages: z.any().optional(),
  certifications: z.any().optional(),
  socialLinks: z.any().optional(),
  pronouns: z.string().max(30).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
})

export const GET = withPermission(
  async (_req: NextRequest, _ctx, user: SessionUser) => {
    const ext = await prisma.employeeProfileExtension.findUnique({
      where: { employeeId: user.employeeId },
    })
    return apiSuccess(ext)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('입력값이 올바르지 않습니다.', { issues: parsed.error.issues })

    const ext = await prisma.employeeProfileExtension.upsert({
      where: { employeeId: user.employeeId },
      create: { employeeId: user.employeeId, ...parsed.data },
      update: parsed.data,
    })

    return apiSuccess(ext)
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
