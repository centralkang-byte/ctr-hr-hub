'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GitBranch, ExternalLink, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'

interface DottedLineEmployee {
  id: string
  name: string
  companyName: string
  companyCode: string
  companyId: string
  positionTitle: string
  relationship: 'DOTTED_LINE' | 'SECONDARY_REPORT'
}

interface DottedLineResponse {
  employees: DottedLineEmployee[]
  callerCompanyId: string
}

export function DottedLineReportsCard() {
  const [data, setData] = useState<DottedLineResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<DottedLineResponse>('/api/v1/manager-hub/dotted-line-reports')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const employees = data?.employees ?? []
  const callerCompanyId = data?.callerCompanyId ?? ''

  // Hide entirely when no dotted line reports
  if (!loading && employees.length === 0) return null

  // v2: Show cross-company notice only when at least one employee is from another company
  const hasCrossCompany = employees.some((e) => e.companyId !== callerCompanyId)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-ctr-gray-700">
            <GitBranch className="mr-2 inline-block h-4 w-4" />
            점선 보고 직원 (Matrix Reports)
          </CardTitle>
          {!loading && (
            <Badge variant="secondary" className="text-xs">
              {employees.length}명
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-center text-sm text-ctr-gray-500">
            불러오는 중...
          </p>
        ) : (
          <>
            <div className="divide-y">
              {employees.map((emp) => {
                const isCrossCompany = emp.companyId !== callerCompanyId
                return (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDF1FE] text-xs font-medium text-ctr-primary">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-ctr-gray-900">
                            {emp.name}
                          </p>
                          {isCrossCompany && (
                            <Badge
                              variant="outline"
                              className="px-1 py-0 text-[10px]"
                            >
                              타 법인
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-ctr-gray-500">
                          {emp.companyName} · {emp.positionTitle}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/employees/${emp.id}`}
                      className="flex items-center gap-1 text-xs text-ctr-primary hover:underline"
                      aria-label={`${emp.name} 프로필 조회`}
                    >
                      조회
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )
              })}
            </div>
            {hasCrossCompany && (
              <div className="mt-3 flex items-start gap-1.5 rounded-md bg-[#F8FAFC] p-2">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-ctr-gray-400" />
                <p className="text-xs text-ctr-gray-500">
                  타 법인 점선 보고 직원은 조회만 가능합니다.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
