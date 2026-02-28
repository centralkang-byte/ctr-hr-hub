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
  READY_NOW: { label: '즉시 가능', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  READY_1_2_YEARS: { label: '1-2년 내', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  READY_3_PLUS_YEARS: { label: '3년 이상', className: 'bg-amber-50 text-amber-700 border-amber-200' },
}

// ─── Component ───────────────────────────────────────────

export default function CandidateCard({ candidate, onDelete }: CandidateCardProps) {
  const readiness = READINESS_BADGE[candidate.readiness]

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-semibold text-sm">
            {candidate.employee.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {candidate.employee.name}
            </p>
            <p className="text-xs text-slate-500">{candidate.employee.employeeNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readiness ? (
            <Badge variant="outline" className={readiness.className}>{readiness.label}</Badge>
          ) : (
            <Badge variant="outline">{candidate.readiness}</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      {candidate.developmentAreas && Array.isArray(candidate.developmentAreas) && candidate.developmentAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {candidate.developmentAreas.map((area, i) => (
            <Badge key={i} variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
              {area}
            </Badge>
          ))}
        </div>
      )}

      {candidate.notes && (
        <p className="mt-2 text-xs text-slate-500">{candidate.notes}</p>
      )}
    </div>
  )
}
