'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Global Error Boundary
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react'
import StatusPage from '@/components/shared/StatusPage'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return <StatusPage variant="error" digest={error.digest} onRetry={reset} />
}
