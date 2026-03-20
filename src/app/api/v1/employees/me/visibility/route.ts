import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const VISIBILITY_LEVELS = ['public', 'team', 'manager', 'private'] as const

const updateSchema = z.object({
  personalPhone: z.enum(VISIBILITY_LEVELS).optional(),
  personalEmail: z.enum(VISIBILITY_LEVELS).optional(),
  birthDate: z.enum(VISIBILITY_LEVELS).optional(),
  address: z.enum(VISIBILITY_LEVELS).optional(),
  emergencyContact: z.enum(VISIBILITY_LEVELS).optional(),
  bio: z.enum(VISIBILITY_LEVELS).optional(),
  skills: z.enum(VISIBILITY_LEVELS).optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, _ctx, user: SessionUser) => {
    const vis = await prisma.profileVisibility.findUnique({
      where: { employeeId: user.employeeId },
    })
    return apiSuccess(vis)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('입력값이 올바르지 않습니다.', { issues: parsed.error.issues })

    const vis = await prisma.profileVisibility.upsert({
      where: { employeeId: user.employeeId },
      create: { employeeId: user.employeeId, ...parsed.data },
      update: parsed.data,
    })

    return apiSuccess(vis)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW), // Self-service: scoped to user.employeeId
)
