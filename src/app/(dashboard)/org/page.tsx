// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /org (Server Page)
// 조직도: React Flow + Dagre 레이아웃
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser, RefOption } from '@/types'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

// @xyflow/react + dagre — 이 페이지에서만 사용 (14MB+)
const OrgClient = dynamic(
  () => import('./OrgClient').then(m => ({ default: m.OrgClient })),
  { ssr: false, loading: () => <ChartSkeleton className="h-[600px]" /> },
)

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

  return (
    <Suspense fallback={<ChartSkeleton className="h-[600px]" />}>
      <OrgClient user={user} companies={companies} />
    </Suspense>
  )
}
