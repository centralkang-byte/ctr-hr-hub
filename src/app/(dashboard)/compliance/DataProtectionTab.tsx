'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Protection Tab
// GdprClient 전면 위임 (controlled mode) — Hub의 URL section param을
// GdprClient의 activeTab과 양방향 동기화
// ═══════════════════════════════════════════════════════════

import type { SessionUser } from '@/types'

import GdprClient from './gdpr/GdprClient'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
  /** Hub에서 전달: 현재 URL의 section 파라미터 (정규화 전) */
  activeSection?: string
  /** Hub에서 전달: section 변경 시 호출되는 URL 업데이트 콜백 */
  onSectionChange?: (section: string) => void
}

// ─── Helpers ────────────────────────────────────────────────

// 레거시 section 키 → GdprClient 내부 TabKey 정규화
function normalizeSection(section?: string): string | undefined {
  if (!section) return undefined
  const map: Record<string, string> = {
    'gdpr': 'consents',          // GDPR 루트 → 기본 consents
    'data-retention': 'retention',
    'retention': 'retention',
    'dpia': 'dpia',
    'consents': 'consents',
    'requests': 'requests',
  }
  return map[section]
}

// ─── Component ──────────────────────────────────────────────

export default function DataProtectionTab({
  user,
  activeSection,
  onSectionChange,
}: Props) {
  return (
    <GdprClient
      user={user}
      activeTab={normalizeSection(activeSection) ?? 'consents'}
      onTabChange={onSectionChange}
    />
  )
}
