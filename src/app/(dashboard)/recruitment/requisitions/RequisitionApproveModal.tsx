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
        <div className="flex items-center justify-between p-6 border-b border-[#E8E8E8]">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">{'채용 요청 결재'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F5F5]">
            <X size={18} className="text-[#666]" />
          </button>
        </div>

        {/* 요청 요약 */}
        <div className="p-6 space-y-4">
          <div className="bg-[#FAFAFA] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-[#999]">{requisition.reqNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                requisition.urgency === 'urgent' ? 'bg-[#FEE2E2] text-[#B91C1C]' :
                requisition.urgency === 'normal' ? 'bg-[#FEF3C7] text-[#B45309]' :
                'bg-[#F0F9FF] text-[#0369A1]'
              }`}>
                {requisition.urgency === 'urgent' ? '긴급' : requisition.urgency === 'normal' ? '보통' : '낮음'}
              </span>
            </div>
            <p className="font-semibold text-[#1A1A1A]">{requisition.title}</p>
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
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 focus:border-[#5E81F4] resize-none placeholder:text-[#999]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-[#FEE2E2] rounded-lg text-[#B91C1C] text-sm">
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
            className="px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            {'취소'}
          </button>
          <button
            onClick={() => handleDecision('reject')}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-[#FCA5A5] text-[#DC2626] rounded-lg text-sm hover:bg-[#FEE2E2] disabled:opacity-50"
          >
            <XCircle size={15} />
            {'반려'}
          </button>
          <button
            onClick={() => handleDecision('approve')}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <CheckCircle2 size={15} />
            {'승인'}
          </button>
        </div>
      </div>
    </div>
  )
}
