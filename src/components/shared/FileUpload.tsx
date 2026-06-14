'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — FileUpload (재사용 단일 파일 업로드)
// presigned POST 2단계 업로드(useFileUpload)를 감싼 controlled 드롭존.
// 부모가 uploadId/파일명 상태를 소유(value + onUploaded/onRemove).
// 표시 문구는 props 로 주입(i18n 비의존). 서버가 형식·크기를 재검증.
// ═══════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFileUpload } from '@/hooks/useFileUpload'

// ─── Types ──────────────────────────────────────────────

interface FileUploadProps {
  /** presigned POST 발급 API 경로 */
  presignEndpoint: string
  /** 업로드 성공 시 (uploadId, 파일명) */
  onUploaded: (uploadId: string, filename: string) => void
  /** 업로드된 파일 제거 */
  onRemove?: () => void
  /** 현재 업로드된 파일명 (표시용). null = 미업로드 */
  value?: string | null
  /** accept 속성 + 클라이언트 확장자 사전 검증 (예: '.pdf,.jpg,.png') */
  accept?: string
  /** 클라이언트 크기 사전 검증 (MB) */
  maxSizeMB?: number
  disabled?: boolean
  /** 드롭존 주요 안내 */
  label: string
  /** 보조 안내 (허용 형식 등) */
  hint?: string
  uploadingLabel?: string
  changeLabel?: string
  removeLabel?: string
}

// ─── Helpers ────────────────────────────────────────────

function extensionAllowed(filename: string, accept?: string): boolean {
  if (!accept) return true
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext) return false
  return accept
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .includes(ext)
}

// ─── Component ──────────────────────────────────────────

export function FileUpload({
  presignEndpoint,
  onUploaded,
  onRemove,
  value,
  accept,
  maxSizeMB,
  disabled = false,
  label,
  hint,
  uploadingLabel = '업로드 중…',
  changeLabel = '클릭하여 변경',
  removeLabel = '파일 제거',
}: FileUploadProps) {
  const { upload, uploading, error: uploadError, reset } = useFileUpload({ presignEndpoint })
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const error = localError ?? uploadError
  const busy = uploading || disabled

  const handleFile = useCallback(
    async (file: File) => {
      reset()
      setLocalError(null)

      if (!extensionAllowed(file.name, accept)) {
        setLocalError('허용되지 않는 파일 형식입니다.')
        return
      }
      if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        setLocalError(`파일이 너무 큽니다. (최대 ${maxSizeMB}MB)`)
        return
      }

      try {
        const result = await upload(file)
        onUploaded(result.uploadId, result.filename)
      } catch {
        // 에러는 useFileUpload 가 surface (uploadError)
      }
    },
    [accept, maxSizeMB, upload, onUploaded, reset],
  )

  const openPicker = useCallback(() => {
    if (!busy) inputRef.current?.click()
  }, [busy])

  // ─── Uploaded state ───────────────────────────────────
  if (value && !uploading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate text-sm font-medium">{value}</span>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={removeLabel}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Empty / uploading state ──────────────────────────
  return (
    <div className="space-y-2">
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border-strong hover:border-muted-foreground/60',
          busy && 'pointer-events-none opacity-60',
        )}
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label={label}
        aria-disabled={busy}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files[0]
          if (file && !busy) handleFile(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{uploadingLabel}</p>
          </>
        ) : (
          <>
            <Upload className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{label}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {value && <p className="text-xs text-muted-foreground">{changeLabel}</p>}
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
