'use client'

import { useState, useCallback } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

// ─── ConfirmDialog Props ──────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void | Promise<void>
}

// ─── ConfirmDialog Component ──────────────────────────────

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [isExecuting, setIsExecuting] = useState(false)

  const handleConfirm = async () => {
    if (isExecuting) return
    setIsExecuting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExecuting}>
            {cancelLabel ?? '취소'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isExecuting}
            className={cn(
              variant === 'destructive' &&
                buttonVariants({ variant: 'destructive' }),
            )}
          >
            {isExecuting ? '처리 중...' : (confirmLabel ?? '확인')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── useConfirmDialog Hook ────────────────────────────────

interface ConfirmDialogState {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void | Promise<void>
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    onConfirm: () => {},
  })

  const confirm = useCallback(
    (opts: Omit<ConfirmDialogState, 'open'>) => {
      setState({ ...opts, open: true })
    },
    [],
  )

  const dialogProps: ConfirmDialogProps = {
    ...state,
    onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
  }

  return { confirm, dialogProps } as const
}
