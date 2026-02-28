'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Branding Settings Client
// 로고/파비콘 업로드, 색상 3개 입력, 미리보기
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Upload } from 'lucide-react'

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
      toast({ title: '오류', description: '브랜딩 설정을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

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
        toast({ title: '성공', description: `${type === 'logo' ? '로고' : '파비콘'}가 업로드되었습니다.` })
      } catch {
        toast({ title: '오류', description: '업로드 중 오류가 발생했습니다.', variant: 'destructive' })
      }
    }
    input.click()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/settings/branding', data)
      toast({ title: '성공', description: '브랜딩 설정이 저장되었습니다.' })
    } catch {
      toast({ title: '오류', description: '저장 중 오류가 발생했습니다.', variant: 'destructive' })
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

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="브랜딩" description="로고, 파비콘, 브랜드 색상을 관리합니다." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 로고 & 파비콘 */}
        <Card>
          <CardHeader><CardTitle className="text-lg">로고 & 파비콘</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>로고</Label>
              <div className="flex items-center gap-3">
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="로고" className="h-12 w-auto rounded border object-contain" />
                ) : (
                  <div className="flex h-12 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                    없음
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => handleUpload('logo')}>
                  <Upload className="mr-1 h-4 w-4" /> 업로드
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>파비콘</Label>
              <div className="flex items-center gap-3">
                {data.faviconUrl ? (
                  <img src={data.faviconUrl} alt="파비콘" className="h-8 w-8 rounded border object-contain" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                    없음
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => handleUpload('favicon')}>
                  <Upload className="mr-1 h-4 w-4" /> 업로드
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 색상 */}
        <Card>
          <CardHeader><CardTitle className="text-lg">브랜드 색상</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'primaryColor' as const, label: '주색상 (Primary)' },
              { key: 'secondaryColor' as const, label: '보조색상 (Secondary)' },
              { key: 'accentColor' as const, label: '강조색상 (Accent)' },
            ].map(({ key, label }) => (
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
        <CardHeader><CardTitle className="text-lg">미리보기</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <div className="h-10 w-10 rounded" style={{ backgroundColor: data.primaryColor }} />
            <div className="h-10 w-10 rounded" style={{ backgroundColor: data.secondaryColor }} />
            <div className="h-10 w-10 rounded" style={{ backgroundColor: data.accentColor }} />
            <span className="text-sm font-medium" style={{ color: data.primaryColor }}>
              CTR HR Hub 미리보기
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          저장
        </Button>
      </div>
    </div>
  )
}
