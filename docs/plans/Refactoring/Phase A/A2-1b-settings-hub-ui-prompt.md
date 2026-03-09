# Phase A2-1b: Settings Hub UI 구현

## 참조 문서 (세션 시작 시 반드시 읽기)
- `CLAUDE.md` — 디자인 토큰, 7섹션 IA 구조, 컬러/타이포/스페이싱
- `CTR_UI_PATTERNS.md` — P13 사이드바 패턴, 카드/폼 패턴
- `context.md` — A2-1 작업 결과 확인
- 사이드바 컴포넌트 현재 구현 — `src/components/layout/Sidebar.tsx` (또는 유사 파일)

---

## 미션

사이드바의 37개 설정 하위 메뉴를 제거하고, 단일 "⚙ 설정" 링크 → `/settings` 허브 페이지(3×2 카드 그리드) → 카테고리별 서브페이지(좌측 사이드 탭) 구조를 구현한다.

> **이 세션은 UI/라우팅/네비게이션만 다룬다.** 각 설정 항목의 실제 폼은 B1~B11에서 구현한다.
> 서브페이지 진입 시 "설정 폼 준비 중" 플레이스홀더를 보여주면 된다.

---

## 전제 조건 (A2-1 완료 상태)
- ✅ employee_assignments 테이블 생성 완료
- ✅ 사이드바 IA 7섹션 리팩토링 완료 (A1)
- ⚠️ 빌드 에러 상태 (A2-3에서 수정 예정 — 이 세션에서는 설정 관련 파일만 빌드 통과 확인)

---

## 작업 1: 사이드바 설정 메뉴 단순화

### Before (현재)
```
▼ 설정
  근무스케줄
  공휴일 관리
  휴가정책
  초과근무 정책
  ... (37개 항목 전체 노출)
```

### After (목표)
```
⚙ 설정          → /settings (허브 페이지로 이동)
```

### 구현
1. 사이드바 NavItem 배열에서 설정 관련 `children` 전체 제거
2. 단일 항목으로 교체:
```typescript
{
  label: '설정',
  icon: Settings, // lucide-react
  href: '/settings',
}
```
3. 기존 설정 개별 라우트(`/settings/work-schedule` 등)는 삭제하지 않음 — 서브페이지에서 접근

---

## 작업 2: 카테고리 데이터 정의

### 파일: `src/lib/settings/categories.ts`

