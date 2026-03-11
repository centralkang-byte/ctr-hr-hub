# Design Tokens Reference — CTR HR Hub

> Generated from Q-1 session (2026-03-12)

---

## Colors

### Brand
| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| Primary | `#5E81F4` | `primary` | Buttons, links, active states |
| Primary Hover | `#5E81F4/90` | `primary/90` | Button hover |
| Primary Light | `#5E81F4/20` | `primary/20` | Focus ring, subtle bg |
| Primary BG | `#5E81F4/10` | `primary/10` | Active sidebar item |

### Neutral
| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| Page BG | `#F5F5FA` | `bg-[#F5F5FA]` | Page background |
| Card BG | `#FFFFFF` | `bg-white` | Cards, modals |
| Border | `#F0F0F3` | `border-gray-100` | Borders, dividers |
| Table Header BG | `#F9FAFB` | `bg-gray-50` | Table headers |

### Text
| Token | Class | Use |
|-------|-------|-----|
| Primary Text | `text-gray-900` | Headings, important text |
| Secondary Text | `text-gray-700` | Body text |
| Muted Text | `text-gray-500` | Labels, captions |
| Subtle Text | `text-gray-400` | Timestamps, hints |

### Status
| Status | BG | Text | Use |
|--------|-----|------|-----|
| Success | `bg-emerald-50` | `text-emerald-700` | Approved, Active, Complete |
| Warning | `bg-amber-50` | `text-amber-700` | Pending, Review, Attention |
| Danger | `bg-rose-50` | `text-rose-700` | Rejected, Error, Overdue |
| Info | `bg-blue-50` | `text-blue-700` | Info, Processing |
| Neutral | `bg-gray-100` | `text-gray-700` | Draft, Default |

### Chart Palette
```
#5E81F4, #8B5CF6, #F59E0B, #10B981, #EF4444, #6B7280
```

---

## Typography

| Token | Class |
|-------|-------|
| Page Title | `text-2xl font-bold text-gray-900 tracking-tight` |
| Section Title | `text-lg font-semibold text-gray-900` |
| Subtitle | `text-base font-medium text-gray-800` |
| Body | `text-sm text-gray-700 leading-relaxed` |
| Label | `text-xs font-medium text-gray-500 uppercase tracking-wider` |
| Caption | `text-xs text-gray-400` |
| Stat (Hero) | `text-3xl font-bold text-gray-900 tabular-nums` |
| Stat (Sub) | `text-lg font-semibold text-gray-900 tabular-nums` |

---

## Spacing

| Token | Value |
|-------|-------|
| Page Padding | `px-6 py-6` |
| Section Gap | `space-y-6` |
| Card Padding | `p-6` |
| Card Inner Gap | `space-y-4` |
| Form Field Gap | `space-y-4` |
| Table Cell Padding | `px-4 py-3` |
| Inline Element Gap | `gap-2` |
| Button Group Gap | `gap-3` |

---

## Buttons

### Sizes
| Size | Class |
|------|-------|
| sm | `h-8 px-3 text-xs rounded-md` |
| md | `h-9 px-4 text-sm rounded-lg` |
| lg | `h-11 px-6 text-base rounded-lg` |

### Variants
| Variant | Style |
|---------|-------|
| primary | Blue bg, white text, scale on active |
| secondary | White bg, gray border, scale on active |
| danger | White bg, red border+text, scale on active |
| ghost | No bg, gray text, bg on hover |

---

## Z-Index Layers

| Layer | Value | Use |
|-------|-------|-----|
| base | 0 | Default |
| dropdown | 100 | Dropdowns, popovers |
| stickyHeader | 200 | Sticky table headers |
| backdrop | 300 | Modal overlay |
| modal | 400 | Modal content |
| toast | 500 | Toast notifications |
| tooltip | 600 | Tooltips |

---

## Border Radius

| Element | Class |
|---------|-------|
| Cards | `rounded-xl` |
| Buttons, Inputs | `rounded-lg` |
| Badges, Pills | `rounded-full` |
| Small Chips | `rounded-md` |

---

## Shadows

| Level | Class | Use |
|-------|-------|-----|
| Rest | `shadow-sm` | Cards default |
| Hover | `shadow-md` | Card hover |
| Elevated | `shadow-lg` | Modals |
| Floating | `shadow-xl` | Floating panels |

---

## Import Paths

```typescript
// Format utilities
import { formatNumber, formatCurrency, formatCompact, formatPercent } from '@/lib/format'
import { formatDate, formatDateTime, formatDateLong } from '@/lib/format'
import { truncateText, getInitials, getAvatarColor } from '@/lib/format'

// Style constants
import { TABLE_STYLES, CARD_STYLES, FORM_STYLES, MODAL_STYLES } from '@/lib/styles'
import { TYPOGRAPHY, SPACING, BUTTON_SIZES, BUTTON_VARIANTS } from '@/lib/styles'
import { CHART_THEME, Z_INDEX, FOCUS, DRAWER_SIZES } from '@/lib/styles'

// Animations
import { fadeIn, slideUp, scaleIn, staggerContainer, staggerItem } from '@/lib/animations/variants'
import { TRANSITIONS } from '@/lib/animations/transitions'

// UI Components
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ErrorPage } from '@/components/ui/ErrorPage'
import { Skeleton, TableSkeleton, KpiSkeleton, ChartSkeleton } from '@/components/ui/LoadingSkeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { AnimatedList, AnimatedListItem } from '@/components/ui/AnimatedList'
import { PageTransition } from '@/components/ui/PageTransition'

// Hooks
import { useSubmitGuard } from '@/hooks/useSubmitGuard'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
```
