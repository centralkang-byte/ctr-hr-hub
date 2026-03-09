# R2: STEP 2 디자인 리팩토링 — 구성원 상세 프로필

## 세션 목표

STEP 2에서 구현한 **구성원 상세 프로필 (5탭), 구성원 신규 등록, 조직도** 페이지를 CTR_DESIGN_SYSTEM.md (FLEX 스타일) 기반으로 리팩토링.
**기능 변경 없음. 비주얼 일관성만 확보.**
**R1에서 적용한 공통 컴포넌트(Button, Badge, Card, Input, Tab, Sidebar, Header)를 그대로 사용.**

---

## 필수 참조 파일

```
1. CLAUDE.md                 → 프로젝트 컨텍스트 + 디자인 토큰
2. CTR_DESIGN_SYSTEM.md      → FLEX 스타일 디자인 시스템 (타겟)
3. CTR_UI_PATTERNS.md        → P01, P04, P05 중점
4. context.md                → 파일 구조 참조
5. R1 결과물                  → 공통 UI 컴포넌트 변경사항 확인
```

---

## 리팩토링 대상 파일

| 파일 | 내용 |
|------|------|
| `src/app/(dashboard)/employees/[id]/page.tsx` | 구성원 상세 서버 |
| `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx` | 구성원 상세 5탭 클라이언트 |
| `src/app/(dashboard)/employees/new/page.tsx` | 신규 등록 서버 |
| `src/app/(dashboard)/employees/new/EmployeeNewClient.tsx` | 신규 등록 폼 클라이언트 |
| `src/app/(dashboard)/org/page.tsx` | 조직도 서버 |
| `src/app/(dashboard)/org/OrgClient.tsx` | 조직도 클라이언트 (React Flow) |
| `src/app/(dashboard)/settings/org-changes/page.tsx` | 조직변경 이력 |
| `src/app/(dashboard)/settings/org-changes/OrgChangesClient.tsx` | 조직변경 이력 클라이언트 |

---

## 핵심 패턴 매핑

| 패턴 | 적용 위치 |
|------|----------|
| **P01** 마스터-디테일 레이아웃 | 구성원 목록 → 상세 전환 구조 |
| **P04** 프로필 사이드바 | 구성원 상세 좌측 프로필 영역 |
| **P05** 승인 워크플로 패널 | 인사발령/변경 승인 (해당 시) |
| **P11** 트리형 조직도 | 조직도 페이지 |

---

## 컴포넌트별 상세 지침

### 1. 구성원 상세 — 페이지 레이아웃 (P01 + P04)

**현재:** 단일 컬럼 탭 구조
**타겟:** 좌측 프로필 사이드바 + 우측 탭 콘텐츠 (마스터-디테일)

```
┌──────────────────────────────────────────────┐
│ ← 구성원 목록    구성원 상세        [편집] [⋮] │
├──────────────┬───────────────────────────────┤
│ 프로필 사이드바 │ 탭 네비게이션                  │
│ (w-72~80)    │ [기본정보│경력│문서│발령│활동]   │
│              ├───────────────────────────────┤
│ [아바타 72px] │ 탭 콘텐츠 영역                 │
│ 김상우        │                              │
│ 인사팀 · 과장  │                              │
│              │                              │
│ ────────     │                              │
│ 📧 이메일     │                              │
│ 📱 연락처     │                              │
│ 📅 입사일     │                              │
│ ────────     │                              │
│ 근속 4년11개월 │                              │
│ 이직위험 ■■□ 중│                              │
└──────────────┴───────────────────────────────┘
```

