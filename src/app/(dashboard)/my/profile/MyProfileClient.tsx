'use client'

import { useTranslations } from 'next-intl'

import { useState, useCallback } from 'react'
import {
  User, Phone, AlertCircle, Eye, Camera, CheckCircle2, XCircle,
  Edit3, Save, X, Plus, Trash2, Globe
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
}

interface MyProfileClientProps {
  user: SessionUser
  employee: EmployeeData
}

// ─── Constants ──────────────────────────────────────────────

const TABS = [
  { id: 'basic', label: '기본 정보', icon: User },
  { id: 'contact', label: '연락처', icon: Phone },
  { id: 'emergency', label: '비상연락처', icon: AlertCircle },
  { id: 'visibility', label: '공개 설정', icon: Eye },
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

  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const [ext, setExt] = useState<ProfileExtension>(
    employee.profileExtension ?? { bio: null, skills: [], languages: null, certifications: null, pronouns: null, timezone: null, avatarPath: null }
  )
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    employee.profileVisibility ?? { personalPhone: 'manager', personalEmail: 'team', birthDate: 'team', address: 'private', emergencyContact: 'manager', bio: 'public', skills: 'public' }
  )
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(employee.emergencyContacts)

  // Bio editing
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue, setBioValue] = useState(ext.bio ?? '')

  // Skill editing
  const [newSkill, setNewSkill] = useState('')

  // Emergency contact form
  const [showEcForm, setShowEcForm] = useState(false)
  const [ecForm, setEcForm] = useState({ name: '', relationship: '', phone: '', isPrimary: false })

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('profileTitle')}</h1>
        <p className="text-sm text-[#666] mt-1">{t('profileDesc')}</p>
      </div>

      {/* Profile card */}
      <div className={`${CARD_STYLES.padded} flex items-center gap-5`}>
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#00C853] flex items-center justify-center text-white text-2xl font-bold">
            {employee.name.slice(0, 1)}
          </div>
          <button
            onClick={() => toast({ title: 'Coming soon', description: '아바타 업로드는 곧 지원됩니다.' })}
            className="absolute bottom-0 right-0 w-7 h-7 bg-white border border-[#E8E8E8] rounded-full flex items-center justify-center shadow-sm hover:bg-[#FAFAFA]"
          >
            <Camera className="w-3.5 h-3.5 text-[#555]" />
          </button>
        </div>
        <div>
          <p className="text-xl font-bold text-[#1A1A1A]">{employee.name}</p>
          {employee.nameEn && <p className="text-sm text-[#666]">{employee.nameEn}</p>}
          <p className="text-sm text-[#666] mt-1">{asgn?.department?.name ?? '-'} · {asgn?.jobGrade?.name ?? '-'}</p>
          <p className="text-xs text-[#999] mt-0.5">{asgn?.company?.name ?? '-'} · {employee.employeeNo}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: 기본 정보 ── */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          <div className={`${CARD_STYLES.kpi} space-y-4`}>
            <h2 className="text-base font-semibold text-[#1A1A1A]">인사 정보</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: '사원번호', value: employee.employeeNo },
                { label: '입사일', value: formatDate(employee.hireDate) },
                { label: '부서', value: asgn?.department?.name ?? '-' },
                { label: '직급', value: asgn?.jobGrade?.name ?? '-' },
                { label: '법인', value: asgn?.company?.name ?? '-' },
                { label: '성별', value: employee.gender ?? '-' },
                { label: '생년월일', value: formatDate(employee.birthDate) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-[#999] mb-0.5">{label}</p>
                  <p className="text-[#1A1A1A] font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bio */}
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
              <div className="space-y-2">
                <textarea
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853] resize-none"
                  placeholder="자기소개를 입력하세요..."
                />
                <p className="text-xs text-[#999] text-right">{bioValue.length}/500</p>
                <div className="flex gap-2">
                  <button onClick={saveBio} className={`flex items-center gap-1 ${BUTTON_VARIANTS.primary} px-3 py-1.5 rounded-lg text-sm font-medium`}>
                    <Save className="w-3.5 h-3.5" /> 저장
                  </button>
                  <button onClick={() => setEditingBio(false)} className="flex items-center gap-1 border border-[#D4D4D4] text-[#555] px-3 py-1.5 rounded-lg text-sm">
                    <X className="w-3.5 h-3.5" /> 취소
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#555]">{ext.bio ?? '아직 자기소개가 없습니다.'}</p>
            )}
          </div>

          {/* Skills */}
          <div className={CARD_STYLES.padded}>
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">스킬</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {ext.skills.map((skill) => (
                <span key={skill} className="flex items-center gap-1 bg-[#E8F5E9] text-[#00A844] px-2.5 py-1 rounded-full text-xs font-medium">
                  {skill}
                  <button onClick={() => removeSkill(skill)} className="hover:text-[#DC2626]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {ext.skills.length === 0 && <p className="text-sm text-[#999]">스킬을 추가하세요.</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addSkill() }}
                placeholder="스킬 추가 (Enter)"
                maxLength={50}
                className="flex-1 px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
              />
              <button onClick={addSkill} className={`${BUTTON_VARIANTS.primary} px-3 py-1.5 rounded-lg text-sm`}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: 연락처 ── */}
      {activeTab === 'contact' && (
        <div className={`${CARD_STYLES.kpi} space-y-4`}>
          <h2 className="text-base font-semibold text-[#1A1A1A]">연락처 정보</h2>
          <p className="text-xs text-[#999]">연락처 변경은 HR 검토 후 적용됩니다.</p>
          <div className="space-y-3">
            {[
              { label: '이메일 (회사)', value: employee.email, field: null },
              { label: '전화번호', value: employee.phone ?? '-', field: 'phone' },
              { label: '이름 변경', value: employee.name, field: 'name' },
            ].map(({ label, value, field }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0">
                <div>
                  <p className="text-xs text-[#999]">{label}</p>
                  <p className="text-sm text-[#1A1A1A] font-medium">{value}</p>
                </div>
                {field && (
                  <button
                    onClick={() => { setChangeReqField(field); setChangeReqValue(''); setChangeReqReason('') }}
                    className="text-xs text-[#00C853] hover:underline"
                  >
                    변경 요청
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: 비상연락처 ── */}
      {activeTab === 'emergency' && (
        <div className="space-y-4">
          <div className={CARD_STYLES.padded}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1A1A1A]">비상연락처</h2>
              <button onClick={() => setShowEcForm(true)} className={`flex items-center gap-1 ${BUTTON_VARIANTS.primary} px-3 py-1.5 rounded-lg text-sm font-medium`}>
                <Plus className="w-4 h-4" /> 추가
              </button>
            </div>
            {emergencyContacts.length === 0 ? (
              <p className="text-sm text-[#999] py-4 text-center">등록된 비상연락처가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {emergencyContacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#1A1A1A]">{c.name}</p>
                        {c.isPrimary && <span className="text-xs bg-[#E8F5E9] text-[#00A844] px-1.5 py-0.5 rounded-full">주요</span>}
                      </div>
                      <p className="text-xs text-[#666]">{c.relationship} · {c.phone}</p>
                    </div>
                    <button onClick={() => deleteEmergencyContact(c.id)} className="text-[#DC2626] hover:text-[#B91C1C] p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showEcForm && (
            <div className={`${CARD_STYLES.kpi} space-y-3`}>
              <h3 className="text-base font-semibold text-[#1A1A1A]">비상연락처 추가</h3>
              {[
                { label: '이름', key: 'name', placeholder: '홍길동' },
                { label: '관계', key: 'relationship', placeholder: '배우자, 부모님 등' },
                { label: '전화번호', key: 'phone', placeholder: '010-0000-0000' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-[#333] block mb-1">{label}</label>
                  <input
                    value={(ecForm as unknown as Record<string, string>)[key]}
                    onChange={(e) => setEcForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-[#333]">
                <input type="checkbox" checked={ecForm.isPrimary} onChange={(e) => setEcForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} className="rounded border-[#D4D4D4] text-[#00C853]" />
                주요 연락처로 설정
              </label>
              <div className="flex gap-2">
                <button onClick={addEmergencyContact} className={`${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-medium`}>저장</button>
                <button onClick={() => setShowEcForm(false)} className="border border-[#D4D4D4] text-[#555] px-4 py-2 rounded-lg text-sm">취소</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 공개 설정 ── */}
      {activeTab === 'visibility' && (
        <div className={CARD_STYLES.padded}>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-[#00C853]" />
            <h2 className="text-base font-semibold text-[#1A1A1A]">공개 설정</h2>
          </div>
          <p className="text-xs text-[#999] mb-4">각 항목의 공개 범위를 설정합니다.</p>
          <div className="space-y-3">
            {([
              { label: '전화번호', field: 'personalPhone' as keyof ProfileVisibility },
              { label: '이메일', field: 'personalEmail' as keyof ProfileVisibility },
              { label: '생년월일', field: 'birthDate' as keyof ProfileVisibility },
              { label: '주소', field: 'address' as keyof ProfileVisibility },
              { label: '비상연락처', field: 'emergencyContact' as keyof ProfileVisibility },
              { label: '자기소개', field: 'bio' as keyof ProfileVisibility },
              { label: '스킬', field: 'skills' as keyof ProfileVisibility },
            ]).map(({ label, field }) => (
              <div key={field} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0">
                <p className="text-sm text-[#333]">{label}</p>
                <div className="flex items-center gap-2">
                  <VisibilityBadge level={visibility[field]} />
                  <select
                    value={visibility[field]}
                    onChange={(e) => saveVisibility(field, e.target.value)}
                    className="text-xs border border-[#D4D4D4] rounded-lg px-2 py-1 focus:ring-2 focus:ring-[#00C853]/10"
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
      )}

      {/* ── Change Request Modal ── */}
      {changeReqField && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">변경 요청</h3>
              <button onClick={() => setChangeReqField(null)} className="text-[#999] hover:text-[#333]"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-[#666]">변경 사항은 HR 담당자 검토 후 적용됩니다.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-[#333] block mb-1">새 값</label>
                <input
                  value={changeReqValue}
                  onChange={(e) => setChangeReqValue(e.target.value)}
                  placeholder="변경할 새 값을 입력하세요"
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] block mb-1">사유 (선택)</label>
                <textarea
                  value={changeReqReason}
                  onChange={(e) => setChangeReqReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="변경 사유를 입력하세요..."
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={submitChangeRequest}
                disabled={savingChangeReq || !changeReqValue.trim()}
                className={`flex-1 inline-flex items-center justify-center gap-1 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary} disabled:opacity-50`}
              >
                <CheckCircle2 className="w-4 h-4" /> 요청 제출
              </button>
              <button onClick={() => setChangeReqField(null)} className="flex-1 border border-[#D4D4D4] text-[#555] py-2 rounded-lg text-sm flex items-center justify-center gap-1">
                <XCircle className="w-4 h-4" /> 취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
