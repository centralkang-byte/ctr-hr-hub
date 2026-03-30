'use client'

// ═══════════════════════════════════════════════════════════
// Settings — Global Change Confirm Modal (H-1)
// Shows affected companies when changing a global value
// ═══════════════════════════════════════════════════════════

import { AlertTriangle, X } from 'lucide-react'
import { MODAL_STYLES } from '@/lib/styles'

interface Company {
  id: string
  code: string
  name: string
  hasOverride: boolean
}

interface GlobalChangeConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  settingName: string
  companies: Company[]
  loading?: boolean
}

export function GlobalChangeConfirmModal({
  open,
  onClose,
  onConfirm,
  settingName,
  companies,
  loading = false,
}: GlobalChangeConfirmModalProps) {
  if (!open) return null

  const affected = companies.filter((c) => !c.hasOverride)
  const unaffected = companies.filter((c) => c.hasOverride)

  return (
    <div className={MODAL_STYLES.container}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>

        {/* Title */}
        <h3 className="mb-1 text-lg font-semibold text-foreground">
          글로벌 설정 변경 확인
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          &quot;{settingName}&quot; 변경사항이 아래 법인에 적용됩니다.
        </p>

        {/* Affected */}
        {affected.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-foreground">
              ✅ 즉시 적용 (글로벌 기본값 사용 중)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {affected.map((c) => (
                <span key={c.id} className="rounded-md bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                  {c.code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Unaffected */}
        {unaffected.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              ⬜ 영향 없음 (법인 커스텀 설정 사용 중)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unaffected.map((c) => (
                <span key={c.id} className="rounded-md bg-gray-50 px-2.5 py-1 text-xs text-muted-foreground">
                  {c.code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '적용 중...' : '적용'}
          </button>
        </div>
      </div>
    </div>
  )
}
