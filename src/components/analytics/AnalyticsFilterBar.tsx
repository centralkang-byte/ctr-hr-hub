'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Building2, Users, Network } from 'lucide-react'

const PERIOD_OPTIONS = [
  { value: '12m', label: '최근 12개월' },
  { value: '6m', label: '최근 6개월' },
  { value: '3m', label: '최근 3개월' },
  { value: 'ytd', label: `${new Date().getFullYear()}년` },
  { value: 'prev', label: `${new Date().getFullYear() - 1}년` },
  { value: 'custom', label: '사용자 지정' },
]

interface DeptNode {
  id: string
  name: string
  nameEn?: string | null
  companyId: string
  children: { id: string; name: string; nameEn?: string | null }[]
}

interface AnalyticsFilterBarProps {
  companies?: { id: string; name: string }[]
  /** @deprecated Use hierarchy API instead */
  departments?: { id: string; name: string }[]
  showDepartment?: boolean
}

export function AnalyticsFilterBar({ companies = [], showDepartment = true }: AnalyticsFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [companyId, setCompanyId] = useState(searchParams.get('companyId') || '')
  const [divisionId, setDivisionId] = useState(searchParams.get('divisionId') || '')
  const [teamId, setTeamId] = useState(searchParams.get('departmentId') || '')
  const [period, setPeriod] = useState(searchParams.get('period') || '12m')
  const [hierarchy, setHierarchy] = useState<DeptNode[]>([])

  // Custom date range state
  const [customStart, setCustomStart] = useState(searchParams.get('startDate')?.split('T')[0] || '')
  const [customEnd, setCustomEnd] = useState(searchParams.get('endDate')?.split('T')[0] || '')

  // ── Fetch hierarchy when companyId changes ──
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const url = companyId
          ? `/api/v1/departments/hierarchy?companyId=${companyId}`
          : '/api/v1/departments/hierarchy'
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          setHierarchy(json.data || [])
        }
      } catch {
        setHierarchy([])
      }
    }
    if (showDepartment) fetchHierarchy()
  }, [companyId, showDepartment])

  // ── Available teams filtered by division ──
  const availableTeams = useMemo(() => {
    if (!divisionId) return []
    return hierarchy.find((d) => d.id === divisionId)?.children || []
  }, [divisionId, hierarchy])

  // ── URL param update ──
  const updateParams = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())

    // Apply overrides
    for (const [key, val] of Object.entries(overrides)) {
      if (val) params.set(key, val)
      else params.delete(key)
    }

    // Calculate dates from period
    const now = new Date()
    const effectivePeriod = overrides.period ?? period
    let startDate: Date
    let endDate: Date = now

    if (effectivePeriod === 'custom') {
      // Use custom dates — don't auto-calculate
      const cs = overrides.startDate ?? customStart
      const ce = overrides.endDate ?? customEnd
      if (cs) params.set('startDate', new Date(cs).toISOString())
      if (ce) params.set('endDate', new Date(ce).toISOString())
    } else {
      switch (effectivePeriod) {
        case '6m':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1); break
        case '3m':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); break
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1); break
        case 'prev':
          startDate = new Date(now.getFullYear() - 1, 0, 1)
          endDate = new Date(now.getFullYear() - 1, 11, 31)
          break
        default: // 12m (TTM)
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1)
      }
      params.set('startDate', startDate!.toISOString())
      params.set('endDate', endDate.toISOString())
    }

    // Resolve department filter — pass the most specific filter
    // If teamId → departmentId = teamId
    // If divisionId only → departmentId = divisionId (backend resolves children)
    const effectiveTeam = overrides.departmentId ?? teamId
    const effectiveDivision = overrides.divisionId ?? divisionId
    if (effectiveTeam) {
      params.set('departmentId', effectiveTeam)
    } else if (effectiveDivision) {
      params.set('departmentId', effectiveDivision)
    } else {
      params.delete('departmentId')
    }

    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, period, customStart, customEnd, teamId, divisionId, router])

  // ── Handlers ──
  const handleCompanyChange = (val: string) => {
    setCompanyId(val)
    setDivisionId('')
    setTeamId('')
    updateParams({ companyId: val, divisionId: '', departmentId: '' })
  }

  const handleDivisionChange = (val: string) => {
    setDivisionId(val)
    setTeamId('')
    updateParams({ divisionId: val, departmentId: val })
  }

  const handleTeamChange = (val: string) => {
    setTeamId(val)
    updateParams({ departmentId: val || divisionId })
  }

  const handlePeriodChange = (val: string) => {
    setPeriod(val)
    if (val !== 'custom') {
      updateParams({ period: val })
    }
  }

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      updateParams({ period: 'custom', startDate: customStart, endDate: customEnd })
    }
  }

  const selectClass = 'text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer min-w-[120px]'

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
        {/* Company selector */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-400" />
          <select
            value={companyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className={selectClass}
          >
            <option value="">그룹 합산</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Division (본부) selector */}
        {showDepartment && (
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-gray-400" />
            <select
              value={divisionId}
              onChange={(e) => handleDivisionChange(e.target.value)}
              disabled={!companyId}
              className={`${selectClass} ${!companyId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">전체 본부</option>
              {hierarchy.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Team (팀) selector */}
        {showDepartment && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <select
              value={teamId}
              onChange={(e) => handleTeamChange(e.target.value)}
              disabled={!divisionId}
              className={`${selectClass} ${!divisionId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">전체 팀</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Period selector */}
        <div className="flex items-center gap-2 ml-auto">
          <Calendar className="h-4 w-4 text-gray-400" />
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className={selectClass}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
          <span className="text-xs font-medium text-gray-500">시작일</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
          <span className="text-xs font-medium text-gray-500">종료일</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!customStart || !customEnd}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            적용
          </button>
        </div>
      )}
    </div>
  )
}
