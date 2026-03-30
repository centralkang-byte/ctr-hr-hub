'use client'

// ═══════════════════════════════════════════════════════════
// ExecutionConfirm — 실행 전 최종 확인 + 실행 결과
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type {
  MovementType,
  ValidateResponse,
  ExecuteResponse,
} from '@/lib/bulk-movement/types'

const TYPE_LABELS: Record<MovementType, string> = {
  transfer: '부서이동',
  promotion: '승진',
  'entity-transfer': '법인전환',
  termination: '퇴직',
  compensation: '급여변경',
}

interface ExecutionConfirmProps {
  type: MovementType
  file: File
  result: ValidateResponse
  onSuccess: () => void
  onBack: () => void
}

export function ExecutionConfirm({
  type,
  file,
  result,
  onSuccess,
  onBack,
}: ExecutionConfirmProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [execResult, setExecResult] = useState<ExecuteResponse | null>(null)

  const warningCount = result.errors.filter((e) => e.severity === 'warning').length

  const handleExecute = useCallback(async () => {
    setIsExecuting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      if (result.validationToken) {
        formData.append('validationToken', result.validationToken)
      }

      const res = await fetch('/api/v1/bulk-movements/execute', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `실행 실패 (${res.status})`)
      }

      const data: ExecuteResponse = await res.json()
      setExecResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '실행 중 오류가 발생했습니다')
    } finally {
      setIsExecuting(false)
    }
  }, [file, type, result.validationToken])

  // 실행 성공 화면
  if (execResult?.success) {
    return (
      <Card className="border-tertiary/20 bg-tertiary-container/10 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <div className="text-center">
            <p className="text-lg font-semibold">일괄 처리 완료</p>
            <p className="text-sm text-muted-foreground mt-1">
              {TYPE_LABELS[type]} {execResult.applied}건이 성공적으로 적용되었습니다
            </p>
          </div>
          <Button variant="outline" onClick={onSuccess}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            새로운 작업 시작
          </Button>
        </CardContent>
      </Card>
    )
  }

  // 실행 전 확인 화면
  return (
    <div className="space-y-4">
      {/* 요약 정보 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">이동 유형</p>
              <p className="font-medium">{TYPE_LABELS[type]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">처리 건수</p>
              <p className="font-medium">{result.validRows}건</p>
            </div>
          </div>
          {warningCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>경고 {warningCount}건이 있습니다</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 경고 박스 */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4',
          'dark:border-amber-800 dark:bg-amber-950/30'
        )}
      >
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            이 작업은 되돌릴 수 없습니다
          </p>
          <p className="text-amber-700 dark:text-amber-300 mt-1">
            실행 전에 데이터를 다시 한번 확인해주세요.
            처리 후에는 개별 건으로만 수정이 가능합니다.
          </p>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack} disabled={isExecuting}>
          이전
        </Button>
        <Button
          variant="destructive"
          onClick={handleExecute}
          disabled={isExecuting}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              실행 중...
            </>
          ) : (
            `${result.validRows}건 일괄 실행`
          )}
        </Button>
      </div>
    </div>
  )
}
