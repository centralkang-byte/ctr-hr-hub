# N+18 Pre-flight — Detail 6탭 → 7탭 정렬 (EM-002 + Q2=B)

> **base SHA**: `9a940408` · **트랙**: proto + 코드베이스 · **우선**: HIGH
> **결정 (Stage 3 Q2=B)**: 코드베이스 6탭 → 7탭 (career 추가)
> **본 pre-flight 결과 (요약)**: ⚠️ **"DB 무관 순수 UI" 주장 부분 정정 필요**. Prisma 에 career 데이터 모델 0건. graceful empty 또는 별도 모델 트랙 사전 결정 필요.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 코드베이스 현황

| 경로 | 라인 | 핵심 발견 |
|---|---|---|
| `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx` | 892 | Tabs 6개 (Radix UI). InfoRow utility (L169-) + tabs L632-660 |
| `src/components/employees/tabs/AssignmentHistoryTab.tsx` | — | 발령이력 |
| `src/components/employees/tabs/CompensationTab.tsx` | — | 급여정보 |
| `src/components/employees/tabs/AttendanceTab.tsx` | — | 근태현황 (B6-1) |
| `src/components/employees/tabs/LoaTab.tsx` | — | 휴직 |
| (Performance 탭 컴포넌트) | — | 평가결과 — 별도 컴포넌트 또는 inline |

### 현재 6탭 inventory (EmployeeDetailClient.tsx)

```
TabsTrigger value="profile"            → t('detailTabProfile')
TabsTrigger value="assignment-history" → t('detailTabAssignment')
TabsTrigger value="compensation-info"  → t('detailTabCompensation')  [HR Admin only]
TabsTrigger value="attendance"         → t('detailTabAttendance')
TabsTrigger value="loa"                → t('detailTabLoa')
TabsTrigger value="performance"        → t('detailTabPerformance')
```

i18n (messages/ko.json:918-923):
```
detailTabProfile / detailTabAssignment / detailTabCompensation /
detailTabAttendance / detailTabLoa / detailTabPerformance
```

### Proto 측 7탭

```
summary / job / payroll / attendance / leave / perf / career
```

career 탭 구성 (proto): 학력 / 자격증 / 사내교육 / 사내활동

### ⚠️ DB 모델 부재 확인

`prisma/schema.prisma` grep 결과:
- `EmployeeEducation` — **부재**
- `EmployeeCertification` — **부재**
- `EmployeeActivity` — **부재**
- `EmployeeCareer` — **부재**
- `workHistory` — **부재**
- `educationHistory` — **부재**

존재 모델: `TrainingCourse` / `TrainingEnrollment` (직원이 수강하는 교육 프로그램 — career 탭의 "사내교육" 일부와 매핑 가능하지만, 학력/자격증/사내활동은 별도 모델 필요)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 진입 접근법 비교

| 접근법 | 변경 surface | line delta | DB 영향 | 위험 |
|---|---|---|---|---|
| **A: graceful empty** | 신규 CareerTab.tsx (~80 lines, EmptyState만) + EmployeeDetailClient (+5 lines TabsTrigger+TabsContent) + i18n 5 keys × 5 locale = 25 entries | ~115 lines | **0** | 사용자 기대치 mismatch (career 탭 빈 화면) |
| **B: 신규 DB 모델 + API + UI** | 3 model 신설 (Education/Certification/Activity) + 3 API endpoint + 3 RLS + CareerTab (full) | ~600+ lines | schema migration + RLS + seed | 별도 batch 규모, 본 N+18 scope 초과 |
| **C: TrainingEnrollment 활용 + graceful empty** | 사내교육 = TrainingEnrollment lookup, 나머지 3 섹션 = EmptyState | ~150 lines | 0 | TrainingEnrollment 데이터 가시화 부분 가치 |

**가디언 권고**: **A → C** (점진) — A 로 진입(Q2=B 결정 충족 + 데모 한계 명시), 차후 B 별도 batch로 격상.

### (b) A 접근 inventory (1순위)

**신규 파일**:
- `src/components/employees/tabs/CareerTab.tsx` (~80 lines)
  - 4 섹션 (학력 / 자격증 / 사내교육 / 사내활동) 모두 EmptyState + "데모 한계: career 데이터 미수집" 배너

**수정 파일**:
- `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx`:
  - `import { CareerTab }` 추가
  - `<TabsTrigger value="career">{t('detailTabCareer')}</TabsTrigger>` 1줄
  - `<TabsContent value="career"><CareerTab /></TabsContent>` 1줄
  - 약 5 lines 추가

