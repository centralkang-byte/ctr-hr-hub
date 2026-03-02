# A2-1b: Settings Hub UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 37-item sidebar settings menu with a single "/settings" link that leads to a 3×2 category hub page and per-category sub-pages with side-tab navigation.

**Architecture:** categories.ts defines 6 category + 37 item data; hub page renders a searchable card grid; `[category]/page.tsx` renders side-tab + placeholder with `?tab=` URL state; navigation.ts settings section collapses to one link.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, lucide-react, shadcn/ui (Select), `next/navigation` (useRouter, useSearchParams, usePathname, redirect)

**Color accent:** `#00C853` (CTR Green — CLAUDE.md primary) everywhere the spec said #E1251B.

**Verification:** `cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -c "error TS"` — new files must not add errors beyond the existing 418.

---

## Pre-flight

Before starting, confirm baselines:

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx tsc --noEmit 2>&1 | grep -c "error TS"
# Expected: 418 (or near — existing known errors)
```

---

## Task 1: Create Category Data

**File to create:** `src/lib/settings/categories.ts`

**Step 1: Create the file**

```typescript
// src/lib/settings/categories.ts
import {
  Calendar, BarChart3, Banknote, UserPlus, Building2, Cog,
  type LucideIcon,
} from 'lucide-react'

export interface SettingsItem {
  id: string
  label: string
  description: string
}

