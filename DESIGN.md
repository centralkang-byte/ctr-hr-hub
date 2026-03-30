# Design System — Kinetic Atelier

> **Creative North Star:** "The Editorial Orchestrator"
> 전통적 공장형 HR 시스템에서 벗어나, 잡지(Editorial) 같은 세련된 레이아웃과 역동적 에너지를 결합한 차세대 HR 디자인 시스템.

## Product Context

- **What this is:** CTR 그룹 통합 인사관리 시스템 (HR SaaS)
- **Who it's for:** HR Admin(하루 8시간 사용), Manager, Employee, Executive
- **Space/industry:** Enterprise HR SaaS (Workday, BambooHR, Rippling 경쟁)
- **Project type:** Data-heavy dashboard / web app
- **Locales:** ko, en, zh, vi, es (5개 언어, CJK 3개)

## Aesthetic Direction

- **Direction:** Editorial/Magazine — 에디토리얼 레이아웃 + 역동적 에너지
- **Decoration level:** Intentional — Tonal Layering, 미세 그라디언트, 글래스모피즘(제한적)
- **Mood:** "Kinetic Atelier" — 정교함(Sophistication) + 역동성(Vitality) + 신뢰(Authority). 깨끗한 화이트 스페이스와 인디고/에메랄드 악센트의 긴장감.
- **Anti-patterns:** 1px 보더 남용, 균일한 그리드 박스, 보라색 AI슬롭 그라디언트, 모든 요소에 동일한 border-radius

---

## 1. Color Palette (Stitch Semantic Tokens)

### Primary & Accent

| Token | Hex | HSL | 용도 |
|-------|-----|-----|------|
| primary | #4a40e0 | 244 74% 56% | CTA, 활성 상태, 링크, 주요 악센트 |
| primary-dim | #3d30d4 | 247 65% 51% | Primary hover, 그라디언트 끝점 |
| primary-container | #9795ff | 242 100% 79% | Primary 밝은 변형, 배지, 강조 배경 |
| primary-fixed | #9795ff | 242 100% 79% | 고정 악센트 |
| primary-fixed-dim | #8885ff | 242 100% 76% | 고정 악센트 어두운 변형 |
| secondary | #6249b2 | 261 44% 49% | 보조 악센트 |
| secondary-container | #d8caff | 258 100% 89% | 보조 배경 |

### Tertiary (Emerald — 성장/긍정 시그널)

| Token | Hex | 용도 |
|-------|-----|------|
| tertiary | #006947 | 에메랄드 텍스트, 성장/채용/긍정 |
| tertiary-dim | #005c3d | 에메랄드 hover |
| tertiary-container | #69f6b8 | 에메랄드 배경, Success 칩 |
| on-tertiary-container | #005a3c | 에메랄드 컨테이너 위 텍스트 |

### Surface Hierarchy (Tonal Layering)

| Layer | Token | Hex | 용도 |
|-------|-------|-----|------|
| 0 (Base) | surface / background | #f6f6f6 | 페이지 배경 |
| 1 (Canvas) | surface-container-low | #f0f1f1 | 보조 섹션 배경 |
| 2 (Card) | surface-container-lowest | #ffffff | 카드, 주요 인터랙티브 영역 |
| 3 (Elevated) | surface-container-high | #e1e3e3 | 호버 상태, 테이블 헤더 |
| — | surface-container | #e7e8e8 | 일반 컨테이너 |
| — | surface-dim | #d2d5d5 | 비활성/낮은 우선순위 |

### Text Colors

| Token | Hex | 용도 |
|-------|-----|------|
| on-surface | #2d2f2f | 기본 텍스트 (순수 검정 #000 금지) |
| on-surface-variant | #5a5c5c | 보조 텍스트, 라벨, 메타데이터 |
| on-background | #2d2f2f | 배경 위 텍스트 |

### Semantic Colors

