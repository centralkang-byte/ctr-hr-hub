# R5: STEP 5 디자인 리팩토링 — 채용 ATS + 징계·포상

## 세션 목표

STEP 5에서 구현한 **채용 ATS(공고 관리, 지원자 파이프라인, 면접 평가, AI 스크리닝), 징계·포상 관리** 페이지를 CTR_DESIGN_SYSTEM.md (FLEX 스타일) 기반으로 리팩토링.
**기능 변경 없음. 비주얼 일관성만 확보.**
**R1~R4에서 적용한 공통 컴포넌트 그대로 사용.**

---

## 필수 참조 파일

```
1. CLAUDE.md                 → 프로젝트 컨텍스트 + 디자인 토큰
2. CTR_DESIGN_SYSTEM.md      → FLEX 스타일 디자인 시스템 (타겟) — 특히 §12 채용 퍼널 전용 패턴
3. CTR_UI_PATTERNS.md        → P07(파이프라인 퍼널/칸반), NP01(AI 분석 리포트), P02, P03
4. R1~R4 결과물              → 공통 UI 컴포넌트 변경사항 확인
```

---

## 리팩토링 대상 파일

> 실제 파일명은 프로젝트에서 확인 필요.

| 파일 (예상) | 내용 |
|------------|------|
| `src/app/(dashboard)/recruitment/page.tsx` | 채용 메인 (공고 목록) |
| `src/app/(dashboard)/recruitment/RecruitmentClient.tsx` | 채용 클라이언트 |
| `src/app/(dashboard)/recruitment/[id]/page.tsx` | 공고 상세 (파이프라인) |
| `src/app/(dashboard)/recruitment/[id]/RecruitmentDetailClient.tsx` | 파이프라인 클라이언트 |
| `src/app/(dashboard)/recruitment/applicants/[id]/...` | 지원자 상세 |
| `src/app/(dashboard)/discipline/page.tsx` | 징계·포상 목록 |
| `src/app/(dashboard)/discipline/DisciplineClient.tsx` | 징계·포상 클라이언트 |
| 관련 모달/폼 컴포넌트 | 공고 생성, 면접 평가, AI 스크리닝 결과 등 |

---

## 핵심 패턴 매핑

| 패턴 | 적용 위치 |
|------|----------|
| **P07** 파이프라인 퍼널/칸반 | 채용 파이프라인 (8단계) |
| **NP01** AI 분석 리포트 카드 | AI 스크리닝 결과, 면접 분석 |
| **P02** KPI 카드 그리드 | 채용 대시보드 (공고수, 지원자수 등) |
| **P03** 데이터 테이블 | 공고 목록, 지원자 목록, 징계·포상 목록 |
| **P01** 마스터-디테일 | 지원자 상세 |

---

## 컴포넌트별 상세 지침

### 1. 채용 대시보드 — KPI + 공고 목록

**페이지 구조:**
```
┌─────────────────────────────────────────┐
│ 채용 관리            [+ 공고 등록]        │
│ 진행 중인 채용 현황                       │
├─────────────────────────────────────────┤
│ [진행중 5건] [총 지원 127명] [면접예정 8명] [합격 3명] │
├─────────────────────────────────────────┤
│ [전체│진행중│마감│임시저장]                 │
├─────────────────────────────────────────┤
│ 공고 목록 테이블/카드                      │
└─────────────────────────────────────────┘
```

**KPI 카드:**
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">진행중 공고</p>
    <p className="text-3xl font-bold text-[#2196F3] tracking-[-0.02em]">5건</p>
    <span className="text-xs text-[#999]">3개 부서</span>
  </div>

  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">총 지원자</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">127명</p>
    <span className="text-xs font-semibold text-[#00C853]">↑ 23명 전주 대비</span>
  </div>

  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">면접 예정</p>
    <p className="text-3xl font-bold text-[#FF9800] tracking-[-0.02em]">8명</p>
    <span className="text-xs text-[#999]">이번 주</span>
  </div>

  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">합격</p>
    <p className="text-3xl font-bold text-[#00C853] tracking-[-0.02em]">3명</p>
    <span className="text-xs text-[#999]">이번 달 누적</span>
  </div>
