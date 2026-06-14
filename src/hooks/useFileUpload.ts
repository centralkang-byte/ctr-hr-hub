'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useFileUpload
// presigned POST 2단계 업로드(performPresignedUpload)의 React 상태 래퍼.
// 반환된 uploadId 를 도메인 제출 본문에 넣어 서버가 검증·소비.
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import {
  performPresignedUpload,
  type PerformUploadResult,
} from '@/lib/upload/perform-upload'

// ─── Types ──────────────────────────────────────────────

interface UseFileUploadOptions {
  /** presigned POST 를 발급하는 API 경로 (예: /api/v1/leave-of-absence/proof/presigned) */
  presignEndpoint: string
}

export type FileUploadResult = PerformUploadResult

interface UseFileUploadReturn {
  upload: (file: File) => Promise<FileUploadResult>
  uploading: boolean
  error: string | null
  reset: () => void
}

// ─── Hook ───────────────────────────────────────────────

export function useFileUpload({ presignEndpoint }: UseFileUploadOptions): UseFileUploadReturn {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(
    async (file: File): Promise<FileUploadResult> => {
      setUploading(true)
      setError(null)
      try {
        return await performPresignedUpload(presignEndpoint, file)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '파일 업로드에 실패했습니다.'
        setError(msg)
        throw e
      } finally {
        setUploading(false)
      }
    },
    [presignEndpoint],
  )

  const reset = useCallback(() => setError(null), [])

  return { upload, uploading, error, reset }
}
