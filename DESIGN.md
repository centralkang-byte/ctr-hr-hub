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
| destructive | #e11d48 | Error, rejection, delete |
| warning | #B45309 | Pending, probation |
| secondary | #64748b | Muted accent, metadata |
| accent (badge) | #7c3aed | Offer, LOA, business trip |

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

- TopBar: `bg-white/80 backdrop-blur-md`
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

| Category | Color | Usage |
|----------|-------|-------|
| success | #16a34a | Approved, complete, active, PAID |
| warning | #b45309 | Pending, probation, REVIEW |
| error | #e11d48 | Rejected, terminated, absent |
| info | #6366f1 | In progress, on leave, interview |
| neutral | #64748b | Draft, cancelled |
| accent | #7c3aed | Offer, LOA, business trip |

All badges: pill shape, `whitespace-nowrap`.

### Icons (Lucide only)

- sm: 16px (h-4 w-4), md: 20px (h-5 w-5), lg: 24px (h-6 w-6)
- stroke-width: 1.5px
- System emoji: **FORBIDDEN** in all UI

---

## 6. Motion

- Easing: enter `ease-out`, exit `ease-in`. Duration: micro 50-100ms, short 150ms, medium 250ms
- Button: `hover:scale-[1.02]` (lg CTA), `active:scale-95`. Card: `hover:-translate-y-1`
- Decorative animation: **FORBIDDEN**
