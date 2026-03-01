'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법정의무교육 탭
// 연도 선택 + 교육 유형 카드 + 교육 추가 버튼
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Plus, BookOpen, AlertCircle, Calendar, Users, ChevronDown } from 'lucide-react'
import MandatoryTrainingForm from './MandatoryTrainingForm'

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
        const data = await res.json()
        setTrainings(data.trainings ?? data)
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
          <h2 className="text-lg font-semibold text-slate-900">법정의무교육 현황</h2>
          <p className="text-sm text-slate-500 mt-0.5">연도별 법정의무교육 이수 현황을 확인합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-2 text-sm font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Add Training Button */}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
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
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="space-y-3">
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
                <div className="h-2 w-full bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : trainings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{selectedYear}년 교육 데이터가 없습니다.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                ? 'bg-emerald-500'
                : training.completionRate >= 50
                ? 'bg-blue-600'
                : overdue
                ? 'bg-red-500'
                : 'bg-amber-500'

            return (
              <div
                key={training.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {training.trainingType}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        <AlertCircle className="w-3 h-3" />
                        기한 초과
                      </span>
                    )}
                  </div>
                </div>

                {/* Course title */}
                <h3 className="text-base font-semibold text-slate-900 mt-2 mb-3">
                  {training.courseTitle}
                </h3>

                {/* Meta info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>마감: {formatDate(training.dueDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {training.enrolledCount}/{training.totalCount}명
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">이수율</span>
                    <span
                      className={`text-xs font-semibold ${
                        training.completionRate >= 80
                          ? 'text-emerald-700'
                          : overdue
                          ? 'text-red-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {training.completionRate}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
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
