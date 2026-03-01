'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Interview Form
// 면접 일정 등록
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface ApplicantOption {
  id: string
  applicationId: string
  applicantName: string
  stage: string
}

interface EmployeeOption {
  id: string
  name: string
  employeeNo: string
  departmentName: string | null
}

// ─── Constants ──────────────────────────────────────────────

const STAGE_KEYS: Record<string, string> = {
  APPLIED: 'stageShortAPPLIED',
  SCREENING: 'stageShortSCREENING',
  INTERVIEW_1: 'stageShortINTERVIEW_1',
  INTERVIEW_2: 'stageShortINTERVIEW_2',
  FINAL: 'stageShortFINAL',
  OFFER: 'stageShortOFFER',
  HIRED: 'stageShortHIRED',
  REJECTED: 'stageShortREJECTED',
}

// ─── Form State ─────────────────────────────────────────────

interface FormState {
  applicationId: string
  interviewerId: string
  scheduledAt: string
  durationMinutes: number
  interviewType: string
  round: string
  location: string
  meetingLink: string
}

const INITIAL_FORM: FormState = {
  applicationId: '',
  interviewerId: '',
  scheduledAt: '',
  durationMinutes: 60,
  interviewType: 'ONSITE',
  round: 'FIRST',
  location: '',
  meetingLink: '',
}

// ─── Component ──────────────────────────────────────────────

