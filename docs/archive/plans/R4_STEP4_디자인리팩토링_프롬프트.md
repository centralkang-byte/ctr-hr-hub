# R4: STEP 4 디자인 리팩토링 — 온보딩

## 세션 목표

STEP 4에서 구현한 **온보딩 프로그램(Day 1/7/30/90 체크인), 감정 펄스, 체크리스트, 멘토 배정, 온보딩 대시보드** 페이지를 CTR_DESIGN_SYSTEM.md (FLEX 스타일) 기반으로 리팩토링.
**기능 변경 없음. 비주얼 일관성만 확보.**
**R1~R3에서 적용한 공통 컴포넌트 그대로 사용.**

---

## 필수 참조 파일

```
1. CLAUDE.md                 → 프로젝트 컨텍스트 + 디자인 토큰
2. CTR_DESIGN_SYSTEM.md      → FLEX 스타일 디자인 시스템 (타겟)
3. CTR_UI_PATTERNS.md        → P06(스텝 위저드), P02(KPI), 타임라인 중점
4. R1~R3 결과물              → 공통 UI 컴포넌트 변경사항 확인
```

---

## 리팩토링 대상 파일

> 실제 파일명은 프로젝트에서 확인 필요.

| 파일 (예상) | 내용 |
|------------|------|
| `src/app/(dashboard)/onboarding/page.tsx` | 온보딩 메인 (대시보드/목록) |
| `src/app/(dashboard)/onboarding/OnboardingClient.tsx` | 온보딩 클라이언트 |
| `src/app/(dashboard)/onboarding/[id]/page.tsx` | 개인 온보딩 상세 |
| `src/app/(dashboard)/onboarding/[id]/OnboardingDetailClient.tsx` | 개인 온보딩 상세 클라이언트 |
| 관련 모달/폼 컴포넌트 | 체크인 모달, 감정 펄스, 멘토 배정 등 |

---

## 핵심 패턴 매핑

| 패턴 | 적용 위치 |
|------|----------|
| **P06** 스텝 위저드 | Day 1 → 7 → 30 → 90 진행 단계 |
| **P02** KPI 카드 그리드 | 온보딩 대시보드 (진행률, 완료율 등) |
| **P03** 데이터 테이블 | 온보딩 대상자 목록 |
| 타임라인 | 체크인 이력, 활동 로그 |

---

## 컴포넌트별 상세 지침

### 1. 온보딩 대시보드 — KPI + 대상자 목록

**페이지 구조:**
```
┌─────────────────────────────────────────┐
│ 온보딩 관리         [+ 프로그램 생성]      │
│ 신규 입사자 온보딩 현황                    │
├─────────────────────────────────────────┤
│ [진행중 8명] [완료 23명] [평균완료율 78%] [이탈위험 2명] │
├─────────────────────────────────────────┤
│ [전체│Day1│Day7│Day30│Day90│완료]        │
├─────────────────────────────────────────┤
│ 온보딩 대상자 테이블                      │
└─────────────────────────────────────────┘
```

