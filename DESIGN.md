# CTR HR Hub — Design System

> Enterprise HR SaaS. Data-heavy, CJK-first, 5 locales.
> Clean white space + Violet/Green accents. No decoration unless intentional.
> Anti-patterns: 1px borders, uniform radius, purple AI-slop gradients, system emoji.

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

### Chart: #6366f1, #a5b4fc, #16a34a, #f59e0b, #e11d48, #64748b (ext: #7c3aed, #0ea5e9, #84cc16, #f97316)

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

| Scale | Size | Weight | Usage |
|-------|------|--------|-------|
| display-lg | 56px | 900 | Dashboard hero metric (font-display) |
| display-sm | 32px | 800 | Card KPI (font-display) |
| 4xl | 30px | 700 | Page title |
| 3xl | 24px | 700 | Section title |
| base | 14px | 400 | Body |
| sm | 13px | 400 | Secondary text |
| xs | 12px | 500 | Caption, pagination |
| 2xs | 11px | 600 | Table header, label |

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

### Button

| Size | Radius | Style |
|------|--------|-------|
| lg | rounded-full | gradient (from-primary to-primary-dim) + shadow-lg |
| default | rounded-xl | bg-primary |
| sm | rounded-lg | bg-primary (density protection) |

### Status Badge (6 categories)

| Category | bg class | text class | Usage |
|----------|----------|------------|-------|
| success | `bg-tertiary/10` | `text-[#15803d]` (D17) | Approved, complete, active, PAID |
| warning | `bg-[#b45309]/10` | `text-ctr-warning` | Pending, probation, REVIEW |
| error | `bg-destructive/10` | `text-destructive` | Rejected, terminated, absent |
| info | `bg-primary/10` | `text-primary-dim` | In progress, on leave, interview |
| neutral | `bg-muted` | `text-muted-foreground` | Draft, cancelled |
| accent | `bg-badge-accent/10` | `text-badge-accent` | Offer, LOA, business trip |

All badges: pill shape, `whitespace-nowrap`. Use `StatusBadge` component for automatic status→category mapping.

### PageHeader

공유 컴포넌트 (`src/components/shared/PageHeader.tsx`). 모든 페이지에서 사용.

- **No border**: border-b 없음 (No-Line Rule). 페이지 `space-y-6`이 간격 담당.
- **Responsive**: `text-xl sm:text-2xl`, actions `flex-wrap gap-2`
- **Actions**: 모바일에서도 우측 정렬 유지 (`shrink-0`)

### Segmented Control (Tabs)

Tonal background container. No underline, no border-b. macOS-style segmented control.

| Variant | List | Trigger | Usage |
|---------|------|---------|-------|
| default | `bg-muted/50 p-1 rounded-lg` | `rounded-md px-3 py-1.5 text-sm` | Standard tabs (2-5 items) |
| compact | `bg-muted/50 p-0.5 rounded-md` | `rounded px-2.5 py-1 text-xs` | Nested/sub-tabs only |

- Active: `bg-card shadow-sm text-primary font-semibold`
- Inactive: `text-muted-foreground`, no background
- Animation: `motion-safe:transition-all duration-150`
- Mobile: `overflow-x-auto`, touch target `min-h-[44px]`
- A11y: `aria-label` on TabsList, Radix handles `role`, `aria-selected`, keyboard nav
- Focus: `FOCUS.ring` token
- 4 tabs or fewer: `flex w-full` equal distribution
- 5+ tabs: natural width + horizontal scroll
- border-b tab indicator: **FORBIDDEN** (No-Line Rule)

### Icons (Lucide only)

- sm: 16px (h-4 w-4), md: 20px (h-5 w-5), lg: 24px (h-6 w-6)
- stroke-width: 1.5px
- System emoji: **FORBIDDEN** in all UI

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
- **Dialog→Sheet**: `useIsMobile()` hook (md breakpoint). `< md`: `<Sheet side="bottom">`, `≥ md`: `<Dialog>`. 폼 state를 부모에서 관리 (전환 시 보존).
- **Column hiding**: `DataTableColumn.hideBelow: 'sm' | 'md'` — 비필수 컬럼 자동 숨김
- **Touch target**: 최소 44px (`min-h-[44px]`)
