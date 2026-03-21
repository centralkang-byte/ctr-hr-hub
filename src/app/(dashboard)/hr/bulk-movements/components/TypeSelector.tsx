'use client'

// ═══════════════════════════════════════════════════════════
// TypeSelector — 인사이동 유형 선택 카드 그리드
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowRightLeft,
  TrendingUp,
  Building2,
  DoorOpen,
  Coins,
  Download,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { MovementType } from '@/lib/bulk-movement/types'

interface TypeSelectorProps {
  onSelect: (type: MovementType) => void
}

const TYPE_OPTIONS: {
  type: MovementType
  label: string
  description: string
  icon: typeof ArrowRightLeft
}[] = [
  {
    type: 'transfer',
    label: '부서이동',
    description: '부서/팀 간 인사이동을 일괄 처리합니다',
    icon: ArrowRightLeft,
  },
  {
    type: 'promotion',
    label: '승진',
    description: '직급/직위 변경을 일괄 처리합니다',
    icon: TrendingUp,
  },
  {
    type: 'entity-transfer',
    label: '법인전환',
    description: '소속 법인(회사) 변경을 일괄 처리합니다',
    icon: Building2,
  },
  {
    type: 'termination',
    label: '퇴직',
    description: '퇴직 처리를 일괄 진행합니다',
    icon: DoorOpen,
  },
  {
    type: 'compensation',
    label: '급여변경',
    description: '급여/보상 변경을 일괄 처리합니다',
    icon: Coins,
  },
]

export function TypeSelector({ onSelect }: TypeSelectorProps) {
  const [selected, setSelected] = useState<MovementType | null>(null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const isSelected = selected === opt.type
          return (
            <Card
              key={opt.type}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected && 'ring-2 ring-primary shadow-md'
              )}
              onClick={() => setSelected(opt.type)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selected && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(`/api/v1/bulk-movements/templates/${selected}`, '_blank')
            }}
          >
            <Download className="h-4 w-4 mr-1.5" />
            템플릿 다운로드
          </Button>
          <Button size="sm" onClick={() => onSelect(selected)}>
            다음 →
          </Button>
        </div>
      )}
    </div>
  )
}
