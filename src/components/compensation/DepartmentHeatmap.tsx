'use client'

interface DeptHeatmapItem {
  departmentId: string
  departmentName: string
  avgScore: number
  highRiskCount: number
  totalCount: number
}

interface DepartmentHeatmapProps {
  departments: DeptHeatmapItem[]
}

function getHeatColor(score: number): string {
  if (score >= 70) return 'bg-red-200 text-red-900'
  if (score >= 50) return 'bg-orange-100 text-orange-900'
  if (score >= 35) return 'bg-amber-50 text-amber-900'
  return 'bg-emerald-50 text-emerald-900'
}

export default function DepartmentHeatmap({ departments }: DepartmentHeatmapProps) {
  const sorted = [...departments].sort((a, b) => b.avgScore - a.avgScore)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">부서별 이탈 위험</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sorted.map((dept) => (
          <div
            key={dept.departmentId}
            className={`rounded-lg p-4 ${getHeatColor(dept.avgScore)}`}
          >
            <p className="text-sm font-medium truncate">{dept.departmentName}</p>
            <p className="text-2xl font-bold mt-1">{Math.round(dept.avgScore)}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs">
                {dept.totalCount}명 중 고위험 {dept.highRiskCount}명
              </span>
            </div>
          </div>
        ))}
      </div>
      {departments.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">데이터가 없습니다.</p>
      )}
    </div>
  )
}
