# Design System — CTR HR Hub

## Product Context

- **What this is:** CTR 그룹 통합 인사관리 시스템 (HR SaaS)
- **Who it's for:** HR Admin(하루 8시간 사용), Manager, Employee, Executive
- **Space/industry:** Enterprise HR SaaS (Workday, BambooHR, Rippling 경쟁)
- **Project type:** Data-heavy dashboard / web app
- **Locales:** ko, en, zh, ja, vi (5개 언어, CJK 3개)

## Aesthetic Direction

- **Direction:** Industrial/Utilitarian — 기능 우선, 데이터 밀도 높음
- **Decoration level:** Minimal — 타이포그래피와 스페이싱이 계층을 만듦
- **Mood:** Stripe/Linear처럼 정밀하되, HR 도메인의 신뢰감을 위해 따뜻한 뉴트럴 사용. "하루 종일 써도 피로하지 않은 도구."
- **Anti-patterns:** 불필요한 그라디언트, 장식적 그림자, 보라색 AI슬롭 그라디언트, 균일한 bubbly border-radius

---

## 1. Typography

### Font Stack

- **Display/Body:** Pretendard Variable — CJK 최적화, 한글 렌더링 최고
- **Data/Numbers:** Geist Mono — tabular-nums 필수 동반, 급여/사번/날짜/비율
- **Code:** Geist Mono

### Loading

```css
/* Pretendard — CDN */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

/* Geist — Next.js local font (이미 적용됨) */
--font-geist-sans, --font-geist-mono
```

### Type Scale

| Token | Size | Weight | Line-height | 용도 |
|-------|------|--------|-------------|------|
| 4xl | 30px | 700 | 1.2 | 페이지 제목 |
| 3xl | 24px | 700 | 1.3 | 섹션 제목 |
| 2xl | 20px | 600 | 1.4 | 카드 제목 |
| xl | 18px | 600 | 1.5 | 소제목 |
| lg | 16px | 500 | 1.6 | 강조 본문 |
| **base** | **14px** | **400** | **1.6** | **기본 본문** |
| sm | 13px | 400 | 1.5 | 보조 텍스트 |
| xs | 12px | 500 | 1.5 | 캡션, 페이지네이션 |
| 2xs | 11px | 600 | 1.4 | 테이블 헤더 (uppercase, letter-spacing 0.06em) |

### CJK Rules

- `letter-spacing: -0.02em` (tracking-ctr) 전역 적용
- `line-height: 1.6` 최소 (CJK 가독성)
- Base size 14px — CJK 가독성과 데이터 밀도의 최적 균형점

### Mono Rules

```
Geist Mono 사용 시 반드시:
  className="font-mono tabular-nums"

❌ 단독 font-mono 사용 금지 — 숫자 세로 정렬이 깨짐
✅ 항상 tabular-nums 동반 — 급여, 사번, 날짜, 비율 모든 숫자 컬럼
```

---

## 2. Color

### Approach: Restrained — 1 Primary + Warm Neutrals + 4 Semantic

### Primary & Secondary

| Token | Hex | 용도 |
|-------|-----|------|
| primary | #6159E7 | CTA, 활성 상태, 링크 |
| primary-dark | #4F46E5 | Primary hover |
| primary-light | #EEF2FF | Primary 배경, 선택 상태 |
| secondary | #64748B | 보조 액션, 비활성 요소 |

### Neutral Scale (Slate)

| Token | Hex | 용도 |
|-------|-----|------|
| slate-900 | #0F172A | 최어두 텍스트, Dark 배경 |
| slate-800 | #1E293B | Dark surface |
| slate-700 | #334155 | Dark muted |
| slate-600 | #475569 | Secondary text |
| slate-500 | #64748B | Tertiary text |
| slate-400 | #94A3B8 | Placeholder, 아이콘 |
| slate-300 | #CBD5E1 | Disabled border |
| slate-200 | #E2E8F0 | Border (기본) |
| slate-100 | #F1F5F9 | Surface muted |
| slate-50 | #F8FAFC | Surface subtle, 페이지 배경 |

### Semantic Colors

| Token | Light (fg) | Light (bg) | Dark (fg) | Dark (bg) | 용도 |
|-------|-----------|-----------|----------|----------|------|
| success | #059669 | #ECFDF5 | #34D399 | #064E3B | 승인, 정상, 완료 |
| warning | #D97706 | #FFFBEB | #FBBF24 | #78350F | 대기, 수습, 주의 |
| error | #DC2626 | #FEF2F2 | #F87171 | #7F1D1D | 반려, 오류, 삭제 |
| info | #2563EB | #EFF6FF | #60A5FA | #1E3A5F | 진행중, 참고, 온보딩 |

