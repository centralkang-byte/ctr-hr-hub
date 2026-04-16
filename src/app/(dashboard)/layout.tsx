// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Layout (Server Component)
// 세션 확인 → Sidebar + Header + main content
// ═══════════════════════════════════════════════════════════

// getServerSession internally calls headers(), which auto-opts into dynamic rendering.
// Explicit 'force-dynamic' is redundant — removed in Phase 7 performance optimization.


import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { getCompaniesForUser } from '@/lib/company/getCompanies'
import nextDynamic from 'next/dynamic'
import { BrandProvider } from '@/components/shared/BrandProvider'
import { DashboardShell } from './DashboardShell'

// Floating UI — lazy-loaded, zero CLS impact (modals/FABs/banners)
const CommandPalette = nextDynamic(
  () => import('@/components/command-palette/CommandPalette').then(m => m.CommandPalette),
  { loading: () => null },
)
const HrChatbot = nextDynamic(
  () => import('@/components/hr-chatbot/HrChatbot').then(m => m.HrChatbot),
  { loading: () => null },
)
const PwaInstallBanner = nextDynamic(
  () => import('@/components/shared/PwaInstallBanner').then(m => m.PwaInstallBanner),
  { loading: () => null },
)
const ServiceWorkerRegistrar = nextDynamic(
  () => import('@/components/shared/ServiceWorkerRegistrar').then(m => m.ServiceWorkerRegistrar),
  { loading: () => null },
)
const SessionTimeoutWarning = nextDynamic(
  () => import('@/components/shared/SessionTimeoutWarning').then(m => m.SessionTimeoutWarning),
  { loading: () => null },
)

// ─── Layout ─────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // B-3k: Pre-hire check — redirect if no active assignment
  // React cache() dedup: same employeeId within single request = 1 DB query
  const primaryAssignment = await fetchPrimaryAssignment(user.employeeId)
  if (!primaryAssignment) {
    redirect('/pre-hire')
  }

  // Load companies — React cache() + Redis (5min TTL)
  const companies = await getCompaniesForUser(user.role, user.companyId)

  return (
    <BrandProvider companyId={user.companyId}>
      <div className="flex h-screen overflow-hidden bg-muted">
        <DashboardShell user={user} companies={companies}>
          {children}
        </DashboardShell>
      </div>
      <CommandPalette />
      <HrChatbot />
      <PwaInstallBanner />
      <ServiceWorkerRegistrar />
      <SessionTimeoutWarning />
    </BrandProvider>
  )
}
