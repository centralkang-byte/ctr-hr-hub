'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Company Settings Client
// 회사설정: coreValues, 회계연도, 수습기간, 초과근무, 타임존, 로케일
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, Trash2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────

interface CoreValue {
  key: string
  label: string
  icon?: string
  color?: string
}

interface CompanySettings {
  coreValues: CoreValue[]
  fiscalYearStartMonth: number
  probationMonths: number
  maxOvertimeWeeklyHours: number
  timezone: string
  defaultLocale: string
}

// ─── Form schema ────────────────────────────────────────

const formSchema = z.object({
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  probationMonths: z.number().int().min(0).max(24),
  maxOvertimeWeeklyHours: z.number().min(0).max(168),
  timezone: z.string().min(1),
  defaultLocale: z.string().min(2),
})

type FormData = z.infer<typeof formSchema>

const TIMEZONES = [
  'Asia/Seoul', 'Asia/Shanghai', 'Asia/Ho_Chi_Minh', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Mexico_City',
]

const LOCALES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
]

// ─── Component ──────────────────────────────────────────

export function CompanySettingsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [coreValues, setCoreValues] = useState<CoreValue[]>([])

  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: t('monthUnit', { month: i + 1 }),
  }))

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<CompanySettings>('/api/v1/settings/company')
      const data = res.data
      reset({
        fiscalYearStartMonth: data.fiscalYearStartMonth,
        probationMonths: data.probationMonths,
        maxOvertimeWeeklyHours: data.maxOvertimeWeeklyHours,
        timezone: data.timezone,
        defaultLocale: data.defaultLocale,
      })
      setCoreValues(data.coreValues as CoreValue[] ?? [])
    } catch {
      toast({ title: tc('error'), description: t('settingsLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [reset, toast, t, tc])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const onSubmit = async (formData: FormData) => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/settings/company', {
        ...formData,
        coreValues,
      })
      toast({ title: tc('success'), description: t('settingsSaved') })
    } catch {
      toast({ title: tc('error'), description: t('saveError'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const addCoreValue = () => {
    setCoreValues((prev) => [...prev, { key: '', label: '', color: '#2563EB' }])
  }

  const removeCoreValue = (index: number) => {
    setCoreValues((prev) => prev.filter((_, i) => i !== index))
  }

  const updateCoreValue = (index: number, field: keyof CoreValue, value: string) => {
    setCoreValues((prev) => prev.map((cv, i) => i === index ? { ...cv, [field]: value } : cv))
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={t('companySettings')} description={t('companySettingsDesc')} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 기본 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('basicSettings')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStartMonth">{t('fiscalYearStartMonth')}</Label>
              <Select
                value={String(watch('fiscalYearStartMonth') ?? '1')}
                onValueChange={(v) => setValue('fiscalYearStartMonth', Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fiscalYearStartMonth && <p className="text-xs text-destructive">{errors.fiscalYearStartMonth.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="probationMonths">{t('probationMonths')}</Label>
              <Input type="number" {...register('probationMonths')} />
              {errors.probationMonths && <p className="text-xs text-destructive">{errors.probationMonths.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxOvertimeWeeklyHours">{t('maxOvertimeWeeklyHours')}</Label>
              <Input type="number" step="0.5" {...register('maxOvertimeWeeklyHours')} />
              {errors.maxOvertimeWeeklyHours && <p className="text-xs text-destructive">{errors.maxOvertimeWeeklyHours.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">{t('timezone')}</Label>
              <Select
                value={watch('timezone') ?? 'Asia/Seoul'}
                onValueChange={(v) => setValue('timezone', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultLocale">{t('defaultLocale')}</Label>
              <Select
                value={watch('defaultLocale') ?? 'ko'}
                onValueChange={(v) => setValue('defaultLocale', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 핵심가치 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('coreValues')}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addCoreValue}>
                <Plus className="mr-1 h-4 w-4" /> {tc('add')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {coreValues.map((cv, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input
                  placeholder={t('coreValueKeyPlaceholder')}
                  value={cv.key}
                  onChange={(e) => updateCoreValue(i, 'key', e.target.value)}
                  className="w-32"
                />
                <Input
                  placeholder={t('coreValueLabelPlaceholder')}
                  value={cv.label}
                  onChange={(e) => updateCoreValue(i, 'label', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="color"
                  value={cv.color ?? '#2563EB'}
                  onChange={(e) => updateCoreValue(i, 'color', e.target.value)}
                  className="h-9 w-14 p-1"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCoreValue(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {coreValues.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noCoreValues')}</p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {tc('save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
