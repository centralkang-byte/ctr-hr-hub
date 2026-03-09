# B2: Core HR 고도화 UI

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A 완료 + B1(법인별 커스터마이징 엔진) 완료 상태.

---

## 세션 목표

A2에서 구축한 Effective Dating 데이터 모델을 **사용자가 실제로 보고 조작할 수 있는 UI**로 만듭니다. 직원 프로필을 5개 탭으로 통합하고, 발령이력 타임라인 + 시점 조회 + HR Admin 검색 강화 + 엑셀 일괄 업로드를 구현합니다.

이 세션은 **신규 DB 테이블 없이 A2 테이블 위에 UI를 올리는** 프론트엔드 중심 작업입니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. context.md 읽기 — B1 산출물 확인
cat CONTEXT.md

# 2. Effective Dating 쿼리 동작 확인
# employee_assignments 테이블에 effective_date / end_date가 있고,
# 아래 쿼리가 정상 동작하는지 확인:
#
# SELECT * FROM employee_assignments
# WHERE employee_id = :id
#   AND effective_date <= :target_date
#   AND (end_date IS NULL OR end_date > :target_date)
# ORDER BY effective_date DESC;

# 3. 기존 직원 프로필 페이지 경로 확인
# /employees/[id] 또는 유사 경로가 어디에 있는지

# 4. B1에서 만든 compensation_settings의 JSONB 구조 확인
# 급여정보 읽기전용 탭에서 참조해야 함

# 5. A1 comingSoon 셸 페이지 경로와 실제 라우트 일치 여부 확인
```

---

## 핵심 설계 원칙

### 1. 재사용 컴포넌트 우선 설계

이 세션에서 만드는 2개 컴포넌트는 다른 세션에서 반복 재사용됩니다:

| 컴포넌트 | 재사용처 |
|----------|---------|
| `AssignmentTimeline` | B4(후보자 히스토리), B5(온보딩 타임라인) |
| `EffectiveDatePicker` | B8-1(조직도 시점조회) |

따라서 **특정 도메인에 종속되지 않는 범용 인터페이스**로 설계하세요.

### 2. 5개 탭 중 3개만 구현

| 탭 | B2 구현 | 비고 |
|----|--------|------|
| 프로필 (기본정보 + 연락처) | ✅ | 편집 폼 |
| 발령이력 (타임라인 + 시점조회) | ✅ | Effective Dating 핵심 |
| 급여정보 (현재 급여 항목 조회) | ✅ | 읽기 전용 — B1 compensation_settings 참조 |
| 근태현황 | ❌→B6 | comingSoon 셸 |
| 평가결과 | ❌→B3 | comingSoon 셸 |

### 3. 검색 범위 — HR Admin 실무에 집중

| 구분 | 대상 | 세션 |
|------|------|------|
| HR Admin 고급검색 | 부서/직급/입사일/계약유형/법인 필터 + 엑셀 다운로드 | **B2 (여기)** |
| People Directory | 이름/부서/스킬/위치 + 프로필 카드 (전직원 접근) | B8-2 |
| 스킬/자격증 복합검색 | "용접 자격증 + 중국어 + CTR-VN" | B8-3 |

스킬 기반 검색은 B8에서 스킬 데이터가 구축된 후에 가능하므로, B2에서는 **HR Admin이 직원 목록을 필터링하는 실무 니즈**에만 집중합니다.

---

## 작업 순서 (9 Tasks)

### Task 1: EmployeeProfilePage 탭 레이아웃 + ComingSoonShell

기존 직원 상세 페이지를 5개 탭 통합 구조로 리팩토링합니다.

```
라우트: /employees/[id] (또는 기존 경로 유지)

