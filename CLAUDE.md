# CTR HR Hub — CLAUDE.md
> Single source of truth for **design tokens + project specs** referenced by Claude Code.
> Use alongside CTR_UI_PATTERNS.md.

---

## 1. Project Overview

| Item | Value |
|------|-------|
| Project | CTR HR Hub |
| Target | Global automotive parts manufacturer (6 countries, 1,000–3,000 employees) |
| Entities | CTR-HQ, CTR-KR, CTR-CN, CTR-RU, CTR-US, CTR-VN, CTR-MX |
| Stack | Next.js 14+ (App Router) + Supabase + PostgreSQL + Prisma ORM |
| Styling | Tailwind CSS + Pretendard font |
| UI Reference | FLEX HR, Workday |

### Core Values (Value System 2.0)
| Value | English | Behavioral Indicators |
|-------|---------|----------------------|
| 도전 | Challenge | 4 |
| 신뢰 | Trust | 3 |
| 책임 | Responsibility | 3 |
| 존중 | Respect | 3 |

> BEI behavioral indicators must NOT be hardcoded — design as configurable settings.

---

## 2. Core Data Model

### EmployeeAssignment (Effective Dating Pattern)

8 fields moved from `Employee` to `EmployeeAssignment`:
```
companyId, departmentId, jobGradeId, jobCategoryId
positionId, employmentType, contractType, status
```

```prisma
model EmployeeAssignment {
  id             String    @id
  employeeId     String
  companyId      String
  departmentId   String?
  jobGradeId     String?
  jobCategoryId  String?
  positionId     String?
  employmentType String?
  contractType   String?
  status         String    @default("ACTIVE")
  isPrimary      Boolean   @default(true)
  startDate      DateTime
  endDate        DateTime?
}
```

### Query Patterns
```typescript
// WHERE — current active assignment
where: { assignments: { some: { companyId: 'xxx', status: 'ACTIVE', isPrimary: true, endDate: null } } }

// INCLUDE — with relations
include: { assignments: { where: { isPrimary: true, endDate: null }, take: 1, include: { department: true } } }

// Property access
employee.assignments?.[0]?.companyId
// When Prisma type inference fails
(employee.assignments?.[0] as any)?.companyId as string | undefined
```

### Helpers (src/lib/assignments.ts)
- `getCurrentAssignment(employeeId)` — current primary assignment
- `createAssignment(data)` — end previous + create new (transaction)
- `getDirectReports(employeeId)` — Position hierarchy based
- `getManagerByPosition(employeeId)` — Position hierarchy based

---

## 3. Sidebar IA

### 7-Section Structure (v2 Final)

| # | Section | Key | Icon | Access |
|---|---------|-----|------|--------|
| 1 | Home | `home` | Home | All |
| 2 | My Space | `my-space` | User | All |
| 3 | Team | `team` | Users | MANAGER, EXECUTIVE, HR_ADMIN, SUPER_ADMIN |
| 4 | HR Operations | `hr-ops` | Building2 | HR_ADMIN, SUPER_ADMIN |
| 5 | Talent | `talent` | UserCheck | HR_ADMIN, SUPER_ADMIN |
| 6 | Insights | `insights` | BarChart3 | HR_ADMIN, SUPER_ADMIN (full) / MANAGER, EXECUTIVE (partial) |
| 7 | Settings | `settings` | Settings | HR_ADMIN, SUPER_ADMIN |

### Role Visibility Matrix
| Role | Home | My Space | Team | HR Ops | Talent | Insights | Settings |
|------|------|----------|------|--------|--------|----------|----------|
| EMPLOYEE | ✅ | ✅ | — | — | — | — | — |
| MANAGER | ✅ | ✅ | ✅ | — | — | Partial | — |
| EXECUTIVE | ✅ | ✅ | ✅ | — | — | Partial | — |
| HR_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Navigation Architecture
```
src/config/navigation.ts          — 7-section menu structure
src/hooks/useNavigation.ts        — Role-based filtering hook
src/components/layout/Sidebar.tsx  — Config-driven rendering
```

```typescript
type NavSection = {
  key: string;
  labelKey: string;    // i18n key (nav.{sectionKey})
  label: string;
  icon: React.ComponentType;
  visibleTo: string[];
  items: NavItem[];
};

type NavItem = {
  key: string;
  labelKey: string;
  label: string;
  href: string;
  icon?: React.ComponentType;
  module: string;
  badge?: 'new' | 'beta';
  comingSoon?: boolean;
  children?: NavItem[];
  countryFilter?: string[];
};
```