**프로필 사이드바 (P04):**
```jsx
<aside className="w-72 border-r border-[#E8E8E8] bg-white p-6 flex-shrink-0">
  {/* 아바타 + 이름 */}
  <div className="text-center mb-6">
    <div className="w-[72px] h-[72px] rounded-full bg-[#E8E8E8] mx-auto mb-3" />
    <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">김상우</h2>
    <p className="text-sm text-[#999] mt-0.5">인사팀 · 과장</p>
    <span className="inline-flex items-center px-2.5 py-0.5 mt-2
      rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold">
      재직중
    </span>
  </div>

  {/* 연락처 섹션 */}
  <div className="divide-y divide-[#F0F0F0]">
    <div className="py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-[#999]" strokeWidth={1.5} />
        <span className="text-sm text-[#333]">sangwoo@ctr.com</span>
      </div>
      <div className="flex items-center gap-2">
        <Phone size={16} className="text-[#999]" strokeWidth={1.5} />
        <span className="text-sm text-[#333]">010-1234-5678</span>
      </div>
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-[#999]" strokeWidth={1.5} />
        <span className="text-sm text-[#333]">2021.04.01 입사</span>
      </div>
    </div>

    {/* 근속 + 이직위험 */}
    <div className="py-4 space-y-3">
      <div>
        <p className="text-xs text-[#999] mb-1">근속기간</p>
        <p className="text-sm font-semibold text-[#1A1A1A]">4년 11개월</p>
      </div>
      <div>
        <p className="text-xs text-[#999] mb-1">이직위험도</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <div className="w-5 h-2 rounded-full bg-[#FF9800]" />
            <div className="w-5 h-2 rounded-full bg-[#FF9800]" />
            <div className="w-5 h-2 rounded-full bg-[#E8E8E8]" />
            <div className="w-5 h-2 rounded-full bg-[#E8E8E8]" />
          </div>
          <span className="text-xs font-semibold text-[#FF9800]">중간</span>
        </div>
      </div>
    </div>

    {/* 비밀메모 (매니저 전용) */}
    <div className="py-4">
      <div className="bg-[#FFF8E1] border-l-3 border-[#FF9800] p-3 rounded-r-lg">
        <p className="text-xs font-semibold text-[#E65100] mb-1">📝 매니저 메모</p>
        <p className="text-xs text-[#666] leading-relaxed">
          리더십 잠재력 높음. 차기 팀장 후보로 고려 중.
        </p>
      </div>
    </div>
  </div>
</aside>
```

### 2. 탭 네비게이션 — FLEX 스타일 밑줄 탭

**현재:** `border-blue-600 text-blue-600`
**타겟:** `border-[#1A1A1A] text-[#1A1A1A] font-bold` (FLEX 스타일)

```jsx
<div className="border-b border-[#E8E8E8]">
  <nav className="flex gap-6">
    {['기본정보', '경력·학력', '문서', '인사발령', '활동내역'].map(tab => (
      <button
        key={tab}
        className={`py-3 text-[15px] border-b-2 transition-colors ${
          activeTab === tab
            ? 'border-[#1A1A1A] text-[#1A1A1A] font-bold'
            : 'border-transparent text-[#999] font-medium hover:text-[#666]'
        }`}
      >
        {tab}
      </button>
    ))}
  </nav>
</div>
```

### 3. 기본정보 탭 — 폼 스타일

**정보 그리드 (읽기 모드):**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 p-6">
  <div>
    <p className="text-xs text-[#999] font-medium mb-1">성명</p>
    <p className="text-sm text-[#1A1A1A]">김상우</p>
  </div>
  <div>
    <p className="text-xs text-[#999] font-medium mb-1">사번</p>
    <p className="text-sm text-[#1A1A1A]">EMP-2021-001</p>
  </div>
  <div>
    <p className="text-xs text-[#999] font-medium mb-1">부서</p>
    <p className="text-sm text-[#1A1A1A]">인사팀</p>
  </div>
  <div>
    <p className="text-xs text-[#999] font-medium mb-1">직급</p>
    <p className="text-sm text-[#1A1A1A]">과장</p>
  </div>
</div>
```

**편집 모드 (인풋):**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 p-6">
  <div>
    <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">성명</label>
    <input className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
      text-[#1A1A1A] focus:border-[#00C853] focus:outline-none 
      focus:ring-2 focus:ring-[#00C853]/10" />
  </div>
  <div>
    <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">부서</label>
    <select className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
      text-[#1A1A1A] focus:border-[#00C853] focus:outline-none
      focus:ring-2 focus:ring-[#00C853]/10 appearance-none bg-white">
      <option>인사팀</option>
    </select>
  </div>
</div>
```

### 4. 경력·학력 탭 — 타임라인 스타일

