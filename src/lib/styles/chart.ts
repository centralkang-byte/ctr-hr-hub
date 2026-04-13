// DESIGN.md Section 1 — Chart Palette (6색: Violet, Violet-light, Green, Amber, Red, Slate)
// 10색 확장: Purple, Sky, Lime, Orange (법인 비교 등 6색 초과 시)

export const CHART_THEME = {
  colors: ['#6366f1', '#a5b4fc', '#16a34a', '#f59e0b', '#e11d48', '#64748b'],
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
  colors: ['#818CF8', '#c7d2fe', '#4ade80', '#fbbf24', '#fb7185', '#94A3B8'],
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

/** 10색 확장 팔레트 — 법인 비교 등 6색 초과 시 CHART_THEME.colors 뒤에 이어서 사용 */
export const CHART_COLORS_EXTENDED = [
  '#7c3aed', '#0ea5e9', '#84cc16', '#f97316',
] as const

/** Risk-level semantic colors — attrition, predictive, succession 차트용
 *  Severity 순: low(green) → medium(amber) → high(orange) → critical(red) */
export const RISK_COLORS = {
  low: '#16a34a',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#e11d48',
} as const

/** Heatmap 시맨틱 스펙트럼: Green(낮음/좋음) → Amber(중간) → Red(높음/나쁨) */
export const HEATMAP_COLORS = {
  scale: [
    'rgba(22,163,74,0.1)', 'rgba(22,163,74,0.2)', 'rgba(22,163,74,0.3)',
    'rgba(245,158,11,0.2)', 'rgba(245,158,11,0.4)',
    'rgba(225,29,72,0.2)', 'rgba(225,29,72,0.4)',
  ] as const,
  text: { low: '#16a34a', mid: '#b45309', high: '#e11d48' },
} as const
