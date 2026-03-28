# CTR HR Hub — CTR_UI_PATTERNS.md (UI/UX Pattern Guide)
> Use alongside CLAUDE.md (design tokens). Based on FLEX + Workday 52-screen analysis.

---

## Pattern Index

| # | Pattern | Applied To |
|---|---------|-----------|
| P01 | Master-Detail Layout | Employees, Recruitment, Performance, Contracts |
| P02 | KPI Card Grid | Dashboard, Analytics, Recruitment |
| P03 | Data Table + Filter Bar | All list screens |
| P04 | Profile Sidebar | Employee detail, 1:1 |
| P05 | Approval Workflow Panel | Leave, Overtime, Contracts |
| P06 | Step Wizard | Onboarding, Year-End Settlement, Contracts |
| P07 | Pipeline Funnel/Kanban | Recruitment ATS |
| P08 | OKR Tree Table | Performance (MBO/OKR) |
| P09 | Rich Text + Side Context | 1:1, CFR, Evaluations |
| P10 | Chart Dashboard | HR Analytics |
| P11 | Tree Org Chart | Org Chart |
| P12 | Mobile Notification Center | Notifications, Teams |
| **P13** | **Section-Based Sidebar** | **Global Navigation** |

### New Feature Patterns
| # | Pattern | Applied To |
|---|---------|-----------|
| NP01 | AI Analysis Report Card | Performance, Interview, 1:1 |
| NP02 | Calibration/9-Grid | Performance Calibration |
| NP03 | Self-Service Issuance Form | Certificate Issuance |
| NP04 | E-Signature Flow | Digital Contracts |

---

## P01. Master-Detail Layout

```
┌─────────────────────────────────────────┐
│ Page Header (title + action buttons)     │
├──────────────┬──────────────────────────┤
│ Master (L)   │ Detail (R)               │
│ w-80~96      │ flex-1                   │
│ List/Tree    │ Tab navigation           │
│ Search+Filter│ Content area             │
│ Selection HL │ Bottom action bar        │
└──────────────┴──────────────────────────┘
```

**Rules:**
- Left panel: `w-80` or `w-96`, `border-r border-[#E8E8E8]`, independent scroll
- Selected item: `bg-[#E8F5E9] border-l-2 border-[#00C853]`
- Mobile: List → tap for fullscreen detail

---

## P02. KPI Card Grid

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Label     │ │ Label     │ │ Label     │ │ Label     │
│ Big Number│ │ Big Number│ │ Big Number│ │ Big Number│
│ ↑3.2% MoM│ │ ↓1.1%    │ │ ─ 0%     │ │ ↑5.4%    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Rules:**
- `grid grid-cols-2 md:grid-cols-4 gap-4`
- Number: `text-3xl font-bold`
- Trend: ↑ `text-[#059669]`, ↓ `text-[#EF4444]`, ─ `text-[#999]`
- Period: `text-xs text-[#999]` ("vs. prior month")

---

## P03. Data Table + Filter Bar

```
┌─────────────────────────────────────────┐
│ [Search🔍] [Filter▼] [Filter▼] [+Add] [⋮]│
│ Active: [Product Team✕] [Active✕]        │
├─────────────────────────────────────────┤
│ ☐│Name↕│Dept│Grade│Status│Actions        │
│ ☐│Kim  │HR  │Mgr  │🟢Active│⋮           │
├─────────────────────────────────────────┤
│ ◀ 1 2 3 ▶                10/page▼       │
└─────────────────────────────────────────┘
```

**Rules:**
- Search: left-aligned `w-64`, debounce 300ms
- Filter chips: `bg-[#FAFAFA] rounded-full px-3 py-1 text-xs border border-[#E8E8E8]` + ✕
- Sort: click toggle `↕→↑→↓→↕`
- Checkbox: selection shows bulk action bar
- Empty state: illustration + "No results" + reset filters

---

## P04. Profile Sidebar

```
┌─────────────────┐
│   [Avatar 72px]  │
│   Kim Sangwoo    │
│   HR Team · Mgr  │
├─────────────────┤
│ 📧 Email         │
│ 📱 Phone         │
│ 📅 Hire Date     │
├─────────────────┤
│ Tenure: 4y 11m   │
│ Attrition: ■■□□ M│
├─────────────────┤
│ Strengths/Notes  │
└─────────────────┘
```

**Rules:**
- Width: `w-72` or `w-80`
- Section divider: `divide-y divide-[#F5F5F5]`
- Confidential notes: `bg-[#FEF3C7] border-l-2 border-[#F59E0B]` (manager only)
- Attrition bar: Low(`#059669`) / Medium(`#F59E0B`) / High(`#EF4444`)

---

## P05. Approval Workflow Panel

