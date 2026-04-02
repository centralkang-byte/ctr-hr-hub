'use client'

// ═══════════════════════════════════════════════════════════
// Tab: Audit Log — 설정 변경 이력 (H-3 Rewrite)
// API: GET /api/v1/settings-audit-log
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react'
import { Loader2, FileSearch, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface AuditLogChanges {
  category?: string
  key?: string
  companyId?: string
  description?: string
  oldValue?: unknown
  newValue?: unknown
}

interface AuditLogEntry {
  id: string
  action: string
  resourceType: string
  resourceId: string
  companyId: string | null
  changes: AuditLogChanges | null
  createdAt: string
  actor?: { id: string; name: string; employeeNo: string }
  company?: { id: string; name: string; code: string }
}

interface Props {
  companyId: string | null
}

const ACTION_LABEL_KEYS: Record<string, { labelKey: string; color: string }> = {
  SETTINGS_CREATE: { labelKey: 'auditLog.actionCreate', color: 'text-emerald-600 bg-emerald-500/10' },
  SETTINGS_UPDATE: { labelKey: 'auditLog.actionUpdate', color: 'text-primary bg-primary/5' },
  SETTINGS_REVERT: { labelKey: 'auditLog.actionRevert', color: 'text-amber-600 bg-amber-500/10' },
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  PAYROLL: 'auditLog.categories.PAYROLL',
  ATTENDANCE: 'auditLog.categories.ATTENDANCE',
  PERFORMANCE: 'auditLog.categories.PERFORMANCE',
  SYSTEM: 'auditLog.categories.SYSTEM',
  ORGANIZATION: 'auditLog.categories.ORGANIZATION',
  RECRUITMENT: 'auditLog.categories.RECRUITMENT',
  EVALUATION: 'auditLog.categories.EVALUATION',
  LEAVE: 'auditLog.categories.LEAVE',
}

export function AuditLogTab({
  companyId: _companyId }: Props) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 30

  const fetchLogs = useCallback(() => {
    setLoading(true)
    apiClient.get(`/api/v1/settings-audit-log?limit=${limit}&offset=${offset}`)
      .then((res) => {
        const data = (res as { data?: { logs?: AuditLogEntry[]; total?: number } })?.data
        setLogs(Array.isArray(data?.logs) ? data.logs : [])
        setTotal(data?.total ?? 0)
      })
      .catch(() => { setLogs([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [offset])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('auditLog.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('auditLog.description', { total })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {tc('refresh')}
        </Button>
      </div>

      {logs.length > 0 ? (
        <>
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr>
                  <th className={TABLE_STYLES.headerCell}>{t('auditLog.colDate')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('auditLog.colCategory')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('auditLog.colSettingKey')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('auditLog.colCompany')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('auditLog.colAction')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('auditLog.colChanges')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const changes = log.changes as AuditLogChanges | null
                  const actionInfo = ACTION_LABEL_KEYS[log.action] ?? { labelKey: log.action, color: 'text-muted-foreground bg-muted' }
                  const categoryKey = CATEGORY_LABEL_KEYS[changes?.category ?? '']

                  return (
                    <tr key={log.id} className={TABLE_STYLES.row}>
                      <td className={`${TABLE_STYLES.cell} text-muted-foreground whitespace-nowrap`}>
                        {new Date(log.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                          {categoryKey ? t(categoryKey) : changes?.category ?? '—'}
                        </span>
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        {changes?.key ?? '—'}
                      </td>
                      <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                        {log.company?.name ??
                          (changes?.companyId === 'global' || !changes?.companyId ? tc('global') : changes.companyId)}
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${actionInfo.color}`}>
                          {t(actionInfo.labelKey)}
                        </span>
                      </td>
                      <td className={`${TABLE_STYLES.cell} text-muted-foreground max-w-[280px] truncate`} title={changes?.description ?? ''}>
                        {changes?.description ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {t('auditLog.rangeInfo', { start: offset + 1, end: Math.min(offset + limit, total), total })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="text-xs"
                >
                  {tc('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                  className="text-xs"
                >
                  {tc('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <FileSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {t('auditLog.emptyTitle')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('auditLog.emptyDesc')}
          </p>
        </div>
      )}
    </div>
  )
}
