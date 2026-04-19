'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ManagerPilotClient
// R2 pilot: ManagerHomeV2 + 공용 PreviewToolbar.
// Session 178 (R3): 툴바 ~60줄이 PreviewToolbar primitive로 이관됨.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import type { SessionUser } from '@/types'
import { ManagerHomeV2 } from '@/components/home/ManagerHomeV2'
import { PreviewToolbar } from '@/components/home/primitives/PreviewToolbar'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Component ──────────────────────────────────────────────

export function ManagerPilotClient({ user }: Props) {
  const t = useTranslations('home.manager.v2.pilotBanner')

  return (
    <PreviewToolbar title={t('title')} subtitle={t('envLabel', { role: user.role })}>
      <ManagerHomeV2 user={user} />
    </PreviewToolbar>
  )
}