export interface SettingsCategory {
  id: string
  icon: LucideIcon
  label: string
  labelEn: string
  href: string
  disabled?: boolean
  items: SettingsItem[]
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'attendance',
    icon: Calendar,
    label: '근태/휴가',
    labelEn: 'Attendance & Leave',
    href: '/settings/attendance',
    items: [
      { id: 'work-schedule', label: '근무스케줄 설정', description: '법인별 기본 근무시간, 유연근무제, 시차출퇴근 패턴 정의' },
      { id: 'holidays', label: '공휴일 관리', description: '법인/국가별 공휴일 캘린더, 대체공휴일 규칙' },
      { id: 'leave-policy', label: '휴가정책', description: '연차/병가/경조사 등 휴가 유형별 부여 규칙, 이월 정책' },
      { id: 'overtime', label: '초과근무 정책', description: '52시간 상한, 연장근로 승인 워크플로, 보상휴가 전환 규칙' },
      { id: 'devices', label: '출퇴근 단말기', description: '태깅 디바이스 등록, 위치 기반 출퇴근 인증 설정' },
      { id: 'alerts-52h', label: '52시간 알림 기준', description: '주간/월간 누적 시간 임계치별 알림 트리거 설정' },
    ],
  },
  {
    id: 'performance',
    icon: BarChart3,
    label: '성과/평가',
    labelEn: 'Performance',
    href: '/settings/performance',
    items: [
      { id: 'eval-cycle', label: '평가사이클', description: '연간/반기/분기 평가 주기, 일정, 단계별 마감 기한' },
      { id: 'mbo', label: 'MBO 설정', description: '목표 수립 규칙, 가중치 범위, 자동 캐스케이딩 옵션' },
      { id: 'cfr', label: 'CFR 주기', description: 'Conversation-Feedback-Recognition 빈도, 리마인더 설정' },
      { id: 'bei', label: 'BEI 역량모델', description: '핵심가치 연계 행동지표(13개) 관리, 직급별 기대 수준' },
      { id: 'calibration', label: '캘리브레이션 규칙', description: '등급 분포 가이드라인, 강제배분 비율, 예외 승인 흐름' },
      { id: 'grade-system', label: '등급체계', description: 'S/A/B/C/D 등급 정의, 점수 구간, 표시 레이블 커스터마이징' },
      { id: 'multi-rater', label: '다면평가 설정', description: '평가자 유형(상향/동료/360), 익명성 수준, 최소 응답자 수' },
    ],
  },
  {
    id: 'compensation',
    icon: Banknote,
    label: '보상/복리후생',
    labelEn: 'Compensation & Benefits',
    href: '/settings/compensation',
    items: [
      { id: 'salary-band', label: '급여밴드', description: '직급/직무별 급여 범위, 시장 데이터 연동 기준' },
      { id: 'raise-matrix', label: '인상매트릭스', description: '성과등급 × 현재 위치(Compa-ratio) 기반 인상률 테이블' },
      { id: 'benefits', label: '복리후생 항목', description: '법인별 복리후생 메뉴, 자격 조건, 신청 기간' },
      { id: 'allowances', label: '수당 정책', description: '직책수당, 자격수당, 교통비 등 수당 유형 및 지급 규칙' },
      { id: 'payroll-integration', label: '외부 급여시스템 연동', description: '급여 데이터 전송 포맷, 마감 스케줄, API 설정' },
    ],
  },
  {
    id: 'recruitment',
    icon: UserPlus,
    label: '채용/온보딩',
    labelEn: 'Recruitment & Onboarding',
    href: '/settings/recruitment',
    items: [
      { id: 'pipeline', label: '채용 파이프라인', description: '8단계 파이프라인 커스터마이징, 단계별 자동화 규칙' },
      { id: 'eval-template', label: '평가기준 템플릿', description: '직무별 면접 평가표, 채점 기준, 합격 컷오프' },
      { id: 'ai-screening', label: 'AI 스크리닝 설정', description: 'AI 이력서 분석 기준, 매칭 가중치, 바이어스 필터' },
      { id: 'onboarding-checklist', label: '온보딩 체크리스트', description: 'Day 1/7/30/90 체크인 항목, 담당자 자동 배정 규칙' },
      { id: 'emotion-pulse', label: '감정펄스 주기', description: '신규 입사자 감정 서베이 빈도, 질문 템플릿, 에스컬레이션 기준' },
    ],
  },
  {
    id: 'organization',
    icon: Building2,
    label: '조직/인사',
    labelEn: 'Organization & HR',
    href: '/settings/organization',
    items: [
      { id: 'entities', label: '법인 관리', description: '6개 법인 기본 정보, 현지 노동법 파라미터, 통화/언어' },
      { id: 'org-chart', label: '조직도 설정', description: '부서 계층 구조, 표시 옵션, 점선 보고 라인' },
      { id: 'job-levels', label: '직급체계', description: 'L1/L2+ 직급 정의, 승진 경로, 직급별 권한 매핑' },
      { id: 'job-family', label: '직무분류', description: '직무군(Job Family), 직무(Job Role) 체계, 역량 연결' },
      { id: 'transfer-rules', label: '전출/전입 규칙', description: '법인 간 이동 워크플로, 필수 문서, 승인 체인' },
      { id: 'personnel-orders', label: '인사발령 유형', description: '승진/전보/휴직/복직 등 발령 유형 및 처리 절차' },
    ],
  },
  {
    id: 'system',
    icon: Cog,
    label: '시스템/연동',
    labelEn: 'System & Integration',
    href: '/settings/system',
    items: [
      { id: 'notifications', label: '알림 설정', description: '채널별(이메일/Teams/인앱) 알림 유형, 빈도, 수신 대상' },
      { id: 'workflow-engine', label: '워크플로 엔진', description: '승인 흐름 템플릿, 조건부 라우팅, 에스컬레이션 규칙' },
      { id: 'module-toggle', label: '모듈 활성화', description: '법인별 사용 모듈 On/Off, 기능 플래그 관리' },
      { id: 'teams', label: 'Teams 연동', description: 'Microsoft Teams 봇 설정, Adaptive Card 템플릿' },
      { id: 'm365', label: 'M365 연동', description: 'Outlook 캘린더 동기화, SharePoint 문서 연결' },
      { id: 'data-migration', label: '데이터 마이그레이션', description: 'i-people 등 레거시 데이터 임포트, 매핑 규칙' },
      { id: 'rbac', label: '역할/권한', description: 'RBAC 역할 정의, 페이지/기능별 접근 제어 매트릭스' },
      { id: 'audit-log', label: '감사로그', description: '로그 보존 기간, 추적 대상 액션, 내보내기 설정' },
    ],
  },
]

export function getCategoryById(id: string): SettingsCategory | undefined {
  return SETTINGS_CATEGORIES.find((c) => c.id === id)
}

export function getTotalItemCount(): number {
  return SETTINGS_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0)
}
```

**Step 2: Verify TypeScript**

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx tsc --noEmit 2>&1 | grep "categories.ts"
# Expected: no output (no errors in this file)
```

**Step 3: Commit**

