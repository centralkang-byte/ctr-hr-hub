'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency Library Admin (B3-1)
// 3-tier 역량 라이브러리 관리: 카테고리 탭 + 역량 CRUD
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Plus, Trash2, Loader2, ChevronRight, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import IndicatorEditor from './IndicatorEditor'
import CompetencyLevelEditor from './CompetencyLevelEditor'

// ─── Types ─────────────────────────────────────────────────

interface CompetencyCategory {
  id: string
  code: string
  name: string
  displayOrder: number
  isActive: boolean
}

interface Competency {
  id: string
  categoryId: string
  code: string
  name: string
  nameEn: string | null
  description: string | null
  displayOrder: number
  isActive: boolean
  category: { id: string; code: string; name: string }
  _count: { indicators: number; levels: number }
}

interface CompetencyDetail extends Competency {
  indicators: Indicator[]
  levels: Level[]
}

interface Indicator {
  id: string
  indicatorText: string
  indicatorTextEn: string | null
  displayOrder: number
  isActive: boolean
}

interface Level {
  id: string
  level: number
  label: string
  description: string | null
}

type ActivePanel = 'none' | 'detail' | 'add'

// ─── Category tabs (synced with seed data) ─────────────────

const CATEGORY_TABS = [
  { code: 'core_value', label: '핵심가치 역량' },
  { code: 'leadership', label: '리더십 역량' },
  { code: 'technical', label: '직무 전문 역량' },
]

// ─── Component ─────────────────────────────────────────────

