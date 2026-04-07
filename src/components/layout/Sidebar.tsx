'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Sidebar Navigation (10-Section IA)
// 역할 기반 섹션 그루핑 + 단일 아코디언 + 즐겨찾기 + 뱃지
// ═══════════════════════════════════════════════════════════

import { Fragment, useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  Lock,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigation } from '@/hooks/useNavigation'
import { useFavorites } from '@/hooks/useFavorites'
import { useSidebarCounts, type SidebarCounts } from '@/hooks/useSidebarCounts'
import type { NavItem, NavSection } from '@/config/navigation'
import type { SessionUser } from '@/types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Badge Map: nav item key → count key + color ────────────

const BADGE_MAP: Record<string, { countKey: string; color: string }> = {
  'my-tasks':        { countKey: 'approvals',     color: 'bg-red-500' },
  'notifications':   { countKey: 'notifications', color: 'bg-red-500' },
  'leave-admin':     { countKey: 'pendingLeave',  color: 'bg-primary' },
  'attendance-admin':{ countKey: 'todayAbsent',   color: 'bg-amber-500' },
}

// ─── Badge pill ─────────────────────────────────────────────

function BadgePill({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null
  const label = count > 99 ? '99+' : String(count)
  return (
    <span
      className={cn(
        'ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center text-white shrink-0',
        color,
      )}
    >
      {label}
    </span>
  )
}

// ─── Types ──────────────────────────────────────────────────

export type SidebarMode = 'desktop' | 'drawer'

interface SidebarProps {
  user: SessionUser
  onSignOut: () => void
  countryCode?: string
  mode?: SidebarMode
  onItemClick?: () => void
}

// ─── Component ──────────────────────────────────────────────

export function Sidebar({ user, onSignOut, countryCode, mode = 'desktop', onItemClick }: SidebarProps) {
  const [collapsed, setCollapsed]     = useState(false)
  const isDrawer = mode === 'drawer'
  const isCollapsed = isDrawer ? false : collapsed
  const [openSection, setOpenSection] = useState<string | null>(null)
  const pathname  = usePathname()
  const t         = useTranslations('nav')
  const tAuth     = useTranslations('auth')

  const { sections }                              = useNavigation({ user, countryCode: countryCode ?? null })
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { counts }                                = useSidebarCounts()

  const toggleCollapsed = useCallback(() => { if (!isDrawer) setCollapsed((p) => !p) }, [isDrawer])
  const toggleSection   = useCallback(
    (key: string) => setOpenSection((p) => (p === key ? null : key)),
    [],
  )

  // Build flat list of all visible nav items for Favorites lookup
  const allItems: NavItem[] = sections.flatMap((s) => s.items)
  const favoriteItems: NavItem[] = favorites
    .map((key) => allItems.find((i) => i.key === key))
    .filter(Boolean) as NavItem[]

  const userInitial = user.name.charAt(0).toUpperCase()

  const getLabel = useCallback(
    (labelKey: string, fallback: string): string => {
      try { return t(labelKey.replace('nav.', '')) } catch { return fallback }
    },
    [t],
  )

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col bg-white text-foreground transition-all duration-300',
          isDrawer
            ? 'h-full w-full'
            : 'h-screen border-r border-border',
          !isDrawer && (isCollapsed ? 'w-16' : 'w-64'),
        )}
      >
        {/* ─── Logo ─── */}
        <Link href="/home" className={cn('flex items-center gap-3 px-4 py-5 hover:bg-muted transition-colors rounded-lg mx-1', isCollapsed && 'justify-center px-2')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ctr-primary font-bold text-white">
            C
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold tracking-tight text-foreground">CTR HR Hub</h1>
            </div>
          )}
        </Link>

        {/* ─── Navigation ─── */}
        <ScrollArea className="flex-1">
          <nav className="pb-4">

            {/* ── Favorites section (always expanded, hidden when empty) ── */}
            {!isCollapsed && favoriteItems.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-2 px-4 py-2">
                  <Star className="h-[18px] w-[18px] text-amber-500 fill-amber-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {getLabel('favorites.label', '즐겨찾기')}
                  </span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {favoriteItems.map((item) => {
                    const badgeInfo = BADGE_MAP[item.key]
                    const count = badgeInfo
                      ? (counts[badgeInfo.countKey as keyof typeof counts] ?? 0)
                      : 0
                    return (
                      <ExpandedNavItem
                        key={`fav-${item.key}`}
                        item={item}
                        pathname={pathname}
                        getLabel={getLabel}
                        isFavorite={true}
                        onToggleFavorite={toggleFavorite}
                        badgeCount={count}
                        badgeColor={badgeInfo?.color}
                      />
                    )
                  })}
                </div>
                <div className="mx-3 mt-3 border-t border-border" />
              </div>
            )}

            {/* ── Main sections ── */}
            {sections.map((section, idx) => (
              <SidebarSection
                key={section.key}
                section={section}
                pathname={pathname}
                collapsed={isCollapsed}
                expanded={section.key === openSection}
                onToggle={() => toggleSection(section.key)}
                showDivider={idx > 0 && favoriteItems.length === 0}
                t={t}
                counts={counts}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                getLabel={getLabel}
                onItemClick={onItemClick}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* ─── Collapse Toggle (desktop only) ─── */}
        {!isDrawer && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex items-center justify-center border-t border-border py-2 hover:bg-muted"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed
              ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
              : <ChevronLeft  className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}

        {/* ─── User Profile ─── */}
        <div className={cn('flex items-center gap-3 border-t border-border px-3 py-3', isCollapsed && 'flex-col gap-1 px-1')}>
          <Avatar className="h-8 w-8 shrink-0 border border-border">
            <AvatarFallback className="bg-ctr-primary text-xs text-white">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user.role}</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onSignOut}
                className="shrink-0 rounded p-1 hover:bg-muted"
                aria-label={tAuth('logout')}
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{tAuth('logout')}</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