```bash
git add src/lib/settings/categories.ts
git commit -m "feat(settings): add category data definitions (6 categories, 37 items)"
```

---

## Task 2: Simplify Sidebar Navigation

**File to modify:** `src/config/navigation.ts`

**What:** Replace the 37-item settings `items` array with a single entry.

**Step 1: Find the settings section**

Open `src/config/navigation.ts`. Locate the `// ── 7. 설정` section (around line 667–972).

**Step 2: Replace items array**

Replace everything from `items: [` to the closing `],` of the settings section with:

```typescript
items: [
  {
    key: 'settings-hub',
    labelKey: 'nav.settings.hub',
    label: '설정',
    href: '/settings',
    icon: Settings,
    module: MODULE.SETTINGS,
  },
],
```

The full settings section should now look like:

```typescript
// ── 7. 설정 ───────────────────────────────────────────
{
  key: 'settings',
  labelKey: 'nav.settings.label',
  label: '설정',
  icon: Settings,
  visibleTo: HR_UP,
  items: [
    {
      key: 'settings-hub',
      labelKey: 'nav.settings.hub',
      label: '설정',
      href: '/settings',
      icon: Settings,
      module: MODULE.SETTINGS,
    },
  ],
},
```

**Step 3: Clean up unused imports**

After replacing the items, remove any lucide-react imports that are now unused. Check these specifically (they were only used in settings items):

```typescript
// Remove these if no longer used elsewhere in the file:
CalendarClock, CalendarCheck, Monitor, Scale (check — also used in insights),
Palette, Languages, List, FormInput, GitBranch, Mail (check — also in insights),
Gauge, ToggleLeft, Download, LayoutGrid, ListChecks
```

> **Note:** `Scale` is used in the insights section (calibration-settings). `Mail` is used in insights (m365). Only remove imports that are truly unused. Run tsc to find unused imports.

**Step 4: Verify**

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx tsc --noEmit 2>&1 | grep "navigation.ts"
# Expected: no errors for navigation.ts
```

**Step 5: Commit**

```bash
git add src/config/navigation.ts
git commit -m "feat(settings): collapse 37 sidebar items to single settings hub link"
```

---

## Task 3: Settings Layout

**File to create:** `src/app/(dashboard)/settings/layout.tsx`

> This is the shared wrapper for `/settings` and `/settings/[category]`. It adds breadcrumb context.

**Step 1: Create the file**

```typescript
// src/app/(dashboard)/settings/layout.tsx
import type { ReactNode } from 'react'

interface SettingsLayoutProps {
  children: ReactNode
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {children}
    </div>
  )
}
```

> **Why minimal:** Breadcrumb logic is per-page because it requires knowing which category/tab is active (client-side URL state). Hub and sub-pages each render their own breadcrumb.

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "settings/layout"
# Expected: no output
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/settings/layout.tsx"
git commit -m "feat(settings): add settings layout wrapper"
```

---

## Task 4: SettingsPlaceholder Component

**File to create:** `src/components/settings/SettingsPlaceholder.tsx`

**Step 1: Create the file**

```typescript
// src/components/settings/SettingsPlaceholder.tsx
import { Construction } from 'lucide-react'

interface SettingsPlaceholderProps {
  label: string
  description: string
}

export function SettingsPlaceholder({ label, description }: SettingsPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
        <Construction className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">{label}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      <p className="mt-3 text-xs text-gray-400">Phase B에서 구현 예정</p>
    </div>
  )
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "SettingsPlaceholder"
# Expected: no output
```

**Step 3: Commit**

```bash
git add src/components/settings/SettingsPlaceholder.tsx
git commit -m "feat(settings): add SettingsPlaceholder component"
```

---

## Task 5: SettingsCard Component

**File to create:** `src/components/settings/SettingsCard.tsx`

**Step 1: Create the file**

