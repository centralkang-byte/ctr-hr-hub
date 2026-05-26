# N+41 Pre-flight — UI 4 섹션 + drawer form + N+18 우회로 폐기 ⭐ cross-batch critical

> **base SHA**: `6f4ffe84` · **트랙**: codebase + cross-batch · **우선**: HIGH
> **결정 (Stage 3 Q3+Q4+Q5=B)**: career tab 단일 surface 4 섹션 + drawer SSOT + N+18 점진 폐기
> **본 pre-flight 결과 (요약)**: ⭐ **cross-batch timing 권고 = (a) ~1주 안정화 정합**. drawer SSOT = Radix Sheet 기반 다수 surface 존재 (재사용).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### batch 04 N+18 pre-flight cross-ref

`docs/phase-3a/stage4-preflight/n18-7tab-alignment.md`:
- 결정: graceful empty(A) → CareerTab.tsx 안에 4 섹션 EmptyState
- scope: ~115 lines (CareerTab.tsx 신설) + 30 i18n entries
- DB 무관 (graceful empty)
- 회귀 위험: 신규 탭 추가 = 모바일 reflow 위험

### batch 08 N+44 pre-flight cross-ref (drawer SSOT)

`docs/phase-3a/stage4-preflight/n44-mytasks-leave-migration.md`:
- 결정: MyTasksClient Radix Tabs + LeaveClient radiogroup
- **drawer SSOT는 batch 04 N+21 DemoLimitBanner 정합 — N+41 UI는 wizard 아닌 drawer**
- N+44는 tabs/filter a11y, drawer는 별도 SSOT 트랙

### 기존 drawer / Sheet SSOT 패턴 inventory

```
src/components/ui/sheet.tsx                                      ✅ Radix Sheet primitive SSOT
src/components/analytics/KpiDrilldownSheet.tsx                  ✅ Sheet consumer 패턴 cross-ref
src/components/performance/goals/RevisionHistorySheet.tsx       ✅ Sheet consumer
src/components/attendance/ScheduleAdjustmentModal.tsx           (Modal 패턴 — drawer 아님)
src/components/org/RestructureModal.tsx                         (N+27 target, drawer 패턴)
```

→ **drawer = Radix Sheet 기반 SSOT 존재** (재사용 패턴). N+41 4 섹션 drawer = 동일 패턴 적용.

### TrainingEnrollment 데이터 매핑 (CR-003)

- 교육 섹션 데이터 source = 기존 `TrainingEnrollment` (별도 endpoint 신설 0)
- query: `/api/v1/training/enrollments?employeeId=[id]` 재사용 또는 신규 layer
- source enum 매핑:
  - `mandatory_auto` ↔ proto type "법정"
  - `manual` (외부 provider) ↔ proto type "외부"
  - `manual` / `onboarding` ↔ proto type "내부"

---

## §2. ⭐ N+41 Cross-batch timing 권고 (Critical 가드 응답)

가디언 사전 가정 (Q5=B): "batch 04 N+18 머지 + ~1주 안정화 후 진입"

**CC 검증 결과**:

| 옵션 | 평가 | 권고 |
|---|---|---|
| **(a) ~1주 안정화 정합** | batch 04 N+18 = ~115 lines, 새 탭 surface, 모바일 reflow 검증 시간 필요 | ⭐ **권고 채택** |
| (b) ~2-3일 단축 | N+18 scope 작지만 production 신규 surface = 회귀 발견 시간 필요 | △ 단축 risk |
| (c) ~2주 연장 | scope 대비 과대, 일정 부담 | ❌ |

→ **(a) ~1주 안정화 정합** — Q5=B 결정 그대로 채택. 검증 시점:
- N+18 머지 후 day 0~7: production 회귀 모니터링 (Vercel logs / Sentry)
- day 7: N+41 진입 게이트 통과 (회귀 0 확인)
- day 7+: N+41 PR 진입

---

## §3. 변경 surface 인벤토리 + 예상 line delta

### (a) UI 4 섹션 신규 컴포넌트

```
src/components/employees/career/
├── CareerTab.tsx                  (배치 04 N+18 의 EmptyState → 풀 UI 마이그레이션)
├── EducationSection.tsx           (~120 lines)
├── CertificationSection.tsx       (~140 lines, derived status badge + cert link)
├── TrainingSection.tsx            (~100 lines, TrainingEnrollment lookup)
├── ActivitySection.tsx            (~110 lines, chip array → 4-field display)
└── EmployeeCareerDrawer.tsx       (4 섹션 공통 drawer, type prop)
```

| 파일 | 변경 | line delta |
|---|---|---|
| CareerTab.tsx (N+18 → N+41 마이그레이션) | EmptyState 4 → 풀 UI | +400 / -80 = **+320 net** |
| 4 SectionXXX.tsx | 신규 | +470 |
| EmployeeCareerDrawer.tsx | 신규 (Radix Sheet 기반) | +180 |
| **순 총합** | — | **+970 lines** |

### (b) Drawer 컴포넌트 spec (Radix Sheet 기반)

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type SectionType = 'education' | 'certification' | 'activity'
// 교육 섹션 = TrainingEnrollment lookup, 별도 drawer 없음 (read-only)

