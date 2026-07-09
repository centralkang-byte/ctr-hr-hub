'use client'

// ═══════════════════════════════════════════════════════════
// Settings Hub — 최근 변경 위젯 (감사 로그 미리보기)
// 프로토 page-settings.jsx "최근 변경" 섹션 adopt (Wave 1)
// 감사 기록이 있는 변경만 노출 — 전체 이력 아님 (커버리지 부분적)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronRight, FileClock, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// AuditLogTab.tsx와 동일 표기 컨벤션
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Types ──────────────────────────────────────────────────

interface RecentChangeEntry {
  id: string
  action: string
  resourceType: string
  companyId: string | null
  createdAt: string
  actor: { name: string } | null
  company: { name: string } | null
  changes: { description?: string; key?: string } | null
}

const ACTION_VARIANT: Record<string, BadgeVariant> = {
  SETTINGS_CREATE: 'success',
  SETTINGS_UPDATE: 'info',
  SETTINGS_REVERT: 'warning',
}

// ─── Component ──────────────────────────────────────────────

export function SettingsRecentChanges() {
  const router = useRouter()
  const t = useTranslations('settings')
  const [entries, setEntries] = useState<RecentChangeEntry[]>([])
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')

  useEffect(() => {
    apiClient
      .get('/api/v1/settings-audit-log?limit=5')
      .then((res) => {
        const data = (res as { data?: { logs?: RecentChangeEntry[] } })?.data
        setEntries(Array.isArray(data?.logs) ? data.logs : [])
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [])

  return (
    <section aria-labelledby="settings-recent-changes-title" className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 id="settings-recent-changes-title" className="text-[17px] font-semibold text-foreground">
            {t('recentChanges.title')}
          </h2>
          <span className="text-xs text-muted-foreground">{t('recentChanges.subtitle')}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/settings/system?tab=audit')}
          className="gap-1 text-xs text-muted-foreground"
        >
          {t('recentChanges.viewAll')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {state === 'loading' ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : state === 'error' ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t('recentChanges.loadFailed')}
          </p>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center">
            <FileClock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t('recentChanges.empty')}</p>
          </div>
        ) : (
          <div role="list" className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} role="listitem" className="flex items-center gap-3 px-4 py-3">
                <Badge variant={ACTION_VARIANT[entry.action] ?? 'neutral'}>
                  {entry.resourceType}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {entry.changes?.description ?? entry.changes?.key ?? entry.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <b>{entry.actor?.name ?? t('recentChanges.systemActor')}</b>
                    {' · '}
                    {entry.company?.name ?? t('recentChanges.globalScope')}
                    {' · '}
                    {formatWhen(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