```typescript
// src/components/settings/SettingsCard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { SettingsCategory } from '@/lib/settings/categories'

interface SettingsCardProps {
  category: SettingsCategory
}

export function SettingsCard({ category }: SettingsCardProps) {
  const router = useRouter()
  const Icon = category.icon
  const previewItems = category.items.slice(0, 3)

  return (
    <button
      type="button"
      onClick={() => router.push(category.href)}
      className={cn(
        'group w-full rounded-xl border border-gray-200 bg-white p-6 text-left',
        'shadow-sm transition-all duration-150',
        'hover:border-l-4 hover:border-[#00C853] hover:shadow-md',
        category.disabled && 'cursor-not-allowed opacity-50',
      )}
      disabled={category.disabled}
    >
      {/* Icon */}
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 p-2">
        <Icon className="h-6 w-6 text-gray-600" />
      </div>

      {/* Labels */}
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{category.label}</h3>
        <p className="mt-0.5 text-xs text-gray-400">{category.labelEn}</p>
      </div>

      {/* Item count badge */}
      <p className="mb-3 text-sm text-gray-500">{category.items.length}개 항목</p>

      {/* Preview list */}
      <ul className="space-y-1">
        {previewItems.map((item) => (
          <li key={item.id} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="text-gray-400">·</span>
            {item.label}
          </li>
        ))}
      </ul>
    </button>
  )
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "SettingsCard"
# Expected: no output
```

**Step 3: Commit**

```bash
git add src/components/settings/SettingsCard.tsx
git commit -m "feat(settings): add SettingsCard component"
```

---

## Task 6: SettingsSearch Component

**File to create:** `src/components/settings/SettingsSearch.tsx`

**Step 1: Create the file**

```typescript
// src/components/settings/SettingsSearch.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SETTINGS_CATEGORIES, type SettingsCategory, type SettingsItem } from '@/lib/settings/categories'

interface SearchResult {
  category: SettingsCategory
  item: SettingsItem
}

interface SettingsSearchProps {
  onQueryChange?: (query: string) => void
}

export function SettingsSearch({ onQueryChange }: SettingsSearchProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const results: SearchResult[] = query.trim().length < 2
    ? []
    : SETTINGS_CATEGORIES.flatMap((category) =>
        category.items
          .filter(
            (item) =>
              item.label.includes(query) ||
              item.description.includes(query),
          )
          .map((item) => ({ category, item })),
      )

  function handleChange(value: string) {
    setQuery(value)
    onQueryChange?.(value)
  }

  function handleResultClick(category: SettingsCategory, item: SettingsItem) {
    router.push(`${category.href}?tab=${item.id}`)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="설정 검색... (예: 급여밴드, 공휴일)"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="h-10 pl-9 text-sm"
        />
      </div>

      {/* Dropdown results */}
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map(({ category, item }) => (
            <button
              key={`${category.id}-${item.id}`}
              type="button"
              onClick={() => handleResultClick(category, item)}
              className="flex w-full flex-col px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="text-sm font-medium text-gray-900">{item.label}</span>
              <span className="mt-0.5 text-xs text-gray-400">
                {category.label} · {item.description.slice(0, 50)}…
              </span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-sm text-gray-500">
            &ldquo;{query}&rdquo;에 해당하는 설정 항목이 없습니다.
          </p>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "SettingsSearch"
# Expected: no output
```

**Step 3: Commit**

```bash
git add src/components/settings/SettingsSearch.tsx
git commit -m "feat(settings): add SettingsSearch component with dropdown results"
```

---

## Task 7: Settings Hub Page

**File to replace:** `src/app/(dashboard)/settings/page.tsx`

> The current file renders `CompanySettingsClient`. We replace the entire page with the new hub. `CompanySettingsClient.tsx` is NOT deleted — it will be reused in Phase B under the `system` category.

**Step 1: Replace the page**

```typescript
// src/app/(dashboard)/settings/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { Settings } from 'lucide-react'
import { SETTINGS_CATEGORIES } from '@/lib/settings/categories'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsSearch } from '@/components/settings/SettingsSearch'

export default async function SettingsHubPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  // Auth check only — no role guard needed here (middleware handles it)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00C853]/10">
            <Settings className="h-5 w-5 text-[#00C853]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">설정</h1>
            <p className="text-sm text-gray-500">
              시스템 설정을 카테고리별로 관리합니다
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8 max-w-lg">
        <SettingsSearch />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CATEGORIES.map((category) => (
          <SettingsCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "settings/page"
# Expected: no output
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/settings/page.tsx"
git commit -m "feat(settings): replace settings page with 3x2 category hub"
```

---

## Task 8: SettingsSideTabs Component

**File to create:** `src/components/settings/SettingsSideTabs.tsx`

