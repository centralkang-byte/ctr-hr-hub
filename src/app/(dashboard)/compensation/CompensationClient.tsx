'use client'

import { useState, useCallback, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calculator, CheckCircle2, BarChart3 } from 'lucide-react'
import SimulationTab from '@/components/compensation/SimulationTab'
import ConfirmTab from '@/components/compensation/ConfirmTab'
import HistoryTab from '@/components/compensation/HistoryTab'
import { apiClient } from '@/lib/api'

interface CycleOption {
  id: string
  name: string
  year: number
}

export default function CompensationClient() {
  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [activeTab, setActiveTab] = useState('simulation')

  // ─── pendingAdjustments: 시뮬레이션에서 설정 → 확정 탭으로 전달
  const [pendingAdjustments, setPendingAdjustments] = useState<
    Array<{
      employeeId: string
      employeeName: string
      department: string
      currentSalary: number
      newSalary: number
      changePct: number
    }>
  >([])

  const fetchCycles = useCallback(async () => {
    try {
      const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', {
        limit: 50,
      })
      setCycles(res.data)
      if (res.data.length > 0 && !selectedCycleId) {
        setSelectedCycleId(res.data[0].id)
      }
    } catch {
      // ignore
    }
  }, [selectedCycleId])

  useEffect(() => {
    fetchCycles()
  }, [fetchCycles])

  const handleConfirmDone = useCallback(() => {
    setPendingAdjustments([])
    setActiveTab('history')
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-slate-400 mb-1">설정 / 보상</nav>
          <h1 className="text-2xl font-bold text-slate-900">연봉 조정</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">평가 사이클:</label>
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.year})
              </option>
            ))}
            {cycles.length === 0 && <option value="">사이클 없음</option>}
          </select>
        </div>
      </div>

      {/* ─── 탭 ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="simulation">
            <Calculator className="mr-1.5 h-4 w-4" />
            시뮬레이션
          </TabsTrigger>
          <TabsTrigger value="confirm">
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            확정
            {pendingAdjustments.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                {pendingAdjustments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            이력/분석
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulation" className="mt-0">
          <SimulationTab
            cycleId={selectedCycleId}
            onPrepareConfirm={(adjustments) => {
              setPendingAdjustments(adjustments)
              setActiveTab('confirm')
            }}
          />
        </TabsContent>

        <TabsContent value="confirm" className="mt-0">
          <ConfirmTab
            cycleId={selectedCycleId}
            adjustments={pendingAdjustments}
            onConfirmDone={handleConfirmDone}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
