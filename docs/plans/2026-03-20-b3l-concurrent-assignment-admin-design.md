# B-3l: 겸직 Assignment 추가/종료 Admin UI

> **Date**: 2026-03-20
> **Status**: Gemini Review 완료 → 구현 대기

---

## 1. 목표

HR Admin이 직원 상세 페이지의 발령이력 탭에서 겸직(secondary assignment)을 추가/종료할 수 있는 UI 제공.

## 2. 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| UI 위치 | 기존 발령이력(AssignmentHistoryTab) 탭에 통합 | Workday "Add Additional Job" 패턴 — 별도 탭 불필요 |
| 승인 워크플로우 | 즉시 반영 (승인 없음) | 현재 발령 패턴과 일관, Workday도 기본 즉시 반영 |
| 데이터 패턴 | Append-only | 기존 컨벤션 유지: endDate 설정 → 새 row 생성 |
| 권한 | HR_ADMIN, SUPER_ADMIN만 | MANAGER/EMPLOYEE는 조회만 가능 |
| changeType | `CONCURRENT` | B-3e에서 이미 정의된 값 |

## 3. 현재 구조 분석

### AssignmentHistoryTab (현재)
- Timeline 기반 발령이력 조회 (읽기 전용)
- `GET /api/v1/employees/[id]/history` — 전체 발령 목록 (isPrimary 필터 없음)
- `GET /api/v1/employees/[id]/snapshot?date=` — 시점별 주 발령 조회
- EffectiveDatePicker로 시점 탐색
- Side panel에 상세정보 표시

### 기존 History API 응답
- 이미 isPrimary=false 레코드도 포함 (필터 없음)
- 하지만 UI에서 주/겸직 구분 표시 안 함

## 4. 변경 범위

### 4.1 UI 변경 — AssignmentHistoryTab 확장

