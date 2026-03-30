'use client'

import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

export type QuickSelect = {
  label: string
  getDate: () => Date
}

export interface EffectiveDatePickerProps {
  value: Date
  onChange: (date: Date) => void
  quickSelects?: QuickSelect[]
  allowFuture?: boolean
  employeeHireDate?: Date | string | null
  label?: string
  className?: string
}

// ─── 기본 빠른선택 생성 함수 ─────────────────────────────────
// exported so consumers can use it

export function buildDefaultQuickSelects(employeeHireDate?: Date | string | null): QuickSelect[] {
  const now = new Date()
  const selects: QuickSelect[] = [
    { label: '오늘', getDate: () => new Date() },
    { label: '1년전', getDate: () => new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
    {
      label: '전기말',
      getDate: () => new Date(now.getFullYear() - 1, 11, 31),
    },
  ]

  if (employeeHireDate) {
    const hireD = typeof employeeHireDate === 'string' ? new Date(employeeHireDate) : employeeHireDate
    if (!isNaN(hireD.getTime())) {
      selects.splice(2, 0, {
        label: '입사일',
        getDate: () => hireD,
      })
    }
  }

  return selects
}

function toInputDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Component ──────────────────────────────────────────────

export function EffectiveDatePicker({
  value,
  onChange,
  quickSelects,
  allowFuture = false,
  employeeHireDate,
  label = '시점 조회',
  className,
}: EffectiveDatePickerProps) {
  const selects = quickSelects ?? buildDefaultQuickSelects(employeeHireDate)

  const isFuture = value > new Date()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value)
    if (!isNaN(d.getTime())) onChange(d)
  }

  return (
    <div className={cn('rounded-lg border border-border bg-background p-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-[#666] flex-shrink-0" />
        <span className="text-sm font-medium text-[#333]">{label}:</span>

        <Input
          type="date"
          value={toInputDateString(value)}
          onChange={handleInputChange}
          className="h-8 w-36 rounded-md border-border text-sm px-2"
        />

        <div className="flex flex-wrap gap-1">
          {selects.map((qs) => (
            <Button
              key={qs.label}
              variant="outline"
              size="sm"
              onClick={() => onChange(qs.getDate())}
              className="h-7 px-2.5 text-xs border-border hover:border-primary hover:text-primary"
            >
              {qs.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 미래 시점 허용 경고 */}
      {allowFuture && isFuture && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5">
          <span className="text-xs text-amber-700 font-medium">
            ⚠️ 미래 시점 조회 중 (HR Admin 전용)
          </span>
        </div>
      )}

      {/* 미래 시점 불허 경고 */}
      {!allowFuture && isFuture && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5">
          <span className="text-xs text-destructive font-medium">
            ❌ 미래 날짜는 선택할 수 없습니다.
          </span>
        </div>
      )}
    </div>
  )
}