```
┌────────────────────────────────┐
│ Approval Request       [Close] │
├────────────────────────────────┤
│ 📋 Approvers │ 📜 Activity Log │
├────────────────────────────────┤
│ ● Step 1: Direct Mgr ✅ Done  │
│ ○ Step 2: HR Team  ⏳ Pending │
│ ○ Step 3: Director ⏳ Pending │
├────────────────────────────────┤
│        [Reject🔴]  [Approve🟢]│
└────────────────────────────────┘
```

**Rules:**
- Timeline: vertical, left dots + vertical line
- Dots: Complete `bg-[#059669]`, In Progress `bg-[#00C853] animate-pulse`, Pending `bg-[#E8E8E8]`
- Buttons: Reject(`border-[#FCA5A5] text-[#DC2626]`) + Approve(`bg-[#059669] text-white`)

---

## P06. Step Wizard

```
①━━━━②━━━━③━━━━④━━━━⑤
Basic  Dep   Medical Edu  Confirm
✅     ✅    ●Current ○Wait ○Wait
```

**Rules:**
- Complete: `bg-[#059669] text-white`
- Current: `bg-[#00C853] text-white`
- Pending: `bg-[#E8E8E8] text-[#999]`
- Bottom: Previous(Secondary) + Next(Primary)

---

## P07. Pipeline Funnel/Kanban

```
Applied(12)→Screen(8)→Tech(5)→Fit(3)→Offer(2)→Hired(1)
┌──────┐ ┌──────┐ ┌──────┐
│Scrn(8)│ │Tech(5)│ │Fit(3) │
│👤 Kim │ │👤 Park│ │👤 Lee │
│⭐4.2  │ │⭐3.8  │ │⭐4.5  │
└──────┘ └──────┘ └──────┘
```

**Rules:**
- Funnel: top visual narrowing chart
- Kanban: horizontal scroll, drag-and-drop (dnd-kit)
- Card: name + position + rating + days elapsed
- Rejected: `bg-[#FEE2E2]` separate area

---

## P08. OKR Tree Table

```
🎯 O: Improve Customer Satisfaction    ■■■■■■□□ 75%
  📊 KR1: NPS 80 score                ■■■■□□□□ 50%
  📊 KR2: Response time 24h           ■■■■■■■□ 90%
    ✅ Task: CS team training done     ■■■■■■■■ 100%
```

**Rules:**
- Hierarchy: O > KR > Task, indent `pl-6`
- Progress: 0-33% `bg-[#EF4444]`, 34-66% `bg-[#F59E0B]`, 67-100% `bg-[#059669]`
- Status: Good🟢/Difficult🟡/Risk🔴 + Achieved/Missed/Cancelled
- Auto-update: ⚡ icon + tooltip
- Right panel: comment + progress update feed

---

## P09. Rich Text + Side Context

```
┌──────────────────────┬──────────┐
│ 1:1 Meeting Notes     │ 👤 Kim    │
│ [B][i][U][🔗][≡]     │ Motives   │
│ ## Weekly Reflection   │ Questions │
│ ...                   │ Notes     │
│ ✅ Action Items        │          │
│ ☐ API docs @Park      │          │
└──────────────────────┴──────────┘
```

**Rules:**
- Editor: B/I/U/Link/List
- Action items: `☐ text @assignee status_badge`
- Side panel: `w-72`, employee info
- AI recommendation banner: `bg-[#E0E7FF] border-l-2 border-[#4338CA]`
- Emotion check-in: 4 levels (😀/🙂/😐/😞)

---

## P10. Chart Dashboard

```
┌────────────────────────────────────────┐
│ [1M] [2M] [4M] [8M] [12M] [24M]       │
│ Filters: [Team✕] [Gender✕]             │
│ Dimension: [Dept🔀] [Gender🔀] [+Add]  │
├──────────────────┬─────────────────────┤
│ 📈 Turnover Trend │ 📊 Dept Distribution│
│ Line(solid+pred.) │ Grouped bar chart   │
├──────────────────┼─────────────────────┤
│ 📊 Grade Dist.   │ 🎯 Psych Safety    │
│ Stacked bar       │ Radar chart        │
└──────────────────┴─────────────────────┘
```

**Rules:**
- Recharts library
- Period tabs: horizontal button group
- Hover tooltip: `bg-white shadow-lg rounded-lg p-3`
- Grid: `grid grid-cols-1 lg:grid-cols-2 gap-6`

---

## P11. Tree Org Chart

```
          ┌───────┐
          │CEO Kim│
          └───┬───┘
     ┌────────┼────────┐
  ┌──┴──┐ ┌──┴──┐ ┌──┴──┐
  │CTO  │ │CFO  │ │CHO  │
  │80ppl│ │20ppl│ │50ppl│
  └─────┘ └─────┘ └─────┘
```