```
┌─────────────────────────────────────────────────┐
│ 발령이력                                          │
│                                                   │
│ ┌─ 현재 겸직 현황 ─────────────────────────────┐  │
│ │ 🏢 CTR-MOB | QM팀장 | 2025-01-15 ~   [종료] │  │
│ │ 🏢 CTR-ECO | CFO    | 2025-03-01 ~   [종료] │  │
│ │                                               │  │
│ │ [+ 겸직 추가]                                  │  │
│ └───────────────────────────────────────────────┘  │
│                                                   │
│ ── 발령 타임라인 ──────────────────────────────   │
│ ● 2025-03-01 겸직발령 CTR-ECO CFO      [겸직]   │
│ ● 2025-01-15 겸직발령 CTR-MOB QM팀장   [겸직]   │
│ ● 2024-03-01 입사 CTR 품질관리팀장      [주]     │
│ └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**변경 사항:**
1. **겸직 현황 섹션** (상단, HR_ADMIN만 표시)
   - 현재 활성 겸직 목록 (isPrimary=false, endDate=null)
   - 각 항목에 "종료" 버튼
   - "겸직 추가" 버튼
2. **타임라인 뱃지** (모든 사용자)
   - isPrimary 여부에 따라 `[주]` / `[겸직]` 뱃지 표시

### 4.2 겸직 추가 Dialog

```
┌─ 겸직 추가 ──────────────────────────┐
│                                       │
│ 법인 *     [▼ CTR-MOB            ]   │
│ 부서       [▼ 품질관리팀         ]   │
│ 직급       [▼ 팀장               ]   │
│ 직책(Position) [▼ QM팀장         ]   │
│ 고용형태   [▼ 정규직             ]   │
│ 발효일 *   [📅 2026-03-20       ]   │
│ 사유       [________________     ]   │
│                                       │
│         [취소]  [추가]               │
└───────────────────────────────────────┘
```

**필드:**
- 법인 (companyId) — 필수. **SUPER_ADMIN: 전체 법인 선택 가능 / HR_ADMIN: 자기 법인만** (Gemini #1 패치)
- 부서 (departmentId) — 선택. 선택한 법인의 부서 목록 필터
- 직급 (jobGradeId) — 선택
- 직책/Position (positionId) — 선택. 선택한 법인+부서의 Position 목록
> ⚠️ **Gemini #1 패치**: HR_ADMIN이 타 법인 부서/직책 드롭다운 조회 시 RLS 403 에러 발생.
> 해결: 타 법인 겸직 추가는 SUPER_ADMIN 전용으로 제한. HR_ADMIN은 자기 법인 내 겸직만 추가 가능.
- 고용형태 (employmentType) — 기본값: 주 발령과 동일
- 발효일 (effectiveDate) — 필수. 기본값: 오늘
- 사유 (reason) — 선택

**isPrimary는 자동으로 false**, changeType은 자동으로 `CONCURRENT`.

### 4.3 겸직 종료 확인 Dialog

```
┌─ 겸직 종료 ──────────────────────────┐
│                                       │
│ CTR-MOB QM팀장 겸직을 종료합니다.     │
│                                       │
│ 종료일 *   [📅 2026-03-20       ]   │
│ 사유       [________________     ]   │
│                                       │
│         [취소]  [종료]               │
└───────────────────────────────────────┘
```

**동작:**
- 해당 assignment의 `endDate`를 종료일로 설정 (UPDATE, 유일한 예외)
- ⚠️ **Append-only 예외**: 종료는 기존 row의 endDate만 설정. 새 row 생성 불필요.
  - 근거: 주 발령 변경 시에는 "이전 close + 새 open"이지만, 겸직 종료는 단순 비활성화라 새 row가 무의미

> ⚠️ **Gemini #2 패치**: 타임라인에서 "겸직 종료" 이벤트 표시 필요.
> 해결: 별도 changeType 변경이나 새 row 대신, **타임라인 렌더링 시 endDate가 있는 CONCURRENT 레코드를 "겸직 종료" 이벤트로 추가 렌더링**. 스키마 변경 없음.
> - 타임라인 이벤트 2개 생성: effectiveDate에 "겸직 시작", endDate에 "겸직 종료"
> - Analytics 통계: `WHERE changeType='CONCURRENT' AND endDate IS NOT NULL AND endDate BETWEEN ...` 로 종료 건수 추출 가능

### 4.4 API 엔드포인트

#### POST `/api/v1/employees/[id]/assignments/concurrent`
겸직 추가

**Request Body:**
```json
{
  "companyId": "uuid",
  "departmentId": "uuid | null",
  "jobGradeId": "uuid | null",
  "positionId": "uuid | null",
  "employmentType": "FULL_TIME",
  "effectiveDate": "2026-03-20",
  "reason": "string | null"
}
```

**로직:**
1. 권한 검증: HR_ADMIN 또는 SUPER_ADMIN
2. **Gemini #1+#3 패치: 법인 스코프 검증** — HR_ADMIN인 경우, 요청 body의 companyId가 호출자 법인과 일치하는지 확인 (자기 법인 내 겸직만). SUPER_ADMIN은 전체 법인 가능.
3. 대상 직원 존재 확인
4. 동일 회사+부서+직책 중복 겸직 체크 (active 기준)
5. EmployeeAssignment 생성: `isPrimary: false, changeType: 'CONCURRENT', status: 'ACTIVE'`
6. Response: 생성된 assignment

#### PATCH `/api/v1/employees/[id]/assignments/[assignmentId]/end`
겸직 종료

**Request Body:**
```json
{
  "endDate": "2026-03-20",
  "reason": "string | null"
}
```

**로직:**
1. 권한 검증: HR_ADMIN 또는 SUPER_ADMIN
2. Assignment 존재 + isPrimary=false 확인 (주 발령 종료 방지!)
3. **Gemini #3 패치: 법인 스코프 검증** — HR_ADMIN인 경우, 대상 직원의 주 발령(isPrimary=true) 법인이 호출자의 법인과 일치하는지 확인. SUPER_ADMIN은 스킵.
4. endDate가 effectiveDate 이후인지 검증
5. endDate가 null인지 확인 (이미 종료된 겸직 재종료 방지)
6. `UPDATE endDate` 실행
7. Response: 업데이트된 assignment

### 4.5 보안 고려사항

| 위협 | 대응 |
|------|------|
| 비권한자 겸직 추가 | withPermission + role 체크 (HR_ADMIN, SUPER_ADMIN) |
| 주 발령 종료 시도 | isPrimary=false 강제 체크 |
| 이미 종료된 겸직 재종료 | endDate IS NULL 체크 |
| 타 법인 HR Admin의 겸직 추가 | HR_ADMIN은 자기 법인 내 겸직만 추가 가능, 타 법인 겸직은 SUPER_ADMIN 전용 (Gemini #1) |
| IDOR (타인 assignment 종료) | assignmentId의 employeeId 일치 + 직원의 주 발령 법인 = 호출자 법인 검증 (Gemini #3) |
| 겸직 종료 이력 추적 | 타임라인에서 endDate 있는 CONCURRENT를 "겸직 종료" 이벤트로 이중 렌더링 (Gemini #2) |

## 5. 파일 변경 목록

| 파일 | 변경 | 설명 |
|------|------|------|
| `src/components/employees/tabs/AssignmentHistoryTab.tsx` | 수정 | 겸직 현황 섹션 + 타임라인 뱃지 추가 |
| `src/components/employees/dialogs/AddConcurrentDialog.tsx` | 신규 | 겸직 추가 Dialog |
| `src/components/employees/dialogs/EndConcurrentDialog.tsx` | 신규 | 겸직 종료 Dialog |
| `src/app/api/v1/employees/[id]/assignments/concurrent/route.ts` | 신규 | POST 겸직 추가 API |
| `src/app/api/v1/employees/[id]/assignments/[assignmentId]/end/route.ts` | 신규 | PATCH 겸직 종료 API |

## 6. DO NOT TOUCH

```
- src/components/layout/*
- src/config/navigation.ts
- messages/*.json
- prisma/seed.ts
- prisma/schema.prisma (스키마 변경 없음 — 모든 필드 이미 존재)
- src/middleware.ts
- src/lib/api/companyFilter.ts
- src/lib/prisma-rls.ts
- src/lib/api/withRLS.ts
```

## 7. 검증 계획

1. HR_ADMIN으로 로그인 → 직원 상세 → 발령이력 탭에 겸직 현황 섹션 표시 확인
2. EMPLOYEE로 로그인 → 겸직 현황 섹션 숨김 + 타임라인 뱃지만 표시 확인
3. 겸직 추가 → DB에 isPrimary=false, changeType=CONCURRENT 확인
4. 겸직 종료 → DB에 endDate 설정 확인
5. 주 발령에 종료 버튼 표시 안 됨 확인
6. API 직접 호출로 isPrimary=true assignment 종료 시도 → 400 에러 확인
