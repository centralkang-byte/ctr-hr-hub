'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Global Error Boundary
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ctr-gray-50 px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-10 w-10 text-ctr-accent" />
        </div>
        <h1 className="text-4xl font-bold text-ctr-gray-900">오류 발생</h1>
        <h2 className="mt-2 text-xl font-semibold text-ctr-gray-700">
          문제가 발생했습니다
        </h2>
        <p className="mt-2 text-sm text-ctr-gray-500">
          죄송합니다. 예기치 않은 오류가 발생했습니다.
          <br />
          다시 시도하거나 홈으로 돌아가세요.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-ctr-gray-400">
            오류 코드: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            onClick={reset}
            variant="outline"
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            다시 시도
          </Button>
          <Link href="/">
            <Button className="bg-ctr-primary hover:bg-ctr-primary/90">
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
