'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Pattern Settings (STEP 9-3)
// 교대 패턴 정의 CRUD + 교대조 관리
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, Clock, Users, Loader2, X,
  Sun, Moon, ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

// ─── Types ──────────────────────────────────────────────

interface ShiftSlot {
  name: string
  start: string
  end: string
  breakMin: number
  nightPremium: boolean
}

interface ShiftPattern {
  id: string
  code: string
  name: string
  patternType: string
  slots: ShiftSlot[]
  cycleDays: number
  weeklyHoursLimit: number | null
  description: string | null
  isActive: boolean
  createdAt: string
  _count?: { shiftGroups: number; shiftSchedules: number }
}

interface ShiftGroup {
  id: string
  name: string
  color: string | null
  isActive: boolean
  _count?: { members: number }
}

const PATTERN_TYPES = [
  { value: 'TWO_SHIFT', label: '2교대' },
  { value: 'THREE_SHIFT', label: '3교대' },
  { value: 'DAY_NIGHT_OFF', label: '주야맞교대' },
  { value: 'FOUR_ON_TWO_OFF', label: '4조2교대' },
  { value: 'CUSTOM', label: '커스텀' },
]

const PATTERN_PRESETS: Record<string, ShiftSlot[]> = {
  TWO_SHIFT: [
    { name: '주간', start: '06:00', end: '18:00', breakMin: 60, nightPremium: false },
    { name: '야간', start: '18:00', end: '06:00', breakMin: 60, nightPremium: true },
  ],
  THREE_SHIFT: [
    { name: '1교대', start: '06:00', end: '14:00', breakMin: 30, nightPremium: false },
    { name: '2교대', start: '14:00', end: '22:00', breakMin: 30, nightPremium: false },
    { name: '3교대', start: '22:00', end: '06:00', breakMin: 30, nightPremium: true },
  ],
  DAY_NIGHT_OFF: [
    { name: '주간', start: '08:00', end: '20:00', breakMin: 60, nightPremium: false },
    { name: '야간', start: '20:00', end: '08:00', breakMin: 60, nightPremium: true },
    { name: '비번', start: '00:00', end: '00:00', breakMin: 0, nightPremium: false },
  ],
  FOUR_ON_TWO_OFF: [
    { name: '주간', start: '06:00', end: '18:00', breakMin: 60, nightPremium: false },
    { name: '야간', start: '18:00', end: '06:00', breakMin: 60, nightPremium: true },
  ],
  CUSTOM: [
    { name: '근무', start: '09:00', end: '18:00', breakMin: 60, nightPremium: false },
  ],
}

const CYCLE_PRESETS: Record<string, number> = {
  TWO_SHIFT: 2, THREE_SHIFT: 3, DAY_NIGHT_OFF: 3, FOUR_ON_TWO_OFF: 6, CUSTOM: 7,
}