┌─────────────────────────────────────────────────┐
│ 직원 헤더: 사진 + 이름 + 직책/부서 + 상태 뱃지     │
├─────────────────────────────────────────────────┤
│ [프로필] [발령이력] [급여정보] [근태현황] [평가결과]  │
├─────────────────────────────────────────────────┤
│ 탭 콘텐츠 영역                                    │
└─────────────────────────────────────────────────┘
```

**ComingSoonShell**: A1에서 만든 comingSoon 셸 컴포넌트를 재사용. 근태/평가 탭에 배치.

**파일 구조**:
```
components/employees/
├── EmployeeProfilePage.tsx      — 탭 레이아웃 + 헤더
├── EmployeeHeader.tsx           — 사진/이름/직책/상태 공통 헤더
├── tabs/
│   ├── ProfileTab.tsx           — 기본정보 편집 폼
│   ├── AssignmentHistoryTab.tsx — 타임라인 + 시점조회
│   ├── CompensationTab.tsx      — 급여정보 읽기전용
│   └── ComingSoonTab.tsx        — 근태/평가 셸
```

### Task 2: AssignmentTimeline 컴포넌트 (재사용 설계)

**핵심: 도메인 비종속 범용 컴포넌트**

```typescript
// components/shared/AssignmentTimeline.tsx

interface TimelineEvent {
  id: string;
  date: string;              // ISO date
  type: string;              // 'hire' | 'promotion' | 'transfer' | 'contract' | 'termination' 등
  title: string;             // "입사", "승진", "부서이동" 등
  description: string;       // "개발팀 · 사원(S1)" 등
  details?: Record<string, any>;  // 사이드패널에서 보여줄 상세 데이터
  icon?: string;             // 이벤트 유형별 아이콘
  color?: string;            // 이벤트 유형별 색상
}

interface AssignmentTimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;  // 사이드패널 열기
  loading?: boolean;
}
```

**세로 타임라인 UI**:
```
│
├─ 2024.03.01  ┌─────────────────────────────┐
│  🟢          │ 입사 · 개발팀 · 사원(S1)       │
│              └─────────────────────────────┘
│
├─ 2024.09.01  ┌─────────────────────────────┐
│  🔵          │ 수습종료 · 정규직 전환          │
│              └─────────────────────────────┘
│
├─ 2025.03.01  ┌─────────────────────────────┐
│  ⭐          │ 승진 · 과장(S3)               │
│              └─────────────────────────────┘
```

- 좌측: 날짜 + 세로 선 + 이벤트 유형 아이콘
- 우측: 이벤트 카드 (유형 · 변경내용)
- 카드 클릭 → `onEventClick` 콜백 → 사이드 패널로 상세 표시
- 최신순(위) → 과거순(아래) 정렬

### Task 3: EffectiveDatePicker 컴포넌트 (재사용 설계)

**핵심: B8-1 조직도에서도 동일하게 사용**

```typescript
// components/shared/EffectiveDatePicker.tsx

interface EffectiveDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  quickSelects?: QuickSelect[];  // 빠른선택 버튼 커스텀
  allowFuture?: boolean;         // 미래 시점 허용 여부 (HR Admin만)
  employeeHireDate?: Date;       // "입사일" 빠른선택용
}

type QuickSelect = {
  label: string;
  getDate: () => Date;
};
```

**UI**:
```
┌──────────────────────────────────────────────────────┐
│ 📅 시점 조회: [2025-12-31]  오늘 | 1년전 | 입사일 | 전기말 │
│                        ⚠️ 미래 시점 조회 중 (HR Admin)  │
└──────────────────────────────────────────────────────┘
```

**기본 빠른선택 버튼**:
- "오늘" → `new Date()`
- "1년전" → 현재 - 1년
- "입사일" → 해당 직원 입사일 (프로필에서만, `employeeHireDate` prop)
- "전기말" → 전년도 12월 31일 (인사감사/결산용)

**미래 시점 경고**: `allowFuture=true`이고 선택일이 오늘 이후면 노란 경고 배너 표시.

### Task 4: 발령이력 탭 — 타임라인 + 시점조회 + 사이드패널

```
AssignmentHistoryTab.tsx

┌────────────────────────────────────────┐
│ [EffectiveDatePicker: 시점 조회 바]      │
├────────────────────────────────────────┤
│ [AssignmentTimeline: 세로 타임라인]       │
│                                        │
│   2025.03.01 승진 · 과장(S3)            │
│   2024.09.01 수습종료 · 정규직            │
│   2024.03.01 입사 · 개발팀 · 사원         │
│                                        │
├──────────────────┬─────────────────────┤
│                  │ [SidePanel]          │
│                  │ 발령장/계약서 상세     │
│                  │ - 발령일              │
│                  │ - 유형               │
│                  │ - 이전→이후           │
│                  │ - 승인자              │
│                  │ - 첨부문서            │
└──────────────────┴─────────────────────┘
```

**데이터 소스**: `employee_assignments` + `employee_contracts` 조인

**시점 조회 동작**:
- 날짜 변경 시 → 해당 시점의 소속/직급 정보를 EmployeeHeader에 반영
- 타임라인에서 해당 시점 이벤트를 하이라이트

**API**:
```
GET /api/v1/employees/[id]/history
  → 전체 발령/계약 이력 (타임라인용)

