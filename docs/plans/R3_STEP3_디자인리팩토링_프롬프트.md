# R3: STEP 3 디자인 리팩토링 — 근태·휴가 관리

## 세션 목표

STEP 3에서 구현한 **근태관리(출퇴근·초과근무), 휴가관리(신청·승인·잔여), 52시간 모니터링** 페이지를 CTR_DESIGN_SYSTEM.md (FLEX 스타일) 기반으로 리팩토링.
**기능 변경 없음. 비주얼 일관성만 확보.**
**R1~R2에서 적용한 공통 컴포넌트 그대로 사용.**

---

## 필수 참조 파일

```
1. CLAUDE.md                 → 프로젝트 컨텍스트 + 디자인 토큰
2. CTR_DESIGN_SYSTEM.md      → FLEX 스타일 디자인 시스템 (타겟)
3. CTR_UI_PATTERNS.md        → P02, P03, P05 중점 + 캘린더
4. R1/R2 결과물              → 공통 UI 컴포넌트 변경사항 확인
```

---

## 리팩토링 대상 파일

> 실제 파일명은 프로젝트에서 확인 필요. 아래는 STEP 3 구현 기준 예상 파일.

| 파일 (예상) | 내용 |
|------------|------|
| `src/app/(dashboard)/attendance/page.tsx` | 근태 메인 |
| `src/app/(dashboard)/attendance/AttendanceClient.tsx` | 근태 클라이언트 (출퇴근 기록 테이블) |
| `src/app/(dashboard)/leaves/page.tsx` | 휴가 메인 |
| `src/app/(dashboard)/leaves/LeaveClient.tsx` | 휴가 클라이언트 (신청·잔여·승인) |
| `src/app/(dashboard)/overtime/page.tsx` (또는 attendance 내) | 초과근무 |
| 관련 모달/폼 컴포넌트 | 휴가 신청 모달, 초과근무 신청 모달 등 |

---

## 핵심 패턴 매핑

| 패턴 | 적용 위치 |
|------|----------|
| **P02** KPI 카드 그리드 | 근태 요약 (출근율, 지각률, 초과근무 등) |
| **P03** 데이터 테이블 + 필터 | 출퇴근 기록, 휴가 신청 목록 |
| **P05** 승인 워크플로 패널 | 휴가 승인, 초과근무 승인 |
| 캘린더 뷰 | 월간 근태 캘린더, 팀 휴가 캘린더 |

---

## 컴포넌트별 상세 지침

### 1. 근태 대시보드 — KPI + 테이블 (P02 + P03)

**페이지 구조:**
```
┌─────────────────────────────────────────┐
│ 근태 관리          [이번 달▼] [내보내기]  │
│ 실시간 근태 현황을 확인합니다              │
├─────────────────────────────────────────┤
│ [출근율 97.2%] [지각 3명] [초과근무 12명] [52시간 경고 2명] │
├──────────────────┬──────────────────────┤
│ [목록뷰│캘린더뷰]  │                      │
├──────────────────┴──────────────────────┤
│ 출퇴근 기록 테이블 (P03)                  │
│ 또는 월간 캘린더 뷰                       │
└─────────────────────────────────────────┘
```

