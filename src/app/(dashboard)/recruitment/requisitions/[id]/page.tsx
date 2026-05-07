// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/requisitions/[id] (Server Page)
// 채용 요청 상세 (Session 203 — list/[id] route 미존재 broken 해소)
// ═══════════════════════════════════════════════════════════

import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { hasPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import RequisitionDetailClient from './RequisitionDetailClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('recruitment')
  return { title: t('pageTitle_requisitions') }
}

export default async function RequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const { id } = await params
  // Capability: list page와 동일 SSOT (permission 기준).
  // canViewAll=false인 사용자(dept_head/direct_manager 결재자, requester 본인)도
  // 자기와 관련된 요청 detail은 조회 가능 (Session 202 GET route — viewer OR requester
  // OR current approver). 페이지 ACL은 ALL_ROLES, API가 실 권한 게이트.
  const canViewAll = hasPermission(user, perm(MODULE.RECRUITMENT, ACTION.VIEW))
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <RequisitionDetailClient id={id} user={user} canViewAll={canViewAll} />
    </Suspense>
  )
}