export function CompetencyListClient({ user: _user }: { user: SessionUser }) {
  const [activeCategory, setActiveCategory] = useState('core_value')
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyDetail | null>(null)
  const [panel, setPanel] = useState<ActivePanel>('none')
  const [detailLoading, setDetailLoading] = useState(false)

  // Add form state
  const [addName, setAddName] = useState('')
  const [addNameEn, setAddNameEn] = useState('')
  const [addCode, setAddCode] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<Competency>('/api/v1/competencies', {
        categoryCode: activeCategory,
        limit: 100,
      })
      setCompetencies(res.data)
      if (res.data.length > 0) {
        setCategoryId(res.data[0].category.id)
      } else {
        // Fetch category info for empty categories
        try {
          const catRes = await apiClient.getList<CompetencyCategory>('/api/v1/competency-categories', { limit: 50 })
          const found = (catRes.data ?? []).find((c) => c.code === activeCategory)
          if (found) setCategoryId(found.id)
        } catch {
          /* ignore — add will show error if categoryId not found */
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [activeCategory])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openDetail = async (comp: Competency) => {
    setPanel('detail')
    setDetailLoading(true)
    try {
      const res = await apiClient.get<CompetencyDetail>(`/api/v1/competencies/${comp.id}`)
      setSelectedCompetency(res.data ?? null)
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('역량을 삭제하시겠습니까? 관련 행동지표와 레벨도 모두 삭제됩니다.')) return
    try {
      await apiClient.delete(`/api/v1/competencies/${id}`)
      await fetchList()
      if (selectedCompetency?.id === id) {
        setSelectedCompetency(null)
        setPanel('none')
      }
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  const handleAdd = async () => {
    if (!addName || !addCode) return alert('이름과 코드를 입력하세요.')

    // If categoryId not loaded yet (empty list), fetch it from category endpoint
    let catId = categoryId
    if (!catId) {
      try {
        const res = await apiClient.getList<CompetencyCategory>('/api/v1/competency-categories', { limit: 10 })
        const found = res.data.find((c) => c.code === activeCategory)
        catId = found?.id ?? null
      } catch {
        /* ignore */
      }
    }
    if (!catId) return alert('카테고리 정보를 불러올 수 없습니다. 페이지를 새로고침 후 시도하세요.')

    setAddSaving(true)
    try {
      await apiClient.post('/api/v1/competencies', {
        categoryId: catId,
        code: addCode,
        name: addName,
        nameEn: addNameEn || undefined,
        description: addDesc || undefined,
      })
      setAddName('')
      setAddCode('')
      setAddNameEn('')
      setAddDesc('')
      setPanel('none')
      await fetchList()
    } catch {
      alert('추가에 실패했습니다.')
    } finally {
      setAddSaving(false)
    }
  }

  const handleCategoryChange = (code: string) => {
    setActiveCategory(code)
    setPanel('none')
    setSelectedCompetency(null)
    setCategoryId(null)
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="역량 라이브러리 관리"
        description="CTR Value System 2.0 핵심가치 행동지표 및 리더십·직무 역량을 관리합니다."
      />

      {/* Category tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.code}
            onClick={() => handleCategoryChange(tab.code)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeCategory === tab.code
                ? 'border-b-2 border-[#00C853] text-[#00C853]'
                : 'text-[#666] hover:text-[#333]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Competency list */}
        <div className="flex-1">
          <div className="rounded-xl border border-[#E8E8E8] bg-white">
            <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#666]" />
                {CATEGORY_TABS.find((t) => t.code === activeCategory)?.label}
              </h2>
              <Button
                size="sm"
                onClick={() => setPanel('add')}
                className="bg-[#00C853] hover:bg-[#00A844] text-white text-xs"
              >
                <Plus className="w-4 h-4 mr-1" />
                역량 추가
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-[#00C853]" />
              </div>
            ) : competencies.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#999]">
                역량이 없습니다. 역량을 추가하세요.
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F5]">
                {competencies.map((comp) => (
                  <div
                    key={comp.id}
                    className={`flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] cursor-pointer transition-colors ${
                      selectedCompetency?.id === comp.id ? 'bg-[#E8F5E9]' : ''
                    }`}
                    onClick={() => openDetail(comp)}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">
                        {comp.name}
                        {comp.nameEn && (
                          <span className="text-[#999] font-normal ml-1">({comp.nameEn})</span>
                        )}
                      </p>
                      <p className="text-xs text-[#999] mt-0.5">
                        행동지표 {comp._count.indicators}개 | 숙련도 레벨 {comp._count.levels}단계
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={comp.isActive ? 'default' : 'secondary'}
                        className={comp.isActive ? 'bg-[#D1FAE5] text-[#047857] border-0' : ''}
                      >
                        {comp.isActive ? '활성' : '비활성'}
                      </Badge>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(comp.id)
                        }}
                        className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#999] hover:text-[#DC2626] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-[#999]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {panel !== 'none' && (
          <div className="w-96 shrink-0 space-y-4">
            {panel === 'add' && (
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[#1A1A1A]">역량 추가</h3>
                  <button onClick={() => setPanel('none')}>
                    <X className="w-4 h-4 text-[#999]" />
                  </button>
                </div>
                {[
                  { label: '코드 (영문, 필수)', value: addCode, setter: setAddCode, placeholder: 'challenge' },
                  { label: '이름 (한국어, 필수)', value: addName, setter: setAddName, placeholder: '도전' },
                  { label: '이름 (영문, 선택)', value: addNameEn, setter: setAddNameEn, placeholder: 'Challenge' },
                  { label: '설명 (선택)', value: addDesc, setter: setAddDesc, placeholder: '역량 설명...' },
                ].map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-[#333] mb-1 block">{label}</label>
                    <input
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPanel('none')}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={addSaving}
                    className="flex-1 bg-[#00C853] hover:bg-[#00A844] text-white"
                  >
                    {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '추가'}
                  </Button>
                </div>
              </div>
            )}

            {panel === 'detail' && (
              <>
                <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">
                      {selectedCompetency?.name ?? '...'}
                      {selectedCompetency?.nameEn && (
                        <span className="text-sm font-normal text-[#999] ml-1">
                          ({selectedCompetency.nameEn})
                        </span>
                      )}
                    </h3>
                    <button onClick={() => { setPanel('none'); setSelectedCompetency(null) }}>
                      <X className="w-4 h-4 text-[#999]" />
                    </button>
                  </div>
                  {detailLoading && (
                    <div className="flex items-center justify-center h-16">
                      <Loader2 className="w-4 h-4 animate-spin text-[#00C853]" />
                    </div>
                  )}
                </div>

                {selectedCompetency && !detailLoading && (
                  <>
                    <IndicatorEditor
                      competencyId={selectedCompetency.id}
                      competencyName={selectedCompetency.name}
                      initialIndicators={selectedCompetency.indicators}
                      onSaved={() => openDetail(selectedCompetency)}
                    />
                    <CompetencyLevelEditor
                      competencyId={selectedCompetency.id}
                      competencyName={selectedCompetency.name}
                      initialLevels={selectedCompetency.levels}
                      onSaved={() => openDetail(selectedCompetency)}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
