'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AiGeneratedBadge
// AI 생성 콘텐츠 표시 뱃지 + 툴팁
// ═══════════════════════════════════════════════════════════

import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AiGeneratedBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="cursor-default gap-1 text-xs font-normal"
          >
            <Sparkles className="h-3 w-3" />
            AI 생성
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>AI가 생성한 내용입니다</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