> **Dark Mode 규칙:** Foreground(텍스트/아이콘)는 400 레벨, Background는 900 레벨 사용.
> Light의 600 레벨을 Dark에 그대로 쓰면 명도 대비 4.5:1 미달 (WCAG AA 실패).

### Chart Palette (6색 순서)

| 순서 | Hex | 이름 |
|------|-----|------|
| 1 | #4F46E5 | Indigo |
| 2 | #8B5CF6 | Violet |
| 3 | #059669 | Emerald |
| 4 | #D97706 | Amber |
| 5 | #DC2626 | Red |
| 6 | #64748B | Slate |

> **단일 소스:** `CHART_THEME` 하나만 사용. `CHART_COLORS`, CSS `--chart-*` 중복 정의 삭제 예정.

---

## 3. Spacing

### Base Unit: 4px, Density: Comfortable (기본)

| Token | Value | Tailwind |
|-------|-------|----------|
| xs | 4px | gap-1, p-1 |
| sm | 8px | gap-2, p-2 |
| md | 12px | gap-3, p-3 |
| lg | 16px | gap-4, p-4 |
| xl | 24px | gap-6, p-6 |
| 2xl | 32px | gap-8, p-8 |
| 3xl | 48px | - |
| 4xl | 64px | - |

---

## 4. Layout

- **Approach:** Grid-disciplined
- **Grid:** 12 columns
- **Max content width:** 1280px (7xl)
- **Page padding:** p-6 (24px)
- **Section gap:** space-y-6 (24px)

### Border Radius

| Token | Value | 용도 |
|-------|-------|------|
| sm | 4px | Badge, Tag |
| md | 6px | Button, Input, Select |
| lg | 8px | Card, Table wrapper |
| xl | 12px | Modal, Sheet |
| full | 9999px | Avatar, Pill badge |

---

## 5. Z-Index & Elevation

### Z-Index 계층도

| Layer | Z-Index | 컴포넌트 | Shadow |
|-------|---------|----------|--------|
| Content | z-0 | 테이블, 카드, 폼 | shadow-none ~ shadow-sm |
| Sticky | z-10 | 테이블 헤더, StickyActionBar | shadow-sm |
| Dropdown | z-50 | DropdownMenu, Popover, Select, HoverCard | shadow-md |
| Modal | z-50 | Dialog, AlertDialog, Sheet (overlay 분리) | shadow-lg |
| Tooltip | z-[60] | Tooltip (모달 내부에서도 표시) | shadow-md |
| Toast | z-[100] | Toast, Notification | shadow-lg |

> **Tooltip이 z-[60]인 이유:** 모달(z-50) 안의 버튼에 마우스를 올렸을 때 툴팁이 모달 밑으로 파고들지 않도록.

### Shadow 토큰

| Token | Value | 용도 |
|-------|-------|------|
| shadow-none | none | Flat card (border만) |
| shadow-sm | `0 1px 2px rgba(15,23,42,0.06)` | Card, Table wrapper |
| shadow-md | `0 4px 12px rgba(15,23,42,0.08)` | Dropdown, Popover, Tooltip |
| shadow-lg | `0 12px 32px rgba(15,23,42,0.12)` | Modal, Sheet, Toast |

> **Dark Mode:** shadow opacity 2~3배 증가 (배경이 어두워 그림자가 안 보이므로).

---

## 6. Interactive States

### Focus Ring (모든 인터랙티브 요소)

```
focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

- 버튼, 인풋, 셀렉트, 탭, 체크박스, 링크 — 예외 없이 적용
- Destructive 요소: `focus-visible:ring-error/50`

### Hover

| 컴포넌트 | Hover 스타일 |
|----------|-------------|
| Primary Button | bg-primary → bg-primary-dark (#4338CA) |
| Secondary/Ghost | bg-transparent → bg-surface-muted (#F1F5F9) |
| Destructive | bg-error → bg-error-dark (#B91C1C) |
| Table Row | bg-transparent → bg-surface-subtle (#F8FAFC) |
| Link | text-primary → underline |

### Disabled

```
disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed
```

- 모든 버튼, 인풋, 셀렉트에 동일하게 적용
- Label: `peer-disabled:opacity-70`

### Active

```
active:scale-[0.98] (150ms ease-out)
```

---

## 7. Iconography

### 라이브러리: `lucide-react` — 100% 단일 사용

### Size Scale

| Token | Size | Tailwind | 용도 |
|-------|------|----------|------|
| sm | 16px | h-4 w-4 | 버튼, 테이블 액션, 인라인 |
| md | 20px | h-5 w-5 | 섹션 헤더, 카드 아이콘 |
| lg | 24px | h-6 w-6 | 페이지 타이틀, Empty State |

### Rules

- **Stroke width:** 1.5px (lucide 기본값, 변경 금지)
- **아이콘-텍스트 간격:** `mr-2` (8px) — 버튼/탭 내부
- **색상:** 부모 텍스트 색상 상속. 상태 아이콘만 시맨틱 컬러 직접 지정.
- **사이드바 아이콘:** h-[18px] w-[18px] (DO NOT TOUCH — 별도 규칙)

---

## 8. Density & Responsive

### Density Tokens

| Density | Card | Cell | Gap | Text | 적용 대상 |
|---------|------|------|-----|------|----------|
| **compact** | p-4 | px-3 py-1 | gap-2 | text-xs | 급여 테이블, 근태 로그, 캘리브레이션, 감사 로그 |
| **comfortable** | p-6 | px-5 py-3 | gap-4 | text-sm | 직원 목록, 휴가, 교육, 채용 (DEFAULT) |
| **spacious** | p-8 | px-5 py-3.5 | gap-6 | text-base | 대시보드 KPI, 프로필, 온보딩 |

### Implementation Rule — Tailwind 동적 클래스 파괴 방지

```tsx
// ✅ 올바른 방식: 전체 문자열 객체 매핑
const DENSITY_STYLES = {
  compact:     { card: 'p-4',  cell: 'px-3 py-1',   gap: 'gap-2', text: 'text-xs' },
  comfortable: { card: 'p-6',  cell: 'px-5 py-3',   gap: 'gap-4', text: 'text-sm' },
  spacious:    { card: 'p-8',  cell: 'px-5 py-3.5', gap: 'gap-6', text: 'text-base' },
} as const

