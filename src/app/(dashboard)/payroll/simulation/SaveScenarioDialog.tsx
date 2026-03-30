'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 시나리오 저장 다이얼로그
// 시뮬레이션 결과를 이름 붙여 저장
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (title: string, description: string) => Promise<void>
  isLoading: boolean
}

// ─── Component ──────────────────────────────────────────────

export default function SaveScenarioDialog({ open, onOpenChange, onSave, isLoading }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleSave = async () => {
    if (!title.trim()) return
    await onSave(title.trim(), description.trim())
    setTitle('')
    setDescription('')
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) { setTitle(''); setDescription('') }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1C1D21]">
            <Save className="w-4 h-4 text-[#5E81F4]" />
            {t('simScenarioSaveTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-medium text-[#8181A5] mb-1">
              {t('simScenarioName')} <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('simScenarioNamePlaceholder')}
              maxLength={100}
              className={cn(
                'w-full px-3 py-2 text-sm border border-[#F0F0F3] rounded-lg',
                'focus:outline-none focus:ring-1 focus:ring-[#5E81F4] bg-white text-[#1C1D21]',
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8181A5] mb-1">{t('simScenarioDescLabel')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('simScenarioDescPlaceholder')}
              maxLength={500}
              rows={2}
              className={cn(
                'w-full px-3 py-2 text-sm border border-[#F0F0F3] rounded-lg resize-none',
                'focus:outline-none focus:ring-1 focus:ring-[#5E81F4] bg-white text-[#1C1D21]',
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => handleOpenChange(false)}
            className="px-4 py-2 text-sm text-[#8181A5] hover:text-[#1C1D21]"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || isLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
              'bg-[#5E81F4] text-white hover:bg-[#4A6DE0] disabled:opacity-50',
            )}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {tCommon('save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
