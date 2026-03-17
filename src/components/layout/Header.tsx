'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Header
// 브레드크럼 + CompanySelector + 언어전환 + 알림 + 사용자 메뉴
// ═══════════════════════════════════════════════════════════

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { User, Settings, LogOut, Users, Menu } from 'lucide-react'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { QuickActionsMenu } from '@/components/layout/QuickActionsMenu'
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
  onMenuClick?: () => void
}

// ─── Breadcrumb helper ──────────────────────────────────────

const BREADCRUMB_KEYS: Record<string, string> = {
  // Main modules
  home: 'home',
  my: 'my',
  dashboard: 'dashboard',
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
  compliance: 'compliance',
  directory: 'directory',
  // Payroll sub-routes
  'year-end': 'year-end',
  'close-attendance': 'close-attendance',
  adjustments: 'adjustments',
  anomalies: 'anomalies',
  approve: 'approve',
  publish: 'publish',
  'bank-transfers': 'bank-transfers',
  global: 'global',
  simulation: 'simulation',
  import: 'import',
  // Analytics sub-routes
  turnover: 'turnover',
  workforce: 'workforce',
  'team-health': 'team-health',
  'gender-pay-gap': 'gender-pay-gap',
  predictive: 'predictive',
  compare: 'compare',
  report: 'report',
  // Performance sub-routes
  'peer-review': 'peer-review',
  'self-eval': 'self-eval',
  'comp-review': 'comp-review',
  recognition: 'recognition',
  'one-on-one': 'one-on-one',
  pulse: 'pulse',
  cycles: 'cycles',
  // Other sub-routes
  admin: 'admin',
  team: 'team',
  profile: 'profile',
  tasks: 'tasks',
  rewards: 'rewards',
  new: 'new',
  edit: 'edit',
  review: 'review',
  me: 'me',
  // Approvals
  approvals: 'approvals',
  inbox: 'inbox',
  // Goals & Organization
  goals: 'goals',
  organization: 'organization',
  succession: 'succession',
  // Skill / Training sub-routes
  'skill-matrix': 'skill-matrix',
  enrollments: 'enrollments',
  skills: 'skills',
  // Recruitment sub-routes
  'cost-analysis': 'cost-analysis',
  applicants: 'applicants',
  'talent-pool': 'talent-pool',
  pipeline: 'pipeline',
  interviews: 'interviews',
  board: 'board',
  requisitions: 'requisitions',
  // Compliance sub-routes
  'data-retention': 'data-retention',
  dpia: 'dpia',
  'pii-audit': 'pii-audit',
  gdpr: 'gdpr',
  cn: 'cn',
  ru: 'ru',
  kr: 'kr',
  // Attendance sub-routes
  'shift-calendar': 'shift-calendar',
  'shift-roster': 'shift-roster',
  // Offboarding sub-routes
  'exit-interviews': 'exit-interviews',
  // Delegation
  delegation: 'delegation',
  // Manager hub
  'manager-hub': 'manager-hub',
  // My sub-routes
  'internal-jobs': 'internal-jobs',
  'my-goals': 'my-goals',
  'my-evaluation': 'my-evaluation',
  'my-peer-review': 'my-peer-review',
  'my-checkins': 'my-checkins',
  'my-result': 'my-result',
  // Performance sub-routes (additional)
  'manager-eval': 'manager-eval',
  'manager-evaluation': 'manager-evaluation',
  'team-goals': 'team-goals',
  'team-results': 'team-results',
  results: 'results',
  calibration: 'calibration',
  // Analytics sub-routes (additional)
  'ai-report': 'ai-report',
  attrition: 'attrition',
}

// UUID pattern: detects 8-4-4-4-12 hex or any 32+ char hex string
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Component ──────────────────────────────────────────────

export function Header({ user, companies, onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('menu')
  const tAuth = useTranslations('auth')
  const tHeader = useTranslations('header')
  const userInitial = user.name.charAt(0).toUpperCase()

  const currentCompany = companies.find((c) => c.id === user.companyId)
  const countryCode = currentCompany?.countryCode ?? 'KR'

  const breadcrumbs = pathname
    .split('/')
    .filter(Boolean)
    .filter((seg) => !UUID_RE.test(seg))  // Hide UUID segments
    .map((seg) => {
      const key = BREADCRUMB_KEYS[seg]
      return key ? t(key) : seg
    })
    .slice(0, 3)

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#F0F0F3] bg-white px-4 md:px-6">
      {/* ─── Left: Hamburger (mobile) + Breadcrumb ─── */}
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 -ml-1 rounded-lg text-[#8181A5] hover:bg-[#F5F5FA] transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        )}

        {/* App title — mobile only */}
        <span className="text-sm font-bold text-[#1C1D21] md:hidden">CTR HR Hub</span>

        {/* Breadcrumb — desktop only */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
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
      </div>

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

        {/* Quick Actions (+) */}
        <QuickActionsMenu userRole={user.role} />

        {/* People Directory */}
        <button
          type="button"
          aria-label={tHeader('directory')}
          title={tHeader('directory')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ctr-gray-500 hover:bg-[#F5F5FA] transition-colors"
          onClick={() => router.push('/directory')}
        >
          <Users className="h-5 w-5" />
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#F5F5FA]"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-ctr-primary-light text-xs text-ctr-primary">
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
