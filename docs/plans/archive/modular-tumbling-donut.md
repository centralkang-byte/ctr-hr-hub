# Context
QA 리뷰 결과, Emerald 디자인 시스템 전환이 거의 완료됐으나 두 컴포넌트에서 레거시 hex 색상이 잔존. 이를 Tailwind 클래스로 교체.

---

## 변경 1: StatusStepper.tsx — hex 색상 → Tailwind 클래스

**파일**: `components/shared/StatusStepper.tsx`

스텝 원형 색상 (lines 87–90):
```tsx
// Before
step.status === 'completed' && 'bg-[#2E7D32] border-[#2E7D32] text-white',
step.status === 'current' && 'border-[#1565C0] text-[#1565C0] bg-white animate-pulse',
step.status === 'pending' && 'border-[#E8E8E8] text-[#999999] bg-white',
step.status === 'rejected' && 'bg-[#F44336] border-[#F44336] text-white'

// After
step.status === 'completed' && 'bg-emerald-600 border-emerald-600 text-white',
step.status === 'current' && 'border-blue-700 text-blue-700 bg-white animate-pulse',
step.status === 'pending' && 'border-slate-200 text-slate-400 bg-white',
step.status === 'rejected' && 'bg-red-500 border-red-500 text-white'
```

레이블 색상 (lines 102–105):
```tsx
// Before
step.status === 'completed' && 'text-[#2E7D32] font-medium',
step.status === 'current' && 'text-[#1565C0] font-semibold',
step.status === 'pending' && 'text-[#999999]',
step.status === 'rejected' && 'text-[#F44336] font-medium'

// After
step.status === 'completed' && 'text-emerald-600 font-medium',
step.status === 'current' && 'text-blue-700 font-semibold',
step.status === 'pending' && 'text-slate-400',
step.status === 'rejected' && 'text-red-500 font-medium'
```

커넥터 라인 (line 129):
```tsx
// Before
step.status === 'completed' ? 'bg-[#66BB6A]' : 'bg-[#E0E0E0] border-dashed'

// After
step.status === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'
```

툴팁 서브텍스트 (line 116):
```tsx
// Before: className="text-[#999999]"
// After: className="text-slate-400"
```

---

## 변경 2: contract-form.tsx AIBadge — inline style → Tailwind

**파일**: `app/(dashboard)/contracts/new/contract-form.tsx`

AIBadge 컴포넌트 (~line 134):
```tsx
// Before
style={{ backgroundColor: '#F3E5F5', color: '#7B1FA2' }}

// After (style prop 제거, className 추가)
className="bg-violet-50 text-violet-700"
```

---

## QA 결과 요약 (이미 완료 항목)
- `globals.css`: Emerald 테마 완전 전환 ✅
- `messages/ko.json` / `en.json`: 동기화 완료 ✅
- `sidebar.tsx`: Emerald 활성 메뉴, 조직 프로필 ✅
- `status-badge.tsx`: 모든 상태 Tailwind 클래스 ✅
- `contract-timeline.tsx`: Emerald/Slate 색상 정확 ✅
- Navy (`#1B3A5C`): 0건 ✅
- `bg-slate-900`: 0건 ✅

## 수정 파일 목록
| 파일 | 변경 내용 |
|---|---|
| `components/shared/StatusStepper.tsx` | 7개 hex 색상 → Tailwind 클래스 |
| `app/(dashboard)/contracts/new/contract-form.tsx` | AIBadge inline style → className |

## 검증
1. `npx tsc --noEmit` 통과
2. 계약 상세 페이지에서 StatusStepper 색상 확인 (completed=emerald, current=blue, pending=slate, rejected=red)
3. 계약 작성 페이지에서 AI 배지 색상 확인 (violet 배경)
