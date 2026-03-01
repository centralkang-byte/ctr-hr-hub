'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { apiClient } from '@/lib/api'
import SocialInsuranceConfigForm from './SocialInsuranceConfigForm'

interface SocialInsuranceConfig {
  id: string
  insuranceType: string
  city: string
  employerRate: number
  employeeRate: number
  baseMin: number
  baseMax: number
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
}

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  PENSION: '양로보험 (养老)',
  MEDICAL: '의료보험 (医疗)',
  UNEMPLOYMENT: '실업보험 (失业)',
  WORK_INJURY: '산재보험 (工伤)',
  MATERNITY_INS: '생육보험 (生育)',
  HOUSING_FUND: '주택적립금 (公积金)',
}

export default function SocialInsuranceConfigTab() {
  const [configs, setConfigs] = useState<SocialInsuranceConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<SocialInsuranceConfig | null>(null)

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<SocialInsuranceConfig>(
        '/api/v1/compliance/cn/social-insurance/config',
        { limit: 100 },
      )
      setConfigs(res.data ?? [])
    } catch {
      // handle error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const handleAdd = () => {
    setEditingConfig(null)
    setShowForm(true)
  }

  const handleEdit = (config: SocialInsuranceConfig) => {
    setEditingConfig(config)
    setShowForm(true)
  }

  const handleFormClose = (refresh?: boolean) => {
    setShowForm(false)
    setEditingConfig(null)
    if (refresh) fetchConfigs()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">사회보험 요율 설정</h2>
          <p className="text-xs text-slate-500 mt-0.5">五险一金 요율 및 기수를 관리합니다</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          요율 추가
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading...</div>
      ) : configs.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          등록된 사회보험 요율이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 font-medium uppercase tracking-wider">
                <th className="px-4 py-3 text-left">보험 유형</th>
                <th className="px-4 py-3 text-left">도시</th>
                <th className="px-4 py-3 text-right">회사 부담률</th>
                <th className="px-4 py-3 text-right">직원 부담률</th>
                <th className="px-4 py-3 text-right">기수 하한</th>
                <th className="px-4 py-3 text-right">기수 상한</th>
                <th className="px-4 py-3 text-left">적용 시작일</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr
                  key={config.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {INSURANCE_TYPE_LABELS[config.insuranceType] ?? config.insuranceType}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{config.city}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {config.employerRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {config.employeeRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {config.baseMin.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {config.baseMax.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {config.effectiveFrom.split('T')[0]}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        config.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {config.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleEdit(config)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="수정"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <SocialInsuranceConfigForm
          config={editingConfig}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
