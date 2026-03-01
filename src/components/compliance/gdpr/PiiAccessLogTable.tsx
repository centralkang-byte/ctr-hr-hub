'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react'

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
  VIEW: 'bg-blue-50 text-blue-700 border border-blue-200',
  EXPORT: 'bg-amber-50 text-amber-700 border border-amber-200',
  EDIT: 'bg-orange-50 text-orange-700 border border-orange-200',
  DELETE: 'bg-red-50 text-red-700 border border-red-200',
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">{tc('filter')}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('gdpr.actor')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={tc('searchPlaceholder')}
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('gdpr.target')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={tc('searchPlaceholder')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{tc('startDate')}</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{tc('endDate')}</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleFilterApply}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
          >
            <Search className="w-3.5 h-3.5" />
            {tc('search')}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {tc('reset')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">{tc('loading')}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{tc('noData')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.actor')}</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.target')}</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.accessType')}</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.fieldName')}</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">IP</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">{log.actor_name}</div>
                        <div className="text-xs text-slate-400">{log.actor_role}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{log.target_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACCESS_TYPE_BADGE[log.access_type] ?? 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                          {log.access_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-mono text-xs">{log.field_name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono text-xs">{log.ip_address ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  {tc('total')}: {total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {tc('prev')}
                  </button>
                  <span className="px-3 py-1.5 text-xs text-slate-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
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
