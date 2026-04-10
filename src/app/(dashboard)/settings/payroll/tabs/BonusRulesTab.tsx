'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS,  FORM_STYLES, TABLE_STYLES } from '@/lib/styles'

interface Props { companyId: string | null }

interface BonusSettings {
  gradeMultipliers: Array<{ grade: string; label: string; multiplier: number }>
  bonusType: 'MONTHLY_SALARY' | 'ANNUAL_SALARY' | 'FIXED_AMOUNT'
  maxMultiplier: number
}

const DEFAULTS: BonusSettings = {
  gradeMultipliers: [
    { grade: 'O', label: '탁월', multiplier: 200 },
    { grade: 'E', label: '우수', multiplier: 150 },
    { grade: 'M', label: '평균', multiplier: 100 },
    { grade: 'S', label: '미흡', multiplier: 0 },
  ],
  bonusType: 'MONTHLY_SALARY',
  maxMultiplier: 300,
}

export function BonusRulesTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [settings, setSettings] = useState<BonusSettings>(() => structuredClone(DEFAULTS))
  const [original, setOriginal] = useState<BonusSettings>(() => structuredClone(DEFAULTS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOverridden, setIsOverridden] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const qs = companyId ? `?key=bonus-rules&companyId=${companyId}` : '?key=bonus-rules'
      const res = await apiClient.get(`/api/v1/process-settings/compensation${qs}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (res as any)?.data ?? res ?? []
      const setting = Array.isArray(items) ? items[0] : null

      if (setting?.settingValue) {
        const sv = setting.settingValue as BonusSettings
        setIsOverridden(!!setting.isOverridden)
        const merged: BonusSettings = {
          gradeMultipliers: sv.gradeMultipliers ?? DEFAULTS.gradeMultipliers,
          bonusType: sv.bonusType ?? DEFAULTS.bonusType,
          maxMultiplier: sv.maxMultiplier ?? DEFAULTS.maxMultiplier,
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
      await apiClient.put('/api/v1/process-settings/compensation', {
        key: 'bonus-rules',
        value: settings,
        companyId: companyId ?? undefined,
        description: t('bonusRules.description'),
      })
      toast({ title: t('savedSuccess'), description: t('bonusRules.updateSuccess') })
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
          <h3 className="text-base font-semibold text-foreground">{t('bonusRules.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('bonusRules.subtitle')}</p>
        </div>
        {isOverridden && (
          <Badge variant="warning">{t('company_kec98a4eb')}</Badge>
        )}
      </div>

      <SettingFieldWithOverride label={t('bonusRules.basisLabel')} description={t('bonusRules.basisDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className={FORM_STYLES.select} value={settings.bonusType} onChange={(e) => setSettings((p) => ({ ...p, bonusType: e.target.value as BonusSettings['bonusType'] }))}>
          <option value="MONTHLY_SALARY">{t('bonusRules.monthlySalary')}</option>
          <option value="ANNUAL_SALARY">{t('bonusRules.annualSalary')}</option>
          <option value="FIXED_AMOUNT">{t('bonusRules.fixedAmount')}</option>
        </select>
      </SettingFieldWithOverride>

      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead className={TABLE_STYLES.header}><tr>
            <th className={TABLE_STYLES.headerCell}>{t('bonusRules.colGrade')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('bonusRules.colLabel')}</th>
            <th className={TABLE_STYLES.headerCellRight}>{t('bonusRules.colMultiplier')}</th>
          </tr></thead>
          <tbody>{settings.gradeMultipliers.map((g, i) => (
            <tr key={g.grade} className={TABLE_STYLES.row}>
              <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{g.grade}</td>
              <td className={TABLE_STYLES.cell}>{g.label}</td>
              <td className={`${TABLE_STYLES.cell} text-right`}><Input type="number" value={g.multiplier} onChange={(e) => { const next = structuredClone(settings); next.gradeMultipliers[i].multiplier = Number(e.target.value); setSettings(next) }} className="ml-auto w-24 text-right" /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

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
