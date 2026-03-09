# CTR HR Hub — CLAUDE.md
> Claude Code가 참조하는 **단일 진실 공급원** — 디자인 토큰 + 프로젝트 스펙.
> CTR_UI_PATTERNS.md와 함께 사용.

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| 프로젝트명 | CTR HR Hub |
| 대상 | 글로벌 자동차부품 제조사 (6개국, 1000–3000명) |
| 법인 | CTR-KR, CTR-CN, CTR-RU, CTR-US, CTR-VN, CTR-MX |
| 스택 | Next.js 14+ (App Router) + Supabase + PostgreSQL + Prisma ORM |
| 스타일 | Tailwind CSS + Pretendard 폰트 |
| UI 참조 | FLEX HR, Workday |

### 핵심가치 (Value System 2.0)
| 가치 | 영문 | 행동지표 수 |
|------|------|------------|
| 도전 | Challenge | 4 |
| 신뢰 | Trust | 3 |
| 책임 | Responsibility | 3 |
| 존중 | Respect | 3 |

> BEI 행동지표는 하드코딩 금지 — 설정 가능하게 설계

---

## 2. 핵심 데이터 모델

### EmployeeAssignment (Effective Dating 패턴)

A2-1에서 아래 8개 필드가 `Employee`에서 제거되어 `EmployeeAssignment`로 이동:
```
companyId, departmentId, jobGradeId, jobCategoryId
managerId, employmentType, contractType, status
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

### 쿼리 패턴
```typescript
// WHERE — 현재
where: { assignments: { some: { companyId: 'xxx', status: 'ACTIVE', isPrimary: true, endDate: null } } }

// INCLUDE — 현재
include: { assignments: { where: { isPrimary: true, endDate: null }, take: 1, include: { department: true } } }

