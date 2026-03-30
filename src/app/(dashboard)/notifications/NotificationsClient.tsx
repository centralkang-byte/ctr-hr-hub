'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notifications Page Client
// 전체 알림 목록 (필터 탭 + 페이지네이션 + 읽음/미읽음)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCheck, Loader2, Bell } from 'lucide-react'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/date-utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface NotificationItem {
  id: string
  triggerType: string
  title: string
  body: string
  isRead: boolean
  link: string | null
  createdAt: string
}

// ─── Component ──────────────────────────────────────────────

export function NotificationsClient({ user }: { user: SessionUser }) {
  const t = useTranslations('notification')
  const tc = useTranslations('common')

  // ─── Filter tabs ────────────────────────────────────────────
  const TRIGGER_TABS = [
    { label: '전체', value: '' },
    { label: '승인', value: 'approval' },
    { label: '성과', value: 'performance' },
    { label: '근태', value: 'attendance' },
    { label: '채용', value: 'recruitment' },
    { label: '시스템', value: 'system' },
  ] as const

  const READ_FILTERS = [
    { label: '전체', value: '' },
    { label: '미읽음', value: 'false' },
    { label: '읽음', value: 'true' },
  ] as const

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('')
  const [readFilter, setReadFilter] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  // ─── Fetch ───
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedTab) params.triggerType = selectedTab
      if (readFilter) params.isRead = readFilter

      const res = await fetch(
        `/api/v1/notifications?${new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString()}`,
      )
      const json = await res.json()
      setNotifications(json.data ?? [])
      setPagination(json.pagination)
    } catch {
      setNotifications([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page, selectedTab, readFilter])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [selectedTab, readFilter])

  // ─── Mark single as read ───
  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.put(`/api/v1/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
    } catch {
      toast({ title: tc('error'), description: '읽음 처리에 실패했습니다', variant: 'destructive' })
    }
  }

  // ─── Mark all as read ───
  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await apiClient.put('/api/v1/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      toast({ title: '모든 알림을 읽음 처리했습니다' })
    } catch {
      toast({ title: tc('error'), description: '모두 읽음 처리에 실패했습니다', variant: 'destructive' })
    } finally {
      setMarkingAll(false)
    }
  }

  // ─── Pagination ───
  const totalPages = pagination?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <PageHeader
        title={'제목'}
        description={'설명'}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            {'전체 읽기'}
          </Button>
        }
      />

      {/* ─── Filter Tabs ─── */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Trigger type tabs */}
        <div className="flex border-b border-border">
          {TRIGGER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                selectedTab === tab.value
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-[#666] hover:text-[#333]'
              }`}
              onClick={() => setSelectedTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Read status filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {READ_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                readFilter === f.value
                  ? 'bg-primary text-white'
                  : 'text-[#555] hover:bg-muted'
              }`}
              onClick={() => setReadFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Notification List ─── */}
      <div className="rounded-xl border border-border bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={'알림이 없습니다.'}
            description={'알림이 발생하면 여기에 표시됩니다.'}
          />
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-5 py-4 hover:bg-background transition-colors"
              >
                {/* Unread dot */}
                <div className="mt-1.5 shrink-0">
                  {!item.isRead ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  ) : (
                    <div className="h-2.5 w-2.5" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p
                        className={`text-sm ${
                          !item.isRead ? 'font-semibold text-foreground' : 'text-[#333]'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-[#666]">
                        {item.body}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[#999]">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-[#555]">
                      {item.triggerType}
                    </span>
                    {!item.isRead && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:text-primary/90"
                        onClick={() => handleMarkRead(item.id)}
                      >
                        {'읽음 처리'}
                      </button>
                    )}
                    {item.link && (
                      <a
                        href={item.link}
                        className="text-xs text-primary hover:text-primary/90"
                      >
                        {'바로가기'}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {tc('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {tc('next')}
          </Button>
        </div>
      )}
    </div>
  )
}
