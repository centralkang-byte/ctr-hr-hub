'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DashboardShell (Client)
// Sidebar + Header + main wrapper (signOut 핸들러 전달)
// ═══════════════════════════════════════════════════════════

import { useCallback, type ReactNode } from 'react'
import { signOut } from 'next-auth/react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  name: string
  nameEn: string | null
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

  return (
    <>
      <Sidebar user={user} onSignOut={handleSignOut} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} companies={companies} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </>
  )
}