GET /api/v1/employees/[id]/snapshot?date=2025-12-31
  → 특정 시점의 소속/직급/계약 상태 (시점조회용)
```

### Task 5: 프로필 탭 — 기본정보/연락처 편집 폼

기존 직원 편집 폼을 탭 내부로 이동. 주요 필드:

- 기본정보: 이름, 사번, 성별, 생년월일, 입사일
- 연락처: 이메일, 전화번호, 주소
- 소속정보: 법인, 부서, 직급, 직책 (읽기전용 — 변경은 발령으로)
- 계약정보: 계약유형(정규/계약/인턴), 계약기간 (읽기전용)

**주의**: 소속/직급/계약 정보는 Effective Dating 모델이므로 직접 편집이 아닌 **발령 프로세스**를 통해 변경. 프로필 탭에서는 읽기전용으로 표시하고 "발령이력 탭에서 변경" 링크를 제공.

### Task 6: 급여정보 탭 — 읽기전용 뷰

B1의 `compensation_settings`에서 해당 법인의 급여항목 구조를 가져와 표시.

```
┌────────────────────────────────────┐
│ 급여 정보 (2025년 3월 기준)          │
├────────────────────────────────────┤
│ 기본급          ₩ 48,000,000 /년    │
│ 직책수당         ₩ 3,600,000 /년    │
│ 식대 (비과세)    ₩ 2,400,000 /년    │
├────────────────────────────────────┤
│ 연봉 합계        ₩ 54,000,000      │
│ 연봉밴드 위치    과장(S3) 밴드 중간   │
│                  [====●=====]       │
│                  min   mid   max    │
└────────────────────────────────────┘
```

- `employee_compensations` 테이블에서 현재 시점 유효 레코드 조회
- B1 `compensation_settings`의 `salary_bands`와 대비하여 밴드 내 위치 시각화
- HR Admin만 조회 가능 (employee 본인은 "나의 공간 > 급여정보"에서 별도 뷰)

### Task 7: EmployeeFilterPanel — HR Admin 검색 강화

직원 목록 페이지 상단에 고급 필터 패널 추가.

**필터 항목**:
- 법인 (다중 선택)
- 부서 (법인 선택 시 해당 법인 부서만 로드)
- 직급 (법인별 직급체계 반영)
- 입사일 범위 (from ~ to)
- 계약유형 (정규/계약/인턴/파견)
- 재직상태 (재직/휴직/퇴직)

**UI 패턴**:
- 필터 칩: 적용된 필터를 칩으로 표시, x로 개별 제거
- "필터 초기화" 버튼
- 엑셀 다운로드 버튼 (필터 적용된 결과 내보내기)

**API**:
```
GET /api/v1/employees?companyId=&departmentId=&jobLevel=&hireDateFrom=&hireDateTo=&contractType=&status=&page=&limit=
```

### Task 8: BulkUploadWizard — 엑셀 일괄 업로드 (간이 버전)

**간이 버전 스코프** (전체 스펙은 추후 고도화):

```
Step 1: 엑셀 템플릿 다운로드
  → 필수 필드: 사번, 부서코드, 직급코드, 발효일
  → SheetJS로 템플릿 생성

Step 2: 수정한 엑셀 업로드
  → 파일 드래그앤드롭 + SheetJS로 파싱

Step 3: 간소화 diff 뷰
  → 변경 행만 하이라이트 (현재값 → 새값)
  → 오류 행 빨간 표시 (존재하지 않는 사번/부서코드 등)

Step 4: 확정
  → 전체 적용 (부분 적용 미지원)
  → employee_assignments INSERT (Effective Dating)
