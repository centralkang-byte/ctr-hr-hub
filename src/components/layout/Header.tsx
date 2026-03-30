'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Header
// 브레드크럼 + CompanySelector + 언어전환 + 알림 + 사용자 메뉴
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { NAVIGATION } from '@/config/navigation'
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

// Build href→label map from NAVIGATION config (사이드바와 동일한 이름 사용)
function buildRouteMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      map.set(item.href, item.label)
    }
  }
  return map
}

const ROUTE_LABEL_MAP = buildRouteMap()

// Segment-level fallback for routes not in navigation (e.g. /settings/*)
const SEGMENT_KEYS: Record<string, string> = {
  home: 'home', settings: 'settings', new: 'new', edit: 'edit',
  admin: 'admin', team: 'team', me: 'me', profile: 'profile',
}

// UUID pattern
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

  // 라우트 기반 브레드크럼: NAVIGATION href→label 매핑 우선, 없으면 세그먼트 번역
  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean).filter((seg) => !UUID_RE.test(seg))
    const crumbs: { label: string; href: string | null }[] = []

    // 전체 경로부터 매칭 시도 (가장 구체적인 라우트 먼저)
    let accumulated = ''
    for (const seg of segments) {
      accumulated += `/${seg}`
      const routeLabel = ROUTE_LABEL_MAP.get(accumulated)
      if (routeLabel) {
        // 이전 크럼이 있고, 이 라우트가 전체를 덮으면 이전 것 대체
        crumbs.push({ label: routeLabel, href: accumulated })
      } else {
        // NAVIGATION에 없는 경로 — 세그먼트 번역 fallback
        const segKey = SEGMENT_KEYS[seg]
        const label = segKey ? t(segKey) : seg
        crumbs.push({ label, href: accumulated })
      }
    }

    // 중복 제거: 부모 경로가 자식과 같은 이름이면 부모 제거
    const filtered = crumbs.filter((crumb, idx) => {
      if (idx < crumbs.length - 1) {
        const next = crumbs[idx + 1]
        // 부모 경로의 라벨이 자식에 포함되면 스킵
        if (next.href?.startsWith(crumb.href ?? '') && next.label.includes(crumb.label)) {
          return false
        }
      }
      return true
    })

    return filtered.slice(0, 3)
  }, [pathname, t])

  const handleSignOut = useCallback(() => {
    void signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4 md:px-6">
      {/* ─── Left: Hamburger (mobile) + Breadcrumb ─── */}
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 -ml-1 rounded-lg text-muted-foreground hover:bg-muted transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        )}

        {/* App title — mobile only */}
        <span className="text-sm font-bold text-foreground md:hidden">CTR HR Hub</span>

        {/* Breadcrumb — desktop only */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/home" className="font-medium text-foreground hover:text-ctr-primary transition-colors">
            {t('home')}
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50">/</span>
              {idx === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : crumb.href ? (
                <Link href={crumb.href} className="hover:text-ctr-primary transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ctr-gray-500 hover:bg-muted transition-colors"
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
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
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
