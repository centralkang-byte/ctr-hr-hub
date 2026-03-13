'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Adaptive Card HTML 근사 렌더러
// Adaptive Card JSON → HTML 미리보기
// ═══════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AdaptiveCardData {
  type: string
  body?: AdaptiveElement[]
  actions?: AdaptiveAction[]
}

interface AdaptiveElement {
  type: string
  text?: string
  weight?: string
  size?: string
  color?: string
  wrap?: boolean
  items?: AdaptiveElement[]
  facts?: { title: string; value: string }[]
  columns?: { items: AdaptiveElement[] }[]
  spacing?: string
  maxLines?: number
  style?: string
}

interface AdaptiveAction {
  type: string
  title: string
  url?: string
  style?: string
  data?: Record<string, unknown>
}

interface Props {
  card: AdaptiveCardData
  title?: string
}

function renderElement(el: AdaptiveElement, idx: number): React.ReactNode {
  switch (el.type) {
    case 'TextBlock': {
      const sizeClass =
        el.size === 'ExtraLarge'
          ? 'text-3xl font-bold'
          : el.size === 'Medium'
            ? 'text-base font-semibold'
            : el.size === 'Small'
              ? 'text-xs'
              : 'text-sm'
      const colorClass =
        el.color === 'Accent'
          ? 'text-[#4F46E5]'
          : el.color === 'Warning'
            ? 'text-[#D97706]'
            : ''
      const weightClass = el.weight === 'Bolder' ? 'font-bold' : ''
      return (
        <p key={idx} className={`${sizeClass} ${colorClass} ${weightClass}`}>
          {el.text}
        </p>
      )
    }

    case 'Container':
      return (
        <div key={idx} className="space-y-1">
          {el.items?.map((item, i) => renderElement(item, i))}
        </div>
      )

    case 'FactSet':
      return (
        <div key={idx} className="space-y-1 border-t border-[#F5F5F5] pt-2 mt-2">
          {el.facts?.map((f, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[#666]">{f.title}</span>
              <span className="font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      )

    case 'ColumnSet':
      return (
        <div key={idx} className="grid grid-cols-3 gap-2 border-t border-[#F5F5F5] pt-2 mt-2">
          {el.columns?.map((col, i) => (
            <div key={i} className="text-center">
              {col.items.map((item, j) => renderElement(item, j))}
            </div>
          ))}
        </div>
      )

    default:
      return null
  }
}

function renderAction(action: AdaptiveAction, idx: number): React.ReactNode {
  const variant =
    action.style === 'positive'
      ? 'default'
      : action.style === 'destructive'
        ? 'destructive'
        : 'outline'

  return (
    <Button key={idx} variant={variant} size="sm" className="text-xs" disabled>
      {action.title}
    </Button>
  )
}

export function AdaptiveCardPreview({ card, title }: Props) {
  return (
    <Card className="max-w-md">
      {title && (
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">{title}</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              미리보기
            </Badge>
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-2">
        {card.body?.map((el, i) => renderElement(el, i))}

        {card.actions && card.actions.length > 0 && (
          <div className="flex gap-2 border-t border-[#F5F5F5] pt-3 mt-3">
            {card.actions.map((action, i) => renderAction(action, i))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
