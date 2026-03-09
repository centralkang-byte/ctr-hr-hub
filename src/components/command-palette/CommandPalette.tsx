'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CommandPalette (Cmd+K / Ctrl+K 전역 검색)
// 커스텀 CRAFTUI 스타일 모달 + 키보드 네비게이션 + API 검색
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  LayoutDashboard,
  FileText,
  Clock,
  Search,
  Hash,
} from 'lucide-react'
import { apiClient } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────

interface SearchResult {
  id: string
  label: string
  description?: string
  href: string
  category: 'employee' | 'menu' | 'document' | 'recent'
}

interface ApiEmployee {
  id: string
  name: string
  employeeNo: string
  email: string
  department: string | null
  position: string | null
}

interface ApiDocument {
  id: string
  title: string
  docType: string
}

// ─── Menu items for fuzzy matching ──────────────────────────

const MENU_ITEMS: SearchResult[] = [
  { id: 'menu-home', label: '홈', href: '/home', category: 'menu' },
  { id: 'menu-employees', label: '직원 관리', href: '/employees', category: 'menu' },
  { id: 'menu-attendance', label: '근태 관리', href: '/attendance', category: 'menu' },
  { id: 'menu-attendance-team', label: '팀 근태', href: '/attendance/team', category: 'menu' },
  { id: 'menu-leave', label: '휴가 관리', href: '/leave', category: 'menu' },
  { id: 'menu-leave-admin', label: '휴가 관리 (관리자)', href: '/leave/admin', category: 'menu' },
  { id: 'menu-performance', label: '성과 관리', href: '/performance', category: 'menu' },
  { id: 'menu-performance-mbo', label: 'MBO 목표', href: '/performance/mbo', category: 'menu' },
  { id: 'menu-performance-eval', label: '성과 평가', href: '/performance/evaluations', category: 'menu' },
  { id: 'menu-performance-1on1', label: '1:1 미팅', href: '/performance/one-on-one', category: 'menu' },
  { id: 'menu-recruitment', label: '채용 관리', href: '/recruitment', category: 'menu' },
  { id: 'menu-recruitment-board', label: '채용 칸반 보드', href: '/recruitment/board', category: 'menu' },
  { id: 'menu-payroll', label: '급여 관리', href: '/payroll', category: 'menu' },
  { id: 'menu-compensation', label: '연봉/보상', href: '/compensation', category: 'menu' },
  { id: 'menu-onboarding', label: '온보딩', href: '/onboarding', category: 'menu' },
  { id: 'menu-offboarding', label: '퇴직 관리', href: '/offboarding', category: 'menu' },
  { id: 'menu-training', label: '교육 관리', href: '/training', category: 'menu' },
  { id: 'menu-benefits', label: '복리후생', href: '/benefits', category: 'menu' },
  { id: 'menu-succession', label: '승계 계획', href: '/talent/succession', category: 'menu' },
  { id: 'menu-analytics', label: '분석 대시보드', href: '/analytics', category: 'menu' },
  { id: 'menu-predictive', label: 'HR 예측 애널리틱스', href: '/analytics/predictive', category: 'menu' },
  { id: 'menu-discipline', label: '징계·포상', href: '/discipline', category: 'menu' },
  { id: 'menu-manager-hub', label: '매니저 허브', href: '/manager-hub', category: 'menu' },
  { id: 'menu-approvals', label: '승인함', href: '/approvals/attendance', category: 'menu' },
  { id: 'menu-directory', label: 'People Directory', href: '/directory', category: 'menu' },
  { id: 'menu-org', label: '조직 관리', href: '/org', category: 'menu' },
  { id: 'menu-settings', label: '설정', href: '/settings', category: 'menu' },
  { id: 'menu-notifications', label: '알림', href: '/notifications', category: 'menu' },
]

const RECENT_KEY = 'ctr-command-recent'

// ─── Simple fuzzy match ─────────────────────────────────────

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

