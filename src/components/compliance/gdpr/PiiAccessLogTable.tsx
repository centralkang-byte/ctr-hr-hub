'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { BUTTON_VARIANTS } from '@/lib/styles'

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
  VIEW: 'bg-[#E8F5E9] text-[#00A844] border border-[#E8F5E9]',
  EXPORT: 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]',
  EDIT: 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]',
  DELETE: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]',
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
      <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-[#666]" />
          <span className="text-sm font-medium text-[#333]">{tc('filter')}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[#666] mb-1">{t('gdpr.actor')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
              placeholder={tc('searchPlaceholder')}
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1">{t('gdpr.target')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
              placeholder={tc('searchPlaceholder')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1">{tc('startDate')}</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1">{tc('endDate')}</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
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
            className="inline-flex items-center gap-1.5 bg-white border border-[#D4D4D4] hover:bg-[#FAFAFA] text-[#333] px-4 py-2 rounded-lg font-medium text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {tc('reset')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        {loading ? (
          <div className="p-8 text-center text-[#666]">{tc('loading')}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                    <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.actor')}</th>
                    <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.target')}</th>
                    <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.accessType')}</th>
                    <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.fieldName')}</th>
                    <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">IP</th>
                    <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-[#1A1A1A]">{log.actor_name}</div>
                        <div className="text-xs text-[#999]">{log.actor_role}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#333]">{log.target_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACCESS_TYPE_BADGE[log.access_type] ?? 'bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]'}`}>
                          {log.access_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#555] font-mono text-xs">{log.field_name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#666] font-mono text-xs">{log.ip_address ?? '-'}</td>
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
                <p className="text-xs text-[#666]">
                  {tc('total')}: {total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[#D4D4D4] text-[#555] hover:bg-[#FAFAFA] disabled:opacity-40"
                  >
                    {tc('prev')}
                  </button>
                  <span className="px-3 py-1.5 text-xs text-[#555]">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[#D4D4D4] text-[#555] hover:bg-[#FAFAFA] disabled:opacity-40"
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
