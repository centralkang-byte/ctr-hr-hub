'use client'

// ═══════════════════════════════════════════════════════════
// ExecutionConfirm — 실행 전 최종 확인 + 실행 결과
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
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

const TYPE_LABEL_KEYS: Record<MovementType, string> = {
  transfer: 'type.transfer',
  promotion: 'type.promotion',
  'entity-transfer': 'type.entityTransfer',
  termination: 'type.termination',
  compensation: 'type.compensation',
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
  const t = useTranslations('bulkMovement')
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
        throw new Error(body?.error ?? t('execution.failed', { status: res.status }))
      }

      const data: ExecuteResponse = await res.json()
      setExecResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('execution.error'))
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
            <p className="text-lg font-semibold">{t('execution.complete')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('execution.appliedCount', { type: t(TYPE_LABEL_KEYS[type]), count: execResult.applied })}
            </p>
          </div>
          <Button variant="outline" onClick={onSuccess}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            {t('execution.newTask')}
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
              <p className="text-muted-foreground">{t('execution.movementType')}</p>
              <p className="font-medium">{t(TYPE_LABEL_KEYS[type])}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('execution.processCount')}</p>
              <p className="font-medium">{t('execution.countUnit', { count: result.validRows })}</p>
            </div>
          </div>
          {warningCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('validation.warnings', { count: warningCount })}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 경고 박스 */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-md border border-amber-200 bg-amber-500/10 p-4',
          'dark:border-amber-800 dark:bg-amber-950/30'
        )}
      >
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            {t('execution.irreversibleWarning')}
          </p>
          <p className="text-amber-700 dark:text-amber-300 mt-1">
            {t('execution.reviewBeforeExecute')}
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
          {t('button.previous')}
        </Button>
        <Button
          variant="destructive"
          onClick={handleExecute}
          disabled={isExecuting}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('execution.executing')}
            </>
          ) : (
            t('execution.executeBatch', { count: result.validRows })
          )}
        </Button>
      </div>
    </div>
  )
}