**KPI 카드 (R1 패턴 재활용):**
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
  {/* 출근율 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">출근율</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">97.2%</p>
    <span className="text-xs font-semibold text-[#00C853]">↑ 1.5% 전월 대비</span>
  </div>

  {/* 지각 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">금일 지각</p>
    <p className="text-3xl font-bold text-[#F44336] tracking-[-0.02em]">3명</p>
    <span className="text-xs font-semibold text-[#F44336]">↑ 2명</span>
  </div>

  {/* 초과근무 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">금주 초과근무</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">12명</p>
    <span className="text-xs text-[#999]">평균 4.2시간</span>
  </div>

  {/* 52시간 경고 — 위험 강조 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 
    border-l-4 border-l-[#F44336]">
    <p className="text-xs text-[#999] font-medium mb-2">52시간 경고</p>
    <p className="text-3xl font-bold text-[#F44336] tracking-[-0.02em]">2명</p>
    <span className="text-xs font-semibold text-[#F44336]">즉시 조치 필요</span>
  </div>
</div>
```

### 2. 출퇴근 기록 테이블 (P03)

```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-[#E8E8E8]">
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">이름</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">부서</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">출근</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">퇴근</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">근무시간</th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">상태</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
            <span className="text-sm font-medium text-[#1A1A1A]">김상우</span>
          </div>
        </td>
        <td className="px-4 py-3.5 text-sm text-[#666]">인사팀</td>
        <td className="px-4 py-3.5 text-sm text-[#1A1A1A]">08:52</td>
        <td className="px-4 py-3.5 text-sm text-[#1A1A1A]">18:03</td>
        <td className="px-4 py-3.5 text-sm text-[#1A1A1A]">8h 11m</td>
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center px-2.5 py-0.5 
            rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-semibold">
            정상
          </span>
        </td>
      </tr>
      {/* 지각 행 */}
      <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
            <span className="text-sm font-medium text-[#1A1A1A]">박OO</span>
          </div>
        </td>
        <td className="px-4 py-3.5 text-sm text-[#666]">개발팀</td>
        <td className="px-4 py-3.5 text-sm text-[#F44336] font-medium">09:23</td>
        <td className="px-4 py-3.5 text-sm text-[#1A1A1A]">—</td>
        <td className="px-4 py-3.5 text-sm text-[#999]">근무중</td>
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center px-2.5 py-0.5 
            rounded bg-[#FFEBEE] text-[#E53935] text-xs font-semibold">
            지각
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**근태 상태 뱃지:**
```jsx
const ATTENDANCE_STATUS = {
  정상:   'bg-[#E8F5E9] text-[#2E7D32]',
  지각:   'bg-[#FFEBEE] text-[#E53935]',
  조퇴:   'bg-[#FFF3E0] text-[#E65100]',
  결근:   'bg-[#FFEBEE] text-[#F44336]',
  휴가:   'bg-[#E3F2FD] text-[#2196F3]',
  출장:   'bg-[#F3E5F5] text-[#9C27B0]',
  재택:   'bg-[#E0F2F1] text-[#00897B]',
  근무중: 'bg-[#F5F5F5] text-[#999] border border-[#E0E0E0]',
};
```

### 3. 월간 캘린더 뷰

```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
  {/* 캘린더 헤더 */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <button className="p-1.5 hover:bg-[#F5F5F5] rounded-lg">
        <ChevronLeft size={20} className="text-[#666]" />
      </button>
      <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">
        2026년 3월
      </h3>
      <button className="p-1.5 hover:bg-[#F5F5F5] rounded-lg">
        <ChevronRight size={20} className="text-[#666]" />
      </button>
    </div>
    <button className="text-sm text-[#00C853] font-semibold hover:underline">
      오늘
    </button>
  </div>

  {/* 캘린더 그리드 */}
  <div className="grid grid-cols-7 gap-px bg-[#E8E8E8] border border-[#E8E8E8] rounded-lg overflow-hidden">
    {/* 요일 헤더 */}
    {['일','월','화','수','목','금','토'].map(day => (
      <div key={day} className="bg-white px-2 py-2 text-center">
        <span className={`text-xs font-semibold ${
          day === '일' ? 'text-[#F44336]' : day === '토' ? 'text-[#2196F3]' : 'text-[#999]'
        }`}>{day}</span>
      </div>
    ))}

    {/* 날짜 셀 */}
    <div className="bg-white p-2 min-h-[80px]">
      <span className="text-xs text-[#1A1A1A]">1</span>
      <div className="mt-1 space-y-0.5">
        <div className="text-[10px] px-1 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] truncate">
          정상 08:52
        </div>
      </div>
    </div>

    {/* 휴가일 */}
    <div className="bg-[#E3F2FD]/30 p-2 min-h-[80px]">
      <span className="text-xs text-[#1A1A1A]">5</span>
      <div className="mt-1">
        <div className="text-[10px] px-1 py-0.5 rounded bg-[#E3F2FD] text-[#2196F3] truncate">
          연차휴가
        </div>
      </div>
    </div>
  </div>

  {/* 범례 */}
  <div className="flex items-center gap-4 mt-3">
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-[#00C853]" />
      <span className="text-[11px] text-[#999]">정상</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-[#F44336]" />
      <span className="text-[11px] text-[#999]">지각/결근</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-[#2196F3]" />
      <span className="text-[11px] text-[#999]">휴가</span>
    </div>
  </div>
</div>
```

### 4. 휴가 관리 페이지

**페이지 구조:**
```
┌─────────────────────────────────────────┐
│ 휴가 관리           [내 휴가현황] [+ 신청] │
├─────────────────────────────────────────┤
│ [잔여 12일] [사용 8일] [승인대기 1건] [만료예정 3일] │
├─────────────────────────────────────────┤
│ [전체│승인대기│승인│반려]                   │
├─────────────────────────────────────────┤
│ 휴가 신청 테이블 (P03)                    │
└─────────────────────────────────────────┘
```

**잔여 휴가 카드 — 도넛/프로그레스 표현:**
```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
  {/* 잔여 연차 — 강조 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">잔여 연차</p>
    <div className="flex items-end gap-1">
      <p className="text-3xl font-bold text-[#00C853] tracking-[-0.02em]">12</p>
      <p className="text-sm text-[#999] mb-1">/ 20일</p>
    </div>
    {/* 프로그레스 바 */}
    <div className="mt-3 h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-[#00C853] to-[#00BFA5]"
        style={{ width: '60%' }} />
    </div>
  </div>

  {/* 사용 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">사용 연차</p>
    <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">8일</p>
    <span className="text-xs text-[#999]">올해 누적</span>
  </div>

  {/* 승인대기 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
    <p className="text-xs text-[#999] font-medium mb-2">승인 대기</p>
    <p className="text-3xl font-bold text-[#FF9800] tracking-[-0.02em]">1건</p>
    <span className="text-xs text-[#FF9800]">검토 필요</span>
  </div>

  {/* 만료예정 — 경고 */}
  <div className="bg-white border border-[#E8E8E8] rounded-xl p-6
    border-l-4 border-l-[#FF9800]">
    <p className="text-xs text-[#999] font-medium mb-2">만료 예정</p>
    <p className="text-3xl font-bold text-[#FF9800] tracking-[-0.02em]">3일</p>
    <span className="text-xs text-[#E65100]">12월 31일까지 사용</span>
  </div>
</div>
```

**필터 탭 (필 스타일):**
```jsx
<div className="flex items-center gap-2 mb-4">
  {['전체', '승인대기', '승인', '반려'].map(filter => (
    <button
      key={filter}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        activeFilter === filter
          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
          : 'bg-white text-[#666] border-[#E0E0E0] hover:bg-[#F5F5F5]'
      }`}
    >
      {filter} {counts[filter] > 0 && `(${counts[filter]})`}
    </button>
  ))}
