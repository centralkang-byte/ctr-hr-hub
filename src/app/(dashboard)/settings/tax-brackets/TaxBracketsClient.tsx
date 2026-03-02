'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Tax Brackets Client
// 국가별 세금 구간 관리
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Globe,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Download,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface TaxBracket {
  id: string
  countryCode: string
  taxType: string
  name: string
  bracketMin: string
  bracketMax: string | null
  rate: string
  fixedAmount: string
  effectiveFrom: string
  effectiveTo: string | null
  description: string | null
  isActive: boolean
}

// ─── Constants ──────────────────────────────────────────────

const COUNTRIES = [
  { code: 'KR', name: '한국', flag: '🇰🇷' },
  { code: 'CN', name: '중국', flag: '🇨🇳' },
  { code: 'RU', name: '러시아', flag: '🇷🇺' },
  { code: 'US', name: '미국', flag: '🇺🇸' },
  { code: 'VN', name: '베트남', flag: '🇻🇳' },
  { code: 'MX', name: '멕시코', flag: '🇲🇽' },
  { code: 'PL', name: '폴란드', flag: '🇵🇱' },
]

const TAX_TYPES = [
  { value: 'INCOME_TAX', label: '소득세' },
  { value: 'LOCAL_TAX', label: '지방세' },
  { value: 'SOCIAL_INSURANCE', label: '사회보험' },
  { value: 'PENSION', label: '연금' },
  { value: 'HEALTH_INSURANCE', label: '건강보험' },
  { value: 'OTHER', label: '기타' },
]

const TAX_TYPE_COLORS: Record<string, string> = {
  INCOME_TAX: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]',
  LOCAL_TAX: 'bg-[#FAF5FF] text-[#7E22CE] border-[#E9D5FF]',
  SOCIAL_INSURANCE: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]',
  PENSION: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]',
  HEALTH_INSURANCE: 'bg-[#FDF2F8] text-[#BE185D] border-[#FBCFE8]',
  OTHER: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]',
}

function formatRate(rate: string | number): string {
  return `${(Number(rate) * 100).toFixed(2)}%`
}

function formatAmount(amount: string | number): string {
  const num = Number(amount)
  if (num === 0) return '-'
  return num.toLocaleString()
}

// ─── Component ──────────────────────────────────────────────

