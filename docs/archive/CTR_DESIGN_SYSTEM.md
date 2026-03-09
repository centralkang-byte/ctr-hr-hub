# CTR HR Hub 디자인 시스템 (Design System Reference)

> 이 문서는 Claude Code가 모든 STEP UI를 개발할 때 참조하는 디자인 가이드입니다.
> FLEX(플렉스) 스타일 한국 HR SaaS 디자인을 기반으로 추출했습니다.
> **프로젝트 루트의 `CLAUDE.md` 또는 `.claude/design-system.md`에 배치하세요.**

---

## 1. 핵심 디자인 철학

- **밝고 깨끗한 화이트 베이스** — 배경은 `#FAFAFA` ~ `#F5F5F5`, 카드는 순백 `#FFFFFF`
- **최소한의 장식** — 그림자·보더를 억제하고 여백(spacing)으로 구조를 표현
- **초록(Green) 중심의 액션 컬러** — CTA 버튼, 체크, 승인, 진행 중 = 그린
- **정보 밀도가 높되 답답하지 않게** — 테이블·카드·탭을 조합하되 넉넉한 패딩
- **한국어 최적화 타이포그래피** — Pretendard 폰트, -0.02em letter-spacing

---

## 2. 컬러 팔레트

### Primary (Green 계열)
```
--color-primary:       #00C853;   /* 밝은 초록 — CTA 버튼, 토글 ON */
--color-primary-dark:  #00A844;   /* 호버 시 */
--color-primary-light: #E8F5E9;   /* 연한 초록 배경 (성공, 달성) */
--color-primary-50:    #F1F8E9;   /* 아주 연한 초록 하이라이트 */
```

### Semantic Status Colors
```
--color-success:    #00C853;   /* 달성, 승인, 완료 */
--color-warning:    #FF9800;   /* 어려움, 주의 — 오렌지 */
--color-danger:     #F44336;   /* 위험, 반려, 탈락 — 레드 */
--color-info:       #2196F3;   /* 정보, 링크 — 블루 */
--color-purple:     #9C27B0;   /* 보라 — 추천 배지, 특별 태그 */
```

### Neutral / Gray Scale
```
--color-text-primary:    #1A1A1A;   /* 본문 제목 */
--color-text-secondary:  #666666;   /* 부제, 설명 */
--color-text-tertiary:   #999999;   /* 비활성, 힌트 */
--color-text-placeholder:#BDBDBD;   /* placeholder */
--color-border:          #E8E8E8;   /* 카드/테이블 보더 */
--color-border-light:    #F0F0F0;   /* 구분선 */
--color-bg-page:         #FAFAFA;   /* 페이지 배경 */
--color-bg-card:         #FFFFFF;   /* 카드 배경 */
--color-bg-hover:        #F5F5F5;   /* 행 호버 */
--color-bg-selected:     #E3F2FD;   /* 선택된 행 — 연한 블루 */
```

### Status Badge 전용
```
진행 중:   bg: #E8F5E9, text: #2E7D32, border: none
완료/달성: bg: #E8F5E9, text: #00C853
승인:      bg: #E8F5E9, text: #00C853, icon: ✓
승인필요:  bg: #FFEBEE, text: #E53935
반려:      bg: #FFEBEE, text: #F44336
대기중:    bg: #F5F5F5, text: #999999, border: 1px solid #E0E0E0
위험:      bg: #FFF3E0, text: #E65100
```

---

## 3. 타이포그래피

```css
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;

/* 크기 체계 */
--font-size-hero:    28px;  /* 페이지 타이틀 (굵게) */
--font-size-h1:      24px;  /* 섹션 제목 */
--font-size-h2:      20px;  /* 카드 제목 */
--font-size-h3:      16px;  /* 서브 헤딩 */
--font-size-body:    14px;  /* 본문 기본 */
--font-size-small:   13px;  /* 테이블 본문, 보조 텍스트 */
--font-size-caption: 12px;  /* 캡션, 라벨 */
--font-size-badge:   11px;  /* 배지 텍스트 */

/* 굵기 */
--font-weight-bold:     700;  /* 제목 */
--font-weight-semibold: 600;  /* 서브 제목, 배지 */
--font-weight-medium:   500;  /* 강조 본문 */
--font-weight-regular:  400;  /* 기본 본문 */

/* 자간 */
letter-spacing: -0.02em;  /* 한국어 제목에 적용 */

/* 줄간 */
line-height: 1.6;  /* 본문 */
line-height: 1.3;  /* 제목 */
```

