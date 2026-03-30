'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'

interface PiiAccessLog {
  id: string
  actor_name: string
  actor_role: string
  target_name: string
  access_type: string
  field_name: string
  ip_address: string
  created_at: string
}

const ACCESS_TYPE_BADGE: Record<string, string> = {
  VIEW: 'bg-primary/10 text-primary/90 border border-primary/20',
  EXPORT: 'bg-amber-100 text-amber-700 border border-amber-300',
  EDIT: 'bg-orange-50 text-orange-700 border border-orange-200',
  DELETE: 'bg-red-100 text-red-700 border border-red-200',
}

export default function PiiAccessLogTable() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [logs, setLogs] = useState<PiiAccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filters
  const [actor, setActor] = useState('')
  const [target, setTarget] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const fetchLogs = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(actor ? { actor } : {}),
      ...(target ? { target } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    })
    fetch(`/api/v1/compliance/gdpr/pii-access?${params}`)
      .then((res) => res.json())
      .then((json) => {
        setLogs(json.data ?? [])
        setTotal(json.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page, actor, target, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleFilterApply = () => {
    setPage(1)
    fetchLogs()
  }

  const handleReset = () => {
    setActor('')
    setTarget('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-[#666]" />
          <span className="text-sm font-medium text-[#333]">{tc('filter')}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[#666] mb-1">{t('gdpr.actor')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              placeholder={tc('searchPlaceholder')}
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1">{t('gdpr.target')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              placeholder={tc('searchPlaceholder')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1">{tc('startDate')}</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1">{tc('endDate')}</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleFilterApply}
            className={`inline-flex items-center gap-1.5 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
          >
            <Search className="w-3.5 h-3.5" />
            {tc('search')}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 bg-white border border-border hover:bg-background text-[#333] px-4 py-2 rounded-lg font-medium text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {tc('reset')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        {loading ? (
          <div className="p-8 text-center text-[#666]">{tc('loading')}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{t('gdpr.actor')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('gdpr.target')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('gdpr.accessType')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('gdpr.fieldName')}</th>
                    <th className={TABLE_STYLES.headerCell}>IP</th>
                    <th className={TABLE_STYLES.headerCell}>{tc('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className={TABLE_STYLES.row}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-foreground">{log.actor_name}</div>
                        <div className="text-xs text-[#999]">{log.actor_role}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#333]">{log.target_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACCESS_TYPE_BADGE[log.access_type] ?? 'bg-background text-[#555] border border-border'}`}>
                          {log.access_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#555] font-mono tabular-nums text-xs">{log.field_name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#666] font-mono tabular-nums text-xs">{log.ip_address ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#555]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-[#666]">
                  {tc('total')}: {total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border text-[#555] hover:bg-background disabled:opacity-40"
                  >
                    {tc('prev')}
                  </button>
                  <span className="px-3 py-1.5 text-xs text-[#555]">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border text-[#555] hover:bg-background disabled:opacity-40"
                  >
                    {tc('next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
