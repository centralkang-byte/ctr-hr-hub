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

> **Wave 0 (2026-06-10, CEO 결정)**: `_design-reference` `[data-style="workday"]` = **픽셀 SSOT**.
> 중립 회색은 cool-gray(hue 245-250) — 구 Stitch green-gray(#f6f6f6/#2d2f2f/#acadad) 사용 금지.

- 순수 검정 `#000`/`#000000` 사용 금지 → `foreground` (#182029)
- Primary: #004964 / Primary-dim: #003953 / Primary-container: #bedded (Workday Navy)
- Semantic: success #008b4e / danger #d73337 / warning #d0901e(BG·아이콘) / info #0091b9 (proto :root 패밀리)
- 하드코딩 hex 금지 (CSS 변수/Tailwind 토큰 사용). 예외 3가지:
  1. **WCAG AA text**: `text-[#006b39]` (badge success ink), `text-[#b71824]` (error ink)
  2. **Opacity 미지원 토큰**: `bg-[#b45309]/10` (badge warning)
  3. **도메인 고유 색상**: 차트 팔레트, 파이프라인 단계, 급여 유형 등 → `chart.ts` 또는 컴포넌트 상수로 관리

## D17 Color Principle (bg/text 분리)

bg와 text에 같은 토큰 사용 금지. bg는 밝은 색, text는 WCAG AA 만족하는 어두운 색.

- Warning: `bg-warning-bright/15` + `text-ctr-warning` (#b45309 — proto #d0901e는 텍스트 AA 미달이라 텍스트엔 금지)
- Alert: `bg-alert-red/10` + `text-destructive`
- Success badge: `bg-tertiary/10` + `text-[#006b39]`

## Typography — 핵심 체크

- ~~font-display (Outfit)~~ **Wave 0: Outfit 폐기** — 프로토는 Pretendard + Geist Mono만. `font-display`는 Pretendard 별칭으로만 잔존
- `font-mono` (Geist Mono): 항상 `tabular-nums`와 페어. **단독 사용 금지**. KPI 대형 수치(`displaySm`)는 mono 아님 — Pretendard 500 + `tabular-nums`
- CJK: `letter-spacing: -0.005em` (proto body — -0.02em 과조밀 금지), `line-height: 1.5+`, **base 14px (body에 실집행됨)**
- 헤딩 스케일 = proto workday: pageTitle 26/600 · sectionTitle 17/600 · cardTitle 14.5/600
- `TYPOGRAPHY` 상수 (`src/lib/styles/typography.ts`) 사용. inline `text-Xxl font-bold` 최소화

## Border & Elevation

> **Wave 0: No-Line Rule 폐기** (프로토 충실 CEO 결정 — 고스트 보더는 프로토와 정면충돌이었음)

- 카드·테이블·패널 = **1px solid `border-border`** (#d8dfe6 가시 보더, full opacity)
- 버튼 outline·input·select = `border-border-strong` (#bbc6cf)
- `border-border/15` 고스트 보더 **금지** (신규 작성 시)
- Shadow: `shadow-sm` (card, proto shadow-card), `shadow-md` (dropdown), `shadow-lg` (modal, proto shadow-pop) — navy-tinted

## Border Radius (3 tiers only)

- **Pill** (`rounded-full`): status badge, search bar (~~CTA lg 버튼~~ — Wave 0: 버튼은 전부 8px flat, 그라데이션 금지)
- **Container** (`rounded-2xl` = 14px): card, modal, panel (proto workday .card)
- **Element** (`rounded-lg` = 8px): input, button / `rounded-md` (6px): sm button

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
- Input: border 1px (Tailwind 기본), `rounded-lg`, focus Navy ring (--ring #004964)
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
- 고스트 보더 `border-border/15` (Wave 0: 가시 1px solid `border-border`가 표준)
- **버튼 그라데이션·glow** (프로토 CLAUDE.md 금지 — flat fill만)
- **좌측 색 보더 강조 카드** (`border-l-4` urgency 카드 — 프로토가 명시 금지한 AI slop; urgency는 아이콘 틴트로)
- 통일된 border-radius (3-tier 시스템 필수)
- Purple AI-slop gradients
- System emoji (Lucide 아이콘 사용)
- `font-mono` without `tabular-nums`
- 하드코딩 hex (위 "예외 3가지" 외)
- Status badge를 raw `bg-[#xxx]/10 text-[#xxx]` 로 구성 (StatusBadge/Badge 사용)

## Pixel Gate (Wave 0 신설 — 페이지 디자인 작업 필수 게이트)

페이지를 새 디자인으로 작업/마이그레이션할 때는 **렌더링된 프로토타입과 side-by-side 비교**가 필수:

1. 프로토 서빙: `python3 -m http.server 8077 -d _design-reference` → `http://localhost:8077/HR%20Hub.html`
   (파일 더블클릭 금지 — Babel JSX가 file:// CORS로 깨짐. React/Babel CDN 로드라 인터넷 필요)
2. Tweaks 패널에서 style=workday 확인 후 대상 페이지로 이동 → 스크린샷
3. 구현 페이지 스크린샷 → 나란히 놓고 구조·밀도·타이포·색 대조
4. 차이가 의도된 것(기능 차이·실데이터)인지 누락인지 분류해 PR에 기록
- tsc/lint/E2E는 시각 충실도를 전혀 검증하지 못함 — 이 게이트가 유일한 픽셀 검증 (과거 전 마이그레이션이 이 단계 부재로 발산)
