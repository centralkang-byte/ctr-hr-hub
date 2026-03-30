'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Global Error Boundary
// 모든 대시보드 페이지의 예외를 캐치하여 친화적인 UI 제공
// ═══════════════════════════════════════════════════════════

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Default Fallback UI ────────────────────────────────────

function DefaultErrorFallback({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <h2 className="mb-2 text-lg font-bold text-foreground">문제가 발생했습니다</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          페이지를 불러오는 중 오류가 발생했습니다. 다시 시도하거나 홈으로 이동해 주세요.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
          >
            다시 시도
          </Button>
          <Button
            size="sm"
            className="bg-primary text-white hover:bg-primary/90"
            onClick={() => { window.location.href = '/' }}
          >
            홈으로 이동
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Error Boundary Class Component ────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <DefaultErrorFallback onReset={() => this.setState({ hasError: false })} />
      )
    }
    return this.props.children
  }
}