```jsx
<div className="p-6">
  <h3 className="text-base font-bold text-[#1A1A1A] mb-4 tracking-[-0.02em]">경력사항</h3>
  <div className="space-y-0">
    {careers.map((item, i) => (
      <div key={i} className="flex gap-4">
        {/* 타임라인 도트 + 라인 */}
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-[#00C853] border-2 border-white ring-2 ring-[#00C853]/20" />
          {i < careers.length - 1 && <div className="w-px flex-1 bg-[#E8E8E8]" />}
        </div>
        {/* 콘텐츠 */}
        <div className="pb-6">
          <p className="text-sm font-semibold text-[#1A1A1A]">{item.company}</p>
          <p className="text-xs text-[#999] mt-0.5">{item.position} · {item.period}</p>
          {item.description && (
            <p className="text-xs text-[#666] mt-1 leading-relaxed">{item.description}</p>
          )}
        </div>
      </div>
    ))}
  </div>
</div>
```

### 5. 문서 탭 — 파일 리스트

```jsx
<div className="p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">문서 관리</h3>
    <button className="bg-[#00C853] hover:bg-[#00A844] text-white 
      px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5">
      <Upload size={16} /> 업로드
    </button>
  </div>
  
  <div className="border border-[#E8E8E8] rounded-xl overflow-hidden">
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#E8E8E8]">
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">문서명</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">유형</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">등록일</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">액션</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#999]" />
              <span className="text-sm text-[#1A1A1A]">근로계약서.pdf</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className="text-xs text-[#999] bg-[#F5F5F5] px-2 py-0.5 rounded">
              계약서
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-[#666]">2021.04.01</td>
          <td className="px-4 py-3">
            <button className="text-[#999] hover:text-[#00C853]">
              <Download size={16} />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### 6. 인사발령 탭 — 이력 테이블

```jsx
<div className="p-6">
  <div className="border border-[#E8E8E8] rounded-xl overflow-hidden">
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#E8E8E8]">
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">발령일</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">유형</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">변경 전</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">변경 후</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">상태</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
          <td className="px-4 py-3 text-sm text-[#1A1A1A]">2024.01.01</td>
          <td className="px-4 py-3">
            <span className="text-xs font-semibold text-[#2196F3] bg-[#E3F2FD] 
              px-2 py-0.5 rounded">승진</span>
          </td>
          <td className="px-4 py-3 text-sm text-[#666]">대리</td>
          <td className="px-4 py-3 text-sm text-[#1A1A1A] font-medium">과장</td>
          <td className="px-4 py-3">
            <span className="inline-flex items-center px-2.5 py-0.5 
              rounded bg-[#E8F5E9] text-[#00C853] text-xs font-semibold">
              ✓ 승인
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### 7. 신규 등록 폼 — 스텝 위저드 스타일 (선택)

**현재:** 단일 긴 폼
**타겟:** 유지해도 되지만, 폼 필드 스타일링만 FLEX로 전환

```jsx
{/* 폼 섹션 구분 */}
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
  <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em] mb-5">
    기본 정보
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
    <div>
      <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
        성명 <span className="text-[#F44336]">*</span>
      </label>
      <input className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
        text-[#1A1A1A] placeholder:text-[#BDBDBD]
        focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10" 
        placeholder="성명을 입력하세요"
      />
    </div>
  </div>
</div>

{/* 하단 액션 */}
<div className="flex items-center justify-end gap-3">
  <button className="px-4 py-2.5 border border-[#E0E0E0] rounded-lg text-sm 
    font-medium text-[#333] hover:bg-[#F5F5F5]">
    취소
  </button>
  <button className="px-4 py-2.5 bg-[#00C853] hover:bg-[#00A844] rounded-lg text-sm 
    font-semibold text-white">
    등록
  </button>
</div>
```

### 8. 조직도 — React Flow 노드 스타일 (P11)

**노드 카드:**
```jsx
// React Flow 커스텀 노드
function OrgNode({ data }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 min-w-[180px]
      hover:border-[#00C853] transition-colors">
      {/* 조직장은 좌측 green 바 */}
      {data.isHead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00C853] rounded-l-xl" />
      )}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#E8E8E8] flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-[#1A1A1A]">{data.name}</p>
          <p className="text-xs text-[#999]">{data.title}</p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-[#F0F0F0] flex items-center justify-between">
        <span className="text-xs text-[#999]">{data.headcount}명</span>
        {data.trend === 'warning' && (
          <span className="text-xs text-[#FF9800] bg-[#FFF3E0] px-1.5 py-0.5 rounded">
            주의
          </span>
        )}
      </div>
    </div>
  );
}
```

**React Flow 엣지:**
```
- 색상: stroke="#E8E8E8"
- 선택 시: stroke="#00C853"
- 스타일: smoothstep
```

### 9. 조직변경 이력 — 테이블 (P03 재활용)

R1에서 적용한 P03 테이블 패턴 그대로 사용. 추가로:

```jsx
{/* 변경 유형 뱃지 */}
const CHANGE_TYPE_STYLES = {
  신설:   'bg-[#E8F5E9] text-[#00C853]',
  폐지:   'bg-[#FFEBEE] text-[#F44336]',
  이동:   'bg-[#E3F2FD] text-[#2196F3]',
  명칭변경: 'bg-[#FFF3E0] text-[#FF9800]',
  통합:   'bg-[#F3E5F5] text-[#9C27B0]',
};
```

---

## 리팩토링 체크리스트

### 구성원 상세 (EmployeeDetailClient.tsx)
- [ ] 마스터-디테일 레이아웃 적용 (좌측 프로필 사이드바 w-72)
- [ ] 아바타: 72px, rounded-full
- [ ] 프로필 정보: divide-y divide-[#F0F0F0]
- [ ] 이직위험 바: 4단계 색상 바 (green/yellow/orange/red)
- [ ] 매니저 메모: bg-[#FFF8E1] border-l-3 border-[#FF9800]
- [ ] 탭: border-[#1A1A1A] + font-bold (FLEX 스타일)
- [ ] 정보 그리드: label text-xs text-[#999] + value text-sm text-[#1A1A1A]
- [ ] 편집 인풋: focus:border-[#00C853]
- [ ] 경력 타임라인: green 도트 + 세로선
- [ ] 문서 테이블: P03 패턴
- [ ] 인사발령 테이블: P03 패턴 + 유형별 컬러 뱃지

### 신규 등록 (EmployeeNewClient.tsx)
- [ ] 폼 카드: border border-[#E8E8E8] rounded-xl, shadow 없음
- [ ] 라벨: text-sm font-medium text-[#1A1A1A]
- [ ] 필수 마크: text-[#F44336]
- [ ] 인풋: focus green ring
- [ ] 버튼: primary green + secondary outline

### 조직도 (OrgClient.tsx)
- [ ] 노드 카드: border border-[#E8E8E8] rounded-xl, shadow 없음
- [ ] 조직장: 좌측 green 바 (border-l-4 or absolute)
- [ ] 엣지: stroke="#E8E8E8"
- [ ] 미니맵/컨트롤: FLEX 톤 맞춤
- [ ] 호버: border-[#00C853]

### 조직변경 이력 (OrgChangesClient.tsx)
- [ ] 테이블: R1 P03 패턴 재활용
- [ ] 변경유형 뱃지: 5종 컬러 매핑
- [ ] 필터: FLEX 스타일

### 공통
- [ ] 모든 blue 참조 → green 전환 (R1에서 이미 처리된 공통 컴포넌트 활용)
- [ ] shadow-sm 제거 확인
- [ ] text 컬러 통일: #1A1A1A / #666 / #999
- [ ] 페이지 제목: 28px font-bold tracking-[-0.02em]

---

## ⚠️ 주의사항

1. **기능 변경 금지** — 상태 관리, API 호출, Zod 스키마 일체 건드리지 않음
2. **R1 결과물 의존** — R1에서 변경한 공통 컴포넌트(Button, Badge, Card 등)를 그대로 import
3. **EmployeeDetailClient.tsx 크기 주의** — 이미 큰 파일. 프로필 사이드바를 별도 컴포넌트로 분리 검토
4. **React Flow 커스텀 노드** — 기존 노드 컴포넌트 스타일만 변경, 레이아웃 알고리즘(Dagre) 유지
5. **STEP 3~6A는 건드리지 않음** — R3~R6에서 별도 처리
6. **타입체크 유지** — 리팩 후 `npx tsc --noEmit` 0 errors

---

## 실행 순서 (권장)

```
1. EmployeeDetailClient.tsx — 프로필 사이드바 컴포넌트 분리 (ProfileSidebar.tsx)
2. EmployeeDetailClient.tsx — 마스터-디테일 레이아웃 적용
3. EmployeeDetailClient.tsx — 5개 탭 콘텐츠 스타일 전환
4. EmployeeNewClient.tsx — 폼 스타일 전환
5. OrgClient.tsx — React Flow 노드/엣지 스타일 전환
6. OrgChangesClient.tsx — 테이블 스타일 전환
7. 타입체크 + 비주얼 검증
```
