// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /discipline/rewards/[id] (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import RewardDetailClient from './RewardDetailClient'

export default async function RewardDetailPage({
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

  return <RewardDetailClient user={user} id={id} />
}
