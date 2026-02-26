'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CommandPalette (Cmd+K 전역 검색)
// cmdk 기반, 4종 검색 카테고리 그룹핑
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

// ─── Types ──────────────────────────────────────────────────

interface SearchResult {
  id: string
  label: string
  description?: string
  href?: string
}

// ─── Stub data (실제 검색은 후속 STEP에서 구현) ────────────

const MENU_ITEMS: SearchResult[] = [
  { id: 'menu-employees', label: '직원 관리', href: '/employees' },
  { id: 'menu-attendance', label: '근태 관리', href: '/attendance' },
  { id: 'menu-leave', label: '휴가 관리', href: '/leave' },
  { id: 'menu-performance', label: '성과 관리', href: '/performance' },
  { id: 'menu-recruitment', label: '채용 관리', href: '/recruitment' },
  { id: 'menu-payroll', label: '급여 관리', href: '/payroll' },
  { id: 'menu-settings', label: '설정', href: '/settings' },
]

// ─── Component ──────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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

  // Debounce stub (200ms) — search integration in later steps
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      router.push(href)
    },
    [router],
  )

  // Stub: filter menu items by query
  const filteredMenus = debouncedQuery
    ? MENU_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(debouncedQuery.toLowerCase()),
      ).slice(0, 3)
    : MENU_ITEMS.slice(0, 3)

  // Stub: employee search results (empty for now)
  const employeeResults: SearchResult[] = []

  // Stub: HR policy search results (empty for now)
  const policyResults: SearchResult[] = []

  // Stub: recent searches (empty for now)
  const recentResults: SearchResult[] = []

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="검색어를 입력하세요... (직원, 메뉴, HR 정책)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>

        {/* 직원 검색 */}
        {employeeResults.length > 0 && (
          <CommandGroup heading="직원 검색">
            {employeeResults.map((result) => (
              <CommandItem
                key={result.id}
                value={result.label}
                onSelect={() => handleSelect(result.href ?? '#')}
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
            <CommandGroup heading="메뉴 검색">
              {filteredMenus.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleSelect(item.href ?? '#')}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* HR 정책 */}
        {policyResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="HR 정책">
              {policyResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.label}
                  onSelect={() => handleSelect(result.href ?? '#')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{result.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* 최근 검색 */}
        {recentResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="최근 검색">
              {recentResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.label}
                  onSelect={() => handleSelect(result.href ?? '#')}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{result.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* 검색 안내 (빈 상태 / 초기) */}
        {!debouncedQuery && (
          <>
            <CommandSeparator />
            <div className="px-4 py-3 text-center text-xs text-muted-foreground">
              <Search className="mx-auto mb-1 h-4 w-4" />
              <p>직원 이름, 메뉴, HR 정책을 검색하세요</p>
              <p className="mt-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  Ctrl+K
                </kbd>{' '}
                또는{' '}
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  Cmd+K
                </kbd>
              </p>
            </div>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