---

## 4. Design Philosophy

- **White base** — Page `#FAFAFA`, Card `#FFFFFF`
- **Minimal decoration** — Suppress shadows/borders, express structure through whitespace
- **Green action color** — CTA, check, approve, in-progress = `#00C853`
- **Information density** — Table + Card + Tab combos, generous padding
- **Korean typography** — Pretendard, letter-spacing `-0.02em`

---

## 5. Design Tokens

### 5.1 Colors

#### Brand
```
primary:        #00C853    /* Green CTA */
primary-dark:   #00A844    /* hover */
primary-light:  #E8F5E9    /* light background */
primary-50:     #F1F8E9    /* highlight */
```

#### Semantic
```
success:        #059669    /* complete, approved, achieved */
success-light:  #D1FAE5

warning-bg:     #FEF3C7    /* warning background */
warning-icon:   #F59E0B    /* warning icon */
warning-text:   #B45309    /* warning text */

danger:         #EF4444    /* error, rejected, risk */
danger-light:   #FEE2E2

info:           #4338CA    /* AI recommendation, information */
info-light:     #E0E7FF
```

#### Neutrals
```
bg-page:        #FAFAFA
bg-card:        #FFFFFF
bg-hover:       #F5F5F5
border:         #E8E8E8
border-light:   #F5F5F5
text-primary:   #1A1A1A
text-body:      #555555
text-secondary: #666666
text-muted:     #999999
text-placeholder: #BDBDBD
```

#### Status Badges
```
In Progress: bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]
Pending:     bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]
Rejected:    bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]
Complete:    bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]
Draft:       bg-[#FAFAFA] text-[#555] border-[#E8E8E8]
AI:          bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]
Risk:        bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]
```

#### Chart Palette
```
#00C853, #059669, #F59E0B, #8B5CF6, #EC4899, #06B6D4
```

#### Grade Distribution (Performance Charts)
```
S: #9C27B0  A: #4CAF50  B: #FFD600  C: #FF9800  D: #03A9F4
```

### 5.2 Typography

| Usage | Tailwind Class | Weight |
|-------|---------------|--------|
| Page title | text-2xl | font-bold |
| Section title | text-lg | font-semibold |
| Card title | text-base | font-semibold |
| Body | text-sm (14px) | font-normal |
| Table body | text-[13px] | font-normal |
| Caption | text-xs (12px) | font-normal |
| Badge | text-[11px] | font-semibold |
| KPI number | text-3xl~4xl | font-bold |
| Sidebar section header | text-[11px] uppercase tracking-wider | font-semibold |

> Korean headings: `tracking-[-0.02em]`

### 5.3 Spacing

| Element | Value |
|---------|-------|
| Page padding | p-6 (24px) |
| Card padding | p-5~6 (20~24px) |
| Card gap | gap-4~6 |
| Section gap | space-y-6 / mb-8 |
| Form field gap | space-y-4 |
| Inline gap | gap-2~3 |
| Sidebar section gap | mt-6 |

### 5.4 Borders & Radius

```
Card:      rounded-xl border border-[#E8E8E8]  (no shadow)
Modal:     shadow-xl rounded-2xl               (modals only get shadow)
Dropdown:  shadow-lg rounded-lg border border-[#E8E8E8]
Button:    rounded-lg (8px)
Badge:     rounded-full or rounded (4px)
Input:     rounded-lg border border-[#D4D4D4] focus:ring-2 focus:ring-[#00C853]/10
Avatar:    rounded-full
```

### 5.5 Sidebar
```
Width:         w-64 (collapsed: w-16)
Background:    bg-[#111] (dark)
Section header: text-[11px] font-semibold uppercase tracking-wider text-[#888] px-4 mt-6 mb-2
Active item:   bg-[#00C853] text-white rounded-lg
Hover:         bg-[#222]
Icons:         20px, lucide-react
Section divider: border-t border-[#333] mx-3
comingSoon:    text-[#666] cursor-not-allowed + Lock icon
```

### 5.6 Animations
```
Default transition:  transition-colors duration-150
Modal entrance:      fadeIn 0.2s — opacity 0→1, translateY 8px→0
Progress bar:        transition-[width] duration-600
Hover:               background color change only (no transforms)
```

