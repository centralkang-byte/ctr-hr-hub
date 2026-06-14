'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  User, Briefcase, DollarSign, FileText, Camera, Pencil,
  Edit3, Save, X, Globe, Building, AlertCircle,
  Calendar, Clock, Award
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/badge'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { CARD_STYLES, BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { extractPrimaryAssignment } from '@/lib/employee/extract-primary-assignment'
import { formatDate } from '@/lib/format/date'
import { useArrowKeyNavigation } from '@/hooks/useArrowKeyNavigation'
import type { SessionUser } from '@/types'
import { ProfileChangeRequestDialog, ChangeRequestHistory } from '@/components/employees/ProfileChangeRequestDialog'
import { ProfileAttendanceTab } from './ProfileAttendanceTab'
import { ProfileLeaveTab } from './ProfileLeaveTab'
import { ProfilePerformanceTab } from './ProfilePerformanceTab'

// ─── Types ──────────────────────────────────────────────────

interface Assignment {
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string; code: string } | null
  company: { id: string; code: string; name: string } | null
  title: { id: string; name: string } | null
  position: { id: string; titleKo: string } | null
}

interface EmergencyContact {
  id: string
  name: string
  relationship: string
  phone: string
  isPrimary: boolean
}

interface ProfileExtension {
  bio: string | null
  skills: string[]
  languages: unknown
  certifications: unknown
  pronouns: string | null
  timezone: string | null
  avatarPath: string | null
}

interface ProfileVisibility {
  personalPhone: string
  personalEmail: string
  birthDate: string
  address: string
  emergencyContact: string
  bio: string
  skills: string
}

interface EmployeeHistory {
  id: string
  changeType: string
  effectiveDate: string | Date
  toDept: { name: string } | null
  toGrade: { name: string } | null
  toCompany: { name: string } | null
  createdAt: string | Date
}

interface CompensationHistory {
  id: string
  changeType: string
  effectiveDate: string | Date
  newBaseSalary: string
  currency: string
}

interface EmployeeDocument {
  id: string
  docType: string
  title: string
  createdAt: string | Date
  fileKey: string
}

interface EmployeeData {
  id: string
  employeeNo: string
  name: string
  nameEn: string | null
  email: string
  phone: string | null
  birthDate: Date | string | null   // ISO string from server serialization
  gender: string | null
  hireDate: Date | string           // ISO string from server serialization
  assignments: Assignment[]
  profileExtension: ProfileExtension | null
  emergencyContacts: EmergencyContact[]
  profileVisibility: ProfileVisibility | null
  employeeHistories: EmployeeHistory[]
  compensationHistories: CompensationHistory[]
  employeeDocuments: EmployeeDocument[]
}

interface MyProfileClientProps {
  user: SessionUser
  employee: EmployeeData
  division: string | null
}

// ─── Constants ──────────────────────────────────────────────

const TAB_IDS = ['overview', 'career', 'compensation', 'documents', 'attendance', 'leave', 'performance'] as const
const TAB_ICONS = { overview: User, career: Briefcase, compensation: DollarSign, documents: FileText, attendance: Clock, leave: Calendar, performance: Award } as const

type TabId = (typeof TAB_IDS)[number]

const VISIBILITY_OPTIONS = ['public', 'team', 'manager', 'private'] as const

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(amountStr: string | null | undefined, currency: string = 'KRW'): string {
  if (!amountStr || amountStr === '0') return '-'
  const amount = Number(amountStr)
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount)
}

const CHANGE_TYPE_KEYS: Record<string, string> = {
  HIRE: 'HIRE', PROMOTION: 'PROMOTION', TRANSFER: 'TRANSFER',
  DEMOTION: 'DEMOTION', ANNUAL_INCREASE: 'ANNUAL_INCREASE',
  MARKET_ADJUSTMENT: 'MARKET_ADJUSTMENT', RESIGN: 'RESIGN',
}

