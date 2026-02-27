// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /discipline/new (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import DisciplineFormClient from './DisciplineFormClient'

export default async function DisciplineNewPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return <DisciplineFormClient user={user} />
}