// 프로퍼티 접근
employee.assignments?.[0]?.companyId
// Prisma 타입 추론 실패 시
(employee.assignments?.[0] as any)?.companyId as string | undefined
```

### 헬퍼 (src/lib/assignments.ts)
- `getCurrentAssignment(employeeId)` — 현재 primary assignment
- `createAssignment(data)` — 이전 assignment 종료 + 신규 생성 (트랜잭션)
- `getDirectReports(employeeId)` — Position 계층 기반
- `getManagerByPosition(employeeId)` — Position 계층 기반

---

## 3. 사이드바 IA

### 7섹션 구조 (v2 확정)

| # | 섹션 | 키 | 아이콘 | 접근 역할 |
|---|------|----|--------|----------|
| 1 | 홈 | `home` | Home | 전체 |
| 2 | 나의 공간 | `my-space` | User | 전체 |
| 3 | 팀 관리 | `team` | Users | MANAGER, EXECUTIVE, HR_ADMIN, SUPER_ADMIN |
| 4 | 인사 운영 | `hr-ops` | Building2 | HR_ADMIN, SUPER_ADMIN |
| 5 | 인재 관리 | `talent` | UserCheck | HR_ADMIN, SUPER_ADMIN |
| 6 | 인사이트 | `insights` | BarChart3 | HR_ADMIN, SUPER_ADMIN (전체) / MANAGER, EXECUTIVE (일부) |
| 7 | 설정 | `settings` | Settings | HR_ADMIN, SUPER_ADMIN |

### 역할별 가시성
| 역할 | 홈 | 나의 공간 | 팀 관리 | 인사 운영 | 인재 관리 | 인사이트 | 설정 |
|------|-----|----------|---------|----------|----------|---------|------|
| EMPLOYEE | ✅ | ✅ | — | — | — | — | — |
| MANAGER | ✅ | ✅ | ✅ | — | — | 일부 | — |
| EXECUTIVE | ✅ | ✅ | ✅ | — | — | 일부 | — |
| HR_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 네비게이션 아키텍처
```
src/config/navigation.ts          — 7섹션 메뉴 구조 정의
src/hooks/useNavigation.ts        — 역할 기반 필터링 훅
src/components/layout/Sidebar.tsx  — config 기반 렌더링
```

```typescript
type NavSection = {
  key: string;
  labelKey: string;    // i18n 키 (nav.{sectionKey})
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

## 4. 디자인 철학

- **화이트 베이스** — 페이지 `#FAFAFA`, 카드 `#FFFFFF`
- **최소 장식** — 그림자·보더 억제, 여백으로 구조 표현
- **초록 액션 컬러** — CTA, 체크, 승인, 진행 중 = `#00C853`
- **정보 밀도** — 테이블·카드·탭 조합, 넉넉한 패딩
- **한국어 타이포** — Pretendard, letter-spacing `-0.02em`

---

## 5. 디자인 토큰

### 5.1 컬러

#### 브랜드
```
primary:        #00C853    /* Green CTA */
primary-dark:   #00A844    /* hover */
primary-light:  #E8F5E9    /* 연한 배경 */
primary-50:     #F1F8E9    /* 하이라이트 */
```

#### 시맨틱
```
success:        #059669    /* 완료, 승인, 달성 */
success-light:  #D1FAE5

warning-bg:     #FEF3C7    /* 주의 배경 */
warning-icon:   #F59E0B    /* 주의 아이콘 */
warning-text:   #B45309    /* 주의 텍스트 */

danger:         #EF4444    /* 오류, 반려, 위험 */
danger-light:   #FEE2E2

info:           #4338CA    /* AI 추천, 정보 */
info-light:     #E0E7FF
```

#### 중립
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

#### 상태 뱃지
```
진행중:   bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]
대기:     bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]
반려:     bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]
완료:     bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]
초안:     bg-[#FAFAFA] text-[#555] border-[#E8E8E8]
AI추천:   bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]
위험:     bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]
```

#### 차트 팔레트
```
#00C853, #059669, #F59E0B, #8B5CF6, #EC4899, #06B6D4
```

#### 등급 분포 (성과 차트)
```
S: #9C27B0  A: #4CAF50  B: #FFD600  C: #FF9800  D: #03A9F4
```

### 5.2 타이포그래피

| 용도 | Tailwind 클래스 | weight |
|------|----------------|--------|
| 페이지 제목 | text-2xl | font-bold |
| 섹션 제목 | text-lg | font-semibold |
| 카드 제목 | text-base | font-semibold |
| 본문 | text-sm (14px) | font-normal |
| 테이블 본문 | text-[13px] | font-normal |
| 캡션 | text-xs (12px) | font-normal |
| 뱃지 | text-[11px] | font-semibold |
| KPI 숫자 | text-3xl~4xl | font-bold |
| 사이드바 섹션 헤더 | text-[11px] uppercase tracking-wider | font-semibold |

> 한국어 제목: `tracking-[-0.02em]`

### 5.3 스페이싱

| 요소 | 값 |
|------|-----|
| 페이지 패딩 | p-6 (24px) |
| 카드 패딩 | p-5~6 (20~24px) |
| 카드 간격 | gap-4~6 |
| 섹션 간격 | space-y-6 / mb-8 |
| 폼 필드 간격 | space-y-4 |
| 인라인 간격 | gap-2~3 |
| 사이드바 섹션 간격 | mt-6 |

### 5.4 보더 & 모서리

```
카드:     rounded-xl border border-[#E8E8E8]  (shadow 없음)
모달:     shadow-xl rounded-2xl               (모달만 shadow)
드롭다운: shadow-lg rounded-lg border border-[#E8E8E8]
버튼:     rounded-lg (8px)
뱃지:     rounded-full 또는 rounded (4px)
인풋:     rounded-lg border border-[#D4D4D4] focus:ring-2 focus:ring-[#00C853]/10
프로필:   rounded-full (원형)
```

### 5.5 사이드바
```
너비:         w-64 (축소 시 w-16)
배경:         bg-[#111] (다크)
섹션 헤더:    text-[11px] font-semibold uppercase tracking-wider text-[#888] px-4 mt-6 mb-2
활성 항목:    bg-[#00C853] text-white rounded-lg
호버:         bg-[#222]
아이콘:       20px, lucide-react
섹션 구분선:  border-t border-[#333] mx-3
comingSoon:   text-[#666] cursor-not-allowed + Lock 아이콘
```

### 5.6 애니메이션
```
기본 전환:   transition-colors duration-150
모달 진입:   fadeIn 0.2s — opacity 0→1, translateY 8px→0
프로그레스:  transition-[width] duration-600
호버:        배경색 변경만 (transform 없음)
```

---

## 6. 컴포넌트 스펙

### 버튼
| 타입 | Tailwind 클래스 |
|------|----------------|
| Primary | `bg-[#00C853] hover:bg-[#00A844] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors` |
| Secondary | `bg-white border border-[#D4D4D4] hover:bg-[#F5F5F5] text-[#333] px-4 py-2 rounded-lg font-medium text-sm transition-colors` |
| Danger | `bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors` |
| Ghost | `hover:bg-[#F5F5F5] text-[#555] px-3 py-2 rounded-lg text-sm transition-colors` |
| 승인 | `bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-lg font-semibold text-sm` |
| 반려 | `border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] px-4 py-2 rounded-lg text-sm` |

> 아이콘+텍스트 조합: `inline-flex items-center gap-1.5`

### KPI 카드
```jsx
<div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
  <p className="text-xs text-[#666] mb-1">{label}</p>
  <p className="text-3xl font-bold text-[#1A1A1A] tracking-tight">{value}</p>
  <span className="text-xs text-[#059669]">↑ {change}%</span>
</div>
```

### 테이블
```
헤더:  bg-transparent text-[13px] text-[#999] font-semibold px-4 py-3 border-b border-[#E8E8E8]
행:    border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors
셀:    px-4 py-3.5 text-sm text-[#333]
선택행: bg-[#E3F2FD]
```

### 뱃지
```jsx
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold
  bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]">
  {status}
</span>
```

> 기간/사이클 뱃지: `border border-[#E0E0E0] bg-white text-[#666] rounded text-xs px-2 py-0.5`

### 탭
```jsx
{/* 밑줄 탭 (기본) */}
<div className="flex border-b border-[#E8E8E8] gap-6">
  <button className="pb-2.5 text-sm font-bold text-[#1A1A1A] border-b-2 border-[#1A1A1A]">활성</button>
  <button className="pb-2.5 text-sm font-medium text-[#999] hover:text-[#333]">비활성</button>
</div>

{/* 필 탭 (필터용) */}
<button className="px-3.5 py-1.5 rounded-full text-xs border border-[#E0E0E0] bg-white text-[#666]">기본</button>
<button className="px-3.5 py-1.5 rounded-full text-xs bg-[#1A1A1A] text-white border-[#1A1A1A]">활성</button>
```

### 인풋 & 폼
```
라벨:     text-sm font-medium text-[#333] mb-1
인풋:     w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
          focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#BDBDBD]
셀렉트:   appearance-none + 동일 인풋 스타일
토글:     w-10 h-5 rounded-full bg-[#E8E8E8] → bg-[#00C853] transition-colors
체크박스: w-4 h-4 rounded border-[#D4D4D4] text-[#00C853]
```

### 모달
```
사이즈: sm(max-w-md) md(max-w-lg) lg(max-w-2xl) xl(max-w-4xl) full(max-w-6xl)
오버레이: bg-black/50 backdrop-blur-sm
구조: 헤더(제목+X버튼) → 바디(overflow-y-auto) → 푸터(액션버튼)
```

### 프로그레스 바
```jsx
<div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
  <div
    className="h-full rounded-full transition-[width] duration-600"
    style={{ width: `${value}%`, background: 'linear-gradient(90deg, #00C853, #00BFA5)' }}
  />
</div>
```

### 승인 워크플로
```
스텝:   세로 타임라인 — 아바타 + 이름 + 역할 + 상태뱃지
상태:   대기중(회색) / 진행중(그린) / 승인(초록) / 반려(빨강)
액션:   승인(초록 fill) + 반려(빨강 outline) 쌍
```

### 역량 점수 (왼쪽 컬러 바)
```jsx
<div className="border-l-4 border-[#00C853] pl-4 py-2 mb-4">  {/* 5점 */}
  {/* border-[#8BC34A]=4, border-[#F59E0B]=3, border-[#FF5722]=2, border-[#EF4444]=1 */}
</div>
```

### 프로필 카드
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

## 7. 레이아웃 규칙

```
헤더:     h-14 bg-white border-b border-[#E8E8E8]
사이드바:  w-64 bg-[#111]
메인:     flex-1 bg-[#FAFAFA] p-6

페이지 구조:
  페이지 제목 (text-2xl font-bold)
  설명 (text-sm text-[#666])
  ↓
  탭 네비게이션
  ↓
  필터 바
  ↓
  콘텐츠 (카드 그리드 또는 테이블)

상세 뷰 (Split):
  좌: 65% (목록/상세/폼)
  우: 35% (승인·참조·활동 내역)
```

---

## 8. DO / DON'T

### ✅ DO
- 카드 배경 `#FFF`, 페이지 배경 `#FAFAFA`
- 보더 `1px solid #E8E8E8`, 그림자는 모달/드롭다운에만
- CTA 버튼은 `#00C853` 단색 (그라데이션 ❌)
- 테이블 헤더는 `#999` 작은 글씨, 데이터는 `#333`
- 상태 뱃지 = 연한 배경 + 진한 텍스트
- `rounded-lg`(버튼) / `rounded-xl`(카드) / `rounded-full`(뱃지/아바타)
- 탭 간격 gap-6 이상

### ❌ DON'T
- `box-shadow` 남발
- 그라데이션 버튼
- 화려한 애니메이션 (미세 전환만)
- 보라/핑크 과용 (포인트만)
- 본문에 20px+ 폰트
- 카드 호버 `transform: scale`
- 테이블 줄무늬(stripe) 배경

---

## 9. RBAC

### 역할 (5개)
```
SUPER_ADMIN — 전체 접근
HR_ADMIN    — Settings 포함
MANAGER     — 팀 관리
EMPLOYEE    — 일반
EXECUTIVE   — 임원
```

### 모듈 (19개)
```
employees, org, attendance, leave, recruitment, performance, payroll,
compensation, offboarding, discipline, benefits, analytics, onboarding,
training, pulse, succession, hr_chatbot, teams, compliance, settings
```

### 권한 로직
```
SUPER_ADMIN → 전체
HR_ADMIN    → settings 포함
기타        → permissions 배열에서 module + action('read') 매칭
```

### DB 테이블
```
roles            — id, code, name, is_system
role_permissions — role_id, permission_id
employee_roles   — employee_id, role_id, company_id, start_date, end_date
```

---

## 10. 아이콘 (lucide-react)

| 용도 | 아이콘 | 용도 | 아이콘 |
|------|--------|------|--------|
| 대시보드 | LayoutDashboard | 검색 | Search |
| 구성원 | Users | 필터 | SlidersHorizontal |
| 근태 | Clock | 추가 | Plus |
| 휴가 | CalendarDays | 편집 | Pencil |
| 채용 | UserPlus | 삭제 | Trash2 |
| 성과 | Target | 다운로드 | Download |
| 1on1 | MessageSquare | AI | Bot, Sparkles |
| 분석 | BarChart3 | 위험 | AlertTriangle |
| 설정 | Settings | 승인 | CheckCircle2 |
| 알림 | Bell | 반려 | XCircle |
| 나의 공간 | User | 팀 관리 | Users |
| 인사 운영 | Building2 | 인재 관리 | UserCheck |
| comingSoon | Lock | — | — |

> 크기: 16px(인라인) / 20px(버튼) / 24px(네비게이션)
> 색상: `currentColor` / 스트로크: 1.5~2px

---

## 11. 코딩 컨벤션

### 파일 구조
```
src/app/(dashboard)/       — 사이드바+헤더 공통 레이아웃
src/config/navigation.ts   — 7섹션 메뉴 구조
src/hooks/useNavigation.ts — 역할 기반 네비게이션 훅
src/components/layout/     — Sidebar, Header
src/components/ui/         — 재사용 기본 컴포넌트
src/components/[module]/   — 모듈별
src/lib/supabase/          — Supabase 래핑
src/lib/assignments.ts     — EmployeeAssignment 헬퍼
src/lib/constants.ts       — ROLE, MODULE, ACTION 상수
src/types/                 — 타입 정의
```

### 네이밍
```
컴포넌트: PascalCase       유틸: camelCase
상수:     UPPER_SNAKE_CASE  DB컬럼: snake_case
타입:     PascalCase + Row/Insert 접미사
i18n 키:  nav.{sectionKey}.{itemKey}
```

### 원칙
- 단일 파일 컴포넌트 우선, 크기 초과 시 분리
- `'use client'` 명시적 사용
- 시드 데이터: 항상 6개 법인 구조 반영
- 한국어 UI, i18n key는 영문
- Prisma ORM 전용 (raw SQL 금지)
- DB 직접 조작 금지 — 반드시 Prisma 통해서

---

## 12. 기술적 제약
- 급여: 외부 연동 (직접 구현 안 함)
- 한국 우선 → 글로벌 확장
- Data Localization 요구 (법인별 데이터 격리)
- 52시간 준수 로직 필수 (CTR-KR)
- MS Teams 연동 예정 (Adaptive Cards, Bot Framework)
- CTR 직급: L1(매니저)/L2(책임매니저)+리더직책 (향후 확장 예정)
