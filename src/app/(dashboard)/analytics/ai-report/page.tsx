import AiReportClient from './AiReportClient'

export default function AiReportPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 월간 리포트</h1>
        <p className="text-sm text-gray-500 mt-1">AI가 분석한 인사 현황 보고서를 확인합니다.</p>
      </div>
      <AiReportClient />
    </div>
  )
}
