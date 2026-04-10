# Design Token Rules

Full design system: see `DESIGN.md`. Below are mandatory checks when writing UI code.

## Color

- Pure black #000/#000000 forbidden → use on-surface (#2d2f2f)
- Primary: #6366f1, Primary-dim: #4f46e5, Primary-container: #a5b4fc
- Tertiary (Green): #16a34a, Tertiary-container: #86efac
- Error: #e11d48, Warning: #B45309, Info: = primary
- Accent (badge-only): #7c3aed

## Typography

- font-display (Outfit): English-only, text-4xl+ only. NEVER use for mixed Korean/English text
- font-mono: MUST accompany tabular-nums (never standalone)
- CJK: letter-spacing -0.02em, line-height 1.6+, base 14px

## Border & Elevation

- **No-Line Rule:** No 1px solid borders for section separation → use Tonal Layering
- Ghost Border: outline-variant (#acadad) at 15% opacity ONLY
- Shadow tokens: shadow-sm (card), shadow-md (dropdown), shadow-lg (modal)

## Border Radius (3 tiers only)

- Pill (rounded-full): CTA lg buttons, status badges, search bar
- Container (rounded-2xl): cards, modals, panels
- Element (rounded-lg): inputs, sm buttons

## Glassmorphism (2 locations only)

- TopBar: bg-white/80 backdrop-blur-md ✅
- Dialog/Sheet overlay: bg-white/70 backdrop-blur-[20px] ✅
- Everywhere else: ❌ FORBIDDEN

## Button

- lg: rounded-full + gradient (from-primary to-primary-dim) + shadow-lg
- default: rounded-xl + bg-primary
- sm: rounded-lg + bg-primary (density protection)

## Spacing Density

- compact (p-4): payroll/attendance/audit tables
- comfortable (p-6, DEFAULT): employee list, leave, recruitment
- spacious (p-8): dashboard KPI, profile, onboarding

## Status Badge (6 categories)

| Category | Color | Usage |
|----------|-------|-------|
| success | #16a34a | Approved, complete, active, PAID, HIRED |
| warning | #b45309 | Pending, probation, REVIEW |
| error | #e11d48 | Rejected, terminated, absent, FAILED |
| info | #6366f1 | In progress, on leave, interview, ACTIVE |
| neutral | #64748b | Draft, cancelled, DRAFT |
| accent | #7c3aed | Offer, LOA, business trip |

- All badges: pill shape, `whitespace-nowrap`
- Use StatusBadge component for automatic status→category mapping

## Icons

- Lucide React only (lucide-react)
- System emoji: **FORBIDDEN** in all UI
- Inactive: Slate (#94a3b8), Active: white on gradient
- stroke-width: 1.5px, icon-text gap: mr-2
- Sizes: sm=16px (h-4 w-4), md=20px (h-5 w-5), lg=24px (h-6 w-6)

## Page Layout (5 types)

| Type | Container | Header | Body |
|------|-----------|--------|------|
| List | p-6 space-y-6 | icon + title + CTA | filter pills → table |
| Detail | p-6 space-y-6 | back + profile | 2-col: profile(240px) + tabs |
| Dashboard | p-8 space-y-6 | greeting + context | V3 Action Zone + Monitor Zone |
| Settings | p-6 bg-muted | icon + title | 2-col: categories(200px) + tabs |
| Form | p-6 max-w-4xl | back + step | section cards, StickyActionBar |

- Common: PageHeader component, space-y-6, back button on Detail/Form only

## Table (3 types)

| Usage | Style |
|-------|-------|
| Employee/leave/approvals (default) | **Tonal Layering** — no border, bg color diff, unified toolbar |
| Payroll/attendance/audit (dense) | **Zebra Stripe** — alternating row bg, compact density |
| Directory/recruitment/talent pool | **Card Row** — independent cards, hover lift |

- Name cell: default = single line + hover tooltip, directory = 2-line compact

## Form Standard

- Label: always top, 11px semibold
- Required: red *
- Error: inline below input + red border + XCircle icon
- Input: border 1.5px, rounded-lg, focus Violet ring
- Layout: 2-column default, short forms 1-column
- Buttons (right-aligned): cancel(ghost) → draft(outline) → submit(primary pill)
- Implementation: shadcn/ui FormField wrapper required

## Segmented Control (Tabs)

- Tab = Segmented Control: `bg-muted/50 rounded-lg p-1` container, NO border-b
- Active: `bg-card shadow-sm text-primary font-semibold rounded-md`
- Compact variant (nested tabs only): `p-0.5 rounded-md`, trigger `px-2.5 py-1 text-xs`
- Animation: `motion-safe:transition-all` (respects prefers-reduced-motion)
- Mobile: `overflow-x-auto`, touch target `min-h-[44px]`
- `aria-label` on every TabsList
- border-b underline tabs: **FORBIDDEN** (No-Line Rule)

## Forbidden Patterns

- backdrop-blur outside TopBar/Dialog
- 1px solid borders for section separation
- Uniform border-radius (must use 3-tier system)
- Purple AI-slop gradients
- System emoji in UI (use Lucide icons)
- font-display on mixed KR/EN text
- font-mono without tabular-nums
- Hardcoded hex colors (use CSS variables or CTR tokens)