// ✅ 또는 CVA (Class Variance Authority) 사용
const tableVariants = cva('...', {
  variants: {
    density: {
      compact: 'p-4 text-xs',
      comfortable: 'p-6 text-sm',
      spacious: 'p-8 text-base',
    },
  },
  defaultVariants: { density: 'comfortable' },
})

// ❌ 절대 금지: 문자열 조합 (빌드 시 클래스 소실)
className={`p-${size}`}
className={`gap-${n}`}
```

### Responsive Table Strategy

| Breakpoint | 전략 |
|-----------|------|
| 1200px+ | 모든 컬럼 표시, 긴 텍스트 truncate + title 툴팁 |
| 768–1200px | 우선순위 낮은 컬럼 자동 숨김 + 컬럼 가시성 토글 |
| < 768px | 첫 컬럼(이름/사번) sticky left + 나머지 가로 스크롤 |
| 공통 | `overflow-x-auto`, 텍스트 셀 `max-w-[200px] truncate` |

---

## 9. Motion

- **Approach:** Minimal-functional — 상태 전환만
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`
- **Duration:** micro 50-100ms, short 150ms, medium 250ms
- **Transition:** `transition-all duration-150 ease-out` (기본)
- **금지:** 장식적 애니메이션, 스크롤 트리거 효과, 무한 반복

---

## 10. Status Color Mapping (통합)

> **단일 소스 원칙:** 모든 상태 뱃지 색상은 이 테이블을 따름. 페이지별 개별 `STATUS_COLORS` 정의 금지.

| 의미 | Light fg | Light bg | Badge variant |
|------|----------|----------|---------------|
| 승인 / 정상 / 완료 / 활성 | #059669 | #ECFDF5 | success |
| 대기 / 수습 / 검토중 | #D97706 | #FFFBEB | warning |
| 반려 / 오류 / 만료 / 결근 | #DC2626 | #FEF2F2 | error |
| 진행중 / 온보딩 / 참고 | #2563EB | #EFF6FF | info |
| 미시작 / 초안 / 취소 / 비활성 | #64748B | #F1F5F9 | neutral |
| 정규직 / 카테고리 구분 | #4F46E5 | #EEF2FF | primary |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | Initial design system created | 코드베이스 분석(30+ 하드코딩 hex, 상태 색상 7종 불일치) + HR SaaS 업계 리서치 기반 |
| 2026-03-22 | Indigo #4F46E5 as primary | CTR 브랜드 색상과 일치. 대부분 HR SaaS의 blue(#2563EB)와 차별화 |
| 2026-03-22 | Pretendard + Geist Mono 유지 | 이미 최적의 CJK 폰트 스택. 변경 불필요 |
| 2026-03-22 | 3단계 Density 시스템 도입 | HR Admin(compact) vs Employee(comfortable) vs Dashboard(spacious) 역할별 밀도 |
| 2026-03-22 | Dark mode semantic 400 레벨 | 600 레벨은 dark 배경에서 WCAG AA 명도 대비 미달 |
| 2026-03-22 | Tooltip z-[60] 분리 | 모달(z-50) 내부 툴팁 가림 방지 |
| 2026-03-22 | tabular-nums 강제 | 급여/사번 숫자 세로 정렬 보장 |
| 2026-03-22 | Tailwind 동적 클래스 금지 | CVA 또는 객체 매핑만 허용. 문자열 조합 시 빌드 클래스 소실 |
