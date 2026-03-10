# R1: STEP 1 디자인 리팩토링 — 대시보드 + 사이드바 + 구성원 목록

## 세션 목표

STEP 1에서 구현한 **대시보드, 사이드바, 구성원 목록** 페이지를 CTR_DESIGN_SYSTEM.md (FLEX 스타일) 기반으로 리팩토링.
**기능 변경 없음. 비주얼 일관성만 확보.**

---

## 필수 참조 파일 (세션 시작 전 반드시 읽기)

```
1. CLAUDE.md                 → 프로젝트 컨텍스트 + 디자인 토큰
2. CTR_DESIGN_SYSTEM.md      → FLEX 스타일 디자인 시스템 (이것이 타겟)
3. CTR_UI_PATTERNS.md        → UI/UX 패턴 가이드 (P02, P03 중점)
4. context.md                → 현재 파일 구조 참조
```

---

## 리팩토링 대상 파일

| 파일 | 내용 |
|------|------|
| `src/components/layout/Sidebar.tsx` | 사이드바 네비게이션 |
| `src/components/layout/Header.tsx` | 상단 헤더 |
| `src/app/(dashboard)/page.tsx` | 메인 대시보드 |
| `src/app/(dashboard)/employees/page.tsx` | 구성원 목록 |
| `src/app/(dashboard)/employees/EmployeeListClient.tsx` | 구성원 목록 클라이언트 |
| `src/components/ui/*` | 공통 UI 컴포넌트 (Badge, Button, Card 등) |

---

## 핵심 디자인 변경사항

### ⚠️ 디자인 시스템 전환 요약

| 항목 | 기존 (STEP 1~4) | 타겟 (CTR_DESIGN_SYSTEM) |
|------|-----------------|------------------------|
| Primary 컬러 | Blue `#2563EB` | Green `#00C853` |
| 페이지 배경 | `#F8FAFC` (slate-50) | `#FAFAFA` |
| 카드 스타일 | `shadow-sm rounded-xl` | `border border-[#E8E8E8] rounded-xl shadow-none` |
| 버튼 Primary | `bg-blue-600` | `bg-[#00C853] hover:bg-[#00A844]` |
| 테이블 헤더 | `bg-slate-50 uppercase` | `bg-transparent text-[#999] no-uppercase` |
| 테이블 행 호버 | `hover:bg-slate-50` | `hover:bg-[#FAFAFA]` |
| 뱃지 radius | `rounded-full` | `rounded-[4px]` |
| 폰트 | system default | Pretendard, `tracking-[-0.02em]` |
| 인풋 focus | `ring-blue-500` | `border-[#00C853] ring-green` |
| 탭 active | `border-blue-600 text-blue-600` | `border-[#1A1A1A] text-[#1A1A1A] font-bold` |
| 그림자 | 카드에 shadow-sm | 카드는 shadow-none, 모달/드롭다운만 shadow |

---

## 컴포넌트별 상세 지침

### 1. 사이드바 (Sidebar)

**현재:** `bg-slate-900` 다크 사이드바, `w-64`, 활성=`bg-blue-600`
**타겟:** FLEX 스타일 — 밝은 or 다크 유지 가능하나 아래 규칙 적용

```
- 너비: 220px (FLEX 기준) or 기존 w-64 유지 가능
- 활성 메뉴: bg-[#00C853]/10 + text-[#00C853] + 좌측 3px green 인디케이터
- 호버: bg-[#F5F5F5] (라이트) or bg-slate-800 (다크 유지 시)
- 아이콘: 20px lucide-react, strokeWidth 1.5
- 폰트: 14px, active=font-semibold
- 구분선: border-[#E8E8E8] (라이트) or border-slate-700 (다크)
- 법인 선택 드롭다운: 상단 유지
```

**판단 필요:** 사이드바를 라이트(White)로 전환할지 다크(Slate-900) 유지할지.
→ **FLEX는 화이트 사이드바** 사용. 전환 추천하되, 다크 유지도 수용 가능.

