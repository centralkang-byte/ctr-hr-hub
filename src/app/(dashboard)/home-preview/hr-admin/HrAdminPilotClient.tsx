'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HrAdminPilotClient
// R3 pilot: HrAdminHomeV2 + 공용 PreviewToolbar.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import type { SessionUser } from '@/types'
import { HrAdminHomeV2 } from '@/components/home/HrAdminHomeV2'
import { PreviewToolbar } from '@/components/home/primitives/PreviewToolbar'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Component ──────────────────────────────────────────────

export function HrAdminPilotClient({ user }: Props) {
  const t = useTranslations('home.hrAdmin.v2.pilotBanner')

  return (
    <PreviewToolbar title={t('title')} subtitle={t('envLabel', { role: user.role })}>
      <HrAdminHomeV2 user={user} />
    </PreviewToolbar>
  )
}
