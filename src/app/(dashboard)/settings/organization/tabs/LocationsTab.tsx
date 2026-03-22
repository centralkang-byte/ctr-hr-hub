'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, MapPin, Plus, Pencil, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES, BUTTON_VARIANTS, BUTTON_SIZES } from '@/lib/styles'
import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────

interface WorkLocation {
  id: string
  code: string
  name: string
  nameEn: string | null
  country: string
  city: string | null
  timezone: string | null
  address: string | null
  locationType: string | null
  isActive: boolean
  company?: { id: string; code: string; name: string }
}

interface Props {
  companyId: string | null
}

// ─── IANA Timezone Options ───────────────────────────────

const TIMEZONE_OPTIONS = [
  'Asia/Seoul',
  'Asia/Shanghai',
  'America/Detroit',
  'America/Monterrey',
  'Asia/Ho_Chi_Minh',
  'Europe/Moscow',
  'Europe/Warsaw',
  'America/Santiago',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
]

const LOCATION_TYPES = [
  { value: 'OFFICE', label: '사무소' },
  { value: 'PLANT', label: '공장' },
  { value: 'WAREHOUSE', label: '물류센터' },
  { value: 'BRANCH_OFFICE', label: '지사' },
]

const COUNTRY_OPTIONS = [
  { value: 'KR', label: '한국 (KR)' },
  { value: 'CN', label: '중국 (CN)' },
  { value: 'US', label: '미국 (US)' },
  { value: 'MX', label: '멕시코 (MX)' },
  { value: 'VN', label: '베트남 (VN)' },
  { value: 'RU', label: '러시아 (RU)' },
  { value: 'PL', label: '폴란드 (PL)' },
  { value: 'CL', label: '칠레 (CL)' },
  { value: 'TH', label: '태국 (TH)' },
  { value: 'ID', label: '인도네시아 (ID)' },
]

// ─── Form State ──────────────────────────────────────────

interface FormData {
  code: string
  name: string
  nameEn: string
  country: string
  city: string
  timezone: string
  address: string
  locationType: string
}

const emptyForm: FormData = {
  code: '',
  name: '',
  nameEn: '',
  country: 'KR',
  city: '',
  timezone: 'Asia/Seoul',
  address: '',
  locationType: 'OFFICE',
}

// ─── Component ───────────────────────────────────────────

