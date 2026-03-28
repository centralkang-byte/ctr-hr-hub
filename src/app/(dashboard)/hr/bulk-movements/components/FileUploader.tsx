'use client'

// ═══════════════════════════════════════════════════════════
// FileUploader — CSV 파일 드래그앤드롭 업로드 + 검증
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MovementType, ValidateResponse } from '@/lib/bulk-movement/types'

const TYPE_LABELS: Record<MovementType, string> = {
  transfer: '부서이동',
  promotion: '승진',
  'entity-transfer': '법인전환',
  termination: '퇴직',
  compensation: '급여변경',
}

interface FileUploaderProps {
  type: MovementType
  onValidateComplete: (result: ValidateResponse, file: File) => void
}

export function FileUploader({ type, onValidateComplete }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) {
        setError('CSV 파일만 업로드할 수 있습니다')
        return
      }

      setFileName(file.name)
      setError(null)
      setIsLoading(true)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', type)

        const res = await fetch('/api/v1/bulk-movements/validate', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? `서버 오류 (${res.status})`)
        }

        const result: ValidateResponse = await res.json()
        onValidateComplete(result, file)
      } catch (err) {
        setError(err instanceof Error ? err.message : '검증 중 오류가 발생했습니다')
      } finally {
        setIsLoading(false)
      }
    },
    [type, onValidateComplete]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <strong>{TYPE_LABELS[type]}</strong> 처리를 위한 CSV 파일을 업로드해주세요
      </p>

      {/* 드래그앤드롭 영역 */}
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          isLoading && 'pointer-events-none opacity-60'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleInputChange}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">검증 중...</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              클릭하여 다른 파일 선택
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              CSV 파일을 드래그하거나 클릭하여 선택
            </p>
            <p className="text-xs text-muted-foreground">
              .csv 형식만 지원됩니다
            </p>
          </div>
        )}
      </div>

      {/* 템플릿 다운로드 안내 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            window.open(`/api/v1/bulk-movements/templates/${type}`, '_blank')
          }}
        >
          <FileText className="h-4 w-4 mr-1.5" />
          템플릿 다운로드
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
