'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CommandPalette (Cmd+K / Ctrl+K 전역 검색)
// 메뉴 검색 + 직원 검색 + 최근 방문 페이지
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Clock,
  Search,
  Hash,
} from 'lucide-react'
import { useRecentPages } from '@/hooks/useRecentPages'

// ─── OS Detection (client-only) ─────────────────────────────────────────────

function isMac(): boolean {
  if (typeof navigator === 'undefined') return true
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenuResult {
  id: string
  label: string
  href: string
}

interface EmployeeResult {
  id: string
  name: string
  employeeNo: string
  department: { name: string } | null
  company: { code: string } | null
}

// ─── Menu items ──────────────────────────────────────────────────────────────

const MENU_ITEMS: MenuResult[] = [
  { id: 'menu-home', label: '홈', href: '/home' },
  { id: 'menu-employees', label: '직원 관리', href: '/employees' },
  { id: 'menu-attendance', label: '근태 관리', href: '/attendance' },
  { id: 'menu-attendance-team', label: '팀 근태', href: '/attendance/team' },
  { id: 'menu-leave', label: '휴가 관리', href: '/leave' },
  { id: 'menu-leave-admin', label: '휴가 관리 (관리자)', href: '/leave/admin' },
  { id: 'menu-performance', label: '성과 관리', href: '/performance' },
  { id: 'menu-performance-mbo', label: 'MBO 목표', href: '/performance/mbo' },
  { id: 'menu-performance-eval', label: '성과 평가', href: '/performance/evaluations' },
  { id: 'menu-performance-1on1', label: '1:1 미팅', href: '/performance/one-on-one' },
  { id: 'menu-recruitment', label: '채용 관리', href: '/recruitment' },
  { id: 'menu-recruitment-board', label: '채용 칸반 보드', href: '/recruitment/board' },
  { id: 'menu-payroll', label: '급여 관리', href: '/payroll' },
  { id: 'menu-compensation', label: '연봉/보상', href: '/compensation' },
  { id: 'menu-onboarding', label: '온보딩', href: '/onboarding' },
  { id: 'menu-offboarding', label: '퇴직 관리', href: '/offboarding' },
  { id: 'menu-training', label: '교육 관리', href: '/training' },
  { id: 'menu-benefits', label: '복리후생', href: '/benefits' },
  { id: 'menu-succession', label: '승계 계획', href: '/talent/succession' },
  { id: 'menu-analytics', label: '분석 대시보드', href: '/analytics' },
  { id: 'menu-predictive', label: 'HR 예측 애널리틱스', href: '/analytics/predictive' },
  { id: 'menu-discipline', label: '징계·포상', href: '/discipline' },
  { id: 'menu-manager-hub', label: '매니저 허브', href: '/manager-hub' },
  { id: 'menu-approvals', label: '승인함', href: '/approvals/attendance' },
  { id: 'menu-directory', label: 'People Directory', href: '/directory' },
  { id: 'menu-org', label: '조직 관리', href: '/org' },
  { id: 'menu-settings', label: '설정', href: '/settings' },
  { id: 'menu-notifications', label: '알림', href: '/notifications' },
]

// ─── Fuzzy match ─────────────────────────────────────────────────────────────

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

// ─── Avatar color palette ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#4F46E5', '#F4845F', '#2DCE89', '#F5A623',
  '#9B59B6', '#1ABC9C', '#E74C3C', '#3498DB',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter()
  const t = useTranslations('commandPalette')
  const { recentPages } = useRecentPages()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [employeeResults, setEmployeeResults] = useState<EmployeeResult[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mac, setMac] = useState(true)

  const inputRef = useRef<HTMLInputElement>(null)

  // Detect OS on mount
  useEffect(() => {
    setMac(isMac())
  }, [])

  // ─── Global Cmd+K / Ctrl+K ───────────────────────────────────────────────
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

  // Auto-focus / reset on open/close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
      setDebouncedQuery('')
      setEmployeeResults([])
      setActiveIndex(0)
    }
  }, [open])

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Reset keyboard index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [debouncedQuery])

  // ─── Employee API search (directory) ─────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setEmployeeResults([])
      return
    }
    setLoadingEmployees(true)
    fetch(`/api/v1/directory?search=${encodeURIComponent(debouncedQuery)}&limit=5`)
      .then((r) => r.json())
      .then((json) => {
        setEmployeeResults((json.data as EmployeeResult[]) ?? [])
      })
      .catch(() => setEmployeeResults([]))
      .finally(() => setLoadingEmployees(false))
  }, [debouncedQuery])

  // ─── Derived result lists ─────────────────────────────────────────────────
  const filteredMenus: MenuResult[] = debouncedQuery
    ? MENU_ITEMS.filter((item) => fuzzyMatch(item.label, debouncedQuery)).slice(0, 5)
    : []

  // Flat list for keyboard navigation
  // Order: employees → menus  (when searching)
  //        recent pages       (when empty)
  const flatList: { id: string; href: string }[] = debouncedQuery
    ? [
      ...employeeResults.map((e) => ({ id: `emp-${e.id}`, href: `/employees/${e.id}` })),
      ...filteredMenus.map((m) => ({ id: m.id, href: m.href })),
    ]
    : recentPages.map((p) => ({ id: `recent-${p.path}`, href: p.path }))

  // ─── Navigation helper ────────────────────────────────────────────────────
  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  // ─── Keyboard navigation ─────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % Math.max(flatList.length, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev === 0 ? Math.max(flatList.length - 1, 0) : prev - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = flatList[activeIndex]
        if (selected) navigate(selected.href)
      }
    },
    [flatList, activeIndex, navigate],
  )

  if (!open) return null

  const shortcutHint = mac ? '⌘K' : 'Ctrl+K'
  const placeholderText = `${t('placeholder')}  ${shortcutHint}`

  const hasResults =
    debouncedQuery
      ? employeeResults.length > 0 || filteredMenus.length > 0
      : recentPages.length > 0

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onMouseDown={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative mx-4 w-full max-w-[560px] overflow-hidden rounded-xl border border-[#F0F0F3] bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 border-b border-[#F0F0F3] px-4 py-3.5">
          <Search className="h-4 w-4 flex-shrink-0 text-[#8181A5]" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 border-none bg-transparent text-[15px] text-[#1C1D21] placeholder:text-[#8181A5] focus:outline-none focus:ring-0"
            placeholder={placeholderText}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden items-center gap-0.5 rounded border border-[#F0F0F3] bg-[#F5F5FA] px-1.5 py-0.5 font-mono text-[10px] text-[#8181A5] sm:inline-flex">
            ESC
          </kbd>
        </div>

        {/* ── Results area ── */}
        <div className="max-h-[420px] overflow-y-auto py-2">

          {/* ── No-query state: Recent pages ── */}
          {!debouncedQuery && recentPages.length > 0 && (
            <ResultGroup label={t('recentPages')}>
              {recentPages.map((page, idx) => (
                <button
                  key={`recent-${page.path}`}
                  type="button"
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${flatList[activeIndex]?.id === `recent-${page.path}`
                      ? 'bg-[#F5F5FA]'
                      : 'hover:bg-[#F5F5FA]'
                    }`}
                  onMouseDown={(e) => { e.preventDefault(); navigate(page.path) }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <Clock className="h-4 w-4 flex-shrink-0 text-[#8181A5]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#1C1D21]">{page.title}</p>
                    <p className="truncate text-xs text-[#8181A5]">{page.path}</p>
                  </div>
                </button>
              ))}
            </ResultGroup>
          )}

          {/* ── No-query, no recent: empty tip ── */}
          {!debouncedQuery && recentPages.length === 0 && (
            <div className="px-4 py-6 text-center">
              <Hash className="mx-auto mb-2 h-5 w-5 text-[#C5C7D4]" />
              <p className="text-sm text-[#8181A5]">직원 이름, 메뉴를 검색하세요</p>
            </div>
          )}

          {/* ── Employee results ── */}
          {debouncedQuery && (employeeResults.length > 0 || loadingEmployees) && (
            <ResultGroup label={t('employees')}>
              {loadingEmployees && employeeResults.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#8181A5]">검색 중…</div>
              ) : (
                employeeResults.map((emp, idx) => {
                  const flatIdx = idx
                  const initial = emp.name.charAt(0).toUpperCase()
                  const bgColor = avatarColor(emp.name)
                  const dept = emp.department?.name ?? ''
                  const code = emp.employeeNo ?? ''
                  const subtitle = [dept, code].filter(Boolean).join(' · ')
                  return (
                    <button
                      key={`emp-${emp.id}`}
                      type="button"
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${flatList[activeIndex]?.id === `emp-${emp.id}`
                          ? 'bg-[#F5F5FA]'
                          : 'hover:bg-[#F5F5FA]'
                        }`}
                      onMouseDown={(e) => { e.preventDefault(); navigate(`/employees/${emp.id}`) }}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                    >
                      {/* Avatar */}
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: bgColor }}
                      >
                        {initial}
                      </span>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1C1D21]">{emp.name}</p>
                        {subtitle && (
                          <p className="truncate text-xs text-[#8181A5]">{subtitle}</p>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </ResultGroup>
          )}

          {/* ── Menu results ── */}
          {debouncedQuery && filteredMenus.length > 0 && (
            <ResultGroup label={t('menu')}>
              {filteredMenus.map((item) => {
                const flatIdx = flatList.findIndex((f) => f.id === item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${flatList[activeIndex]?.id === item.id
                        ? 'bg-[#F5F5FA] text-[#4F46E5]'
                        : 'hover:bg-[#F5F5FA]'
                      }`}
                    onMouseDown={(e) => { e.preventDefault(); navigate(item.href) }}
                    onMouseEnter={() => setActiveIndex(flatIdx)}
                  >
                    <LayoutDashboard className={`h-4 w-4 flex-shrink-0 ${flatList[activeIndex]?.id === item.id ? 'text-[#4F46E5]' : 'text-[#C5C7D4]'
                      }`} />
                    <span className={`text-sm font-medium ${flatList[activeIndex]?.id === item.id ? 'text-[#4F46E5]' : 'text-[#3D3F4E]'
                      }`}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </ResultGroup>
          )}

          {/* ── No results ── */}
          {debouncedQuery && !loadingEmployees && !hasResults && (
            <div className="px-4 py-8 text-center text-sm text-[#8181A5]">
              {t('noResults')}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-[#F0F0F3] bg-[#FAFAFA] px-4 py-2">
          <div className="flex items-center gap-3 text-[11px] text-[#C5C7D4]">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#E8E8EC] bg-white px-1 py-0.5 font-mono">↑↓</kbd>
              탐색
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#E8E8EC] bg-white px-1 py-0.5 font-mono">↵</kbd>
              이동
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#E8E8EC] bg-white px-1 py-0.5 font-mono">ESC</kbd>
              닫기
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#C5C7D4]">{shortcutHint}</span>
        </div>
      </div>
    </div>
  )
}

// ─── ResultGroup ─────────────────────────────────────────────────────────────

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 px-2">
      <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#C5C7D4]">
        {label}
      </p>
      {children}
    </div>
  )
}
