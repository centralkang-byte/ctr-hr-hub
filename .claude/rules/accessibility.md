---
paths: ["src/components/**/*.tsx", "src/app/**/*.tsx"]
---

# Accessibility Rules

표준 원본:
- `src/lib/styles/status.ts` — WCAG AA 4.5:1 보장 색상 (`STATUS_BADGE_FG`)
- `src/components/ui/badge.tsx` — focus ring + 시맨틱 컬러
- `src/lib/styles/typography.ts` — 최소 12px 이상 본문
- `DESIGN.md §7 Mobile` — Strategy B Tier 1 (44px touch target)

## 필수 ARIA

### Icon-only Button
아이콘만 있는 버튼은 `aria-label` 필수:

```tsx
<Button size="icon" aria-label="직원 삭제">
  <Trash2 className="h-4 w-4" />
</Button>
```

### 진행률 (Progress Bar)
```tsx
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`온보딩 진행률: ${completed}/${total} 작업 완료`}
>
  <div style={{ width: `${progress}%` }} />
</div>
```

### 리스트
`<ul>`/`<ol>` 대신 `<div>`로 리스트 만들 때:

```tsx
<div role="list">
  <article role="listitem">...</article>
</div>
```

### 섹션 헤딩
Card/Section은 `aria-labelledby`로 heading id 참조:

```tsx
<section aria-labelledby="onboarding-tracker-title">
  <h2 id="onboarding-tracker-title">온보딩 진행 현황</h2>
  ...
</section>
```

### aria-hidden (중복 노출 방지)
label과 value가 둘 다 노출될 때 스크린 리더가 두 번 읽지 않도록:

```tsx
<div aria-label={`승인 대기: ${count}건`}>
  <p aria-hidden="true">승인 대기</p>
  <p aria-hidden="true">{count}건</p>
</div>
```

## 키보드 접근

- **focus ring 필수** — `outline-none`만 쓰지 말 것. Tailwind `focus-visible:ring-2 focus-visible:ring-ring` 또는 shadcn 컴포넌트 기본값 유지
- **Radix 기본 키보드 내비게이션 보존** — 커스텀 `onKeyDown`으로 방향키/Enter/Esc 오버라이드 금지
- `tabindex` 임의 조작 금지 (0/-1 외 숫자 금지)
- Modal/Sheet: Radix `Dialog`/`Sheet` 사용 시 focus trap 자동

## 색상 & 대비

### Badge (status.ts SSOT)
StatusBadge 컴포넌트 또는 `Badge` variant를 사용. 직접 hex 지정 금지.

```tsx
import { StatusBadge } from '@/components/ui/StatusBadge'

<StatusBadge status="APPROVED" />   // status.ts의 STATUS_MAP 기반
```

또는 raw variant:
```tsx
<Badge variant="warning">대기</Badge>
```

- `STATUS_BADGE_FG`의 색상은 WCAG AA 4.5:1 대비비 보장됨
- 임의로 밝은 색 (tertiary #16a34a 등) 쓰면 10px 텍스트에서 AA 미달

### D17/D18 원칙 (bg/text 분리)
bright bg + AA-safe text 색상 분리:

| 용도 | bg | text |
|------|-----|------|
| Warning | `bg-warning-bright/15` (#f59e0b) | `text-ctr-warning` (#B45309) |
| Alert | `bg-alert-red/10` (#ef4444) | `text-destructive` (#e11d48) |
| Success | `bg-tertiary/10` (#16a34a) | `text-[#15803d]` |

### Body Text
`typography.ts` TYPOGRAPHY 상수 사용 — 모두 12px 이상.
- 10px/11px 텍스트는 uppercase 라벨, 테이블 헤더 등 **비본문**에만

## 터치 타겟 (모바일)

Strategy B Tier 1 페이지(출퇴근, 휴가, 결재, 알림, 대시보드)에서 interactive 요소는 최소 44px:

```tsx
<Button className="min-h-[44px]">제출</Button>
```

- MobileBottomNav 기준: `md` breakpoint (768px)
- 데스크톱에서는 기본 크기 유지 가능

## 시맨틱 HTML

- 구조: `<section>`, `<article>`, `<nav>`, `<aside>`, `<header>`, `<footer>`
- 리스트: `<ul>/<ol>/<li>` 우선, 불가 시 `role="list"`
- Form: `<label htmlFor>` 또는 shadcn `FormField` 래퍼
- Button type 명시: `<button type="button">` (form 안에서 기본값이 submit이라 의도치 않은 제출 방지)

## 에러/상태 전달

- 색상만으로 상태 구분 금지 — 아이콘 또는 텍스트 **병행**:
  - ✅ `<AlertCircle className="text-destructive" /> 오류`
  - ❌ `<div className="text-destructive">오류</div>` (색맹 사용자 못 봄)
- Form 에러: inline 메시지 + `aria-invalid` + `aria-describedby`
- Toast: `role="alert"` 자동 (shadcn useToast 사용 시)

## 이미지

- 의미 있는 이미지: `alt="..."` 필수 (Korean OK)
- 장식용: `alt=""` (비워두기 — 스크린 리더 스킵)
- 아바타 폴백: 사용자 이름 `aria-label`

## 금지

- `aria-label` 없는 icon-only button
- 의미 있는 이미지에 `alt=""` 또는 alt 누락
- 색상만으로 상태 전달 (아이콘/텍스트 병행 필수)
- `<div onClick>` (`<button>` 또는 `<Link>` 사용)
- `outline-none` 단독 사용 (focus-visible ring 병행)
- 커스텀 `onKeyDown`으로 Radix 컴포넌트 키보드 내비게이션 오버라이드
- 10px/11px 텍스트를 본문에 사용 (uppercase 라벨 전용)