```typescript
import {
  Calendar, BarChart3, Banknote, UserPlus, Building2, Cog,
  type LucideIcon
} from 'lucide-react';

export interface SettingsItem {
  id: string;
  label: string;
  description: string;
}

export interface SettingsCategory {
  id: string;
  icon: LucideIcon;
  label: string;
  labelEn: string;
  href: string;
  items: SettingsItem[];
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'attendance',
    icon: Calendar,
    label: '근태/휴가',
    labelEn: 'Attendance & Leave',
    href: '/settings/attendance',
    items: [
      { id: 'work-schedule', label: '근무스케줄 설정', description: '법인별 기본 근무시간, 유연근무제, 시차출퇴근 패턴 정의' },
      { id: 'holidays', label: '공휴일 관리', description: '법인/국가별 공휴일 캘린더, 대체공휴일 규칙' },
      { id: 'leave-policy', label: '휴가정책', description: '연차/병가/경조사 등 휴가 유형별 부여 규칙, 이월 정책' },
      { id: 'overtime', label: '초과근무 정책', description: '52시간 상한, 연장근로 승인 워크플로, 보상휴가 전환 규칙' },
      { id: 'devices', label: '출퇴근 단말기', description: '태깅 디바이스 등록, 위치 기반 출퇴근 인증 설정' },
      { id: 'alerts-52h', label: '52시간 알림 기준', description: '주간/월간 누적 시간 임계치별 알림 트리거 설정' },
    ]
  },
  {
    id: 'performance',
    icon: BarChart3,
    label: '성과/평가',
    labelEn: 'Performance',
    href: '/settings/performance',
    items: [
      { id: 'eval-cycle', label: '평가사이클', description: '연간/반기/분기 평가 주기, 일정, 단계별 마감 기한' },
      { id: 'mbo', label: 'MBO 설정', description: '목표 수립 규칙, 가중치 범위, 자동 캐스케이딩 옵션' },
      { id: 'cfr', label: 'CFR 주기', description: 'Conversation-Feedback-Recognition 빈도, 리마인더 설정' },
      { id: 'bei', label: 'BEI 역량모델', description: '핵심가치 연계 행동지표(13개) 관리, 직급별 기대 수준' },
      { id: 'calibration', label: '캘리브레이션 규칙', description: '등급 분포 가이드라인, 강제배분 비율, 예외 승인 흐름' },
      { id: 'grade-system', label: '등급체계', description: 'S/A/B/C/D 등급 정의, 점수 구간, 표시 레이블 커스터마이징' },
      { id: 'multi-rater', label: '다면평가 설정', description: '평가자 유형(상향/동료/360), 익명성 수준, 최소 응답자 수' },
    ]
  },
  {
    id: 'compensation',
    icon: Banknote,
    label: '보상/복리후생',
    labelEn: 'Compensation & Benefits',
    href: '/settings/compensation',
    items: [
      { id: 'salary-band', label: '급여밴드', description: '직급/직무별 급여 범위, 시장 데이터 연동 기준' },
      { id: 'raise-matrix', label: '인상매트릭스', description: '성과등급 × 현재 위치(Compa-ratio) 기반 인상률 테이블' },
      { id: 'benefits', label: '복리후생 항목', description: '법인별 복리후생 메뉴, 자격 조건, 신청 기간' },
      { id: 'allowances', label: '수당 정책', description: '직책수당, 자격수당, 교통비 등 수당 유형 및 지급 규칙' },
      { id: 'payroll-integration', label: '외부 급여시스템 연동', description: '급여 데이터 전송 포맷, 마감 스케줄, API 설정' },
    ]
  },
  {
    id: 'recruitment',
    icon: UserPlus,
    label: '채용/온보딩',
    labelEn: 'Recruitment & Onboarding',
    href: '/settings/recruitment',
    items: [
      { id: 'pipeline', label: '채용 파이프라인', description: '8단계 파이프라인 커스터마이징, 단계별 자동화 규칙' },
      { id: 'eval-template', label: '평가기준 템플릿', description: '직무별 면접 평가표, 채점 기준, 합격 컷오프' },
      { id: 'ai-screening', label: 'AI 스크리닝 설정', description: 'AI 이력서 분석 기준, 매칭 가중치, 바이어스 필터' },
      { id: 'onboarding-checklist', label: '온보딩 체크리스트', description: 'Day 1/7/30/90 체크인 항목, 담당자 자동 배정 규칙' },
      { id: 'emotion-pulse', label: '감정펄스 주기', description: '신규 입사자 감정 서베이 빈도, 질문 템플릿, 에스컬레이션 기준' },
    ]
  },
  {
    id: 'organization',
    icon: Building2,
    label: '조직/인사',
    labelEn: 'Organization & HR',
    href: '/settings/organization',
    items: [
      { id: 'entities', label: '법인 관리', description: '6개 법인 기본 정보, 현지 노동법 파라미터, 통화/언어' },
      { id: 'org-chart', label: '조직도 설정', description: '부서 계층 구조, 표시 옵션, 점선 보고 라인' },
      { id: 'job-levels', label: '직급체계', description: 'L1/L2+ 직급 정의, 승진 경로, 직급별 권한 매핑' },
      { id: 'job-family', label: '직무분류', description: '직무군(Job Family), 직무(Job Role) 체계, 역량 연결' },
      { id: 'transfer-rules', label: '전출/전입 규칙', description: '법인 간 이동 워크플로, 필수 문서, 승인 체인' },
      { id: 'personnel-orders', label: '인사발령 유형', description: '승진/전보/휴직/복직 등 발령 유형 및 처리 절차' },
    ]
  },
  {
    id: 'system',
    icon: Cog,
    label: '시스템/연동',
    labelEn: 'System & Integration',
    href: '/settings/system',
    items: [
      { id: 'notifications', label: '알림 설정', description: '채널별(이메일/Teams/인앱) 알림 유형, 빈도, 수신 대상' },
      { id: 'workflow-engine', label: '워크플로 엔진', description: '승인 흐름 템플릿, 조건부 라우팅, 에스컬레이션 규칙' },
      { id: 'module-toggle', label: '모듈 활성화', description: '법인별 사용 모듈 On/Off, 기능 플래그 관리' },
      { id: 'teams', label: 'Teams 연동', description: 'Microsoft Teams 봇 설정, Adaptive Card 템플릿' },
      { id: 'm365', label: 'M365 연동', description: 'Outlook 캘린더 동기화, SharePoint 문서 연결' },
      { id: 'data-migration', label: '데이터 마이그레이션', description: 'i-people 등 레거시 데이터 임포트, 매핑 규칙' },
      { id: 'rbac', label: '역할/권한', description: 'RBAC 역할 정의, 페이지/기능별 접근 제어 매트릭스' },
      { id: 'audit-log', label: '감사로그', description: '로그 보존 기간, 추적 대상 액션, 내보내기 설정' },
    ]
  },
];

// 헬퍼: ID로 카테고리 찾기
export function getCategoryById(id: string): SettingsCategory | undefined {
  return SETTINGS_CATEGORIES.find(c => c.id === id);
}

// 헬퍼: 전체 항목 수
export function getTotalItemCount(): number {
  return SETTINGS_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0);
}
```

