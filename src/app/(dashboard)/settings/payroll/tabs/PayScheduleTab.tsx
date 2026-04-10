'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS,  FORM_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

interface PayScheduleSettings {
  payDay: number
  cutoffDay: number
  paymentMethod: 'BANK_TRANSFER' | 'CHECK'
}

const DEFAULTS: PayScheduleSettings = { payDay: 25, cutoffDay: 20, paymentMethod: 'BANK_TRANSFER' }

export function PayScheduleTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [settings, setSettings] = useState<PayScheduleSettings>(() => structuredClone(DEFAULTS))
  const [original, setOriginal] = useState<PayScheduleSettings>(() => structuredClone(DEFAULTS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOverridden, setIsOverridden] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const qs = companyId ? `?key=pay-schedule&companyId=${companyId}` : '?key=pay-schedule'
      const res = await apiClient.get(`/api/v1/process-settings/payroll${qs}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (res as any)?.data ?? res ?? []
      const setting = Array.isArray(items) ? items[0] : null

      if (setting?.settingValue) {
        const sv = setting.settingValue as Record<string, unknown>
        setIsOverridden(!!setting.isOverridden)
        const merged: PayScheduleSettings = {
          payDay: (sv.payDay as number) ?? DEFAULTS.payDay,
          cutoffDay: (sv.closingDay as number) ?? (sv.cutoffDay as number) ?? DEFAULTS.cutoffDay,
          paymentMethod: (sv.paymentMethod as PayScheduleSettings['paymentMethod']) ?? DEFAULTS.paymentMethod,
        }
        setSettings(structuredClone(merged))
        setOriginal(structuredClone(merged))
      } else {
        setSettings(structuredClone(DEFAULTS))
        setOriginal(structuredClone(DEFAULTS))
      }
    } catch {
      setSettings(structuredClone(DEFAULTS))
      setOriginal(structuredClone(DEFAULTS))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/process-settings/payroll', {
        key: 'pay-schedule',
        value: { payDay: settings.payDay, closingDay: settings.cutoffDay, paymentMethod: settings.paymentMethod },
        companyId: companyId ?? undefined,
        description: t('kr_keab889ec_keca780ea_keba788ea_'),
      })
      toast({ title: t('savedSuccess'), description: t('paySchedule_kec9db4_kec9785eb') })
      setOriginal(structuredClone(settings))
    } catch {
      toast({ title: t('saveFailed'), description: t('retry_ked95b4_keca3bcec'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    setSettings(structuredClone(original))
    toast({ title: t('changeCancelled') })
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original)

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('kr_keab889ec')}</h3>
          <p className="text-sm text-muted-foreground">{t('kr_keba7a4ec_keab889ec_keca780ea_')}</p>
        </div>
        {isOverridden && (
          <Badge variant="warning">{t('company_kec98a4eb')}</Badge>
        )}
      </div>

      <SettingFieldWithOverride label={t('paySchedule.payDayLabel')} description={t('paySchedule.payDayDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('kr_keba7a4ec')}</span>
          <Input type="number" value={settings.payDay} min={1} max={31} onChange={(e) => setSettings((p) => ({ ...p, payDay: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('kr_kec9dbc')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('paySchedule.cutoffLabel')} description={t('paySchedule.cutoffDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('kr_keba7a4ec')}</span>
          <Input type="number" value={settings.cutoffDay} min={1} max={31} onChange={(e) => setSettings((p) => ({ ...p, cutoffDay: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('kr_kec9dbc')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('paySchedule.methodLabel')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className={FORM_STYLES.select} value={settings.paymentMethod} onChange={(e) => setSettings((p) => ({ ...p, paymentMethod: e.target.value as PayScheduleSettings['paymentMethod'] }))}>
          <option value="BANK_TRANSFER">{t('kr_keab384ec')}</option>
          <option value="CHECK">{t('kr_kec8898ed')}</option>
        </select>
      </SettingFieldWithOverride>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleRevert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />{t('kr_keb9098eb')}
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t('save')}
        </Button>
      </div>
    </div>
  )
}