**KPI 카드:**
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
  {/* 진행중 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">진행중</p>
    <p className="text-3xl font-bold text-[#2196F3] tracking-[-0.02em]">8명</p>
    <span className="text-xs text-[#999]">현재 온보딩 중</span>
  </div>

  {/* 완료 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">완료</p>
    <p className="text-3xl font-bold text-[#00C853] tracking-[-0.02em]">23명</p>
    <span className="text-xs font-semibold text-[#00C853]">↑ 5명 전월 대비</span>
  </div>

  {/* 평균 완료율 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">평균 완료율</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">78%</p>
    <div className="mt-2 h-1.5 rounded-full bg-[#E8E8E8] overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-[#00C853] to-[#00BFA5]"
        style={{ width: '78%' }} />
    </div>
  </div>

  {/* 이탈위험 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6
    border-l-4 border-l-[#F44336]">
    <p className="text-xs text-[#999] font-medium mb-2">이탈 위험</p>
    <p className="text-3xl font-bold text-[#F44336] tracking-[-0.02em]">2명</p>
    <span className="text-xs text-[#E53935]">감정 펄스 낮음</span>
  </div>
</div>
```

**단계 필터 탭 (필 스타일):**
```jsx
<div className="flex items-center gap-2 mb-4">
  {[
    { label: '전체', count: 31 },
    { label: 'Day 1', count: 2 },
    { label: 'Day 7', count: 3 },
    { label: 'Day 30', count: 2 },
    { label: 'Day 90', count: 1 },
    { label: '완료', count: 23 },
  ].map(({ label, count }) => (
    <button
      key={label}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        activeFilter === label
          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
          : 'bg-white text-[#666] border-[#E0E0E0] hover:bg-[#F5F5F5]'
      }`}
    >
      {label} ({count})
    </button>
  ))}
</div>
```

**대상자 테이블 (P03):**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-[#E8E8E8]">
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">이름</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">부서</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">입사일</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">현재 단계</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">진행률</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">감정</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">멘토</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] cursor-pointer">
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">신OO</p>
              <p className="text-xs text-[#999]">EMP-2026-001</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5 text-sm text-[#666]">개발팀</td>
        <td className="px-4 py-3.5 text-sm text-[#666]">2026.02.15</td>
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center px-2.5 py-0.5 
            rounded bg-[#E3F2FD] text-[#2196F3] text-xs font-semibold">
            Day 7
          </span>
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-[#E8E8E8] overflow-hidden">
              <div className="h-full rounded-full bg-[#00C853]" style={{ width: '45%' }} />
            </div>
            <span className="text-xs text-[#666]">45%</span>
          </div>
        </td>
        <td className="px-4 py-3.5">
          <span className="text-lg">🙂</span>
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#E8E8E8]" />
            <span className="text-xs text-[#666]">박OO</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 2. 개인 온보딩 상세 — 스텝 위저드 (P06)

**페이지 구조:**
```
┌─────────────────────────────────────────┐
│ ← 온보딩 목록    신OO 온보딩      [편집]  │
├─────────────────────────────────────────┤
│      ①━━━━━━②━━━━━━③━━━━━━④            │
│    Day 1   Day 7  Day 30  Day 90        │
│      ✅      ●현재   ○대기   ○대기        │
├──────────────────┬──────────────────────┤
│ 체크리스트 (좌)    │ 사이드 정보 (우)       │
│                  │ 프로필 요약            │
│                  │ 감정 펄스 추이          │
│                  │ 멘토 정보              │
│                  │ 체크인 이력            │
└──────────────────┴──────────────────────┘
```

**스텝 위저드 (P06):**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
  <div className="flex items-center justify-between max-w-2xl mx-auto">
    {[
      { label: 'Day 1', sublabel: '첫날 안내', status: 'completed' },
      { label: 'Day 7', sublabel: '1주 적응', status: 'current' },
      { label: 'Day 30', sublabel: '1개월 체크', status: 'pending' },
      { label: 'Day 90', sublabel: '3개월 평가', status: 'pending' },
    ].map((step, i, arr) => (
      <div key={step.label} className="flex items-center flex-1">
        {/* 스텝 원 + 라벨 */}
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center
            text-sm font-bold transition-all ${
              step.status === 'completed'
                ? 'bg-[#00C853] text-white'
                : step.status === 'current'
                ? 'bg-[#2196F3] text-white ring-4 ring-[#2196F3]/20'
                : 'bg-[#E8E8E8] text-[#999]'
            }`}>
            {step.status === 'completed' 
              ? <Check size={18} /> 
              : i + 1}
          </div>
          <p className={`text-xs font-semibold mt-2 ${
            step.status === 'completed' ? 'text-[#00C853]'
            : step.status === 'current' ? 'text-[#2196F3]'
            : 'text-[#999]'
          }`}>{step.label}</p>
          <p className="text-[10px] text-[#BDBDBD] mt-0.5">{step.sublabel}</p>
        </div>

        {/* 연결선 */}
        {i < arr.length - 1 && (
          <div className={`flex-1 h-0.5 mx-3 rounded-full ${
            step.status === 'completed' ? 'bg-[#00C853]' : 'bg-[#E8E8E8]'
          }`} />
        )}
      </div>
    ))}
  </div>
</div>
```

### 3. 체크리스트 영역 (좌측)