</div>
```

### 5. 휴가 신청 모달

```jsx
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
  <div className="bg-white rounded-2xl w-full max-w-lg shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
    {/* 헤더 */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
      <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">휴가 신청</h2>
      <button className="text-[#999] hover:text-[#666]"><X size={20} /></button>
    </div>

    {/* 바디 */}
    <div className="px-6 py-5 space-y-5">
      {/* 휴가 유형 */}
      <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
          휴가 유형 <span className="text-[#F44336]">*</span>
        </label>
        <select className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
          focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10">
          <option>연차휴가</option>
          <option>반차 (오전)</option>
          <option>반차 (오후)</option>
          <option>병가</option>
          <option>경조사</option>
          <option>공가</option>
        </select>
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">시작일</label>
          <input type="date" className="w-full px-3 py-2.5 border border-[#E0E0E0] 
            rounded-lg text-sm focus:border-[#00C853] focus:outline-none 
            focus:ring-2 focus:ring-[#00C853]/10" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">종료일</label>
          <input type="date" className="w-full px-3 py-2.5 border border-[#E0E0E0] 
            rounded-lg text-sm focus:border-[#00C853] focus:outline-none 
            focus:ring-2 focus:ring-[#00C853]/10" />
        </div>
      </div>

      {/* 사유 */}
      <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">사유</label>
        <textarea className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm
          focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10
          resize-none h-20 placeholder:text-[#BDBDBD]"
          placeholder="휴가 사유를 입력하세요" />
      </div>

      {/* 잔여 표시 */}
      <div className="bg-[#F5F5F5] rounded-lg p-3 flex items-center justify-between">
        <span className="text-xs text-[#999]">사용 일수</span>
        <span className="text-sm font-bold text-[#1A1A1A]">1일</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#999]">신청 후 잔여</span>
        <span className="text-sm font-bold text-[#00C853]">11일</span>
      </div>
    </div>

    {/* 푸터 */}
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E8E8E8]">
      <button className="px-4 py-2.5 border border-[#E0E0E0] rounded-lg text-sm 
        font-medium text-[#333] hover:bg-[#F5F5F5]">취소</button>
      <button className="px-4 py-2.5 bg-[#00C853] hover:bg-[#00A844] rounded-lg text-sm 
        font-semibold text-white">신청</button>
    </div>
  </div>
</div>
```

### 6. 휴가 승인 패널 (P05)

```jsx
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
  <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">
    승인 현황
  </h3>

  {/* 승인 타임라인 */}
  <div className="space-y-0">
    {/* 1단계 — 완료 */}
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#00C853] flex items-center justify-center">
          <Check size={16} className="text-white" />
        </div>
        <div className="w-px flex-1 bg-[#E8E8E8]" />
      </div>
      <div className="pb-5">
        <p className="text-sm font-semibold text-[#1A1A1A]">1단계: 직속상사</p>
        <p className="text-xs text-[#999] mt-0.5">박OO 팀장 · 2026.03.01 14:23</p>
        <span className="inline-flex items-center mt-1 px-2 py-0.5 
          rounded bg-[#E8F5E9] text-[#00C853] text-xs font-semibold">
          ✓ 승인
        </span>
      </div>
    </div>

    {/* 2단계 — 진행중 */}
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#2196F3] flex items-center justify-center
          animate-pulse">
          <Clock size={16} className="text-white" />
        </div>
        <div className="w-px flex-1 bg-[#E8E8E8]" />
      </div>
      <div className="pb-5">
        <p className="text-sm font-semibold text-[#1A1A1A]">2단계: 인사팀</p>
        <p className="text-xs text-[#999] mt-0.5">검토 대기중</p>
        <span className="inline-flex items-center mt-1 px-2 py-0.5 
          rounded bg-[#E3F2FD] text-[#2196F3] text-xs font-semibold">
          ⏳ 대기중
        </span>
      </div>
    </div>

    {/* 3단계 — 미진행 */}
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#E8E8E8] flex items-center justify-center">
          <span className="text-xs text-[#999]">3</span>
        </div>
      </div>
      <div>
        <p className="text-sm text-[#999]">3단계: 본부장</p>
      </div>
    </div>
  </div>

  {/* 승인/반려 버튼 (현재 단계 승인자일 때) */}
  <div className="flex items-center gap-3 mt-5 pt-5 border-t border-[#E8E8E8]">
    <button className="flex-1 py-2.5 border border-[#F44336] text-[#F44336] 
      rounded-lg text-sm font-semibold hover:bg-[#FFEBEE]">
      반려
    </button>
    <button className="flex-1 py-2.5 bg-[#00C853] hover:bg-[#00A844] text-white 
      rounded-lg text-sm font-semibold">
      승인
    </button>
  </div>
</div>
```

### 7. 52시간 모니터링 — 경고 카드

```jsx
{/* 52시간 경고 섹션 */}
<div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <AlertTriangle size={20} className="text-[#F44336]" />
      <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">
        52시간 모니터링
      </h3>
    </div>
    <span className="text-xs text-[#999]">이번 주 기준</span>
  </div>

  {/* 경고 대상자 리스트 */}
  <div className="space-y-3">
    {/* 위험 (48시간+) */}
    <div className="flex items-center justify-between p-3 
      bg-[#FFEBEE] rounded-lg border border-[#FFCDD2]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
        <div>
          <p className="text-sm font-medium text-[#1A1A1A]">이OO</p>
          <p className="text-xs text-[#999]">개발팀</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-[#F44336]">49.5h</p>
        <p className="text-[10px] text-[#E53935]">한도 초과 임박</p>
      </div>
    </div>

    {/* 주의 (44시간+) */}
    <div className="flex items-center justify-between p-3 
      bg-[#FFF3E0] rounded-lg border border-[#FFE0B2]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#E8E8E8]" />
        <div>
          <p className="text-sm font-medium text-[#1A1A1A]">정OO</p>
          <p className="text-xs text-[#999]">생산팀</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-[#FF9800]">46.2h</p>
        <p className="text-[10px] text-[#E65100]">주의 구간</p>
      </div>
    </div>
  </div>

  {/* 프로그레스 — 주간 근무시간 분포 */}
  <div className="mt-4 pt-4 border-t border-[#F0F0F0]">
    <p className="text-xs text-[#999] mb-2">주간 근무시간 분포</p>
    <div className="flex items-end gap-1 h-12">
      {[32, 38, 40, 42, 44, 46, 49].map((h, i) => (
        <div key={i} className="flex-1 rounded-t"
          style={{
            height: `${(h / 52) * 100}%`,
            background: h >= 48 ? '#F44336' : h >= 44 ? '#FF9800' : '#00C853',
          }} />
      ))}
    </div>
    <div className="flex justify-between mt-1">
      <span className="text-[10px] text-[#999]">월</span>
      <span className="text-[10px] text-[#999]">일</span>
    </div>
  </div>
</div>
```

### 8. 초과근무 신청 모달

휴가 신청 모달과 동일 패턴. 필드만 다름:

```jsx
// 필드 구성
- 신청 유형: 연장근무 / 야간근무 / 휴일근무
- 일자: date input
- 시작~종료 시간: time input 2개
- 예상 시간: 자동 계산 표시
- 사유: textarea
- 잔여 초과근무 가능시간 표시: 52h - 현재누적 = 잔여
```

---

## 리팩토링 체크리스트

### 근태 페이지
- [ ] KPI 카드: R1 패턴 재활용 (shadow 없음, border만)
- [ ] 52시간 경고 카드: border-l-4 border-l-[#F44336] 강조
- [ ] 출퇴근 테이블: P03 패턴 (헤더 bg 없음, text-[#999])
- [ ] 근태 상태 뱃지: 8종 컬러 매핑
- [ ] 뷰 토글 (목록/캘린더): 필 탭 스타일

### 캘린더 뷰
- [ ] 캘린더 그리드: border border-[#E8E8E8], 날짜 셀 min-h
- [ ] 요일 헤더: 일(빨강), 토(파랑), 평일(#999)
- [ ] 이벤트 칩: 상태별 컬러 매핑 (10px 크기)
- [ ] 월 네비게이션: ChevronLeft/Right + 오늘 버튼

### 휴가 페이지
- [ ] 잔여 연차 KPI: 프로그레스 바 (green gradient)
- [ ] 만료 예정: border-l-4 border-l-[#FF9800] 경고
- [ ] 필터 탭: 필 스타일 (active=bg-[#1A1A1A] text-white)
- [ ] 신청 테이블: P03 패턴

### 모달 (휴가 신청 / 초과근무)
- [ ] 모달: rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.12)]
- [ ] 오버레이: bg-black/40 (backdrop-blur 선택)
- [ ] 인풋: focus green ring
- [ ] 구조: 헤더(제목+닫기) → 바디 → 푸터(취소+신청)

### 승인 패널 (P05)
- [ ] 타임라인: 세로 도트+라인
- [ ] 완료: bg-[#00C853] + Check 아이콘
- [ ] 진행중: bg-[#2196F3] + animate-pulse
- [ ] 대기: bg-[#E8E8E8]
- [ ] 버튼: 반려(outline red) + 승인(fill green)

### 52시간 모니터링
- [ ] 위험 카드: bg-[#FFEBEE] border-[#FFCDD2]
- [ ] 주의 카드: bg-[#FFF3E0] border-[#FFE0B2]
- [ ] 주간 바 차트: 시간대별 컬러 (green/orange/red)

### 공통
- [ ] 모든 blue → green 전환 확인
- [ ] shadow-sm 제거 확인
- [ ] 텍스트 컬러 통일: #1A1A1A / #666 / #999

---

## ⚠️ 주의사항

1. **기능 변경 금지** — 52시간 계산 로직, 승인 플로우, API 호출 일체 유지
2. **R1/R2 공통 컴포넌트 재활용** — Button, Badge, Card, Input, Tab, Modal 기본 구조
3. **캘린더 라이브러리** — 기존 사용 라이브러리 유지, 스타일만 오버라이드
4. **STEP 4~6A는 건드리지 않음** — R4~R6에서 별도 처리
5. **타입체크 유지** — `npx tsc --noEmit` 0 errors

---

## 실행 순서 (권장)

```
1. 근태 상태 뱃지 상수 정의 (ATTENDANCE_STATUS 맵)
2. 근태 메인 페이지 — KPI 카드 + 테이블 리팩
3. 캘린더 뷰 스타일 전환
4. 52시간 모니터링 섹션 리팩
5. 휴가 메인 페이지 — KPI + 필터탭 + 테이블 리팩
6. 휴가 신청 모달 리팩
7. 승인 패널 (P05) 리팩
8. 초과근무 관련 UI 리팩
9. 타입체크 + 비주얼 검증
```
