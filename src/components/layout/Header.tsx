'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Header
// 브레드크럼 + CompanySelector + 언어전환 + 알림 + 사용자 메뉴
// ═══════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { User, Settings, LogOut } from 'lucide-react'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  name: string
  nameEn: string | null
  countryCode?: string | null
}

interface HeaderProps {
  user: SessionUser
  companies: CompanyOption[]
}

// ─── Breadcrumb helper ──────────────────────────────────────

const BREADCRUMB_KEYS: Record<string, string> = {
  employees: 'employees',
  org: 'org',
  attendance: 'attendance',
  leave: 'leave',
  recruitment: 'recruitment',
  performance: 'performance',
  payroll: 'payroll',
  compensation: 'compensation',
  analytics: 'analytics',
  onboarding: 'onboarding',
  offboarding: 'offboarding',
  discipline: 'discipline',
  benefits: 'benefits',
  training: 'training',
  settings: 'settings',
  notifications: 'notifications',
}

// ─── Component ──────────────────────────────────────────────

export function Header({ user, companies }: HeaderProps) {
  const pathname = usePathname()
  const t = useTranslations('menu')
  const tAuth = useTranslations('auth')
  const userInitial = user.name.charAt(0).toUpperCase()

  const currentCompany = companies.find((c) => c.id === user.companyId)
  const countryCode = currentCompany?.countryCode ?? 'KR'

  const breadcrumbs = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      const key = BREADCRUMB_KEYS[seg]
      return key ? t(key) : seg
    })
    .slice(0, 3)

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-6">
      {/* ─── Left: Breadcrumb ─── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{t('home')}</span>
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
        {/* Company Selector */}
        <CompanySelectorWrapper
          companies={companies}
          currentCompanyId={user.companyId}
          userRole={user.role}
        />

        {/* Language Switcher */}
        <LanguageSwitcher countryCode={countryCode} />

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
              <span>{tAuth('myProfile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              <span>{t('settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span>{tAuth('logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ─── CompanySelector Wrapper ────────────────────────────────

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
