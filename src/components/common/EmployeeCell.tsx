'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmployeeCell Component
// Unified employee display for all screens: sm / md / lg
// + Peek Card (hover mini-profile popover) — PC-1
// ═══════════════════════════════════════════════════════════

import React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
import { User, MessageSquare, Mail, Phone } from 'lucide-react'
import { getAvatarColor, getInitials } from '@/lib/avatar-colors'
import type { MinimalEmployee } from '@/types/employee'

// ─── Status Styles ──────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ACTIVE:     { label: '재직',  className: 'bg-emerald-500/10 text-emerald-700' },
  ON_LEAVE:   { label: '휴직',  className: 'bg-orange-500/10 text-orange-700' },
  RESIGNED:   { label: '퇴사',  className: 'bg-destructive/5 text-destructive' },
  TERMINATED: { label: '해고',  className: 'bg-destructive/5 text-destructive' },
}

// ─── Size Config ────────────────────────────────────────────

const SIZE_CONFIG = {
  sm: { avatar: 'h-8 w-8',   text: 'text-xs',  gap: 'gap-2.5', nameText: 'text-sm',  initials: 'text-[10px]' },
  md: { avatar: 'h-10 w-10', text: 'text-xs',  gap: 'gap-3',   nameText: 'text-sm',  initials: 'text-xs' },
  lg: { avatar: 'h-16 w-16', text: 'text-xs',  gap: 'gap-4',   nameText: 'text-base', initials: 'text-lg' },
} as const

const PEEK_AVATAR_CONFIG = { avatar: 'h-10 w-10', initials: 'text-xs' }

// ─── Types ──────────────────────────────────────────────────

export interface EmployeeCellProps {
  /** MinimalEmployee object — primary data source */
  employee?: MinimalEmployee | null

  // Individual overrides (take precedence over employee object)
  name?: string
  nameEn?: string | null
  employeeNo?: string | null
  photoUrl?: string | null
  department?: string | null
  departmentId?: string | null
  jobTitle?: string | null
  jobGrade?: string | null
  email?: string | null
  phone?: string | null
  hireDate?: string | null
  status?: string | null
  locationCode?: string | null
  locationCity?: string | null

  /** Size variant: sm(32px) md(40px) lg(64px) */
  size?: 'sm' | 'md' | 'lg'
  /** Show status badge */
  showStatus?: boolean
  /** Right-side slot (badges, buttons, etc.) */
  trailing?: React.ReactNode
  /** Click handler */
  onClick?: () => void
  /** Link href (wraps component in Next.js Link) */
  linkHref?: string
  /** Additional CSS classes */
  className?: string

  /** Enable Peek Card (hover mini-profile popover) — defaults to true for sm/md, false for lg */
  enablePeek?: boolean
  /** Show quick action buttons in Peek Card */
  showQuickActions?: boolean
  /** Hide subline details (department, title, location) under the name */
  hideDetails?: boolean
}

// ─── Shared Helpers ─────────────────────────────────────────

interface ResolvedData {
  id?: string
  name: string
  nameEn: string | null
  employeeNo: string | null
  photoUrl: string | null
  department: string | null
  departmentId: string | null
  jobTitle: string | null
  jobGrade: string | null
  email: string | null
  phone: string | null
  hireDate: string | null
  status: string | null
  locationCode: string | null
  locationCity: string | null
}

function resolveData(props: EmployeeCellProps): ResolvedData {
  const e = props.employee
  return {
    id:           e?.id,
    name:         props.name ?? e?.name ?? '',
    nameEn:       props.nameEn ?? e?.nameEn ?? null,
    employeeNo:   props.employeeNo ?? e?.employeeNo ?? null,
    photoUrl:     props.photoUrl ?? e?.photoUrl ?? null,
    department:   props.department ?? e?.department ?? null,
    departmentId: props.departmentId ?? e?.departmentId ?? null,
    jobTitle:     props.jobTitle ?? e?.jobTitle ?? null,
    jobGrade:     props.jobGrade ?? e?.jobGrade ?? null,
    email:        props.email ?? e?.email ?? null,
    phone:        props.phone ?? e?.phone ?? null,
    hireDate:     props.hireDate ?? e?.hireDate ?? null,
    status:       props.status ?? e?.status ?? null,
    locationCode: props.locationCode ?? e?.locationCode ?? null,
    locationCity: props.locationCity ?? e?.locationCity ?? null,
  }
}

