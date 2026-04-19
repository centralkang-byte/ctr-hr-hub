'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmployeePilotClient
// R3 pilot: EmployeeHomeV2 + 공용 PreviewToolbar.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import type { SessionUser } from '@/types'
import { EmployeeHomeV2 } from '@/components/home/EmployeeHomeV2'
import { PreviewToolbar } from '@/components/home/primitives/PreviewToolbar'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Component ──────────────────────────────────────────────

export function EmployeePilotClient({ user }: Props) {
  const t = useTranslations('home.employee.v2.pilotBanner')

  return (
    <PreviewToolbar title={t('title')} subtitle={t('envLabel', { role: user.role })}>
      <EmployeeHomeV2 user={user} />
    </PreviewToolbar>
  )
}
