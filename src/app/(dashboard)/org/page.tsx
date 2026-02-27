// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /org (Server Page)
// 조직도: React Flow + Dagre 레이아웃
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser, RefOption } from '@/types'
import { OrgClient } from './OrgClient'

export default async function OrgPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  const companies: RefOption[] =
    user.role === ROLE.SUPER_ADMIN
      ? await prisma.company.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : []

  return <OrgClient user={user} companies={companies} />
}
