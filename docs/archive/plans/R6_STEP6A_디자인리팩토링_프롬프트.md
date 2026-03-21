# R6: STEP 6A 디자인 리팩토링 — 성과관리 (EMS 9블록 + MBO + 캘리브레이션 + CFR + Pulse)

## 세션 목표

STEP 6A에서 구현한 **EMS 9블록 성과평가, MBO 목표관리, 캘리브레이션, CFR(1:1 + Recognition), Pulse Survey, 다면평가(360°)** 페이지를 CTR_DESIGN_SYSTEM.md (FLEX 스타일) 기반으로 리팩토링.
**기능 변경 없음. 비주얼 일관성만 확보.**
**R1~R5에서 적용한 공통 컴포넌트 그대로 사용.**

---

## 필수 참조 파일

```
1. CLAUDE.md                 → 프로젝트 컨텍스트 + 디자인 토큰
2. CTR_DESIGN_SYSTEM.md      → FLEX 스타일 디자인 시스템 (타겟) — 특히 §11 프로그레스/게이지, §13 평가 전용 패턴
3. CTR_UI_PATTERNS.md        → P08(OKR 트리 테이블), P09(리치텍스트+사이드), P10(차트 대시보드), NP01(AI 분석), NP02(캘리브레이션/9-Grid)
4. R1~R5 결과물              → 공통 UI 컴포넌트 변경사항 확인
```

---

## 리팩토링 대상 파일

> 실제 파일명은 프로젝트에서 확인 필요.

| 파일 (예상) | 내용 |
|------------|------|
| `src/app/(dashboard)/performance/page.tsx` | 성과관리 메인 |
| `src/app/(dashboard)/performance/goals/...` | MBO 목표 설정/관리 |
| `src/app/(dashboard)/performance/self-eval/...` | 자기평가 |
| `src/app/(dashboard)/performance/manager-eval/...` | 매니저 평가 |
| `src/app/(dashboard)/performance/calibration/...` | 캘리브레이션 세션 |
| `src/app/(dashboard)/performance/results/...` | 성과 결과 조회 |
| `src/app/(dashboard)/performance/team-goals/...` | 팀 목표 현황 (MANAGER) |
| `src/app/(dashboard)/performance/team-results/...` | 팀 결과 (MANAGER) |
| `src/app/(dashboard)/performance/admin/...` | 전사 성과 (HR_ADMIN) |
| `src/app/(dashboard)/cfr/one-on-ones/...` | 1:1 미팅 |
| `src/app/(dashboard)/cfr/recognition/...` | Recognition 피드 |
| `src/app/(dashboard)/pulse/...` | Pulse Survey |
| `src/app/(dashboard)/settings/performance-cycles/...` | 평가 사이클 관리 |
| `src/app/(dashboard)/settings/calibration/...` | 캘리브레이션 규칙 |
| `src/app/(dashboard)/settings/peer-review/...` | 다면평가 설정 |
| 관련 모달/폼 컴포넌트 | 평가 폼, 목표 입력, AI 분석 패널 등 |

---

## 핵심 패턴 매핑

| 패턴 | 적용 위치 |
|------|----------|
| **P08** OKR 트리 테이블 | MBO 목표 목록 (O > KR > Task 계층) |
| **P09** 리치텍스트 + 사이드 컨텍스트 | 1:1 미팅 노트, 평가 코멘트 입력 |
| **P10** 차트 대시보드 | 성과 결과 분석, Pulse 결과, 9블록 분포 |
| **NP01** AI 분석 리포트 카드 | AI 평가 코멘트, AI 캘리브레이션 분석, AI Pulse 분석 |
| **NP02** 캘리브레이션/9-Grid | 9블록 매트릭스, 등급 배분 |
| **P02** KPI 카드 그리드 | 성과 대시보드 KPI, 1:1 대시보드 |
| **P03** 데이터 테이블 | 사이클 목록, 팀 목표 현황, 팀 결과 목록, 설문 목록 |
| **P05** 승인 워크플로 | 목표 승인 플로우 (DRAFT→SUBMITTED→APPROVED) |
| **P06** 스텝 위저드 | 사이클 상태 머신 시각화 |

---

## 컴포넌트별 상세 지침

### 1. 평가 사이클 관리 — 상태 머신 + 테이블 (P03 + P06)

**사이클 상태 머신 시각화 (상단):**
```jsx
{/* FLEX 스타일 스텝 위저드 — 사이클 진행 상태 */}
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
  <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">
    2025년 상반기 평가
  </h3>
  
  <div className="flex items-center justify-between">
    {[
      { step: 1, label: '초안', status: 'done' },
      { step: 2, label: '목표설정', status: 'done' },
      { step: 3, label: '진행중', status: 'done' },
      { step: 4, label: '자기평가', status: 'current' },
      { step: 5, label: '매니저평가', status: 'pending' },
      { step: 6, label: '캘리브레이션', status: 'pending' },
      { step: 7, label: '확정', status: 'pending' },
    ].map((s, i, arr) => (
      <div key={s.step} className="flex items-center flex-1">
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            ${s.status === 'done' ? 'bg-[#00C853] text-white' :
              s.status === 'current' ? 'bg-[#1A1A1A] text-white' :
              'bg-[#E8E8E8] text-[#999]'}`}>
            {s.status === 'done' ? '✓' : s.step}
          </div>
          <span className={`text-[11px] mt-1.5 ${
            s.status === 'current' ? 'text-[#1A1A1A] font-bold' : 'text-[#999]'
          }`}>{s.label}</span>
        </div>
        {i < arr.length - 1 && (
          <div className={`flex-1 h-0.5 mx-2 mt-[-16px] ${
            s.status === 'done' ? 'bg-[#00C853]' : 'bg-[#E8E8E8]'
          }`} />
        )}
      </div>
    ))}
  </div>
