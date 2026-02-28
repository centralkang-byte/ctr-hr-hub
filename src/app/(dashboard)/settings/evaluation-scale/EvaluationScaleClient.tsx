'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Evaluation Scale Client
// 평가 척도: min/max, labels 배열 편집, 미리보기
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Plus, Trash2 } from 'lucide-react'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

interface EvaluationScaleData {
  ratingScaleMin: number
  ratingScaleMax: number
  ratingLabels: string[]
  gradeLabels: Record<string, string>
}

const DEFAULT_GRADES = ['S', 'A', 'B', 'C', 'D']

export function EvaluationScaleClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scaleMin, setScaleMin] = useState(1)
  const [scaleMax, setScaleMax] = useState(5)
  const [ratingLabels, setRatingLabels] = useState<string[]>([])
  const [gradeLabels, setGradeLabels] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<EvaluationScaleData>('/api/v1/settings/evaluation-scale')
      const d = res.data
      setScaleMin(d.ratingScaleMin)
      setScaleMax(d.ratingScaleMax)
      setRatingLabels(d.ratingLabels as string[])
      setGradeLabels(d.gradeLabels as Record<string, string>)
    } catch {
      toast({ title: '오류', description: '평가 척도를 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleScaleChange = (min: number, max: number) => {
    setScaleMin(min)
    setScaleMax(max)
    const count = max - min + 1
    setRatingLabels((prev) => {
      const next = [...prev]
      while (next.length < count) next.push('')
      return next.slice(0, count)
    })
  }

  const handleSave = async () => {
    if (scaleMin >= scaleMax) {
      toast({ title: '오류', description: '최소값은 최대값보다 작아야 합니다.', variant: 'destructive' })
      return
    }
    const expectedCount = scaleMax - scaleMin + 1
    if (ratingLabels.length !== expectedCount) {
      toast({ title: '오류', description: `등급 라벨 ${expectedCount}개가 필요합니다.`, variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await apiClient.put('/api/v1/settings/evaluation-scale', {
        ratingScaleMin: scaleMin,
        ratingScaleMax: scaleMax,
        ratingLabels,
        gradeLabels,
      })
      toast({ title: '성공', description: '평가 척도가 저장되었습니다.' })
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
      <PageHeader title="평가 척도" description="성과 평가 등급과 라벨을 설정합니다." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 점수 척도 */}
        <Card>
          <CardHeader><CardTitle className="text-lg">점수 척도</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 점수</Label>
                <Input
                  type="number"
                  value={scaleMin}
                  onChange={(e) => handleScaleChange(Number(e.target.value), scaleMax)}
                  min={1} max={10}
                />
              </div>
              <div className="space-y-2">
                <Label>최대 점수</Label>
                <Input
                  type="number"
                  value={scaleMax}
                  onChange={(e) => handleScaleChange(scaleMin, Number(e.target.value))}
                  min={1} max={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>등급 라벨 ({scaleMax - scaleMin + 1}개)</Label>
              {ratingLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-8 text-center text-sm font-medium text-muted-foreground">{scaleMin + i}</span>
                  <Input
                    value={label}
                    onChange={(e) => {
                      const next = [...ratingLabels]
                      next[i] = e.target.value
                      setRatingLabels(next)
                    }}
                    placeholder={`${scaleMin + i}점 라벨`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 등급 라벨 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">성과 등급</CardTitle>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => {
                  const key = `G${Object.keys(gradeLabels).length + 1}`
                  setGradeLabels((prev) => ({ ...prev, [key]: '' }))
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> 등급 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(gradeLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <Input
                  value={key}
                  onChange={(e) => {
                    const newKey = e.target.value
                    setGradeLabels((prev) => {
                      const next = { ...prev }
                      delete next[key]
                      next[newKey] = label
                      return next
                    })
                  }}
                  className="w-20 text-center font-bold"
                />
                <Input
                  value={label}
                  onChange={(e) => setGradeLabels((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="등급명"
                  className="flex-1"
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => setGradeLabels((prev) => {
                    const next = { ...prev }
                    delete next[key]
                    return next
                  })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 미리보기 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">미리보기</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ratingLabels.map((label, i) => (
              <div key={i} className="flex flex-col items-center rounded-lg border px-4 py-3">
                <span className="text-2xl font-bold text-blue-600">{scaleMin + i}</span>
                <span className="text-xs text-muted-foreground">{label || '미설정'}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(gradeLabels).map(([key, label]) => (
              <span key={key} className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium">
                <span className="mr-1 font-bold">{key}</span> {label}
              </span>
            ))}
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