</div>
```

**공고 목록 (카드 뷰 옵션):**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 
    hover:border-[#00C853] transition-colors cursor-pointer">
    {/* 상단: 상태 + D-day */}
    <div className="flex items-center justify-between mb-3">
      <span className="inline-flex items-center px-2.5 py-0.5 
        rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold">
        진행중
      </span>
      <span className="text-xs font-semibold text-[#F44336]">D-12</span>
    </div>

    {/* 제목 */}
    <h3 className="text-sm font-bold text-[#1A1A1A] tracking-[-0.02em] mb-1">
      프론트엔드 개발자 (시니어)
    </h3>
    <p className="text-xs text-[#999] mb-3">개발팀 · CTR-KR</p>

    {/* 퍼널 미니 요약 */}
    <div className="flex items-center gap-1 text-[11px] text-[#999]">
      <span>접수 <strong className="text-[#1A1A1A]">24</strong></span>
      <span className="text-[#E0E0E0]">›</span>
      <span>서류 <strong className="text-[#1A1A1A]">8</strong></span>
      <span className="text-[#E0E0E0]">›</span>
      <span>면접 <strong className="text-[#1A1A1A]">3</strong></span>
      <span className="text-[#E0E0E0]">›</span>
      <span>합격 <strong className="text-[#00C853]">1</strong></span>
    </div>

    {/* 하단: 담당자 + 날짜 */}
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F0F0F0]">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#E8E8E8]" />
        <span className="text-xs text-[#666]">김OO</span>
      </div>
      <span className="text-xs text-[#999]">02.15 ~ 03.15</span>
    </div>
  </div>
</div>
```

### 2. 채용 파이프라인 — 퍼널 + 칸반 (P07)

**퍼널 시각화 (상단):**
```jsx
{/* CTR_DESIGN_SYSTEM §12 기반 */}
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
  <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">
    프론트엔드 개발자 (시니어)
  </h3>

  {/* 퍼널 스테이지 — 수평 */}
  <div className="flex items-center gap-2 overflow-x-auto pb-2">
    {[
      { label: '접수', count: 24, active: false },
      { label: '서류평가', count: 8, active: false },
      { label: 'Tech 면접', count: 5, active: true },
      { label: 'Fit 면접', count: 3, active: false },
      { label: '처우협의', count: 1, active: false },
      { label: '합격', count: 1, active: false },
    ].map((stage, i, arr) => (
      <div key={stage.label} className="flex items-center">
        <div className={`flex flex-col items-center px-4 py-3 rounded-lg min-w-[80px]
          ${stage.active 
            ? 'bg-[#E8F5E9] border border-[#00C853]' 
            : 'bg-[#F5F5F5]'}`}>
          <span className={`text-xs font-medium mb-1 ${
            stage.active ? 'text-[#00C853]' : 'text-[#999]'
          }`}>{stage.label}</span>
          <span className={`text-xl font-bold ${
            stage.active ? 'text-[#00C853]' : 'text-[#1A1A1A]'
          }`}>{stage.count}</span>
        </div>
        {i < arr.length - 1 && (
          <ChevronRight size={16} className="text-[#E0E0E0] mx-1 flex-shrink-0" />
        )}
      </div>
    ))}
  </div>
</div>
```

