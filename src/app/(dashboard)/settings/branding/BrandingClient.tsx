'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Branding Settings Client
// 로고/파비콘 업로드, 색상 3개 입력, 미리보기
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

interface BrandingData {
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
}

export function BrandingClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<BrandingData>({
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#1B3A5C',
    secondaryColor: '#4A90D9',
    accentColor: '#F5A623',
  })

  const fetchBranding = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<BrandingData>('/api/v1/settings/branding')
      setData(res.data)
    } catch {
      toast({ title: tc('error'), description: t('brandingLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, t, tc])

  useEffect(() => { fetchBranding() }, [fetchBranding])

  const handleUpload = async (type: 'logo' | 'favicon') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const res = await apiClient.post<{ uploadUrl: string; publicUrl: string }>(
          '/api/v1/settings/branding/upload',
          { entityType: type, filename: file.name, contentType: file.type },
        )
        const { uploadUrl, publicUrl } = res.data

        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        const field = type === 'logo' ? 'logoUrl' : 'faviconUrl'
        setData((prev) => ({ ...prev, [field]: publicUrl }))
        toast({ title: tc('success'), description: type === 'logo' ? t('logoUploaded') : t('faviconUploaded') })
      } catch {
        toast({ title: tc('error'), description: t('uploadError'), variant: 'destructive' })
      }
    }
    input.click()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/settings/branding', data)
      toast({ title: tc('success'), description: t('brandingSaved') })
    } catch {
      toast({ title: tc('error'), description: t('saveError'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const COLOR_FIELDS = [
    { key: 'primaryColor' as const, label: t('primaryColor') },
    { key: 'secondaryColor' as const, label: t('secondaryColor') },
    { key: 'accentColor' as const, label: t('accentColor') },
  ]

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={t('branding')} description={t('brandingDesc')} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 로고 & 파비콘 */}
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('logoAndFavicon')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('logo')}</Label>
              <div className="flex items-center gap-3">
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt={t('logo')} className="h-12 w-auto rounded border object-contain" />
                ) : (
                  <div className="flex h-12 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                    {t('none')}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => handleUpload('logo')}>
                  <Upload className="mr-1 h-4 w-4" /> {tc('upload')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('favicon')}</Label>
              <div className="flex items-center gap-3">
                {data.faviconUrl ? (
                  <img src={data.faviconUrl} alt={t('favicon')} className="h-8 w-8 rounded border object-contain" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                    {t('none')}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => handleUpload('favicon')}>
                  <Upload className="mr-1 h-4 w-4" /> {tc('upload')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 색상 */}
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('brandColors')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {COLOR_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={data[key]}
                    onChange={(e) => setData((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-9 w-14 p-1"
                  />
                  <Input
                    value={data[key]}
                    onChange={(e) => setData((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-28 font-mono text-sm"
                    maxLength={7}
                  />
                  <div className="h-9 w-20 rounded" style={{ backgroundColor: data[key] }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 미리보기 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{tc('preview')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <div className="h-10 w-10 rounded" style={{ backgroundColor: data.primaryColor }} />
            <div className="h-10 w-10 rounded" style={{ backgroundColor: data.secondaryColor }} />
            <div className="h-10 w-10 rounded" style={{ backgroundColor: data.accentColor }} />
            <span className="text-sm font-medium" style={{ color: data.primaryColor }}>
              {t('brandingPreviewText')}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {tc('save')}
        </Button>
      </div>
    </div>
  )
}
