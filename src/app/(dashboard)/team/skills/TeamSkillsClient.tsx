'use client'
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 팀원 역량 평가 Client (매니저용) (B8-3)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  Users, ChevronLeft, ChevronRight, Save, CheckCircle2,
  Star, AlertCircle, User as UserIcon,
} from 'lucide-react'
import type { SessionUser } from '@/types'

// ── 타입 ──────────────────────────────────────────────────

type CompetencyCategory = { id: string; name: string; code: string }
type Competency = { id: string; name: string; code: string; category: CompetencyCategory }

type MemberAssessment = {
  competencyId: string
  competency: Competency
  selfLevel: number | null
  managerLevel: number | null
  finalLevel: number | null
  expectedLevel: number | null
  gap: number | null
}

type TeamMember = {
  id: string
  name: string
  nameEn: string | null
  avatarPath: string | null
  grade: string
  department: { id: string; name: string } | null
  assessments: MemberAssessment[]
}

type ManagerEvalItem = { competencyId: string; managerLevel: number; managerComment: string }

const LEVEL_LABELS: Record<number, string> = {
  1: '기초', 2: '기본', 3: '우수', 4: '탁월', 5: '전문가',
}

function getGapBadge(gap: number | null) {
  if (gap === null) return null
  if (gap >= 2) return <span className="px-1.5 py-0.5 rounded-full text-xs bg-[#FEE2E2] text-[#B91C1C]">미달 -{gap}</span>
  if (gap === 1) return <span className="px-1.5 py-0.5 rounded-full text-xs bg-[#FEF3C7] text-[#B45309]">부족 -1</span>
  if (gap === 0) return <span className="px-1.5 py-0.5 rounded-full text-xs bg-[#D1FAE5] text-[#047857]">충족</span>
  return <span className="px-1.5 py-0.5 rounded-full text-xs bg-[#DBEAFE] text-[#1D4ED8]">초과 +{Math.abs(gap)}</span>
}