---

## 4. 간격(Spacing) 체계

```css
--space-xs:   4px;
--space-sm:   8px;
--space-md:  12px;
--space-lg:  16px;
--space-xl:  20px;
--space-2xl: 24px;
--space-3xl: 32px;
--space-4xl: 40px;
--space-5xl: 48px;

/* 카드 내부 패딩 */
padding: 24px;          /* 기본 카드 */
padding: 20px 24px;     /* 테이블 래퍼 */
padding: 32px;          /* 히어로/대형 카드 */

/* 섹션 간 간격 */
gap: 24px;              /* 카드 그리드 */
margin-bottom: 32px;    /* 섹션 간 */
```

---

## 5. 카드 & 컨테이너

```css
/* 기본 카드 */
.card {
  background: #FFFFFF;
  border: 1px solid #E8E8E8;
  border-radius: 12px;
  padding: 24px;
  box-shadow: none;  /* ← 핵심: 그림자 없음 or 극도로 약하게 */
}

/* 그림자가 필요한 경우 (모달, 드롭다운, 팝오버) */
.elevated {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #F0F0F0;
}

/* 모달 */
.modal {
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
  padding: 32px;
}

/* 페이지 래퍼 */
.page-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}
```

---

## 6. 버튼 시스템

```css
/* Primary CTA — 초록 단색 (그라데이션 아님) */
.btn-primary {
  background: #00C853;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover {
  background: #00A844;
}

/* Secondary — 아웃라인 */
.btn-secondary {
  background: #FFFFFF;
  color: #333333;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
}
.btn-secondary:hover {
  background: #F5F5F5;
}

/* Danger */
.btn-danger {
  background: #FFFFFF;
  color: #F44336;
  border: 1px solid #F44336;
  border-radius: 8px;
}

/* Ghost / Text Button */
.btn-ghost {
  background: transparent;
  color: #666;
  border: none;
  padding: 8px 12px;
}

/* 아이콘 + 텍스트 조합 */
.btn-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
```

---

## 7. 테이블 패턴

```css
/* 테이블 헤더 */
.table-header {
  font-size: 12px;
  font-weight: 600;
  color: #999999;
  text-transform: none;  /* 한국어라 uppercase 안함 */
  padding: 12px 16px;
  border-bottom: 1px solid #E8E8E8;
  background: transparent;  /* 헤더 배경 없음 */
}

/* 테이블 행 */
.table-row {
  padding: 14px 16px;
  border-bottom: 1px solid #F0F0F0;
  font-size: 14px;
  color: #333;
  transition: background 0.15s;
}
.table-row:hover {
  background: #FAFAFA;
}

/* 선택된 행 */
.table-row.selected {
  background: #E3F2FD;
}
```

---

## 8. 탭 네비게이션

```css
/* 스타일 A: 밑줄 탭 (기본) */
.tab {
  font-size: 15px;
  font-weight: 500;
  color: #999;
  padding: 12px 4px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.tab.active {
  color: #1A1A1A;
  font-weight: 700;
  border-bottom: 2px solid #1A1A1A;
}

/* 스타일 B: 필 탭 (필터용) */
.tab-pill {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #E0E0E0;
  background: #FFFFFF;
  color: #666;
}
.tab-pill.active {
  background: #1A1A1A;
  color: #FFFFFF;
  border-color: #1A1A1A;
}
```

---

## 9. 배지(Badge) & 태그(Tag)

```css
/* 상태 배지 */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

/* 기간/사이클 배지 — 아웃라인 스타일 */
.badge-cycle {
  border: 1px solid #E0E0E0;
  background: #FFFFFF;
  color: #666;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
}

/* 추천 배지 */
.badge-recommend {
  background: #E8F5E9;
  color: #00C853;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
}

/* 점수 배지 */
.badge-score {
  background: #F5F5F5;
  color: #333;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
}
```

