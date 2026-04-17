---
paths: ["src/app/**/*.tsx", "src/components/**/*.tsx", "src/lib/styles/**"]
---

# Design Token Rules

> **SSOT**: `DESIGN.md` (전체 디자인 시스템 정의)
> 본 파일은 UI 파일 편집 시 자동 주입되는 "금지/필수 체크리스트" 요약본.
> 색상 팔레트, 타이포그래피 스케일, 컴포넌트 상세, Mobile 전략 등은 `DESIGN.md` 참조.
> 구현 SSOT: `src/lib/styles/typography.ts`, `src/lib/styles/status.ts`, `src/components/ui/badge.tsx`.

---

## 색상 (Color) — 핵심 체크

- 순수 검정 `#000`/`#000000` 사용 금지 → `on-surface` (#2d2f2f)
- Primary: #6366f1 / Primary-dim: #4f46e5 / Primary-container: #a5b4fc
- 하드코딩 hex 금지 (CSS 변수/Tailwind 토큰 사용). 예외 3가지:
  1. **WCAG AA text**: `text-[#15803d]` (badge success)
  2. **Opacity 미지원 토큰**: `bg-[#b45309]/10` (badge warning)
  3. **도메인 고유 색상**: 차트 팔레트, 파이프라인 단계, 급여 유형 등 → `chart.ts` 또는 컴포넌트 상수로 관리

## D17 Color Principle (bg/text 분리)

bg와 text에 같은 토큰 사용 금지. bg는 밝은 색, text는 WCAG AA 만족하는 어두운 색.

- Warning: `bg-warning-bright/15` + `text-ctr-warning`
- Alert: `bg-alert-red/10` + `text-destructive`
- Success badge: `bg-tertiary/10` + `text-[#15803d]`

## Typography — 핵심 체크

- `font-display` (Outfit): English/숫자 only, `text-4xl+` only. **한/영 혼재 금지**
- `font-mono` (Geist Mono): 항상 `tabular-nums`와 페어. **단독 사용 금지**
- CJK: `letter-spacing: -0.02em`, `line-height: 1.6+`, base 14px
- `TYPOGRAPHY` 상수 (`src/lib/styles/typography.ts`) 사용. inline `text-Xxl font-bold` 최소화

## Border & Elevation

- **No-Line Rule**: 1px solid border로 섹션 구분 금지 → Tonal Layering 사용
- Ghost Border: `outline-variant` 15% opacity ONLY
- Shadow: `shadow-sm` (card), `shadow-md` (dropdown), `shadow-lg` (modal)

## Border Radius (3 tiers only)

- **Pill** (`rounded-full`): CTA lg 버튼, status badge, search bar
- **Container** (`rounded-2xl`): card, modal, panel
- **Element** (`rounded-lg`): input, sm button

## Glassmorphism (2 locations only)

- TopBar: `bg-white/80 backdrop-blur-md` + `dark:bg-card/80`
- Dialog/Sheet overlay: `bg-white/70 backdrop-blur-[20px]`
- **그 외 모든 곳 FORBIDDEN**

## Status Badge (SSOT: `src/lib/styles/status.ts` + `src/components/ui/badge.tsx`)

- **Semantic status 매핑**: `StatusBadge` 컴포넌트 사용 → `status.ts`의 `STATUS_MAP`이 status → category 자동 변환
- **Visual variant 수동 지정**: `Badge` 컴포넌트 + variant prop (10개: default/secondary/destructive/outline/success/warning/error/info/neutral/accent)
- 6개 semantic category: `success`, `warning`, `error`, `info`, `neutral`, `accent`
- 새 status 추가 시 `status.ts`의 `STATUS_MAP`에 category 매핑만 추가 (UI 수정 불필요)
- 모두 pill shape + `whitespace-nowrap` (badge.tsx가 자동 처리)
- **직접 `bg-[#xxx]/10 text-[#xxx]` 하드코딩 금지**

## Icons (Lucide only)

- `lucide-react`만 사용
- System emoji: **FORBIDDEN** in all UI
- Inactive: Slate (#94a3b8), Active: white on gradient
- stroke-width: 1.5px, icon-text gap: `mr-2`
- Sizes: sm=16px (h-4 w-4), md=20px (h-5 w-5), lg=24px (h-6 w-6)

## Spacing Density

- `compact` (p-4): payroll/attendance/audit 테이블
- `comfortable` (p-6, DEFAULT): 직원 목록, 휴가, 채용
- `spacious` (p-8): dashboard KPI, profile, onboarding

## Form (shadcn FormField 래퍼 필수)

- Label: 항상 top, 11px semibold
- Required: red `*`
- Error: inline + red border + `XCircle` icon
- Input: border 1px (Tailwind 기본), `rounded-lg`, focus Violet ring
- Buttons (right-align): cancel(ghost) → draft(outline) → submit(primary pill)

## Tabs = Segmented Control

- `bg-muted/50 rounded-lg p-1` 컨테이너, **NO border-b**
- Active: `bg-card shadow-sm text-primary font-semibold rounded-md`
- Compact (nested only): `p-0.5 rounded-md`, trigger `px-2.5 py-1 text-xs`
- `motion-safe:transition-all`
- Mobile: `overflow-x-auto`, `min-h-[44px]`
- `aria-label` on every `TabsList`

## Forbidden Patterns

- `backdrop-blur` TopBar/Dialog 외 사용
- 1px solid border로 섹션 구분
- 통일된 border-radius (3-tier 시스템 필수)
- Purple AI-slop gradients
- System emoji (Lucide 아이콘 사용)
- `font-display`를 KR/EN 혼재 텍스트에 사용
- `font-mono` without `tabular-nums`
- 하드코딩 hex (위 "예외 3가지" 외)
- Status badge를 raw `bg-[#xxx]/10 text-[#xxx]` 로 구성 (StatusBadge/Badge 사용)