---

## 작업 3: 설정 허브 페이지 (3×2 카드 그리드)

### 라우트: `app/settings/page.tsx`

```
┌──────────────────────────────────────────────────┐
│  ⚙ 설정                              🔍 검색...  │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ 📅           │ │ 📊           │ │ 💰           │ │
│  │ 근태/휴가    │ │ 성과/평가    │ │ 보상/복리후생│ │
│  │ 6개 항목     │ │ 7개 항목     │ │ 5개 항목     │ │
│  │ · 근무스케줄 │ │ · 평가사이클 │ │ · 급여밴드   │ │
│  │ · 공휴일관리 │ │ · MBO 설정   │ │ · 인상매트릭스│ │
│  │ · 휴가정책   │ │ · CFR 주기   │ │ · 복리후생   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ 👥           │ │ 🏢           │ │ ⚙           │ │
│  │ 채용/온보딩  │ │ 조직/인사    │ │ 시스템/연동  │ │
│  │ 5개 항목     │ │ 6개 항목     │ │ 8개 항목     │ │
│  │ · 채용파이프 │ │ · 법인 관리  │ │ · 알림 설정  │ │
│  │ · 평가기준   │ │ · 조직도설정 │ │ · 워크플로   │ │
│  │ · AI스크리닝 │ │ · 직급체계   │ │ · 모듈활성화 │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ │
└──────────────────────────────────────────────────┘
```

### 카드 구성요소
- **아이콘**: Lucide 아이콘 (카테고리 데이터에서 참조)
- **카테고리명**: 한글 + 영문 서브텍스트
- **항목 수 배지**: "N개 항목"
- **미리보기**: 상위 3개 항목명을 · 로 나열
- **Hover**: `shadow-md` → `shadow-lg` + `border-l-4 border-[#E1251B]` (CTR Red 액센트)
- **클릭**: 해당 카테고리 서브페이지로 `router.push`

### 검색바
- 허브 상단에 검색 인풋
- 37개 항목의 `label` + `description` 기준 클라이언트 사이드 필터링
- 검색 결과: 매칭 항목을 카테고리 그룹 내에서 하이라이트
- 검색어 입력 시 카드 그리드 → 필터된 리스트 뷰로 전환

### 반응형
```
모바일 (< md):   grid-cols-1
태블릿 (md):     grid-cols-2
데스크탑 (lg+):  grid-cols-3
```

### 스타일 가이드 (CLAUDE.md 준수)
```
카드 배경:       bg-white
카드 보더:       border border-gray-200 rounded-xl
카드 패딩:       p-6
카드 간격:       gap-6
아이콘 크기:     w-10 h-10, bg-gray-50 rounded-lg p-2
카테고리명:      text-lg font-semibold text-gray-900
영문 서브텍스트: text-xs text-gray-400 mt-0.5
항목 수:         text-sm text-gray-500
미리보기 항목:   text-sm text-gray-600
CTR Red 액센트:  #E1251B (hover 보더, 활성 상태)
```

---

## 작업 4: 설정 레이아웃

### 파일: `app/settings/layout.tsx`

설정 영역 공통 래퍼. 메인 사이드바는 그대로 표시되고, 컨텐츠 영역에 설정 전용 헤더(브레드크럼)를 추가한다.

```typescript
// 브레드크럼 예시:
// 허브:     설정
// 서브:     설정 > 근태/휴가
// 항목:     설정 > 근태/휴가 > 근무스케줄 설정
```

---

## 작업 5: 카테고리 서브페이지 (좌측 사이드 탭)

### 라우트: `app/settings/[category]/page.tsx`