export function InterviewFormClient({
  postingId,
}: {
  user: SessionUser
  postingId: string
}) {
  const router = useRouter()
  const t = useTranslations('recruitment')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  // ─── Options (use t() for labels) ─────────────────────
  const INTERVIEW_TYPE_OPTIONS = [
    { value: 'PHONE', label: t('typePHONE') },
    { value: 'VIDEO', label: t('typeVIDEO') },
    { value: 'ONSITE', label: t('typeONSITE') },
    { value: 'PANEL', label: t('typePANEL') },
  ]

  const ROUND_OPTIONS = [
    { value: 'FIRST', label: t('roundFIRST') },
    { value: 'SECOND', label: t('roundSECOND') },
    { value: 'FINAL', label: t('roundFINAL') },
  ]

  // Applicant options
  const [applicants, setApplicants] = useState<ApplicantOption[]>([])
  const [loadingApplicants, setLoadingApplicants] = useState(true)

  // Employee (interviewer) options
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('')

  // ─── Fetch applicants ──────────────────────────────────────

  useEffect(() => {
    async function loadApplicants() {
      setLoadingApplicants(true)
      try {
        const res = await apiClient.getList<{
          id: string
          stage: string
          applicant: { id: string; name: string }
        }>(`/api/v1/recruitment/postings/${postingId}/applicants`, {
          limit: 200,
        })
        setApplicants(
          res.data.map((app) => ({
            id: app.applicant.id,
            applicationId: app.id,
            applicantName: app.applicant.name,
            stage: app.stage,
          })),
        )
      } catch {
        // Error handled by apiClient
      } finally {
        setLoadingApplicants(false)
      }
    }
    void loadApplicants()
  }, [postingId])

  // ─── Search employees ──────────────────────────────────────

  const searchEmployees = useCallback(async (q: string) => {
    if (q.length < 1) {
      setEmployees([])
      return
    }
    setLoadingEmployees(true)
    try {
      const res = await apiClient.getList<{
        id: string
        name: string
        employeeNo: string
        department: { name: string } | null
      }>('/api/v1/employees', { search: q, limit: 10 })
      setEmployees(
        res.data.map((e) => ({
          id: e.id,
          name: e.name,
          employeeNo: e.employeeNo,
          departmentName: e.department?.name ?? null,
        })),
      )
    } catch {
      // Error handled by apiClient
    } finally {
      setLoadingEmployees(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchEmployees(employeeSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [employeeSearch, searchEmployees])

  // ─── Helpers ──────────────────────────────────────────────

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSelectEmployee = (emp: EmployeeOption) => {
    updateField('interviewerId', emp.id)
    setSelectedEmployeeName(emp.name)
    setEmployeeSearch('')
    setShowEmployeeDropdown(false)
  }

  const isValid =
    form.applicationId !== '' &&
    form.interviewerId !== '' &&
    form.scheduledAt !== ''

  // ─── Submit ───────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/recruitment/interviews', {
        applicationId: form.applicationId,
        interviewerId: form.interviewerId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: form.durationMinutes,
        interviewType: form.interviewType,
        round: form.round,
        location: form.location || null,
        meetingLink: form.meetingLink || null,
        status: 'SCHEDULED',
      })
      router.push(`/recruitment/${postingId}/interviews`)
    } catch {
      // Error handled by apiClient
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title={t('interviewFormTitle')}
        description={t('interviewFormDescription')}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/recruitment/${postingId}/interviews`)
            }
            style={{ borderRadius: 8 }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToList')}
          </Button>
        }
      />

      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: 12,
          padding: 24,
          maxWidth: 640,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Applicant Select */}
          <div>
            <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
              {t('selectApplicant')}
            </Label>
            <Select
              value={form.applicationId}
              onValueChange={(val) => updateField('applicationId', val)}
              disabled={loadingApplicants}
            >
              <SelectTrigger style={{ marginTop: 6, borderRadius: 8 }}>
                <SelectValue
                  placeholder={
                    loadingApplicants ? t('loadingApplicants') : t('selectApplicantPlaceholder')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {applicants.map((a) => (
                  <SelectItem key={a.applicationId} value={a.applicationId}>
                    {a.applicantName} ({STAGE_KEYS[a.stage] ? t(STAGE_KEYS[a.stage]) : a.stage})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interviewer Search */}
          <div style={{ position: 'relative' }}>
            <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
              {t('interviewerFormLabel')}
            </Label>
            {selectedEmployeeName ? (
              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #E8E8E8',
                    flex: 1,
                    fontSize: 14,
                    color: '#333',
                    backgroundColor: '#FAFAFA',
                  }}
                >
                  {selectedEmployeeName}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedEmployeeName('')
                    updateField('interviewerId', '')
                  }}
                  style={{ borderRadius: 8 }}
                >
                  {t('changeButton')}
                </Button>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#999',
                    }}
                  />
                  <Input
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value)
                      setShowEmployeeDropdown(true)
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    placeholder={t('searchEmployeePlaceholder')}
                    style={{ paddingLeft: 34, borderRadius: 8 }}
                  />
                </div>
                {showEmployeeDropdown && (employeeSearch.length > 0) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E8E8E8',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      maxHeight: 200,
                      overflowY: 'auto',
                      marginTop: 4,
                    }}
                  >
                    {loadingEmployees ? (
                      <div
                        style={{
                          padding: 12,
                          textAlign: 'center',
                          color: '#999',
                          fontSize: 13,
                        }}
                      >
                        {t('searching')}
                      </div>
                    ) : employees.length === 0 ? (
                      <div
                        style={{
                          padding: 12,
                          textAlign: 'center',
                          color: '#999',
                          fontSize: 13,
                        }}
                      >
                        {t('noSearchResults')}
                      </div>
                    ) : (
                      employees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            color: '#333',
                            borderBottom: '1px solid #F5F5F5',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#FAFAFA'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{emp.name}</span>
                          <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                            {emp.employeeNo}
                            {emp.departmentName ? ` · ${emp.departmentName}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scheduled At */}
          <div>
            <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
              {t('scheduledAtLabel')}
            </Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => updateField('scheduledAt', e.target.value)}
              style={{ marginTop: 6, borderRadius: 8 }}
            />
          </div>

          {/* Duration */}
          <div>
            <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
              {t('durationLabel')}
            </Label>
            <Input
              type="number"
              min={15}
              max={480}
              value={form.durationMinutes}
              onChange={(e) =>
                updateField('durationMinutes', Number(e.target.value) || 60)
              }
              style={{ marginTop: 6, borderRadius: 8, maxWidth: 160 }}
            />
          </div>

          {/* Type + Round row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
                {t('interviewTypeLabel')}
              </Label>
              <Select
                value={form.interviewType}
                onValueChange={(val) => updateField('interviewType', val)}
              >
                <SelectTrigger style={{ marginTop: 6, borderRadius: 8 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
                {t('roundLabel')}
              </Label>
              <Select
                value={form.round}
                onValueChange={(val) => updateField('round', val)}
              >
                <SelectTrigger style={{ marginTop: 6, borderRadius: 8 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
              {t('locationFormLabel')}
            </Label>
            <Input
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder={t('locationFormPlaceholder')}
              style={{ marginTop: 6, borderRadius: 8 }}
            />
          </div>

          {/* Meeting Link */}
          <div>
            <Label style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>
              {t('meetingLinkLabel')}
            </Label>
            <Input
              value={form.meetingLink}
              onChange={(e) => updateField('meetingLink', e.target.value)}
              placeholder="https://zoom.us/..."
              style={{ marginTop: 6, borderRadius: 8 }}
            />
          </div>

          {/* Submit */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              paddingTop: 12,
              borderTop: '1px solid #E8E8E8',
            }}
          >
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/recruitment/${postingId}/interviews`)
              }
              style={{ borderRadius: 8 }}
            >
              {t('cancelButton')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              style={{
                borderRadius: 8,
                backgroundColor: isValid ? '#00C853' : '#E8E8E8',
                color: isValid ? '#FFFFFF' : '#999',
              }}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('submitInterview')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