**Step 1: Create the file**

```typescript
// src/components/settings/SettingsSideTabs.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { SettingsItem } from '@/lib/settings/categories'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SettingsSideTabsProps {
  categoryHref: string
  items: SettingsItem[]
  activeTab: string
}

export function SettingsSideTabs({ categoryHref, items, activeTab }: SettingsSideTabsProps) {
  const router = useRouter()

  function navigate(tabId: string) {
    router.push(`${categoryHref}?tab=${tabId}`)
  }

  return (
    <>
      {/* Desktop: side tabs */}
      <nav className="hidden w-60 shrink-0 border-r border-gray-200 pr-0 lg:block">
        <ul className="space-y-0.5 py-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => navigate(item.id)}
                className={cn(
                  'w-full rounded-r-lg px-4 py-2.5 text-left text-sm transition-colors',
                  activeTab === item.id
                    ? 'border-l-4 border-[#00C853] bg-green-50/50 font-medium text-gray-900'
                    : 'border-l-4 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile: select dropdown */}
      <div className="mb-4 lg:hidden">
        <Select value={activeTab} onValueChange={navigate}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "SettingsSideTabs"
# Expected: no output
```

**Step 3: Commit**

```bash
git add src/components/settings/SettingsSideTabs.tsx
git commit -m "feat(settings): add SettingsSideTabs with mobile select fallback"
```

---

## Task 9: Category Sub-page

**File to create:** `src/app/(dashboard)/settings/[category]/page.tsx`

> Note: An `[category]` directory does NOT exist yet. Create it. The existing specific sub-directories (`/settings/work-schedules`, etc.) are NOT affected — Next.js resolves specific routes before dynamic ones.

**Step 1: Create the directory and page**

First, check if `[category]` directory conflicts with any specific static routes. It won't — Next.js static routes like `/settings/attendance/` take precedence over `[category]`.

```typescript
// src/app/(dashboard)/settings/[category]/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCategoryById } from '@/lib/settings/categories'
import { SettingsSideTabs } from '@/components/settings/SettingsSideTabs'
import { SettingsPlaceholder } from '@/components/settings/SettingsPlaceholder'

interface CategoryPageProps {
  params: { category: string }
  searchParams: { tab?: string }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const category = getCategoryById(params.category)
  if (!category) redirect('/settings')

  // Determine active tab: from URL or default to first item
  const activeTabId = searchParams.tab ?? category.items[0]?.id ?? ''
  const activeItem = category.items.find((i) => i.id === activeTabId) ?? category.items[0]

  const Icon = category.icon

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/settings" className="hover:text-gray-600">설정</Link>
        <span>/</span>
        <span className="text-gray-600">{category.label}</span>
        {activeItem && (
          <>
            <span>/</span>
            <span className="text-gray-600">{activeItem.label}</span>
          </>
        )}
      </div>

      {/* Back link */}
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        설정으로 돌아가기
      </Link>

      {/* Category header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 p-2">
          <Icon className="h-6 w-6 text-gray-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{category.label}</h1>
      </div>

      {/* Side-tab layout */}
      <div className="flex gap-8">
        <SettingsSideTabs
          categoryHref={category.href}
          items={category.items}
          activeTab={activeTabId}
        />

        {/* Content area */}
        <div className="min-w-0 flex-1">
          {activeItem ? (
            <>
              {/* Item header */}
              <div className="mb-6 border-b border-gray-200 pb-4">
                <h2 className="text-xl font-semibold text-gray-900">{activeItem.label}</h2>
                <p className="mt-1 text-sm text-gray-500">{activeItem.description}</p>
              </div>

              {/* Placeholder */}
              <SettingsPlaceholder
                label={`${activeItem.label} 설정 폼 준비 중`}
                description={activeItem.description}
              />
            </>
          ) : (
            <p className="text-sm text-gray-500">항목을 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "\[category\]"
# Expected: no output
```

**Step 3: Verify error count hasn't grown**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
# Expected: same as or less than pre-flight count (418)
```

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/settings/[category]/page.tsx"
git commit -m "feat(settings): add category sub-page with side-tabs and placeholder"
```

---

## Task 10: Update context.md

**File to modify:** `/Users/sangwoo/Documents/VibeCoding/GHR/context.md`

