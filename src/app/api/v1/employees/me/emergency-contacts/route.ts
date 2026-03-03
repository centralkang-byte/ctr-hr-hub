import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const createSchema = z.object({
  name: z.string().min(1).max(50),
  relationship: z.string().min(1).max(30),
  phone: z.string().min(1).max(20),
  isPrimary: z.boolean().default(false),
})

export const GET = withPermission(
  async (_req: NextRequest, _ctx, user: SessionUser) => {
    const contacts = await prisma.emergencyContact.findMany({
      where: { employeeId: user.employeeId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    })
    return apiSuccess(contacts)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('입력값이 올바르지 않습니다.', { issues: parsed.error.issues })

    // If setting as primary, unset others
    if (parsed.data.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { employeeId: user.employeeId },
        data: { isPrimary: false },
      })
    }

    const contact = await prisma.emergencyContact.create({
      data: { employeeId: user.employeeId, ...parsed.data },
    })

    return apiSuccess(contact, 201)
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