라이트 전환 시:
```jsx
// Sidebar
<aside className="w-[220px] bg-white border-r border-[#E8E8E8] h-screen">
  {/* 로고 영역 */}
  <div className="h-14 flex items-center px-5 border-b border-[#F0F0F0]">
    <span className="text-lg font-bold text-[#1A1A1A]">CTR HR Hub</span>
  </div>
  
  {/* 메뉴 */}
  <nav className="p-3 space-y-1">
    {/* 활성 */}
    <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg 
      bg-[#E8F5E9] text-[#00C853] font-semibold text-sm">
      <LayoutDashboard size={20} strokeWidth={1.5} />
      대시보드
    </a>
    {/* 비활성 */}
    <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg 
      text-[#666] hover:bg-[#F5F5F5] text-sm">
      <Users size={20} strokeWidth={1.5} />
      구성원
    </a>
  </nav>
</aside>
```

### 2. 상단 헤더 (Header)

```
- 높이: h-14 (56px)
- 배경: bg-white
- 하단 보더: border-b border-[#E8E8E8]
- 좌측: 브레드크럼 (text-xs text-[#999])
- 우측: 검색 + 알림 벨 + 프로필 아바타
- 그림자: 없음
```

```jsx
<header className="h-14 bg-white border-b border-[#E8E8E8] 
  flex items-center justify-between px-6">
  <div>
    <nav className="text-xs text-[#999]">대시보드</nav>
  </div>
  <div className="flex items-center gap-4">
    <button className="text-[#999] hover:text-[#666]">
      <Search size={20} strokeWidth={1.5} />
    </button>
    <button className="relative text-[#999] hover:text-[#666]">
      <Bell size={20} strokeWidth={1.5} />
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#F44336] rounded-full" />
    </button>
    <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
  </div>
</header>
```

### 3. 대시보드 페이지 — 패턴 P02 (KPI 카드 그리드)

**페이지 구조:**
```
┌─────────────────────────────────────────┐
│ 페이지 제목 (28px bold) + 설명 (14px gray) │
├─────────────────────────────────────────┤
│ KPI 카드 4열 그리드                       │
├─────────────────────────────────────────┤
│ 차트 영역 (2열 그리드)                    │
├─────────────────────────────────────────┤
│ 최근 활동 / 할 일 목록                    │
└─────────────────────────────────────────┘
```

**KPI 카드:**
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">전체 구성원</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">1,247</p>
    <div className="flex items-center gap-1 mt-2">
      <span className="text-xs font-semibold text-[#00C853]">↑ 3.2%</span>
      <span className="text-xs text-[#999]">전월 대비</span>
    </div>
  </div>