function formatDisplayName(
  name: string,
  nameEn?: string | null,
  locationCode?: string | null,
): string {
  const needsEnName = locationCode && ['KR', 'CN'].includes(locationCode)
  if (needsEnName && nameEn) {
    return `${name} (${nameEn})`
  }
  return name
}

function calculateTenure(hireDate: string | null): string | null {
  if (!hireDate) return null
  const hire = new Date(hireDate)
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - hire.getFullYear()) * 12 +
    (now.getMonth() - hire.getMonth())
  if (totalMonths < 0) return null
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  if (y === 0) return `${m}개월`
  return `${y}년 ${m}개월`
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return null
  }
}

// ── Shared sub-components ──

function AvatarBlock({
  d,
  avatarClass,
  initialsClass,
}: {
  d: ResolvedData
  avatarClass: string
  initialsClass: string
}) {
  return (
    <Avatar className={`${avatarClass} flex-shrink-0`}>
      <AvatarImage src={d.photoUrl || ''} alt={d.name} />
      <AvatarFallback
        className={`text-white font-medium ${initialsClass}`}
        style={{ backgroundColor: getAvatarColor(d.departmentId) }}
      >
        {getInitials(d.name, d.nameEn)}
      </AvatarFallback>
    </Avatar>
  )
}

function SublineBlock({ d }: { d: ResolvedData }) {
  const title = d.jobTitle ?? d.jobGrade ?? null
  if (!d.department && !title && !d.locationCode) return null

  return (
    <div className="flex items-center gap-1 min-w-0 text-xs text-muted-foreground mt-0.5">
      {d.department && (
        <span className="truncate min-w-[40px] max-w-[140px]">{d.department}</span>
      )}
      {d.department && title && <span className="flex-shrink-0">·</span>}
      {title && <span className="flex-shrink-0">{title}</span>}
      {(d.department || title) && d.locationCode && d.locationCity && (
        <span className="flex-shrink-0">·</span>
      )}
      {d.locationCode && d.locationCity && (
        <span className="flex-shrink-0 inline-flex items-center gap-0.5">
          <span className="px-1 py-px rounded text-[10px] font-medium bg-muted text-muted-foreground">
            {d.locationCode}
          </span>
          <span className="truncate max-w-[80px]">{d.locationCity}</span>
        </span>
      )}
    </div>
  )
}

// ─── Peek Card Body (internal) ──────────────────────────────