| 의미 | Foreground | Background | Badge variant |
|------|-----------|-----------|---------------|
| 성공/활성/완료 | #006947 (tertiary) | #69f6b8/30 (tertiary-container) | success |
| 경고/대기/수습 | #B45309 | #FEF3C7 | warning |
| 오류/반려/삭제 | #b41340 (error) | #f74b6d/20 (error-container) | error |
| 정보/진행중 | #4a40e0 (primary) | #9795ff/20 (primary-container) | info |
| 비활성/초안 | #5a5c5c | #e7e8e8 | neutral |

### Outline & Border

| Token | Hex | 용도 |
|-------|-----|------|
| outline | #757777 | 강조 보더 (드물게) |
| outline-variant | #acadad | Ghost Border (15% opacity로만 사용) |

### Chart Palette (6색)

| 순서 | Hex | Token |
|------|-----|-------|
| 1 | #4a40e0 | primary |
| 2 | #9795ff | primary-container |
| 3 | #006947 | tertiary |
| 4 | #6249b2 | secondary |
| 5 | #b41340 | error |
| 6 | #5a5c5c | on-surface-variant |

---

## 2. Typography

### Font Stack

| 유틸리티 | 폰트 | 용도 | 규칙 |
|----------|------|------|------|
| `font-sans` | Pretendard Variable | 글로벌 본문, CJK 가독성 최우선 | 기본값, 한영 혼합 문장 포함 |
| `font-display` | Inter | 영문 전용 Hero/KPI/대형 타이틀 | text-4xl 이상, 순수 영문/숫자만 |
| `font-mono` | Geist Mono | 숫자, 코드, 사번, 날짜 | 반드시 `tabular-nums` 동반 |

### 베이스라인 충돌 방지

Inter와 Pretendard를 같은 font-family에 섞으면 영문/한글 baseline이 어긋남.
- `font-display`는 명시적으로만 사용 (영문 전용 대형 텍스트)
- 한영 혼합 문장: **절대 font-display 사용 금지** → Pretendard로 통일

### CJK 규칙

- `letter-spacing: -0.02em` 전역 적용
- `line-height: 1.6` 최소 (CJK 가독성)
- Base size 14px

### Mono 규칙

```
font-mono 사용 시 반드시:
  className="font-mono tabular-nums"

❌ 단독 font-mono 사용 금지
✅ 항상 tabular-nums 동반
```

### Type Scale

| Token | Size | Weight | 용도 |
|-------|------|--------|------|
| display-lg | 3.5rem (56px) | 900 | 대시보드 Hero metric (font-display) |
| display-sm | 2rem (32px) | 800 | 카드 내 핵심 수치 |
| 4xl | 30px | 700 | 페이지 제목 |
| 3xl | 24px | 700 | 섹션 제목 |
| headline-sm | 1.5rem (24px) | 700 | 카드 헤더 |
| base | 14px (0.875rem) | 400 | 기본 본문 (body-md) |
| sm | 13px | 400 | 보조 텍스트 |
| xs | 12px | 500 | 캡션, 페이지네이션 |
| 2xs | 11px | 600 | 테이블 헤더, 라벨 (uppercase, tracking-widest) |
| label-sm | 0.6875rem | 700 | 메타데이터, on-surface-variant 색상 |

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

### Density Tokens

| Density | Card | Cell | Gap | Text | 적용 대상 |
|---------|------|------|-----|------|----------|
| **compact** | p-4 | px-3 py-1 | gap-2 | text-xs | 급여 테이블, 근태 로그, 감사 로그 |
| **comfortable** | p-6 | px-5 py-3 | gap-4 | text-sm | 직원 목록, 휴가, 채용 (DEFAULT) |
| **spacious** | p-8 | px-5 py-3.5 | gap-6 | text-base | 대시보드 KPI, 프로필, 온보딩 |

---

## 4. Layout

