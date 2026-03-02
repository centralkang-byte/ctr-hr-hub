'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Plus, Calendar, AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiClient } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { ROLE } from '@/lib/constants'


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

export default function OneOnOneClient() {
  const { data: session } = useSession()
  const router = useRouter()
  const isManager = session?.user?.role === ROLE.MANAGER || session?.user?.role === ROLE.HR_ADMIN || session?.user?.role === ROLE.EXECUTIVE

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
    } catch { /* ignore */ }
    setLoading(false)
  }, [statusFilter])

  const fetchDashboard = useCallback(async () => {
    if (!isManager) return
    try {
      const res = await apiClient.get<DashboardData>('/api/v1/cfr/one-on-ones/dashboard')
      setDashboard(res.data)
    } catch { /* ignore */ }
  }, [isManager])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])
  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const openCreateModal = async () => {
    try {
      const res = await apiClient.getList<TeamMember>('/api/v1/employees', { managerId: session?.user?.employeeId, status: 'ACTIVE', limit: 100 })
      setTeamMembers(res.data)
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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

  const chartColors = ['#00C853', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-[#00C853]" />
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            {isManager ? '1:1 미팅' : '내 1:1 미팅'}
          </h1>
        </div>
        {isManager && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#00C853] hover:bg-[#00A844] text-white px-4 py-2 rounded-lg font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> 새 1:1 예약
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        {['ALL', 'SCHEDULED', 'COMPLETED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              statusFilter === s
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            {s === 'ALL' ? '전체' : s === 'SCHEDULED' ? '예정' : '완료'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#999]">로딩 중...</div>
      ) : (
        <div className="space-y-6">
          {/* Scheduled Meetings */}
          {(statusFilter === 'ALL' || statusFilter === 'SCHEDULED') && scheduled.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#00C853]" /> 예정된 1:1
              </h2>
              <div className="space-y-3">
                {scheduled.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl border border-[#E8E8E8] p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#00C853] font-semibold">
                          {(isManager ? m.employee.name : m.manager.name).charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#1A1A1A]">
                            {isManager ? m.employee.name : m.manager.name}
                          </p>
                          <p className="text-xs text-[#666]">
                            {new Date(m.scheduledAt).toLocaleDateString('ko-KR')} {new Date(m.scheduledAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#00A844]">
                              {MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}
                            </span>
                          </p>
                        </div>
                      </div>
                      {isManager && (
                        <button
                          onClick={() => router.push(`/performance/one-on-one/${m.id}`)}
                          className="text-sm font-medium text-[#00C853] hover:text-[#00A844]"
                        >
                          기록하기
                        </button>
                      )}
                    </div>
                    {m.agenda && (
                      <p className="mt-2 text-sm text-[#555] pl-[52px]">아젠다: {m.agenda}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Meetings */}
          {(statusFilter === 'ALL' || statusFilter === 'COMPLETED') && completed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#059669]" /> 완료된 1:1
              </h2>
              <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#FAFAFA]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        {isManager ? '팀원' : '매니저'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">일시</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">유형</th>
                      {isManager && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">액션 미완료</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {completed.map((m) => {
                      const pendingActions = (m.actionItems ?? []).filter((a) => !a.completed).length
                      return (
                        <tr
                          key={m.id}
                          className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] cursor-pointer"
                          onClick={() => router.push(`/performance/one-on-one/${m.id}`)}
                        >
                          <td className="px-4 py-3 text-sm text-[#1A1A1A]">
                            {isManager ? m.employee.name : m.manager.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#555]">
                            {new Date(m.completedAt ?? m.scheduledAt).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]">
                              {MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}
                            </span>
                          </td>
                          {isManager && (
                            <td className="px-4 py-3 text-sm">
                              {pendingActions > 0 ? (
                                <span className="text-[#EF4444] font-medium">{pendingActions}건</span>
                              ) : (
                                <span className="text-[#059669]">0건</span>
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
            <div className="text-center py-12 text-[#999]">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-[#D4D4D4]" />
              <p>등록된 1:1 미팅이 없습니다.</p>
            </div>
          )}

          {/* Manager Dashboard */}
          {isManager && dashboard && (
            <>
              {/* Frequency Chart */}
              {chartData.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#8B5CF6]" /> 1:1 빈도 대시보드
                  </h2>
                  <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#666' }} allowDecimals={false} />
                          <Tooltip />
                          {dashboard.teamMembers.map((member, i) => (
                            <Bar key={member.employeeId} dataKey={member.name} fill={chartColors[i % chartColors.length]} radius={[4, 4, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Overdue warning */}
                    {dashboard.teamMembers.filter((m) => m.overdue).length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-[#EF4444]">
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
                  <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#F59E0B]" /> 미완료 액션 아이템
                  </h2>
                  <div className="bg-white rounded-xl border border-[#E8E8E8] p-5 space-y-2">
                    {dashboard.pendingActionItems.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-[#F5F5F5] last:border-0">
                        <div className="w-4 h-4 rounded border border-[#D4D4D4]" />
                        <span className="text-sm text-[#1A1A1A] font-medium">{a.employeeName}:</span>
                        <span className="text-sm text-[#555]">&quot;{a.item}&quot;</span>
                        {a.dueDate && (
                          <span className="text-xs text-[#999] ml-auto">(기한: {a.dueDate})</span>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-[#E8E8E8]">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">새 1:1 예약</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">팀원</label>
                <select
                  value={newMeeting.employeeId}
                  onChange={(e) => setNewMeeting({ ...newMeeting, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
                >
                  <option value="">선택하세요</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.employeeNo})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">일시</label>
                <input
                  type="datetime-local"
                  value={newMeeting.scheduledAt}
                  onChange={(e) => setNewMeeting({ ...newMeeting, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">유형</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNewMeeting({ ...newMeeting, meetingType: key })}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        newMeeting.meetingType === key
                          ? 'bg-[#00C853] text-white border-[#00C853]'
                          : 'bg-white text-[#555] border-[#D4D4D4] hover:bg-[#FAFAFA]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">아젠다</label>
                <textarea
                  value={newMeeting.agenda}
                  onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                  placeholder="논의할 내용을 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[#E8E8E8] flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#333] hover:bg-[#FAFAFA]"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newMeeting.employeeId || !newMeeting.scheduledAt}
                className="px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-50"
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