</div>
```

**차트 영역:**
```
- Recharts 사용
- 2열 그리드: grid grid-cols-1 lg:grid-cols-2 gap-6
- 차트 카드: bg-white border border-[#E8E8E8] rounded-xl p-6
- 차트 색상: primary=#00C853, secondary=#2196F3, warning=#FF9800
- 호버 툴팁: bg-white shadow-lg rounded-lg p-3
```

### 4. 구성원 목록 — 패턴 P03 (데이터 테이블 + 필터 바)

**페이지 헤더:**
```jsx
<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-[28px] font-bold text-[#1A1A1A] tracking-[-0.02em]">
      구성원 관리
    </h1>
    <p className="text-sm text-[#999] mt-1">총 1,247명의 구성원을 관리합니다</p>
  </div>
  <div className="flex items-center gap-3">
    <button className="bg-white border border-[#E0E0E0] text-[#333] 
      px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#F5F5F5]">
      내보내기
    </button>
    <button className="bg-[#00C853] hover:bg-[#00A844] text-white 
      px-4 py-2.5 rounded-lg text-sm font-semibold">
      + 구성원 추가
    </button>
  </div>
</div>
```

**필터 바:**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-4 mb-4">
  <div className="flex items-center gap-3">
    {/* 검색 */}
    <div className="relative w-64">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BDBDBD]" />
      <input 
        className="w-full pl-9 pr-3 py-2 border border-[#E0E0E0] rounded-lg text-sm
          focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
        placeholder="이름, 사번으로 검색"
      />
    </div>
    
    {/* 필터 드롭다운 */}
    <button className="flex items-center gap-2 px-3 py-2 border border-[#E0E0E0] 
      rounded-lg text-sm text-[#666] hover:bg-[#F5F5F5]">
      <SlidersHorizontal size={16} /> 필터
    </button>
  </div>
  
  {/* 활성 필터 칩 */}
  <div className="flex items-center gap-2 mt-3">
    <span className="inline-flex items-center gap-1 px-3 py-1 
      bg-[#F5F5F5] rounded-full text-xs text-[#666]">
      제품팀 <X size={12} className="cursor-pointer" />
    </span>
  </div>
</div>
```

**테이블:**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-[#E8E8E8]">
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">
          <input type="checkbox" className="w-4 h-4 rounded accent-[#00C853]" />
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">이름</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">부서</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">직급</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">상태</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">액션</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
        <td className="px-4 py-3.5">
          <input type="checkbox" className="w-4 h-4 rounded accent-[#00C853]" />
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">김상우</p>
              <p className="text-xs text-[#999]">EMP-001</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5 text-sm text-[#333]">인사팀</td>
        <td className="px-4 py-3.5 text-sm text-[#333]">과장</td>
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center px-2.5 py-0.5 
            rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold">
            재직중
          </span>
        </td>
        <td className="px-4 py-3.5">
          <button className="text-[#999] hover:text-[#666]">
            <MoreHorizontal size={16} />
          </button>
        </td>
      </tr>
    </tbody>
  </table>
  
  {/* 페이지네이션 */}
  <div className="flex items-center justify-between px-4 py-3 border-t border-[#E8E8E8]">
    <span className="text-xs text-[#999]">1-20 / 1,247건</span>
    <div className="flex items-center gap-1">
      <button className="px-3 py-1.5 text-xs border border-[#E0E0E0] rounded-lg 
        hover:bg-[#F5F5F5]">이전</button>
      <button className="px-3 py-1.5 text-xs bg-[#1A1A1A] text-white rounded-lg">1</button>
      <button className="px-3 py-1.5 text-xs border border-[#E0E0E0] rounded-lg 
        hover:bg-[#F5F5F5]">2</button>
      <button className="px-3 py-1.5 text-xs border border-[#E0E0E0] rounded-lg 
        hover:bg-[#F5F5F5]">다음</button>
    </div>
  </div>
</div>
```

### 5. 상태 뱃지 (공통 컴포넌트)

```jsx
// FLEX 스타일 — rounded-[4px], 그림자 없음
const STATUS_STYLES = {
  재직중:   'bg-[#E8F5E9] text-[#2E7D32]',
  휴직:     'bg-[#F5F5F5] text-[#999] border border-[#E0E0E0]',
  퇴직:     'bg-[#FFEBEE] text-[#E53935]',
  수습:     'bg-[#FFF3E0] text-[#E65100]',
  승인:     'bg-[#E8F5E9] text-[#00C853]',
  반려:     'bg-[#FFEBEE] text-[#F44336]',
  대기중:   'bg-[#F5F5F5] text-[#999] border border-[#E0E0E0]',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 
      rounded text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
```

---

## 리팩토링 체크리스트

### 컬러 전환
- [ ] Primary 버튼: `bg-blue-600` → `bg-[#00C853] hover:bg-[#00A844]`
- [ ] Secondary 버튼: `border-slate-300` → `border-[#E0E0E0]`
- [ ] 페이지 배경: `bg-slate-50` → `bg-[#FAFAFA]`
- [ ] 카드: `shadow-sm` 제거 → `border border-[#E8E8E8]` only
- [ ] 인풋 focus: `ring-blue-500` → `border-[#00C853] ring-[#00C853]/10`
- [ ] 텍스트 primary: `text-slate-900` → `text-[#1A1A1A]`
- [ ] 텍스트 secondary: `text-slate-500` → `text-[#999]`
- [ ] 텍스트 body: `text-slate-700` → `text-[#333]`

### 사이드바
- [ ] 다크 → 라이트 전환 (bg-white + border-r)
- [ ] 활성 메뉴: blue → green (`bg-[#E8F5E9] text-[#00C853]`)
- [ ] 너비: w-64 → w-[220px]
- [ ] 메뉴 아이콘: strokeWidth 1.5

### 헤더
- [ ] 높이: h-14 (56px)
- [ ] 그림자 제거, border-b만
- [ ] 프로필/알림 아이콘 정리

### 대시보드 (P02)
- [ ] KPI 카드: shadow 제거, border만
- [ ] KPI 숫자: font-bold + tracking-[-0.02em]
- [ ] 변동 표시: green(↑)/red(↓)/gray(─)
- [ ] 차트 색상: #00C853 기반 팔레트
- [ ] 차트 카드: border border-[#E8E8E8] rounded-xl p-6

### 구성원 목록 (P03)
- [ ] 테이블 헤더: bg 제거, text-xs text-[#999] font-semibold, uppercase 제거
- [ ] 테이블 행: hover:bg-[#FAFAFA], border-b border-[#F0F0F0]
- [ ] 체크박스: accent-[#00C853]
- [ ] 뱃지: rounded → rounded-[4px]
- [ ] 필터 칩: bg-[#F5F5F5] rounded-full
- [ ] 빈 상태: 일러스트 + "결과 없음"

### 공통 UI 컴포넌트
- [ ] Button: primary/secondary/danger/ghost 전부 전환
- [ ] Badge: 색상 + border-radius 전환
- [ ] Card: shadow-sm 제거
- [ ] Input: focus 링 green 전환
- [ ] Tab: active 스타일 전환 (blue → black underline)

---

## Tailwind 커스텀 설정 추가 (필요 시)

```js
// tailwind.config.ts — extend에 추가
extend: {
  colors: {
    ctr: {
      primary: '#00C853',
      'primary-dark': '#00A844',
      'primary-light': '#E8F5E9',
      danger: '#F44336',
      warning: '#FF9800',
      info: '#2196F3',
      text: '#1A1A1A',
      'text-secondary': '#666666',
      'text-muted': '#999999',
      border: '#E8E8E8',
      'border-light': '#F0F0F0',
      bg: '#FAFAFA',
    }
  },
  fontFamily: {
    sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  },
  letterSpacing: {
    korean: '-0.02em',
  }
}
```

---

## ⚠️ 주의사항

1. **기능 변경 금지** — 상태 관리, API 호출, 라우팅 로직 일체 건드리지 않음
2. **변경하지 말아야 할 파일** — context.md의 "변경하지 말아야 할 파일" 목록 준수
3. **Pretendard 폰트** — `next/font`로 로딩하거나, `<link>` 태그로 CDN 추가
4. **점진적 적용** — 공통 컴포넌트(`src/components/ui/`)부터 변경 → 페이지에 전파
5. **STEP 2~4는 건드리지 않음** — R2~R4에서 별도 처리
6. **타입체크 유지** — 리팩 후 `npx tsc --noEmit` 0 errors 확인

---

## 실행 순서 (권장)

```
1. tailwind.config.ts에 ctr 커스텀 컬러 추가
2. Pretendard 폰트 설정
3. src/components/ui/ 공통 컴포넌트 리팩 (Button, Badge, Card, Input, Tab)
4. src/components/layout/Sidebar.tsx 리팩
5. src/components/layout/Header.tsx 리팩
6. 대시보드 페이지 리팩 (KPI + 차트)
7. 구성원 목록 페이지 리팩 (테이블 + 필터)
8. 타입체크 + 비주얼 검증
```