**Rules:**
- Node: `bg-white rounded-xl border border-[#E8E8E8] p-4`
- Head: `border-l-4 border-[#00C853]`
- Trend overlay: metric badges on nodes (Good/Warning/Alert)
- Historical view: date slider
- Zoom/Pan: mouse wheel + drag

---

## P12. Mobile Notification Center

```
┌─────────────────────────┐
│ Notifications  [Mark All]│
│ [All Notifications ▼]    │
├─────────────────────────┤
│ 🔔 Smart Leave Nudge 2h │
│ 🎯 Goal Update      5h  │
│ 📋 Document Review  1d  │
└─────────────────────────┘
```

**Rules:**
- Unread: left `w-2 bg-[#00C853] rounded-full` dot
- Time: relative (just now / min / hr / day)
- Filters: All / Approval / Goals / Attendance / Performance / System
- Click: deep link to detail page

---

## P13. Section-Based Sidebar (A1)

> FLEX/Workday benchmark. Role-based section grouping + accordion pattern.

### Expanded State (w-64 / 256px)

**Section header:**
```
text-[11px] font-semibold uppercase tracking-wider text-[#888]
px-4 mt-6 mb-2
Click to toggle accordion (▼ / ▶)
```

**Menu items:**
```
Active:  bg-[#00C853] text-white rounded-lg mx-2 px-3 py-2
Hover:   bg-[#222] rounded-lg mx-2
Default: text-[#CCC] px-3 py-2 text-sm
Icon:    18px mr-3
```

**Section divider:**
```
border-t border-[#333] mx-3 mt-4 pt-4
```

**comingSoon items:**
```
text-[#666] cursor-not-allowed
Lock icon next to item (12px)
Hover tooltip: "Coming soon"
```

### Collapsed State (w-16 / 64px)
- Section icons only
- Hover → flyout menu (section sub-items)
- Active section: `bg-[#00C853] rounded-lg p-2`
- Tooltip: section name

### Responsive
| Breakpoint | Behavior |
|-----------|----------|
| < md | Sidebar hidden + hamburger menu (overlay drawer) |
| md~lg | Collapsed (w-16) default |
| > lg | Expanded (w-64) default |

### State Persistence
- Expand/collapse: `localStorage('sidebar-collapsed')`
- Section accordion open/close: `localStorage('sidebar-sections')`
- Page navigation auto-expands active section

---

## New Feature Patterns

### NP01. AI Analysis Report Card

```
┌────────────────────────────────┐
│ 🤖 AI Analysis       [Refresh] │
│ ■■■■■■■■ Communication 92pts   │
│ ■■■■■■□□ Problem Solving 75pts │
│ 💡 "Recommend mentoring role…" │
│ [Radar Chart]                   │
└────────────────────────────────┘
```
- AI badge: `bg-[#E0E7FF] text-[#4338CA]`
- Applied: Performance, Interview, 1:1

### NP02. Calibration/9-Grid

```
     High│ C(2) │ A(5) │
  Perf   │ D(1) │ B(8) │
     Low │ E(0) │ C(3) │
         └──────┴──────┘
          Low Comp High
Grade Dist: S(5%) A(20%) B(50%) C(20%) D(5%)
```
- Cell click → show employees in that grade
- Forced distribution bar

### NP03. Self-Service Issuance Form
Certificate type / language / purpose / seal → Submit
- Form pattern: `max-w-lg mx-auto`

### NP04. E-Signature Flow
PDF preview → Confirm checkbox → Touch/mouse signature → Complete
- Canvas-based signature pad
- Mobile optimization required

---

## Page Layout

### Basic Structure
```
┌────────────────────────────────┐
│ Sidebar(w-64) │ Header(h-16)   │
│               ├────────────────┤
│               │ Breadcrumb+Title│
│               ├────────────────┤
│               │ Content(p-6)   │
│               │ bg-[#FAFAFA]   │
└───────────────┴────────────────┘
```

### Responsive
| Breakpoint | Layout |
|-----------|--------|
| < md | Sidebar hidden, hamburger, single column |
| md~lg | Sidebar collapsed (w-16), 2 columns |
| > lg | Sidebar full, master-detail, 4-col KPI |

### Page Header
```jsx
<div className="flex items-center justify-between mb-6">
  <div>
    <nav className="text-xs text-[#999] mb-1">Dashboard / Employees</nav>
    <h1 className="text-2xl font-bold text-[#1A1A1A]">Employee Management</h1>
  </div>
  <div className="flex items-center gap-3">
    <Button variant="secondary">Export</Button>
    <Button variant="primary">+ Add</Button>
  </div>
</div>
```
