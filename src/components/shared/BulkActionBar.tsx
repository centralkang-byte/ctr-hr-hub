'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — BulkActionBar (Phase 2 P1-7, Workday 시그니처)
// 다중 선택 시 화면 하단 중앙 floating pill. count>0일 때만 렌더.
// 출처: _design-reference/inspector.jsx BulkActionBar
//       + styles.css .wd-bulk-bar / .wd-bulk-* (L5744–5775)
// i18n: count 라벨/액션/clear aria는 caller가 번역해 prop 주입.
// 선택 state는 caller(페이지)가 소유 — 본 컴포넌트는 표현만.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface BulkAction {
  label: string
  icon?: LucideIcon
  onClick: () => void
  /** 강조 액션(primary 배경) */
  primary?: boolean
}

interface BulkActionBarProps {
  /** 선택 개수. 0이면 렌더 안 함 */
  count: number
  /** 선택 해제 핸들러 */
  onClear: () => void
  actions: BulkAction[]
  /** 카운트 영역 라벨 (caller-번역, 예: "3건 선택됨"). 미지정 시 count만 */
  label?: ReactNode
  /** 선택 해제 버튼 접근성 라벨 */
  clearAriaLabel?: string
}

// ─── Component ──────────────────────────────────────────────

/**
 * 하단 중앙 고정 일괄 액션 바. pulsing dot + count + actions + close.
 */
export function BulkActionBar({
  count,
  onClear,
  actions,
  label,
  clearAriaLabel,
}: BulkActionBarProps) {
  if (count === 0) return null

  // z-40: 앱 모달 오버레이(z-50) 아래 유지 — 레퍼런스 z-60은 모달 부재
  // 프로토타입 값, 적용 시 confirm 모달 위로 떠 회귀(Codex P2).
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 items-center gap-3.5 rounded-xl bg-foreground py-2.5 pl-[18px] pr-3.5 text-background shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
      {/* wd-bulk-count */}
      <span className="inline-flex items-center gap-2 text-[13px]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-wd-orange" />
        {label ?? <b className="font-mono font-bold">{count}</b>}
      </span>

      {/* wd-bulk-actions */}
      <div className="flex gap-1.5 border-l border-background/30 pl-3.5">
        {actions.map((a, i) => {
          const Icon = a.icon
          return (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className={
                a.primary
                  ? 'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90'
                  : 'inline-flex items-center gap-1.5 rounded-md bg-background/10 px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-background/20'
              }
            >
              {Icon && <Icon size={13} />}
              {a.label}
            </button>
          )
        })}
      </div>

      {/* wd-bulk-close */}
      <button
        type="button"
        onClick={onClear}
        aria-label={clearAriaLabel}
        title={clearAriaLabel}
        className="grid h-7 w-7 place-items-center rounded-md text-background/70 transition-colors hover:bg-background/10 hover:text-background"
      >
        <X size={13} />
      </button>
    </div>
  )
}