**Step 1: Update progress table**

Change A2-1b status from unlisted to `✅ 완료`:

```markdown
| | A2-1b Settings Hub UI | ✅ 완료 |
```

Insert this row after the A2-1 row. Also update A2-2 to `🔄 다음 실행 대기`.

**Step 2: Add A2-1b section**

Append a new section after the A2-1 section:

```markdown
### A2-1b: Settings Hub UI (완료)

**작업 일자:** 2026-03-02

**생성/변경된 파일:**
| 파일 | 상태 | 내용 |
|------|------|------|
| `src/lib/settings/categories.ts` | 신규 생성 | 6개 카테고리 × 37개 항목 데이터 |
| `src/config/navigation.ts` | 수정 | 설정 items 37개 → 단일 링크 |
| `src/app/(dashboard)/settings/layout.tsx` | 신규 생성 | 설정 공통 레이아웃 |
| `src/app/(dashboard)/settings/page.tsx` | 교체 | 3×2 카드 허브 (CompanySettingsClient → 새 허브) |
| `src/app/(dashboard)/settings/[category]/page.tsx` | 신규 생성 | 카테고리 서브페이지 (사이드탭 + 플레이스홀더) |
| `src/components/settings/SettingsCard.tsx` | 신규 생성 | 허브 카테고리 카드 |
| `src/components/settings/SettingsSearch.tsx` | 신규 생성 | 검색바 + 드롭다운 결과 |
| `src/components/settings/SettingsSideTabs.tsx` | 신규 생성 | 좌측 사이드탭 (모바일: Select) |
| `src/components/settings/SettingsPlaceholder.tsx` | 신규 생성 | 폼 미구현 플레이스홀더 |

**보존된 파일 (삭제 안 함):**
- `src/app/(dashboard)/settings/CompanySettingsClient.tsx` — Phase B에서 system 카테고리에 재활용
- 기존 37개 설정 서브라우트 디렉터리 전체 보존

**액센트 컬러:** `#00C853` (CTR Green — CLAUDE.md 일관성 확인)

**빌드 검증:**
| 검증 항목 | 결과 |
|-----------|------|
| 신규 파일 TypeScript 에러 | 0개 |
| 전체 에러 수 | 418개 (A2-1에서 이월, 변화 없음) |

**A2-2에 전달 사항:**
- 설정 허브 구조 완료. 각 카테고리 서브페이지는 플레이스홀더 표시
- Phase B (B1~B11)에서 각 항목의 실제 폼 구현 시 SettingsPlaceholder 교체
- CompanySettingsClient는 system 카테고리 > company-settings 항목으로 이동 예정
```

**Step 3: Commit context update**

```bash
git add /Users/sangwoo/Documents/VibeCoding/GHR/context.md
git commit -m "docs: update context.md — A2-1b Settings Hub UI complete"
```

---

## Completion Checklist

After all tasks, verify:

- [ ] `npx tsc --noEmit 2>&1 | grep -c "error TS"` = 418 (unchanged)
- [ ] `src/config/navigation.ts` settings section has exactly 1 item
- [ ] `src/lib/settings/categories.ts` exports 6 categories, 37 total items
- [ ] `src/app/(dashboard)/settings/page.tsx` renders hub (no CompanySettingsClient import)
- [ ] `src/app/(dashboard)/settings/[category]/page.tsx` exists
- [ ] `src/components/settings/` has 4 new component files
- [ ] `src/app/(dashboard)/settings/CompanySettingsClient.tsx` still exists (not deleted)
- [ ] context.md updated with A2-1b complete

---

## Potential Gotchas

1. **`useSearchParams` in Server Component:** The `[category]/page.tsx` uses `searchParams` prop (server-side) — no `useSearchParams` needed. Safe.

2. **Next.js route precedence:** `/settings/work-schedules` (static) takes precedence over `/settings/[category]` (dynamic). Existing routes unaffected.

3. **`SettingsSideTabs` imports `useRouter`:** It's a Client Component (`'use client'`). The parent page is a Server Component — this is fine since SC can import CC.

4. **Unused imports after navigation.ts change:** Run tsc and fix any "declared but never read" errors for removed imports.

5. **`app/(dashboard)` path syntax:** Use quotes in shell commands: `git add "src/app/(dashboard)/settings/..."`
