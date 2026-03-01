'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russia Compliance Reports Tab
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { Download, FileBarChart2, BarChart3 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface P4Report {
  year: number
  quarter: number
  periodStart: string
  periodEnd: string
  totalHeadcount: number
  reportDate: string
  departments: Array<{ department: string; headcount: number }>
}

interface Report57T {
  year: number
  totalHeadcount: number
  reportDate: string
  jobCategories: Array<{ categoryCode: string; categoryName: string; headcount: number }>
}

export default function RuReportsTab() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))

  const [p4Data, setP4Data] = useState<P4Report | null>(null)
  const [report57tData, setReport57tData] = useState<Report57T | null>(null)
  const [loadingP4, setLoadingP4] = useState(false)
  const [loading57t, setLoading57t] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchP4 = async () => {
    setLoadingP4(true)
    setError(null)
    try {
      const res = await apiClient.get<P4Report>('/api/v1/compliance/ru/reports/p4', {
        year,
        quarter,
      })
      setP4Data(res.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'P-4 보고서 로딩 오류')
    } finally {
      setLoadingP4(false)
    }
  }

  const fetch57T = async () => {
    setLoading57t(true)
    setError(null)
    try {
      const res = await apiClient.get<Report57T>('/api/v1/compliance/ru/reports/57t', { year })
      setReport57tData(res.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '57-T 보고서 로딩 오류')
    } finally {
      setLoading57t(false)
    }
  }

  const downloadReport = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-6">
      {/* Year/Quarter Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">보고서 기간 설정</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">연도</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              분기 <span className="text-xs text-slate-400">(P-4 전용)</span>
            </label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1분기</option>
              <option value={2}>2분기</option>
              <option value={3}>3분기</option>
              <option value={4}>4분기</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* P-4 Report */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileBarChart2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">П-4 분기 보고서</h3>
              <p className="text-xs text-slate-500">
                Форма П-4 — 직원 수 및 임금 통계 (Росстат)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchP4}
              disabled={loadingP4}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {loadingP4 ? '생성 중...' : `${year}년 ${quarter}분기 생성`}
            </button>
            {p4Data && (
              <button
                onClick={() =>
                  downloadReport(p4Data, `P4_${year}_Q${quarter}.json`)
                }
                className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                다운로드
              </button>
            )}
          </div>
        </div>

        {p4Data ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">보고 기간</p>
                <p className="text-sm font-semibold text-slate-900">
                  {p4Data.year}년 {p4Data.quarter}분기
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">총 인원</p>
                <p className="text-3xl font-bold text-slate-900">{p4Data.totalHeadcount}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">보고서 생성일</p>
                <p className="text-sm font-semibold text-slate-900">
                  {new Date(p4Data.reportDate).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>

            {/* Department breakdown */}
            {p4Data.departments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">부서별 인원 현황</h4>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">부서</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">인원 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p4Data.departments.map((dept) => (
                      <tr key={dept.department} className="border-b border-slate-100">
                        <td className="px-4 py-2 text-sm text-slate-800">{dept.department}</td>
                        <td className="px-4 py-2 text-sm text-slate-800 text-right font-medium">
                          {dept.headcount}명
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
            연도와 분기를 선택 후 &quot;생성&quot; 버튼을 클릭하세요.
          </div>
        )}
      </div>

      {/* 57-T Report */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">57-Т 연간 임금조사</h3>
              <p className="text-xs text-slate-500">
                Форма 57-Т — 직군별 임금 및 처우 연간 조사 (Росстат)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetch57T}
              disabled={loading57t}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {loading57t ? '생성 중...' : `${year}년 연간 생성`}
            </button>
            {report57tData && (
              <button
                onClick={() =>
                  downloadReport(report57tData, `57T_${year}.json`)
                }
                className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                다운로드
              </button>
            )}
          </div>
        </div>

        {report57tData ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">대상 연도</p>
                <p className="text-sm font-semibold text-slate-900">{report57tData.year}년</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">총 인원</p>
                <p className="text-3xl font-bold text-slate-900">{report57tData.totalHeadcount}</p>
              </div>
            </div>

            {/* Job Category breakdown */}
            {report57tData.jobCategories.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">직군별 인원 현황</h4>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">직군 코드</th>
                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">직군명</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">인원 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report57tData.jobCategories.map((cat) => (
                      <tr key={cat.categoryCode} className="border-b border-slate-100">
                        <td className="px-4 py-2 text-xs text-slate-500 font-mono">
                          {cat.categoryCode}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-800">{cat.categoryName}</td>
                        <td className="px-4 py-2 text-sm text-slate-800 text-right font-medium">
                          {cat.headcount}명
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
            연도를 선택 후 &quot;생성&quot; 버튼을 클릭하세요.
          </div>
        )}
      </div>
    </div>
  )
}