const DOC_TYPE_KEYS: Record<string, string> = {
  CONTRACT: 'CONTRACT', ID_CARD: 'ID_CARD', CERTIFICATE: 'CERTIFICATE',
  RESUME: 'RESUME', HANDOVER: 'HANDOVER', OTHER: 'OTHER',
}

const VISIBILITY_BADGE_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  public: 'success',
  team: 'info',
  manager: 'warning',
  private: 'neutral',
}

// ─── Main Component ─────────────────────────────────────────

export function MyProfileClient({ user: _user, employee, division }: MyProfileClientProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('mySpace')

  const translateChangeType = useCallback((type: string) => {
    const key = CHANGE_TYPE_KEYS[type]
    return key ? t(`profile.changeType.${key}`) : type
  }, [t])

  const translateDocType = useCallback((type: string) => {
    const key = DOC_TYPE_KEYS[type]
    return key ? t(`profile.docType.${key}`) : type
  }, [t])

  const visibilityLabel = useCallback((level: string) => {
    return VISIBILITY_OPTIONS.includes(level as typeof VISIBILITY_OPTIONS[number])
      ? t(`profile.visibility.${level}`)
      : level
  }, [t])

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const tabNav = useArrowKeyNavigation(
    TAB_IDS.length,
    TAB_IDS.indexOf(activeTab),
    (i) => setActiveTab(TAB_IDS[i]),
  )
  // 요약 탭(근태/휴가/성과)은 최초 활성화 시 1회만 mount → fetch-once, 재진입 시 캐시 유지
  const [activatedTabs, setActivatedTabs] = useState<Set<TabId>>(() => new Set<TabId>(['overview']))
  useEffect(() => {
    setActivatedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)))
  }, [activeTab])
  const [ext, setExt] = useState<ProfileExtension>(
    employee.profileExtension ?? { bio: null, skills: [], languages: null, certifications: null, pronouns: null, timezone: null, avatarPath: null }
  )
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    (employee.profileVisibility as ProfileVisibility) ?? { personalPhone: 'manager', personalEmail: 'team', birthDate: 'team', address: 'private', emergencyContact: 'manager', bio: 'public', skills: 'public' }
  )
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(employee.emergencyContacts)

  // Sub-states for Overview
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue, setBioValue] = useState(ext.bio ?? '')
  const [newSkill, setNewSkill] = useState('')
  const [showEcForm, setShowEcForm] = useState(false)
  const [ecForm, setEcForm] = useState({ name: '', relationship: '', phone: '', isPrimary: false })
  const [ecSubmitting, setEcSubmitting] = useState(false)

  // Sub-states for Compensation
  const [showCompensation, setShowCompensation] = useState(false)

  // Change request dialog (AR-2: state isolated in ProfileChangeRequestDialog)
  const [changeReqField, setChangeReqField] = useState<'phone' | 'emergencyContact' | 'emergencyContactPhone' | 'name' | null>(null)
  const [changeRequests, setChangeRequests] = useState<{ id: string; fieldName: string; oldValue: string | null; newValue: string; status: string; rejectionReason: string | null; reviewedAt: string | null; reviewer: { id: string; name: string } | null; createdAt: string }[]>([])
  const [changeReqCurrentValue, setChangeReqCurrentValue] = useState('')

  const asgn = extractPrimaryAssignment(employee.assignments as unknown as Record<string, unknown>[]) as Assignment | undefined

  // ── Bio save ──
  const saveBio = useCallback(async () => {
    const updated = await apiClient.put<ProfileExtension>('/api/v1/employees/me/profile-extension', { bio: bioValue })
    if (updated.data) { setExt((prev) => ({ ...prev, bio: updated.data!.bio })); setEditingBio(false); toast({ title: tCommon('saved') }) }
    else toast({ title: tCommon('saveFailed'), description: tCommon('errorDesc'), variant: 'destructive' })
  }, [bioValue, tCommon])

  // ── Skill save ──
  const addSkill = useCallback(async () => {
    const trimmed = newSkill.trim()
    if (!trimmed || ext.skills.includes(trimmed)) return
    const nextSkills = [...ext.skills, trimmed]
    const updated = await apiClient.put<ProfileExtension>('/api/v1/employees/me/profile-extension', { skills: nextSkills })
    if (updated.data) { setExt((prev) => ({ ...prev, skills: updated.data!.skills })); setNewSkill('') }
  }, [newSkill, ext.skills])

  const removeSkill = useCallback(async (skill: string) => {
    const nextSkills = ext.skills.filter((s) => s !== skill)
    const updated = await apiClient.put<ProfileExtension>('/api/v1/employees/me/profile-extension', { skills: nextSkills })
    if (updated.data) setExt((prev) => ({ ...prev, skills: updated.data!.skills }))
  }, [ext.skills])

  // ── Emergency contact ──
  const addEmergencyContact = useCallback(async () => {
    if (ecSubmitting) return
    setEcSubmitting(true)
    try {
      const created = await apiClient.post<EmergencyContact>('/api/v1/employees/me/emergency-contacts', ecForm)
      if (created.data) {
        setEmergencyContacts((prev) => {
          const base = ecForm.isPrimary ? prev.map((c) => ({ ...c, isPrimary: false })) : prev
          return [...base, created.data!]
        })
        setEcForm({ name: '', relationship: '', phone: '', isPrimary: false })
        setShowEcForm(false)
      }
    } finally {
      setEcSubmitting(false)
    }
  }, [ecForm, ecSubmitting])

  const deleteEmergencyContact = useCallback(async (id: string) => {
    await apiClient.delete(`/api/v1/employees/me/emergency-contacts/${id}`)
    setEmergencyContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ── Visibility save ──
  const saveVisibility = useCallback(async (field: keyof ProfileVisibility, value: string) => {
    const updated = await apiClient.put<ProfileVisibility>('/api/v1/employees/me/visibility', { [field]: value })
    if (updated.data) setVisibility(updated.data)
  }, [])

  // ── Change request history fetch ──
  const fetchChangeRequests = useCallback(async () => {
    try {
      const res = await apiClient.get<typeof changeRequests>('/api/v1/profile/change-requests')
      if (res.data) setChangeRequests(res.data)
    } catch { /* silent — non-critical */ }
  }, [])

  useEffect(() => { fetchChangeRequests() }, [fetchChangeRequests])

  // Helper: check if field has pending request
  const hasPendingRequest = useCallback((field: string) => {
    return changeRequests.some((r) => r.fieldName === field && r.status === 'CHANGE_PENDING')
  }, [changeRequests])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Worker Banner (navy) — proto .wd-worker-banner */}
      <section
        aria-label={employee.name}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dim p-6 text-white"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-wd-orange/25 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="w-[70px] h-[70px] rounded-2xl bg-white/20 ring-2 ring-white/30 flex items-center justify-center text-2xl font-semibold text-white">
              {employee.name.slice(0, 1)}
            </div>
            <button
              type="button"
              onClick={() => toast({ title: t('profile.avatarComingSoonTitle'), description: t('profile.avatarComingSoonDesc') })}
              aria-label={t('profile.avatarComingSoonTitle')}
              className="absolute -bottom-2 -right-2 w-7 h-7 bg-white text-primary-dim rounded-full flex items-center justify-center shadow-sm hover:brightness-95 transition-[filter]"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-tight flex flex-wrap items-center gap-2">
                  {employee.name}
                  {employee.nameEn && <span className="text-xs font-normal font-mono text-white/70">{employee.nameEn}</span>}
                </h1>
                <p className="mt-1 text-sm text-white/90 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">
                    {[asgn?.title?.name, asgn?.position?.titleKo].filter(Boolean).join(' · ') || (asgn?.jobGrade?.name ?? '-')}
                  </span>
                  {([asgn?.company?.name, division, asgn?.department?.name].filter(Boolean) as string[]).map((x, idx) => (
                    <span key={idx} className="text-white/75">· {x}</span>
                  ))}
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" aria-hidden="true" />
                {t('profile.statusActive')}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-white/80">
              <span className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> {asgn?.jobGrade?.name ?? '-'}</span>
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {employee.employeeNo}</span>
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {employee.email}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Tabs */}
      <div
        role="tablist"
        aria-label={t('profile.tabsLabel')}
        onKeyDown={tabNav.onKeyDown}
        className="flex space-x-1 bg-muted p-1 rounded-xl overflow-x-auto"
      >
        {TAB_IDS.map((tabId, i) => {
          const isActive = activeTab === tabId
          const Icon = TAB_ICONS[tabId]
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              {...tabNav.itemProps(i)}
              onClick={() => setActiveTab(tabId)}
              className={`flex-1 shrink-0 min-w-[88px] whitespace-nowrap flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-card text-primary/90 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-border/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
              {t(`profile.tabs.${tabId}`)}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* At a Glance 위젯 */}
          {(() => {
            const primary = employee.assignments[0]
            const hireDateObj = new Date(employee.hireDate)
            const tenure = Math.floor((Date.now() - hireDateObj.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            const certCount = Array.isArray(ext.certifications) ? ext.certifications.length : 0
            const langCount = Array.isArray(ext.languages) ? ext.languages.length : 0

            return (
              <WdStatStrip
                items={[
                  {
                    label: t('atGlance.team'),
                    value: primary?.department?.name ?? '-',
                    icon: Building,
                    tone: 'info',
                    foot: primary?.jobGrade?.name ?? '-',
                  },
                  {
                    label: t('atGlance.tenure'),
                    value: `${tenure}${t('atGlance.years')}`,
                    icon: Calendar,
                    tone: 'success',
                    foot: `${formatDate(employee.hireDate)} ${t('atGlance.joined')}`,
                  },
                  {
                    label: t('atGlance.certLang'),
                    value: t('atGlance.certCount', { count: certCount }),
                    icon: Award,
                    tone: 'warning',
                    foot: t('atGlance.langCount', { count: langCount }),
                  },
                  {
                    label: t('atGlance.skills'),
                    value: `${ext.skills.length}${t('atGlance.skillCount')}`,
                    icon: Clock,
                    tone: 'default',
                    foot: ext.skills.slice(0, 2).join(', ') || '-',
                  },
                ]}
              />
            )
          })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* 기본 정보 / 인사 정보 */}
            <div className={CARD_STYLES.padded}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-foreground">{t('profile.hrInfo')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                {([
                  { label: t('profile.field.employeeNo'), value: employee.employeeNo },
                  { label: t('profile.field.hireDate'), value: formatDate(employee.hireDate) },
                  { label: t('profile.field.gender'), value: employee.gender ?? '-' },
                  { label: t('profile.field.birthDate'), value: formatDate(employee.birthDate) },
                  { label: t('profile.field.companyEmail'), value: employee.email },
                  { label: t('profile.field.personalPhone'), value: employee.phone ?? '-', fieldKey: 'phone' as const },
                ] as { label: string; value: string; fieldKey?: 'phone' | 'emergencyContact' | 'emergencyContactPhone' | 'name' }[]).map(({ label, value, fieldKey }) => (
                  <div key={label} className="border-b border-border pb-2 last:border-0 last:pb-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground font-medium">{value}</p>
                        {fieldKey && hasPendingRequest(fieldKey) && (
                          <Badge variant="warning">{t('profile.pending')}</Badge>
                        )}
                      </div>
                      {fieldKey && (
                        <button
                          onClick={() => { setChangeReqField(fieldKey); setChangeReqCurrentValue(value) }}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Pencil className="w-3 h-3" /> {t('profile.changeRequest')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 자기소개 */}
            <div className={CARD_STYLES.padded}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-foreground">{t('profile.bio')}</h2>
                {!editingBio && (
                  <button onClick={() => { setEditingBio(true); setBioValue(ext.bio ?? '') }} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <Edit3 className="w-3.5 h-3.5" /> {tCommon('edit')}
                  </button>
                )}
              </div>
              {editingBio ? (
                <div className="space-y-3">
                  <textarea
                    value={bioValue}
                    onChange={(e) => setBioValue(e.target.value)}
                    maxLength={500}
                    rows={4}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    placeholder={tCommon('placeholderSelfIntro')}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">{bioValue.length}/500</p>
                    <div className="flex gap-2">
                      <button onClick={saveBio} className={`flex items-center gap-1 ${BUTTON_VARIANTS.primary} px-3 py-1.5 rounded-lg text-sm font-medium`}>
                        <Save className="w-3.5 h-3.5" /> {tCommon('save')}
                      </button>
                      <button onClick={() => setEditingBio(false)} className="flex items-center gap-1 border border-border text-muted-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-muted motion-safe:transition-all">
                        <X className="w-3.5 h-3.5" /> {tCommon('cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {ext.bio ? ext.bio : <span className="text-muted-foreground italic">{t('profile.emptyBio')}</span>}
                </div>
              )}
            </div>

            {/* 스킬 */}
            <div className={CARD_STYLES.padded}>
              <h2 className="text-base font-semibold text-foreground mb-4">{t('profile.skills')}</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {ext.skills.map((skill) => (
                  <span key={skill} className="flex items-center gap-1.5 bg-primary/10 text-primary/90 px-3 py-1.5 rounded-full text-sm font-medium border border-primary/20 shadow-sm">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="hover:text-destructive transition-colors rounded-full hover:bg-primary/10 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {ext.skills.length === 0 && <p className="text-sm text-muted-foreground">{t('profile.emptySkills')}</p>}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSkill() }}
                  placeholder={tCommon('placeholderSkillAdd')}
                  maxLength={30}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                />
                <button onClick={addSkill} className={`${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-medium shadow-sm`}>
                  {t('profile.add')}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* 비상연락처 미니 위젯 */}
            <div className={`${CARD_STYLES.kpi} shadow-sm border border-border`}>
              <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-ctr-warning" />
                  {t('profile.emergencyContact')}
                </h2>
                <button onClick={() => setShowEcForm(true)} className="text-xs text-primary hover:underline font-medium">{t('profile.addAction')}</button>
              </div>
              
              {emergencyContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">{t('profile.emptyEmergencyContact')}</p>
              ) : (
                <div className="space-y-3">
                  {emergencyContacts.map((c) => (
                    <div key={c.id} className="group relative pr-6">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        {c.isPrimary && <Badge variant="warning">{t('profile.primary')}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{c.relationship} · {c.phone}</p>
                      <button onClick={() => deleteEmergencyContact(c.id)} className="absolute right-0 top-1/2 -translate-y-1/2 text-border hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 수정 요청 내역 */}
            {changeRequests.length > 0 && (
              <div className={`${CARD_STYLES.kpi} shadow-sm border border-border`}>
                <ChangeRequestHistory requests={changeRequests} />
              </div>
            )}

            {/* 공개 설정 위젯 */}
            <div className={`${CARD_STYLES.kpi} shadow-sm border border-border`}>
              <div className="flex items-center gap-1.5 border-b border-border pb-3 mb-3">
                <Globe className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t('profile.visibilitySettings')}</h2>
              </div>
              <div className="space-y-3">
                {([
                  { label: t('profile.visibilityField.personalPhone'), field: 'personalPhone' },
                  { label: t('profile.visibilityField.birthDate'), field: 'birthDate' },
                  { label: t('profile.visibilityField.skills'), field: 'skills' },
                ]).map(({ label, field }) => (
                  <div key={field} className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={VISIBILITY_BADGE_VARIANT[(visibility as unknown as Record<string, string>)[field]] ?? 'neutral'}>
                        {visibilityLabel((visibility as unknown as Record<string, string>)[field])}
                      </Badge>
                      <select
                        value={(visibility as any)[field] /* eslint-disable-line @typescript-eslint/no-explicit-any */}
                        onChange={(e) => saveVisibility(field as keyof ProfileVisibility, e.target.value)}
                        className="text-[10px] border border-border rounded px-1 py-0.5 focus:ring-1 focus:ring-primary/20 bg-card"
                      >
                        {VISIBILITY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{visibilityLabel(opt)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ── Tab: Career (직무 및 발령 이력) ── */}
      {activeTab === 'career' && (
        <div className={CARD_STYLES.padded}>
          <h2 className="text-lg font-semibold text-foreground mb-6">{t('profile.careerTimeline')}</h2>
          {employee.employeeHistories.length === 0 ? (
            <EmptyState title={t('profile.emptyCareerTitle')} description={t('profile.emptyCareerDesc')} />
          ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
              {employee.employeeHistories.map((hist) => (
                <div key={hist.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-primary text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10 mx-auto">
                    {hist.changeType === 'HIRE' ? <User className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                  </div>
                  
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-semibold text-primary/90 bg-primary/10 px-2 py-0.5 rounded-md">
                         {translateChangeType(hist.changeType)}
                       </span>
                       <span className="text-xs text-muted-foreground font-medium">{formatDate(hist.effectiveDate)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1">
                      {hist.toDept?.name ?? t('profile.noDept')} · {hist.toGrade?.name ?? t('profile.noGrade')}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {hist.toCompany?.name ?? (extractPrimaryAssignment(employee.assignments as unknown as Record<string, unknown>[]) as Assignment | undefined)?.company?.name ?? 'CTR Group'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Compensation (보상 및 급여) ── */}
      {activeTab === 'compensation' && (
        <div className="space-y-6">
          <div className={`${CARD_STYLES.padded} border border-border`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1 flex items-center gap-1.5">
                  {t('profile.currentSalary')}
                </p>
                <div className="flex items-baseline gap-3">
                  {showCompensation ? (
                    <h2 className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                      {employee.compensationHistories[0] ? formatCurrency(employee.compensationHistories[0].newBaseSalary, employee.compensationHistories[0].currency) : t('profile.noRecord')}
                    </h2>
                  ) : (
                    <h2 className="text-3xl font-bold text-muted-foreground/50 tracking-widest mt-1">
                      ••••••••
                    </h2>
                  )}
                  {showCompensation && employee.compensationHistories[0]?.currency && (
                    <span className="text-sm font-medium text-muted-foreground">{employee.compensationHistories[0].currency}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompensation(!showCompensation)}
                className="border border-border-strong bg-card text-foreground px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-muted flex items-center gap-1.5"
              >
                {showCompensation ? t('profile.hideSalary') : t('profile.showSalary')}
              </button>
            </div>
            <div className="mt-8 pt-4 border-t border-border flex gap-6 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">{t('profile.lastUpdated')}</p>
                <p className="font-medium text-foreground">{formatDate(employee.compensationHistories[0]?.effectiveDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">{t('profile.currency')}</p>
                <p className="font-medium text-foreground">{employee.compensationHistories[0]?.currency ?? 'KRW'}</p>
              </div>
            </div>
          </div>

          <div className={CARD_STYLES.padded}>
            <h3 className="text-base font-semibold text-foreground mb-4">{t('profile.salaryHistory')}</h3>
            {employee.compensationHistories.length === 0 ? (
               <EmptyState title={t('profile.noRecord')} description={t('profile.emptyCompensationDesc')} />
            ) : (
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>{t('profile.col.effectiveDate')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('profile.col.type')}</th>
                      <th className={TABLE_STYLES.headerCell + " text-right"}>{t('profile.col.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employee.compensationHistories.map((comp) => (
                      <tr key={comp.id} className={TABLE_STYLES.row}>
                        <td className={TABLE_STYLES.cell + " font-medium text-foreground"}>{formatDate(comp.effectiveDate)}</td>
                        <td className={TABLE_STYLES.cell}>
                          <span className="inline-flex bg-border text-muted-foreground px-2 py-0.5 rounded text-xs">
                            {translateChangeType(comp.changeType)}
                          </span>
                        </td>
                        <td className={TABLE_STYLES.cell + " text-right font-medium text-foreground"}>
                           {formatCurrency(comp.newBaseSalary, comp.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Documents (문서) ── */}
      {activeTab === 'documents' && (
        <div className={CARD_STYLES.padded}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-foreground">{t('profile.contractsAndCerts')}</h2>
            <button className={`${BUTTON_VARIANTS.secondary} text-xs px-3 py-1.5`}>
              {t('profile.requestCertificate')}
            </button>
          </div>
          
          {employee.employeeDocuments.length === 0 ? (
             <EmptyState title={t('profile.emptyDocsTitle')} description={t('profile.emptyDocsDesc')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employee.employeeDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center p-4 border border-border rounded-xl hover:shadow-sm hover:border-border transition-all bg-card group cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mr-4">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{doc.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                       <span>{translateDocType(doc.docType)}</span>
                       <span className="text-border">|</span>
                       <span>{formatDate(doc.createdAt)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Attendance (근태 요약) ── 활성화 후 mount 유지(fetch-once) ── */}
      {activatedTabs.has('attendance') && (
        <div hidden={activeTab !== 'attendance'}>
          <ProfileAttendanceTab />
        </div>
      )}

      {/* ── Tab: Leave (휴가 요약) ── */}
      {activatedTabs.has('leave') && (
        <div hidden={activeTab !== 'leave'}>
          <ProfileLeaveTab />
        </div>
      )}

      {/* ── Tab: Performance (성과 요약) ── */}
      {activatedTabs.has('performance') && (
        <div hidden={activeTab !== 'performance'}>
          <ProfilePerformanceTab />
        </div>
      )}

      {/* ── Drawer: Emergency Contact ── */}
      <WdDrawer
        open={showEcForm}
        onClose={() => setShowEcForm(false)}
        eyebrow={t('profile.selfService')}
        title={t('profile.addEmergencyContact')}
        closeDisabled={ecSubmitting}
        primary={{ label: tCommon('save'), onClick: addEmergencyContact, disabled: ecSubmitting }}
        secondary={{ label: tCommon('cancel'), onClick: () => setShowEcForm(false), disabled: ecSubmitting }}
      >
        <form onSubmit={(e) => { e.preventDefault(); void addEmergencyContact() }} className="flex flex-col gap-4">
        {(
          [
            { label: t('profile.ecField.name'), key: 'name', id: 'ec-name', placeholder: t('profile.ecPlaceholder.name') },
            { label: t('profile.ecField.relationship'), key: 'relationship', id: 'ec-relationship', placeholder: t('profile.ecPlaceholder.relationship') },
            { label: t('profile.ecField.phone'), key: 'phone', id: 'ec-phone', placeholder: t('profile.ecPlaceholder.phone') },
          ] as const
        ).map(({ label, key, id, placeholder }) => (
          <WdField key={key} label={label} htmlFor={id}>
            <input
              id={id}
              value={ecForm[key as keyof typeof ecForm] as string}
              onChange={(e) => setEcForm((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </WdField>
        ))}
        <WdRow>
          <label htmlFor="ec-primary" className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              id="ec-primary"
              type="checkbox"
              checked={ecForm.isPrimary}
              onChange={(e) => setEcForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
              className="w-4 h-4 rounded border-border-strong text-primary cursor-pointer"
            />
            {t('profile.setPrimary')}
          </label>
        </WdRow>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </WdDrawer>

      {/* ── Drawer: Change Request ── */}
      {/* Change Request Dialog (AR-2: isolated form state) */}
      <ProfileChangeRequestDialog
        open={changeReqField !== null}
        onOpenChange={(open) => { if (!open) setChangeReqField(null) }}
        fieldKey={changeReqField ?? 'phone'}
        currentValue={changeReqCurrentValue}
        onSuccess={fetchChangeRequests}
      />

    </div>
  )
}
