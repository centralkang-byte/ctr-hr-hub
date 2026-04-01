'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X, CheckCircle2, Circle } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface ActionItem {
  description: string
  dueDate?: string | null
  assignee?: 'EMPLOYEE' | 'MANAGER'
  completed?: boolean
}

type Mode = 'edit' | 'interactive' | 'readonly'

interface Props {
  items: ActionItem[]
  mode: Mode
  onChange: (items: ActionItem[]) => void
}

// ─── Component ──────────────────────────────────────────────

export default function ActionItemsEditor({ items, mode, onChange }: Props) {
  const t = useTranslations('performance.quarterlyReview.actionItem')

  const updateItem = (index: number, field: keyof ActionItem, value: string | boolean) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const addItem = () => {
    if (items.length >= 20) return
    onChange([...items, { description: '', assignee: 'EMPLOYEE', completed: false }])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const toggleComplete = (index: number) => {
    updateItem(index, 'completed', !items[index].completed)
  }

  if (items.length === 0 && mode === 'readonly') {
    return null
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-2 group',
            item.completed && 'opacity-60',
          )}
        >
          {/* Checkbox — available in edit and interactive modes */}
          {mode !== 'readonly' && (
            <button
              type="button"
              onClick={() => toggleComplete(index)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Description */}
          {mode === 'edit' ? (
            <Input
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className={cn('flex-1 h-8 text-sm', item.completed && 'line-through')}
            />
          ) : (
            <span className={cn('flex-1 text-sm', item.completed && 'line-through')}>
              {item.description}
            </span>
          )}

          {/* Due date */}
          {mode === 'edit' ? (
            <Input
              type="date"
              value={item.dueDate ?? ''}
              onChange={(e) => updateItem(index, 'dueDate', e.target.value)}
              className="w-32 h-8 text-xs"
            />
          ) : item.dueDate ? (
            <span className="text-xs text-muted-foreground tabular-nums font-mono shrink-0">
              {item.dueDate}
            </span>
          ) : null}

          {/* Assignee toggle */}
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() =>
                updateItem(index, 'assignee', item.assignee === 'EMPLOYEE' ? 'MANAGER' : 'EMPLOYEE')
              }
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium shrink-0 transition-colors',
                item.assignee === 'EMPLOYEE'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-amber-500/15 text-amber-700',
              )}
            >
              {t(item.assignee === 'EMPLOYEE' ? 'employee' : 'manager')}
            </button>
          )}
          {mode !== 'edit' && item.assignee && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                item.assignee === 'EMPLOYEE'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-amber-500/15 text-amber-700',
              )}
            >
              {t(item.assignee === 'EMPLOYEE' ? 'employee' : 'manager')}
            </span>
          )}

          {/* Remove button — edit mode only */}
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {/* Add button — edit mode only */}
      {mode === 'edit' && items.length < 20 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addItem}
          className="text-muted-foreground"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('addItem')}
        </Button>
      )}
    </div>
  )
}
