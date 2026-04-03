'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Plus, Eye, Trash2, Play, Square, Calendar } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, BUTTON_VARIANTS, MODAL_STYLES, TABLE_STYLES } from '@/lib/styles'
import type { SessionUser } from '@/types'

// ─── Types ───────────────────────────────────────────────

interface Survey {
  id: string
  title: string
  description: string | null
  targetScope: string
  anonymityLevel: string
  openAt: string
  closeAt: string
  status: string
  createdAt: string
  creator: { id: string; name: string }
  _count: { questions: number; responses: number }
}

interface PendingSurvey {
  id: string
  title: string
  description: string | null
  closeAt: string
  _count: { questions: number }
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PULSE_DRAFT: { label: '임시저장', cls: 'bg-background text-muted-foreground border-border' },
  PULSE_ACTIVE: { label: '진행 중', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
  PULSE_CLOSED: { label: '종료', cls: 'bg-muted text-muted-foreground border-border' },
}

const SCOPE_MAP: Record<string, string> = {
  ALL: '전사',
  DIVISION: '사업부',
  DEPARTMENT: '부서',
  TEAM: '팀',
}

// ─── Create Modal ────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
  onCreated: () => void
}

interface QuestionInput {
  questionText: string
  questionType: 'LIKERT' | 'TEXT' | 'CHOICE'
  options: string[]
  isRequired: boolean
}

