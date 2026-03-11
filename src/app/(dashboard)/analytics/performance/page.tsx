import PerformanceClient from './PerformanceClient'

export default function PerformancePage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">성과 분석</h1>
        <p className="text-sm text-gray-500 mt-1">성과 사이클 진행과 등급 분포를 분석합니다.</p>
      </div>
      <PerformanceClient />
    </div>
  )
}
