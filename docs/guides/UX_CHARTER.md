# UX Charter — CTR HR Hub (30 Articles)

> **Version:** 1.0 | **Created:** 2026-03-12 | **Authority:** ALL Q-sessions follow this charter

---

## Art.1 — Primary Color
- Primary: `#5E81F4` (Tailwind `primary`)
- NO raw `blue-*` Tailwind classes. Use `primary`, `primary/80`, `primary/20` etc.

## Art.2 — Background & Border
- Page BG: `#F5F5FA` → `bg-[#F5F5FA]`
- Card BG: `#FFFFFF` → `bg-white`
- Border: `#F0F0F3` → `border-gray-100`
- Divider: `border-gray-100`

## Art.3 — Animation Speeds (TRANSITIONS)
| Token | Duration | Use |
|-------|----------|-----|
| fast | 150ms | button hover, tooltip |
| normal | 250ms | tab switch, dropdown |
| slow | 400ms | page transition, modal open |
| spring | stiffness:300 damping:30 | draggable elements |

## Art.4 — Shadow Scale
| Level | Class | Use |
|-------|-------|-----|
| sm | `shadow-sm` | cards at rest |
| md | `shadow-md` | card hover |
| lg | `shadow-lg` | modals |
| xl | `shadow-xl` | floating elements |

## Art.5 — Animation Constraints ⛔
- **ONLY** animate: `transform` (scale, x, y, rotate) and `opacity`
- **NEVER** animate: width, height, margin, padding, top, left, right, bottom
- All framer-motion animations must use `variants.ts` or `transitions.ts`
- Test mode: `NEXT_PUBLIC_TEST_MODE=true` → `duration: 0`

## Art.6 — Icon Library
- **ONLY** `lucide-react`
- Size: 16px (`w-4 h-4`) inline, 20px (`w-5 h-5`) standalone, 24px (`w-6 h-6`) hero
- NO Material Icons, NO Font Awesome, NO custom SVGs

## Art.7 — Border Radius
| Element | Class |
|---------|-------|
| Cards | `rounded-xl` |
| Buttons, Inputs | `rounded-lg` |
| Badges, Pills | `rounded-full` |
| Small chips | `rounded-md` |

## Art.8 — Table Convention
- Header: `bg-gray-50`, `text-xs font-medium text-gray-500 uppercase tracking-wider`
- Rows: `hover:bg-gray-50/50`, `border-b border-gray-100`
- Numbers: `text-right tabular-nums`
- All tables inside `overflow-x-auto` wrapper
- Use `TABLE_STYLES` from `@/lib/styles`

## Art.9 — EmptyState Pattern
```tsx
<EmptyState icon={Inbox} title="데이터가 없습니다" description="..." action={{ label: "추가", onClick: fn }} />
```
- Always provide: icon + title
- Optional: description, action

## Art.10 — Toast Pattern
- Success: green | Error: red | Info: blue
- Duration: 3s (success), 5s (error)
- Position: bottom-right

## Art.11 — Date Format
| Context | Format | Example |
|---------|--------|---------|
| Table | `2026.03.12` | `formatDate()` |
| Table+time | `2026.03.12 14:30` | `formatDateTime()` |
| Detail | `2026년 3월 12일` | `formatDateLong()` |
| Compact | `3월 12일` | `formatDateShort()` |

## Art.12 — Number Display + Badge Colors
- KPI numbers: `text-gray-900 tabular-nums`
- Currency: `formatCurrency(value, 'KRW')` → `₩3,200,000`
- Compact: `formatCompact(value)` → `₩320만`
- Badge variants: semantic only (`success`, `warning`, `danger`, `info`, `neutral`, `muted`)

## Art.13 — Avatar
- Use `getInitials(name)` for text
- Use `getAvatarColor(name)` for consistent color
- Size: `w-8 h-8` (table), `w-10 h-10` (card), `w-16 h-16` (profile)

## Art.14 — Text Truncation
- Use `truncateText(text, maxLength)` for programmatic truncation
- Use `truncate` CSS class for single-line
- Use `line-clamp-2` for multi-line

## Art.15 — Status Indicator
- Active/Online: `bg-emerald-400` dot
- Away/Offline: `bg-gray-300` dot
- Busy/DND: `bg-rose-400` dot
- Size: `w-2 h-2 rounded-full`

## Art.16 — Sidebar
- Width: 256px expanded, 64px collapsed
- Active item: `bg-primary/10 text-primary font-medium`
- Hover: `hover:bg-gray-100`
- Icon size: `w-5 h-5`