---

## 6. Component Specs

### Buttons
| Type | Tailwind Classes |
|------|-----------------|
| Primary | `bg-[#00C853] hover:bg-[#00A844] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors` |
| Secondary | `bg-white border border-[#D4D4D4] hover:bg-[#F5F5F5] text-[#333] px-4 py-2 rounded-lg font-medium text-sm transition-colors` |
| Danger | `bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors` |
| Ghost | `hover:bg-[#F5F5F5] text-[#555] px-3 py-2 rounded-lg text-sm transition-colors` |
| Approve | `bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-lg font-semibold text-sm` |
| Reject | `border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] px-4 py-2 rounded-lg text-sm` |

> Icon + text combo: `inline-flex items-center gap-1.5`

### KPI Card
```jsx
<div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
  <p className="text-xs text-[#666] mb-1">{label}</p>
  <p className="text-3xl font-bold text-[#1A1A1A] tracking-tight">{value}</p>
  <span className="text-xs text-[#059669]">↑ {change}%</span>
</div>
```

### Table
```
Header:  bg-transparent text-[13px] text-[#999] font-semibold px-4 py-3 border-b border-[#E8E8E8]
Row:     border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors
Cell:    px-4 py-3.5 text-sm text-[#333]
Selected: bg-[#E3F2FD]
```

### Badge
```jsx
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold
  bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]">
  {status}
</span>
```

> Period/cycle badge: `border border-[#E0E0E0] bg-white text-[#666] rounded text-xs px-2 py-0.5`

### Tabs
```jsx
{/* Underline tabs (default) */}
<div className="flex border-b border-[#E8E8E8] gap-6">
  <button className="pb-2.5 text-sm font-bold text-[#1A1A1A] border-b-2 border-[#1A1A1A]">Active</button>
  <button className="pb-2.5 text-sm font-medium text-[#999] hover:text-[#333]">Inactive</button>
</div>

{/* Pill tabs (filter) */}
<button className="px-3.5 py-1.5 rounded-full text-xs border border-[#E0E0E0] bg-white text-[#666]">Default</button>
<button className="px-3.5 py-1.5 rounded-full text-xs bg-[#1A1A1A] text-white border-[#1A1A1A]">Active</button>
```

### Input & Forms
```
Label:     text-sm font-medium text-[#333] mb-1
Input:     w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
           focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#BDBDBD]
Select:    appearance-none + same input style
Toggle:    w-10 h-5 rounded-full bg-[#E8E8E8] → bg-[#00C853] transition-colors
Checkbox:  w-4 h-4 rounded border-[#D4D4D4] text-[#00C853]
```

### Modal
```
Size: sm(max-w-md) md(max-w-lg) lg(max-w-2xl) xl(max-w-4xl) full(max-w-6xl)
Overlay: bg-black/50 backdrop-blur-sm
Structure: Header(title + X) → Body(overflow-y-auto) → Footer(action buttons)
```

### Progress Bar
```jsx
<div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
  <div
    className="h-full rounded-full transition-[width] duration-600"
    style={{ width: `${value}%`, background: 'linear-gradient(90deg, #00C853, #00BFA5)' }}
  />
</div>
```

### Approval Workflow
```
Steps:  Vertical timeline — avatar + name + role + status badge
States: Pending(gray) / In Progress(green) / Approved(green) / Rejected(red)
Actions: Approve(green fill) + Reject(red outline) pair
```

### Competency Score (Left Color Bar)
```jsx
<div className="border-l-4 border-[#00C853] pl-4 py-2 mb-4">  {/* 5 pts */}
  {/* border-[#8BC34A]=4, border-[#F59E0B]=3, border-[#FF5722]=2, border-[#EF4444]=1 */}
</div>
```

### Profile Card
```jsx
<div className="flex items-center gap-3">
  <img className="w-10 h-10 rounded-full object-cover bg-[#E8E8E8]" src={avatar} />
  <div>
    <p className="text-[15px] font-bold text-[#1A1A1A]">{name}</p>
    <p className="text-[13px] text-[#999]">{role}</p>
  </div>
</div>
```

---

## 7. Layout Rules

