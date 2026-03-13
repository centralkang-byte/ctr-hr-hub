'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CandidateData } from './PlanDetailDialog'
import EmployeeInsightPanel from '@/components/performance/EmployeeInsightPanel'
import { EmployeeCell } from '@/components/common/EmployeeCell'

// ─── Types ───────────────────────────────────────────────

interface CandidateCardProps {
  candidate: CandidateData
  onDelete: () => void
  onUpdate: () => void
}

const READINESS_BADGE: Record<string, { label: string; className: string }> = {
  READY_NOW: { label: '즉시 가능', className: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  READY_1_2_YEARS: { label: '1-2년 내', className: 'bg-[#EEF2FF] text-[#4338CA] border-[#EEF2FF]' },
  READY_3_PLUS_YEARS: { label: '3년 이상', className: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
}

// ─── Component ───────────────────────────────────────────

export default function CandidateCard({ candidate, onDelete }: CandidateCardProps) {
  const [showInsight, setShowInsight] = useState(false)
  const readiness = READINESS_BADGE[candidate.readiness]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <EmployeeCell
            name={candidate.employee.name}
            employeeNo={candidate.employee.employeeNo}
            size="sm"
            trailing={
              candidate.ranking != null && candidate.ranking > 0 ? (
                <Badge variant="outline" className="text-xs">#{candidate.ranking}</Badge>
              ) : undefined
            }
          />
        </div>
        <div className="flex items-center gap-2">
          {readiness ? (
            <Badge variant="outline" className={readiness.className}>{readiness.label}</Badge>
          ) : (
            <Badge variant="outline">{candidate.readiness}</Badge>
          )}
          <Button variant="ghost" size="sm" className="text-xs text-[#4338CA]" onClick={() => setShowInsight(true)}>
            상세 보기
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-[#EF4444]" />
          </Button>
        </div>
      </div>

      {candidate.developmentAreas && Array.isArray(candidate.developmentAreas) && candidate.developmentAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {candidate.developmentAreas.map((area, i) => (
            <Badge key={i} variant="outline" className="text-xs bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]">
              {area}
            </Badge>
          ))}
        </div>
      )}

      {candidate.notes && (
        <p className="mt-2 text-xs text-[#666]">{candidate.notes}</p>
      )}

      {candidate.developmentNote && (
        <p className="text-xs text-[#666] mt-1.5 border-t border-[#F5F5F5] pt-1.5">
          {candidate.developmentNote}
        </p>
      )}

      {showInsight && (
        <EmployeeInsightPanel
          employeeId={candidate.employee.id}
          employeeName={candidate.employee.name}
          onClose={() => setShowInsight(false)}
        />
      )}
    </div>
  )
}
