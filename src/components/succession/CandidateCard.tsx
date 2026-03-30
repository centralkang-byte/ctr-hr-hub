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
  READY_NOW: { label: '즉시 가능', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  READY_1_2_YEARS: { label: '1-2년 내', className: 'bg-primary/10 text-primary/90 border-primary/20' },
  READY_3_PLUS_YEARS: { label: '3년 이상', className: 'bg-amber-100 text-amber-700 border-amber-300' },
}

// ─── Component ───────────────────────────────────────────

export default function CandidateCard({ candidate, onDelete }: CandidateCardProps) {
  const [showInsight, setShowInsight] = useState(false)
  const readiness = READINESS_BADGE[candidate.readiness]

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
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
          <Button variant="ghost" size="sm" className="text-xs text-primary/90" onClick={() => setShowInsight(true)}>
            상세 보기
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      {candidate.developmentAreas && Array.isArray(candidate.developmentAreas) && candidate.developmentAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {candidate.developmentAreas.map((area, i) => (
            <Badge key={i} variant="outline" className="text-xs bg-indigo-100 text-primary/90 border-indigo-200">
              {area}
            </Badge>
          ))}
        </div>
      )}

      {candidate.notes && (
        <p className="mt-2 text-xs text-[#666]">{candidate.notes}</p>
      )}

      {candidate.developmentNote && (
        <p className="text-xs text-[#666] mt-1.5 border-t border-border pt-1.5">
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
