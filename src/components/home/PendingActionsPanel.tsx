'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays,
  UserCog,
  ClipboardCheck,
  FileCheck,
  DollarSign,
  AlertTriangle,
  MessageSquare,
  Target,
  Shield,
  Bot,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────

type PendingPriority = 'URGENT' | 'HIGH' | 'NORMAL'

interface PendingAction {
  id: string
  type: string
  title: string
  description: string
  priority: PendingPriority
  dueDate: string | null
  sourceId: string
  link: string
  actionable: boolean
}

interface PendingActionsPanelProps {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────

const PRIORITY_STYLES: Record<PendingPriority, string> = {
  URGENT: 'bg-red-50 border-l-4 border-red-500',
  HIGH: 'bg-amber-50 border-l-4 border-amber-500',
  NORMAL: 'bg-white border-l-4 border-slate-200',
}

const PRIORITY_BADGE: Record<PendingPriority, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-amber-100 text-amber-700 border-amber-200',
  NORMAL: 'bg-slate-100 text-slate-600 border-slate-200',
}

const TYPE_ICONS: Record<string, typeof CalendarDays> = {
  LEAVE_APPROVAL: CalendarDays,
  PROFILE_CHANGE_APPROVAL: UserCog,
  ONBOARDING_TASK: ClipboardCheck,
  EVAL_SUBMIT: FileCheck,
  EVAL_REVIEW: FileCheck,
  PAYROLL_REVIEW: DollarSign,
  APPLICATION_REVIEW: ClipboardCheck,
  CONTRACT_EXPIRY: AlertTriangle,
  WORK_PERMIT_EXPIRY: Shield,
  ONE_ON_ONE_SCHEDULED: MessageSquare,
  MBO_GOAL_DRAFT: Target,
  MBO_GOAL_APPROVAL: Target,
  CHATBOT_ESCALATION: Bot,
}

// ─── Component ──────────────────────────────────────────

export function PendingActionsPanel({ user }: PendingActionsPanelProps) {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchActions = useCallback(async () => {
    try {
      const res = await apiClient.get<PendingAction[]>(
        '/api/v1/home/pending-actions?limit=15',
      )
      setActions(res.data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  const handleLeaveAction = async (
    sourceId: string,
    action: 'approve' | 'reject',
  ) => {
    setProcessingId(sourceId)
    try {
      await apiClient.put(`/api/v1/leave/requests/${sourceId}/${action}`, {})
      await fetchActions()
    } catch {
      // silently fail
    } finally {
      setProcessingId(null)
    }
  }

  const getDday = (dueDate: string | null): string | null => {
    if (!dueDate) return null
    const diff = Math.ceil(
      (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    if (diff < 0) return `D+${Math.abs(diff)}`
    if (diff === 0) return 'D-Day'
    return `D-${diff}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-ctr-primary" />
        </CardContent>
      </Card>
    )
  }

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-ctr-gray-700">
            <ClipboardCheck className="mr-2 inline-block h-4 w-4" />
            할 일
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm text-ctr-gray-500">
              처리할 항목이 없습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-ctr-gray-700">
          <span>
            <ClipboardCheck className="mr-2 inline-block h-4 w-4" />
            할 일
          </span>
          <Badge variant="secondary" className="text-xs">
            {actions.length}건
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => {
          const Icon = TYPE_ICONS[action.type] ?? ClipboardCheck
          const dday = getDday(action.dueDate)
          const isLeave = action.type === 'LEAVE_APPROVAL' && action.sourceId !== 'all'

          return (
            <div
              key={action.id}
              className={`flex items-center justify-between rounded-lg p-3 ${PRIORITY_STYLES[action.priority]}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="h-4 w-4 shrink-0 text-ctr-gray-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ctr-gray-700">
                    {action.title}
                  </p>
                  <p className="truncate text-xs text-ctr-gray-500">
                    {action.description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {dday && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${PRIORITY_BADGE[action.priority]}`}
                  >
                    {dday}
                  </Badge>
                )}
                {isLeave && user.role !== 'EMPLOYEE' ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                      disabled={processingId === action.sourceId}
                      onClick={() =>
                        handleLeaveAction(action.sourceId, 'approve')
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                      disabled={processingId === action.sourceId}
                      onClick={() =>
                        handleLeaveAction(action.sourceId, 'reject')
                      }
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : action.actionable ? (
                  <a href={action.link}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <ExternalLink className="h-4 w-4 text-ctr-gray-400" />
                    </Button>
                  </a>
                ) : null}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
