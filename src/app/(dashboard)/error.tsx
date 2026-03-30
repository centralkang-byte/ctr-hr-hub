'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Error Boundary
// Next.js App Router error.tsx: catches runtime errors in (dashboard)
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Send to Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          페이지를 불러올 수 없습니다
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          일시적인 오류가 발생했습니다. 다시 시도해주세요.
          <br />
          문제가 계속되면 관리자에게 문의하세요.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">
            오류 코드: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          다시 시도
        </button>
      </div>
    </div>
  )
}