---

## 10. 인풋 & 폼

```css
/* 텍스트 인풋 */
.input {
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  color: #1A1A1A;
  background: #FFFFFF;
  transition: border-color 0.15s;
  width: 100%;
}
.input:focus {
  border-color: #00C853;
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 200, 83, 0.1);
}

/* 셀렉트 */
.select {
  appearance: none;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 10px 36px 10px 14px;
  font-size: 14px;
  background: #FFFFFF url('chevron-down.svg') right 12px center no-repeat;
}

/* 체크박스 — 초록 체크 */
.checkbox:checked {
  background: #00C853;
  border-color: #00C853;
}

/* 토글 스위치 */
.toggle-on {
  background: #00C853;
}
```

---

## 11. 프로그레스 & 게이지

```css
/* 프로그레스 바 */
.progress-bar {
  height: 8px;
  border-radius: 4px;
  background: #E8E8E8;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 4px;
  /* 그라데이션: 초록 → 청록 */
  background: linear-gradient(90deg, #00C853, #00BFA5);
  transition: width 0.6s ease;
}

/* OKR 진행률 표시 */
.progress-okr {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-okr .value {
  font-size: 14px;
  font-weight: 600;
  color: #1A1A1A;
}
.progress-okr .icon-good { color: #00C853; }     /* ↗ 좋음 */
.progress-okr .icon-difficult { color: #FF9800; } /* ↗ 어려움 */
.progress-okr .icon-danger { color: #F44336; }    /* ↘ 위험 */
```

---

## 12. 채용 퍼널(ATS) 전용 패턴

```css
/* 전형 단계 → 숫자 */
.funnel-stage {
  display: flex;
  align-items: center;
  gap: 8px;
}
.funnel-stage .label {
  font-size: 12px;
  color: #999;
}
.funnel-stage .count {
  font-size: 20px;
  font-weight: 700;
  color: #1A1A1A;
}
.funnel-stage .separator {
  color: #E0E0E0;
  font-size: 16px;
}
/* 접수 24 > 서류평가 3 > Tech 4 > Fit Interview 0 > ... */

/* 중복지원 태그 */
.tag-duplicate {
  background: #FFF3E0;
  color: #E65100;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
}

/* 평가 완료 배지 */
.badge-eval-complete {
  background: #00C853;
  color: #FFFFFF;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
}
```

---

## 13. 평가(Review) 전용 패턴

```css
/* 역량 항목 + 점수 — 왼쪽 컬러 바 */
.competency-item {
  border-left: 4px solid;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.competency-item.score-5 { border-color: #00C853; }
.competency-item.score-4 { border-color: #8BC34A; }
.competency-item.score-3 { border-color: #FF9800; }
.competency-item.score-2 { border-color: #FF5722; }
.competency-item.score-1 { border-color: #F44336; }

/* 최종 등급 카드 (3열 그리드) */
.grade-card {
  border: 1px solid #E8E8E8;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}
.grade-card .label {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
}
.grade-card .grade {
  font-size: 36px;
  font-weight: 700;
  color: #00C853;  /* Outstanding/A: green, B: default, C-: orange/red */
}
.grade-card .score {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

/* 레이더 차트 — recharts 사용 시 */
/* stroke="#00C853" (본인), stroke="#E0E0E0" (평균) */

/* 등급 분포 바 차트 */
/* S등급: #9C27B0 (보라), A등급: #4CAF50 (초록), B등급: #FFD600 (노랑) */
/* C등급: #FF9800 (주황), D등급: #03A9F4 (하늘) */
```

---

## 14. 프로필 카드 패턴

```css
/* 직원 프로필 카드 */
.profile-card {
  display: flex;
  align-items: center;
  gap: 12px;
}
.profile-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #E8E8E8;
  object-fit: cover;
}
.profile-name {
  font-size: 15px;
  font-weight: 700;
  color: #1A1A1A;
}
.profile-role {
  font-size: 13px;
  color: #999;
}
```

---

## 15. 레이아웃 규칙