// ─── Component ──────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [employeeResults, setEmployeeResults] = useState<SearchResult[]>([])
  const [documentResults, setDocumentResults] = useState<SearchResult[]>([])
  const [recentResults, setRecentResults] = useState<SearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Cmd+K / Ctrl+K handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  // Load recent searches
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem(RECENT_KEY)
        if (stored) setRecentResults(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [open])

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [debouncedQuery])

  // API search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setEmployeeResults([])
      setDocumentResults([])
      return
    }

    apiClient
      .get<{ employees: ApiEmployee[]; documents: ApiDocument[] }>(
        `/api/v1/search/command?q=${encodeURIComponent(debouncedQuery)}&limit=5`,
      )
      .then((res) => {
        setEmployeeResults(
          res.data.employees.map((e: ApiEmployee) => ({
            id: e.id,
            label: e.name,
            description: [e.department, e.position].filter(Boolean).join(' · '),
            href: `/employees/${e.id}`,
            category: 'employee' as const,
          })),
        )
        setDocumentResults(
          res.data.documents.map((d: ApiDocument) => ({
            id: d.id,
            label: d.title,
            description: d.docType,
            href: '/settings/hr-documents',
            category: 'document' as const,
          })),
        )
      })
      .catch(() => {
        setEmployeeResults([])
        setDocumentResults([])
      })
  }, [debouncedQuery])

  // Build flat list of all visible results for keyboard nav
  const filteredMenus = debouncedQuery
    ? MENU_ITEMS.filter((item) => fuzzyMatch(item.label, debouncedQuery)).slice(0, 5)
    : MENU_ITEMS.slice(0, 6)

  const allResults: SearchResult[] = [
    ...employeeResults,
    ...filteredMenus,
    ...documentResults,
    ...(!debouncedQuery ? recentResults : []),
  ]

  const addToRecent = useCallback((result: SearchResult) => {
    try {
      const stored = localStorage.getItem(RECENT_KEY)
      const recent: SearchResult[] = stored ? JSON.parse(stored) : []
      const filtered = recent.filter((r) => r.id !== result.id)
      const updated = [
        { ...result, category: 'recent' as const },
        ...filtered,
      ].slice(0, 5)
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
      setRecentResults(updated)
    } catch {
      // ignore
    }
  }, [])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false)
      setQuery('')
      addToRecent(result)
      router.push(result.href)
    },
    [router, addToRecent],
  )

  // Keyboard navigation inside modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % Math.max(allResults.length, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) =>
          prev === 0 ? Math.max(allResults.length - 1, 0) : prev - 1,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = allResults[activeIndex]
        if (selected) handleSelect(selected)
      }
    },
    [allResults, activeIndex, handleSelect],
  )

  if (!open) return null

  // ─── Render ─────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onMouseDown={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[560px] mx-4 bg-white border border-[#F0F0F3] rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F0F0F3]">
          <Search className="w-4 h-4 text-[#8181A5] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-[15px] text-[#1C1D21] placeholder:text-[#8181A5] bg-transparent focus:outline-none focus:ring-0 border-none"
            placeholder="직원 이름, 메뉴, HR 규정 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#8181A5] border border-[#F0F0F3] bg-[#F5F5FA]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto py-2">
          {allResults.length === 0 && debouncedQuery && (
            <div className="px-4 py-8 text-center text-sm text-[#8181A5]">
              &apos;{debouncedQuery}&apos; 검색 결과가 없습니다.
            </div>
          )}

          {/* Employee results */}
          {employeeResults.length > 0 && (
            <ResultGroup label="직원">
              {employeeResults.map((result, idx) => (
                <ResultItem
                  key={result.id}
                  result={result}
                  isActive={allResults.indexOf(result) === activeIndex}
                  onSelect={() => handleSelect(result)}
                  onHover={() => setActiveIndex(idx)}
                  icon={<Users className="w-4 h-4" />}
                />
              ))}
            </ResultGroup>
          )}

          {/* Menu results */}
          {filteredMenus.length > 0 && (
            <ResultGroup label={debouncedQuery ? '메뉴' : '빠른 이동'}>
              {filteredMenus.map((item) => (
                <ResultItem
                  key={item.id}
                  result={item}
                  isActive={allResults.indexOf(item) === activeIndex}
                  onSelect={() => handleSelect(item)}
                  onHover={() => setActiveIndex(allResults.indexOf(item))}
                  icon={<LayoutDashboard className="w-4 h-4" />}
                />
              ))}
            </ResultGroup>
          )}

          {/* Document results */}
          {documentResults.length > 0 && (
            <ResultGroup label="HR 규정">
              {documentResults.map((result) => (
                <ResultItem
                  key={result.id}
                  result={result}
                  isActive={allResults.indexOf(result) === activeIndex}
                  onSelect={() => handleSelect(result)}
                  onHover={() => setActiveIndex(allResults.indexOf(result))}
                  icon={<FileText className="w-4 h-4" />}
                />
              ))}
            </ResultGroup>
          )}

          {/* Recent searches */}
          {!debouncedQuery && recentResults.length > 0 && (
            <ResultGroup label="최근 검색">
              {recentResults.map((result) => (
                <ResultItem
                  key={`recent-${result.id}`}
                  result={result}
                  isActive={allResults.indexOf(result) === activeIndex}
                  onSelect={() => handleSelect(result)}
                  onHover={() => setActiveIndex(allResults.indexOf(result))}
                  icon={<Clock className="w-4 h-4" />}
                />
              ))}
            </ResultGroup>
          )}

          {/* Empty state (no query, no recent) */}
          {!debouncedQuery && recentResults.length === 0 && (
            <div className="px-4 py-6 text-center">
              <Hash className="mx-auto mb-2 w-5 h-5 text-[#C5C7D4]" />
              <p className="text-sm text-[#8181A5]">직원 이름, 메뉴, HR 규정을 검색하세요</p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#F0F0F3] bg-[#FAFAFA]">
          <div className="flex items-center gap-3 text-[11px] text-[#C5C7D4]">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[#E8E8EC] bg-white font-mono">↑↓</kbd>
              탐색
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[#E8E8EC] bg-white font-mono">↵</kbd>
              이동
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[#E8E8EC] bg-white font-mono">ESC</kbd>
              닫기
            </span>
          </div>
          <span className="text-[11px] text-[#C5C7D4]">
            <kbd className="font-mono">⌘K</kbd>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function ResultGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-1">
      <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#C5C7D4]">
        {label}
      </p>
      {children}
    </div>
  )
}

function ResultItem({
  result,
  isActive,
  onSelect,
  onHover,
  icon,
}: {
  result: SearchResult
  isActive: boolean
  onSelect: () => void
  onHover: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isActive
          ? 'bg-[#F5F5FA] text-[#5E81F4]'
          : 'text-[#8181A5] hover:bg-[#F5F5FA] hover:text-[#5E81F4]'
      }`}
      onMouseDown={(e) => {
        e.preventDefault()
        onSelect()
      }}
      onMouseEnter={onHover}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-[#5E81F4]' : 'text-[#C5C7D4]'}`}>
        {icon}
      </span>
      <span className={`text-sm font-medium ${isActive ? 'text-[#1C1D21]' : 'text-[#3D3F4E]'}`}>
        {result.label}
      </span>
      {result.description && (
        <span className="ml-auto text-xs text-[#C5C7D4] truncate max-w-[160px]">
          {result.description}
        </span>
      )}
    </button>
  )
}
