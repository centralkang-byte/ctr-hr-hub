'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Plus, Calendar, AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { CARD_STYLES, BUTTON_VARIANTS, MODAL_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { EmployeeCell } from '@/components/common/EmployeeCell'


// ─── Types ───────────────────────────────────────────────

interface TeamMember {
  id: string
  name: string
  employeeNo: string
  department?: { name: string }
}

interface Meeting {
  id: string
  employeeId: string
  managerId: string
  scheduledAt: string
  completedAt: string | null
  status: string
  meetingType: string
  agenda: string | null
  notes: string | null
  actionItems: ActionItem[] | null
  employee: { id: string; name: string; employeeNo: string; department?: { name: string } }
  manager: { id: string; name: string }
}

interface ActionItem {
  item: string
  assignee: 'MANAGER' | 'EMPLOYEE'
  dueDate?: string
  completed: boolean
}

interface DashboardData {
  teamMembers: {
    employeeId: string
    name: string
    monthlyCounts: Record<string, number>
    lastOneOnOneDate: string | null
    overdue: boolean
  }[]
  pendingActionItems: { employeeName: string; item: string; dueDate: string }[]
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  REGULAR: '정기',
  AD_HOC: '수시',
  GOAL_REVIEW: '목표 점검',
  DEVELOPMENT: '역량 개발',
}

// ─── Component ───────────────────────────────────────────

