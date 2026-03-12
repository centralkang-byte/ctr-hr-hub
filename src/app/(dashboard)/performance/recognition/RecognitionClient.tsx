'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Heart, ThumbsUp, Search, Send, Sparkles } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { apiClient } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { ROLE } from '@/lib/constants'
import { BUTTON_VARIANTS,  MODAL_STYLES } from '@/lib/styles'


// ─── Types ───────────────────────────────────────────────

interface FeedItem {
  id: string
  sender: { id: string; name: string; department?: { name: string } }
  receiver: { id: string; name: string; department?: { name: string } }
  coreValue: string
  message: string
  createdAt: string
  likeCount: number
  likedByMe: boolean
}

interface Stats {
  valueDistribution: { value: string; count: number }[]
  monthlyTrend: { month: string; count: number }[]
  departmentActivity: { name: string; sent: number; received: number }[]
  topRecognizers: { name: string; count: number }[]
  topRecognized: { name: string; count: number }[]
}

interface Employee {
  id: string
  name: string
  employeeNo: string
  department?: { name: string }
}

// ─── Constants ───────────────────────────────────────────

const VALUE_CONFIG: Record<string, { label: string; emoji: string; bgDefault: string; borderDefault: string; textDefault: string; bgActive: string; textActive: string }> = {
  CHALLENGE: { label: '도전', emoji: '🔴', bgDefault: 'bg-[#FEF2F2]', borderDefault: 'border-[#FECACA]', textDefault: 'text-[#EF4444]', bgActive: 'bg-[#EF4444]', textActive: 'text-white' },
  TRUST: { label: '신뢰', emoji: '🟢', bgDefault: 'bg-[#E8F5E9]', borderDefault: 'border-[#A5D6A7]', textDefault: 'text-[#00C853]', bgActive: 'bg-[#00C853]', textActive: 'text-white' },
  RESPONSIBILITY: { label: '책임', emoji: '🟠', bgDefault: 'bg-[#FFFBEB]', borderDefault: 'border-[#FDE68A]', textDefault: 'text-[#F59E0B]', bgActive: 'bg-[#F59E0B]', textActive: 'text-white' },
  RESPECT: { label: '존중', emoji: '🔵', bgDefault: 'bg-[#EFF6FF]', borderDefault: 'border-[#BFDBFE]', textDefault: 'text-[#3B82F6]', bgActive: 'bg-[#3B82F6]', textActive: 'text-white' },
}

const VALUE_LABELS: Record<string, string> = { CHALLENGE: 'Challenge', TRUST: 'Trust', RESPONSIBILITY: 'Responsibility', RESPECT: 'Respect' }
const CHART_COLORS = ['#EF4444', '#00C853', '#F59E0B', '#3B82F6']

// ─── Component ───────────────────────────────────────────