</div>
```

**사이클 목록 테이블:**
```jsx
{/* P03 패턴 — R1에서 적용한 테이블 스타일 그대로 */}
<div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-[#E8E8E8]">
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">사이클명</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">연도</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">유형</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">기간</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">상태</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">법인</th>
      </tr>
    </thead>
    {/* ... R1 테이블 패턴 동일 ... */}
  </table>
</div>
```

**사이클 상태 뱃지:**
```jsx
const CYCLE_STATUS = {
  DRAFT:          'bg-[#F5F5F5] text-[#999] border border-[#E0E0E0]',
  GOAL_SETTING:   'bg-[#E3F2FD] text-[#2196F3]',
  IN_PROGRESS:    'bg-[#E8F5E9] text-[#2E7D32]',
  SELF_EVAL:      'bg-[#FFF3E0] text-[#FF9800]',
  MANAGER_EVAL:   'bg-[#FFF3E0] text-[#E65100]',
  CALIBRATION:    'bg-[#F3E5F5] text-[#9C27B0]',
  FINALIZED:      'bg-[#E8F5E9] text-[#00C853]',
};
```

---

### 2. MBO 목표 관리 — OKR 트리 (P08) + 승인 (P05)

**페이지 구조:**
```
┌─────────────────────────────────────────┐
│ 성과 목표              [+ 목표 추가]      │
│ 2025년 상반기 · 가중치 합계: 100%          │
├─────────────────────────────────────────┤
│ [전체│업무│개발│혁신│팀]                    │
├─────────────────────────────────────────┤
│ 🎯 O: 매출 30% 성장 (40%)    ■■■■■■□□ 75%│
│   📊 KR1: 신규고객 20건      ■■■■□□□□ 50%│
│   📊 KR2: 기존고객 유지율    ■■■■■■■□ 90%│
│ 🎯 O: 기술역량 향상 (30%)    ■■■■■□□□ 60%│
│   ...                                   │
├─────────────────────────────────────────┤
│ 가중치 합계: 100% ✓                      │
│              [임시저장]  [제출]             │
└─────────────────────────────────────────┘
```

**목표 트리 아이템:**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
  {/* 목표 카테고리 필 탭 */}
  <div className="flex items-center gap-2 mb-5">
    {['전체', '업무', '개발', '혁신', '팀'].map(cat => (
      <button key={cat} className={`px-3.5 py-1.5 rounded-full text-xs font-medium border
        ${active === cat 
          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' 
          : 'bg-white text-[#666] border-[#E0E0E0] hover:bg-[#F5F5F5]'}`}>
        {cat}
      </button>
    ))}
  </div>

  {/* 목표 트리 */}
  <div className="space-y-4">
    {/* Objective */}
    <div className="border-l-4 border-[#00C853] pl-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#00C853]" />
          <span className="text-sm font-bold text-[#1A1A1A] tracking-[-0.02em]">
            매출 30% 성장
          </span>
          <span className="text-xs text-[#999] bg-[#F5F5F5] px-2 py-0.5 rounded">
            가중치 40%
          </span>
          {/* 승인 상태 */}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold
            bg-[#E8F5E9] text-[#00C853]">
            승인됨
          </span>
        </div>
        <span className="text-sm font-bold text-[#1A1A1A]">75%</span>
      </div>
      
      {/* 프로그레스 바 — CTR_DESIGN_SYSTEM §11 */}
      <div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#00C853] to-[#00BFA5]"
          style={{ width: '75%' }} />
      </div>
      
      {/* CTR 핵심가치 태그 */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded
          bg-[#E8F5E9] text-[#00C853]">도전</span>
      </div>
    </div>

    {/* Key Result — 들여쓰기 */}
    <div className="pl-10 border-l-4 border-[#2196F3] ml-4 pl-4 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-[#2196F3]" />
          <span className="text-sm text-[#333]">신규고객 20건 확보</span>
        </div>
        <span className="text-sm font-semibold text-[#FF9800]">50%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#E8E8E8] overflow-hidden">
        <div className="h-full rounded-full bg-[#FF9800]" style={{ width: '50%' }} />
      </div>
    </div>
  </div>
</div>
```

**프로그레스 바 색상 규칙 (§11 기반):**
```jsx
const getProgressColor = (rate) => {
  if (rate >= 67) return 'bg-gradient-to-r from-[#00C853] to-[#00BFA5]'; // 좋음
  if (rate >= 34) return 'bg-[#FF9800]';                                   // 어려움
  return 'bg-[#F44336]';                                                   // 위험
};
```

**목표 승인 상태 뱃지:**
```jsx
const GOAL_STATUS = {
  DRAFT:              'bg-[#F5F5F5] text-[#999] border border-[#E0E0E0]',
  SUBMITTED:          'bg-[#FFF3E0] text-[#FF9800]',
  APPROVED:           'bg-[#E8F5E9] text-[#00C853]',
  REVISION_REQUESTED: 'bg-[#FFEBEE] text-[#F44336]',
};
```

---

### 3. 성과 평가 — 자기평가 & 매니저 평가 (§13 평가 전용 패턴)

**매니저 평가 — 좌우 분할 레이아웃:**
```
┌──────────────────────┬──────────────────────┐
│ 자기평가 (읽기전용)     │ 매니저 평가 (입력)     │
│ bg-[#FAFAFA]          │ bg-white              │
│                      │                      │
│ 🎯 목표별 점수         │ 🎯 목표별 점수 입력    │
│ 📊 역량별 점수         │ 📊 역량별 점수 입력    │
│ 💬 자기평가 코멘트     │ 💬 매니저 코멘트 입력   │
│                      │ [AI 코멘트 제안 🤖]    │
│                      │                      │
│                      │ ═══ EMS 블록 미리보기 ═ │
│                      │ 블록 6 (High Performer) │
└──────────────────────┴──────────────────────┘
```

**역량 평가 항목 — CTR_DESIGN_SYSTEM §13 (점수별 컬러 바):**
```jsx
<div className="space-y-4">
  {[
    { id: 'expertise', label: '전문성', desc: '직무 관련 전문 지식과 기술 수준' },
    { id: 'leadership', label: '리더십/협업', desc: '팀 내 리더십과 협업 능력' },
    { id: 'problem', label: '문제해결', desc: '논리적 사고와 문제 해결 접근' },
    { id: 'communication', label: '커뮤니케이션', desc: '의사소통 및 표현 능력' },
    { id: 'values', label: 'CTR 핵심가치', desc: '도전·신뢰·책임·존중 실천' },
  ].map(comp => {
    const score = scores[comp.id] || 0;
    const borderColor = 
      score >= 5 ? '#00C853' :
      score >= 4 ? '#8BC34A' :
      score >= 3 ? '#FF9800' :
      score >= 2 ? '#FF5722' : '#F44336';
    
    return (
      <div key={comp.id} className="p-4 rounded-lg border border-[#E8E8E8]"
        style={{ borderLeftWidth: '4px', borderLeftColor: score > 0 ? borderColor : '#E8E8E8' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">{comp.label}</p>
            <p className="text-xs text-[#999] mt-0.5">{comp.desc}</p>
          </div>
          {/* 자기평가 참고 점수 (매니저 뷰) */}
          <span className="text-xs text-[#999] bg-[#F5F5F5] px-2 py-0.5 rounded">
            자기평가: {selfScores[comp.id]}점
          </span>
        </div>
        
        {/* 5점 스케일 — R5 면접 평가 패턴 동일 */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s}
              className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                score === s
                  ? 'bg-[#00C853] text-white'
                  : 'bg-[#F5F5F5] text-[#666] hover:bg-[#E8E8E8]'
              }`}>
              {s}
            </button>
          ))}
        </div>
        
        {/* 코멘트 입력 */}
        <textarea className="w-full mt-3 px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm
          focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10
          resize-none h-16 placeholder:text-[#BDBDBD]"
          placeholder="이 역량에 대한 평가 코멘트"
        />
      </div>
    );
  })}