export function TaxBracketsClient({ user }: { user: SessionUser }) {
  void user

  const [brackets, setBrackets] = useState<TaxBracket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<string>('KR')
  const [selectedTaxType, setSelectedTaxType] = useState<string>('all')

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaxBracket | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    countryCode: 'KR',
    taxType: 'INCOME_TAX',
    name: '',
    bracketMin: 0,
    bracketMax: null as number | null,
    rate: 0,
    fixedAmount: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: null as string | null,
    description: '',
  })

  // Seed loading
  const [seeding, setSeeding] = useState(false)

  // ─── Fetch ───
  const fetchBrackets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ countryCode: selectedCountry, limit: '100' })
      if (selectedTaxType !== 'all') params.set('taxType', selectedTaxType)
      const res = await apiClient.get<{ data: TaxBracket[] }>(
        `/api/v1/tax-brackets?${params}`
      )
      setBrackets(res.data?.data ?? [])
    } catch {
      setBrackets([])
    } finally {
      setLoading(false)
    }
  }, [selectedCountry, selectedTaxType])

  useEffect(() => {
    void fetchBrackets()
  }, [fetchBrackets])

  // ─── Seed Default Brackets ───
  const handleSeed = async () => {
    setSeeding(true)
    try {
      await apiClient.post('/api/v1/tax-brackets/seed', { countryCode: selectedCountry })
      await fetchBrackets()
    } catch {
      // handled
    } finally {
      setSeeding(false)
    }
  }

  // ─── Open Create/Edit Modal ───
  const openCreate = () => {
    setEditing(null)
    setForm({
      countryCode: selectedCountry,
      taxType: 'INCOME_TAX',
      name: '',
      bracketMin: 0,
      bracketMax: null,
      rate: 0,
      fixedAmount: 0,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: null,
      description: '',
    })
    setModalOpen(true)
  }

  const openEdit = (bracket: TaxBracket) => {
    setEditing(bracket)
    setForm({
      countryCode: bracket.countryCode,
      taxType: bracket.taxType,
      name: bracket.name,
      bracketMin: Number(bracket.bracketMin),
      bracketMax: bracket.bracketMax ? Number(bracket.bracketMax) : null,
      rate: Number(bracket.rate),
      fixedAmount: Number(bracket.fixedAmount),
      effectiveFrom: bracket.effectiveFrom.split('T')[0],
      effectiveTo: bracket.effectiveTo?.split('T')[0] ?? null,
      description: bracket.description ?? '',
    })
    setModalOpen(true)
  }

  // ─── Save ───
  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await apiClient.put(`/api/v1/tax-brackets/${editing.id}`, {
          name: form.name,
          bracketMin: form.bracketMin,
          bracketMax: form.bracketMax,
          rate: form.rate,
          fixedAmount: form.fixedAmount,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo,
          description: form.description || null,
        })
      } else {
        await apiClient.post('/api/v1/tax-brackets', form)
      }
      setModalOpen(false)
      await fetchBrackets()
    } catch {
      // handled
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete (soft) ───
  const handleDelete = async (id: string) => {
    if (!confirm('이 세금 구간을 비활성화하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/tax-brackets/${id}`)
      await fetchBrackets()
    } catch {
      // handled
    }
  }

  // ─── Group brackets by tax type ───
  const groupedBrackets = new Map<string, TaxBracket[]>()
  for (const b of brackets) {
    const existing = groupedBrackets.get(b.taxType) ?? []
    existing.push(b)
    groupedBrackets.set(b.taxType, existing)
  }

  const countryInfo = COUNTRIES.find(c => c.code === selectedCountry)

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Globe className="h-6 w-6 text-[#00C853]" />
            해외 세금 테이블
          </h1>
          <p className="text-sm text-[#666] mt-1">국가별 세금 구간 및 사회보험 요율 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            기본값 적용
          </Button>
          <Button
            onClick={openCreate}
            className="bg-[#00C853] hover:bg-[#00A844] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            구간 추가
          </Button>
        </div>
      </div>

      {/* ─── Country Tabs ─── */}
      <div className="flex items-center gap-1 border-b border-[#E8E8E8] overflow-x-auto">
        {COUNTRIES.map(country => (
          <button
            key={country.code}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              selectedCountry === country.code
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
            onClick={() => setSelectedCountry(country.code)}
          >
            {country.flag} {country.name}
          </button>
        ))}
      </div>

      {/* ─── Tax Type Filter ─── */}
      <div className="flex items-center gap-3">
        <Select value={selectedTaxType} onValueChange={setSelectedTaxType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="세금 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            {TAX_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-[#666]">
          {countryInfo?.flag} {countryInfo?.name} · {brackets.filter(b => b.isActive).length}개 활성 구간
        </p>
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#00C853]" />
        </div>
      ) : brackets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="h-12 w-12 mx-auto mb-3 text-[#D4D4D4]" />
            <p className="text-[#666] mb-4">
              {countryInfo?.name}에 등록된 세금 구간이 없습니다.
            </p>
            <Button onClick={handleSeed} disabled={seeding} variant="outline">
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              기본 세금 데이터 적용
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedBrackets.entries()).map(([taxType, items]) => {
            const typeInfo = TAX_TYPES.find(t => t.value === taxType)
            const sortedItems = [...items].sort((a, b) => Number(a.bracketMin) - Number(b.bracketMin))

            return (
              <Card key={taxType}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge className={`${TAX_TYPE_COLORS[taxType] ?? TAX_TYPE_COLORS.OTHER} border`}>
                      {typeInfo?.label ?? taxType}
                    </Badge>
                    <span className="text-sm text-[#999]">{items.length}개 구간</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAFAFA]">
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#666]">항목명</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[#666]">하한</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[#666]">상한</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[#666]">세율</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[#666]">기본공제</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#666]">적용기간</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-[#666]">상태</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-[#666]">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedItems.map(bracket => (
                          <tr key={bracket.id} className="border-t border-[#F5F5F5] hover:bg-[#FAFAFA]">
                            <td className="px-4 py-2.5 font-medium text-[#1A1A1A]">{bracket.name}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">
                              {formatAmount(bracket.bracketMin)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">
                              {bracket.bracketMax ? formatAmount(bracket.bracketMax) : '∞'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-[#00A844]">
                              {formatRate(bracket.rate)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs">
                              {formatAmount(bracket.fixedAmount)}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-[#666]">
                              {bracket.effectiveFrom.split('T')[0]}
                              {bracket.effectiveTo && ` ~ ${bracket.effectiveTo.split('T')[0]}`}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge className={bracket.isActive
                                ? 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]'
                                : 'bg-[#FAFAFA] text-[#666] border border-[#E8E8E8]'
                              }>
                                {bracket.isActive ? '활성' : '비활성'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(bracket)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(bracket.id)}
                                  className="text-[#EF4444] hover:text-[#B91C1C]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Create/Edit Modal ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '세금 구간 수정' : '세금 구간 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#333] mb-1 block">국가</label>
                  <Select
                    value={form.countryCode}
                    onValueChange={v => setForm(p => ({ ...p, countryCode: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#333] mb-1 block">세금 유형</label>
                  <Select
                    value={form.taxType}
                    onValueChange={v => setForm(p => ({ ...p, taxType: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TAX_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">항목명</label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 소득세 1구간"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">하한 금액</label>
                <Input
                  type="number"
                  value={form.bracketMin}
                  onChange={e => setForm(p => ({ ...p, bracketMin: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">상한 금액</label>
                <Input
                  type="number"
                  value={form.bracketMax ?? ''}
                  onChange={e => setForm(p => ({ ...p, bracketMax: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="무제한"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">세율 (소수점)</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.rate}
                  onChange={e => setForm(p => ({ ...p, rate: Number(e.target.value) }))}
                  placeholder="0.06 = 6%"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">기본 공제액</label>
                <Input
                  type="number"
                  value={form.fixedAmount}
                  onChange={e => setForm(p => ({ ...p, fixedAmount: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">적용 시작일</label>
                <Input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">적용 종료일</label>
                <Input
                  type="date"
                  value={form.effectiveTo ?? ''}
                  onChange={e => setForm(p => ({ ...p, effectiveTo: e.target.value || null }))}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">설명</label>
              <Input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="설명 (선택)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>취소</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="bg-[#00C853] hover:bg-[#00A844] text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? '수정' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
