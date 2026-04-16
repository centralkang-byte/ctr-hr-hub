'use client'

import { useTranslations } from 'next-intl'
import { Building2, Calendar, Clock } from 'lucide-react'
import { formatDate } from '@/lib/format/date'

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
  const t = useTranslations('preHire')
  const effectiveDate = futureAssignment
    ? formatDate(futureAssignment.effectiveDate)
    : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5">
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold text-foreground">
          {t('welcome', { name: userName })}
        </h1>

        {futureAssignment ? (
          <>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              {t('notYetEffective')}
            </p>
            <div className="mb-6 rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-muted-foreground">{t('effectiveDate')}</span>
                <span className="font-medium">{effectiveDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-muted-foreground">{t('affiliation')}</span>
                <span className="font-medium">
                  {futureAssignment.companyName} · {futureAssignment.departmentName}
                </span>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground/60">
              {t('comeBackOn', { date: effectiveDate ?? '' })}
            </p>
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {t('noAssignment')}
          </p>
        )}
      </div>
    </div>
  )
}
