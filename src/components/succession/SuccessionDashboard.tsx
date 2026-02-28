'use client'

import { useState, useCallback, useEffect } from 'react'
import { Crown, Users, AlertTriangle, Shield } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────

interface DashboardData {
  totalPlans: number
  activePlans: number
  criticalPlans: number
  plansWithCandidates: number
  plansWithoutCandidates: number
  readiness: Array<{ readiness: string; count: number }>
}

const READINESS_LABELS: Record<string, string> = {
  READY_NOW: '즉시 가능',
  READY_1_2_YEARS: '1-2년 내',
  READY_3_PLUS_YEARS: '3년 이상',
}

const READINESS_COLORS: Record<string, string> = {
  READY_NOW: '#10B981',
  READY_1_2_YEARS: '#2563EB',
  READY_3_PLUS_YEARS: '#F59E0B',
}

// ─── Component ───────────────────────────────────────────

export default function SuccessionDashboard() {
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient.get<DashboardData>('/api/v1/succession/dashboard')
      setData(res.data)
    } catch {
      toast({ title: '대시보드 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (loading) {
    return <div className="py-8 text-center text-slate-500">로딩 중...</div>
  }

  if (!data) return null

  const pieData = data.readiness.map((r) => ({
    name: READINESS_LABELS[r.readiness] ?? r.readiness,
    value: r.count,
    color: READINESS_COLORS[r.readiness] ?? '#94A3B8',
  }))

  const totalCandidates = pieData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="space-y-6">
      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Crown className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">전체 핵심직책</p>
              <p className="text-2xl font-bold text-slate-900">{data.totalPlans}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">활성 계획</p>
              <p className="text-2xl font-bold text-slate-900">{data.activePlans}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">후보 없는 직책</p>
              <p className="text-2xl font-bold text-red-600">{data.plansWithoutCandidates}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">전체 후보자</p>
              <p className="text-2xl font-bold text-slate-900">{totalCandidates}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Readiness Distribution ─── */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">준비도 분포</h3>
          <div className="flex items-center gap-6">
            <div className="relative w-48 h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalCandidates}</p>
                  <p className="text-xs text-slate-500">후보자</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-sm">{d.name}</span>
                  <span className="text-sm font-medium">{d.value}명</span>
                  <span className="text-xs text-slate-400">
                    ({totalCandidates > 0 ? Math.round((d.value / totalCandidates) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