</div>
```

**EMS 블록 미리보기 카드:**
```jsx
{/* 매니저 평가 폼 하단 — EMS 블록 자동 산출 결과 */}
<div className="bg-[#F1F8E9] border border-[#C8E6C9] rounded-xl p-5 mt-6">
  <div className="flex items-center gap-2 mb-3">
    <Sparkles size={16} className="text-[#00C853]" />
    <span className="text-sm font-bold text-[#2E7D32]">EMS 9블록 산출 결과</span>
  </div>
  
  <div className="grid grid-cols-3 gap-4">
    {/* 성과 점수 */}
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 text-center">
      <p className="text-xs text-[#999] mb-1">성과 점수</p>
      <p className="text-2xl font-bold text-[#1A1A1A]">4.2</p>
      <p className="text-[11px] text-[#00C853] font-semibold">High</p>
    </div>
    {/* 역량 점수 */}
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 text-center">
      <p className="text-xs text-[#999] mb-1">역량 점수</p>
      <p className="text-2xl font-bold text-[#1A1A1A]">3.0</p>
      <p className="text-[11px] text-[#FF9800] font-semibold">Mid</p>
    </div>
    {/* EMS 블록 — §13 grade-card 패턴 */}
    <div className="bg-white border-2 border-[#2196F3] rounded-xl p-4 text-center">
      <p className="text-xs text-[#999] mb-1">EMS 블록</p>
      <p className="text-3xl font-bold text-[#2196F3]">6</p>
      <p className="text-xs font-semibold text-[#2196F3]">High Performer</p>
    </div>
  </div>
  
  {/* 권장 액션 */}
  <div className="mt-3 p-3 bg-white rounded-lg border border-[#E8E8E8]">
    <p className="text-xs text-[#999] mb-1">권장 액션</p>
    <p className="text-xs text-[#333]">승진 검토, 도전적 목표 부여. 핵심 인재풀 편입 고려.</p>
  </div>
