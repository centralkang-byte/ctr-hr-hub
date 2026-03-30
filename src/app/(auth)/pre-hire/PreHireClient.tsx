'use client'

import { Building2, Calendar, Clock } from 'lucide-react'

interface Props {
  userName: string
  futureAssignment: {
    effectiveDate: string
    companyName: string
    departmentName: string
    positionTitle: string
  } | null
}

export default function PreHireClient({ userName, futureAssignment }: Props) {
  const effectiveDate = futureAssignment
    ? new Date(futureAssignment.effectiveDate).toLocaleDateString('ko-KR')
    : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold text-gray-900">
          {userName}님, 환영합니다
        </h1>

        {futureAssignment ? (
          <>
            <p className="mb-6 text-center text-sm text-gray-500">
              발령일이 도래하지 않았습니다.
            </p>
            <div className="mb-6 rounded-lg bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">발령일:</span>
                <span className="font-medium">{effectiveDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">소속:</span>
                <span className="font-medium">
                  {futureAssignment.companyName} · {futureAssignment.departmentName}
                </span>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400">
              {effectiveDate}에 다시 접근해 주세요.
            </p>
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">
            발령 정보가 없습니다. 관리자에게 문의해 주세요.
          </p>
        )}
      </div>
    </div>
  )
}
