// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Approval Inbox Page (Stage 5-B)
// /(dashboard)/approvals/inbox
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { ApprovalInboxClient } from './ApprovalInboxClient'

export const metadata = {
  title: '승인함 — CTR HR Hub',
  description: '처리가 필요한 승인 요청을 한 곳에서 확인하세요.',
}

// Only MANAGER, HR_ADMIN, EXECUTIVE can access
const ALLOWED_ROLES = new Set([ROLE.MANAGER, ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.SUPER_ADMIN])

export default async function ApprovalInboxPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  if (!ALLOWED_ROLES.has(user.role as never)) {
    redirect('/home')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <ApprovalInboxClient user={user} />
    </div>
  )
}
