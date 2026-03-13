export const CHART_THEME = {
  colors: ['#4F46E5', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#6B7280'],
  axis: {
    stroke: '#E5E7EB',
    tick: { fontSize: 12, fill: '#6B7280' },
    label: { fontSize: 13, fill: '#374151', fontWeight: 500 },
  },
  grid: { stroke: '#F3F4F6', strokeDasharray: '3 3' },
  tooltip: {
    contentStyle: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      padding: '12px 16px',
      fontSize: '13px',
    },
    labelStyle: { fontWeight: 600, marginBottom: '4px' },
  },
  legend: { wrapperStyle: { paddingTop: '16px', fontSize: '13px' } },
  responsive: { width: '100%', height: 320 },
} as const
