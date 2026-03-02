// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/requisitions (Server Page)
// B4: 채용 요청 목록 + 승인함
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import RequisitionListClient from './RequisitionListClient'

export default async function RequisitionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <RequisitionListClient user={user} />
}
