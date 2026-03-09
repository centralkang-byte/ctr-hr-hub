// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/board (Server Page)
// ATS 스윔레인 칸반 보드 — 공고별 가로 레인
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import BoardClient from './BoardClient'

export default async function RecruitmentBoardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  return <BoardClient user={user} />
}
