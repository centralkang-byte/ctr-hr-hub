'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Sidebar Navigation (10-Section IA)
// 역할 기반 섹션 그루핑 + 단일 아코디언 + 다크 테마
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigation } from '@/hooks/useNavigation'
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

// ─── Types ──────────────────────────────────────────────────

interface SidebarProps {
  user: SessionUser
  onSignOut: () => void
  countryCode?: string
}

// ─── Component ──────────────────────────────────────────────

export function Sidebar({ user, onSignOut, countryCode }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  // Single-expand: only one section open at a time.
  // Default open = the section that contains the active route (or 'my-space' fallback)
  const [openSection, setOpenSection] = useState<string | null>('my-space')

  const pathname = usePathname()
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')

  const { sections } = useNavigation({
    user,
    countryCode: countryCode ?? null,
  })

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  const toggleSection = useCallback((sectionKey: string) => {
    setOpenSection((prev) => (prev === sectionKey ? null : sectionKey))
  }, [])

  const userInitial = user.name.charAt(0).toUpperCase()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-white text-[#1C1D21] border-r border-[#F0F0F3] transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* ─── Logo / Brand Area ─── */}
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-5',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ctr-primary font-bold text-white">
            C
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold tracking-tight text-[#1C1D21]">
                CTR HR Hub
              </h1>
            </div>
          )}
        </div>

        {/* ─── Navigation ─── */}
        <ScrollArea className="flex-1">
          <nav className="pb-4">
            {sections.map((section, idx) => (
              <SidebarSection
                key={section.key}
                section={section}
                pathname={pathname}
                collapsed={collapsed}
                expanded={section.key === openSection}
                onToggle={() => toggleSection(section.key)}
                showDivider={idx > 0}
                t={t}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* ─── Collapse Toggle ─── */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center justify-center border-t border-[#F0F0F3] py-2 hover:bg-[#F5F5FA]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-[#8181A5]" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-[#8181A5]" />
          )}
        </button>

        {/* ─── User Profile Section ─── */}
        <div
          className={cn(
            'flex items-center gap-3 border-t border-[#F0F0F3] px-3 py-3',
            collapsed && 'flex-col gap-1 px-1',
          )}
        >
          <Avatar className="h-8 w-8 shrink-0 border border-[#F0F0F3]">
            <AvatarFallback className="bg-ctr-primary text-xs text-white">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#1C1D21]">
                {user.name}
              </p>
              <p className="truncate text-[10px] text-[#8181A5]">{user.role}</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onSignOut}
                className="shrink-0 rounded p-1 hover:bg-[#F5F5FA]"
                aria-label={tAuth('logout')}
              >
                <LogOut className="h-4 w-4 text-[#8181A5]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {tAuth('logout')}
            </TooltipContent>
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
}

function SidebarSection({
  section,
  pathname,
  collapsed,
  expanded,
  onToggle,
  showDivider,
  t,
}: SidebarSectionProps) {
  // For "home" section with single dashboard item, render items directly without accordion
  const isSingleItemSection = section.key === 'home'

  // Helper to get translated label with fallback
  const getLabel = (labelKey: string, fallback: string): string => {
    try {
      return t(labelKey.replace('nav.', ''))
    } catch {
      return fallback
    }
  }

  if (collapsed) {
    return (
      <>
        {showDivider && <div className="mx-3 mt-2 border-t border-[#F0F0F3]" />}
        <div className="flex flex-col items-center gap-1 py-1">
          {section.items.map((item) => (
            <CollapsedNavItem
              key={item.key}
              item={item}
              pathname={pathname}
              getLabel={getLabel}
            />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      {showDivider && (
        <div className="mx-3 mt-4 border-t border-[#F0F0F3] pt-4" />
      )}

      {/* Section header (skip for home — render items directly) */}
      {!isSingleItemSection && (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-2 hover:bg-[#F5F5FA]"
        >
          <div className="flex items-center gap-2">
            <section.icon className="h-[18px] w-[18px] text-[#8181A5]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8181A5]">
              {getLabel(section.labelKey, section.label)}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-[#8181A5]" />
          ) : (
            <ChevronDown className="h-3 w-3 text-[#8181A5]" />
          )}
        </button>
      )}

      {/* Items (always visible for home section) */}
      {(isSingleItemSection || expanded) && (
        <div className={cn('space-y-0.5', !isSingleItemSection && 'mt-1')}>
          {section.items.map((item) => (
            <ExpandedNavItem
              key={item.key}
              item={item}
              pathname={pathname}
              getLabel={getLabel}
            />
          ))}
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
}

function ExpandedNavItem({ item, pathname, getLabel }: NavItemProps) {
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href + '/'))
  const label = getLabel(item.labelKey, item.label)

  if (item.comingSoon) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mx-2 flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#8181A5]">
            <item.icon className="h-[18px] w-[18px]" />
            <span className="truncate">{label}</span>
            <Lock className="ml-auto h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          준비 중입니다
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-[#F5F5FA] text-[#5E81F4] font-bold'
          : 'text-[#8181A5] hover:bg-[#F5F5FA] hover:text-[#1C1D21]',
      )}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
      {item.badge && (
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            item.badge === 'new'
              ? 'bg-[#5E81F4] text-white'
              : 'bg-[#F5F5FA] text-[#8181A5]',
          )}
        >
          {item.badge.toUpperCase()}
        </span>
      )}
    </Link>
  )
}

// ─── Collapsed Nav Item ─────────────────────────────────────

function CollapsedNavItem({ item, pathname, getLabel }: NavItemProps) {
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href + '/'))
  const label = getLabel(item.labelKey, item.label)

  if (item.comingSoon) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg text-[#8181A5]">
            <item.icon className="h-[18px] w-[18px]" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label} — 준비 중
        </TooltipContent>
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
            isActive
              ? 'bg-[#F5F5FA] text-[#5E81F4]'
              : 'text-[#8181A5] hover:bg-[#F5F5FA]',
          )}
        >
          <item.icon className="h-[18px] w-[18px]" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
