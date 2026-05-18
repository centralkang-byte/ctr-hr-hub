'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmployeeMiniCard (Phase 2 P1-6a, Workday 시그니처)
// 이름·아바타 hover 시 작은 프로필 카드. Radix HoverCard 기반.
// 출처: _design-reference/inspector.jsx EmployeeMiniCard
//       + styles.css .emp-mini-card / .emc-* (L5592–5634)
// i18n: 라벨/액션 텍스트는 caller가 번역해 prop으로 주입 (메시지 키 무변경).
// 데이터/라우팅 연결은 시그니처 외 — P3 페이지 마이그레이션에서 결정.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

// ─── Types ──────────────────────────────────────────────────

interface MiniCardEmployee {
  name: string
  nameEn?: string | null
  code?: string | null
  /** caller가 번역/스타일한 상태 칩 (재직/휴직 등). 없으면 미표시 */
  status?: ReactNode
}

interface MiniCardMetaRow {
  k: string
  v: ReactNode
}

interface MiniCardAction {
  label: string
  icon?: LucideIcon
  onClick: () => void
}

interface EmployeeMiniCardProps {
  employee: MiniCardEmployee
  /** 아바타 배경색 (caller 팔레트). 없으면 muted */
  avatarColor?: string
  /** caller-번역 메타 행 (부서/직위/직급/이메일 등) */
  meta?: MiniCardMetaRow[]
  /** 하단 액션 (상세/메시지/1:1 등). onClick은 P1-6a에서 stub 허용 */
  actions?: MiniCardAction[]
  children: ReactNode
}

// ─── Component ──────────────────────────────────────────────

/**
 * Hover 프로필 미니카드. 320px, 트리거 위쪽으로 띄움.
 * openDelay 280ms(noisy 방지) / closeDelay 160ms(레퍼런스 정합).
 */
export function EmployeeMiniCard({
  employee,
  avatarColor,
  meta,
  actions,
  children,
}: EmployeeMiniCardProps) {
  return (
    <HoverCard openDelay={280} closeDelay={160}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-default">{children}</span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-80 rounded-xl border-border bg-card p-0 shadow-primary-tinted"
      >
        {/* emc-h */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 pb-3 pt-3.5">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={avatarColor ? { backgroundColor: avatarColor } : undefined}
          >
            {employee.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-foreground">
              {employee.name}
            </div>
            {(employee.nameEn || employee.code) && (
              <div className="mt-0.5 text-[11.5px] text-muted-foreground/70">
                {employee.nameEn}
                {employee.nameEn && employee.code && ' · '}
                {employee.code && <span className="font-mono">{employee.code}</span>}
              </div>
            )}
          </div>
          {employee.status && <div className="flex-shrink-0">{employee.status}</div>}
        </div>

        {/* emc-meta */}
        {meta && meta.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 text-xs">
            {meta.map((m, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-muted-foreground/70">{m.k}</span>
                <span className="min-w-0 truncate text-right font-medium text-foreground">
                  {m.v}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* emc-actions */}
        {actions && actions.length > 0 && (
          <div className="flex gap-1.5 border-t border-border px-4 pb-3.5 pt-2.5">
            {actions.map((a, i) => {
              const Icon = a.icon
              return (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {Icon && <Icon size={11} />}
                  {a.label}
                </button>
              )
            })}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
