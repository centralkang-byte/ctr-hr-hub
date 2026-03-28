// DESIGN.md Section 2 — Chart Palette (6색 순서: Indigo, Violet, Emerald, Amber, Red, Slate)

export const CHART_THEME = {
  colors: ['#4F46E5', '#8B5CF6', '#059669', '#D97706', '#DC2626', '#64748B'],
  axis: {
    stroke: '#E2E8F0',
    tick: { fontSize: 12, fill: '#64748B' },
    label: { fontSize: 13, fill: '#334155', fontWeight: 500 },
  },
  grid: { stroke: '#F1F5F9', strokeDasharray: '3 3' },
  tooltip: {
    contentStyle: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
      padding: '12px 16px',
      fontSize: '13px',
    },
    labelStyle: { fontWeight: 600, marginBottom: '4px' },
  },
  legend: { wrapperStyle: { paddingTop: '16px', fontSize: '13px' } },
  responsive: { width: '100%', height: 320 },
} as const

// Dark mode variant — DESIGN.md: fg=400 level, bg=900 level, WCAG AA 4.5:1 대비
export const CHART_THEME_DARK = {
  colors: ['#818CF8', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#94A3B8'],
  axis: {
    stroke: '#334155',
    tick: { fontSize: 12, fill: '#94A3B8' },
    label: { fontSize: 13, fill: '#CBD5E1', fontWeight: 500 },
  },
  grid: { stroke: '#1E293B', strokeDasharray: '3 3' },
  tooltip: {
    contentStyle: {
      backgroundColor: '#1E293B',
      border: '1px solid #334155',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      padding: '12px 16px',
      fontSize: '13px',
      color: '#E2E8F0',
    },
    labelStyle: { fontWeight: 600, marginBottom: '4px', color: '#F1F5F9' },
  },
  legend: { wrapperStyle: { paddingTop: '16px', fontSize: '13px', color: '#CBD5E1' } },
  responsive: { width: '100%', height: 320 },
} as const
