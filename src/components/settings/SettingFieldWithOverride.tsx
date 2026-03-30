'use client'

// ═══════════════════════════════════════════════════════════
// Settings — Field With Override Indicator (H-1)
// Shows 🔵 global / 🟠 custom / 🔒 locked for each field
// ═══════════════════════════════════════════════════════════

import { Globe, Pencil, Lock, RotateCcw } from 'lucide-react'

type OverrideStatus = 'global' | 'custom' | 'locked'

interface SettingFieldWithOverrideProps {
  label: string
  description?: string
  status: OverrideStatus
  globalValue?: string  // shown when status = 'custom'
  onRevert?: () => void
  children: React.ReactNode
  companySelected?: boolean  // are we viewing a company (vs global)?
}

export function SettingFieldWithOverride({
  label,
  description,
  status,
  globalValue,
  onRevert,
  children,
  companySelected = false,
}: SettingFieldWithOverrideProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Label row */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Override indicator — only shown when a company is selected */}
        {companySelected && (
          <div className="shrink-0">
            {status === 'global' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                <Globe className="h-3 w-3" />
                글로벌 기본값
              </span>
            )}
            {status === 'custom' && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600">
                  <Pencil className="h-3 w-3" />
                  법인 커스텀
                </span>
                {globalValue && (
                  <span className="text-xs text-muted-foreground">(글로벌: {globalValue})</span>
                )}
                {onRevert && (
                  <button
                    type="button"
                    onClick={onRevert}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-orange-200 hover:text-orange-600"
                  >
                    <RotateCcw className="h-3 w-3" />
                    기본값으로
                  </button>
                )}
              </div>
            )}
            {status === 'locked' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground/60">
                <Lock className="h-3 w-3" />
                글로벌 고정
              </span>
            )}
          </div>
        )}
      </div>

      {/* Field content */}
      <div>{children}</div>
    </div>
  )
}