</div>
```

**EMS 블록 색상 매핑:**
```jsx
const EMS_BLOCK_COLORS = {
  1: { bg: 'bg-[#FFEBEE]', text: 'text-[#F44336]', border: 'border-[#F44336]', label: 'Under Performer' },
  2: { bg: 'bg-[#FFF3E0]', text: 'text-[#FF9800]', border: 'border-[#FF9800]', label: 'Inconsistent' },
  3: { bg: 'bg-[#FFF9C4]', text: 'text-[#F9A825]', border: 'border-[#F9A825]', label: 'Specialist' },
  4: { bg: 'bg-[#FFF3E0]', text: 'text-[#E65100]', border: 'border-[#E65100]', label: 'Development Needed' },
  5: { bg: 'bg-[#E8F5E9]', text: 'text-[#2E7D32]', border: 'border-[#2E7D32]', label: 'Core Contributor' },
  6: { bg: 'bg-[#E3F2FD]', text: 'text-[#2196F3]', border: 'border-[#2196F3]', label: 'High Performer' },
  7: { bg: 'bg-[#FFF9C4]', text: 'text-[#F9A825]', border: 'border-[#F9A825]', label: 'Rising Star' },
  8: { bg: 'bg-[#E3F2FD]', text: 'text-[#1565C0]', border: 'border-[#1565C0]', label: 'Strong Contributor' },
  9: { bg: 'bg-[#F3E5F5]', text: 'text-[#9C27B0]', border: 'border-[#9C27B0]', label: 'Top Talent' },
};
```

---

### 4. 캘리브레이션 — 9블록 매트릭스 (NP02)

**9블록 그리드 (인터랙티브):**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
  <div className="flex items-center justify-between mb-5">
    <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">
      9블록 매트릭스
    </h3>
    <div className="flex items-center gap-2">
      <button className="text-xs text-[#999] hover:text-[#666] flex items-center gap-1">
        <Sparkles size={12} className="text-[#00C853]" /> AI 분석
      </button>
    </div>
  </div>

  {/* 축 라벨 */}
  <div className="flex">
    {/* Y축 라벨 */}
    <div className="flex flex-col justify-between items-center w-8 mr-2 py-1">
      <span className="text-[10px] text-[#999] font-medium -rotate-90 whitespace-nowrap">
        역량 (Competency) →
      </span>
    </div>
    
    {/* 그리드 */}
    <div className="flex-1">
      <div className="grid grid-cols-3 gap-2">
        {/* 행 3 (역량 High) — 위에서 아래: 7, 8, 9 */}
        {[
          { block: 7, label: 'Rising Star', emoji: '🟡' },
          { block: 8, label: 'Strong Contributor', emoji: '🔵' },
          { block: 9, label: 'Top Talent', emoji: '🟣' },
        ].map(cell => (
          <button key={cell.block}
            className={`p-4 rounded-xl border-2 transition-all text-center
              hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]
              ${EMS_BLOCK_COLORS[cell.block].bg} ${EMS_BLOCK_COLORS[cell.block].border}`}
            onClick={() => setSelectedBlock(cell.block)}>
            <p className={`text-[10px] font-medium ${EMS_BLOCK_COLORS[cell.block].text}`}>
              {cell.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${EMS_BLOCK_COLORS[cell.block].text}`}>
              {blockCounts[cell.block]}명
            </p>
            <p className="text-[10px] text-[#999] mt-0.5">
              {blockPercentages[cell.block]}%
            </p>
            {/* 가이드라인 초과 경고 */}
            {isOverGuideline(cell.block) && (
              <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-[#F44336]">
                <AlertTriangle size={10} /> 초과
              </span>
            )}
          </button>
        ))}
        
        {/* 행 2 (역량 Mid) — 4, 5, 6 */}
        {[
          { block: 4, label: 'Dev Needed', emoji: '🟠' },
          { block: 5, label: 'Core Contributor', emoji: '🟢' },
          { block: 6, label: 'High Performer', emoji: '🔵' },
        ].map(cell => (
          <button key={cell.block}
            className={`p-4 rounded-xl border-2 transition-all text-center
              hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]
              ${EMS_BLOCK_COLORS[cell.block].bg} ${EMS_BLOCK_COLORS[cell.block].border}`}
            onClick={() => setSelectedBlock(cell.block)}>
            <p className={`text-[10px] font-medium ${EMS_BLOCK_COLORS[cell.block].text}`}>
              {cell.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${EMS_BLOCK_COLORS[cell.block].text}`}>
              {blockCounts[cell.block]}명
            </p>
            <p className="text-[10px] text-[#999] mt-0.5">
              {blockPercentages[cell.block]}%
            </p>
          </button>
        ))}
        
        {/* 행 1 (역량 Low) — 1, 2, 3 */}
        {[
          { block: 1, label: 'Under Performer', emoji: '🔴' },
          { block: 2, label: 'Inconsistent', emoji: '🟠' },
          { block: 3, label: 'Specialist', emoji: '🟡' },
        ].map(cell => (
          <button key={cell.block}
            className={`p-4 rounded-xl border-2 transition-all text-center
              hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]
              ${EMS_BLOCK_COLORS[cell.block].bg} ${EMS_BLOCK_COLORS[cell.block].border}`}
            onClick={() => setSelectedBlock(cell.block)}>
            <p className={`text-[10px] font-medium ${EMS_BLOCK_COLORS[cell.block].text}`}>
              {cell.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${EMS_BLOCK_COLORS[cell.block].text}`}>
              {blockCounts[cell.block]}명
            </p>
            <p className="text-[10px] text-[#999] mt-0.5">
              {blockPercentages[cell.block]}%
            </p>
          </button>
        ))}
      </div>
      
      {/* X축 라벨 */}
      <div className="flex justify-between mt-2 px-2">
        <span className="text-[10px] text-[#999]">Low</span>
        <span className="text-[10px] text-[#999] font-medium">성과 (Performance) →</span>
        <span className="text-[10px] text-[#999]">High</span>
      </div>
    </div>
  </div>
