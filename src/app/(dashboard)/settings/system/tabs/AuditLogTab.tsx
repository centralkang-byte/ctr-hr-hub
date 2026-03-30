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

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  SETTINGS_CREATE: { label: '생성', color: 'text-emerald-600 bg-emerald-50' },
  SETTINGS_UPDATE: { label: '수정', color: 'text-primary bg-primary/5' },
  SETTINGS_REVERT: { label: '복원', color: 'text-amber-600 bg-amber-50' },
}

const CATEGORY_LABELS: Record<string, string> = {
  PAYROLL: '급여',
  ATTENDANCE: '근태',
  PERFORMANCE: '성과',
  SYSTEM: '시스템',
  ORGANIZATION: '조직',
  RECRUITMENT: '채용',
  EVALUATION: '평가',
  LEAVE: '휴가',
}

export function AuditLogTab({
  companyId: _companyId }: Props) {
//   const t = useTranslations('settings')
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
          <h3 className="text-base font-semibold text-foreground">{'설정 변경 이력'}</h3>
          <p className="text-sm text-muted-foreground">
            최근 설정 변경 기록 · 총 {total}건
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {'새로고침'}
        </Button>
      </div>

      {logs.length > 0 ? (
        <>
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr>
                  <th className={TABLE_STYLES.headerCell}>{'날짜'}</th>
                  <th className={TABLE_STYLES.headerCell}>{'카테고리'}</th>
                  <th className={TABLE_STYLES.headerCell}>{'설정항목'}</th>
                  <th className={TABLE_STYLES.headerCell}>{'법인'}</th>
                  <th className={TABLE_STYLES.headerCell}>{'액션'}</th>
                  <th className={TABLE_STYLES.headerCell}>{'변경'}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const changes = log.changes as AuditLogChanges | null
                  const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, color: 'text-muted-foreground bg-muted' }
                  const categoryLabel = CATEGORY_LABELS[changes?.category ?? ''] ?? changes?.category ?? '—'

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
                          {categoryLabel}
                        </span>
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        {changes?.key ?? '—'}
                      </td>
                      <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                        {log.company?.name ??
                          (changes?.companyId === 'global' || !changes?.companyId ? '글로벌' : changes.companyId)}
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
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
                {offset + 1}~{Math.min(offset + limit, total)} / {total}건
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="text-xs"
                >
                  {'이전'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                  className="text-xs"
                >
                  {'다음'}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <FileSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {'📋 설정 변경 기록이 없습니다'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {'설정을 변경하면 자동으로 기록됩니다.'}
          </p>
        </div>
      )}
    </div>
  )
}