```
┌──────────────────────────────────────────────────┐
│  ← 설정으로 돌아가기                              │
│  📅 근태/휴가                                     │
├────────────┬─────────────────────────────────────┤
│            │                                     │
│ ● 근무스케줄│   근무스케줄 설정                    │
│   공휴일관리│   ─────────────────                  │
│   휴가정책  │   법인별 기본 근무시간, 유연근무제,   │
│   초과근무  │   시차출퇴근 패턴을 정의합니다.       │
│   출퇴근단말│                                     │
│   52시간알림│   ┌─────────────────────────────┐   │
│            │   │                              │   │
│            │   │   🚧 설정 폼 준비 중          │   │
│            │   │   Phase B에서 구현 예정       │   │
│            │   │                              │   │
│            │   └─────────────────────────────┘   │
│            │                                     │
├────────────┴─────────────────────────────────────┤
```

### 좌측 사이드 탭 사양

```
너비:            w-60 (240px) — lg 이상
                 모바일에서는 상단 드롭다운(Select)으로 전환
활성 탭:         border-l-4 border-[#E1251B] bg-red-50/50 text-gray-900 font-medium
비활성 탭:       text-gray-600 hover:bg-gray-50 hover:text-gray-900
탭 패딩:         px-4 py-2.5
상단 백 링크:    ← 설정으로 돌아가기 (text-sm text-gray-500 hover:text-gray-700)
카테고리 헤더:   아이콘 + 카테고리명 (text-base font-semibold, mb-4)
구분선:          border-r border-gray-200 (사이드탭과 컨텐츠 구분)
```

### 우측 컨텐츠 영역

```
헤더:            설정 항목 label (text-xl font-semibold)
설명:            설정 항목 description (text-sm text-gray-500 mt-1)
구분선:          border-b border-gray-200 pb-4 mb-6
본문:            플레이스홀더 (이번 세션)
```

### URL 구조 + 기본 선택

```
/settings/attendance              → 첫 번째 항목(work-schedule) 자동 선택
/settings/attendance?tab=holidays → holidays 탭 선택
/settings/performance             → 첫 번째 항목(eval-cycle) 자동 선택
```

- URL 쿼리파라미터 `?tab=` 으로 탭 상태 관리 (새로고침 시 유지)
- 카테고리 ID가 유효하지 않으면 `/settings`로 리다이렉트

### 플레이스홀더 컴포넌트

```typescript
// components/settings/SettingsPlaceholder.tsx
// 각 설정 항목의 실제 폼이 구현되기 전까지 표시
// 아이콘 + "설정 폼 준비 중" + "Phase B에서 구현 예정" 메시지
// CLAUDE.md 의 Empty State 패턴 참조
```

---

## 작업 6: 모바일 반응형

### 허브 페이지
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- 검색바는 항상 full-width

### 서브페이지
```
lg 이상:    좌측 사이드 탭(w-60) + 우측 컨텐츠
md 이하:    상단에 Select 드롭다운 + 하단 컨텐츠 (전체 폭)
```

드롭다운 전환 구현:
```typescript
// useMediaQuery 또는 Tailwind hidden/block으로 처리
<div className="hidden lg:block w-60 ...">
  {/* 사이드 탭 */}
</div>
<div className="lg:hidden mb-4">
  <Select value={activeTab} onValueChange={setActiveTab}>
    {category.items.map(item => (
      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
    ))}
  </Select>
</div>
```

---

## 파일 생성/수정 계획

### 신규 생성
```
src/lib/settings/categories.ts               — 카테고리/항목 데이터 정의
app/settings/page.tsx                         — 설정 허브 (3×2 카드 그리드)
app/settings/layout.tsx                       — 설정 공통 레이아웃 (브레드크럼)
app/settings/[category]/page.tsx              — 카테고리 서브페이지 (사이드탭 + 컨텐츠)
src/components/settings/SettingsCard.tsx       — 허브 카테고리 카드 컴포넌트
src/components/settings/SettingsSideTabs.tsx   — 좌측 사이드 탭 네비게이션
src/components/settings/SettingsPlaceholder.tsx — 폼 미구현 플레이스홀더
src/components/settings/SettingsSearch.tsx     — 허브 검색바 + 필터 로직
```

### 수정
```
src/components/layout/Sidebar.tsx              — 설정 children 37개 → 단일 링크
```

### 삭제 없음
기존 설정 관련 라우트/페이지가 있으면 **삭제하지 않는다** — 서브페이지에서 재활용 가능.

