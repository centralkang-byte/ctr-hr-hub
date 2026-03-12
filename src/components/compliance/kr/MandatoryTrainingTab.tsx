'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법정의무교육 탭
// 연도 선택 + 교육 유형 카드 + 교육 추가 버튼
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Plus, BookOpen, AlertCircle, Calendar, Users, ChevronDown } from 'lucide-react'
import MandatoryTrainingForm from './MandatoryTrainingForm'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface TrainingRecord {
  id: string
  trainingType: string
  courseTitle: string
  dueDate: string
  completionRate: number
  enrolledCount: number
  totalCount: number
  year: number
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const MOCK_TRAININGS: TrainingRecord[] = [
  {
    id: '1',
    trainingType: '성희롱 예방교육',
    courseTitle: '직장 내 성희롱 예방 (2026)',
    dueDate: `${CURRENT_YEAR}-06-30`,
    completionRate: 72,
    enrolledCount: 152,
    totalCount: 208,
    year: CURRENT_YEAR,
  },
  {
    id: '2',
    trainingType: '직장 내 괴롭힘 예방교육',
    courseTitle: '직장 내 괴롭힘 방지 교육 (2026)',
    dueDate: `${CURRENT_YEAR}-06-30`,
    completionRate: 65,
    enrolledCount: 135,
    totalCount: 208,
    year: CURRENT_YEAR,
  },
  {
    id: '3',
    trainingType: '개인정보보호 교육',
    courseTitle: '개인정보 처리 및 보호 실무 (2026)',
    dueDate: `${CURRENT_YEAR}-09-30`,
    completionRate: 45,
    enrolledCount: 94,
    totalCount: 208,
    year: CURRENT_YEAR,
  },
  {
    id: '4',
    trainingType: '안전보건 교육',
    courseTitle: '산업안전보건 기초 과정 (2026)',
    dueDate: `${CURRENT_YEAR}-12-31`,
    completionRate: 30,
    enrolledCount: 62,
    totalCount: 208,
    year: CURRENT_YEAR,
  },
  {
    id: '5',
    trainingType: '장애인 인식개선 교육',
    courseTitle: '장애인식 개선 연간 교육 (2026)',
    dueDate: `${CURRENT_YEAR}-12-31`,
    completionRate: 88,
    enrolledCount: 183,
    totalCount: 208,
    year: CURRENT_YEAR,
  },
]

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function MandatoryTrainingTab() {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [trainings, setTrainings] = useState<TrainingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchTrainings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/compliance/kr/mandatory-training/status?year=${selectedYear}`)
      if (res.ok) {
        const json = await res.json()
        const list = json.data ?? json.trainings ?? json
        setTrainings(Array.isArray(list) ? list : [])
      } else {
        setTrainings(MOCK_TRAININGS.filter((t) => t.year === selectedYear))
      }
    } catch {
      setTrainings(MOCK_TRAININGS.filter((t) => t.year === selectedYear))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrainings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear])

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">법정의무교육 현황</h2>
          <p className="text-sm text-[#666] mt-0.5">연도별 법정의무교육 이수 현황을 확인합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-2 text-sm font-medium border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C853]/10 bg-white"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
          </div>

          {/* Add Training Button */}
          <button
            onClick={() => setShowForm(true)}
            className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm transition-colors`}
          >
            <Plus className="w-4 h-4" />
            교육 추가
          </button>
        </div>
      </div>

      {/* Training Cards */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E8E8E8] p-5">
              <div className="space-y-3">
                <div className="h-4 w-32 bg-[#F5F5F5] rounded animate-pulse" />
                <div className="h-5 w-48 bg-[#F5F5F5] rounded animate-pulse" />
                <div className="h-2 w-full bg-[#F5F5F5] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : trainings.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-12 text-center">
          <BookOpen className="w-10 h-10 text-[#D4D4D4] mx-auto mb-3" />
          <p className="text-sm text-[#666]">{selectedYear}년 교육 데이터가 없습니다.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-sm text-[#00C853] hover:text-[#00A844] font-medium"
          >
            + 교육 추가하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trainings.map((training) => {
            const overdue = isOverdue(training.dueDate)
            const barWidth = Math.min(training.completionRate, 100)
            const barColor =
              training.completionRate >= 80
                ? 'bg-[#059669]'
                : training.completionRate >= 50
                ? 'bg-[#00C853]'
                : overdue
                ? 'bg-[#EF4444]'
                : 'bg-[#F59E0B]'

            return (
              <div
                key={training.id}
                className="bg-white rounded-xl border border-[#E8E8E8] p-5 hover:transition-shadow"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#00A844] border border-[#E8F5E9]">
                      {training.trainingType}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
                        <AlertCircle className="w-3 h-3" />
                        기한 초과
                      </span>
                    )}
                  </div>
                </div>

                {/* Course title */}
                <h3 className="text-base font-semibold text-[#1A1A1A] mt-2 mb-3">
                  {training.courseTitle}
                </h3>

                {/* Meta info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-[#666]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>마감: {formatDate(training.dueDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#666]">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {training.enrolledCount}/{training.totalCount}명
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#666]">이수율</span>
                    <span
                      className={`text-xs font-semibold ${
                        training.completionRate >= 80
                          ? 'text-[#047857]'
                          : overdue
                          ? 'text-[#B91C1C]'
                          : 'text-[#333]'
                      }`}
                    >
                      {training.completionRate}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#F5F5F5]">
                    <div
                      className={`h-2 rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Training Modal */}
      {showForm && (
        <MandatoryTrainingForm
          defaultYear={selectedYear}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchTrainings()
          }}
        />
      )}
    </div>
  )
}
