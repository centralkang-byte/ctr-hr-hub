// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PageHeader
// Server Component — 일관된 페이지 헤더
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { TYPOGRAPHY } from '@/lib/styles'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        {/* Wave 0: proto .page-h h1 26px/600/-0.015em — TYPOGRAPHY.pageTitle SSOT */}
        <h1 className={TYPOGRAPHY.pageTitle}>
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
