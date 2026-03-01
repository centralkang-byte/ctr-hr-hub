'use client'

import { useTranslations } from 'next-intl'
import { CONTRACT_RULES } from '@/lib/contract/rules'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function ContractRulesClient() {
  const t = useTranslations('contractRules')

  const COUNTRY_NAMES: Record<string, string> = {
    KR: t('countryKR'),
    CN: t('countryCN'),
    RU: t('countryRU'),
    VN: t('countryVN'),
    MX: t('countryMX'),
    US: t('countryUS'),
    PL: t('countryPL'),
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="text-sm text-gray-500">
        {t('description')}
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
                <span className="text-gray-500">{t('maxFixedTermCount')}</span>
                <span className="font-medium">
                  {rule.max_fixed_term_count === 0
                    ? t('unlimited')
                    : t('countSuffix', { count: rule.max_fixed_term_count })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('maxFixedTermMonths')}</span>
                <span className="font-medium">
                  {rule.max_fixed_term_months === 0
                    ? t('unlimited')
                    : t('monthsSuffix', { months: rule.max_fixed_term_months })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('probationPeriod')}</span>
                <span className="font-medium">
                  {rule.probation_range.min_days === rule.probation_range.max_days
                    ? t('daysSuffix', { days: rule.probation_range.min_days })
                    : t('daysRange', { min: rule.probation_range.min_days, max: rule.probation_range.max_days })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('autoConvert')}</span>
                <span className={rule.auto_convert_to_permanent ? 'font-medium text-green-600' : 'font-medium text-gray-400'}>
                  {rule.auto_convert_to_permanent ? t('applied') : t('notApplied')}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
