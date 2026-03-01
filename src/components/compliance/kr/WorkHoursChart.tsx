'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 근무시간 분포 차트
// 준수/주의/위반 상태 바 시각화
// ═══════════════════════════════════════════════════════════

interface WorkHoursChartProps {
  compliantCount: number
  warningCount: number
  violationCount: number
}

export default function WorkHoursChart({
  compliantCount,
  warningCount,
  violationCount,
}: WorkHoursChartProps) {
  const total = compliantCount + warningCount + violationCount
  if (total === 0) return null

  const compliantPct = Math.round((compliantCount / total) * 100)
  const warningPct = Math.round((warningCount / total) * 100)
  const violationPct = 100 - compliantPct - warningPct

  const segments = [
    {
      label: '준수 (40시간 이하)',
      count: compliantCount,
      pct: compliantPct,
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      dotColor: 'bg-emerald-500',
    },
    {
      label: '주의 (40~52시간)',
      count: warningCount,
      pct: warningPct,
      barColor: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      dotColor: 'bg-amber-500',
    },
    {
      label: '위반 (52시간 초과)',
      count: violationCount,
      pct: violationPct,
      barColor: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      dotColor: 'bg-red-500',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex h-8 w-full rounded-full overflow-hidden gap-0.5">
        {segments.map((seg) =>
          seg.pct > 0 ? (
            <div
              key={seg.label}
              className={`${seg.barColor} transition-all duration-500`}
              style={{ width: `${seg.pct}%` }}
              title={`${seg.label}: ${seg.count}명 (${seg.pct}%)`}
            />
          ) : null
        )}
      </div>

      {/* Legend + detail bars */}
      <div className="space-y-3">
        {segments.map((seg) => (
          <div key={seg.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${seg.dotColor}`} />
                <span className="text-xs text-slate-600">{seg.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold ${seg.textColor}`}>{seg.count}명</span>
                <span className="text-xs text-slate-400 w-10 text-right">{seg.pct}%</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${seg.barColor} transition-all duration-500`}
                style={{ width: `${seg.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        {segments.map((seg) => (
          <span
            key={seg.label}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${seg.bgColor} ${seg.textColor} ${seg.borderColor}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${seg.dotColor}`} />
            {seg.label.split(' ')[0]}: {seg.count}명
          </span>
        ))}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
          전체: {total}명
        </span>
      </div>
    </div>
  )
}
