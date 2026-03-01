'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calculator, Download } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface ReportRow {
  insuranceType: string
  employeeCount: number
  totalBaseSalary: number
  totalEmployerAmount: number
  totalEmployeeAmount: number
  totalAmount: number
}

interface ReportData {
  meta: {
    year: number
    month: number
    generatedAt: string
    filename: string
  }
  summary: {
    grandTotalEmployer: number
    grandTotalEmployee: number
    grandTotal: number
  }
  rows: ReportRow[]
}

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  PENSION: '양로보험 (养老)',
  MEDICAL: '의료보험 (医疗)',
  UNEMPLOYMENT: '실업보험 (失业)',
  WORK_INJURY: '산재보험 (工伤)',
  MATERNITY_INS: '생육보험 (生育)',
  HOUSING_FUND: '주택적립금 (公积金)',
}

const formatCNY = (amount: number) =>
  `¥ ${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function SocialInsuranceReportTab() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calcMessage, setCalcMessage] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ReportData>(
        '/api/v1/compliance/cn/social-insurance/export',
        { year, month },
      )
      setReportData(res.data ?? null)
    } catch {
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleCalculate = async () => {
    setCalculating(true)
    setError(null)
    setCalcMessage(null)
    try {
      const res = await apiClient.post<{
        employeeCount: number
        recordsCreated: number
      }>('/api/v1/compliance/cn/social-insurance/calculate', { year, month })
      setCalcMessage(
        `계산 완료: ${res.data?.employeeCount ?? 0}명, ${res.data?.recordsCreated ?? 0}건 생성`,
      )
      await fetchReport()
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산에 실패했습니다.')
    } finally {
      setCalculating(false)
    }
  }

  const handleExport = async () => {
    if (!reportData) return
    setExporting(true)
    try {
      // Build CSV content for download
      const headers = [
        '보험 유형',
        '직원 수',
        '총 기수 합계 (CNY)',
        '회사 부담 합계 (CNY)',
        '직원 부담 합계 (CNY)',
        '합계 (CNY)',
      ]
      const rows = reportData.rows.map((r) => [
        INSURANCE_TYPE_LABELS[r.insuranceType] ?? r.insuranceType,
        r.employeeCount,
        r.totalBaseSalary.toFixed(2),
        r.totalEmployerAmount.toFixed(2),
        r.totalEmployeeAmount.toFixed(2),
        r.totalAmount.toFixed(2),
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.join(',')),
        '',
        `회사 부담 합계,,,${reportData.summary.grandTotalEmployer.toFixed(2)},,`,
        `직원 부담 합계,,,,${reportData.summary.grandTotalEmployee.toFixed(2)},`,
        `총 합계,,,,,${reportData.summary.grandTotal.toFixed(2)}`,
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = reportData.meta.filename.replace('.xlsx', '.csv')
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">월간 사회보험 보고서</h2>
          <p className="text-xs text-slate-500 mt-0.5">월별 五险一金 납부 내역을 확인합니다</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-5 p-4 bg-slate-50 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">연도</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">월</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calculator className="w-4 h-4" />
          {calculating ? '계산 중...' : '월간 보험 계산'}
        </button>
        {reportData && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? '내보내는 중...' : '보고서 내보내기'}
          </button>
        )}
      </div>

      {/* Status Messages */}
      {calcMessage && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
          {calcMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Report Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading...</div>
      ) : !reportData || reportData.rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          {year}년 {month}월 데이터가 없습니다. 계산 버튼을 눌러 데이터를 생성하세요.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">보험 유형</th>
                  <th className="px-4 py-3 text-right">직원 수</th>
                  <th className="px-4 py-3 text-right">총 기수</th>
                  <th className="px-4 py-3 text-right">회사 부담</th>
                  <th className="px-4 py-3 text-right">직원 부담</th>
                  <th className="px-4 py-3 text-right">합계</th>
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row) => (
                  <tr
                    key={row.insuranceType}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {INSURANCE_TYPE_LABELS[row.insuranceType] ?? row.insuranceType}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.employeeCount.toLocaleString()}명
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCNY(row.totalBaseSalary)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCNY(row.totalEmployerAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCNY(row.totalEmployeeAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCNY(row.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3 text-slate-900">합계</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-slate-900">
                    {formatCNY(reportData.summary.grandTotalEmployer)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {formatCNY(reportData.summary.grandTotalEmployee)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-700">
                    {formatCNY(reportData.summary.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            생성일시: {new Date(reportData.meta.generatedAt).toLocaleString('ko-KR')}
          </p>
        </>
      )}
    </div>
  )
}
