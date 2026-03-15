import AttendanceClient from './AttendanceClient'

export default function AttendancePage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{'근태/휴가 분석'}</h1>
        <p className="text-sm text-gray-500 mt-1">{'초과근무, 52h 위반, 근태 패턴을 분석합니다.'}</p>
      </div>
      <AttendanceClient />
    </div>
  )
}