</div>
```

**블록 클릭 시 직원 카드 드롭다운:**
```jsx
{/* 선택된 블록의 직원 목록 */}
{selectedBlock && (
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 mt-4">
    <div className="flex items-center justify-between mb-4">
      <h4 className="text-sm font-bold text-[#1A1A1A]">
        블록 {selectedBlock} — {EMS_BLOCK_COLORS[selectedBlock].label}
        <span className="ml-2 text-xs text-[#999] font-normal">
          {blockCounts[selectedBlock]}명
        </span>
      </h4>
      <button onClick={() => setSelectedBlock(null)} 
        className="text-[#999] hover:text-[#666]">
        <X size={16} />
      </button>
    </div>
    
    <div className="space-y-2">
      {blockEmployees[selectedBlock]?.map(emp => (
        <div key={emp.id} 
          className="flex items-center justify-between p-3 rounded-lg border border-[#E8E8E8]
            hover:border-[#00C853] cursor-grab transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">{emp.name}</p>
              <p className="text-[11px] text-[#999]">{emp.department} · {emp.grade}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-[#999]">성과 <strong className="text-[#1A1A1A]">{emp.performanceScore}</strong></p>
              <p className="text-xs text-[#999]">역량 <strong className="text-[#1A1A1A]">{emp.competencyScore}</strong></p>
            </div>
            {/* 블록 조정 버튼 */}
            <button className="text-xs text-[#2196F3] hover:text-[#1565C0] font-medium">
              조정
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

**가이드라인 vs 실제 비교 바:**
```jsx
{/* 배분율 비교 — 9블록 매트릭스 우측 또는 하단 */}
<div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
  <h4 className="text-sm font-bold text-[#1A1A1A] mb-4">등급 배분율</h4>
  <div className="space-y-3">
    {[9, 8, 6, 5, 4, 1].map(block => (
      <div key={block}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#666]">블록 {block} ({EMS_BLOCK_COLORS[block].label})</span>
          <span className="text-xs font-semibold text-[#1A1A1A]">
            {blockPercentages[block]}% / {guidelines[block]}%
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-[#E8E8E8] overflow-hidden">
          {/* 실제 */}
          <div className={`absolute h-full rounded-full ${
            blockPercentages[block] > guidelines[block] ? 'bg-[#F44336]' : 'bg-[#00C853]'
          }`} style={{ width: `${blockPercentages[block]}%` }} />
          {/* 가이드라인 마커 */}
          <div className="absolute h-full w-0.5 bg-[#1A1A1A]" 
            style={{ left: `${guidelines[block]}%` }} />
        </div>
      </div>
    ))}
  </div>
</div>
```

---

### 5. 성과 결과 — EMPLOYEE 뷰 (§13 + NP01)

**결과 페이지 상단 — EMS 블록 히어로 카드:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
  {/* EMS 블록 — 대형 카드 (§13 grade-card) */}
  <div className={`border-2 ${EMS_BLOCK_COLORS[block].border} rounded-xl p-8 text-center
    ${EMS_BLOCK_COLORS[block].bg}`}>
    <p className="text-sm text-[#999] mb-2">EMS 블록</p>
    <p className={`text-5xl font-bold ${EMS_BLOCK_COLORS[block].text}`}>{block}</p>
    <p className={`text-base font-semibold mt-1 ${EMS_BLOCK_COLORS[block].text}`}>
      {EMS_BLOCK_COLORS[block].label}
    </p>
  </div>
  
  {/* 성과 점수 게이지 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 text-center">
    <p className="text-sm text-[#999] mb-2">성과 종합</p>
    <p className="text-4xl font-bold text-[#1A1A1A]">4.2</p>
    <p className="text-xs text-[#00C853] font-semibold mt-1">High</p>
    <div className="mt-3 h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-[#00C853] to-[#00BFA5]"
        style={{ width: '84%' }} />
    </div>
  </div>
  
  {/* 역량 점수 게이지 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 text-center">
    <p className="text-sm text-[#999] mb-2">역량 종합</p>
    <p className="text-4xl font-bold text-[#1A1A1A]">3.0</p>
    <p className="text-xs text-[#FF9800] font-semibold mt-1">Mid</p>
    <div className="mt-3 h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
      <div className="h-full rounded-full bg-[#FF9800]" style={{ width: '60%' }} />
    </div>
  </div>
</div>
```

**역량 레이더 차트 (자기 vs 매니저):**
```jsx
{/* Recharts RadarChart — §13 기반 */}
{/* stroke="#00C853" (매니저 평가), stroke="#E0E0E0" (자기 평가) */}
{/* fill="#00C853" fillOpacity={0.1} (매니저), fill="#E0E0E0" fillOpacity={0.1} (자기) */}
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
  <h4 className="text-sm font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">
    역량 비교 (자기평가 vs 매니저)
  </h4>
  {/* RadarChart 영역 */}
  <div className="flex justify-center">
    {/* <ResponsiveContainer width={300} height={300}> ... </ResponsiveContainer> */}
  </div>
  <div className="flex items-center justify-center gap-4 mt-3">
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-full bg-[#00C853]" />
      <span className="text-xs text-[#666]">매니저 평가</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-full bg-[#E0E0E0]" />
      <span className="text-xs text-[#666]">자기 평가</span>
    </div>
  </div>
</div>
```

---

### 6. CFR — 1:1 미팅 (P09 + NP01)

**1:1 미팅 기록 — 리치텍스트 + 사이드 컨텍스트:**
```
┌──────────────────────┬──────────────┐
│ 1:1 미팅 노트        │ 👤 김상우     │
│ [B][i][U][🔗][≡]    │ 직급: 과장    │
│ ## 이번 주 회고        │ ──────────  │
│ ...                  │ 📊 목표 현황  │
│ ✅ 액션 아이템         │ 🎯 75% 달성  │
│ ☐ API문서 @박OO      │ ──────────  │
│                      │ 🤖 추천 질문  │
│ [AI 요약 생성 🤖]     │ 📝 비밀메모   │
└──────────────────────┴──────────────┘
```

**사이드 컨텍스트 패널:**
```jsx
<aside className="w-72 border-l border-[#E8E8E8] bg-[#FAFAFA] p-5 flex-shrink-0">
  {/* 직원 프로필 — R2 패턴 */}
  <div className="text-center mb-4 pb-4 border-b border-[#F0F0F0]">
    <div className="w-12 h-12 rounded-full bg-[#E8E8E8] mx-auto mb-2" />
    <p className="text-sm font-bold text-[#1A1A1A]">김상우</p>
    <p className="text-xs text-[#999]">인사팀 · 과장</p>
  </div>
  
  {/* 목표 현황 */}
  <div className="mb-4 pb-4 border-b border-[#F0F0F0]">
    <p className="text-xs font-semibold text-[#999] mb-2">MBO 목표</p>
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#333]">매출 30% 성장</span>
          <span className="font-semibold text-[#00C853]">75%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#E8E8E8]">
          <div className="h-full rounded-full bg-[#00C853]" style={{ width: '75%' }} />
        </div>
      </div>
    </div>
  </div>
  
  {/* AI 추천 질문 */}
  <div className="mb-4 pb-4 border-b border-[#F0F0F0]">
    <div className="flex items-center gap-1.5 mb-2">
      <Sparkles size={12} className="text-[#00C853]" />
      <p className="text-xs font-semibold text-[#2E7D32]">AI 추천 질문</p>
    </div>
    <div className="p-3 bg-[#F1F8E9] rounded-lg border border-[#C8E6C9]">
      <ul className="text-xs text-[#333] space-y-1.5">
        <li>• 매출 목표 75% 달성 중 어려운 점은?</li>
        <li>• 다음 분기 집중하고 싶은 영역은?</li>
      </ul>
    </div>
  </div>
  
  {/* 비밀 메모 (매니저 전용) */}
  <div className="p-3 bg-[#FFF8E1] rounded-lg border-l-2 border-[#FFB300]">
    <p className="text-xs font-semibold text-[#F57F17] mb-1">비밀 메모</p>
    <p className="text-xs text-[#666]">성과 우수하나 팀 협업 시 소통 부족 경향...</p>
  </div>
</aside>
```

**1:1 대시보드 KPI:**
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">이번 달 완료</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">12회</p>
    <span className="text-xs font-semibold text-[#00C853]">↑ 3회 전월 대비</span>
  </div>
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">예정</p>
    <p className="text-3xl font-bold text-[#2196F3] tracking-[-0.02em]">4회</p>
    <span className="text-xs text-[#999]">이번 주</span>
  </div>
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">미진행 팀원</p>
    <p className="text-3xl font-bold text-[#F44336] tracking-[-0.02em]">2명</p>
    <span className="text-xs text-[#F44336]">30일+ 미실시</span>
  </div>
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">미완료 액션</p>
    <p className="text-3xl font-bold text-[#FF9800] tracking-[-0.02em]">7건</p>
    <span className="text-xs text-[#999]">전체 팀원</span>
  </div>
</div>
```

---

### 7. CFR — Recognition 피드 (소셜 카드)

```jsx
<div className="space-y-4">
  {/* Recognition 카드 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-[#E8E8E8] flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm font-bold text-[#1A1A1A]">박OO</span>
          <span className="text-xs text-[#999]">→</span>
          <span className="text-sm font-bold text-[#1A1A1A]">김OO</span>
        </div>
        
        {/* CTR 핵심가치 태그 */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded
          bg-[#E8F5E9] text-[#00C853] text-xs font-semibold mb-2">
          🎯 도전 (Challenge)
        </span>
        
        <p className="text-sm text-[#333] leading-relaxed">
          Q4 목표 달성을 위해 주말에도 고객 미팅에 참석하는 열정에 감사드립니다.
          덕분에 팀 전체가 동기부여를 받았습니다!
        </p>
        
        <div className="flex items-center justify-between mt-3">
          <button className="flex items-center gap-1.5 text-xs text-[#999] hover:text-[#00C853]">
            👍 <span>3</span>
          </button>
          <span className="text-xs text-[#BDBDBD]">2시간 전</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

### 8. Pulse Survey — 결과 대시보드 (P10 + NP01)

**Pulse 결과 대시보드:**
```jsx
{/* 응답률 + 카테고리 평균 KPI */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">응답률</p>
    <p className="text-3xl font-bold text-[#00C853] tracking-[-0.02em]">87%</p>
    <div className="mt-2 h-2 rounded-full bg-[#E8E8E8]">
      <div className="h-full rounded-full bg-[#00C853]" style={{ width: '87%' }} />
    </div>
  </div>
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">전체 만족도</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">3.8 / 5</p>
    <span className="text-xs font-semibold text-[#00C853]">↑ 0.2 전월 대비</span>
  </div>
  {/* ... 추가 KPI ... */}
</div>

{/* 차트 2열 그리드 — P10 */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* 카테고리별 Radar Chart */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <h4 className="text-sm font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">
      카테고리별 평균
    </h4>
    {/* RadarChart: stroke="#00C853" (이번), stroke="#E0E0E0" (지난) */}
  </div>
  
  {/* 추이 Line Chart */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <h4 className="text-sm font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">
      월별 추이
    </h4>
    {/* LineChart: stroke="#00C853" */}
  </div>
</div>
```

**AI Pulse 분석 (NP01):**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mt-6">
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
        <Sparkles size={16} className="text-[#00C853]" />
      </div>
      <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">
        AI 인사이트
      </h3>
    </div>
    {/* 센티먼트 뱃지 */}
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
      bg-[#FFF3E0] text-[#FF9800]">
      ⚠ MIXED
    </span>
  </div>
  
  {/* 핵심 발견 */}
  <div className="p-4 bg-[#F1F8E9] rounded-lg border border-[#C8E6C9] mb-4">
    <p className="text-xs font-semibold text-[#2E7D32] mb-2">핵심 발견</p>
    <ul className="text-xs text-[#333] space-y-1">
      <li>• 팀 내 심리적 안전감 점수가 전월 대비 0.5점 하락</li>
      <li>• 매니저 지원 만족도는 4.2로 양호</li>
    </ul>
  </div>
  
  {/* 위험 영역 */}
  <div className="p-4 bg-[#FFEBEE] rounded-lg border border-[#FFCDD2]">
    <p className="text-xs font-semibold text-[#F44336] mb-2">위험 영역</p>
    <ul className="text-xs text-[#333] space-y-1">
      <li>• 업무량 적절성 2.8점 — 개선 필요</li>
      <li>• 이직 고려 응답 15% (전월 8%)</li>
    </ul>
  </div>
</div>
```

---

### 9. 다면평가 (360°) — 평가자 추천 + AI 요약

**AI 추천 평가자 패널:**
```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
  <div className="flex items-center gap-2 mb-4">
    <div className="w-6 h-6 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
      <Sparkles size={14} className="text-[#00C853]" />
    </div>
    <h4 className="text-sm font-bold text-[#1A1A1A]">AI 추천 평가자</h4>
    {/* 데이터 커버리지 뱃지 */}
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded
      bg-[#E8F5E9] text-[#00C853]">데이터 기반</span>
  </div>
  
  <div className="space-y-2">
    {recommendations.map(rec => (
      <div key={rec.employee_id}
        className="flex items-center justify-between p-3 rounded-lg border border-[#E8E8E8]
          hover:border-[#00C853] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
          <div>
            <p className="text-sm font-medium text-[#1A1A1A]">{rec.name}</p>
            <p className="text-[11px] text-[#999]">{rec.department} · {rec.job_grade}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 추천 점수 바 */}
          <div className="w-16 h-1.5 rounded-full bg-[#E8E8E8] overflow-hidden">
            <div className="h-full rounded-full bg-[#00C853]"
              style={{ width: `${rec.final_score}%` }} />
          </div>
          <span className="text-xs font-bold text-[#1A1A1A] w-8 text-right">
            {rec.final_score}
          </span>
          {/* 승인/제외 */}
          <button className="w-7 h-7 rounded-lg bg-[#E8F5E9] text-[#00C853] 
            hover:bg-[#00C853] hover:text-white transition-colors flex items-center justify-center">
            <CheckCircle2 size={14} />
          </button>
          <button className="w-7 h-7 rounded-lg bg-[#FFEBEE] text-[#F44336]
            hover:bg-[#F44336] hover:text-white transition-colors flex items-center justify-center">
            <XCircle size={14} />
          </button>
        </div>
      </div>
    ))}
  </div>
</div>
```

---

### 10. AI 분석 공통 카드 (NP01 — 전 모듈 공용)

**AI 코멘트 제안 (평가, 캘리브레이션, 1:1, Pulse 공용):**
```jsx
{/* AI 제안 트리거 버튼 */}
<button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
  bg-[#E8F5E9] text-[#00C853] hover:bg-[#C8E6C9] border border-[#C8E6C9] transition-colors">
  <Sparkles size={16} />
  AI 코멘트 제안
</button>

{/* AI 생성 결과 — AiGeneratedBadge */}
<div className="p-4 bg-[#F1F8E9] rounded-lg border border-[#C8E6C9] mt-4">
  <div className="flex items-center gap-2 mb-3">
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded
      bg-[#E8F5E9] text-[#00C853] text-[10px] font-bold border border-[#C8E6C9]">
      🤖 AI 생성
    </span>
    <span className="text-[10px] text-[#999]">수정 가능</span>
  </div>
  
  {/* AI 코멘트 내용 — editable */}
  <textarea className="w-full px-3 py-2 border border-[#C8E6C9] rounded-lg text-sm 
    text-[#333] bg-white focus:border-[#00C853] focus:outline-none 
    focus:ring-2 focus:ring-[#00C853]/10 resize-none h-24"
    defaultValue={aiComment}
  />
  
  {/* 강점 / 개선영역 / 권장액션 */}
  <div className="grid grid-cols-3 gap-3 mt-3">
    <div className="p-2.5 bg-white rounded-lg border border-[#E8E8E8]">
      <p className="text-[10px] font-semibold text-[#00C853] mb-1">💪 강점</p>
      <ul className="text-[11px] text-[#333] space-y-0.5">
        {strengths.map(s => <li key={s}>• {s}</li>)}
      </ul>
    </div>
    <div className="p-2.5 bg-white rounded-lg border border-[#E8E8E8]">
      <p className="text-[10px] font-semibold text-[#FF9800] mb-1">📈 개선 영역</p>
      <ul className="text-[11px] text-[#333] space-y-0.5">
        {areas.map(a => <li key={a}>• {a}</li>)}
      </ul>
    </div>
    <div className="p-2.5 bg-white rounded-lg border border-[#E8E8E8]">
      <p className="text-[10px] font-semibold text-[#2196F3] mb-1">🎯 권장 액션</p>
      <ul className="text-[11px] text-[#333] space-y-0.5">
        {actions.map(a => <li key={a}>• {a}</li>)}
      </ul>
    </div>
  </div>
</div>
```

---

## 리팩토링 체크리스트

### 컬러 전환 (전 모듈 공통)
- [ ] Primary 버튼: `bg-blue-600` → `bg-[#00C853] hover:bg-[#00A844]`
- [ ] 인풋 focus: `ring-blue-500` → `border-[#00C853] ring-[#00C853]/10`
- [ ] 카드: `shadow-sm` 제거 → `border border-[#E8E8E8]` only
- [ ] 텍스트: slate 계열 → `#1A1A1A` / `#666` / `#999`
- [ ] 배경: `bg-slate-50` → `bg-[#FAFAFA]`

### 평가 사이클 관리
- [ ] 사이클 상태 머신 스텝 위저드: P06 패턴 + green 색상
- [ ] 사이클 목록 테이블: P03 패턴 (R1 동일)
- [ ] 사이클 상태 뱃지: 7종 컬러 매핑 (CYCLE_STATUS)

### MBO 목표 (P08)
- [ ] 목표 트리: border-l-4 컬러 바 (Objective=green, KR=blue)
- [ ] 프로그레스 바: §11 gradient (green→teal), 구간별 색상 분기
- [ ] 가중치 합계 100% 검증 UI
- [ ] 카테고리 필 탭: FLEX 스타일 (bg-[#1A1A1A] active)
- [ ] 승인 상태 뱃지: GOAL_STATUS 4종

### 성과 평가 (§13)
- [ ] 역량 항목: border-l-4 점수별 컬러 (§13 competency-item)
- [ ] 5점 스케일 버튼: 선택시 bg-[#00C853] text-white
- [ ] 좌우 분할: 자기평가(bg-[#FAFAFA] 읽기전용) vs 매니저(white 입력)
- [ ] EMS 블록 미리보기: 3열 그리드 (grade-card 패턴)
- [ ] EMS 블록 색상: 9종 매핑 (EMS_BLOCK_COLORS)

### 캘리브레이션 (NP02)
- [ ] 9블록 매트릭스: 3×3 인터랙티브 그리드
- [ ] 블록 셀: 각 블록 고유 색상 + 인원수 + 비율%
- [ ] 가이드라인 초과 경고: AlertTriangle + text-[#F44336]
- [ ] 블록 클릭 → 직원 목록 드롭다운 (드래그 가능)
- [ ] 배분율 비교 바: 실제 vs 가이드라인 마커
- [ ] 조정 모달: from_block → to_block + 사유

### 성과 결과
- [ ] EMS 블록 히어로 카드: 대형 (text-5xl), 블록별 색상
- [ ] 성과/역량 게이지: 프로그레스 바 + 점수
- [ ] 역량 레이더 차트: stroke="#00C853" (매니저) / "#E0E0E0" (자기)
- [ ] 목표별 달성률 리스트
- [ ] 매니저 종합 코멘트 표시

### 1:1 미팅 (P09)
- [ ] 리치텍스트 + 사이드 컨텍스트 레이아웃
- [ ] 사이드: 직원 프로필 + 목표 진행률 + AI 추천 질문 + 비밀메모
- [ ] 비밀메모: bg-[#FFF8E1] border-l-2 border-[#FFB300]
- [ ] AI 추천 질문: bg-[#F1F8E9] border-[#C8E6C9]
- [ ] 액션 아이템: 체크박스 + 담당자 + 기한
- [ ] 미진행 팀원 하이라이트: 30일+ → text-[#F44336]
- [ ] 1:1 대시보드 KPI: P02 패턴

### Recognition
- [ ] 소셜 피드 카드: border border-[#E8E8E8] rounded-xl
- [ ] CTR 핵심가치 태그: bg-[#E8F5E9] text-[#00C853]
- [ ] 좋아요 버튼: hover시 text-[#00C853]
- [ ] 보내기 모달: 핵심가치 필수 선택 UI
- [ ] 프로필 핵심가치 분포 도넛 차트

### Pulse Survey
- [ ] 설문 목록 테이블: P03 패턴
- [ ] 응답 폼: 별점 5개 / 슬라이더 / 토글 / textarea / 라디오
- [ ] 결과 대시보드: P10 패턴 (2열 차트 그리드)
- [ ] Radar + Line + Histogram 차트: 색상 #00C853 기반
- [ ] AI 인사이트: NP01 패턴 + 센티먼트 뱃지

### 다면평가 (360°)
- [ ] AI 추천 평가자: 추천 점수 바 + 승인/제외 버튼
- [ ] 데이터 기반 / 규칙 기반 뱃지
- [ ] 익명 안내 문구 스타일
- [ ] 결과 레이더 차트: 자기 vs 동료 vs 전사평균

### AI 공통 (NP01)
- [ ] AI 트리거 버튼: bg-[#E8F5E9] text-[#00C853] border-[#C8E6C9]
- [ ] AiGeneratedBadge: 🤖 AI 생성 + "수정 가능"
- [ ] AI 코멘트 영역: bg-[#F1F8E9] border-[#C8E6C9]
- [ ] 강점/개선/액션: 3열 그리드 미니 카드

---

## ⚠️ 주의사항

1. **기능 변경 금지** — EMS 블록 산출 로직, AI API 호출, 사이클 상태 머신, 승인 플로우 일체 유지
2. **lib/ 유틸 건드리지 않음** — `lib/ems.ts`, `lib/claude.ts`, `lib/collaboration-score.ts`, `lib/peer-recommend.ts` 등 로직 파일 수정 금지
3. **Recharts 차트** — 색상만 변경 (stroke/fill), 데이터 로직 유지
4. **dnd-kit** — 캘리브레이션 드래그앤드롭 라이브러리 유지, 스타일 오버라이드만
5. **Tiptap** — 1:1 리치텍스트 에디터 유지, 래퍼 스타일만 변경
6. **CTR_DESIGN_SYSTEM §13** — 평가 전용 패턴(역량 컬러바, grade-card, 등급 분포) 반드시 참조
7. **STEP 1~5는 건드리지 않음** — R1~R5에서 이미 처리 완료
8. **타입체크 유지** — `npx tsc --noEmit` 0 errors

---

## 실행 순서 (권장)

```
1. 상태 뱃지 상수 정의 (CYCLE_STATUS, GOAL_STATUS, EMS_BLOCK_COLORS)
2. 평가 사이클 관리 — 상태 머신 위저드 + 테이블 리팩
3. MBO 목표 — 트리 테이블(P08) + 프로그레스 바 + 승인 상태 리팩
4. 자기평가 폼 — 역량 항목 §13 + 5점 스케일 리팩
5. 매니저 평가 — 좌우 분할 + EMS 블록 미리보기 리팩
6. 캘리브레이션 — 9블록 매트릭스(NP02) + 배분율 비교 리팩
7. 성과 결과 — EMS 히어로 카드 + 레이더 차트 리팩
8. 1:1 미팅 — 리치텍스트+사이드(P09) + AI 추천 질문 리팩
9. Recognition — 소셜 피드 카드 + 핵심가치 태그 리팩
10. Pulse Survey — 결과 대시보드(P10) + AI 인사이트(NP01) 리팩
11. 다면평가 — AI 추천 평가자 패널 + 결과 차트 리팩
12. 타입체크 + 비주얼 검증
```
