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
  deletedAt: string | null
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
  { value: 'OFFICE', labelKey: 'locations.locationType.OFFICE' },
  { value: 'PLANT', labelKey: 'locations.locationType.PLANT' },
  { value: 'WAREHOUSE', labelKey: 'locations.locationType.WAREHOUSE' },
  { value: 'BRANCH_OFFICE', labelKey: 'locations.locationType.BRANCH_OFFICE' },
]

const COUNTRY_OPTIONS = [
  { value: 'KR', labelKey: 'locations.countries.KR' },
  { value: 'CN', labelKey: 'locations.countries.CN' },
  { value: 'US', labelKey: 'locations.countries.US' },
  { value: 'MX', labelKey: 'locations.countries.MX' },
  { value: 'VN', labelKey: 'locations.countries.VN' },
  { value: 'RU', labelKey: 'locations.countries.RU' },
  { value: 'PL', labelKey: 'locations.countries.PL' },
  { value: 'CL', labelKey: 'locations.countries.CL' },
  { value: 'TH', labelKey: 'locations.countries.TH' },
  { value: 'ID', labelKey: 'locations.countries.ID' },
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
  const ts = useTranslations('settings')
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
      toast({ title: t('requiredFields'), variant: 'destructive' })
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
        toast({ title: ts('locations.updateSuccess') })
      } else {
        await apiClient.post('/api/v1/locations', {
          ...form,
          nameEn: form.nameEn || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
          companyId: companyId || undefined,
        })
        toast({ title: ts('locations.createSuccess') })
      }
      setShowModal(false)
      fetchLocations()
    } catch (err) {
      toast({
        title: editingId ? t('updateFailed') : ts('locations.registerFailed'),
        description: err instanceof Error ? err.message : t('errorOccurred'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (loc: WorkLocation) => {
    try {
      if (!loc.deletedAt) {
        await apiClient.delete(`/api/v1/locations/${loc.id}`)
        toast({ title: ts('locations.deactivated', { name: loc.name }) })
      } else {
        await apiClient.put(`/api/v1/locations/${loc.id}`, { deletedAt: null })
        toast({ title: ts('locations.activated', { name: loc.name }) })
      }
      fetchLocations()
    } catch (err) {
      toast({
        title: t('statusChangeFailed'),
        description: err instanceof Error ? err.message : t('errorOccurred'),
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{ts('locations.title')}</h3>
          <p className="text-sm text-muted-foreground">{ts('locations.description', { count: locations.length })}</p>
        </div>
        <button onClick={openCreate} className={`${BUTTON_VARIANTS.primary} ${BUTTON_SIZES.md} inline-flex items-center`}>
          <Plus className="mr-1.5 h-4 w-4" />
          {ts('locations.addNew')}
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={ts('locations.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {/* Table */}
      {locations.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr>
                <th className={TABLE_STYLES.headerCell}>{ts('locations.colCode')}</th>
                <th className={TABLE_STYLES.headerCell}>{ts('locations.colName')}</th>
                {!companyId && <th className={TABLE_STYLES.headerCell}>{ts('locations.colCompany')}</th>}
                <th className={TABLE_STYLES.headerCell}>{ts('locations.colCountry')}</th>
                <th className={TABLE_STYLES.headerCell}>{ts('locations.colCity')}</th>
                <th className={TABLE_STYLES.headerCell}>{ts('locations.colType')}</th>
                <th className={TABLE_STYLES.headerCell}>{ts('locations.colStatus')}</th>
                <th className={TABLE_STYLES.headerCell}>{ts('locations.colManage')}</th>
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
                      <div className="text-xs text-muted-foreground">{loc.nameEn}</div>
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
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {loc.locationType ?? '-'}
                    </span>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <button
                      onClick={() => handleDeactivate(loc)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        !loc.deletedAt
                          ? 'bg-tertiary-container/10 text-tertiary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {!loc.deletedAt ? t('active') : t('inactive')}
                    </button>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <button
                      onClick={() => openEdit(loc)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                      title={t('edit')}
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
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{ts('locations.emptyState')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ts('locations.emptyHint')}</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {editingId ? ts('locations.editTitle') : ts('locations.createTitle')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Code (only on create) */}
              {!editingId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formCode')}</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="SEOUL-HQ"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formNameKo')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formNameEn')}</label>
                  <input
                    type="text"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    placeholder="Seoul HQ"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Country + City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formCountry')}</label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{ts(c.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formCity')}</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Timezone + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formTimezone')}</label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formType')}</label>
                  <select
                    value={form.locationType}
                    onChange={(e) => setForm({ ...form, locationType: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {LOCATION_TYPES.map((lt) => (
                      <option key={lt.value} value={lt.value}>{ts(lt.labelKey)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{ts('locations.formAddress')}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
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
