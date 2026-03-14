'use client'

import { useState } from 'react'
import { Globe, Pencil, RotateCcw } from 'lucide-react'
import { apiClient } from '@/lib/api'

type SettingsEndpoint = 'evaluation' | 'promotion' | 'compensation'

interface GlobalOverrideBadgeProps {
  isOverride: boolean
  companyId: string
  endpoint: SettingsEndpoint
  onChanged: () => void  // 오버라이드 상태 변경 후 부모에 알림
}

export function GlobalOverrideBadge({ isOverride, companyId, endpoint, onChanged }: GlobalOverrideBadgeProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleStartCustomizing = async () => {
    setLoading(true)
    try {
      await apiClient.post(`/api/v1/settings/${endpoint}/override`, { companyId })
      onChanged()
    } finally {
      setLoading(false)
    }
  }

  const handleRevertToGlobal = async () => {
    setLoading(true)
    try {
      await apiClient.delete(`/api/v1/settings/${endpoint}/override?companyId=${companyId}`)
      setShowConfirm(false)
      onChanged()
    } finally {
      setLoading(false)
    }
  }

  if (!isOverride) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-3 py-1 text-xs font-medium text-[#666]">
          <Globe className="h-3.5 w-3.5" />
          글로벌 기본값 사용 중
        </span>
        <button
          type="button"
          onClick={handleStartCustomizing}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#5E81F4] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4B6DE0] disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          커스터마이징 시작
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#D1FAE5] px-3 py-1 text-xs font-medium text-[#047857]">
        <Pencil className="h-3.5 w-3.5" />
        커스텀 설정 적용 중
      </span>

      {showConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#B91C1C]">글로벌로 복귀하면 이 법인의 설정이 삭제됩니다.</span>
          <button
            type="button"
            onClick={handleRevertToGlobal}
            disabled={loading}
            className="rounded-lg border border-[#FCA5A5] px-2.5 py-1 text-xs text-[#DC2626] hover:bg-[#FEE2E2] disabled:opacity-50"
          >
            {loading ? '처리중...' : '확인'}
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="rounded-lg px-2.5 py-1 text-xs text-[#666] hover:bg-[#F5F5F5]"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E8E8] px-3 py-1.5 text-xs text-[#666] hover:bg-[#FAFAFA]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          글로벌로 복귀
        </button>
      )}
    </div>
  )
}
