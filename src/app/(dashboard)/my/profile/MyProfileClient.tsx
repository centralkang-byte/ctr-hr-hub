'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

import { useTranslations } from 'next-intl'

import { useState, useCallback } from 'react'
import {
  User, Briefcase, DollarSign, FileText, Camera, CheckCircle2, XCircle,
  Edit3, Save, X, Plus, Trash2, Globe, Building, AlertCircle,
  Calendar, Clock, Award
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { CARD_STYLES, BUTTON_SIZES, BUTTON_VARIANTS,  MODAL_STYLES, TABLE_STYLES } from '@/lib/styles'
import { extractPrimaryAssignment } from '@/lib/employee/extract-primary-assignment'

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

const TABS = [
  { id: 'overview', label: '개요', icon: User },
  { id: 'career', label: '직무 및 이력', icon: Briefcase },
  { id: 'compensation', label: '보상 및 급여', icon: DollarSign },
  { id: 'documents', label: '문서', icon: FileText },
] as const

type TabId = (typeof TABS)[number]['id']

const VISIBILITY_LABELS: Record<string, string> = {
  public: '전체 공개',
  team: '팀원만',
  manager: '매니저만',
  private: '비공개',
}

const VISIBILITY_OPTIONS = ['public', 'team', 'manager', 'private'] as const

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatCurrency(amountStr: string | null | undefined, currency: string = 'KRW'): string {
  if (!amountStr || amountStr === '0') return '-'
  const amount = Number(amountStr)
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount)
}

function translateChangeType(type: string): string {
  const map: Record<string, string> = {
    HIRE: '입사',
    PROMOTION: '승진',
    TRANSFER: '부서 이동',
    DEMOTION: '강등',
    ANNUAL_INCREASE: '정규 인상',
    MARKET_ADJUSTMENT: '시장 조정',
    RESIGN: '퇴사',
  }
  return map[type] || type
}

function translateDocType(type: string): string {
  const map: Record<string, string> = {
    CONTRACT: '계약서',
    ID_CARD: '신분증 사본',
    CERTIFICATE: '증명서',
    RESUME: '이력서',
    HANDOVER: '인수인계서',
    OTHER: '기타'
  }
  return map[type] || type
}

function VisibilityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    public: 'bg-[#D1FAE5] text-[#047857]',
    team: 'bg-[#E0E7FF] text-[#4B6DE0]',
    manager: 'bg-[#FEF3C7] text-[#B45309]',
    private: 'bg-[#F5F5F5] text-[#555]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[level] ?? colors.private}`}>
      {VISIBILITY_LABELS[level] ?? level}
    </span>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function MyProfileClient({ user: _user, employee, division }: MyProfileClientProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('mySpace')

  const [activeTab, setActiveTab] = useState<TabId>('overview')
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

  // Sub-states for Compensation
  const [showCompensation, setShowCompensation] = useState(false)

  // Change request dialog
  const [changeReqField, setChangeReqField] = useState<string | null>(null)
  const [changeReqValue, setChangeReqValue] = useState('')
  const [changeReqReason, setChangeReqReason] = useState('')
  const [savingChangeReq, setSavingChangeReq] = useState(false)

  const asgn = extractPrimaryAssignment(employee.assignments as unknown as Record<string, unknown>[]) as Assignment | undefined

  // ── Bio save ──
  const saveBio = useCallback(async () => {
    const updated = await apiClient.put<ProfileExtension>('/api/v1/employees/me/profile-extension', { bio: bioValue })
    if (updated.data) { setExt((prev) => ({ ...prev, bio: updated.data!.bio })); setEditingBio(false); toast({ title: tCommon('saved') }) }
    else toast({ title: tCommon('saveFailed'), description: tCommon('errorDesc'), variant: 'destructive' })
  }, [bioValue])

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
    const created = await apiClient.post<EmergencyContact>('/api/v1/employees/me/emergency-contacts', ecForm)
    if (created.data) {
      setEmergencyContacts((prev) => {
        const base = ecForm.isPrimary ? prev.map((c) => ({ ...c, isPrimary: false })) : prev
        return [...base, created.data!]
      })
      setEcForm({ name: '', relationship: '', phone: '', isPrimary: false })
      setShowEcForm(false)
    }
  }, [ecForm])

  const deleteEmergencyContact = useCallback(async (id: string) => {
    await apiClient.delete(`/api/v1/employees/me/emergency-contacts/${id}`)
    setEmergencyContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ── Visibility save ──
  const saveVisibility = useCallback(async (field: keyof ProfileVisibility, value: string) => {
    const updated = await apiClient.put<ProfileVisibility>('/api/v1/employees/me/visibility', { [field]: value })
    if (updated.data) setVisibility(updated.data)
  }, [])

  // ── Change request ──
  const submitChangeRequest = useCallback(async () => {
    if (!changeReqField || !changeReqValue.trim()) return
    setSavingChangeReq(true)
    const res = await apiClient.post('/api/v1/profile/change-requests', {
      fieldName: changeReqField,
      newValue: changeReqValue.trim(),
      reason: changeReqReason.trim() || undefined,
    })
    setSavingChangeReq(false)
    if (res.data) {
      toast({ title: t('changeReqDone'), description: t('changeReqDesc') })
      setChangeReqField(null)
      setChangeReqValue('')
      setChangeReqReason('')
    }
  }, [changeReqField, changeReqValue, changeReqReason])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Profile Card */}
      <div className={`${CARD_STYLES.padded} flex items-start gap-6 relative overflow-hidden`}>
        {/* Decorative background shape */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#5E81F4]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-[#5E81F4] to-[#4B6DE0] flex items-center justify-center text-white text-3xl font-bold shadow-md">
            {employee.name.slice(0, 1)}
          </div>
          <button
            onClick={() => toast({ title: '준비 중', description: '아바타 업로드는 곧 지원됩니다.' })}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border border-[#E8E8E8] rounded-full flex items-center justify-center shadow-sm hover:bg-[#FAFAFA] text-[#555] hover:text-[#5E81F4] transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
                {employee.name}
                {employee.nameEn && <span className="text-sm font-normal text-[#666]">({employee.nameEn})</span>}
              </h1>
              <p className="text-[#5E81F4] font-medium mt-1">
                {[asgn?.title?.name, asgn?.position?.titleKo].filter(Boolean).join(' · ') || (asgn?.jobGrade?.name ?? '-')}
              </p>
              <p className="text-sm text-[#999] mt-0.5">
                {[asgn?.company?.name, division, asgn?.department?.name].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#EDF1FE] text-[#4B6DE0]">
                재직중
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#666]">
            <span className="flex items-center gap-1.5"><Building className="w-4 h-4 text-[#999]" /> {asgn?.jobGrade?.name ?? '-'}</span>
            <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-[#999]" /> {employee.employeeNo}</span>
            <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-[#999]" /> {employee.email}</span>
          </div>
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="flex space-x-1 bg-[#F5F5F5] p-1 rounded-xl">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isActive 
                  ? 'bg-white text-[#4B6DE0] shadow-sm' 
                  : 'text-[#666] hover:text-[#333] hover:bg-[#E8E8E8]/50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? 'text-[#5E81F4]' : ''}`} />
              {tab.label}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={CARD_STYLES.padded}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Building className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-muted-foreground">{t('atGlance.team')}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{primary?.department?.name ?? '-'}</p>
                  <p className="text-xs text-muted-foreground truncate">{primary?.jobGrade?.name ?? '-'}</p>
                </div>

                <div className={CARD_STYLES.padded}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-muted-foreground">{t('atGlance.tenure')}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{tenure}{t('atGlance.years')}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(employee.hireDate)} {t('atGlance.joined')}</p>
                </div>

                <div className={CARD_STYLES.padded}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Award className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-muted-foreground">{t('atGlance.certLang')}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t('atGlance.certCount', { count: certCount })}</p>
                  <p className="text-xs text-muted-foreground">{t('atGlance.langCount', { count: langCount })}</p>
                </div>

                <div className={CARD_STYLES.padded}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Clock className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-muted-foreground">{t('atGlance.skills')}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{ext.skills.length}{t('atGlance.skillCount')}</p>
                  <p className="text-xs text-muted-foreground">{ext.skills.slice(0, 2).join(', ') || '-'}</p>
                </div>
              </div>
            )
          })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* 기본 정보 / 인사 정보 */}
            <div className={CARD_STYLES.padded}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-[#1A1A1A]">인사 정보</h2>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                {[
                  { label: '사원번호', value: employee.employeeNo },
                  { label: '입사일', value: formatDate(employee.hireDate) },
                  { label: '성별', value: employee.gender ?? '-' },
                  { label: '생년월일', value: formatDate(employee.birthDate) },
                  { label: '이메일 (회사)', value: employee.email },
                  { label: '연락처 (개인)', value: employee.phone ?? '-', action: () => { setChangeReqField('phone'); setChangeReqValue(''); setChangeReqReason('') } },
                ].map(({ label, value, action }) => (
                  <div key={label} className="border-b border-[#F5F5F5] pb-2 last:border-0 last:pb-0">
                    <p className="text-xs text-[#999] mb-0.5">{label}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-[#1A1A1A] font-medium">{value}</p>
                      {action && (
                        <button onClick={action} className="text-xs text-[#5E81F4] hover:underline">수정 요청</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 자기소개 */}
            <div className={CARD_STYLES.padded}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-[#1A1A1A]">자기소개</h2>
                {!editingBio && (
                  <button onClick={() => { setEditingBio(true); setBioValue(ext.bio ?? '') }} className="flex items-center gap-1 text-sm text-[#5E81F4] hover:underline">
                    <Edit3 className="w-3.5 h-3.5" /> 편집
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
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/20 focus:border-[#5E81F4] resize-none"
                    placeholder={tCommon('placeholderSelfIntro')}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-[#999]">{bioValue.length}/500</p>
                    <div className="flex gap-2">
                      <button onClick={saveBio} className={`flex items-center gap-1 ${BUTTON_VARIANTS.primary} px-3 py-1.5 rounded-lg text-sm font-medium`}>
                        <Save className="w-3.5 h-3.5" /> 저장
                      </button>
                      <button onClick={() => setEditingBio(false)} className="flex items-center gap-1 border border-[#D4D4D4] text-[#555] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5F5F5]">
                        <X className="w-3.5 h-3.5" /> 취소
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#333] whitespace-pre-wrap leading-relaxed">
                  {ext.bio ? ext.bio : <span className="text-[#999] italic">아직 작성된 자기소개가 없습니다.</span>}
                </div>
              )}
            </div>

            {/* 스킬 */}
            <div className={CARD_STYLES.padded}>
              <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">보유 스킬</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {ext.skills.map((skill) => (
                  <span key={skill} className="flex items-center gap-1.5 bg-[#EDF1FE] text-[#4B6DE0] px-3 py-1.5 rounded-full text-sm font-medium border border-[#5E81F4]/20 shadow-sm">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="hover:text-[#DC2626] transition-colors rounded-full hover:bg-[#5E81F4]/10 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {ext.skills.length === 0 && <p className="text-sm text-[#999]">등록된 스킬이 없습니다.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSkill() }}
                  placeholder={tCommon('placeholderSkillAdd')}
                  maxLength={30}
                  className="flex-1 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/20"
                />
                <button onClick={addSkill} className={`${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-medium shadow-sm`}>
                  추가
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* 비상연락처 미니 위젯 */}
            <div className={`${CARD_STYLES.kpi} shadow-sm border border-[#E8E8E8]`}>
              <div className="flex items-center justify-between border-b border-[#F5F5F5] pb-3 mb-3">
                <h2 className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                  비상연락처
                </h2>
                <button onClick={() => setShowEcForm(true)} className="text-xs text-[#5E81F4] hover:underline font-medium">추가하기</button>
              </div>
              
              {emergencyContacts.length === 0 ? (
                <p className="text-xs text-[#999] py-2 text-center">등록된 비상연락처가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {emergencyContacts.map((c) => (
                    <div key={c.id} className="group relative pr-6">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-[#1A1A1A]">{c.name}</p>
                        {c.isPrimary && <span className="text-[10px] bg-[#FEF3C7] text-[#B45309] px-1.5 py-0.5 rounded-sm">주요</span>}
                      </div>
                      <p className="text-xs text-[#666]">{c.relationship} · {c.phone}</p>
                      <button onClick={() => deleteEmergencyContact(c.id)} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#D4D4D4] hover:text-[#DC2626] opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 공개 설정 위젯 */}
            <div className={`${CARD_STYLES.kpi} shadow-sm border border-[#E8E8E8]`}>
              <div className="flex items-center gap-1.5 border-b border-[#F5F5F5] pb-3 mb-3">
                <Globe className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="text-sm font-semibold text-[#1A1A1A]">공개 범위 설정</h2>
              </div>
              <div className="space-y-3">
                {([
                  { label: '내 연락처', field: 'personalPhone' },
                  { label: '생일 정보', field: 'birthDate' },
                  { label: '보유 스킬', field: 'skills' },
                ]).map(({ label, field }) => (
                  <div key={field} className="flex items-center justify-between">
                    <p className="text-xs text-[#555]">{label}</p>
                    <div className="flex items-center gap-1.5">
                      <VisibilityBadge level={(visibility as any)[field]} />
                      <select
                        value={(visibility as any)[field]}
                        onChange={(e) => saveVisibility(field as keyof ProfileVisibility, e.target.value)}
                        className="text-[10px] border border-[#D4D4D4] rounded px-1 py-0.5 focus:ring-1 focus:ring-[#5E81F4]/20 bg-white"
                      >
                        {VISIBILITY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{VISIBILITY_LABELS[opt]}</option>
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
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-6">사내 발령 타임라인</h2>
          {employee.employeeHistories.length === 0 ? (
            <EmptyState title="이력 없음" description="등록된 인사 발령 기록이 없습니다." />
          ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#EDF1FE] before:via-[#5E81F4]/20 before:to-transparent">
              {employee.employeeHistories.map((hist) => (
                <div key={hist.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-[#5E81F4] text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10 mx-auto">
                    {hist.changeType === 'HIRE' ? <User className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                  </div>
                  
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-xl border border-[#E8E8E8] bg-white shadow-sm hover:border-[#5E81F4]/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-semibold text-[#4B6DE0] bg-[#EDF1FE] px-2 py-0.5 rounded-md">
                         {translateChangeType(hist.changeType)}
                       </span>
                       <span className="text-xs text-[#999] font-medium">{formatDate(hist.effectiveDate)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#1A1A1A] mb-1">
                      {hist.toDept?.name ?? '부서 미지정'} · {hist.toGrade?.name ?? '직급 미지정'}
                    </h3>
                    <p className="text-xs text-[#666]">
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
          <div className={`${CARD_STYLES.padded} bg-gradient-to-br from-[#111] to-[#333] text-white border-none shadow-lg relative overflow-hidden`}>
            {/* Decals */}
            <DollarSign className="absolute -right-10 -bottom-10 w-48 h-48 text-white/5 pointer-events-none" />
            
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-sm text-white/70 font-medium mb-1 flex items-center gap-1.5">
                  현재 계약 연봉
                </p>
                <div className="flex items-baseline gap-3">
                  {showCompensation ? (
                    <h2 className="text-3xl font-bold tracking-tight">
                      {employee.compensationHistories[0] ? formatCurrency(employee.compensationHistories[0].newBaseSalary, employee.compensationHistories[0].currency) : '기록 없음'}
                    </h2>
                  ) : (
                    <h2 className="text-3xl font-bold text-white/40 tracking-widest mt-1">
                      ••••••••
                    </h2>
                  )}
                  {showCompensation && employee.compensationHistories[0]?.currency && (
                    <span className="text-sm font-medium text-white/60">{employee.compensationHistories[0].currency}</span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowCompensation(!showCompensation)}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-white/10 flex items-center gap-1.5 backdrop-blur-sm"
              >
                {showCompensation ? '숨기기' : '금액 보기'}
              </button>
            </div>
            <div className="mt-8 pt-4 border-t border-white/10 flex gap-6 text-sm relative z-10">
              <div>
                <p className="text-white/50 text-xs mb-0.5">최근 업데이트</p>
                <p className="font-medium">{formatDate(employee.compensationHistories[0]?.effectiveDate)}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-0.5">지급 통화</p>
                <p className="font-medium">{employee.compensationHistories[0]?.currency ?? 'KRW'}</p>
              </div>
            </div>
          </div>

          <div className={CARD_STYLES.padded}>
            <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">연봉 변동 이력</h3>
            {employee.compensationHistories.length === 0 ? (
               <EmptyState title="기록 없음" description="보상 이력이 존재하지 않습니다." />
            ) : (
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>적용일</th>
                      <th className={TABLE_STYLES.headerCell}>유형</th>
                      <th className={TABLE_STYLES.headerCell + " text-right"}>금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F3]">
                    {employee.compensationHistories.map((comp) => (
                      <tr key={comp.id} className={TABLE_STYLES.row}>
                        <td className={TABLE_STYLES.cell + " font-medium text-[#333]"}>{formatDate(comp.effectiveDate)}</td>
                        <td className={TABLE_STYLES.cell}>
                          <span className="inline-flex bg-[#E8E8E8] text-[#555] px-2 py-0.5 rounded text-xs">
                            {translateChangeType(comp.changeType)}
                          </span>
                        </td>
                        <td className={TABLE_STYLES.cell + " text-right font-medium text-[#1A1A1A]"}>
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
            <h2 className="text-lg font-semibold text-[#1A1A1A]">계약 및 증명서</h2>
            <button className={`${BUTTON_VARIANTS.secondary} text-xs px-3 py-1.5`}>
              증명서 발급 신청
            </button>
          </div>
          
          {employee.employeeDocuments.length === 0 ? (
             <EmptyState title="문서 없음" description="등록된 인사 문서가 없습니다." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employee.employeeDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center p-4 border border-[#E8E8E8] rounded-xl hover:shadow-sm hover:border-[#D4D4D4] transition-all bg-white group cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-[#EDF1FE] flex items-center justify-center text-[#5E81F4] shrink-0 mr-4">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#1A1A1A] truncate">{doc.title}</h4>
                    <p className="text-xs text-[#666] mt-0.5 flex gap-2">
                       <span>{translateDocType(doc.docType)}</span>
                       <span className="text-[#D4D4D4]">|</span>
                       <span>{formatDate(doc.createdAt)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Emergency Contact ── */}
      {showEcForm && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">비상연락처 추가</h3>
              <button onClick={() => setShowEcForm(false)} className="text-[#999] hover:text-[#333]"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {(
                [
                  { label: '이름', key: 'name', placeholder: '홍길동' },
                  { label: '관계', key: 'relationship', placeholder: '배우자, 부모님 등' },
                  { label: '전화번호', key: 'phone', placeholder: '010-0000-0000' },
                ] as const
              ).map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-[#333] block mb-1">{label}</label>
                  <input
                    value={ecForm[key as keyof typeof ecForm] as string}
                    onChange={(e) => setEcForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/20 focus:border-[#5E81F4]"
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-[#333] pt-2 cursor-pointer">
                <input type="checkbox" checked={ecForm.isPrimary} onChange={(e) => setEcForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} className="w-4 h-4 rounded border-[#D4D4D4] text-[#5E81F4] cursor-pointer" />
                주요 연락처로 설정
              </label>
            </div>
            <div className="flex gap-2 pt-4 border-t border-[#F5F5F5]">
              <button onClick={addEmergencyContact} className={`flex-1 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}>
                {tCommon('save')}
              </button>
              <button onClick={() => setShowEcForm(false)} className={`flex-1 border border-[#D4D4D4] text-[#555] rounded-xl text-sm font-medium hover:bg-[#F5F5F5] py-2`}>
                {tCommon('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Change Request ── */}
      {changeReqField && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">정보 변경 요청</h3>
              <button onClick={() => setChangeReqField(null)} className="text-[#999] hover:text-[#333]"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-[#666] bg-[#F5F5F5] p-3 rounded-lg border border-[#E8E8E8]">
              핵심 인사 정보 변경은 HR 담당자의 승인 후 최종 반영됩니다.
            </p>
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-sm font-medium text-[#333] block mb-1">새로운 값 명시</label>
                <input
                  value={changeReqValue}
                  onChange={(e) => setChangeReqValue(e.target.value)}
                  placeholder={tCommon('placeholderChangeNewValue')}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/20 focus:border-[#5E81F4]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] block mb-1">변경 사유 (선택)</label>
                <textarea
                  value={changeReqReason}
                  onChange={(e) => setChangeReqReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={tCommon('placeholderChangeReason')}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/20 focus:border-[#5E81F4] resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-[#F5F5F5]">
              <button
                onClick={submitChangeRequest}
                disabled={savingChangeReq || !changeReqValue.trim()}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary} disabled:opacity-50`}
              >
                <CheckCircle2 className="w-4 h-4" /> 요청 제출
              </button>
              <button onClick={() => setChangeReqField(null)} className="flex-1 border border-[#D4D4D4] text-[#555] py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-[#F5F5F5]">
                <XCircle className="w-4 h-4" /> 취소
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
