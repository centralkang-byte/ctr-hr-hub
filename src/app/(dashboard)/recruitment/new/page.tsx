// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/new (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import PostingFormClient from './PostingFormClient'

export default async function RecruitmentNewPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return <PostingFormClient user={user} />
}
