# CTR HR Hub — Design System

> Enterprise HR SaaS. Data-heavy, CJK-first, 5 locales.
> Clean white space + Violet/Green accents. No decoration unless intentional.
> Anti-patterns: 1px borders, uniform radius, purple AI-slop gradients, system emoji.

> **SSOT 관계**
> - 본 문서 = 전체 디자인 시스템 정의 (마스터)
> - `.claude/rules/design.md` = UI 파일 편집 시 자동 주입되는 "금지/필수 체크리스트" 요약본
> - 색상/클래스 구현 SSOT = 각 컴포넌트 파일 (`src/lib/styles/status.ts`, `src/components/ui/badge.tsx`, `src/lib/styles/typography.ts`)
> - 본 문서는 **카테고리·사용 규칙·시각 원칙**을 정의. 실제 Tailwind class 값은 구현 파일 기준.

---

## 1. Color Palette

### Primary & Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| primary | #6366f1 | CTA, active state, links, focus ring |
| primary-dim | #4f46e5 | Gradient endpoint, hover |
| primary-container | #a5b4fc | Light variant, badge bg, highlight |
| tertiary | #16a34a | Success, growth, positive signals |
| tertiary-container | #86efac | Success badge bg |
| destructive | #e11d48 | Error, rejection, delete, 정적 count, 퇴사 |
| alert-red | #ef4444 | 동적 alert, urgent pill, AI 인사이트 semantic bg only (정적 count는 destructive) |
| warning | #B45309 | Pending, probation — **text only** (WCAG AA) |
| warning-bright | #f59e0b | BG/icon/progress bar only (text는 warning #B45309) |
| secondary | #64748b | Muted accent, metadata |
| badge-accent | #7c3aed | Offer, LOA, business trip (badge 전용, `--accent`은 neutral surface) |

### Surface Hierarchy (Tonal Layering)

| Layer | Token | Hex |
|-------|-------|-----|
| Base | background | #f6f6f6 |
| Canvas | surface-container-low | #f0f1f1 |
| Card | surface-container-lowest | #ffffff |
| Elevated | surface-container-high | #e1e3e3 |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| on-surface | #2d2f2f | Primary text (pure #000 forbidden) |
| on-surface-variant | #5a5c5c | Secondary text, labels |
| outline-variant | #acadad | Ghost border (15% opacity ONLY) |

### D17 Color Principle (bg/text 분리)

bg와 text는 다른 토큰을 사용한다. bg는 밝은(bright) 색상으로 시각 강조, text는 어두운(darker) 색상으로 WCAG AA contrast 준수.