export default function OneOnOneClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  const router = useRouter()
  const isManager = user.role === ROLE.MANAGER || user.role === ROLE.HR_ADMIN || user.role === ROLE.EXECUTIVE

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Create form state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [newMeeting, setNewMeeting] = useState({ employeeId: '', scheduledAt: '', meetingType: 'REGULAR', agenda: '' })
  const [creating, setCreating] = useState(false)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<Meeting>('/api/v1/cfr/one-on-ones', { status: statusFilter })
      setMeetings(res.data)
    } catch (err) { toast({ title: '미팅 목록 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setLoading(false)
  }, [statusFilter])

  const fetchDashboard = useCallback(async () => {
    if (!isManager) return
    try {
      const res = await apiClient.get<DashboardData>('/api/v1/cfr/one-on-ones/dashboard')
      setDashboard(res.data)
    } catch (err) { toast({ title: '대시보드 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
  }, [isManager])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])
  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const openCreateModal = async () => {
    try {
      const res = await apiClient.getList<TeamMember>('/api/v1/employees', { managerId: user.employeeId, status: 'ACTIVE', limit: 100 })
      setTeamMembers(res.data)
    } catch (err) { toast({ title: '팀원 목록 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    if (!newMeeting.employeeId || !newMeeting.scheduledAt) return
    setCreating(true)
    try {
      await apiClient.post('/api/v1/cfr/one-on-ones', {
        employeeId: newMeeting.employeeId,
        scheduledAt: new Date(newMeeting.scheduledAt).toISOString(),
        meetingType: newMeeting.meetingType,
        agenda: newMeeting.agenda || undefined,
      })
      setShowCreateModal(false)
      setNewMeeting({ employeeId: '', scheduledAt: '', meetingType: 'REGULAR', agenda: '' })
      fetchMeetings()
    } catch (err) { toast({ title: '미팅 생성 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setCreating(false)
  }

  const scheduled = meetings.filter((m) => m.status === 'SCHEDULED')
  const completed = meetings.filter((m) => m.status === 'COMPLETED')

  // Build chart data from dashboard
  const chartData = dashboard?.teamMembers?.[0]?.monthlyCounts
    ? Object.keys(dashboard.teamMembers[0].monthlyCounts).sort().map((month) => {
        const entry: Record<string, string | number> = { month: month.slice(5) }
        for (const member of dashboard.teamMembers) {
          entry[member.name] = member.monthlyCounts[month] ?? 0
        }
        return entry
      })
    : []

  const chartColors = ['#5E81F4', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {isManager ? '1:1 미팅' : '내 1:1 미팅'}
          </h1>
        </div>
        {isManager && (
          <button
            onClick={openCreateModal}
            className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
          >
            <Plus className="w-4 h-4" /> {t('kr_kec8388_1_1_kec9888ec')}
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex border-b border-border">
        {['ALL', 'SCHEDULED', 'COMPLETED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              statusFilter === s
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'ALL' ? '전체' : s === 'SCHEDULED' ? '예정' : '완료'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{tCommon('loading')}</div>
      ) : (
        <div className="space-y-6">
          {/* Scheduled Meetings */}
          {(statusFilter === 'ALL' || statusFilter === 'SCHEDULED') && scheduled.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> {t('kr_kec9888ec_1_1')}
              </h2>
              <div className="space-y-3">
                {scheduled.map((m) => (
                  <div key={m.id} className={CARD_STYLES.padded}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <EmployeeCell
                          size="sm"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          employee={isManager ? (m.employee as any) : { id: m.id, name: m.manager?.name ?? '', } }
                          trailing={
                            <p className="text-xs text-muted-foreground">
                              {new Date(m.scheduledAt).toLocaleDateString('ko-KR')} {new Date(m.scheduledAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              {' · '}
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary/90">
                                {MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}
                              </span>
                            </p>
                          }
                        />
                      </div>
                      {isManager && (
                        <button
                          onClick={() => router.push(`/performance/one-on-one/${m.id}`)}
                          className="text-sm font-medium text-primary hover:text-primary/90"
                        >
                          {t('kr_keab8b0eb')}
                        </button>
                      )}
                    </div>
                    {m.agenda && (
                      <p className="mt-2 text-sm text-muted-foreground pl-[52px]">아젠다: {m.agenda}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Meetings */}
          {(statusFilter === 'ALL' || statusFilter === 'COMPLETED') && completed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {t('complete_keb909c_1_1')}
              </h2>
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>
                        {isManager ? '팀원' : '매니저'}
                      </th>
                      <th className={TABLE_STYLES.headerCell}>{t('kr_kec9dbcec')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('kr_kec9ca0ed')}</th>
                      {isManager && (
                        <th className={TABLE_STYLES.headerCell}>{t('kr_kec95a1ec_kebafb8ec')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {completed.map((m) => {
                      const pendingActions = (m.actionItems ?? []).filter((a) => !a.completed).length
                      return (
                        <tr
                          key={m.id}
                          className={cn(TABLE_STYLES.row, "cursor-pointer")}
                          onClick={() => router.push(`/performance/one-on-one/${m.id}`)}
                        >
                          <td className={cn(TABLE_STYLES.cell)}>
                            {isManager ? m.employee.name : m.manager.name}
                          </td>
                          <td className={cn(TABLE_STYLES.cellMuted)}>
                            {new Date(m.completedAt ?? m.scheduledAt).toLocaleDateString('ko-KR')}
                          </td>
                          <td className={TABLE_STYLES.cell}>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-background text-muted-foreground border border-border">
                              {MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}
                            </span>
                          </td>
                          {isManager && (
                            <td className={TABLE_STYLES.cell}>
                              {pendingActions > 0 ? (
                                <span className="text-red-500 font-medium">{pendingActions}건</span>
                              ) : (
                                <span className="text-emerald-600">{t('kr_0keab1b4')}</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {meetings.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-border" />
              <EmptyState />
            </div>
          )}

          {/* Manager Dashboard */}
          {isManager && dashboard && (
            <>
              {/* Frequency Chart */}
              {chartData.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-violet-500" /> {t('kr_1_1_kebb988eb_keb8c80ec')}
                  </h2>
                  <div className={CARD_STYLES.padded}>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#666' }} allowDecimals={false} />
                          <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                          {dashboard.teamMembers.map((member, i) => (
                            <Bar key={member.employeeId} dataKey={member.name} fill={chartColors[i % chartColors.length]} radius={[4, 4, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Overdue warning */}
                    {dashboard.teamMembers.filter((m) => m.overdue).length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-red-500">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          30일+ 미실시:{' '}
                          {dashboard.teamMembers.filter((m) => m.overdue).map((m) => m.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pending Action Items */}
              {dashboard.pendingActionItems.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" /> {t('kr_kebafb8ec_kec95a1ec_kec9584ec')}
                  </h2>
                  <div className={`${CARD_STYLES.kpi} space-y-2`}>
                    {dashboard.pendingActionItems.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="w-4 h-4 rounded border border-border" />
                        <span className="text-sm text-foreground font-medium">{a.employeeName}:</span>
                        <span className="text-sm text-muted-foreground">&quot;{a.item}&quot;</span>
                        {a.dueDate && (
                          <span className="text-xs text-muted-foreground ml-auto">(기한: {a.dueDate})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">{t('kr_kec8388_1_1_kec9888ec')}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_ked8c80ec')}</label>
                <select
                  value={newMeeting.employeeId}
                  onChange={(e) => setNewMeeting({ ...newMeeting, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">{t('kr_kec84a0ed')}</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.employeeNo})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_kec9dbcec')}</label>
                <input
                  type="datetime-local"
                  value={newMeeting.scheduledAt}
                  onChange={(e) => setNewMeeting({ ...newMeeting, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_kec9ca0ed')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNewMeeting({ ...newMeeting, meetingType: key })}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        newMeeting.meetingType === key
                          ? 'bg-primary text-white border-primary'
                          : 'bg-card text-muted-foreground border-border hover:bg-background'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_kec9584ec')}</label>
                <textarea
                  value={newMeeting.agenda}
                  onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                  placeholder="논의할 내용을 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-background"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newMeeting.employeeId || !newMeeting.scheduledAt}
                className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
              >
                {creating ? '예약 중...' : '예약'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
