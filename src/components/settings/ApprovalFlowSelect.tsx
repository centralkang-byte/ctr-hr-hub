'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { ApprovalFlowData, ApprovalModule } from '@/types/settings'

interface ApprovalFlowSelectProps {
  module: ApprovalModule
  companyId?: string
  value: string | null
  onChange: (flowId: string | null) => void
  disabled?: boolean
  placeholder?: string
}

export function ApprovalFlowSelect({
  module,
  companyId,
  value,
  onChange,
  disabled = false,
  placeholder = '승인 플로우 선택',
}: ApprovalFlowSelectProps) {
  const [flows, setFlows] = useState<ApprovalFlowData[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({ module })
    if (companyId) params.set('companyId', companyId)
    apiClient.get<ApprovalFlowData[]>(`/api/v1/settings/approval-flows?${params}`).then((res) => {
      if (res.data) setFlows(res.data.filter((f) => !f.deletedAt))
    })
  }, [module, companyId])

  const selected = flows.find((f) => f.id === value)

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#D4D4D4] bg-white px-3 py-2 text-sm text-[#333] hover:border-[#5E81F4] focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/20 disabled:cursor-not-allowed disabled:bg-[#FAFAFA] disabled:text-[#999]"
      >
        <span>{selected ? selected.name : placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-[#999] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-[#E8E8E8] bg-white shadow-lg">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="flex w-full items-center px-4 py-2.5 text-left text-sm text-[#999] hover:bg-[#FAFAFA]"
            >
              선택 안 함
            </button>
            {flows.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => { onChange(flow.id); setOpen(false) }}
                className={`flex w-full flex-col px-4 py-2.5 text-left hover:bg-[#FAFAFA] ${
                  flow.id === value ? 'bg-[#EDF1FE]' : ''
                }`}
              >
                <span className="text-sm font-medium text-[#333]">{flow.name}</span>
                <span className="text-xs text-[#999]">
                  {flow.steps.length}단계 승인
                  {flow.companyId ? '' : ' (글로벌)'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