export default function TeamSkillsClient({ user }: { user: SessionUser }) {
  const [period, setPeriod] = useState('2026-H1')
  const [teamData, setTeamData] = useState<{
    teamMembers: TeamMember[]
    competencies: Competency[]
  } | null>(null)
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0)
  const [evalItems, setEvalItems] = useState<Record<string, ManagerEvalItem>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMembers, setSavedMembers] = useState<Set<string>>(new Set())

  const loadTeamData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{
        teamMembers: TeamMember[]
        competencies: Competency[]
      }>(`/api/v1/skills/team-assessments?period=${period}`)
      setTeamData(res.data)
      setCurrentMemberIndex(0)
      setEvalItems({})
    } catch {
      // 에러 무시
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    void loadTeamData()
  }, [loadTeamData])

  const currentMember = teamData?.teamMembers[currentMemberIndex]

  // 현재 팀원의 매니저 평가 초기화
  useEffect(() => {
    if (!currentMember) return
    const initial: Record<string, ManagerEvalItem> = {}
    for (const a of currentMember.assessments) {
      if (a.managerLevel !== null) {
        initial[a.competencyId] = {
          competencyId: a.competencyId,
          managerLevel: a.managerLevel,
          managerComment: '',
        }
      }
    }
    setEvalItems(initial)
  }, [currentMember?.id])

  const handleSave = async () => {
    if (!currentMember) return
    setSaving(true)
    try {
      const items = Object.values(evalItems)
      if (items.length === 0) return

      await apiClient.post('/api/v1/skills/team-assessments', {
        employeeId: currentMember.id,
        assessmentPeriod: period,
        items,
      })
      setSavedMembers((prev) => new Set([...prev, currentMember.id]))
    } finally {
      setSaving(false)
    }
  }

  // 카테고리 그룹핑
  const groupedAssessments = currentMember?.assessments.reduce<
    Record<string, { categoryName: string; items: MemberAssessment[] }>
  >((acc, a) => {
    const key = a.competency.category.id
    if (!acc[key]) acc[key] = { categoryName: a.competency.category.name, items: [] }
    acc[key].items.push(a)
    return acc
  }, {}) ?? {}

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!teamData?.teamMembers.length) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-12 text-center">
          <Users className="w-12 h-12 text-[#E8E8E8] mx-auto mb-3" />
          <p className="text-[#666]">평가할 팀원이 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">팀원 역량 평가</h1>
          <p className="text-sm text-[#666] mt-1">팀원의 역량 수준을 평가하세요. 자기평가를 참고할 수 있습니다.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
        >
          {['2025-H1', '2025-H2', '2026-H1', 'latest'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* 팀원 목록 탭 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
        <div className="border-b border-[#E8E8E8] p-4 flex items-center gap-3 overflow-x-auto">
          {teamData.teamMembers.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setCurrentMemberIndex(idx)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm transition-all ${
                idx === currentMemberIndex
                  ? 'bg-[#E8F5E9] text-[#00C853] font-medium'
                  : 'text-[#555] hover:bg-[#FAFAFA]'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              {m.name}
              {savedMembers.has(m.id) && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              )}
            </button>
          ))}
        </div>

        {currentMember && (
          <div className="p-5">
            {/* 현재 팀원 정보 */}
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-[#F5F5F5]">
              <div className="w-12 h-12 bg-[#E8F5E9] rounded-full flex items-center justify-center text-lg font-bold text-[#00C853]">
                {currentMember.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A]">{currentMember.name}</p>
                <p className="text-sm text-[#666]">
                  {currentMember.grade} · {currentMember.department?.name ?? '-'}
                </p>
              </div>
              <div className="ml-auto text-sm text-[#666]">
                평가 완료: {Object.keys(evalItems).length}/{currentMember.assessments.length}
              </div>
            </div>

            {/* 역량 평가 폼 */}
            <div className="space-y-6">
              {Object.entries(groupedAssessments).map(([catId, { categoryName, items }]) => (
                <div key={catId}>
                  <h3 className="text-sm font-semibold text-[#666] uppercase tracking-wider mb-3">
                    {categoryName}
                  </h3>
                  <div className="space-y-4">
                    {items.map((a) => {
                      const current = evalItems[a.competencyId]
                      return (
                        <div key={a.competencyId} className="bg-[#FAFAFA] rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="font-medium text-sm text-[#1A1A1A]">{a.competency.name}</span>
                              {a.selfLevel !== null && (
                                <span className="ml-2 text-xs text-[#666]">
                                  자기평가: {a.selfLevel} ({LEVEL_LABELS[a.selfLevel] ?? '-'})
                                </span>
                              )}
                            </div>
                            {current && getGapBadge(
                              a.expectedLevel != null ? a.expectedLevel - current.managerLevel : null
                            )}
                          </div>

                          {/* 매니저 레벨 선택 */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#666] w-16">매니저 평가:</span>
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map((l) => {
                                const selected = current?.managerLevel === l
                                // 자기평가 대비 표시
                                const isSelf = a.selfLevel === l
                                return (
                                  <button
                                    key={l}
                                    onClick={() =>
                                      setEvalItems((prev) => ({
                                        ...prev,
                                        [a.competencyId]: {
                                          competencyId: a.competencyId,
                                          managerLevel: l,
                                          managerComment: prev[a.competencyId]?.managerComment ?? '',
                                        },
                                      }))
                                    }
                                    title={`${l}: ${LEVEL_LABELS[l]}`}
                                    className={`relative w-10 h-10 rounded-lg border text-sm font-medium transition-all ${
                                      selected
                                        ? 'border-[#00C853] bg-[#E8F5E9] text-[#00C853]'
                                        : 'border-[#E8E8E8] text-[#666] hover:border-[#00C853]'
                                    }`}
                                  >
                                    {l}
                                    {isSelf && !selected && (
                                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#F59E0B] rounded-full" title="자기평가 점수" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                            {a.expectedLevel != null && (
                              <span className="text-xs text-[#666] ml-1">
                                (기대: {a.expectedLevel})
                              </span>
                            )}
                          </div>

                          {/* 코멘트 */}
                          {current && (
                            <input
                              type="text"
                              placeholder="평가 코멘트 (선택)"
                              value={current.managerComment}
                              onChange={(e) =>
                                setEvalItems((prev) => ({
                                  ...prev,
                                  [a.competencyId]: {
                                    ...prev[a.competencyId],
                                    managerComment: e.target.value,
                                  },
                                }))
                              }
                              className="mt-2 w-full px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 이전/다음 + 저장 */}
            <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#F5F5F5]">
              <button
                onClick={() => setCurrentMemberIndex((i) => Math.max(0, i - 1))}
                disabled={currentMemberIndex === 0}
                className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                이전 팀원
              </button>
              <button
                onClick={handleSave}
                disabled={saving || Object.keys(evalItems).length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() =>
                  setCurrentMemberIndex((i) => Math.min((teamData?.teamMembers.length ?? 1) - 1, i + 1))
                }
                disabled={currentMemberIndex === (teamData?.teamMembers.length ?? 1) - 1}
                className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] disabled:opacity-40"
              >
                다음 팀원
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
