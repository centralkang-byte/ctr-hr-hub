'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KEDO Sign / Reject Dialog
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface KedoDocument {
  id: string
  title: string
  documentType: string
  status: string
  signatureLevel: string | null
  employee: { id: string; name: string; employeeNo: string }
}

interface Props {
  document: KedoDocument
  onClose: () => void
  onSuccess: () => void
}

type Mode = 'sign' | 'reject'

const DOC_TYPE_LABELS: Record<string, string> = {
  EMPLOYMENT_CONTRACT: '근로계약서',
  SUPPLEMENTARY_AGREEMENT: '부속합의서',
  TRANSFER_ORDER: '이동명령',
  VACATION_ORDER: '휴가명령',
  DISMISSAL_ORDER: '해고명령',
  SALARY_CHANGE: '급여변경',
  DISCIPLINARY_ORDER: '징계명령',
}

const SIGNATURE_DESCRIPTIONS: Record<string, string> = {
  PEP: 'ПЭП — 간이 전자서명. 휴가명령 등 일반 문서에 사용.',
  UNEP: 'УНЭП — 강화 비인증 전자서명. 이동명령, 급여변경 등에 사용.',
  UKEP: 'УКЭП — 강화 인증 전자서명. 근로계약서, 해고명령 등 법적 효력 필요 문서에 사용.',
}

export default function KedoSignDialog({ document, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('sign')
  const [signatureLevel, setSignatureLevel] = useState(document.signatureLevel ?? 'UNEP')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSign = async () => {
    setProcessing(true)
    setError(null)
    try {
      await apiClient.post(`/api/v1/compliance/ru/kedo/${document.id}/sign`, {
        signatureLevel,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '서명 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('반려 사유를 입력하세요.')
      return
    }
    setProcessing(true)
    setError(null)
    try {
      await apiClient.post(`/api/v1/compliance/ru/kedo/${document.id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '반려 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>전자서명 처리</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Info */}
          <div className="p-4 bg-background rounded-lg space-y-1.5">
            <p className="text-sm font-semibold text-foreground">{document.title}</p>
            <p className="text-xs text-muted-foreground">
              {DOC_TYPE_LABELS[document.documentType] ?? document.documentType}
            </p>
            <p className="text-xs text-muted-foreground">
              대상자: {document.employee.name} ({document.employee.employeeNo})
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('sign'); setError(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === 'sign'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-card text-muted-foreground border-border hover:bg-background'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              서명
            </button>
            <button
              onClick={() => { setMode('reject'); setError(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === 'reject'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-red-300 text-destructive hover:bg-destructive/10'
              }`}
            >
              <XCircle className="w-4 h-4" />
              반려
            </button>
          </div>

          {/* Sign Mode */}
          {mode === 'sign' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  서명 수준 <span className="text-red-500">*</span>
                </label>
                <select
                  value={signatureLevel}
                  onChange={(e) => setSignatureLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
                >
                  <option value="PEP">PEP — 간이 전자서명</option>
                  <option value="UNEP">УНЭП — 강화 비인증 전자서명</option>
                  <option value="UKEP">УКЭП — 강화 인증 전자서명</option>
                </select>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg flex gap-2">
                <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-primary/90">
                  {SIGNATURE_DESCRIPTIONS[signatureLevel]}
                </p>
              </div>
            </div>
          )}

          {/* Reject Mode */}
          {mode === 'reject' && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                반려 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder={'반려 사유를 상세히 입력하세요.'}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground resize-none"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="bg-card border border-border hover:bg-background text-foreground px-4 py-2 rounded-lg font-medium text-sm"
          >
            취소
          </button>
          {mode === 'sign' ? (
            <button
              onClick={handleSign}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {processing ? '처리 중...' : '서명 완료'}
            </button>
          ) : (
            <button
              onClick={handleReject}
              disabled={processing}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {processing ? '처리 중...' : '반려 확인'}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