- **Approach:** Grid-disciplined + Editorial accents (대시보드는 Bento Grid)
- **Grid:** 12 columns
- **Max content width:** 1280px (7xl)
- **Page padding:** p-6 (24px), 대시보드 p-8
- **Section gap:** space-y-6 (24px), 대시보드 space-y-8

### Border Radius (3단계)

| 이름 | Value | Tailwind | 용도 |
|------|-------|----------|------|
| Pill | 9999px | rounded-full | 메인 CTA 버튼, 상태 뱃지, 검색창 |
| Container | 1rem (16px) | rounded-2xl | 메인 카드, 모달, 패널 |
| Element | 0.5rem (8px) | rounded-lg | 입력창, 테이블 내부 요소, sm 버튼 |

---

## 5. Elevation & Depth

### Tonal Layering (보더 대신)

**No-Line Rule:** 1px solid 보더로 섹션 구분 금지. 배경색 차이(Tonal Layering)로 계층 표현.
- `surface-container-low` (#f0f1f1) 위에 `surface-container-lowest` (#ffffff) 카드 배치
- 2% 밝기 차이가 "Soft Lift" 효과

### Shadow 토큰

| Token | Value | 용도 |
|-------|-------|------|
| shadow-none | none | Flat (Tonal Layering만) |
| shadow-sm | `0 1px 2px rgba(15,23,42,0.06)` | Card |
| shadow-md | `0 4px 12px rgba(15,23,42,0.08)` | Dropdown, Popover |
| shadow-lg | `0 12px 32px rgba(15,23,42,0.12)` | Modal, Sheet |
| primary-tinted | `0 20px 40px -5px rgba(74,64,224,0.06)` | Hero 카드, 강조 패널 |

### Ghost Border (접근성 폴백)

보더가 반드시 필요한 경우: `outline-variant` (#acadad) at **15% opacity only**. 100% opaque 보더 금지.

---

## 6. Signature Components

### Primary Button (CTA)

- Shape: `rounded-full` (Pill) — `size="lg"`만
- Background: `bg-gradient-to-r from-primary to-primary-dim` (Kinetic Gradient)
- Shadow: `shadow-lg shadow-primary/20`
- Hover: `ring-2 ring-primary-container` (inner glow)

### Button Size 분기 (밀도 보호)

| Size | Radius | Style | 용도 |
|------|--------|-------|------|
| lg | rounded-full | gradient + shadow | 메인 CTA |
| default | rounded-xl | bg-primary | 일반 액션 |
| sm | rounded-lg | bg-primary | 테이블 액션, 밀도 보호 |
| icon | rounded-lg | bg-transparent | 아이콘 버튼 |

### Analytics Cards (Kinetic Cards)

- 보더 없음, `bg-surface-container-lowest`
- Asymmetry: 핵심 수치 top-left, 트렌드 칩 bottom-right (대각선 흐름)
- Hero card: gradient 배경 (`from-primary to-primary-dim`)

### Status Chips

- Success: `bg-tertiary-container/30 text-on-tertiary-container` (에메랄드)
- Error: `bg-error-container/20 text-error`
- Info: `bg-primary-container/30 text-primary`
- Shape: `rounded-full` (Pill)

### Data Lists

- Divider 금지 → `spacing-4` (1rem)로 분리
- Hover: `bg-surface-container-high` (#e1e3e3)

---

## 7. Glassmorphism (제한적 사용)

**GPU 과부하 방지:** HR 실무자 저사양 환경 보호를 위해 2곳만 허용.

| 위치 | 스타일 | 허용 여부 |
|------|--------|----------|
| TopBar (글로벌) | `bg-white/80 backdrop-blur-md` | ✅ |
| Dialog/Sheet 오버레이 | `bg-white/70 backdrop-blur-[20px]` | ✅ |
| 그 외 모든 곳 | — | ❌ 금지 |

---

## 8. Motion

- **Approach:** Intentional — 상태 전환 + 미세 인터랙션
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`
- **Duration:** micro 50-100ms, short 150ms, medium 250ms, long 400-700ms
- **Transition:** `transition-all duration-150 ease-out` (기본)
- **Button hover:** `hover:scale-[1.02]` (lg CTA), `active:scale-95`
- **Card hover:** `hover:-translate-y-1` (subtle lift)
- **금지:** 장식적 애니메이션, 스크롤 트리거, 무한 반복

---

## 9. Interactive States

### Focus Ring

```
focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2
```

### Hover

| 컴포넌트 | Hover 스타일 |
|----------|-------------|
| CTA Button | gradient → inner glow (ring-2 ring-primary-container) |
| Ghost Button | bg-transparent → bg-surface-container-low |
| Table Row | bg-transparent → bg-surface-container-high |
| Card | shadow-sm → shadow-md + translateY(-1px) |
| Link | text-primary → underline |

### Disabled

```
disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed
```

---

## 10. Iconography

### lucide-react — 100% 단일 사용

| Token | Size | 용도 |
|-------|------|------|
| sm | 16px (h-4 w-4) | 버튼, 테이블 액션 |
| md | 20px (h-5 w-5) | 섹션 헤더, 카드 |
| lg | 24px (h-6 w-6) | 페이지 타이틀, Empty State |

- Stroke width: 1.5px (변경 금지)
- 아이콘-텍스트 간격: `mr-2`
- 색상: 부모 텍스트 색상 상속

---

## 11. Editorial Design Principles

### No-Line Rule

1px solid 보더로 섹션/그룹을 구분하지 않는다. 배경색 변화(Tonal Layering)로 계층을 표현한다.

### Display Typography

대시보드 상단의 핵심 지표는 압도적인 크기의 폰트(display-lg, 3.5rem)와 font-black(900)을 사용하여 시각적 위계를 극명하게 나눈다.

### Kinetic Gradient

주요 CTA에 `bg-gradient-to-r from-primary to-primary-dim` (135도) 적용. 입체감과 에너지.

### White Space

레이아웃이 "꽉 찬" 느낌이면 spacing 토큰을 한 단계 올린다. 여백이 위계를 만든다.

### Asymmetric Energy

카드 내부에서 metric은 top-left, trend chip은 bottom-right — 대각선 흐름으로 시각적 움직임.

---

## 12. Do's and Don'ts

### Do:
- 여백을 충분히. 꽉 차면 spacing 한 단계 올리기
- tertiary(Emerald)는 성장/채용/긍정 모멘텀에만 사용
- Display 타이포로 데이터 위계 표현
- Tonal Layering으로 영역 구분

### Don't:
- 순수 검정(#000000) 텍스트 사용 → on-surface(#2d2f2f) 사용
- 1px solid 보더로 섹션 구분 → Tonal Layering
- 네비게이션 과밀 → 타이포 스케일로 조직
- backdrop-blur를 TopBar/Dialog 외에 사용
- font-display를 한영 혼합 문장에 사용
- font-mono를 tabular-nums 없이 단독 사용

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-22 | Initial design system (Industrial/Utilitarian) | 코드베이스 분석 기반 |
| 2026-03-30 | Kinetic Atelier 전환 | Stitch 컨설팅 — Editorial/Magazine 방향 |
| 2026-03-30 | Primary #4a40e0 + Emerald #69f6b8 | Stitch 팔레트, 더 깊은 인디고 + 에메랄드 tertiary |
| 2026-03-30 | font-display 분리 (Inter) | 베이스라인 충돌 방지, 영문 전용 |
| 2026-03-30 | Button size별 radius 분기 | Pill은 CTA만, sm/icon은 rounded-lg 유지 (밀도 보호) |
| 2026-03-30 | Glassmorphism 2곳만 허용 | GPU 과부하 방지, HR 실무자 환경 고려 |
| 2026-03-30 | Tonal Layering (No-Line Rule) | 보더 대신 배경색 차이로 계층 표현 |
