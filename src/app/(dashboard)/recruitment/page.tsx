// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import RecruitmentListClient from './RecruitmentListClient'

export default async function RecruitmentPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return <RecruitmentListClient user={user} />
}
