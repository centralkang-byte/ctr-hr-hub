'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CandidateData } from './PlanDetailDialog'

// ─── Types ───────────────────────────────────────────────

interface CandidateCardProps {
  candidate: CandidateData
  onDelete: () => void
  onUpdate: () => void
}

const READINESS_BADGE: Record<string, { label: string; className: string }> = {
  READY_NOW: { label: '즉시 가능', className: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  READY_1_2_YEARS: { label: '1-2년 내', className: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]' },
  READY_3_PLUS_YEARS: { label: '3년 이상', className: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
}

// ─── Component ───────────────────────────────────────────

export default function CandidateCard({ candidate, onDelete }: CandidateCardProps) {
  const readiness = READINESS_BADGE[candidate.readiness]

  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#00A844] font-semibold text-sm">
            {candidate.employee.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A1A1A]">
              {candidate.employee.name}
              {candidate.ranking != null && candidate.ranking > 0 && (
                <span className="text-xs text-[#999] ml-1">#{candidate.ranking}</span>
              )}
            </p>
            <p className="text-xs text-[#666]">{candidate.employee.employeeNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readiness ? (
            <Badge variant="outline" className={readiness.className}>{readiness.label}</Badge>
          ) : (
            <Badge variant="outline">{candidate.readiness}</Badge>
          )}
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
    </div>
  )
}
