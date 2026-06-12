'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Worker Banner (Workday .wd-worker-banner)
// 직원 상세 페이지 헤더. 출처: _design-reference/page-employee-detail.jsx
// DESIGN_RULES.md §5 시그니처 패턴 — 직원 상세·내 프로필은 페이지 헤더 대신 사용.
// ═══════════════════════════════════════════════════════════

import Image from 'next/image'
import { ChevronLeft, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_FG, resolveStatusCategory } from '@/lib/styles/status'

// ─── Types ──────────────────────────────────────────────────

interface EmployeeWorkerBannerProps {
  name: string
  nameEn: string | null
  employeeNo: string
  photoUrl: string | null
  /** 직위/호칭 (메타 첫 항목 — bold) */
  title: string | null
  department: string | null
  company: string | null
  status: string
  statusLabel: string
  /** 정보 편집 액션 노출 (HR_ADMIN/SUPER_ADMIN) */
  canEdit: boolean
  backLabel: string
  editLabel: string
  onBack: () => void
  onEdit: () => void
}

// ─── Helpers ────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.slice(0, 2)
}

// ─── Component ──────────────────────────────────────────────

export function EmployeeWorkerBanner({
  name,
  nameEn,
  employeeNo,
  photoUrl,
  title,
  department,
  company,
  status,
  statusLabel,
  canEdit,
  backLabel,
  editLabel,
  onBack,
  onEdit,
}: EmployeeWorkerBannerProps) {
  // 상태 점 색 = status SSOT (chart/icon FG). 직접 hex 아님 — status.ts 상수 참조.
  const statusColor = STATUS_FG[resolveStatusCategory(status)]
  const metaItems = [title, department, company].filter(Boolean) as string[]
  const subId = [nameEn, employeeNo].filter(Boolean).join(' · ')

  return (
    <section
      aria-label={name}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dim p-5 text-white md:p-6"
    >
      {/* 장식: warm radial 강조 + dot 패턴 (decorative) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-wd-orange/25 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* ── 상단: 뒤로 + 액션 ── */}
      <div className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 text-xs font-medium text-white',
            'transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {backLabel}
        </button>

        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              'ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-primary-dim',
              'transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            )}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {editLabel}
          </button>
        )}
      </div>

      {/* ── 본문: 아바타 + 신원 ── */}
      <div className="relative mt-4 flex items-center gap-4">
        <div className="shrink-0">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              width={70}
              height={70}
              unoptimized
              className="h-[70px] w-[70px] rounded-full object-cover ring-2 ring-white/30"
            />
          ) : (
            <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-white/20 text-2xl font-semibold text-white ring-2 ring-white/30">
              {getInitials(name)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-ctr text-white">{name}</h1>
          {subId && <p className="mt-0.5 truncate text-sm text-white/70">{subId}</p>}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/90">
            {metaItems.map((m, i) => (
              <span key={`${i}-${m}`} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span aria-hidden="true" className="text-white/40">
                    ·
                  </span>
                )}
                <span className={cn(i === 0 && 'font-semibold')}>{m}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              {metaItems.length > 0 && (
                <span aria-hidden="true" className="text-white/40">
                  ·
                </span>
              )}
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              {statusLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
