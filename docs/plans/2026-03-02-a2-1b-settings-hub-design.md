# A2-1b: Settings Hub UI — Design Document

**Date:** 2026-03-02
**Phase:** A2-1b (Architecture Foundation)
**Scope:** UI/Routing/Navigation only (no form implementation)

---

## 1. Problem Statement

The sidebar currently exposes 37 settings sub-items, overwhelming users. The goal is to replace this with a single "⚙ 설정" link that leads to a categorized hub page, then to per-category sub-pages with a side-tab navigation pattern.

---

## 2. Design Decisions

### 2.1 Color Accent
- **Decision:** CTR Green `#00C853` (consistent with CLAUDE.md design system)
- **Rationale:** User confirmed green aligns with P13 sidebar pattern and brand consistency
- **Applied to:** Card hover borders, active side-tab indicator

### 2.2 Existing `/settings` Page
- **Decision:** Replace `CompanySettingsClient` with new hub. Move company settings form into `system` category sub-page placeholder.
- **Rationale:** The new hub is the entry point at `/settings`. Old route preserved.

### 2.3 URL Structure
- Hub: `/settings`
- Category: `/settings/[category]` (e.g., `/settings/attendance`)
- Tab state: `?tab=[item-id]` query parameter (survives refresh)
- Invalid category → redirect to `/settings`

---

## 3. Information Architecture

### 3.1 Category Data (`src/lib/settings/categories.ts`)

6 categories, 37 total items:

| ID | Label | Items |
|----|-------|-------|
| `attendance` | 근태/휴가 | 6 |
| `performance` | 성과/평가 | 7 |
| `compensation` | 보상/복리후생 | 5 |
| `recruitment` | 채용/온보딩 | 5 |
| `organization` | 조직/인사 | 6 |
| `system` | 시스템/연동 | 8 |

### 3.2 Navigation Change

**Before:** navigation.ts settings section → 37 items
**After:** navigation.ts settings section → 1 item `{ href: '/settings', label: '설정', icon: Settings }`

---

## 4. Page Architecture

### 4.1 Hub Page (`app/settings/page.tsx`)
- 3×2 card grid (responsive: 1col mobile, 2col md, 3col lg)
- Each card: icon + Korean label + English sub-label + item count badge + top-3 preview list
- Search bar: client-side filter across all 37 items by label + description
- Search result: switches from card grid to filtered list view

### 4.2 Layout (`app/settings/layout.tsx`)
- Wraps hub + sub-pages
- Breadcrumb: "설정" / "설정 > 카테고리" / "설정 > 카테고리 > 항목"

### 4.3 Category Sub-page (`app/settings/[category]/page.tsx`)
- Left side-tabs (w-60, lg+): item list with active indicator
- Right content: item title + description + placeholder component
- Mobile (< lg): top Select dropdown replaces side-tabs
- "← 설정으로 돌아가기" back link at top
- Default: first item selected if no `?tab=` param

---

## 5. Component Breakdown

| Component | Purpose |
|-----------|---------|
| `src/lib/settings/categories.ts` | Category/item data definitions |
| `src/components/settings/SettingsCard.tsx` | Hub category card |
| `src/components/settings/SettingsSearch.tsx` | Search bar + filter logic |
| `src/components/settings/SettingsSideTabs.tsx` | Left side-tab navigation |
| `src/components/settings/SettingsPlaceholder.tsx` | "Form coming in Phase B" placeholder |

---

## 6. Style Spec

| Element | Class |
|---------|-------|
| Card container | `bg-white border border-gray-200 rounded-xl p-6` |
| Card hover border | `border-l-4 border-[#00C853]` + `shadow-lg` |
| Active side-tab | `border-l-4 border-[#00C853] bg-green-50/50 font-medium` |
| Icon container | `w-10 h-10 bg-gray-50 rounded-lg p-2` |
| Category label | `text-lg font-semibold text-gray-900` |
| English sub-label | `text-xs text-gray-400 mt-0.5` |
| Item count | `text-sm text-gray-500` |

---

## 7. Files to Create/Modify

### New (8 files)
```
src/lib/settings/categories.ts
app/settings/layout.tsx
app/settings/page.tsx              ← replaces current hub
app/settings/[category]/page.tsx
src/components/settings/SettingsCard.tsx
src/components/settings/SettingsSearch.tsx
src/components/settings/SettingsSideTabs.tsx
src/components/settings/SettingsPlaceholder.tsx
```

### Modified (1 file)
```
src/config/navigation.ts           ← settings section: 37 items → 1 item
```

### Preserved (no deletion)
```
app/settings/CompanySettingsClient.tsx  ← keep for Phase B reuse
app/settings/work-schedules/            ← all existing sub-routes preserved
... (all 37 existing sub-route directories)
```
