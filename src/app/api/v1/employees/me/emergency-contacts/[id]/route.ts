import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const DELETE = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const contact = await prisma.emergencyContact.findFirst({
      where: { id, employeeId: user.employeeId },
    })
    if (!contact) throw notFound('비상연락처를 찾을 수 없습니다.')

    await prisma.emergencyContact.delete({ where: { id } })

    return apiSuccess({ id })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW), // Self-service: scoped to user.employeeId
)