**칸반 보드:**
```jsx
<div className="flex gap-4 overflow-x-auto pb-4">
  {stages.map(stage => (
    <div key={stage.id} className="flex-shrink-0 w-[280px]">
      {/* 칼럼 헤더 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-[#1A1A1A]">{stage.label}</h4>
          <span className="text-xs text-[#999] bg-[#F5F5F5] px-2 py-0.5 rounded-full">
            {stage.candidates.length}
          </span>
        </div>
        <button className="text-[#999] hover:text-[#666]">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* 칸반 카드 영역 — 드롭 존 */}
      <div className="space-y-2 min-h-[200px] p-2 bg-[#FAFAFA] rounded-xl 
        border-2 border-dashed border-transparent
        [&.drag-over]:border-[#00C853] [&.drag-over]:bg-[#E8F5E9]/30">
        
        {stage.candidates.map(candidate => (
          <div key={candidate.id} 
            className="bg-white border border-[#E8E8E8] rounded-lg p-3 
              cursor-grab active:cursor-grabbing hover:border-[#00C853] 
              hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all">
            {/* 이름 + 점수 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E8E8E8]" />
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{candidate.name}</p>
                  <p className="text-[11px] text-[#999]">{candidate.position}</p>
                </div>
              </div>
              {candidate.aiScore && (
                <span className="text-xs font-bold text-[#00C853] bg-[#E8F5E9] 
                  px-1.5 py-0.5 rounded">
                  ⭐ {candidate.aiScore}
                </span>
              )}
            </div>

            {/* 태그 */}
            <div className="flex items-center gap-1.5 mb-2">
              {candidate.tags?.map(tag => (
                <span key={tag} className="text-[10px] text-[#999] bg-[#F5F5F5] 
                  px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>

            {/* 하단: 경과일 + 중복지원 */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#999]">
                {candidate.daysInStage}일 경과
              </span>
              {candidate.isDuplicate && (
                <span className="text-[10px] font-semibold text-[#E65100] 
                  bg-[#FFF3E0] px-1.5 py-0.5 rounded">
                  중복지원
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  ))}

  {/* 탈락 영역 */}
  <div className="flex-shrink-0 w-[280px]">
    <div className="flex items-center gap-2 mb-3 px-1">
      <h4 className="text-sm font-bold text-[#F44336]">탈락</h4>
      <span className="text-xs text-[#999] bg-[#FFEBEE] px-2 py-0.5 rounded-full">
        {rejected.length}
      </span>
    </div>
    <div className="space-y-2 min-h-[200px] p-2 bg-[#FFEBEE]/30 rounded-xl">
      {rejected.map(c => (
        <div key={c.id} className="bg-white border border-[#FFCDD2] rounded-lg p-3 opacity-70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#E8E8E8]" />
            <div>
              <p className="text-sm text-[#999] line-through">{c.name}</p>
              <p className="text-[11px] text-[#BDBDBD]">{c.rejectReason}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

### 3. 지원자 상세 — 마스터-디테일 (P01)

```
┌──────────────────────────────────────────────┐
│ ← 파이프라인    지원자 상세    [평가입력] [⋮]  │
├──────────────┬───────────────────────────────┤
│ 프로필 (w-72) │ [이력서│평가│AI분석│면접│타임라인]│
│              ├───────────────────────────────┤
│ [사진]       │ 탭 콘텐츠                      │
│ 이름         │                              │
│ 포지션        │                              │
│ ──────      │                              │
│ 📧 이메일    │                              │
│ 📱 연락처    │                              │
│ ──────      │                              │
│ AI 점수: 4.2 │                              │
│ 현재: Tech면접│                              │
│ ──────      │                              │
│ [합격] [탈락] │                              │
└──────────────┴───────────────────────────────┘
```

**지원자 프로필 사이드바:**
```jsx
<aside className="w-72 border-r border-[#E8E8E8] bg-white p-6 flex-shrink-0">
  <div className="text-center mb-5">
    <div className="w-[72px] h-[72px] rounded-full bg-[#E8E8E8] mx-auto mb-3" />
    <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">홍OO</h2>
    <p className="text-sm text-[#999] mt-0.5">프론트엔드 개발자 지원</p>
  </div>

  <div className="divide-y divide-[#F0F0F0]">
    {/* 연락처 */}
    <div className="py-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <Mail size={14} className="text-[#999]" />
        <span className="text-sm text-[#333]">hong@email.com</span>
      </div>
      <div className="flex items-center gap-2">
        <Phone size={14} className="text-[#999]" />
        <span className="text-sm text-[#333]">010-9876-5432</span>
      </div>
    </div>

    {/* AI 점수 */}
    <div className="py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#999]">AI 적합도</span>
        <div className="flex items-center gap-1">
          <Sparkles size={12} className="text-[#00C853]" />
          <span className="text-sm font-bold text-[#00C853]">4.2 / 5.0</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#00C853] to-[#00BFA5]"
          style={{ width: '84%' }} />
      </div>
    </div>

    {/* 현재 단계 */}
    <div className="py-4">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-[#999]">현재 단계</span>
        <span className="text-xs font-semibold text-[#2196F3] bg-[#E3F2FD] 
          px-2 py-0.5 rounded">Tech 면접</span>
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-[#999]">지원일</span>
        <span className="text-xs text-[#666]">2026.02.20</span>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[#999]">경과</span>
        <span className="text-xs text-[#666]">9일</span>
      </div>
    </div>

    {/* 액션 버튼 */}
    <div className="py-4 space-y-2">
      <button className="w-full py-2.5 bg-[#00C853] hover:bg-[#00A844] text-white 
        rounded-lg text-sm font-semibold">
        다음 단계로 이동
      </button>
      <button className="w-full py-2.5 border border-[#F44336] text-[#F44336] 
        rounded-lg text-sm font-semibold hover:bg-[#FFEBEE]">
        탈락 처리
      </button>
    </div>
  </div>
</aside>
```

### 4. AI 분석 리포트 (NP01)

```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
  {/* 헤더 */}
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
        <Sparkles size={16} className="text-[#00C853]" />
      </div>
      <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">
        AI 분석 리포트
      </h3>
    </div>
    <button className="text-xs text-[#999] hover:text-[#666] flex items-center gap-1">
      <RefreshCw size={12} /> 재분석
    </button>
  </div>

  {/* 역량 점수 바 */}
  <div className="space-y-3 mb-5">
    {[
      { label: '기술역량', score: 92, color: '#00C853' },
      { label: '커뮤니케이션', score: 78, color: '#2196F3' },
      { label: '문제해결', score: 85, color: '#00C853' },
      { label: '문화적합', score: 65, color: '#FF9800' },
      { label: '성장잠재력', score: 88, color: '#00C853' },
    ].map(item => (
      <div key={item.label}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#666]">{item.label}</span>
          <span className="text-xs font-bold" style={{ color: item.color }}>
            {item.score}점
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${item.score}%`, background: item.color }} />
        </div>
      </div>
    ))}
  </div>

  {/* AI 코멘트 */}
  <div className="p-4 bg-[#F1F8E9] rounded-lg border border-[#C8E6C9]">
    <div className="flex items-start gap-2">
      <Sparkles size={14} className="text-[#00C853] mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold text-[#2E7D32] mb-1">AI 종합 의견</p>
        <p className="text-xs text-[#666] leading-relaxed">
          기술역량과 문제해결 능력이 우수합니다. 다만 문화적합 항목이 평균 이하로,
          Fit 면접에서 팀 협업 경험을 중점적으로 확인하는 것을 추천합니다.
          멘토링 역할 부여 시 조직 적응이 빠를 것으로 예상됩니다.
        </p>
      </div>
    </div>
  </div>

  {/* 레이더 차트 자리 (Recharts) */}
  <div className="mt-5 flex justify-center">
    {/* <RadarChart ...> stroke="#00C853" (지원자), stroke="#E0E0E0" (평균) */}
    <div className="w-48 h-48 bg-[#FAFAFA] rounded-xl flex items-center justify-center">
      <span className="text-xs text-[#999]">역량 레이더 차트</span>
    </div>
  </div>
</div>
```

### 5. 면접 평가 입력 모달

```jsx
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
  <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden
    shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
    {/* 헤더 */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
      <div>
        <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">면접 평가</h2>
        <p className="text-xs text-[#999] mt-0.5">홍OO · Tech 면접</p>
      </div>
      <button className="text-[#999] hover:text-[#666]"><X size={20} /></button>
    </div>

    {/* 바디 (스크롤) */}
    <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-6">
      {/* 역량 평가 항목 */}
      {[
        { id: 'tech', label: '기술역량', desc: '직무 관련 기술 수준' },
        { id: 'problem', label: '문제해결', desc: '논리적 사고와 문제 접근 방식' },
        { id: 'comm', label: '커뮤니케이션', desc: '의사소통 능력과 표현력' },
        { id: 'culture', label: '문화적합', desc: 'CTR 핵심가치 부합도' },
      ].map(comp => (
        <div key={comp.id} className="border-l-4 border-[#00C853] pl-4">
          <p className="text-sm font-semibold text-[#1A1A1A]">{comp.label}</p>
          <p className="text-xs text-[#999] mb-3">{comp.desc}</p>
          
          {/* 5점 스케일 */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(score => (
              <button key={score}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                  scores[comp.id] === score
                    ? 'bg-[#00C853] text-white'
                    : 'bg-[#F5F5F5] text-[#666] hover:bg-[#E8E8E8]'
                }`}>
                {score}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* 종합 코멘트 */}
      <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
          종합 의견
        </label>
        <textarea className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
          focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10
          resize-none h-24 placeholder:text-[#BDBDBD]"
          placeholder="지원자에 대한 종합 의견을 작성하세요"
        />
      </div>

      {/* 합격 추천 */}
      <div>
        <p className="text-sm font-medium text-[#1A1A1A] mb-2">추천 결과</p>
        <div className="flex items-center gap-3">
          {['강력 추천', '추천', '보류', '비추천'].map(rec => (
            <button key={rec}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                recommendation === rec
                  ? rec.includes('추천') 
                    ? 'bg-[#E8F5E9] border-[#00C853] text-[#00C853]'
                    : rec === '보류'
                    ? 'bg-[#FFF3E0] border-[#FF9800] text-[#FF9800]'
                    : 'bg-[#FFEBEE] border-[#F44336] text-[#F44336]'
                  : 'bg-white border-[#E0E0E0] text-[#666] hover:bg-[#F5F5F5]'
              }`}>
              {rec}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* 푸터 */}
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E8E8E8]">
      <button className="px-4 py-2.5 border border-[#E0E0E0] rounded-lg text-sm 
        font-medium text-[#333] hover:bg-[#F5F5F5]">임시저장</button>
      <button className="px-4 py-2.5 bg-[#00C853] hover:bg-[#00A844] rounded-lg text-sm 
        font-semibold text-white">제출</button>
    </div>
  </div>
</div>
```

### 6. 징계·포상 목록 (P03)

```jsx
{/* 유형 뱃지 */}
const DISCIPLINE_TYPE = {
  포상:     'bg-[#E8F5E9] text-[#00C853]',
  표창:     'bg-[#E3F2FD] text-[#2196F3]',
  경고:     'bg-[#FFF3E0] text-[#FF9800]',
  견책:     'bg-[#FFEBEE] text-[#E53935]',
  감봉:     'bg-[#FFEBEE] text-[#F44336]',
  정직:     'bg-[#FFEBEE] text-[#B71C1C]',
  해고:     'bg-[#FFCDD2] text-[#B71C1C]',
};

{/* 테이블 */}
<div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-[#E8E8E8]">
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">대상자</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">유형</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">구분</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">사유</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">일자</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">상태</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
            <span className="text-sm font-medium text-[#1A1A1A]">김OO</span>
          </div>
        </td>
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center px-2.5 py-0.5 
            rounded bg-[#E8F5E9] text-[#00C853] text-xs font-semibold">
            포상
          </span>
        </td>
        <td className="px-4 py-3.5 text-sm text-[#666]">우수사원</td>
        <td className="px-4 py-3.5 text-sm text-[#666] max-w-[200px] truncate">
          Q4 매출 목표 150% 달성
        </td>
        <td className="px-4 py-3.5 text-sm text-[#666]">2026.01.15</td>
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center px-2.5 py-0.5 
            rounded bg-[#E8F5E9] text-[#00C853] text-xs font-semibold">
            ✓ 확정
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 7. 채용 공고 상태 뱃지

```jsx
const RECRUITMENT_STATUS = {
  임시저장: 'bg-[#F5F5F5] text-[#999] border border-[#E0E0E0]',
  진행중:   'bg-[#E8F5E9] text-[#2E7D32]',
  마감:     'bg-[#E3F2FD] text-[#2196F3]',
  취소:     'bg-[#FFEBEE] text-[#F44336]',
};

const CANDIDATE_EVAL = {
  '강력 추천': 'bg-[#E8F5E9] text-[#00C853]',
  '추천':      'bg-[#E8F5E9] text-[#2E7D32]',
  '보류':      'bg-[#FFF3E0] text-[#FF9800]',
  '비추천':    'bg-[#FFEBEE] text-[#F44336]',
  '평가전':    'bg-[#F5F5F5] text-[#999] border border-[#E0E0E0]',
};
```

---

## 리팩토링 체크리스트

### 채용 대시보드
- [ ] KPI 카드: R1 패턴 재활용
- [ ] 공고 카드: border border-[#E8E8E8], hover시 border-[#00C853]
- [ ] 퍼널 미니 요약: 접수 > 서류 > 면접 > 합격 (› 구분)
- [ ] D-day: text-[#F44336] 강조
- [ ] 필터 탭: 필 스타일

### 파이프라인 (P07)
- [ ] 퍼널 스테이지: active=bg-[#E8F5E9] border-[#00C853]
- [ ] 칸반 카드: border border-[#E8E8E8], hover시 border-[#00C853] + 미세 shadow
- [ ] 칸반 드롭존: bg-[#FAFAFA], 드래그오버시 border-[#00C853]
- [ ] AI 점수 뱃지: bg-[#E8F5E9] text-[#00C853] + ⭐
- [ ] 중복지원 태그: bg-[#FFF3E0] text-[#E65100] (§12)
- [ ] 탈락 영역: bg-[#FFEBEE]/30, 카드 opacity-70

### 지원자 상세 (P01)
- [ ] 프로필 사이드바: w-72, R2 패턴 참조
- [ ] AI 적합도 프로그레스 바: green gradient
- [ ] 탭: FLEX 밑줄 스타일

### AI 분석 (NP01)
- [ ] AI 아이콘: Sparkles, bg-[#E8F5E9]
- [ ] 역량 바: 점수별 green/blue/orange 자동 컬러
- [ ] AI 코멘트: bg-[#F1F8E9] border-[#C8E6C9]
- [ ] 레이더 차트: stroke="#00C853" (지원자), stroke="#E0E0E0" (평균)

### 면접 평가 모달
- [ ] 역량 항목: border-l-4 border-[#00C853]
- [ ] 5점 스케일: 선택시 bg-[#00C853] text-white
- [ ] 추천 버튼: 추천계열=green, 보류=orange, 비추천=red

### 징계·포상
- [ ] 유형 뱃지: 7종 컬러 매핑 (포상=green ~ 해고=dark red)
- [ ] 테이블: P03 패턴

### 공통
- [ ] 모든 blue → green 전환 확인
- [ ] shadow-sm 제거 확인
- [ ] dnd-kit 드래그 스타일: 기존 로직 유지, 시각 피드백만 green으로

---

## ⚠️ 주의사항

1. **기능 변경 금지** — 드래그앤드롭, AI 스크리닝, 면접 평가 로직 일체 유지
2. **dnd-kit 유지** — 칸반 DnD 라이브러리 교체 금지, 스타일 오버라이드만
3. **CTR_DESIGN_SYSTEM §12** — 채용 퍼널 전용 패턴(중복지원 태그, 평가완료 뱃지) 반드시 참조
4. **Recharts 레이더 차트** — AI 분석 레이더 차트 stroke 색상만 변경 (#00C853)
5. **STEP 6A는 건드리지 않음** — R6에서 별도 처리
6. **타입체크 유지** — `npx tsc --noEmit` 0 errors

---

## 실행 순서 (권장)

```
1. 채용/징계 뱃지 상수 정의 (RECRUITMENT_STATUS, CANDIDATE_EVAL, DISCIPLINE_TYPE)
2. 채용 대시보드 — KPI + 공고 카드/테이블 리팩
3. 파이프라인 — 퍼널 스테이지 리팩
4. 파이프라인 — 칸반 카드 + 탈락 영역 리팩
5. 지원자 상세 — 프로필 사이드바 + 탭 리팩
6. AI 분석 리포트 (NP01) 리팩
7. 면접 평가 모달 리팩
8. 징계·포상 목록 테이블 리팩
9. 타입체크 + 비주얼 검증
```
