'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 요청 결재 모달
// B4: Requisition Approval Modal
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { X, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { MODAL_STYLES } from '@/lib/styles'

interface Props {
  requisition: {
    id: string
    reqNumber: string
    title: string
    urgency: string
    justification?: string
  }
  onClose: () => void
  onSuccess: () => void
}

export default function RequisitionApproveModal({ requisition, onClose, onSuccess }: Props) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDecision = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !comment.trim()) {
      setError('반려 시 사유를 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/api/v1/recruitment/requisitions/${requisition.id}/approve`, {
        action,
        comment: comment.trim() || undefined,
      })
      onSuccess()
    } catch {
      setError('결재 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={MODAL_STYLES.container}>
      <div className={MODAL_STYLES.content.md}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{'채용 요청 결재'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={18} className="text-[#666]" />
          </button>
        </div>

        {/* 요청 요약 */}
        <div className="p-6 space-y-4">
          <div className="bg-background rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-[#999]">{requisition.reqNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                requisition.urgency === 'urgent' ? 'bg-destructive/10 text-destructive' :
                requisition.urgency === 'normal' ? 'bg-amber-100 text-amber-700' :
                'bg-sky-50 text-sky-700'
              }`}>
                {requisition.urgency === 'urgent' ? '긴급' : requisition.urgency === 'normal' ? '보통' : '낮음'}
              </span>
            </div>
            <p className="font-semibold text-foreground">{requisition.title}</p>
          </div>

          {/* 코멘트 */}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">
              {'코멘트'} <span className="text-[#999] font-normal">{'(반려 시 필수)'}</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={'승인 또는 반려 사유를 입력하세요...'}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none placeholder:text-[#999]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-border rounded-lg text-sm text-[#555] hover:bg-background disabled:opacity-50"
          >
            {'취소'}
          </button>
          <button
            onClick={() => handleDecision('reject')}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-destructive rounded-lg text-sm hover:bg-destructive/10 disabled:opacity-50"
          >
            <XCircle size={15} />
            {'반려'}
          </button>
          <button
            onClick={() => handleDecision('approve')}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <CheckCircle2 size={15} />
            {'승인'}
          </button>
        </div>
      </div>
    </div>
  )
}
