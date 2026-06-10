'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdDrawer (Phase 2 P1, Workday 시그니처)
// 모든 우측 슬라이드 입력 폼의 표준 래퍼. eyebrow/title 헤더 +
// 스크롤 body + sticky foot(primary/secondary/footLeft).
// 출처: _design-reference/wd-drawer.jsx · styles.css .wd-drawer L3668–3820
// 기존 Radix Sheet(P0 navy 토큰 적용 완료) 위 얇은 래퍼 — sheet.tsx 무수정.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface WdDrawerPrimary {
  label: string
  onClick: () => void
  disabled?: boolean
  icon?: ReactNode
}

interface WdDrawerSecondary {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface WdDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  /** 제목 위 소형 대문자 라벨 */
  eyebrow?: string
  children: ReactNode
  primary?: WdDrawerPrimary
  secondary?: WdDrawerSecondary
  /** foot 좌측 슬롯 (보조 액션/메타) */
  footLeft?: ReactNode
  /** true면 ESC·overlay·X 닫기 차단 (제출 중 데이터 유실 방지) */
  closeDisabled?: boolean
  /**
   * Drawer 폭(px). 좁은 화면에선 width:100% 로 자동 풀폭.
   * size 토큰 승격은 P1-5b audit 후 재검토.
   */
  width?: number
  className?: string
}

// ─── Component ──────────────────────────────────────────────

/**
 * Workday 우측 입력 드로어. 폭은 인라인 스타일로만 제어
 * (동적 Tailwind 클래스는 JIT 미생성 → 사용 금지).
 */
export function WdDrawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  primary,
  secondary,
  footLeft,
  closeDisabled,
  width = 520,
  className,
}: WdDrawerProps) {
  const hasFoot = Boolean(primary || secondary || footLeft)

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o && !closeDisabled) onClose() }}>
      <SheetContent
        side="right"
        // 시각 설명문 없음 — Radix "missing Description" 경고 명시적 opt-out
        aria-describedby={undefined}
        style={{ width: '100%', maxWidth: `${width}px` }}
        // [&>button] = sheet.tsx 내장 X 버튼 (sheet.tsx 무수정 제약 하 어포던스 차단)
        className={cn(
          'flex flex-col gap-0 p-0',
          closeDisabled && '[&>button]:pointer-events-none [&>button]:opacity-30',
          className,
        )}
      >
        {/* ─── Header (wdr-h) ─── */}
        <div className="flex items-center gap-2.5 border-b border-border px-[22px] py-4">
          <div>
            {eyebrow && (
              <div className="mb-[3px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground/70">
                {eyebrow}
              </div>
            )}
            <SheetTitle className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
              {title}
            </SheetTitle>
          </div>
        </div>

        {/* ─── Body (wdr-body) ─── */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[22px] py-5">
          {children}
        </div>

        {/* ─── Foot (wdr-foot) ─── */}
        {hasFoot && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted px-[22px] py-3">
            {footLeft && <div className="mr-auto">{footLeft}</div>}
            {secondary && (
              <button
                type="button"
                onClick={secondary.onClick}
                disabled={secondary.disabled}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {secondary.label}
              </button>
            )}
            {primary && (
              <button
                type="button"
                onClick={primary.onClick}
                disabled={primary.disabled}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-warm px-4 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {primary.icon}
                {primary.label}
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Field helpers (wdr-field / wdr-row / wdr-section-h / wdr-note) ───

interface WdFieldProps {
  label: string
  required?: boolean
  /** 라벨 우측 보조 텍스트 */
  hint?: string
  /** 컨트롤 아래 faint 도움말 */
  help?: ReactNode
  /** 컨트롤 id — label-컨트롤 a11y 연결 (input/textarea/Select trigger) */
  htmlFor?: string
  children: ReactNode
}

/** 라벨 + 컨트롤 + (선택)도움말 수직 스택. */
export function WdField({ label, required, hint, help, htmlFor, children }: WdFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && (
          <span className="ml-auto text-[11px] font-medium text-muted-foreground/70">
            {hint}
          </span>
        )}
      </label>
      {children}
      {help && <div className="text-[11.5px] text-muted-foreground/70">{help}</div>}
    </div>
  )
}

/** 2-열 그리드 행 (좁은 화면 1-열 reflow). */
export function WdRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

/** 섹션 구분 헤더 (첫 항목은 상단 보더 제거). */
export function WdSectionH({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 border-t border-border pt-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground/70 first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </div>
  )
}

/** 강조 안내 콜아웃 (좌측 보더 + soft 배경). */
export function WdNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border-l-2 border-l-primary bg-primary/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground">
      {children}
    </div>
  )
}