```
Header:    h-14 bg-white border-b border-[#E8E8E8]
Sidebar:   w-64 bg-[#111]
Main:      flex-1 bg-[#FAFAFA] p-6

Page Structure:
  Page title (text-2xl font-bold)
  Description (text-sm text-[#666])
  ↓
  Tab navigation
  ↓
  Filter bar
  ↓
  Content (card grid or table)

Detail View (Split):
  Left: 65% (list/detail/form)
  Right: 35% (approval, references, activity log)
```

---

## 8. DO / DON'T

### ✅ DO
- Card background `#FFF`, page background `#FAFAFA`
- Border `1px solid #E8E8E8`, shadows only on modals/dropdowns
- CTA buttons `#00C853` solid (no gradients)
- Table header `#999` small text, data `#333`
- Status badges = light background + dark text
- `rounded-lg` (buttons) / `rounded-xl` (cards) / `rounded-full` (badges/avatars)
- Tab gap-6 minimum

### ❌ DON'T
- Overuse `box-shadow`
- Gradient buttons
- Flashy animations (micro-transitions only)
- Overuse purple/pink (accent only)
- Body text 20px+
- Card hover `transform: scale`
- Table zebra stripe backgrounds

---

## 9. RBAC

### Roles (5)
```
SUPER_ADMIN — Full access
HR_ADMIN    — Including Settings
MANAGER     — Team management
EMPLOYEE    — Standard
EXECUTIVE   — C-level
```

### Modules (19)
```
employees, org, attendance, leave, recruitment, performance, payroll,
compensation, offboarding, discipline, benefits, analytics, onboarding,
training, pulse, succession, hr_chatbot, teams, compliance, settings
```

### Permission Logic
```
SUPER_ADMIN → all
HR_ADMIN    → including settings
Others      → match module + action('read') from permissions array
```

### DB Tables
```
roles            — id, code, name, is_system
role_permissions — role_id, permission_id
employee_roles   — employee_id, role_id, company_id, start_date, end_date
```

---

## 10. Icons (lucide-react)

| Usage | Icon | Usage | Icon |
|-------|------|-------|------|
| Dashboard | LayoutDashboard | Search | Search |
| Employees | Users | Filter | SlidersHorizontal |
| Attendance | Clock | Add | Plus |
| Leave | CalendarDays | Edit | Pencil |
| Recruitment | UserPlus | Delete | Trash2 |
| Performance | Target | Download | Download |
| 1on1 | MessageSquare | AI | Bot, Sparkles |
| Analytics | BarChart3 | Risk | AlertTriangle |
| Settings | Settings | Approve | CheckCircle2 |
| Notifications | Bell | Reject | XCircle |
| My Space | User | Team | Users |
| HR Ops | Building2 | Talent | UserCheck |
| comingSoon | Lock | — | — |

> Size: 16px (inline) / 20px (buttons) / 24px (navigation)
> Color: `currentColor` / stroke: 1.5~2px

---

## 11. Coding Conventions

### File Structure
```
src/app/(dashboard)/       — Sidebar + Header shared layout
src/config/navigation.ts   — 7-section menu structure
src/hooks/useNavigation.ts — Role-based navigation hook
src/components/layout/     — Sidebar, Header
src/components/ui/         — Reusable base components
src/components/[module]/   — Module-specific
src/lib/supabase/          — Supabase wrapper
src/lib/assignments.ts     — EmployeeAssignment helpers
src/lib/constants.ts       — ROLE, MODULE, ACTION constants
src/types/                 — Type definitions
```

### Naming
```
Components: PascalCase       Utils: camelCase
Constants:  UPPER_SNAKE_CASE DB columns: snake_case
Types:      PascalCase + Row/Insert suffix
i18n keys:  nav.{sectionKey}.{itemKey}
```

### Principles
- Single-file components preferred; split when too large
- Explicit `'use client'` declarations
- Seed data: always reflect 7-entity structure
- Korean UI primary, i18n keys in English
- Prisma ORM only (no raw SQL)
- No direct DB manipulation — always through Prisma

---

## 12. Technical Constraints
- Payroll: external system integration (not directly implemented)
- Korea-first → global expansion
- Data Localization required (per-entity data isolation)
- 52-hour compliance logic mandatory (CTR-KR)
- MS Teams integration planned (Adaptive Cards, Bot Framework)
- CTR job grades: L1(Manager)/L2(Senior Manager) + leadership titles (future expansion)
