// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /onboarding (Server Page)
// ═══════════════════════════════════════════════════════════

import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { OnboardingDashboardClient } from './OnboardingDashboardClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('onboarding')
  return { title: t('pageTitle') }
}

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // SUPER_ADMIN에게는 법인 목록 제공 (법인 필터용)
  const companies =
    user.role === ROLE.SUPER_ADMIN
      ? await prisma.company.findMany({
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        })
      : []

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <OnboardingDashboardClient user={user} companies={companies} />
    </Suspense>
  )
}
