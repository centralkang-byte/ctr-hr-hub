'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

import { useTranslations } from 'next-intl'

import { useState, useCallback } from 'react'
import {
  User, Briefcase, DollarSign, FileText, Camera, CheckCircle2, XCircle,
  Edit3, Save, X, Plus, Trash2, Globe, Building, AlertCircle
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { CARD_STYLES, BUTTON_SIZES, BUTTON_VARIANTS,  MODAL_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface Assignment {
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string; code: string } | null
  company: { id: string; code: string; name: string } | null
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
    team: 'bg-[#E0E7FF] text-[#4338CA]',
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

export function MyProfileClient({ user: _user, employee }: MyProfileClientProps) {
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

  const asgn = employee.assignments[0]

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
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00C853]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#00C853] to-[#00A844] flex items-center justify-center text-white text-3xl font-bold shadow-md">
            {employee.name.slice(0, 1)}
          </div>
          <button
            onClick={() => toast({ title: 'Coming soon', description: '아바타 업로드는 곧 지원됩니다.' })}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border border-[#E8E8E8] rounded-full flex items-center justify-center shadow-sm hover:bg-[#FAFAFA] text-[#555] hover:text-[#00C853] transition-colors"
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
              <p className="text-[#00C853] font-medium mt-1">{asgn?.jobGrade?.name ?? '-'} · {asgn?.department?.name ?? '-'}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#00A844]">
                재직중
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#666]">
            <span className="flex items-center gap-1.5"><Building className="w-4 h-4 text-[#999]" /> {asgn?.company?.name ?? '-'}</span>
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
                  ? 'bg-white text-[#00A844] shadow-sm' 
                  : 'text-[#666] hover:text-[#333] hover:bg-[#E8E8E8]/50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? 'text-[#00C853]' : ''}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
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
                        <button onClick={action} className="text-xs text-[#00C853] hover:underline">수정 요청</button>
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
                  <button onClick={() => { setEditingBio(true); setBioValue(ext.bio ?? '') }} className="flex items-center gap-1 text-sm text-[#00C853] hover:underline">
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
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/20 focus:border-[#00C853] resize-none"
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
                  <span key={skill} className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#00A844] px-3 py-1.5 rounded-full text-sm font-medium border border-[#00C853]/20 shadow-sm">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="hover:text-[#DC2626] transition-colors rounded-full hover:bg-[#00C853]/10 p-0.5">
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
                  className="flex-1 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/20"
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
                <button onClick={() => setShowEcForm(true)} className="text-xs text-[#00C853] hover:underline font-medium">추가하기</button>
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
                <Globe className="w-4 h-4 text-[#6366F1]" />
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
                        className="text-[10px] border border-[#D4D4D4] rounded px-1 py-0.5 focus:ring-1 focus:ring-[#00C853]/20 bg-white"
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
      )}

      {/* ── Tab: Career (직무 및 발령 이력) ── */}
      {activeTab === 'career' && (
        <div className={CARD_STYLES.padded}>
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-6">사내 발령 타임라인</h2>
          {employee.employeeHistories.length === 0 ? (
            <EmptyState title="이력 없음" description="등록된 인사 발령 기록이 없습니다." />
          ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#E8F5E9] before:via-[#00C853]/20 before:to-transparent">
              {employee.employeeHistories.map((hist) => (
                <div key={hist.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-[#00C853] text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10 mx-auto">
                    {hist.changeType === 'HIRE' ? <User className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                  </div>
                  
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-xl border border-[#E8E8E8] bg-white shadow-sm hover:border-[#00C853]/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-semibold text-[#00A844] bg-[#E8F5E9] px-2 py-0.5 rounded-md">
                         {translateChangeType(hist.changeType)}
                       </span>
                       <span className="text-xs text-[#999] font-medium">{formatDate(hist.effectiveDate)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#1A1A1A] mb-1">
                      {hist.toDept?.name ?? '부서 미지정'} · {hist.toGrade?.name ?? '직급 미지정'}
                    </h3>
                    <p className="text-xs text-[#666]">
                      {hist.toCompany?.name ?? employee.assignments[0]?.company?.name ?? 'CTR Group'}
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
              <div className="border border-[#E8E8E8] rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-[#555] bg-[#F5F5F5] uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">적용일</th>
                      <th className="px-4 py-3">유형</th>
                      <th className="px-4 py-3 text-right">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.compensationHistories.map((comp) => (
                      <tr key={comp.id} className="border-b border-[#E8E8E8] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-3.5 font-medium text-[#333]">{formatDate(comp.effectiveDate)}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex bg-[#E8E8E8] text-[#555] px-2 py-0.5 rounded text-xs">
                            {translateChangeType(comp.changeType)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-[#1A1A1A]">
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
                  <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#00C853] shrink-0 mr-4">
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

    </div>
  )
}
