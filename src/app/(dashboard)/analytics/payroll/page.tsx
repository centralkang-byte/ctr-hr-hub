import PayrollClient from './PayrollClient'

export default function PayrollPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">급여 분석</h1>
        <p className="text-sm text-gray-500 mt-1">인건비 추이와 법인별 비교를 분석합니다.</p>
      </div>
      <PayrollClient />
    </div>
  )
}
