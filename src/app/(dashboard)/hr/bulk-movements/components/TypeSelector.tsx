'use client'

// ═══════════════════════════════════════════════════════════
// TypeSelector — 인사이동 유형 선택 카드 그리드
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  labelKey: string
  descriptionKey: string
  icon: typeof ArrowRightLeft
}[] = [
  {
    type: 'transfer',
    labelKey: 'type.transfer',
    descriptionKey: 'type.transferDesc',
    icon: ArrowRightLeft,
  },
  {
    type: 'promotion',
    labelKey: 'type.promotion',
    descriptionKey: 'type.promotionDesc',
    icon: TrendingUp,
  },
  {
    type: 'entity-transfer',
    labelKey: 'type.entityTransfer',
    descriptionKey: 'type.entityTransferDesc',
    icon: Building2,
  },
  {
    type: 'termination',
    labelKey: 'type.termination',
    descriptionKey: 'type.terminationDesc',
    icon: DoorOpen,
  },
  {
    type: 'compensation',
    labelKey: 'type.compensation',
    descriptionKey: 'type.compensationDesc',
    icon: Coins,
  },
]

export function TypeSelector({ onSelect }: TypeSelectorProps) {
  const t = useTranslations('bulkMovement')
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
                  <p className="font-medium text-sm">{t(opt.labelKey)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(opt.descriptionKey)}
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
            {t('button.downloadTemplate')}
          </Button>
          <Button size="sm" onClick={() => onSelect(selected)}>
            {t('button.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
