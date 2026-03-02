// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /my/internal-jobs (Server Page)
// B4: 내부 공고 — 직원 자기 지원 뷰
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import InternalJobsClient from './InternalJobsClient'

export default async function InternalJobsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <InternalJobsClient user={user} />
}
