import ExecutiveSummaryClient from './ExecutiveSummaryClient'

export default function AnalyticsPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Executive Summary</h1>
        <p className="text-sm text-gray-500 mt-1">{'전사 인사 현황을 한눈에 파악하고 효율적으로 관리합니다.'}</p>
      </div>
      <ExecutiveSummaryClient />
    </div>
  )
}
