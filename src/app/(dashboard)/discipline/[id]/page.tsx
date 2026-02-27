// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /discipline/[id] (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import DisciplineDetailClient from './DisciplineDetailClient'

export default async function DisciplineDetailPage({
  params,
}: {
  params: Promise<Record<string, string>>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params

  return <DisciplineDetailClient user={user} id={id} />
}