// ─── Section Component ──────────────────────────────────────

interface SidebarSectionProps {
  section: NavSection
  pathname: string
  collapsed: boolean
  expanded: boolean
  onToggle: () => void
  showDivider: boolean
  t: ReturnType<typeof useTranslations>
  counts: SidebarCounts
  isFavorite: (key: string) => boolean
  onToggleFavorite: (key: string) => void
  getLabel: (labelKey: string, fallback: string) => string
  onItemClick?: () => void
}

function SidebarSection({
  section, pathname, collapsed, expanded, onToggle,
  showDivider, counts, isFavorite, onToggleFavorite, getLabel, onItemClick,
}: SidebarSectionProps) {
  const isHome = section.key === 'home'

  if (collapsed) {
    return (
      <>
        {showDivider && <div className="mx-3 mt-2 border-t border-border" />}
        <div className="flex flex-col items-center gap-1 py-1">
          {section.items.map((item) => (
            <CollapsedNavItem key={item.key} item={item} pathname={pathname} getLabel={getLabel} />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      {showDivider && <div className="mx-3 mt-3 border-t border-border pt-3" />}

      {/* Section header — skip for Home */}
      {!isHome && (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-1.5 hover:bg-muted"
        >
          <div className="flex items-center gap-2">
            <section.icon className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {getLabel(section.labelKey, section.label)}
            </span>
          </div>
          {expanded
            ? <ChevronUp   className="h-3 w-3 text-muted-foreground" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </button>
      )}

      {/* Items */}
      {(isHome || expanded) && (
        <div className={cn('space-y-0.5', !isHome && 'mt-1')}>
          {section.items.map((item, idx) => {
            const prevItem = idx > 0 ? section.items[idx - 1] : null
            // subGroup이 바뀌는 시점에 구분선 + 레이블 삽입
            const isNewGroup = item.subGroup != null && item.subGroup !== prevItem?.subGroup
            const badgeInfo = BADGE_MAP[item.key]
            const count = badgeInfo
              ? (counts[badgeInfo.countKey as keyof typeof counts] ?? 0)
              : 0
            return (
              // Fragment에 key를 부여해 구분선과 아이템이 함께 반환될 때 경고 방지
              <Fragment key={item.key}>
                {isNewGroup && (
                  <div
                    className={cn(
                      'px-5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60',
                      idx > 0 && 'pt-2',
                    )}
                  >
                    {getLabel(`subGroup.${item.subGroup}`, item.subGroup ?? '')}
                  </div>
                )}
                <ExpandedNavItem
                  item={item}
                  pathname={pathname}
                  getLabel={getLabel}
                  isFavorite={isFavorite(item.key)}
                  onToggleFavorite={onToggleFavorite}
                  badgeCount={count}
                  badgeColor={badgeInfo?.color}
                  onItemClick={onItemClick}
                />
              </Fragment>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Expanded Nav Item ──────────────────────────────────────

interface NavItemProps {
  item: NavItem
  pathname: string
  getLabel: (key: string, fallback: string) => string
  isFavorite: boolean
  onToggleFavorite: (key: string) => void
  badgeCount?: number
  badgeColor?: string
  onItemClick?: () => void
}

function ExpandedNavItem({
  item, pathname, getLabel, isFavorite, onToggleFavorite, badgeCount = 0, badgeColor, onItemClick,
}: NavItemProps) {
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href + '/'))
  const label = getLabel(item.labelKey, item.label)

  if (item.comingSoon) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mx-2 flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground">
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate flex-1">{label}</span>
            <Lock className="ml-auto h-3 w-3 shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">준비 중입니다</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="group relative mx-2 flex items-center rounded-lg">
      <Link
        href={item.href}
        onClick={onItemClick}
        className={cn(
          'flex flex-1 items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-muted text-primary font-bold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate flex-1">{label}</span>

        {/* Badge — shown before star */}
        {badgeCount > 0 && badgeColor && (
          <BadgePill count={badgeCount} color={badgeColor} />
        )}

        {/* Legacy badge (new/beta) */}
        {!badgeCount && item.badge && (
          <span
            className={cn(
              'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0',
              item.badge === 'new' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {item.badge.toUpperCase()}
          </span>
        )}
      </Link>

      {/* Star / Favorite toggle — appears on hover */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onToggleFavorite(item.key) }}
        className={cn(
          'absolute right-2 flex h-5 w-5 items-center justify-center rounded transition-opacity',
          isFavorite
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100',
        )}
        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      >
        <Star
          className={cn(
            'h-3.5 w-3.5 transition-colors',
            isFavorite
              ? 'text-amber-500 fill-amber-500'
              : 'text-border hover:text-amber-500',
          )}
        />
      </button>
    </div>
  )
}

// ─── Collapsed Nav Item ─────────────────────────────────────

interface CollapsedNavItemProps {
  item: NavItem
  pathname: string
  getLabel: (key: string, fallback: string) => string
}

function CollapsedNavItem({ item, pathname, getLabel }: CollapsedNavItemProps) {
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href + '/'))
  const label = getLabel(item.labelKey, item.label)

  if (item.comingSoon) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg text-muted-foreground">
            <item.icon className="h-[18px] w-[18px]" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{label} — 준비 중</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            isActive ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <item.icon className="h-[18px] w-[18px]" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  )
}
