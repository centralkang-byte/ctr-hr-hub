'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Items Settings (STEP 9-3)
// 수당/공제 항목 마스터 CRUD
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, DollarSign, MinusCircle, ShieldCheck,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

// ─── Types ──────────────────────────────────────────────

interface AllowanceType {
  id: string
  code: string
  name: string
  category: string
  isTaxExempt: boolean
  taxExemptLimit: number | null
  isIncludedInAnnual: boolean
  calculationMethod: string
  defaultAmount: number | null
  description: string | null
  sortOrder: number
  isActive: boolean
}

interface DeductionType {
  id: string
  code: string
  name: string
  category: string
  countryCode: string | null
  calculationMethod: string
  rate: number | null
  description: string | null
  sortOrder: number
  isActive: boolean
}

const ALLOWANCE_CATEGORIES = [
  { value: 'FIXED', label: '고정 수당' },
  { value: 'VARIABLE', label: '변동 수당' },
  { value: 'INCENTIVE', label: '성과급' },
]

const DEDUCTION_CATEGORIES = [
  { value: 'STATUTORY', label: '법정 공제' },
  { value: 'VOLUNTARY', label: '자율 공제' },
]

const CALC_METHODS = [
  { value: 'FIXED_AMOUNT', label: '정액' },
  { value: 'RATE', label: '비율' },
  { value: 'FORMULA', label: '산식' },
  { value: 'BRACKET', label: '구간별' },
]

// ─── Component ──────────────────────────────────────────