```
┌─────────────────────────────────────────────┐
│  Header (56px, white, bottom border)         │
├──────────┬──────────────────────────────────┤
│ Sidebar  │  Main Content                     │
│ (220px)  │  ┌─────────────────────────────┐ │
│          │  │ Page Title + Description     │ │
│          │  │ (28px bold, 14px gray desc)  │ │
│          │  ├─────────────────────────────┤ │
│          │  │ Tab Navigation               │ │
│          │  ├─────────────────────────────┤ │
│          │  │ Filter Bar                   │ │
│          │  ├─────────────────────────────┤ │
│          │  │ Content (Cards / Table)      │ │
│          │  └─────────────────────────────┘ │
└──────────┴──────────────────────────────────┘

Detail View (Split):
┌──────────────────────┬──────────────┐
│  Main Content (65%)  │ Side Panel   │
│  (목록/상세/폼)       │ (35%)       │
│                      │ 승인·참조    │
│                      │ 목표 정보    │
│                      │ 활동 내역    │
└──────────────────────┴──────────────┘
```

---

## 16. 아이콘 규칙

- **Lucide React** 사용 (lucide-react)
- 크기: 16px (인라인), 20px (버튼), 24px (네비게이션)
- 색상: `currentColor` (텍스트 색 따라감)
- 스트로크: 1.5px ~ 2px

---

## 17. 애니메이션 규칙

```css
/* 기본 전환 */
transition: all 0.15s ease;

/* 호버 효과는 미세하게 */
transform: none;  /* 카드 호버 시 lift 효과 안 씀 */
background: #FAFAFA;  /* 대신 배경색 변경으로 표현 */

/* 모달 진입 */
animation: fadeIn 0.2s ease;
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 프로그레스 바 */
transition: width 0.6s ease;
```

---

## 18. 반응형 브레이크포인트

```css
--breakpoint-sm:  640px;   /* 모바일 */
--breakpoint-md:  768px;   /* 태블릿 */
--breakpoint-lg:  1024px;  /* 랩탑 */
--breakpoint-xl:  1280px;  /* 데스크탑 */
```

---

## 19. Claude Code 프롬프트 템플릿

각 STEP 개발 시 아래 형식으로 Claude Code에 명령하세요:

```
[STEP_NAME] UI를 구현해줘.

디자인 참조:
- 프로젝트 루트의 CTR_DESIGN_SYSTEM.md 파일을 먼저 읽고 적용해
- FLEX 스타일 한국 HR SaaS 디자인 (깨끗한 화이트, 초록 CTA, 미니멀 보더)
- Pretendard 폰트, 한국어 UI

기술 스택:
- React (JSX, 단일 파일)
- Inline styles (CSS-in-JS 객체)
- Lucide React 아이콘
- Recharts (차트 필요 시)
- 모든 텍스트 한국어

구현할 뷰:
1. [뷰 이름] — [설명]
2. [뷰 이름] — [설명]
...

필수 컴포넌트:
- StatusBadge, Avatar, ProgressBar, TabNav 등은 디자인 시스템 참조
- 목 데이터 포함 (CTR 자동차부품 회사 맥락)
- 사이드바 네비게이션 포함
```

---

## 20. DO / DON'T 체크리스트

### ✅ DO
- 카드 배경 순백(#FFF), 페이지 배경 #FAFAFA
- 보더 1px solid #E8E8E8, 그림자는 모달/드롭다운에만
- CTA 버튼은 #00C853 단색 (그라데이션 아님)
- 테이블 헤더는 회색(#999) 작은 글씨, 데이터는 검정
- 상태 배지는 연한 배경 + 진한 텍스트 조합
- border-radius: 8px (버튼), 12px (카드), 4px (배지)
- 탭 사이 간격 넉넉히 (24px+)
- 프로필 사진은 원형 (border-radius: 50%)

### ❌ DON'T
- box-shadow 남발하지 말 것
- 그라데이션 버튼 사용 금지 (단색이 원칙)
- 화려한 애니메이션 금지 (미세한 전환만)
- 보라색/핑크 과용 금지 (포인트로만)
- 큰 폰트(20px+)를 본문에 쓰지 말 것
- 카드 호버 시 transform: scale 하지 말 것
- 테이블에 줄무늬(stripe) 배경 넣지 말 것
