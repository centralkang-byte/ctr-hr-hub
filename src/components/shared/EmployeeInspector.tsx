'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmployeeInspector (Phase 2 P1-6b, Workday 시그니처)
// 우측 슬라이드 빠른 미리보기 본체 (순수 표현 컴포넌트).
// slide-over chrome(backdrop/slide/ESC/role=dialog)은 호출부의
// shared/DetailPanel이 담당 — 본 컴포넌트는 body 컴포지션만.
// 출처: _design-reference/inspector.jsx EmployeeInspector
//       + styles.css .emp-inspector .ei-* (L5636–5740)
// i18n: 라벨/액션 텍스트는 caller가 번역해 prop 주입 (messages 무변경).
// quick-stats/activity 실데이터는 시그니처 외 — P3에서 연결.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface InspectorAction {
  /** icon-only일 때 접근성/툴팁 라벨 (임시 영문 허용 → P1-6c i18n) */
  ariaLabel: string
  icon: LucideIcon
  onClick: () => void
  /** 미구현 액션은 disabled로 노출 (시각 충실도 유지 + dead-control 방지) */
  disabled?: boolean
}

interface InspectorKV {
  k: string
  v: ReactNode
}

interface EmployeeInspectorProps {
  name: string
  nameEn?: string | null
  /** 사번 등 보조 식별자 */
  code?: string | null
  photoUrl?: string | null
  /** 아바타 이니셜 배경색 (photoUrl 없을 때) */
  avatarColor?: string
  /** 배너 하단 칩 (직위/부서 등) */
  tags?: ReactNode
  /** 상단 빠른 액션 (icon-only, 메시지/발령서/1:1 등) */
  quickActions?: InspectorAction[]
  /** caller-번역 섹션 헤더 */
  sectionLabels: { info: string; stats: string; activity: string }
  /** 기본 정보 KV (caller-번역, 빈 행은 caller에서 제외) */
  kv: InspectorKV[]
  /** 빠른 통계 슬롯 (실데이터 P3 이월 → EmptyState 등) */
  statsSlot?: ReactNode
  /** 최근 활동 슬롯 (실데이터 P3 이월 → EmptyState 등) */
  activitySlot?: ReactNode
  /** 하단 전체보기 CTA */
  viewFull?: { label: string; onClick: () => void; icon?: LucideIcon }
}

// ─── Component ──────────────────────────────────────────────

/**
 * Workday 인스펙터 본체. DetailPanel(slide chrome) 내부에 렌더.
 * banner / quick-actions / 기본정보 KV / 빠른통계 / 최근활동 / 전체보기 CTA.
 */
export function EmployeeInspector({
  name,
  nameEn,
  code,
  photoUrl,
  avatarColor,
  tags,
  quickActions,
  sectionLabels,
  kv,
  statsSlot,
  activitySlot,
  viewFull,
}: EmployeeInspectorProps) {
  const ViewFullIcon = viewFull?.icon

  return (
    <div className="flex h-full flex-col">
      {/* ─── Banner (ei-banner) ─── */}
      <div className="flex items-center gap-3.5 border-b border-border bg-gradient-to-b from-muted to-card px-5 py-[18px]">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[14px] text-xl font-bold text-white"
          style={avatarColor ? { backgroundColor: avatarColor } : undefined}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            {name}
          </div>
          {(nameEn || code) && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {nameEn}
              {nameEn && code && ' · '}
              {code && <span className="font-mono">{code}</span>}
            </div>
          )}
          {tags && <div className="mt-2 flex gap-1.5">{tags}</div>}
        </div>
      </div>

      {/* ─── Quick actions (ei-quick) ─── */}
      {quickActions && quickActions.length > 0 && (
        <div className="flex gap-1.5 border-b border-border px-5 py-3">
          {quickActions.map((a, i) => {
            const Icon = a.icon
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                aria-label={a.ariaLabel}
                title={a.ariaLabel}
                className="inline-flex flex-1 items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-muted-foreground transition-colors enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon size={14} />
              </button>
            )
          })}
        </div>
      )}

      {/* ─── Body (ei-body) ─── */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {/* 기본 정보 */}
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
          {sectionLabels.info}
        </div>
        <div className="overflow-hidden rounded-[10px] bg-muted">
          {kv.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[110px_1fr] border-b border-border px-3.5 py-2.5 text-[12.5px] last:border-b-0"
            >
              <span className="text-muted-foreground/70">{row.k}</span>
              <span className="font-medium text-foreground">{row.v}</span>
            </div>
          ))}
        </div>

        {/* 빠른 통계 (실데이터 P3) */}
        {statsSlot && (
          <>
            <div className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              {sectionLabels.stats}
            </div>
            {statsSlot}
          </>
        )}

        {/* 최근 활동 (실데이터 P3) */}
        {activitySlot && (
          <>
            <div className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              {sectionLabels.activity}
            </div>
            {activitySlot}
          </>
        )}
      </div>

      {/* ─── Footer CTA (전체 보기) ─── */}
      {viewFull && (
        <div className="border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={viewFull.onClick}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-warm px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:brightness-95"
          >
            {ViewFullIcon && <ViewFullIcon className="h-4 w-4" />}
            {viewFull.label}
          </button>
        </div>
      )}
    </div>
  )
}