export default function RecognitionClient() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === ROLE.HR_ADMIN || session?.user?.role === ROLE.SUPER_ADMIN

  const [activeTab, setActiveTab] = useState<'feed' | 'stats'>('feed')
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [valueFilter, setValueFilter] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Create form
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Employee[]>([])
  const [selectedReceiver, setSelectedReceiver] = useState<Employee | null>(null)
  const [selectedValue, setSelectedValue] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const fetchFeed = useCallback(async (cursor?: string) => {
    if (!cursor) setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { limit: 20 }
      if (cursor) params.cursor = cursor
      if (valueFilter) params.value = valueFilter
      const res = await apiClient.get<{ items: FeedItem[]; nextCursor: string | null }>('/api/v1/cfr/recognitions', params)
      if (cursor) {
        setFeed((prev) => [...prev, ...res.data.items])
      } else {
        setFeed(res.data.items)
      }
      setNextCursor(res.data.nextCursor)
    } catch { /* ignore */ }
    setLoading(false)
  }, [valueFilter])

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await apiClient.get<Stats>('/api/v1/cfr/recognitions/stats')
      setStats(res.data)
    } catch { /* ignore */ }
  }, [isAdmin])

  useEffect(() => { fetchFeed() }, [fetchFeed])
  useEffect(() => { if (activeTab === 'stats') fetchStats() }, [activeTab, fetchStats])

  const handleLike = async (id: string) => {
    try {
      const res = await apiClient.post<{ liked: boolean; likeCount: number }>(`/api/v1/cfr/recognitions/${id}/like`)
      setFeed((prev) => prev.map((item) =>
        item.id === id
          ? { ...item, likedByMe: res.data.liked, likeCount: res.data.likeCount }
          : item,
      ))
    } catch { /* ignore */ }
  }

  const searchEmployees = (query: string) => {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (query.length < 2) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiClient.getList<Employee>('/api/v1/employees', { search: query, limit: 10 })
        setSearchResults(res.data.filter((emp: Employee) => emp.id !== session?.user?.employeeId))
      } catch { /* ignore */ }
    }, 200)
  }

  const handleCreate = async () => {
    if (!selectedReceiver || !selectedValue || message.length < 10) return
    setCreating(true)
    try {
      await apiClient.post('/api/v1/cfr/recognitions', {
        receiverId: selectedReceiver.id,
        coreValue: selectedValue,
        message,
      })
      setShowCreateModal(false)
      setSelectedReceiver(null)
      setSelectedValue('')
      setMessage('')
      setSearchQuery('')
      fetchFeed()
    } catch { /* ignore */ }
    setCreating(false)
  }

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return '방금 전'
    if (hours < 24) return `${hours}시간 전`
    const days = Math.floor(hours / 24)
    return `${days}일 전`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-6 h-6 text-[#00C853]" />
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Recognition</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Send className="w-4 h-4" /> 칭찬 보내기
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-[#E8E8E8]">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              activeTab === 'feed' ? 'border-[#00C853] text-[#00C853]' : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            피드
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === 'stats' ? 'border-[#00C853] text-[#00C853]' : 'border-transparent text-[#666] hover:text-[#333]'
              }`}
            >
              통계
            </button>
          )}
        </div>
        {activeTab === 'feed' && (
          <select
            value={valueFilter}
            onChange={(e) => setValueFilter(e.target.value)}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
          >
            <option value="">전체</option>
            {Object.entries(VALUE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.emoji} {config.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-[#999]">로딩 중...</div>
          ) : feed.length === 0 ? (
            <div className="text-center py-12 text-[#999]">
              <Heart className="w-12 h-12 mx-auto mb-3 text-[#D4D4D4]" />
              <p>아직 칭찬이 없습니다. 첫 번째 칭찬을 보내보세요!</p>
            </div>
          ) : (
            <>
              {feed.map((item) => {
                const config = VALUE_CONFIG[item.coreValue]
                return (
                  <div key={item.id} className="bg-white rounded-xl border border-[#E8E8E8] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-sm font-semibold text-[#00C853]">
                        {item.sender.name.charAt(0)}
                      </div>
                      <span className="font-medium text-[#1A1A1A]">{item.sender.name}</span>
                      <span className="text-[#999]">→</span>
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-sm font-semibold text-[#00C853]">
                        {item.receiver.name.charAt(0)}
                      </div>
                      <span className="font-medium text-[#1A1A1A]">{item.receiver.name}</span>
                    </div>
                    {config && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 ${config.bgDefault} ${config.textDefault} border ${config.borderDefault}`}>
                        {config.emoji} {config.label} ({VALUE_LABELS[item.coreValue]})
                      </span>
                    )}
                    <p className="text-sm text-[#333] leading-relaxed mb-3">&quot;{item.message}&quot;</p>
                    <div className="flex items-center justify-between text-xs text-[#999]">
                      <span>
                        {formatTimeAgo(item.createdAt)}
                        {item.sender.department && ` · ${item.sender.department.name}`}
                      </span>
                      <button
                        onClick={() => handleLike(item.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
                          item.likedByMe
                            ? 'bg-[#E8F5E9] text-[#00C853]'
                            : 'bg-[#FAFAFA] text-[#666] hover:bg-[#F5F5F5]'
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${item.likedByMe ? 'fill-current' : ''}`} />
                        {item.likeCount}
                      </button>
                    </div>
                  </div>
                )
              })}

              {nextCursor && (
                <div className="text-center">
                  <button
                    onClick={() => fetchFeed(nextCursor)}
                    className="px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]"
                  >
                    더 보기
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Value Distribution */}
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
              <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">핵심가치별 분포</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.valueDistribution.map((v) => ({ name: VALUE_CONFIG[v.value]?.label ?? v.value, value: v.count }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      label
                    >
                      {stats.valueDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Activity */}
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
              <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">부서별 활성도</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.departmentActivity.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#666' }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sent" name="보낸 수" fill="#00C853" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="received" name="받은 수" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">월별 추이</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Recognition 수" stroke="#00C853" strokeWidth={2} dot={{ fill: '#00C853' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
              <h3 className="text-base font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" /> Top Recognizers
              </h3>
              <div className="space-y-2">
                {stats.topRecognizers.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#FAFAFA] text-xs text-[#666] font-medium flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-[#1A1A1A]">{r.name}</span>
                    </div>
                    <span className="text-sm font-medium text-[#00C853]">{r.count}건</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
              <h3 className="text-base font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#EF4444]" /> Top Recognized
              </h3>
              <div className="space-y-2">
                {stats.topRecognized.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#FAFAFA] text-xs text-[#666] font-medium flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-[#1A1A1A]">{r.name}</span>
                    </div>
                    <span className="text-sm font-medium text-[#8B5CF6]">{r.count}건</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-[#E8E8E8]">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">칭찬 보내기</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Receiver search */}
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">받는 사람</label>
                {selectedReceiver ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-[#D4D4D4] rounded-lg bg-[#FAFAFA]">
                    <span className="text-sm text-[#1A1A1A]">
                      {selectedReceiver.name} ({selectedReceiver.employeeNo})
                    </span>
                    <button onClick={() => { setSelectedReceiver(null); setSearchQuery('') }} className="text-xs text-[#999] hover:text-[#EF4444]">변경</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => searchEmployees(e.target.value)}
                      placeholder="직원 이름 또는 사번 검색"
                      className="w-full pl-9 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E8E8E8] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {searchResults.map((emp) => (
                          <button
                            key={emp.id}
                            onClick={() => { setSelectedReceiver(emp); setSearchResults([]); setSearchQuery('') }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[#FAFAFA] flex items-center justify-between"
                          >
                            <span>{emp.name}</span>
                            <span className="text-xs text-[#999]">{emp.employeeNo}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Core Value selection */}
              <div>
                <label className="text-sm font-medium text-[#333] mb-2 block">CTR 핵심가치 선택 (필수)</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(VALUE_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedValue(key)}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedValue === key
                          ? `${config.bgActive} ${config.textActive} border-transparent`
                          : `${config.bgDefault} ${config.textDefault} ${config.borderDefault}`
                      }`}
                    >
                      {config.emoji} {config.label}
                      <span className="block text-xs opacity-70">{VALUE_LABELS[key]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">메시지 (10~500자)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="칭찬 메시지를 작성하세요..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
                />
                <p className="text-xs text-[#999] mt-1">{message.length}/500</p>
              </div>
            </div>
            <div className="p-6 border-t border-[#E8E8E8] flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setSelectedReceiver(null); setSelectedValue(''); setMessage('') }}
                className="px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#333] hover:bg-[#FAFAFA]"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !selectedReceiver || !selectedValue || message.length < 10}
                className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
              >
                {creating ? '보내는 중...' : '보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
