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
  if (score >= 70) return 'bg-[#FECACA] text-[#7F1D1D]'
  if (score >= 50) return 'bg-[#FFEDD5] text-[#7C2D12]'
  if (score >= 35) return 'bg-[#FEF3C7] text-[#78350F]'
  return 'bg-[#D1FAE5] text-[#064E3B]'
}

export default function DepartmentHeatmap({ departments }: DepartmentHeatmapProps) {
  const sorted = [...departments].sort((a, b) => b.avgScore - a.avgScore)

  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">부서별 이탈 위험</h3>
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
        <p className="text-sm text-[#999] text-center py-8">데이터가 없습니다.</p>
      )}
    </div>
  )
}
