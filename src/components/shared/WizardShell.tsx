'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  stepIndicatorState,
  nextButtonRole,
  isPrimaryDisabled,
  progressText,
} from './WizardShell.helpers'

export type { StepIndicatorState } from './WizardShell.helpers'
export {
  stepIndicatorState,
  nextButtonRole,
  isPrimaryDisabled,
  progressText,
} from './WizardShell.helpers'

// ─── Types ──────────────────────────────────────────────────

export interface WizardStep {
  key: string
  label: string
}

export interface WizardShellProps {
  title: string
  sub?: string
  steps: WizardStep[]
  currentStep: number
  open: boolean
  onCancel: () => void
  onPrev?: () => void
  onNext?: () => void
  onSubmit?: () => void
  canProceed?: boolean
  footer?: ReactNode
  children: ReactNode
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function WizardShell({
  title,
  sub,
  steps,
  currentStep,
  open,
  onCancel,
  onPrev,
  onNext,
  onSubmit,
  canProceed,
  footer,
  children,
  className,
}: WizardShellProps) {
  const t = useTranslations('wizard')
  const role = nextButtonRole(currentStep, steps.length)
  const primaryDisabled = isPrimaryDisabled(canProceed)
  const prevDisabled = currentStep === 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className={cn('sm:max-w-2xl', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {sub && <DialogDescription>{sub}</DialogDescription>}
        </DialogHeader>

        <ol className="flex flex-wrap items-center gap-2">
          {steps.map((step, idx) => {
            const state = stepIndicatorState(idx, currentStep)
            return (
              <li
                key={step.key}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={`${idx + 1}. ${step.label}`}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                    state === 'done' && 'border-ctr-success bg-ctr-success-bg text-ctr-success',
                    state === 'current' && 'border-primary bg-primary text-primary-foreground',
                    state === 'upcoming' && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {state === 'done' ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className={cn('text-sm', state === 'upcoming' && 'text-muted-foreground')}>
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {progressText(currentStep, steps.length)} {t('stepLabel')}
        </p>

        <div className="min-h-[8rem]">{children}</div>

        {footer ?? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onPrev}
              disabled={prevDisabled || !onPrev}
            >
              {t('prev')}
            </Button>
            <Button
              type="button"
              onClick={role === 'submit' ? onSubmit : onNext}
              disabled={primaryDisabled || (role === 'submit' ? !onSubmit : !onNext)}
            >
              {role === 'submit' ? t('submit') : t('next')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