## Art.17 — Notification Badge
- Red dot: `w-2 h-2 bg-rose-500 rounded-full`
- Count: `min-w-5 h-5 bg-rose-500 text-white text-xs rounded-full`
- Position: `absolute -top-1 -right-1`

## Art.18 — ErrorPage Pattern
```tsx
<ErrorPage type="404" /> // or "500" or "403"
<ErrorPage type="500" title="커스텀 제목" description="커스텀 설명" />
```
- Always provide back + home buttons
- Korean messages

## Art.19 — Dirty State (useUnsavedChanges)
```tsx
const { confirmLeave } = useUnsavedChanges(isDirty);
// Before router.push: if (!confirmLeave()) return;
```
- Browser beforeunload event for tab close
- `window.confirm()` for programmatic navigation

## Art.20 — Modal Behavior
- Escape key → close
- Backdrop click → close (unless `preventClose`)
- Body scroll lock when open
- Focus trap inside modal
- Z-index: backdrop(300), modal(400)

## Art.21 — Responsive Breakpoints
| Breakpoint | Min | Use |
|-----------|-----|-----|
| sm | 640px | Phone landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Wide desktop |
| 2xl | 1536px | Ultra-wide |

## Art.22 — Typography Scale
| Token | Class | Use |
|-------|-------|-----|
| pageTitle | `text-2xl font-bold text-gray-900 tracking-tight` | Page headings |
| sectionTitle | `text-lg font-semibold text-gray-900` | Card/section headings |
| subtitle | `text-base font-medium text-gray-800` | Sub-headings |
| body | `text-sm text-gray-700 leading-relaxed` | Body text |
| label | `text-xs font-medium text-gray-500 uppercase tracking-wider` | Form labels, table headers |
| caption | `text-xs text-gray-400` | Timestamps, hints |
| stat | `text-3xl font-bold text-gray-900 tabular-nums` | KPI hero numbers |
| statSub | `text-lg font-semibold text-gray-900 tabular-nums` | Secondary stats |

## Art.23 — Spacing Scale
| Token | Value | Use |
|-------|-------|-----|
| pageX/Y | `px-6 py-6` | Page content padding |
| sectionGap | `space-y-6` | Between sections |
| cardPadding | `p-6` | Inside cards |
| cardGap | `space-y-4` | Inside card between elements |
| formGap | `space-y-4` | Between form fields |
| cellX/Y | `px-4 py-3` | Table cells |
| inlineGap | `gap-2` | Inline elements |
| buttonGap | `gap-3` | Between buttons |

## Art.24 — Button Sizes
| Size | Class | Use |
|------|-------|-----|
| sm | `h-8 px-3 text-xs rounded-md` | Table inline actions |
| md | `h-9 px-4 text-sm rounded-lg` | Default buttons |
| lg | `h-11 px-6 text-base rounded-lg` | Primary CTA |

**Variants:** primary, secondary, danger, ghost

## Art.25 — Focus Ring
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2
```
- Apply via `FOCUS.ring` from `@/lib/styles`
- All interactive elements MUST have focus-visible styles

## Art.26 — Drawer Sizes
| Size | Width | Use |
|------|-------|-----|
| sm | 400px | Quick edit/view |
| md | 560px | Detail form |
| lg | 720px | Complex form, preview |

## Art.27 — Loading Hierarchy
1. **Full page**: `PageSkeleton` (first load)
2. **Section**: `TableSkeleton`, `KpiSkeleton`, `ChartSkeleton` (tab switch)
3. **Inline**: `Skeleton` (lazy field)
4. **Button**: spinner + disabled state

## Art.28 — useSubmitGuard (Double-click Prevention)
```tsx
const { guardedSubmit, isSubmitting } = useSubmitGuard(handleSave);
<button onClick={guardedSubmit} disabled={isSubmitting}>
  {isSubmitting ? '저장 중...' : '저장'}
</button>
```

## Art.29 — File Import Conventions
- Format: `import { formatCurrency } from '@/lib/format'`
- Styles: `import { TABLE_STYLES } from '@/lib/styles'`
- Animations: `import { fadeIn } from '@/lib/animations/variants'`
- Components: `import { EmptyState } from '@/components/ui/EmptyState'`
- Hooks: `import { useSubmitGuard } from '@/hooks/useSubmitGuard'`

## Art.30 — Zero CLS (Cumulative Layout Shift)
- Skeleton dimensions MUST match actual content dimensions
- Images: always set `width` + `height` or use `aspect-ratio`
- Tables: fixed column widths where data length is predictable
- KPI cards: fixed height skeleton = fixed height content