```

**미포함 (추후 고도화)**:
- 전체 diff 뷰 (행 단위가 아닌 셀 단위)
- 부분 적용 (오류 행 제외하고 나머지만)
- 다중 시트

### Task 9: 검증

```bash
# 1. 직원 프로필 5개 탭 전환 정상 동작
# 2. 발령이력 타임라인 렌더링 + 이벤트 클릭 시 사이드패널
# 3. 시점 조회: 날짜 변경 → 헤더 정보 변경 확인
# 4. 미래 시점: HR Admin만 허용, 경고 배너 표시
# 5. 급여정보 탭: 밴드 내 위치 시각화
# 6. 필터 패널: 법인+부서 연계 필터, 엑셀 다운로드
# 7. 엑셀 업로드: 템플릿 다운로드 → 업로드 → diff → 적용

npx tsc --noEmit
npm run build
# context.md 업데이트
```

---

## 산출물 체크리스트

- [ ] EmployeeProfilePage 5개 탭 통합 레이아웃
- [ ] AssignmentTimeline 컴포넌트 (범용 재사용 설계)
- [ ] EffectiveDatePicker 컴포넌트 (범용 재사용 설계)
- [ ] 발령이력 탭 (타임라인 + 시점조회 + 사이드패널)
- [ ] 프로필 탭 (기본정보/연락처 편집)
- [ ] 급여정보 탭 (읽기전용 + 밴드 시각화)
- [ ] 근태/평가 탭 comingSoon 셸
- [ ] EmployeeFilterPanel (HR Admin 고급 검색)
- [ ] BulkUploadWizard (간이 엑셀 업로드)
- [ ] API: `/employees/[id]/history`, `/employees/[id]/snapshot`
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] context.md 업데이트

---

## context.md 업데이트 내용 (세션 종료 시)

```markdown
## B2 완료 (날짜)

### 재사용 컴포넌트 (다른 세션에서 사용)
- AssignmentTimeline → B4(후보자 히스토리), B5(온보딩 타임라인)
  - import from 'components/shared/AssignmentTimeline'
  - props: events: TimelineEvent[], onEventClick
- EffectiveDatePicker → B8-1(조직도 시점조회)
  - import from 'components/shared/EffectiveDatePicker'
  - props: value, onChange, quickSelects, allowFuture, employeeHireDate
- ComingSoonTab → 범용 셸 (A1과 동일 컴포넌트 확인)

### 직원 프로필 탭 구조
- /employees/[id] → 5개 탭
- 근태현황 탭: B6에서 교체
- 평가결과 탭: B3에서 교체

### API Routes
- GET /api/v1/employees/[id]/history
- GET /api/v1/employees/[id]/snapshot?date=
- GET /api/v1/employees (필터 강화)

### 알려진 이슈
- (여기에 발견된 이슈 기록)

### 다음 세션 주의사항
- B3: 평가결과 탭을 ComingSoonTab에서 실제 컴포넌트로 교체
- B4: AssignmentTimeline을 후보자 히스토리에 재사용
- B5: AssignmentTimeline을 온보딩 타임라인에 재사용
- B6: 근태현황 탭을 ComingSoonTab에서 실제 컴포넌트로 교체
- B8-1: EffectiveDatePicker를 조직도 시점조회에 재사용
```

---

## 주의사항

1. **AssignmentTimeline은 반드시 도메인 비종속으로** — `TimelineEvent` 인터페이스가 "직원 발령" 용어에 종속되면 B4(후보자), B5(온보딩)에서 어색해집니다. `type`, `title`, `description`을 범용으로 유지하세요.

2. **시점 조회 쿼리 성능** — `employee_assignments`에 `(employee_id, effective_date)` 복합 인덱스가 있는지 확인. 없으면 추가. 시점 조회는 빈번하게 호출됩니다.

3. **급여정보 탭의 접근 제어** — employee 본인이 보는 뷰와 HR Admin이 보는 뷰가 다릅니다. B2에서는 HR Admin 뷰(직원 관리 내)만 만들고, 직원 본인 뷰("나의 공간 > 급여정보")는 B7에서 만듭니다.

4. **엑셀 업로드에서 Effective Dating 준수** — 일괄 변경도 반드시 `employee_assignments` INSERT로 처리. 기존 레코드를 UPDATE하면 이력이 깨집니다. `end_date` 처리를 빠뜨리지 마세요.

5. **기존 직원 목록/상세 페이지 라우트 변경 시** — A1 사이드바와 다른 모듈의 링크가 깨지지 않는지 확인. 라우트 변경이 필요하면 리다이렉트를 설정하세요.