---

## 실행 순서

```
1.  CLAUDE.md, CTR_UI_PATTERNS.md 읽기
2.  context.md에서 A2-1 완료 상태 + 현재 빌드 에러 목록 확인
3.  사이드바 현재 구조 파악 (설정 관련 NavItem 위치 확인)
4.  src/lib/settings/categories.ts 생성
5.  사이드바 설정 메뉴 단순화 (37개 children → 단일 링크)
6.  app/settings/layout.tsx 생성 (브레드크럼 포함)
7.  app/settings/page.tsx 생성 (허브 카드 그리드)
8.  src/components/settings/SettingsCard.tsx 생성
9.  src/components/settings/SettingsSearch.tsx 생성
10. src/components/settings/SettingsSideTabs.tsx 생성
11. src/components/settings/SettingsPlaceholder.tsx 생성
12. app/settings/[category]/page.tsx 생성 (서브페이지)
13. 모바일 반응형 확인 (사이드탭 ↔ 드롭다운 전환)
14. URL 쿼리파라미터 동작 확인 (?tab= 유지)
15. 잘못된 카테고리 ID → /settings 리다이렉트 확인
16. TypeScript 에러 없이 설정 관련 파일 컴파일 확인
```

---

## 주의사항

1. **기존 설정 라우트 보존**: 이전 STEP에서 만든 `/settings/xxx` 페이지가 있다면 삭제 금지. 새 구조와 충돌 시 새 구조 우선 적용하되, 기존 컴포넌트는 별도 보관
2. **디자인 토큰 준수**: CLAUDE.md의 컬러/스페이싱/타이포 토큰 반드시 참조. CTR Red `#E1251B`은 액센트에만 사용
3. **빌드 에러 범위**: 전체 빌드 통과는 A2-3에서 처리. 이 세션에서는 새로 생성하는 설정 관련 파일의 TypeScript 에러만 없으면 OK
4. **폼 구현 금지**: 각 설정 항목의 실제 입력 폼은 이번 세션에서 만들지 않는다. 플레이스홀더만 표시
5. **다국어 고려**: 카테고리 데이터에 `labelEn` 포함. 현재는 한글 우선 표시하되, i18n 확장 가능한 구조 유지
6. **RBAC 검사**: 현재는 모든 카테고리 표시. 추후 권한 없는 카테고리는 disabled 처리 예정 (B 페이즈). 지금은 카드에 `disabled` prop만 타입으로 선언해두기

---

## 완료 기준

- [ ] 사이드바에 "⚙ 설정" 단일 링크만 표시 (37개 제거)
- [ ] `/settings` 진입 시 3×2 카드 그리드 렌더링 (6개 카테고리)
- [ ] 카드 hover 시 CTR Red 액센트 + 그림자 효과
- [ ] 검색바 동작: 키워드 입력 → 매칭 항목 필터 표시
- [ ] 카드 클릭 → `/settings/[category]` 이동
- [ ] 서브페이지: 좌측 사이드 탭 + 우측 플레이스홀더 표시
- [ ] 활성 탭: CTR Red 좌측 보더 + 배경 하이라이트
- [ ] "← 설정으로 돌아가기" 백 네비게이션 동작
- [ ] URL `?tab=` 쿼리파라미터로 탭 상태 유지
- [ ] 잘못된 카테고리 → `/settings` 리다이렉트
- [ ] 모바일: 카드 1열, 사이드탭 → 드롭다운 전환
- [ ] 브레드크럼: 설정 > 카테고리명 > 항목명
- [ ] 새로 생성한 파일 TypeScript 에러 없음
- [ ] context.md 업데이트 완료

---

## 세션 마무리 (반드시 실행)

### context.md 업데이트
세션 완료 후 `context.md`에 아래 내용을 반영한다:

1. **리팩토링 마스터플랜 진행 현황** — A2-1b 상태를 `✅ 완료`로 변경
2. **A2-1b 작업 결과 섹션 추가:**
   - 생성된 파일 목록 (8개 신규 + 1개 수정)
   - 사이드바 변경 내역 (37개 → 1개)
   - 설정 카테고리 6개 × 37개 항목 매핑 완료
   - 기존 설정 라우트 충돌 여부 + 처리 방법
   - 빌드 에러 영향 (신규 파일만 확인)
3. **다음 작업** — A2-2 상태를 `🔄 다음 실행 대기`로 변경
