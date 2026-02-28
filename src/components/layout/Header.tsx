'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Header
// 브레드크럼 + CompanySelector + 알림 + 사용자 메뉴
// ═══════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { User, Settings, LogOut } from 'lucide-react'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ko } from '@/lib/i18n/ko'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  name: string
  nameEn: string | null
}

interface HeaderProps {
  user: SessionUser
  companies: CompanyOption[]
}

// ─── Breadcrumb helper ──────────────────────────────────────

const BREADCRUMB_MAP: Record<string, string> = {
  employees: ko.menu.employees,
  org: ko.menu.org,
  attendance: ko.menu.attendance,
  leave: ko.menu.leave,
  recruitment: ko.menu.recruitment,
  performance: ko.menu.performance,
  payroll: ko.menu.payroll,
  compensation: ko.menu.compensation,
  analytics: ko.menu.analytics,
  onboarding: ko.menu.onboarding,
  offboarding: ko.menu.offboarding,
  discipline: ko.menu.discipline,
  benefits: ko.menu.benefits,
  training: ko.menu.training,
  settings: ko.menu.settings,
  notifications: '알림',
}

function getBreadcrumbs(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean)
  return segments
    .map((seg) => BREADCRUMB_MAP[seg] ?? seg)
    .slice(0, 3)
}

// ─── Component ──────────────────────────────────────────────

export function Header({ user, companies }: HeaderProps) {
  const pathname = usePathname()
  const breadcrumbs = getBreadcrumbs(pathname)
  const userInitial = user.name.charAt(0).toUpperCase()

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-6">
      {/* ─── Left: Breadcrumb ─── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{ko.menu.home}</span>
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            <span className="text-muted-foreground/50">/</span>
            <span
              className={
                idx === breadcrumbs.length - 1
                  ? 'font-medium text-foreground'
                  : ''
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* ─── Right: Actions ─── */}
      <div className="flex items-center gap-3">
        {/* Company Selector — lazy import to avoid SSR issues */}
        <CompanySelectorWrapper
          companies={companies}
          currentCompanyId={user.companyId}
          userRole={user.role}
        />

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-ctr-gray-50"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-ctr-primary text-xs text-white">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">
                {user.name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" />
              <span>내 프로필</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              <span>설정</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span>{ko.auth.logout}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ─── CompanySelector Wrapper ────────────────────────────────
// Inline wrapper to pass props without dynamic import complexity

import { CompanySelector } from '@/components/shared/CompanySelector'

function CompanySelectorWrapper({
  companies,
  currentCompanyId,
  userRole,
}: {
  companies: CompanyOption[]
  currentCompanyId: string
  userRole: string
}) {
  return (
    <CompanySelector
      companies={companies}
      currentCompanyId={currentCompanyId}
      userRole={userRole}
    />
  )
}
