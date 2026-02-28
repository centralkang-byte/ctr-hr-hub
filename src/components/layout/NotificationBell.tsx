'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notification Bell (Header)
// Popover 드롭다운: 미읽음 뱃지 + 최근 20개 알림
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/date-utils'

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

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  // ─── Fetch unread count ───
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get<{ count: number }>(
        '/api/v1/notifications/unread-count',
      )
      setUnreadCount(res.data.count)
    } catch {
      // silent
    }
  }, [])

  // ─── Fetch recent notifications ───
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/notifications?page=1&limit=20')
      const json = await res.json()
      setNotifications(json.data ?? [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + poll unread count
  useEffect(() => {
    void fetchUnreadCount()
    const interval = setInterval(() => void fetchUnreadCount(), 60_000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Fetch notifications when popover opens
  useEffect(() => {
    if (open) void fetchNotifications()
  }, [open, fetchNotifications])

  // ─── Mark single as read ───
  const handleClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await apiClient.put(`/api/v1/notifications/${item.id}/read`)
        setUnreadCount((c) => Math.max(0, c - 1))
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        )
      } catch {
        // silent
      }
    }
    if (item.link) {
      setOpen(false)
      router.push(item.link)
    }
  }

  // ─── Mark all as read ───
  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await apiClient.put('/api/v1/notifications/read-all')
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {
      // silent
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="알림">
          <Bell className="h-5 w-5 text-ctr-gray-500" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold">알림</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              모두 읽기
            </Button>
          )}
        </div>
        <Separator />

        {/* ─── Notification list ─── */}
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              알림이 없습니다.
            </div>
          ) : (
            <div>
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => handleClick(item)}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {!item.isRead ? (
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    ) : (
                      <div className="h-2 w-2" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!item.isRead ? 'font-semibold' : 'font-normal text-slate-700'}`}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* ─── Footer ─── */}
        <Separator />
        <div className="p-2">
          <Link
            href="/notifications"
            className="block rounded-md px-3 py-2 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            전체 보기
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
