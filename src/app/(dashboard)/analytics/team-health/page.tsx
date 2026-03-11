import TeamHealthClient from './TeamHealthClient'

export default function TeamHealthPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">팀 건강 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">직속 팀원의 초과근무, 연차, 성과, 이직 위험을 종합 분석합니다.</p>
      </div>
      <TeamHealthClient />
    </div>
  )
}