export function PayrollItemsClient({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState('allowances')
  const [allowances, setAllowances] = useState<AllowanceType[]>([])
  const [deductions, setDeductions] = useState<DeductionType[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'allowance' | 'deduction'>('allowance')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formCalcMethod, setFormCalcMethod] = useState('FIXED_AMOUNT')
  const [formDefaultAmount, setFormDefaultAmount] = useState('')
  const [formRate, setFormRate] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formIsTaxExempt, setFormIsTaxExempt] = useState(false)
  const [formTaxExemptLimit, setFormTaxExemptLimit] = useState('')
  const [formIsIncludedInAnnual, setFormIsIncludedInAnnual] = useState(true)
  const [formCountryCode, setFormCountryCode] = useState('')

  // ─── Fetch ──────────────────────────────────────────────

  const fetchAllowances = useCallback(async () => {
    try {
      const res = await apiClient.getList<AllowanceType>('/api/v1/payroll/allowance-types')
      setAllowances(res.data)
    } catch { /* silent */ }
  }, [])

  const fetchDeductions = useCallback(async () => {
    try {
      const res = await apiClient.getList<DeductionType>('/api/v1/payroll/deduction-types')
      setDeductions(res.data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAllowances(), fetchDeductions()]).finally(() => setLoading(false))
  }, [fetchAllowances, fetchDeductions])

  // ─── Form helpers ────────────────────────────────────────

  const resetForm = () => {
    setFormCode(''); setFormName(''); setFormCategory(''); setFormCalcMethod('FIXED_AMOUNT')
    setFormDefaultAmount(''); setFormRate(''); setFormDescription(''); setFormSortOrder('0')
    setFormIsTaxExempt(false); setFormTaxExemptLimit(''); setFormIsIncludedInAnnual(true)
    setFormCountryCode(''); setEditingId(null)
  }

  const openCreateAllowance = () => {
    resetForm()
    setModalType('allowance')
    setFormCategory('FIXED')
    setShowModal(true)
  }

  const openCreateDeduction = () => {
    resetForm()
    setModalType('deduction')
    setFormCategory('STATUTORY')
    setShowModal(true)
  }

  const openEditAllowance = (a: AllowanceType) => {
    setModalType('allowance'); setEditingId(a.id)
    setFormCode(a.code); setFormName(a.name); setFormCategory(a.category)
    setFormCalcMethod(a.calculationMethod)
    setFormDefaultAmount(a.defaultAmount?.toString() ?? '')
    setFormDescription(a.description ?? ''); setFormSortOrder(a.sortOrder.toString())
    setFormIsTaxExempt(a.isTaxExempt)
    setFormTaxExemptLimit(a.taxExemptLimit?.toString() ?? '')
    setFormIsIncludedInAnnual(a.isIncludedInAnnual)
    setShowModal(true)
  }

  const openEditDeduction = (d: DeductionType) => {
    setModalType('deduction'); setEditingId(d.id)
    setFormCode(d.code); setFormName(d.name); setFormCategory(d.category)
    setFormCalcMethod(d.calculationMethod)
    setFormRate(d.rate?.toString() ?? '')
    setFormDescription(d.description ?? ''); setFormSortOrder(d.sortOrder.toString())
    setFormCountryCode(d.countryCode ?? '')
    setShowModal(true)
  }

  // ─── Save ──────────────────────────────────────────────

  const handleSave = async () => {
    if (!formCode || !formName) return
    setSaving(true)
    try {
      if (modalType === 'allowance') {
        const body = {
          code: formCode, name: formName, category: formCategory,
          calculationMethod: formCalcMethod,
          defaultAmount: formDefaultAmount ? Number(formDefaultAmount) : undefined,
          description: formDescription || undefined,
          sortOrder: Number(formSortOrder),
          isTaxExempt: formIsTaxExempt,
          taxExemptLimit: formTaxExemptLimit ? Number(formTaxExemptLimit) : undefined,
          isIncludedInAnnual: formIsIncludedInAnnual,
        }
        if (editingId) {
          await apiClient.put(`/api/v1/payroll/allowance-types/${editingId}`, body)
        } else {
          await apiClient.post('/api/v1/payroll/allowance-types', body)
        }
        void fetchAllowances()
      } else {
        const body = {
          code: formCode, name: formName, category: formCategory,
          calculationMethod: formCalcMethod,
          rate: formRate ? Number(formRate) : undefined,
          description: formDescription || undefined,
          sortOrder: Number(formSortOrder),
          countryCode: formCountryCode || undefined,
        }
        if (editingId) {
          await apiClient.put(`/api/v1/payroll/deduction-types/${editingId}`, body)
        } else {
          await apiClient.post('/api/v1/payroll/deduction-types', body)
        }
        void fetchDeductions()
      }
      setShowModal(false)
      resetForm()
    } catch { /* toast */ } finally { setSaving(false) }
  }

  // ─── Delete ─────────────────────────────────────────────

  const handleDeleteAllowance = async (id: string) => {
    if (!confirm('이 수당 항목을 비활성화하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/payroll/allowance-types/${id}`)
      void fetchAllowances()
    } catch { /* silent */ }
  }

  const handleDeleteDeduction = async (id: string) => {
    if (!confirm('이 공제 항목을 비활성화하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/payroll/deduction-types/${id}`)
      void fetchDeductions()
    } catch { /* silent */ }
  }

  // ─── Render ─────────────────────────────────────────────

  const categoryLabel = (cat: string) => {
    return [...ALLOWANCE_CATEGORIES, ...DEDUCTION_CATEGORIES].find(c => c.value === cat)?.label ?? cat
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="수당/공제 항목 관리"
        description="법인별 수당 및 공제 항목 마스터를 관리합니다."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="allowances" className="gap-1.5">
              <DollarSign className="h-4 w-4" /> 수당 항목
            </TabsTrigger>
            <TabsTrigger value="deductions" className="gap-1.5">
              <MinusCircle className="h-4 w-4" /> 공제 항목
            </TabsTrigger>
          </TabsList>
          <Button
            onClick={activeTab === 'allowances' ? openCreateAllowance : openCreateDeduction}
            className="bg-[#00C853] hover:bg-[#00A844] text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> 항목 추가
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#999]" />
          </div>
        ) : (
          <>
            {/* ─── Allowances Tab ─────────────────────────────── */}
            <TabsContent value="allowances">
              {allowances.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-sm text-[#666]">수당 항목이 없습니다.</CardContent></Card>
              ) : (
                <div className="rounded-lg border border-[#E8E8E8] overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#FAFAFA]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">코드</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">항목명</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">구분</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">계산방식</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#666] uppercase">기본금액</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[#666] uppercase">비과세</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[#666] uppercase">연봉포함</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#666] uppercase">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allowances.map(a => (
                        <tr key={a.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                          <td className="px-4 py-3 font-mono text-xs text-[#555]">{a.code}</td>
                          <td className="px-4 py-3 font-medium text-[#1A1A1A]">{a.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">{categoryLabel(a.category)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-[#555]">
                            {CALC_METHODS.find(m => m.value === a.calculationMethod)?.label}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[#333]">
                            {a.defaultAmount ? Number(a.defaultAmount).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {a.isTaxExempt ? (
                              <Badge className="bg-[#D1FAE5] text-[#047857] border-[#A7F3D0] text-xs">
                                비과세{a.taxExemptLimit ? ` ${Number(a.taxExemptLimit).toLocaleString()}` : ''}
                              </Badge>
                            ) : <span className="text-[#D4D4D4]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {a.isIncludedInAnnual ? '✓' : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEditAllowance(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteAllowance(a.id)} className="text-[#EF4444]">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ─── Deductions Tab ─────────────────────────────── */}
            <TabsContent value="deductions">
              {deductions.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-sm text-[#666]">공제 항목이 없습니다.</CardContent></Card>
              ) : (
                <div className="rounded-lg border border-[#E8E8E8] overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#FAFAFA]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">코드</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">항목명</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">구분</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">계산방식</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#666] uppercase">비율(%)</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[#666] uppercase">국가</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[#666] uppercase">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductions.map(d => (
                        <tr key={d.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                          <td className="px-4 py-3 font-mono text-xs text-[#555]">{d.code}</td>
                          <td className="px-4 py-3 font-medium text-[#1A1A1A]">{d.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-xs ${d.category === 'STATUTORY' ? 'border-[#E8F5E9] text-[#00A844]' : ''}`}>
                              {d.category === 'STATUTORY' ? <><ShieldCheck className="h-3 w-3 mr-1 inline" />법정</> : '자율'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[#555]">
                            {CALC_METHODS.find(m => m.value === d.calculationMethod)?.label}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[#333]">
                            {d.rate ? `${Number(d.rate)}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-[#666]">
                            {d.countryCode ?? '공통'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEditDeduction(d)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteDeduction(d.id)} className="text-[#EF4444]">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* ─── Create/Edit Modal ───────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? '항목 수정' : '항목 추가'} — {modalType === 'allowance' ? '수당' : '공제'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#333]">코드</Label>
                <Input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="MEAL" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">항목명</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="식대" className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#333]">구분</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(modalType === 'allowance' ? ALLOWANCE_CATEGORIES : DEDUCTION_CATEGORIES).map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">계산방식</Label>
                <Select value={formCalcMethod} onValueChange={setFormCalcMethod}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CALC_METHODS.filter(m => modalType === 'allowance' ? m.value !== 'BRACKET' : true).map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {modalType === 'allowance' ? (
              <>
                <div>
                  <Label className="text-sm font-medium text-[#333]">기본 금액 (원)</Label>
                  <Input type="number" value={formDefaultAmount} onChange={e => setFormDefaultAmount(e.target.value)} placeholder="200000" className="mt-1" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={formIsTaxExempt} onCheckedChange={setFormIsTaxExempt} />
                    <Label className="text-sm">비과세</Label>
                  </div>
                  {formIsTaxExempt && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-[#666]">한도:</Label>
                      <Input type="number" value={formTaxExemptLimit} onChange={e => setFormTaxExemptLimit(e.target.value)} placeholder="200000" className="w-32" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch checked={formIsIncludedInAnnual} onCheckedChange={setFormIsIncludedInAnnual} />
                    <Label className="text-sm">연봉 포함</Label>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-[#333]">비율 (%)</Label>
                  <Input type="number" value={formRate} onChange={e => setFormRate(e.target.value)} placeholder="4.5" className="mt-1" step="0.01" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[#333]">국가 코드</Label>
                  <Input value={formCountryCode} onChange={e => setFormCountryCode(e.target.value)} placeholder="KR" className="mt-1" maxLength={2} />
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-[#333]">설명</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="선택 사항" className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving || !formCode || !formName} className="bg-[#00C853] hover:bg-[#00A844] text-white">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? '수정' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