interface EmployeeCareerDrawerProps {
  open: boolean
  onClose: () => void
  type: SectionType
  recordId?: string                 // edit mode
  employeeId: string
  onSuccess: () => void             // 저장 후 refetch
}
```

- 신규 add / edit 통합 (recordId 유무로 구분)
- 4 섹션 type 분기 (educationForm / certificationForm + S3 upload / activityForm)
- batch 08 N+44 a11y SSOT 정합 (Radix Sheet focus trap 자동)

### (c) N+18 우회로 폐기 (점진)

- N+18 implementation = `<CareerTab>` 안에 4 EmptyState placeholder
- N+41 = 4 EmptyState 제거 → 풀 UI 마이그레이션
- 단 EmptyState 컴포넌트 자체 `src/components/shared/EmptyState.tsx`는 다른 surface 재사용 (다른 contexts에서 빈 데이터 표시는 유지)
- 본 batch에서 grep target = `<EmptyState>` in `career` related files (N+42 verification)

### (d) i18n keys (N+42 PR에서 신설 → N+41은 사용만)

- ~150 키 (학력/자격증/교육/사내활동 + form labels + status chips + buttons)
- 본 N+41 = caller 측 t() 호출만 (key 신설은 N+42)

---

## §4. i18n / DB / API 영향 평가

- **i18n**: N+42 PR에서 신설, 본 N+41 = consumer 호출만
- **DB**: 0 (N+37/N+38/N+39/N+40 머지 후 진입)
- **API**: 0 (4 API 재사용)
- **TrainingEnrollment query**: `/api/v1/training/enrollments?employeeId=[id]&limit=24` (24개월 lookback)

---

## §5. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH)**: cross-batch timing — batch 04 N+18 implementation 회귀 발견 시 N+41 진입 지연 (~1주 → ~2주)
- **R2 (MEDIUM)**: TrainingEnrollment query layer (별도 endpoint 신설 vs 기존 재사용) — Stage 4 implementation 시 결정
- **R3 (MEDIUM)**: drawer 4 type 분기 logic = 복잡도 증가. 또는 4 별도 drawer 신설 → 코드 중복 vs 단일 type switch 결정
- **R4 (LOW)**: 모바일 reflow — 4 섹션 stack + drawer modal 정합

### 의존성
- **N+37 / N+38 / N+39 / N+40 선행 필수** (4 API endpoint 머지 완료)
- ⭐ **batch 04 N+18 implementation 머지 + ~1주 안정화** (Q5=B 점진 폐기)
- **batch 08 N+44 a11y SSOT** 정합 (drawer focus trap)
- **PR-5A 머지** 후

### 가드
- ❌ batch 04 N+18 회귀 검증 전 N+41 진입 금지 (~1주 안정화)
- ❌ Radix Sheet primitive 시그니처 변경 금지 (다른 surface 회귀)
- ❌ EmptyState 컴포넌트 자체 변경 금지 (다른 surface 재사용 유지)
- ✅ TrainingEnrollment 기존 데이터 매핑 layer 신설 (server side 권고)
- ✅ axe-core 0 violation × 4 섹션 drawer

---

## §6. Implementation 단계 (N+37~N+40 머지 + batch 04 N+18 머지 + ~1주 안정화 후)

1. **사전 합의 게이트**:
   - drawer 단일 + type switch vs 4 별도 결정
   - TrainingEnrollment query layer (별도 endpoint vs 기존 재사용)
   - batch 04 N+18 회귀 검증 결과 sign-off (~1주 안정화 후)
2. **branch**: `feat/employee-career-ui`
3. **commit 1**: 4 SectionXXX.tsx 신규
4. **commit 2**: EmployeeCareerDrawer.tsx 신규 (Radix Sheet 기반)
5. **commit 3**: CareerTab.tsx 마이그레이션 (EmptyState 4 → 풀 UI)
6. **commit 4**: TrainingEnrollment query layer (server side 권고)
7. **e2e**: `e2e/flows/employee-career.spec.ts` (4 섹션 × CRUD × 권한 × drawer)
8. **gstack 시각**: 4 섹션 + drawer 라이트 + 모바일 reflow
9. **axe-core**: 0 violation × 4 섹션 drawer
10. **codex Gate 1+2**: 표준
11. **PR open**: `feat/employee-career-ui` → main

---

## §7. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: 4 섹션 × CRUD × 권한 매트릭스 + drawer 시나리오
- ✅ **axe-core**: 0 violation × 4 섹션 drawer
- ✅ **시각 회귀**: gstack 라이트 + 모바일 reflow (4 섹션 stack + drawer)
- ✅ **batch 04 N+18 회귀 0** (graceful empty 폐기 점진 검증)
- ✅ **TrainingEnrollment 데이터 매핑 정합** (교육 섹션 read-only 표시)

---

**상태**: pre-flight 완료, ⭐ cross-batch timing (~1주 안정화) 권고 정합
**Stage 4 예상 PR 크기**: 4 commits, **+970 lines**, 6 file diff (가장 큰 PR)
