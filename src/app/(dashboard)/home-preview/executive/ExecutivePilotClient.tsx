'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ExecutivePilotClient
// R3 pilot: ExecutiveHomeV2 + 공용 PreviewToolbar.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import type { SessionUser } from '@/types'
import { ExecutiveHomeV2 } from '@/components/home/ExecutiveHomeV2'
import { PreviewToolbar } from '@/components/home/primitives/PreviewToolbar'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Component ──────────────────────────────────────────────

export function ExecutivePilotClient({ user }: Props) {
  const t = useTranslations('home.executive.v2.pilotBanner')

  return (
    <PreviewToolbar title={t('title')} subtitle={t('envLabel', { role: user.role })}>
      <ExecutiveHomeV2 user={user} />
    </PreviewToolbar>
  )
}