function CreateSurveyModal({ onClose, onCreated }: CreateModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetScope, setTargetScope] = useState<string>('ALL')
  const [anonymityLevel, setAnonymityLevel] = useState<string>('FULL_ANONYMOUS')
  const [openAt, setOpenAt] = useState('')
  const [closeAt, setCloseAt] = useState('')
  const [questions, setQuestions] = useState<QuestionInput[]>([
    { questionText: '', questionType: 'LIKERT', options: [], isRequired: true },
  ])
  const [saving, setSaving] = useState(false)

  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', questionType: 'LIKERT', options: [], isRequired: true }])
  }

  const updateQuestion = (idx: number, field: keyof QuestionInput, value: unknown) => {
    const updated = [...questions]
    updated[idx] = { ...updated[idx], [field]: value }
    setQuestions(updated)
  }

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return
    setQuestions(questions.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!title || !openAt || !closeAt || questions.some((q) => !q.questionText)) return
    setSaving(true)
    try {
      await apiClient.post('/api/v1/pulse/surveys', {
        title,
        description: description || undefined,
        targetScope,
        anonymityLevel,
        minRespondentsForReport: 5,
        openAt: new Date(openAt).toISOString(),
        closeAt: new Date(closeAt).toISOString(),
        questions: questions.map((q, i) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.questionType === 'CHOICE' ? q.options : undefined,
          sortOrder: i,
          isRequired: q.isRequired,
        })),
      })
      onCreated()
    } catch (err) { toast({ title: '설문 생성 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setSaving(false)
  }

  return (
    <div className={MODAL_STYLES.container}>
      <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{'새 펄스 서베이'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">{'제목'}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="서베이 제목"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">{'설명 (선택)'}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{'대상 범위'}</label>
              <select value={targetScope} onChange={(e) => setTargetScope(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="ALL">{'전사'}</option>
                <option value="DIVISION">{'사업부'}</option>
                <option value="DEPARTMENT">{'부서'}</option>
                <option value="TEAM">{'팀'}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{'익명 수준'}</label>
              <select value={anonymityLevel} onChange={(e) => setAnonymityLevel(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="FULL_ANONYMOUS">{'완전 익명'}</option>
                <option value="FULL_DIVISION">{'부서 공개'}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{'시작일'}</label>
              <input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{'종료일'}</label>
              <input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>

          {/* Questions */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">{'질문 구성'}</h3>
              <button onClick={addQuestion} className="flex items-center gap-1 text-sm text-primary hover:text-primary/90 font-medium">
                <Plus className="w-4 h-4" /> {'질문 추가'}
              </button>
            </div>
            <div className="space-y-3">
              {!questions?.length && <EmptyState />}
              {questions?.map((q, i) => (
                <div key={i} className="bg-background rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Q{i + 1}</span>
                    <input value={q.questionText} onChange={(e) => updateQuestion(i, 'questionText', e.target.value)}
                      placeholder="질문 내용" className="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm placeholder:text-muted-foreground" />
                    <select value={q.questionType} onChange={(e) => updateQuestion(i, 'questionType', e.target.value)}
                      className="px-2 py-1.5 border border-border rounded-lg text-xs">
                      <option value="LIKERT">{'리커트 (1-5)'}</option>
                      <option value="TEXT">{'주관식'}</option>
                      <option value="CHOICE">{'객관식'}</option>
                    </select>
                    {questions.length > 1 && (
                      <button onClick={() => removeQuestion(i)} className="p-1 text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {q.questionType === 'CHOICE' && (
                    <div className="pl-8">
                      <input
                        value={q.options.join(', ')}
                        onChange={(e) => updateQuestion(i, 'options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                        placeholder="보기를 쉼표로 구분 (예: 매우 만족, 만족, 보통, 불만족)"
                        className="w-full px-3 py-1.5 border border-border rounded-lg text-xs placeholder:text-muted-foreground"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-background">{'취소'}</button>
          <button onClick={handleSubmit} disabled={saving} className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}>
            {saving ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────

export default function PulseSurveyClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  const router = useRouter()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [pending, setPending] = useState<PendingSurvey[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'manage' | 'respond'>('manage')
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [surveyRes, pendingRes] = await Promise.all([
        apiClient.get<{ items: Survey[] }>(`/api/v1/pulse/surveys?size=50${statusFilter ? `&status=${statusFilter}` : ''}`),
        apiClient.get<PendingSurvey[]>('/api/v1/pulse/my-pending'),
      ])
      setSurveys(surveyRes.data.items ?? [])
      setPending(pendingRes.data ?? [])
    } catch (err) { toast({ title: '설문 목록 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.put(`/api/v1/pulse/surveys/${id}`, { status: newStatus })
      fetchAll()
    } catch (err) { toast({ title: '설문 상태 변경 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/pulse/surveys/${id}`)
      fetchAll()
    } catch (err) { toast({ title: '설문 삭제 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
  }

  const TABS = [
    { key: 'manage', label: t('kr_kec84a4eb_management') },
    { key: 'respond', label: `응답 대기 (${pending.length})` },
  ] as const

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t('pulseSurveyTitle')}</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
          <Plus className="w-4 h-4" /> {t('kr_kec8388_kec84a4eb')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10">{tCommon('loading')}</div>
      ) : tab === 'manage' ? (
        <>
          {/* Status Filter */}
          <div className="flex gap-2">
            {[{ key: '', label: t('all') }, { key: 'PULSE_DRAFT', label: t('draft') }, { key: 'PULSE_ACTIVE', label: t('inProgress') }, { key: 'PULSE_CLOSED', label: t('ended') }].map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === f.key ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:bg-background'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Surveys Table */}
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr>
                  <th className={TABLE_STYLES.headerCell}>{t('kr_keca09ceb')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('kr_keb8c80ec')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('period')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('kr_keca788eb')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('kr_kec9d91eb')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('kr_kec95a1ec')}</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((s) => (
                  <tr key={s.id} className={TABLE_STYLES.row}>
                    <td className={`${TABLE_STYLES.cell} font-medium`}>{s.title}</td>
                    <td className={TABLE_STYLES.cell}>{SCOPE_MAP[s.targetScope] ?? s.targetScope}</td>
                    <td className={`${TABLE_STYLES.cell} text-xs text-muted-foreground`}>
                      {new Date(s.openAt).toLocaleDateString('ko-KR')} ~ {new Date(s.closeAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className={`${TABLE_STYLES.cell} text-center`}>{s._count.questions}</td>
                    <td className={`${TABLE_STYLES.cell} text-center`}>{s._count.responses}</td>
                    <td className={`${TABLE_STYLES.cell} text-center`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_MAP[s.status]?.cls ?? ''}`}>
                        {STATUS_MAP[s.status]?.label ?? s.status}
                      </span>
                    </td>
                    <td className={`${TABLE_STYLES.cell} text-center`}>
                      <div className="flex items-center justify-center gap-1">
                        {s.status === 'PULSE_DRAFT' && (
                          <button onClick={() => handleStatusChange(s.id, 'PULSE_ACTIVE')} title={t('start')}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {s.status === 'PULSE_ACTIVE' && (
                          <button onClick={() => handleStatusChange(s.id, 'PULSE_CLOSED')} title="종료"
                            className="p-1.5 text-amber-700 hover:bg-amber-500/15 rounded-lg">
                            <Square className="w-4 h-4" />
                          </button>
                        )}
                        {(s.status === 'PULSE_ACTIVE' || s.status === 'PULSE_CLOSED') && (
                          <button onClick={() => router.push(`/performance/pulse/${s.id}/results`)} title="결과 보기"
                            className="p-1.5 text-primary/90 hover:bg-indigo-500/15 rounded-lg">
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {s.status === 'PULSE_DRAFT' && (
                          <button onClick={() => handleDelete(s.id)} title="삭제"
                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {surveys.length === 0 && (
                  <tr><td colSpan={7} className={`${TABLE_STYLES.cell} py-10 text-center text-muted-foreground`}>{t('register_keb909c_kec84a4eb_kec9786ec')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Pending Surveys */
        <div className="space-y-4">
          {pending.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">{t('kr_kec9d91eb_keb8c80ea_keca491ec_')}</div>
          ) : (
            pending.map((s) => (
              <div key={s.id} className={`${CARD_STYLES.kpi} flex items-center justify-between`}>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                  {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>마감: {new Date(s.closeAt).toLocaleDateString('ko-KR')}</span>
                    <span>·</span>
                    <span>{s._count.questions}개 질문</span>
                  </div>
                </div>
                <button onClick={() => router.push(`/performance/pulse/${s.id}/respond`)}
                  className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
                  응답하기
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {showCreate && <CreateSurveyModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchAll() }} />}
    </div>
  )
}