const GROUP_COLORS = ['#00C853', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

// ─── Component ──────────────────────────────────────────

export function ShiftPatternsClient({ user }: { user: SessionUser }) {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPattern, setEditingPattern] = useState<ShiftPattern | null>(null)
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null)
  const [groups, setGroups] = useState<ShiftGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)

  // Form state
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('TWO_SHIFT')
  const [formSlots, setFormSlots] = useState<ShiftSlot[]>(PATTERN_PRESETS.TWO_SHIFT)
  const [formCycleDays, setFormCycleDays] = useState(2)
  const [formWeeklyLimit, setFormWeeklyLimit] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Group form
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [groupPatternId, setGroupPatternId] = useState('')

  // ─── Fetch patterns ─────────────────────────────────────

  const fetchPatterns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<ShiftPattern>('/api/v1/shift-patterns')
      setPatterns(res.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchPatterns() }, [fetchPatterns])

  // ─── Fetch groups for expanded pattern ──────────────────

  const fetchGroups = useCallback(async (patternId: string) => {
    setLoadingGroups(true)
    try {
      const res = await apiClient.getList<ShiftGroup>(
        '/api/v1/shift-groups', { shiftPatternId: patternId },
      )
      setGroups(res.data)
    } catch {
      setGroups([])
    } finally {
      setLoadingGroups(false)
    }
  }, [])

  const toggleExpand = (patternId: string) => {
    if (expandedPatternId === patternId) {
      setExpandedPatternId(null)
    } else {
      setExpandedPatternId(patternId)
      void fetchGroups(patternId)
    }
  }

  // ─── Form helpers ────────────────────────────────────────

  const resetForm = () => {
    setFormCode('')
    setFormName('')
    setFormType('TWO_SHIFT')
    setFormSlots(PATTERN_PRESETS.TWO_SHIFT)
    setFormCycleDays(2)
    setFormWeeklyLimit('')
    setFormDescription('')
    setEditingPattern(null)
  }

  const openCreate = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEdit = (p: ShiftPattern) => {
    setEditingPattern(p)
    setFormCode(p.code)
    setFormName(p.name)
    setFormType(p.patternType)
    setFormSlots(p.slots)
    setFormCycleDays(p.cycleDays)
    setFormWeeklyLimit(p.weeklyHoursLimit?.toString() ?? '')
    setFormDescription(p.description ?? '')
    setShowCreateModal(true)
  }

  const handleTypeChange = (type: string) => {
    setFormType(type)
    setFormSlots(PATTERN_PRESETS[type] || PATTERN_PRESETS.CUSTOM)
    setFormCycleDays(CYCLE_PRESETS[type] || 7)
  }

  const updateSlot = (idx: number, field: keyof ShiftSlot, value: string | number | boolean) => {
    setFormSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const addSlot = () => {
    setFormSlots(prev => [...prev, { name: '', start: '09:00', end: '18:00', breakMin: 60, nightPremium: false }])
  }

  const removeSlot = (idx: number) => {
    setFormSlots(prev => prev.filter((_, i) => i !== idx))
  }

  // ─── Save pattern ──────────────────────────────────────

  const handleSave = async () => {
    if (!formCode || !formName || formSlots.length === 0) return
    setSaving(true)
    try {
      const body = {
        code: formCode,
        name: formName,
        patternType: formType,
        slots: formSlots,
        cycleDays: formCycleDays,
        weeklyHoursLimit: formWeeklyLimit ? Number(formWeeklyLimit) : undefined,
        description: formDescription || undefined,
      }
      if (editingPattern) {
        await apiClient.put(`/api/v1/shift-patterns/${editingPattern.id}`, body)
      } else {
        await apiClient.post('/api/v1/shift-patterns', body)
      }
      setShowCreateModal(false)
      resetForm()
      void fetchPatterns()
    } catch {
      // TODO: toast
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete pattern ─────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('이 교대 패턴을 비활성화하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/shift-patterns/${id}`)
      void fetchPatterns()
    } catch {
      // silent
    }
  }

  // ─── Create group ───────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!groupName || !groupPatternId) return
    try {
      await apiClient.post('/api/v1/shift-groups', {
        shiftPatternId: groupPatternId,
        name: groupName,
        color: groupColor,
      })
      setShowGroupModal(false)
      setGroupName('')
      void fetchGroups(groupPatternId)
    } catch {
      // silent
    }
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="교대근무 패턴 설정"
        description="교대근무 패턴 정의 및 교대조를 관리합니다."
        actions={
          <Button onClick={openCreate} className="bg-[#00C853] hover:bg-[#00A844] text-white">
            <Plus className="mr-2 h-4 w-4" /> 패턴 추가
          </Button>
        }
      />

      {/* Pattern List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#999]" />
        </div>
      ) : patterns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[#666]">
            등록된 교대 패턴이 없습니다. 패턴을 추가해주세요.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {patterns.map(p => (
            <Card key={p.id} className="border border-[#E8E8E8]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleExpand(p.id)}
                  >
                    {expandedPatternId === p.id
                      ? <ChevronDown className="h-4 w-4 text-[#999]" />
                      : <ChevronRight className="h-4 w-4 text-[#999]" />
                    }
                    <div>
                      <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
                        {p.name}
                        <Badge variant="outline" className="text-xs font-normal">
                          {p.code}
                        </Badge>
                        <Badge className={`text-xs ${p.isActive ? 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' : 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]'}`}>
                          {p.isActive ? '활성' : '비활성'}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-[#666] mt-1">
                        {PATTERN_TYPES.find(t => t.value === p.patternType)?.label ?? p.patternType}
                        {' · '}순환주기 {p.cycleDays}일
                        {p.weeklyHoursLimit && ` · 주간한도 ${p.weeklyHoursLimit}h`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-[#EF4444] hover:text-[#B91C1C]">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Slots summary */}
              <CardContent className="pt-0 pb-3">
                <div className="flex gap-2 flex-wrap">
                  {(p.slots as ShiftSlot[]).map((slot, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                      slot.nightPremium ? 'bg-[#E0E7FF] text-[#4338CA]' : 'bg-[#E8F5E9] text-[#00A844]'
                    }`}>
                      {slot.nightPremium ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                      {slot.name} ({slot.start}~{slot.end})
                      {slot.breakMin > 0 && <span className="text-[#999]">휴게{slot.breakMin}분</span>}
                    </div>
                  ))}
                </div>
              </CardContent>

              {/* Expanded: Shift Groups */}
              {expandedPatternId === p.id && (
                <CardContent className="border-t border-[#F5F5F5] bg-[#FAFAFA]/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-[#333] flex items-center gap-1.5">
                      <Users className="h-4 w-4" /> 교대조
                    </h4>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setGroupPatternId(p.id); setShowGroupModal(true) }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> 교대조 추가
                    </Button>
                  </div>
                  {loadingGroups ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#999]" />
                  ) : groups.length === 0 ? (
                    <p className="text-sm text-[#999]">교대조가 없습니다.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {groups.map(g => (
                        <div key={g.id} className="flex items-center gap-2 rounded-lg border border-[#E8E8E8] bg-white px-3 py-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: g.color ?? '#94A3B8' }}
                          />
                          <span className="text-sm font-medium text-[#333]">{g.name}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {g._count?.members ?? 0}명
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ─── Create/Edit Pattern Modal ───────────────────────── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPattern ? '교대 패턴 수정' : '교대 패턴 추가'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#333]">코드</Label>
                <Input
                  value={formCode} onChange={e => setFormCode(e.target.value)}
                  placeholder="SHIFT_2" className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">패턴명</Label>
                <Input
                  value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="CTR-KR 2교대" className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#333]">패턴 유형</Label>
                <Select value={formType} onValueChange={handleTypeChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PATTERN_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">순환주기 (일)</Label>
                <Input
                  type="number" value={formCycleDays}
                  onChange={e => setFormCycleDays(Number(e.target.value))}
                  className="mt-1" min={1}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">주간 한도 (시간)</Label>
                <Input
                  type="number" value={formWeeklyLimit}
                  onChange={e => setFormWeeklyLimit(e.target.value)}
                  placeholder="52" className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-[#333]">설명</Label>
              <Input
                value={formDescription} onChange={e => setFormDescription(e.target.value)}
                placeholder="선택 사항" className="mt-1"
              />
            </div>

            {/* 슬롯 정의 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-[#333]">근무 슬롯</Label>
                <Button variant="outline" size="sm" onClick={addSlot}>
                  <Plus className="h-3 w-3 mr-1" /> 슬롯 추가
                </Button>
              </div>

              <div className="space-y-2">
                {formSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-[#E8E8E8] p-3 bg-[#FAFAFA]/50">
                    <Input
                      value={slot.name}
                      onChange={e => updateSlot(i, 'name', e.target.value)}
                      placeholder="슬롯명"
                      className="w-24"
                    />
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#999]" />
                      <Input
                        value={slot.start}
                        onChange={e => updateSlot(i, 'start', e.target.value)}
                        placeholder="08:00"
                        className="w-20 text-center"
                      />
                      <span className="text-[#999]">~</span>
                      <Input
                        value={slot.end}
                        onChange={e => updateSlot(i, 'end', e.target.value)}
                        placeholder="18:00"
                        className="w-20 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#666]">휴게</span>
                      <Input
                        type="number" value={slot.breakMin}
                        onChange={e => updateSlot(i, 'breakMin', Number(e.target.value))}
                        className="w-16 text-center" min={0}
                      />
                      <span className="text-xs text-[#666]">분</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={slot.nightPremium}
                        onCheckedChange={v => updateSlot(i, 'nightPremium', v)}
                      />
                      <Moon className={`h-3.5 w-3.5 ${slot.nightPremium ? 'text-[#4F46E5]' : 'text-[#D4D4D4]'}`} />
                    </div>
                    {formSlots.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeSlot(i)} className="text-[#F87171] hover:text-[#DC2626] ml-auto">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>취소</Button>
            <Button
              onClick={handleSave} disabled={saving || !formCode || !formName}
              className="bg-[#00C853] hover:bg-[#00A844] text-white"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingPattern ? '수정' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Group Modal ────────────────────────────── */}
      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>교대조 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-[#333]">교대조명</Label>
              <Input
                value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="A조" className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#333]">색상</Label>
              <div className="flex gap-2 mt-1">
                {GROUP_COLORS.map(c => (
                  <button
                    key={c}
                    className={`h-8 w-8 rounded-full border-2 ${groupColor === c ? 'border-[#111]' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setGroupColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupModal(false)}>취소</Button>
            <Button
              onClick={handleCreateGroup} disabled={!groupName}
              className="bg-[#00C853] hover:bg-[#00A844] text-white"
            >
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
