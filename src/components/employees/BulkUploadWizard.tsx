'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — BulkUploadWizard
// B2: 4-step Excel 일괄 발령 업로드 (부서코드 / 직급코드 사용)
// ═══════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BUTTON_VARIANTS } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface PreviewRow {
  사번?: string
  부서코드?: string
  직급코드?: string
  발효일?: string | Date
  변경유형?: string
  사유?: string
  rowNum?: number
  [key: string]: unknown
}

interface UploadError {
  row: number
  message: string
}

interface BulkUploadWizardProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// ─── Template download ───────────────────────────────────────

function downloadTemplate() {
  const template = [
    {
      사번: 'EMP001',
      부서코드: 'DEV',
      직급코드: 'M3',
      발효일: '2025-04-01',
      변경유형: 'TRANSFER',
      사유: '조직개편',
    },
    {
      사번: 'EMP002',
      부서코드: 'HR',
      직급코드: 'M4',
      발효일: '2025-04-01',
      변경유형: 'PROMOTION',
      사유: '정기승진',
    },
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(template)
  XLSX.utils.book_append_sheet(wb, ws, '발령일괄등록')
  XLSX.writeFile(wb, 'bulk_assignment_template.xlsx')
}

// ─── Component ──────────────────────────────────────────────

export function BulkUploadWizard({ open, onClose, onSuccess }: BulkUploadWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [errors, setErrors] = useState<UploadError[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep(1)
    setFile(null)
    setPreview([])
    setErrors([])
    setSubmitError(null)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  // ── Parse file and jump to step 3 ──
  const handleFileChange = useCallback(async (f: File) => {
    setFile(f)
    const buf = await f.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<PreviewRow>(ws)
    setPreview(rows.map((r, i) => ({ ...r, rowNum: i + 2 })))
    setErrors([])
    setStep(3)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const f = e.dataTransfer.files[0]
      if (f) handleFileChange(f)
    },
    [handleFileChange],
  )

  // ── Submit to API ──
  const handleSubmit = useCallback(async () => {
    if (!file) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/v1/employees/bulk-upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? '업로드 실패')
      if (json.data?.errors?.length > 0) {
        setErrors(json.data.errors as UploadError[])
        return
      }
      setStep(4)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setSubmitting(false)
    }
  }, [file])

  const errorRows = new Set(errors.map((e) => e.row))

  // Column display labels (matches API column names)
  const DEPT_COL = '부서코드'
  const GRADE_COL = '직급코드'

  // ── Render ──

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>발령 일괄 업로드 (Step {step}/4)</DialogTitle>
        </DialogHeader>

        {submitError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {/* ── Step 1: Template download ── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              아래 버튼으로 템플릿을 다운로드한 후, 발령 데이터를 입력하세요.
            </p>

            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground mb-2">필수 컬럼</p>
              <div className="flex flex-wrap gap-2">
                {['사번', DEPT_COL, GRADE_COL, '발효일'].map((col) => (
                  <span
                    key={col}
                    className="rounded-full bg-primary/10 text-emerald-700 text-xs px-2.5 py-0.5 font-medium"
                  >
                    {col}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {['변경유형', '사유'].map((col) => (
                  <span
                    key={col}
                    className="rounded-full bg-muted text-muted-foreground text-xs px-2.5 py-0.5"
                  >
                    {col} (선택)
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                변경유형 허용값: TRANSFER · PROMOTION · DEMOTION · REORGANIZATION ·
                STATUS_CHANGE · CONTRACT_CHANGE · COMPANY_TRANSFER · HIRE
              </p>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                템플릿 다운로드
              </Button>
              <Button
                onClick={() => setStep(2)}
                className={BUTTON_VARIANTS.primary}
              >
                다음: 파일 업로드
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: File upload ── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background py-12 cursor-pointer hover:border-primary hover:bg-primary/10/30 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                엑셀 파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls 파일만 지원 / 최대 500건</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileChange(f)
                }}
              />
            </div>
            <Button variant="outline" onClick={() => setStep(1)}>
              이전
            </Button>
          </div>
        )}

        {/* ── Step 3: Preview + validation ── */}
        {step === 3 && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                총 <strong>{preview.length}건</strong> 확인됨
                {errors.length > 0 && (
                  <span className="ml-2 text-destructive">오류 {errors.length}건</span>
                )}
              </p>
            </div>

            {/* Preview table */}
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground">행</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">사번</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">{DEPT_COL}</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">{GRADE_COL}</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">발효일</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr
                      key={row.rowNum}
                      className={
                        errorRows.has(row.rowNum ?? 0)
                          ? 'bg-destructive/10'
                          : 'hover:bg-background'
                      }
                    >
                      <td className="px-3 py-2 text-muted-foreground">{row.rowNum}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{String(row.사번 ?? '')}</td>
                      <td className="px-3 py-2">{String(row[DEPT_COL] ?? '')}</td>
                      <td className="px-3 py-2">{String(row[GRADE_COL] ?? '')}</td>
                      <td className="px-3 py-2">
                        {row.발효일 instanceof Date
                          ? row.발효일.toLocaleDateString('ko-KR')
                          : String(row.발효일 ?? '')}
                      </td>
                      <td className="px-3 py-2">
                        {errorRows.has(row.rowNum ?? 0) ? (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            오류
                          </span>
                        ) : (
                          <span className="text-emerald-700">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Error list */}
            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 space-y-1">
                {errors.slice(0, 5).map((e) => (
                  <p key={e.row} className="text-xs text-destructive">
                    행 {e.row}: {e.message}
                  </p>
                ))}
                {errors.length > 5 && (
                  <p className="text-xs text-destructive">외 {errors.length - 5}건 오류</p>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setErrors([])
                  setStep(2)
                }}
              >
                다시 업로드
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || errors.length > 0}
                className={BUTTON_VARIANTS.primary}
              >
                {submitting ? '처리 중...' : `${preview.length}건 전체 적용`}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Success ── */}
        {step === 4 && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-600" />
            <p className="text-lg font-bold text-foreground">업로드 완료</p>
            <p className="text-sm text-muted-foreground">
              총 {preview.length}건의 발령이 성공적으로 등록되었습니다.
            </p>
            <Button
              onClick={() => {
                onSuccess()
                handleClose()
              }}
              className={BUTTON_VARIANTS.primary}
            >
              완료
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
