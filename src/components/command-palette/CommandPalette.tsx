'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CommandPalette (Cmd+O 전역 검색)
// cmdk 기반, API 검색 + 메뉴 퍼지매칭 + 최근 검색
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  LayoutDashboard,
  FileText,
  Clock,
  Search,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
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
  { id: 'menu-home', label: '홈', href: '/', category: 'menu' },
  { id: 'menu-employees', label: '직원 관리', href: '/employees', category: 'menu' },
  { id: 'menu-attendance', label: '근태 관리', href: '/attendance', category: 'menu' },
  { id: 'menu-attendance-team', label: '팀 근태', href: '/attendance/team', category: 'menu' },
  { id: 'menu-leave', label: '휴가 관리', href: '/leave', category: 'menu' },
  { id: 'menu-performance', label: '성과 관리', href: '/performance', category: 'menu' },
  { id: 'menu-performance-mbo', label: 'MBO 목표', href: '/performance/mbo', category: 'menu' },
  { id: 'menu-performance-eval', label: '성과 평가', href: '/performance/evaluations', category: 'menu' },
  { id: 'menu-performance-1on1', label: '1:1 미팅', href: '/performance/one-on-one', category: 'menu' },
  { id: 'menu-recruitment', label: '채용 관리', href: '/recruitment', category: 'menu' },
  { id: 'menu-payroll', label: '급여 관리', href: '/payroll', category: 'menu' },
  { id: 'menu-compensation', label: '연봉/보상', href: '/compensation', category: 'menu' },
  { id: 'menu-onboarding', label: '온보딩', href: '/onboarding', category: 'menu' },
  { id: 'menu-training', label: '교육 관리', href: '/training', category: 'menu' },
  { id: 'menu-benefits', label: '복리후생', href: '/benefits', category: 'menu' },
  { id: 'menu-succession', label: '후계자 관리', href: '/succession', category: 'menu' },
  { id: 'menu-analytics', label: '분석', href: '/analytics', category: 'menu' },
  { id: 'menu-discipline', label: '징계·포상', href: '/discipline', category: 'menu' },
  { id: 'menu-manager-hub', label: '매니저 허브', href: '/manager-hub', category: 'menu' },
  { id: 'menu-settings', label: '설정', href: '/settings', category: 'menu' },
  { id: 'menu-hr-documents', label: 'HR 문서 관리', href: '/settings/hr-documents', category: 'menu' },
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
  const router = useRouter()

  // Cmd+O / Ctrl+O handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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

  // Menu fuzzy match
  const filteredMenus = debouncedQuery
    ? MENU_ITEMS.filter((item) => fuzzyMatch(item.label, debouncedQuery)).slice(
        0,
        5,
      )
    : MENU_ITEMS.slice(0, 5)

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="검색어를 입력하세요... (직원, 메뉴, HR 규정)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>

        {/* 직원 검색 */}
        {employeeResults.length > 0 && (
          <CommandGroup heading="👤 직원">
            {employeeResults.map((result) => (
              <CommandItem
                key={result.id}
                value={result.label}
                onSelect={() => handleSelect(result)}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>{result.label}</span>
                {result.description && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {result.description}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 메뉴 검색 */}
        {filteredMenus.length > 0 && (
          <>
            {employeeResults.length > 0 && <CommandSeparator />}
            <CommandGroup heading="📋 메뉴">
              {filteredMenus.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleSelect(item)}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* HR 문서 */}
        {documentResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="📖 규정">
              {documentResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.label}
                  onSelect={() => handleSelect(result)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{result.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* 최근 검색 */}
        {!debouncedQuery && recentResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="🕐 최근">
              {recentResults.map((result) => (
                <CommandItem
                  key={`recent-${result.id}`}
                  value={result.label}
                  onSelect={() => handleSelect(result)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{result.label}</span>
                  {result.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {result.description}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* 검색 안내 */}
        {!debouncedQuery && recentResults.length === 0 && (
          <>
            <CommandSeparator />
            <div className="px-4 py-3 text-center text-xs text-muted-foreground">
              <Search className="mx-auto mb-1 h-4 w-4" />
              <p>직원 이름, 메뉴, HR 규정을 검색하세요</p>
              <p className="mt-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  Ctrl+O
                </kbd>{' '}
                또는{' '}
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  Cmd+O
                </kbd>
              </p>
            </div>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