function PeekCardBody({ d }: { d: ResolvedData }) {
//   const t = useTranslations('common')

  return (
    <div>
      {/* Header: avatar md + name + dept + location */}
      <div className="flex items-center gap-3">
        <AvatarBlock
          d={d}
          avatarClass={PEEK_AVATAR_CONFIG.avatar}
          initialsClass={PEEK_AVATAR_CONFIG.initials}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {formatDisplayName(d.name, d.nameEn, d.locationCode)}
          </p>
          <SublineBlock d={d} />
        </div>
      </div>

      {/* Contact info */}
      {(d.email || d.phone) && (
        <div className="space-y-1 mt-3">
          {d.email && (
            <a
              href={`mailto:${d.email}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail size={12} />
              {d.email}
            </a>
          )}
          {d.phone && (
            <a
              href={`tel:${d.phone}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone size={12} />
              {d.phone}
            </a>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2 pt-2 mt-3 border-t border-border">
        {d.id && (
          <Link
            href={`/employees/${d.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <User size={14} />
            {'viewProfile'}
          </Link>
        )}
        {d.email && (
          <a
            href={`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(d.email)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare size={14} />
            Teams DM
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function EmployeeCell(props: EmployeeCellProps) {
  const {
    size = 'sm',
    showStatus = false,
    trailing,
    onClick,
    linkHref,
    className = '',
    enablePeek,
    hideDetails = false,
  } = props

  const cfg = SIZE_CONFIG[size]
  const d = resolveData(props)

  // ── Ghost user defense ──
  if (!d.name) {
    return (
      <div className={`flex items-center ${cfg.gap} ${className}`}>
        <div
          className={`${cfg.avatar} rounded-full bg-muted-foreground/30 flex items-center justify-center text-foreground`}
        >
          <span className={cfg.initials}>?</span>
        </div>
        <span className="text-sm text-muted-foreground">알 수 없는 사용자</span>
        {trailing && <div className="ml-auto flex-shrink-0">{trailing}</div>}
      </div>
    )
  }

  const displayName = formatDisplayName(d.name, d.nameEn, d.locationCode)
//   const title = d.jobTitle ?? d.jobGrade ?? null
  const statusInfo = d.status ? STATUS_STYLES[d.status] : null

  // Peek Card enabled by default for sm/md, disabled for lg
  const shouldShowPeek = enablePeek ?? (size !== 'lg')

  // ── Inner content ──
  const content = (
    <div
      className={`flex items-center ${cfg.gap} min-w-0 ${className} ${
        (onClick || linkHref) ? 'cursor-pointer hover:bg-background rounded-lg transition-colors' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Avatar */}
      <AvatarBlock d={d} avatarClass={cfg.avatar} initialsClass={cfg.initials} />

      {/* Info */}
      <div className="min-w-0 flex-1">
        {/* Line 1: Name + status badge (if showStatus && sm) */}
        <div className="flex items-center gap-1.5">
          <span className={`${cfg.nameText} font-medium text-foreground truncate`}>
            {displayName}
          </span>
          {showStatus && size === 'sm' && statusInfo && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
          )}
        </div>

        {/* Line 2: Subline — department · title · location */}
        {!hideDetails && <SublineBlock d={d} />}

        {/* Line 3: Email + Phone (md/lg only) */}
        {(size === 'md' || size === 'lg') && (d.email || d.phone) && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            {d.email && (
              <a
                href={`mailto:${d.email}`}
                className="hover:text-primary transition-colors truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {d.email}
              </a>
            )}
            {d.email && d.phone && <span>·</span>}
            {d.phone && (
              <a
                href={`tel:${d.phone}`}
                className="hover:text-primary transition-colors flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {d.phone}
              </a>
            )}
          </div>
        )}

        {/* Line 4: HireDate + Tenure + Status (lg only) */}
        {size === 'lg' && (
          <div className="flex items-center gap-2 mt-1">
            {d.hireDate && (
              <span className="text-xs text-muted-foreground">
                {formatDate(d.hireDate)} 입사
              </span>
            )}
            {d.hireDate && (
              <span className="text-xs text-muted-foreground">
                · {calculateTenure(d.hireDate)}
              </span>
            )}
            {showStatus && statusInfo && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Trailing slot */}
      {trailing && <div className="ml-auto flex-shrink-0">{trailing}</div>}
    </div>
  )

  // ── Wrap in Link if linkHref provided ──
  const wrappedContent = linkHref ? (
    <Link href={linkHref} className="block no-underline">
      {content}
    </Link>
  ) : (
    content
  )

  // ── Wrap with HoverCard if peek is enabled ──
  if (!shouldShowPeek || !d.id) {
    return wrappedContent
  }

  return (
    <HoverCard openDelay={500}>
      <HoverCardTrigger asChild>
        {wrappedContent}
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 p-4"
        side="bottom"
        align="start"
        sideOffset={8}
      >
        <PeekCardBody d={d} />
      </HoverCardContent>
    </HoverCard>
  )
}

export default EmployeeCell