| 용도 | bg 토큰 | text 토큰 | 이유 |
|------|---------|-----------|------|
| Warning | `bg-warning-bright/15` (#f59e0b) | `text-ctr-warning` (#B45309) | #f59e0b는 흰 배경에서 text AA 미달 |
| Alert | `bg-alert-red/10` (#ef4444) | `text-destructive` (#e11d48) | 동적/정적 분리 |
| Success | `bg-tertiary/10` (#16a34a) | `text-[#15803d]` | #16a34a는 10px badge text에서 AA 미달 |

도메인 고유 색상(차트 팔레트, 파이프라인 단계, heatmap)은 범용 토큰 통합 금지 — `chart.ts`/`chart-colors.ts`에서 별도 관리.

### Chart Palette
기본 6색: #6366f1, #a5b4fc, #16a34a, #f59e0b, #e11d48, #64748b
확장 4색: #7c3aed, #0ea5e9, #84cc16, #f97316

---

## 2. Typography

| Utility | Font | Usage | Rule |
|---------|------|-------|------|
| `font-sans` | Pretendard Variable | Body, CJK-first | Default everywhere |
| `font-display` | Outfit | Hero KPI, large titles | text-4xl+ only, English/numbers only |
| `font-mono` | Geist Mono | Numbers, codes, dates | MUST pair with `tabular-nums` |

- CJK: `letter-spacing: -0.02em`, `line-height: 1.6+`, base 14px
- font-display on mixed KR/EN text: **FORBIDDEN**
- font-mono without tabular-nums: **FORBIDDEN**

### Scale (구현 SSOT: `src/lib/styles/typography.ts`)

| Key | Size | Weight | Usage |
|-----|------|--------|-------|
| `displayLg` | 56px | 900 | Dashboard hero metric (font-display) |
| `displaySm` | 32px | 800 | Card KPI (font-display) |
| `pageTitle` | 30px | 700 | Page title |
| `sectionTitle` | 24px | 700 | Section title |
| `cardTitle` | 20px | 600 | Card title |
| `subtitle` | 18px | 600 | Subsection |
| `bodyLg` | 16px | 500 | Emphasized body |
| `body` | 14px | 400 | Default body |
| `bodySm` | 13px | 400 | Secondary text |
| `caption` | 12px | 500 | Caption, pagination |
| `label` | 12px | 500 | Form label |
| `tableHeader` | 11px | 600 | Table header (uppercase + tracking) |

컴포넌트에서 `import { TYPOGRAPHY } from '@/lib/styles'` — inline font-size/weight 클래스 사용 금지.

---

## 3. Spacing & Density

Base unit: 4px. Default density: comfortable.

| Density | Card | Cell | Gap | Text | Used in |
|---------|------|------|-----|------|---------|
| compact | p-4 | px-3 py-1 | gap-2 | xs | Payroll, attendance, audit |
| comfortable | p-6 | px-5 py-3 | gap-4 | sm | Employee list, leave, recruitment |
| spacious | p-8 | px-5 py-3.5 | gap-6 | base | Dashboard KPI, profile, onboarding |

---

## 4. Layout & Elevation

### Border Radius (3 tiers)

| Name | Tailwind | Usage |
|------|----------|-------|
| Pill | rounded-full | CTA lg buttons, badges, search bar |
| Container | rounded-2xl | Cards, modals, panels |
| Element | rounded-lg | Inputs, sm buttons |

### Shadow

| Token | Usage |
|-------|-------|
| shadow-sm | Card |
| shadow-md | Dropdown, popover |
| shadow-lg | Modal, sheet |
| primary-tinted | Hero card, emphasis panel |

### Glassmorphism (2 locations ONLY)

- TopBar: `bg-white/80 backdrop-blur-md` (light) + `dark:bg-card/80` (dark)
- Dialog/Sheet overlay: `bg-white/70 backdrop-blur-[20px]`
- Everywhere else: **FORBIDDEN**

### No-Line Rule

No 1px solid borders for section separation. Use Tonal Layering (background color difference).
Ghost border: outline-variant at 15% opacity ONLY when absolutely needed.

---

## 5. Components

### 5.1 Button

| Size | Radius | Style |
|------|--------|-------|
| lg | rounded-full | gradient (from-primary to-primary-dim) + shadow-lg |
| default | rounded-xl | bg-primary |
| sm | rounded-lg | bg-primary (density protection) |

Hover: `hover:scale-[1.02]` (lg CTA), `active:scale-95`.

### 5.2 Icons (Lucide only)

- sm: 16px (h-4 w-4), md: 20px (h-5 w-5), lg: 24px (h-6 w-6)
- stroke-width: 1.5px
- Inactive: Slate (#94a3b8), Active on gradient: white
- Icon-text gap: `mr-2`
- System emoji: **FORBIDDEN** in all UI

### 5.3 Badge & StatusBadge (SSOT 이원화)

본 프로젝트는 두 가지 Badge SSOT를 분리 운영한다:

**A. Generic `Badge` — Visual variants**
- 구현 SSOT: `src/components/ui/badge.tsx` (CVA)
- 10개 variant: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `error`, `info`, `neutral`, `accent`
- 용도: 수동으로 variant를 명시할 때 (`<Badge variant="warning">대기</Badge>`)
- 모두 pill shape (`rounded-full`), `whitespace-nowrap`, `text-[10px] font-semibold`
- Focus ring 내장 (`focus:ring-2 focus:ring-ring focus:ring-offset-2`)

**B. `StatusBadge` — Semantic status mapping**
- 구현 SSOT: `src/lib/styles/status.ts` + `src/components/ui/StatusBadge.tsx`
- 6개 semantic category: `success`, `warning`, `error`, `info`, `neutral`, `accent`
- `STATUS_MAP` (130+ entries)으로 status 문자열 → category 자동 매핑
  - 예: `APPROVED` → success, `PENDING` → warning, `REJECTED` → error, `OFFER` → accent
- 색상 SSOT: `STATUS_BADGE_FG` (WCAG AA 4.5:1 보장)
- 용도: 도메인 status 값으로 badge 렌더 (`<StatusBadge status="APPROVED" />`)

**카테고리 사용 규칙** (6 semantic categories):

| Category | 의미 | 대표 status |
|----------|------|-------------|
| success | 승인/완료/정상/활성 | APPROVED, COMPLETED, ACTIVE, PAID, HIRED |
| warning | 대기/수습/검토 | PENDING, PROBATION, REVIEW |
| error | 반려/오류/만료/결근 | REJECTED, TERMINATED, ABSENT, FAILED |
| info | 진행중/안내/예정 | IN_PROGRESS, SCHEDULED, INTERVIEW_1 |
| neutral | 초안/취소/비활성 | DRAFT, CANCELLED, INACTIVE |
| accent | 오퍼/휴직/출장 | OFFER, ON_LEAVE |

- **새 status enum 추가 시**: `status.ts`의 `STATUS_MAP`에 category 매핑만 추가. UI 코드 수정 불필요.
- **직접 `bg-[#xxx]/10 text-[#xxx]` 하드코딩 금지** — `StatusBadge` 또는 `Badge variant`만 사용.

### 5.4 Form Standard

- **Label**: 항상 top, 11px semibold
- **Required**: red `*` 표시
- **Error**: inline below input + red border + `XCircle` icon
- **Input**: border 1px (Tailwind default), rounded-lg, focus Violet ring
- **Layout**: 2-column default, 짧은 폼은 1-column
- **Buttons (right-aligned)**: cancel (ghost) → draft (outline) → submit (primary pill)
- **Implementation**: shadcn/ui `FormField` wrapper 필수

### 5.5 Segmented Control (Tabs)

Tonal background container. No underline, no border-b (No-Line Rule). macOS-style segmented control.

| Variant | List | Trigger | Usage |
|---------|------|---------|-------|
| default | `bg-muted/50 p-1 rounded-lg` | `rounded-md px-3 py-1.5 text-sm` | Standard tabs (2-5 items) |
| compact | `bg-muted/50 p-0.5 rounded-md` | `rounded px-2.5 py-1 text-xs` | Nested/sub-tabs only |

- Active: `bg-card shadow-sm text-primary font-semibold`
- Inactive: `text-muted-foreground`, no background
- Animation: `motion-safe:transition-all duration-150`
- Mobile: `overflow-x-auto`, touch target `min-h-[44px]`
- A11y: `aria-label` on `TabsList`, Radix handles `role`, `aria-selected`, keyboard nav
- Focus: `FOCUS.ring` token
- 4개 이하: `flex w-full` equal distribution
- 5개 이상: natural width + horizontal scroll
- border-b 언더라인 탭: **FORBIDDEN** (No-Line Rule)

### 5.6 PageHeader

공유 컴포넌트 (`src/components/shared/PageHeader.tsx`). 모든 페이지에서 사용.

- **No border**: `border-b` 없음 (No-Line Rule). 페이지 `space-y-6`이 간격 담당
- **Responsive**: `text-xl sm:text-2xl`, actions `flex-wrap gap-2`
- **Actions**: 모바일에서도 우측 정렬 유지 (`shrink-0`)

### 5.7 Page Layout (5 types)

| Type | Container | Header | Body |
|------|-----------|--------|------|
| List | p-6 space-y-6 | icon + title + CTA | filter pills → table |
| Detail | p-6 space-y-6 | back + profile | 2-col: profile(240px) + tabs |
| Dashboard | p-8 space-y-6 | greeting + context | V3 Action Zone + Monitor Zone |
| Settings | p-6 bg-muted | icon + title | 2-col: categories(200px) + tabs |
| Form | p-6 max-w-4xl | back + step | section cards, StickyActionBar |

공통: `PageHeader` 컴포넌트, `space-y-6`, back button은 Detail/Form만.

### 5.8 Table (3 types)

| Usage | Style |
|-------|-------|
| Employee/leave/approvals (default) | **Tonal Layering** — no border, bg color diff, unified toolbar |
| Payroll/attendance/audit (dense) | **Zebra Stripe** — alternating row bg, compact density |
| Directory/recruitment/talent pool | **Card Row** — independent cards, hover lift (미구현, 필요 시 추가) |

- Name cell: default = single line + hover tooltip, directory = 2-line compact
- 컬럼 숨김: `DataTableColumn.hideBelow: 'sm' | 'md'` — 비필수 컬럼 자동 숨김

---

## 6. Motion

- **Hover 기본**: `motion-safe:transition-all` — hover/focus 있는 모든 interactive 요소에 필수
- Easing: enter `ease-out`, exit `ease-in`. Duration: micro 50-100ms, short 150ms, medium 250ms
- Button: `hover:scale-[1.02]` (lg CTA), `active:scale-95`. Card: `hover:-translate-y-1`
- Decorative animation: **FORBIDDEN**

---

## 7. Mobile (Strategy B: Responsive + Tier 1)

Breakpoint: `< md (768px)` = 모바일, `≥ md` = 데스크톱. MobileBottomNav가 `md:hidden`으로 이 기준 사용.

### Tier

| Tier | Pages | 처리 |
|------|-------|------|
| 1 (모바일 최적화) | 출퇴근, 휴가 신청, 결재, 알림, 대시보드 | Dialog→Sheet, 1-col grid, column hiding |
| 2 (반응형만) | 팀 현황, 프로필, 일정, 교육 | breakpoint 대응 |
| 3 (데스크톱 전용) | 직원 등록, 급여, 성과, 분석, 설정, 조직도, 벌크, DnD | 모바일 미지원 |

### Patterns

- **Grid**: `grid-cols-1 sm:grid-cols-2` (KPI 카드), `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (위젯)
- **Dialog→Sheet**: `useIsMobile()` hook (md breakpoint). `< md`: `<Sheet side="bottom">`, `≥ md`: `<Dialog>`. 폼 state를 부모에서 관리 (전환 시 보존)
- **Column hiding**: `DataTableColumn.hideBelow: 'sm' | 'md'` — 비필수 컬럼 자동 숨김
- **Touch target**: 최소 44px (`min-h-[44px]`)
