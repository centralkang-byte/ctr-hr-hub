import TurnoverClient from './TurnoverClient'

export default function TurnoverPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">이직 분석</h1>
        <p className="text-sm text-gray-500 mt-1">이직률 추이, 사유 분석, 핵심 인재 이탈 현황을 파악합니다.</p>
      </div>
      <TurnoverClient />
    </div>
  )
}
