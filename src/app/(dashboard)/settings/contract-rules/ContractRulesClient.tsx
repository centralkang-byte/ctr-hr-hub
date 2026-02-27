'use client'

import { CONTRACT_RULES } from '@/lib/contract/rules'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const COUNTRY_NAMES: Record<string, string> = {
  KR: '대한민국',
  CN: '중국',
  RU: '러시아',
  VN: '베트남',
  MX: '멕시코',
  US: '미국',
  PL: '폴란드',
}

export default function ContractRulesClient() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">국가별 계약 규칙</h2>
      <p className="text-sm text-gray-500">
        각 국가의 노동법에 따른 계약 자동 전환 규칙입니다.
        실제 법률 적용 시 법무 검토를 거치시기 바랍니다.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(CONTRACT_RULES).map(([code, rule]) => (
          <Card key={code} className="border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{COUNTRY_NAMES[code] ?? code}</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {code}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">계약 최대 횟수</span>
                <span className="font-medium">
                  {rule.max_fixed_term_count === 0 ? '무제한' : `${rule.max_fixed_term_count}회`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">최대 계약 기간</span>
                <span className="font-medium">
                  {rule.max_fixed_term_months === 0 ? '무제한' : `${rule.max_fixed_term_months}개월`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">수습 기간</span>
                <span className="font-medium">
                  {rule.probation_range.min_days === rule.probation_range.max_days
                    ? `${rule.probation_range.min_days}일`
                    : `${rule.probation_range.min_days}~${rule.probation_range.max_days}일`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">자동 정규직 전환</span>
                <span className={rule.auto_convert_to_permanent ? 'font-medium text-green-600' : 'font-medium text-gray-400'}>
                  {rule.auto_convert_to_permanent ? '적용' : '미적용'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