export function LocationsTab({ companyId }: Props) {
  const t = useTranslations('common')
  const [locations, setLocations] = useState<WorkLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '200' }
      if (search) params.search = search
      if (companyId) params.companyId = companyId
      const res = await apiClient.get<WorkLocation[]>('/api/v1/locations', params)
      const list = (res as { data: WorkLocation[] })?.data ?? []
      setLocations(Array.isArray(list) ? list : [])
    } catch {
      setLocations([])
    } finally {
      setLoading(false)
    }
  }, [companyId, search])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (loc: WorkLocation) => {
    setEditingId(loc.id)
    setForm({
      code: loc.code,
      name: loc.name,
      nameEn: loc.nameEn ?? '',
      country: loc.country,
      city: loc.city ?? '',
      timezone: loc.timezone ?? 'Asia/Seoul',
      address: loc.address ?? '',
      locationType: loc.locationType ?? 'OFFICE',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name || !form.timezone) {
      toast({ title: '필수 항목을 입력해주세요.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await apiClient.put(`/api/v1/locations/${editingId}`, {
          name: form.name,
          nameEn: form.nameEn || undefined,
          country: form.country,
          city: form.city || undefined,
          timezone: form.timezone,
          address: form.address || undefined,
          locationType: form.locationType || undefined,
        })
        toast({ title: '근무지가 수정되었습니다.' })
      } else {
        await apiClient.post('/api/v1/locations', {
          ...form,
          nameEn: form.nameEn || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
          companyId: companyId || undefined,
        })
        toast({ title: '근무지가 등록되었습니다.' })
      }
      setShowModal(false)
      fetchLocations()
    } catch (err) {
      toast({
        title: editingId ? '수정 실패' : '등록 실패',
        description: err instanceof Error ? err.message : '오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (loc: WorkLocation) => {
    try {
      if (loc.isActive) {
        await apiClient.delete(`/api/v1/locations/${loc.id}`)
        toast({ title: `${loc.name} 비활성화됨` })
      } else {
        await apiClient.put(`/api/v1/locations/${loc.id}`, { isActive: true })
        toast({ title: `${loc.name} 활성화됨` })
      }
      fetchLocations()
    } catch (err) {
      toast({
        title: '상태 변경 실패',
        description: err instanceof Error ? err.message : '오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">근무지 목록</h3>
          <p className="text-sm text-[#8181A5]">등록된 근무지 {locations.length}개</p>
        </div>
        <button onClick={openCreate} className={`${BUTTON_VARIANTS.primary} ${BUTTON_SIZES.md} inline-flex items-center`}>
          <Plus className="mr-1.5 h-4 w-4" />
          근무지 추가
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="코드, 이름, 도시로 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none focus:ring-1 focus:ring-[#5E81F4]"
      />

      {/* Table */}
      {locations.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr>
                <th className={TABLE_STYLES.headerCell}>코드</th>
                <th className={TABLE_STYLES.headerCell}>이름</th>
                {!companyId && <th className={TABLE_STYLES.headerCell}>법인</th>}
                <th className={TABLE_STYLES.headerCell}>국가</th>
                <th className={TABLE_STYLES.headerCell}>도시</th>
                <th className={TABLE_STYLES.headerCell}>유형</th>
                <th className={TABLE_STYLES.headerCell}>상태</th>
                <th className={TABLE_STYLES.headerCell}>관리</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className={TABLE_STYLES.row}>
                  <td className={TABLE_STYLES.cell}>
                    <span className="font-mono tabular-nums text-xs">{loc.code}</span>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <div>{loc.name}</div>
                    {loc.nameEn && (
                      <div className="text-xs text-[#8181A5]">{loc.nameEn}</div>
                    )}
                  </td>
                  {!companyId && (
                    <td className={TABLE_STYLES.cellMuted}>
                      {loc.company?.code ?? '-'}
                    </td>
                  )}
                  <td className={TABLE_STYLES.cell}>{loc.country}</td>
                  <td className={TABLE_STYLES.cellMuted}>{loc.city ?? '-'}</td>
                  <td className={TABLE_STYLES.cell}>
                    <span className="inline-flex items-center rounded-md bg-[#F5F5FA] px-2 py-0.5 text-xs font-medium text-[#1C1D21]">
                      {loc.locationType ?? '-'}
                    </span>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <button
                      onClick={() => handleDeactivate(loc)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        loc.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {loc.isActive ? t('active') : t('inactive')}
                    </button>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <button
                      onClick={() => openEdit(loc)}
                      className="rounded p-1 text-[#8181A5] hover:bg-[#F5F5FA] hover:text-[#5E81F4]"
                      title="수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" />
          <p className="text-sm font-medium text-[#1C1D21]">등록된 근무지가 없습니다</p>
          <p className="mt-1 text-xs text-[#8181A5]">위의 &apos;근무지 추가&apos; 버튼으로 등록하세요</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1C1D21]">
                {editingId ? '근무지 수정' : '근무지 추가'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#8181A5] hover:text-[#1C1D21]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Code (only on create) */}
              {!editingId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1D21]">코드 *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="SEOUL-HQ"
                    className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                  />
                </div>
              )}

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1D21]">이름 (한국어) *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="서울 본사"
                    className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1D21]">이름 (영문)</label>
                  <input
                    type="text"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    placeholder="Seoul HQ"
                    className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                  />
                </div>
              </div>

              {/* Country + City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1D21]">국가 *</label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1D21]">도시</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="서울"
                    className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                  />
                </div>
              </div>

              {/* Timezone + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1D21]">타임존 *</label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1D21]">유형</label>
                  <select
                    value={form.locationType}
                    onChange={(e) => setForm({ ...form, locationType: e.target.value })}
                    className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                  >
                    {LOCATION_TYPES.map((lt) => (
                      <option key={lt.value} value={lt.value}>{lt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1C1D21]">주소</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="경남 창원시 의창구..."
                  className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className={`${BUTTON_VARIANTS.secondary} ${BUTTON_SIZES.md}`}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`${BUTTON_VARIANTS.primary} ${BUTTON_SIZES.md} inline-flex items-center`}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {editingId ? t('save') : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
