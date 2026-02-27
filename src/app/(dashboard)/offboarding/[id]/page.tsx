// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /offboarding/:id (Server Page)
// 퇴직 처리 상세 페이지
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { OffboardingDetailClient } from './OffboardingDetailClient'

export default async function OffboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as unknown as SessionUser
  const { id } = await params

  return <OffboardingDetailClient user={user} offboardingId={id} />
}
