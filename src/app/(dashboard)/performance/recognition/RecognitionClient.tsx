'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Heart, ThumbsUp, Search, Send, Sparkles } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS, MODAL_STYLES, CHART_THEME } from '@/lib/styles'
import { EmployeeCell } from '@/components/common/EmployeeCell'


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
  CHALLENGE: { label: '도전', emoji: '🔴', bgDefault: 'bg-destructive/5', borderDefault: 'border-destructive/20', textDefault: 'text-red-500', bgActive: 'bg-destructive/50', textActive: 'text-white' },
  TRUST: { label: '신뢰', emoji: '🟢', bgDefault: 'bg-primary/10', borderDefault: 'border-green-300', textDefault: 'text-primary', bgActive: 'bg-primary', textActive: 'text-white' },
  RESPONSIBILITY: { label: '책임', emoji: '🟠', bgDefault: 'bg-amber-500/10', borderDefault: 'border-amber-200', textDefault: 'text-amber-500', bgActive: 'bg-amber-500/100', textActive: 'text-white' },
  RESPECT: { label: '존중', emoji: '🔵', bgDefault: 'bg-primary/5', borderDefault: 'border-primary/20', textDefault: 'text-blue-500', bgActive: 'bg-primary/50', textActive: 'text-white' },
}

const VALUE_LABELS: Record<string, string> = { CHALLENGE: 'Challenge', TRUST: 'Trust', RESPONSIBILITY: 'Responsibility', RESPECT: 'Respect' }
const CHART_COLORS = ['#EF4444', '#5E81F4', '#F59E0B', '#3B82F6']

// ─── Component ───────────────────────────────────────────

export default function RecognitionClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  const isAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

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
    } catch (err) { toast({ title: '리코그니션 목록 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setLoading(false)
  }, [valueFilter])

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await apiClient.get<Stats>('/api/v1/cfr/recognitions/stats')
      setStats(res.data)
    } catch (err) { toast({ title: '통계 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
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
    } catch (err) { toast({ title: '반응 처리 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
  }

  const searchEmployees = (query: string) => {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (query.length < 2) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiClient.getList<Employee>('/api/v1/employees', { search: query, limit: 10 })
        setSearchResults(res.data.filter((emp: Employee) => emp.id !== user.employeeId))
      } catch (err) { toast({ title: '직원 검색 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
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
    } catch (err) { toast({ title: '리코그니션 등록 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
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
          <Heart className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Recognition</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Send className="w-4 h-4" /> {t('kr_kecb9adec_kebb3b4eb')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              activeTab === 'feed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('kr_ked94bceb')}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === 'stats' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('statistics')}
            </button>
          )}
        </div>
        {activeTab === 'feed' && (
          <select
            value={valueFilter}
            onChange={(e) => setValueFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm"
          >
            <option value="">{tCommon('all')}</option>
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
            <div className="text-center py-12 text-muted-foreground">{tCommon('loading')}</div>
          ) : feed.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-3 text-border" />
              <EmptyState />
            </div>
          ) : (
            <>
              {feed.map((item) => {
                const config = VALUE_CONFIG[item.coreValue]
                return (
                  <div key={item.id} className="bg-card rounded-xl shadow-sm border border-border p-6">
                    <div className="flex items-center gap-2 mb-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <EmployeeCell size="sm" employee={item.sender as any} />
                      <span className="text-muted-foreground">→</span>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <EmployeeCell size="sm" employee={item.receiver as any} />
                    </div>
                    {config && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 ${config.bgDefault} ${config.textDefault} border ${config.borderDefault}`}>
                        {config.emoji} {config.label} ({VALUE_LABELS[item.coreValue]})
                      </span>
                    )}
                    <p className="text-sm text-foreground leading-relaxed mb-3">&quot;{item.message}&quot;</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatTimeAgo(item.createdAt)}
                        {item.sender.department && ` · ${item.sender.department.name}`}
                      </span>
                      <button
                        onClick={() => handleLike(item.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
                          item.likedByMe
                            ? 'bg-primary/10 text-primary'
                            : 'bg-background text-muted-foreground hover:bg-muted'
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
                    className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-background"
                  >
                    {t('kr_keb8d94_view')}
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
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">{t('kr_ked95b5ec_kebb684ed')}</h3>
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
                    <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Activity */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">{t('department_kebb384_ked999cec')}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.departmentActivity.slice(0, 8)}>
                    <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#666' }} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                    <Legend />
                    <Bar dataKey="sent" name="보낸 수" fill={CHART_THEME.colors[3]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="received" name="받은 수" fill={CHART_THEME.colors[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">{t('month_kebb384_kecb694ec')}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthlyTrend}>
                  <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                  <Line type="monotone" dataKey="count" name={t('recognitionCount')} stroke={CHART_THEME.colors[3]} strokeWidth={2} dot={{ fill: '#5E81F4' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Top Recognizers
              </h3>
              <div className="space-y-2">
                {stats.topRecognizers.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-background text-xs text-muted-foreground font-medium flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-foreground">{r.name}</span>
                    </div>
                    <span className="text-sm font-medium text-primary">{r.count}건</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" /> Top Recognized
              </h3>
              <div className="space-y-2">
                {stats.topRecognized.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-background text-xs text-muted-foreground font-medium flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-foreground">{r.name}</span>
                    </div>
                    <span className="text-sm font-medium text-violet-500">{r.count}건</span>
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
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">{t('kr_kecb9adec_kebb3b4eb')}</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Receiver search */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_kebb09beb_kec82aceb')}</label>
                {selectedReceiver ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-border rounded-lg bg-background">
                    <span className="text-sm text-foreground">
                      {selectedReceiver.name} ({selectedReceiver.employeeNo})
                    </span>
                    <button onClick={() => { setSelectedReceiver(null); setSearchQuery('') }} className="text-xs text-muted-foreground hover:text-red-500">{t('kr_kebb380ea')}</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => searchEmployees(e.target.value)}
                      placeholder={tCommon('searchEmployee')}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {searchResults.map((emp) => (
                          <button
                            key={emp.id}
                            onClick={() => { setSelectedReceiver(emp); setSearchResults([]); setSearchQuery('') }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-background flex items-center justify-between"
                          >
                            <span>{emp.name}</span>
                            <span className="text-xs text-muted-foreground">{emp.employeeNo}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Core Value selection */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t('kr_ctr_ked95b5ec_kec84a0ed_requir')}</label>
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
                <label className="text-sm font-medium text-foreground mb-1 block">{t('kr_keba994ec_10_500kec9e90')}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="칭찬 메시지를 작성하세요..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">{message.length}/500</p>
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setSelectedReceiver(null); setSelectedValue(''); setMessage('') }}
                className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-background"
              >
                {t('cancel')}
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