```jsx
<div className="flex-1">
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">
        Day 7 체크리스트
      </h3>
      <span className="text-xs text-[#999]">3 / 8 완료</span>
    </div>

    {/* 프로그레스 */}
    <div className="mb-5">
      <div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#00C853] to-[#00BFA5]
          transition-all duration-500" style={{ width: '37.5%' }} />
      </div>
      <p className="text-xs text-[#999] mt-1">37.5% 완료</p>
    </div>

    {/* 체크리스트 아이템 */}
    <div className="space-y-1">
      {/* 완료 아이템 */}
      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#FAFAFA]">
        <div className="w-5 h-5 rounded border-2 border-[#00C853] bg-[#00C853] 
          flex items-center justify-center flex-shrink-0 mt-0.5">
          <Check size={12} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-[#999] line-through">팀원 소개 미팅 완료</p>
          <p className="text-[11px] text-[#BDBDBD] mt-0.5">2026.02.16 완료</p>
        </div>
      </div>

      {/* 미완료 아이템 */}
      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#FAFAFA] cursor-pointer">
        <div className="w-5 h-5 rounded border-2 border-[#E0E0E0] bg-white 
          flex-shrink-0 mt-0.5 hover:border-[#00C853] transition-colors" />
        <div className="flex-1">
          <p className="text-sm text-[#1A1A1A]">업무 도구 세팅 (Slack, Jira, Git)</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[#999]">담당: IT팀</span>
            <span className="text-[11px] text-[#FF9800]">· 기한: 02.22</span>
          </div>
        </div>
      </div>

      {/* 카테고리 구분 */}
      <div className="pt-4 pb-2">
        <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">
          문서 제출
        </p>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#FAFAFA] cursor-pointer">
        <div className="w-5 h-5 rounded border-2 border-[#E0E0E0] bg-white 
          flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-[#1A1A1A]">비밀유지서약서 제출</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-1.5 py-0.5 
              rounded bg-[#FFEBEE] text-[#E53935] text-[10px] font-semibold">
              필수
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 4. 사이드 정보 패널 (우측)

```jsx
<aside className="w-80 space-y-4 flex-shrink-0">
  {/* 프로필 요약 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-full bg-[#E8E8E8]" />
      <div>
        <p className="text-sm font-bold text-[#1A1A1A]">신OO</p>
        <p className="text-xs text-[#999]">개발팀 · 사원</p>
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-xs text-[#999]">입사일</span>
        <span className="text-xs text-[#1A1A1A]">2026.02.15</span>
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-[#999]">D+</span>
        <span className="text-xs font-semibold text-[#2196F3]">14일</span>
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-[#999]">현재 단계</span>
        <span className="text-xs font-semibold text-[#2196F3]">Day 7</span>
      </div>
    </div>
  </div>

  {/* 감정 펄스 추이 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
    <h4 className="text-sm font-bold text-[#1A1A1A] mb-3 tracking-[-0.02em]">
      감정 펄스
    </h4>
    
    {/* 현재 감정 */}
    <div className="flex items-center justify-center gap-4 mb-4 py-3 
      bg-[#F5F5F5] rounded-lg">
      <span className="text-3xl">🙂</span>
      <div>
        <p className="text-sm font-bold text-[#1A1A1A]">보통</p>
        <p className="text-[11px] text-[#999]">3일 전 기록</p>
      </div>
    </div>

    {/* 추이 (미니 차트 or 이모지 타임라인) */}
    <div className="space-y-2">
      {[
        { date: '02.21', emoji: '🙂', label: '보통' },
        { date: '02.18', emoji: '😀', label: '좋음' },
        { date: '02.16', emoji: '😐', label: '그저그럭' },
        { date: '02.15', emoji: '😀', label: '좋음' },
      ].map((pulse, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-xs text-[#999]">{pulse.date}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm">{pulse.emoji}</span>
            <span className="text-xs text-[#666]">{pulse.label}</span>
          </div>
        </div>
      ))}
    </div>

    {/* 하락 경고 */}
    {/* 감정이 2회 연속 하락 시 표시 */}
    {/*
    <div className="mt-3 p-2.5 bg-[#FFF3E0] rounded-lg border border-[#FFE0B2]">
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={14} className="text-[#FF9800]" />
        <span className="text-xs font-semibold text-[#E65100]">감정 하락 감지</span>
      </div>
      <p className="text-[11px] text-[#666] mt-1">멘토 면담을 권장합니다</p>
    </div>
    */}
  </div>

  {/* 멘토 정보 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
    <h4 className="text-sm font-bold text-[#1A1A1A] mb-3 tracking-[-0.02em]">
      멘토
    </h4>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#E8E8E8]" />
      <div>
        <p className="text-sm font-semibold text-[#1A1A1A]">박OO</p>
        <p className="text-xs text-[#999]">개발팀 · 선임</p>
      </div>
    </div>
    <div className="mt-3 space-y-2">
      <div className="flex justify-between">
        <span className="text-xs text-[#999]">배정일</span>
        <span className="text-xs text-[#666]">2026.02.15</span>
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-[#999]">면담 횟수</span>
        <span className="text-xs font-semibold text-[#1A1A1A]">2회</span>
      </div>
    </div>
    <button className="w-full mt-3 py-2 border border-[#E0E0E0] rounded-lg 
      text-xs font-medium text-[#666] hover:bg-[#F5F5F5]">
      면담 기록 보기
    </button>
  </div>

  {/* 체크인 이력 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
    <h4 className="text-sm font-bold text-[#1A1A1A] mb-3 tracking-[-0.02em]">
      체크인 이력
    </h4>
    <div className="space-y-0">
      {[
        { date: '02.21', title: 'Day 7 체크인', by: '박OO 멘토', status: 'completed' },
        { date: '02.15', title: 'Day 1 체크인', by: '인사팀', status: 'completed' },
      ].map((checkin, i, arr) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
              checkin.status === 'completed' ? 'bg-[#00C853]' : 'bg-[#E8E8E8]'
            }`} />
            {i < arr.length - 1 && <div className="w-px flex-1 bg-[#E8E8E8]" />}
          </div>
          <div className="pb-4">
            <p className="text-xs font-semibold text-[#1A1A1A]">{checkin.title}</p>
            <p className="text-[11px] text-[#999]">{checkin.date} · {checkin.by}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
</aside>
```

### 5. 감정 펄스 체크인 모달

```jsx
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
  <div className="bg-white rounded-2xl w-full max-w-md 
    shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
    {/* 헤더 */}
    <div className="px-6 py-4 border-b border-[#E8E8E8]">
      <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">
        오늘 기분은 어떠세요?
      </h2>
      <p className="text-xs text-[#999] mt-1">솔직하게 선택해주세요</p>
    </div>

    {/* 감정 선택 */}
    <div className="px-6 py-6">
      <div className="flex items-center justify-center gap-6">
        {[
          { emoji: '😀', label: '좋음', value: 4 },
          { emoji: '🙂', label: '보통', value: 3 },
          { emoji: '😐', label: '그저그럭', value: 2 },
          { emoji: '😞', label: '힘듦', value: 1 },
        ].map(mood => (
          <button
            key={mood.value}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl 
              transition-all ${
                selectedMood === mood.value
                  ? 'bg-[#E8F5E9] ring-2 ring-[#00C853] scale-110'
                  : 'hover:bg-[#F5F5F5]'
              }`}
          >
            <span className="text-4xl">{mood.emoji}</span>
            <span className={`text-xs font-medium ${
              selectedMood === mood.value ? 'text-[#00C853]' : 'text-[#999]'
            }`}>{mood.label}</span>
          </button>
        ))}
      </div>

      {/* 한줄 코멘트 (선택) */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
          한마디 (선택)
        </label>
        <input className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
          placeholder:text-[#BDBDBD] focus:border-[#00C853] focus:outline-none 
          focus:ring-2 focus:ring-[#00C853]/10"
          placeholder="오늘 하루를 한마디로 표현하면?"
        />
      </div>
    </div>

    {/* 푸터 */}
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E8E8E8]">
      <button className="px-4 py-2.5 border border-[#E0E0E0] rounded-lg text-sm 
        font-medium text-[#333] hover:bg-[#F5F5F5]">건너뛰기</button>
      <button className="px-4 py-2.5 bg-[#00C853] hover:bg-[#00A844] rounded-lg text-sm 
        font-semibold text-white" disabled={!selectedMood}>제출</button>
    </div>
  </div>
</div>
```

### 6. 멘토 배정 모달

```jsx
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
  <div className="bg-white rounded-2xl w-full max-w-lg 
    shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
    <div className="px-6 py-4 border-b border-[#E8E8E8]">
      <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">멘토 배정</h2>
    </div>

    <div className="px-6 py-5">
      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BDBDBD]" />
        <input className="w-full pl-9 pr-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
          placeholder:text-[#BDBDBD] focus:border-[#00C853] focus:outline-none 
          focus:ring-2 focus:ring-[#00C853]/10"
          placeholder="멘토 이름으로 검색"
        />
      </div>

      {/* AI 추천 */}
      <div className="mb-4 p-3 bg-[#F1F8E9] rounded-lg border border-[#C8E6C9]">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={14} className="text-[#00C853]" />
          <span className="text-xs font-semibold text-[#2E7D32]">AI 추천</span>
        </div>
        <p className="text-xs text-[#666]">같은 팀, 유사 직무 경험 기반 추천</p>
      </div>

      {/* 멘토 후보 리스트 */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {mentors.map(mentor => (
          <div key={mentor.id}
            className={`flex items-center justify-between p-3 rounded-lg border 
              cursor-pointer transition-colors ${
                selectedMentor === mentor.id
                  ? 'border-[#00C853] bg-[#E8F5E9]'
                  : 'border-[#E8E8E8] hover:bg-[#FAFAFA]'
              }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E8E8E8]" />
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">{mentor.name}</p>
                <p className="text-xs text-[#999]">{mentor.dept} · {mentor.title}</p>
              </div>
            </div>
            {mentor.recommended && (
              <span className="text-xs font-semibold text-[#00C853] bg-[#E8F5E9] 
                px-2 py-0.5 rounded">추천</span>
            )}
          </div>
        ))}
      </div>
    </div>

    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E8E8E8]">
      <button className="px-4 py-2.5 border border-[#E0E0E0] rounded-lg text-sm 
        font-medium text-[#333] hover:bg-[#F5F5F5]">취소</button>
      <button className="px-4 py-2.5 bg-[#00C853] hover:bg-[#00A844] rounded-lg text-sm 
        font-semibold text-white">배정</button>
    </div>
  </div>
</div>
```

### 7. 온보딩 단계 뱃지

```jsx
const ONBOARDING_STAGE = {
  'Day 1':  'bg-[#E8F5E9] text-[#2E7D32]',
  'Day 7':  'bg-[#E3F2FD] text-[#2196F3]',
  'Day 30': 'bg-[#FFF3E0] text-[#FF9800]',
  'Day 90': 'bg-[#F3E5F5] text-[#9C27B0]',
  '완료':    'bg-[#E8F5E9] text-[#00C853]',
  '이탈':    'bg-[#FFEBEE] text-[#F44336]',
};
```

---

## 리팩토링 체크리스트

### 온보딩 대시보드
- [ ] KPI 카드: R1 패턴 (shadow 없음, border만)
- [ ] 이탈위험 KPI: border-l-4 border-l-[#F44336]
- [ ] 단계 필터: 필 탭 스타일 (active=bg-[#1A1A1A])
- [ ] 대상자 테이블: P03 패턴
- [ ] 진행률: 미니 프로그레스 바 (green gradient)
- [ ] 감정 이모지: 테이블 셀에 표시

### 개인 온보딩 상세
- [ ] 스텝 위저드 (P06): 완료(green)/현재(blue+ring)/대기(gray)
- [ ] 연결선: 완료 구간=green, 미완료=gray
- [ ] 체크리스트: 체크박스 accent green + 완료 시 line-through
- [ ] 카테고리 구분: uppercase tracking-wider 라벨
- [ ] 필수 태그: bg-[#FFEBEE] text-[#E53935]

### 사이드 정보 패널
- [ ] 프로필 요약 카드: border border-[#E8E8E8]
- [ ] 감정 펄스: 현재 이모지 강조 + 추이 리스트
- [ ] 감정 하락 경고: bg-[#FFF3E0] border-[#FFE0B2]
- [ ] 멘토 카드: 아바타 + 면담 횟수
- [ ] 체크인 이력: 미니 타임라인 (green 도트)

### 모달
- [ ] 감정 펄스: 이모지 4개 선택 UI, 선택 시 green ring + scale
- [ ] 멘토 배정: 검색 + AI 추천 배너 + 선택 리스트
- [ ] 모달 공통: rounded-2xl + shadow-[0_16px_48px]

### 공통
- [ ] 온보딩 단계 뱃지: 6종 컬러 매핑
- [ ] 모든 blue → green 전환 확인
- [ ] shadow-sm 제거 확인
- [ ] 텍스트 컬러: #1A1A1A / #666 / #999

---

## ⚠️ 주의사항

1. **기능 변경 금지** — 체크리스트 로직, 감정 펄스 저장, 멘토 배정 API 일체 유지
2. **R1~R3 공통 컴포넌트 재활용** — Button, Badge, Card, Input, Tab, Modal
3. **이모지 렌더링** — 감정 펄스 이모지는 시스템 이모지 사용 (이미지 아님)
4. **STEP 5~6A는 건드리지 않음** — R5~R6에서 별도 처리
5. **타입체크 유지** — `npx tsc --noEmit` 0 errors

---

## 실행 순서 (권장)

```
1. 온보딩 단계 뱃지 상수 정의 (ONBOARDING_STAGE 맵)
2. 온보딩 대시보드 — KPI + 필터탭 + 테이블 리팩
3. 개인 상세 — 스텝 위저드 (P06) 리팩
4. 개인 상세 — 체크리스트 영역 리팩
5. 개인 상세 — 사이드 정보 패널 리팩 (감정 펄스 + 멘토 + 체크인 이력)
6. 감정 펄스 체크인 모달 리팩
7. 멘토 배정 모달 리팩
8. 타입체크 + 비주얼 검증
```
