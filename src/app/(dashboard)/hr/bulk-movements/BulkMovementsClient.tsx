'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Movements 3-Step Wizard
// 일괄 인사이동: 유형 선택 → 파일 업로드/검증 → 실행 확인
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { TYPOGRAPHY } from '@/lib/styles/typography'
import type { MovementType, ValidateResponse } from '@/lib/bulk-movement/types'
import { TypeSelector } from './components/TypeSelector'
import { FileUploader } from './components/FileUploader'
import { ValidationPreview } from './components/ValidationPreview'
import { ExecutionConfirm } from './components/ExecutionConfirm'

type Step = 'select' | 'upload' | 'confirm'

const STEPS: { key: Step; label: string }[] = [
  { key: 'select', label: '유형 선택' },
  { key: 'upload', label: '파일 업로드' },
  { key: 'confirm', label: '실행 확인' },
]

export default function BulkMovementsClient() {
  const [step, setStep] = useState<Step>('select')
  const [selectedType, setSelectedType] = useState<MovementType | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [validateResult, setValidateResult] = useState<ValidateResponse | null>(null)

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  const handleTypeSelect = useCallback((type: MovementType) => {
    setSelectedType(type)
    setStep('upload')
    setFile(null)
    setValidateResult(null)
  }, [])

  const handleValidateComplete = useCallback((result: ValidateResponse, uploadedFile: File) => {
    setValidateResult(result)
    setFile(uploadedFile)
    if (result.valid) {
      setStep('confirm')
    }
    // errors인 경우 upload 단계에서 ValidationPreview 표시
  }, [])

  const handleExecuteSuccess = useCallback(() => {
    // 성공 후 초기 상태로 리셋
    setStep('select')
    setSelectedType(null)
    setFile(null)
    setValidateResult(null)
  }, [])

  const handleBack = useCallback(() => {
    if (step === 'upload') {
      setStep('select')
      setFile(null)
      setValidateResult(null)
    } else if (step === 'confirm') {
      setStep('upload')
    }
  }, [step])

  return (
    <div className="space-y-6 p-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className={cn(TYPOGRAPHY.pageTitle)}>일괄 인사이동</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CSV 파일을 업로드하여 다수 직원의 인사이동을 일괄 처리합니다
        </p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => {
          const isDone = idx < stepIndex
          const isActive = idx === stepIndex
          return (
            <div key={s.key} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={cn(
                    'h-px w-8',
                    isDone ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isDone && 'bg-primary text-primary-foreground',
                    isActive && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                    !isDone && !isActive && 'bg-muted text-muted-foreground'
                  )}
                >
                  {idx + 1}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 뒤로가기 */}
      {step !== 'select' && (
        <button
          onClick={handleBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 이전 단계
        </button>
      )}

      {/* Step 1: 유형 선택 */}
      {step === 'select' && (
        <TypeSelector onSelect={handleTypeSelect} />
      )}

      {/* Step 2: 파일 업로드 + 검증 */}
      {step === 'upload' && selectedType && (
        <div className="space-y-6">
          <FileUploader
            type={selectedType}
            onValidateComplete={handleValidateComplete}
          />
          {validateResult && !validateResult.valid && (
            <ValidationPreview result={validateResult} />
          )}
        </div>
      )}

      {/* Step 3: 실행 확인 */}
      {step === 'confirm' && selectedType && file && validateResult && (
        <ExecutionConfirm
          type={selectedType}
          file={file}
          result={validateResult}
          onSuccess={handleExecuteSuccess}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