**i18n** (messages/{ko,en,zh,vi,es}.json):
- `detailTabCareer`: "경력 이력" / "Career"
- `careerEducation`: "학력"
- `careerCertification`: "자격증"
- `careerTraining`: "사내교육"
- `careerActivity`: "사내활동"
- `careerEmpty`: "수집된 데이터 없음" (또는 데모 한계 표기)
- 6 키 × 5 locale = **30 entries**

**총 예상 line delta**: ~115 lines + 30 i18n entries

---

## §3. i18n / DB / API 영향 평가

### i18n
- 6 신규 키 × 5 locale = 30 entries (ko/en/zh/vi/es)
- 기존 `detailTab*` 컨벤션 정합

### DB
- **A 접근**: 변경 0
- **B 접근 (별도 트랙)**: 3 모델 추가 (`EmployeeEducation`, `EmployeeCertification`, `EmployeeActivity`) + migration + RLS

### API
- **A 접근**: 변경 0 (frontend only)
- **B 접근 (별도 트랙)**: 3 endpoint (`/api/v1/employees/[id]/education`, `/certifications`, `/activities`) + GET/POST/PUT/DELETE 4 method 각 × 3 = 12 routes

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH)**: 사용자 가디언 "DB 무관 순수 UI 분할" 주장은 **부분만 정확**. career 탭 추가 자체는 UI만이지만, 의미 있는 데이터 가시화는 DB 신설 필요. **사전 합의 필요** (A graceful empty vs B 별도 모델 트랙).
- **R2 (MEDIUM)**: A 진입 후 사용자가 "왜 빈 화면?" 피드백 시 B 트랙 우선순위 격상 → 별도 batch 진입
- **R3 (LOW)**: 7번째 탭 추가로 모바일 가로 스크롤 위험 — TabsList 가로 스크롤 처리 검증 필요

### 의존성
- **PR-5A 머지**
- **사용자 사전 합의** — A vs C vs B(별도 트랙) 진입 선택 게이트

### 가드
- ❌ 별도 합의 없이 B 진입 금지 (scope creep)
- ❌ TrainingEnrollment 외 다른 도메인 모델 임의 사용 금지
- ✅ A 우선 진입, 데모 한계 배너 명시

---

## §5. Implementation 단계 (PR-5A 머지 후, A 접근 가정)

1. **사전 합의 게이트** — A/C/B 진입 선택 (사용자 결정 필요)
2. **branch**: `feat/employees-7tab-career` off PR-5A 머지된 main
3. **commit 1**: i18n 신규 키 30 entries 5 locale
4. **commit 2**: `CareerTab.tsx` 신설 (graceful empty + 4 섹션 EmptyState)
5. **commit 3**: `EmployeeDetailClient.tsx` TabsTrigger+TabsContent 추가
6. **e2e**: `e2e/flows/employees-detail-tabs.spec.ts` — 7탭 클릭 + career 빈 상태 EmptyState 표시
7. **gstack 시각**: 모바일 TabsList 가로 스크롤 + 다크 + 라이트
8. **codex Gate 1+2**: 표준
9. **PR open**: `feat/employees-7tab-career` → main

**C 접근 (TrainingEnrollment 활용) 진입 시 추가**:
- `src/lib/employees/career.ts` (pure functions): TrainingEnrollment → CareerTab "사내교육" 섹션 매핑
- API endpoint 신규 0 (`/api/v1/employees/[id]/snapshot` 확장 또는 기존 사용)

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **i18n**: 5 locale × 6 키 = 30 entries 검증 (`grep -c "detailTabCareer" messages/*.json`)
- ✅ **e2e**: 7탭 클릭 + career 빈 상태 + 모바일 reflow
- ✅ **시각 회귀**: 라이트/다크/모바일 3축
- ✅ **A11y**: axe-core 탭 영역 + Radix Tabs 정합 자체 검증

---

## §7. 별도 트랙 — career 데이터 모델 (B 접근 격상 시)

본 N+18 진입 0, 별도 batch 후보 (예: **batch 06 — 직원 경력 데이터**).

**spec**:
- 3 Prisma model 신설: `EmployeeEducation` / `EmployeeCertification` / `EmployeeActivity`
- 각 model: `id` / `employeeId` / `companyId` / 도메인 필드 / `createdAt` / `updatedAt` / `deletedAt`
- RLS: companyFilter 표준 + employee.companyId 정합
- API: 3 endpoint × 4 method = 12 routes
- UI: CareerTab graceful empty → 데이터 가시화 + CRUD
- i18n: 추가 ~50 키

**예상 규모**: 1주 작업, 별도 PR 또는 batch 06 진입

---

**상태**: pre-flight 완료, 사전 합의 게이트 대기 (A/C/B 선택)
**Stage 4 예상 PR 크기 (A 접근)**: 3 commits, ~115 lines + 30 i18n entries
