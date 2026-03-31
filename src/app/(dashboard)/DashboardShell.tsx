'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DashboardShell (Client)
// Sidebar + Header + MobileDrawer + main wrapper
// ═══════════════════════════════════════════════════════════

import { useCallback, useState, type ReactNode } from 'react'
import { signOut } from 'next-auth/react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileDrawer } from '@/components/layout/MobileDrawer'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ThemeToggle } from '@/components/theme-toggle'
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
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: '/login' })
  }, [])

  const handleOpenDrawer = useCallback(() => setDrawerOpen(true), [])
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), [])

  const currentCountryCode = companies.find((c) => c.id === user.companyId)?.countryCode ?? null

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar user={user} onSignOut={handleSignOut} countryCode={currentCountryCode ?? undefined} />
      </div>

      {/* Mobile drawer — hidden on desktop */}
      <MobileDrawer isOpen={drawerOpen} onClose={handleCloseDrawer}>
        <Sidebar
          user={user}
          onSignOut={handleSignOut}
          countryCode={currentCountryCode ?? undefined}
          mode="drawer"
          onItemClick={handleCloseDrawer}
        />
      </MobileDrawer>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} companies={companies} onMenuClick={handleOpenDrawer} />
        <main className="flex-1 overflow-auto bg-muted p-4 md:p-6 pb-20 md:pb-6">
          <ErrorBoundary>{children}</ErrorBoundary>
          {/* Dark mode toggle — 좌하단 고정 */}
          <div className="fixed bottom-20 md:bottom-6 left-4 md:left-[17rem] z-40">
            <ThemeToggle />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav — quick access to 4 key sections */}
      <MobileBottomNav />
    </>
  )
}
