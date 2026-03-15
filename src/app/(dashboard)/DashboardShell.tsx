'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DashboardShell (Client)
// Sidebar + Header + main wrapper (signOut 핸들러 전달)
// ═══════════════════════════════════════════════════════════

import { useCallback, type ReactNode } from 'react'
import { signOut } from 'next-auth/react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  name: string
  nameEn: string | null
  countryCode?: string | null
}

interface DashboardShellProps {
  user: SessionUser
  companies: CompanyOption[]
  children: ReactNode
}

// ─── Component ──────────────────────────────────────────────

export function DashboardShell({ user, companies, children }: DashboardShellProps) {
  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: '/login' })
  }, [])

  const currentCountryCode = companies.find((c) => c.id === user.companyId)?.countryCode ?? null

  return (
    <>
      <div className="hidden md:flex">
        <Sidebar user={user} onSignOut={handleSignOut} countryCode={currentCountryCode ?? undefined} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} companies={companies} />
        <main className="flex-1 overflow-auto bg-[#F5F5FA] p-6 pb-16 md:pb-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
      <MobileBottomNav />
    </>
  )
}
