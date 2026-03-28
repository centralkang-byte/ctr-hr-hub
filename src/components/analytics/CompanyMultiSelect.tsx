'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법인 멀티셀렉트 (Phase 2-B1)
// Popover + Checkbox 조합, 법인 비교용 필터
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { Building2, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  code: string
  name: string
}

interface Props {
  companies: CompanyOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function CompanyMultiSelect({ companies, selected, onChange, className }: Props) {
  const [open, setOpen] = useState(false)

  const allSelected = selected.length === companies.length
  const noneSelected = selected.length === 0

  const toggleAll = () => {
    onChange(allSelected ? [] : companies.map(c => c.id))
  }

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
    )
  }

  const label = noneSelected
    ? '전체 법인'
    : selected.length <= 2
      ? selected.map(id => companies.find(c => c.id === id)?.code).filter(Boolean).join(', ')
      : `${selected.length}개 법인`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg',
            'bg-card hover:bg-muted transition-colors min-w-[140px]',
            className,
          )}
        >
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {/* 전체 선택/해제 — div로 래핑 (Checkbox가 내부 button 렌더하므로 button 중첩 방지) */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggleAll}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAll() } }}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer"
        >
          <Checkbox checked={allSelected} />
          <span className="font-medium">{allSelected ? '전체 해제' : '전체 선택'}</span>
        </div>
        <div className="h-px bg-border my-1" />
        {/* 법인 목록 */}
        <div className="max-h-[280px] overflow-y-auto space-y-0.5">
          {companies.map(c => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => toggle(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(c.id) } }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              <Checkbox checked={selected.includes(c.id)} />
              <Badge variant="outline" className="text-xs font-mono">{c.code}</Badge>
              <span className="truncate text-muted-foreground">{c.name}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
