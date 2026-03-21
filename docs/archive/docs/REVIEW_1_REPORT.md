# REVIEW-1 코드 품질 + 보안 + 성능 리뷰 보고서
> 대상: B1~B10 전체 (1,233 TS 파일, 290+ API 라우트, 182 Prisma 모델)
> 일자: 2026-03-03
> 리뷰어: Claude Code (claude-sonnet-4-6)
> 상태: **B11 착수 전 FIX 필수**

---

## 요약 테이블

| 심각도 | 건수 | 즉시 조치 필요 |
|--------|------|--------------|
| 🔴 Critical | 4 | ✅ B11 착수 전 필수 |
| 🟠 Major | 6 | ✅ B11 착수 전 권장 |
| 🟡 Minor | 5 | 📋 다음 스프린트 |
| 💡 Suggestion | 3 | 📋 기술 부채 백로그 |

---

## 🔴 Critical (즉시 수정)

### C-1. payroll/anomalies — companyId 필터 누락 (멀티테넌트 데이터 유출)
**파일:** `src/app/api/v1/payroll/anomalies/route.ts`

withPermission handler에 user 파라미터 없음 + prisma.payrollItem.findMany에 companyId 필터 없음.
HR_ADMIN이 다른 법인의 급여 이상 데이터를 모두 조회 가능. 멀티테넌트 원칙 위반.

**수정 방향:**
- handler 시그니처에 `user: SessionUser` 추가
- `where: { isAnomaly: true, payrollRun: { companyId: user.companyId } }` 적용

---

### C-2. payroll/import-logs — IDOR (Insecure Direct Object Reference)
**파일:** `src/app/api/v1/payroll/import-logs/route.ts`

```
const companyId = searchParams.get('company_id') ?? user.companyId
```

악의적 HR_ADMIN이 `company_id=타_법인_ID` 를 넘겨 타 법인 급여 import 이력 열람 가능.

**수정 방향:**
- `user.role === 'SUPER_ADMIN'` 인 경우에만 query param companyId 수락
- 그 외 역할은 무조건 `user.companyId` 사용

---

### C-3. vector-search.ts — Prisma.raw() SQL Injection 리스크
**파일:** `src/lib/vector-search.ts`

`JSON.stringify(metadata)` 결과를 `Prisma.raw()` 로 SQL에 직접 삽입.
`JSON.stringify()`는 문자열 내 single-quote를 이스케이프하지 않으므로
`{ name: "O'Brian" }` 같은 값이 들어오면 PostgreSQL 구문 오류 발생.
더 복잡한 페이로드로는 SQL injection 가능.

**수정 방향:**
- `$queryRaw` 태그 템플릿 또는 Prisma 파라미터 바인딩 사용
- `Prisma.raw()` 직접 삽입 금지

---

### C-4. analytics/calculate — DB Connection Pool 고갈 (서비스 DoS 가능)
**파일:** `src/app/api/v1/analytics/calculate/route.ts`

```
Promise.allSettled(employeeIds.map((id) => calculateTurnoverRisk(id, companyId)))
```

직원 1,000명 × (15 + 7) 쿼리 = **22,000개 동시 Prisma 쿼리**.
Prisma 기본 connection pool은 10개 → 대기열 폭발 → 전체 서비스 타임아웃.

**수정 방향:** 배치 처리 (chunk 50명씩 순차 처리)
```
BATCH_SIZE = 50
for (i = 0; i < employeeIds.length; i += BATCH_SIZE) {
  const chunk = employeeIds.slice(i, i + BATCH_SIZE)
  await Promise.allSettled(chunk.map(...))
}
```

---

## 🟠 Major (B11 착수 전 권장)

### M-1. employee-risk API — 법인 간 IDOR
**파일:** `src/app/api/v1/analytics/employee-risk/route.ts:63`

HR_ADMIN이 쿼리 파라미터로 타 법인 `employee_id`를 넘기면 해당 직원의 이직·번아웃 리스크 데이터 열람 가능.
`effectiveCompanyId`를 직원 레코드에서 가져오므로 법인 검증 우회됨.

**수정 방향:** 직원 조회 후 법인 소속 검증 추가
```
if (user.role !== 'SUPER_ADMIN' && effectiveCompanyId !== user.companyId) {
  return forbidden()
}
```

---

### M-2. teams/config — Webhook URL 감사 로그 평문 저장
**파일:** `src/app/api/v1/teams/config/route.ts`

`logAudit({ ..., changes: parsed.data })` 로 전체 요청 데이터 저장.
parsed.data에 `webhookUrl` 포함 → AuditLog 조회 권한 있는 HR_ADMIN이 webhook URL 열람 가능.
Teams webhook URL = 채널 완전 쓰기 권한.

**수정 방향:** 감사 로그에서 민감 필드 제거
```
const { webhookUrl, ...safeChanges } = parsed.data
logAudit({ ..., changes: safeChanges })
```

---

### M-3. N+1 쿼리 (14개 파일)

| 파일 | 패턴 |
|------|------|
| `payroll/year-end/settlements/route.ts` | for → payrollItem.findMany |
| `org/tree/route.ts` | for → employee.findMany |
| `recruitment/applicants/[id]/route.ts` | forEach → application.findFirst |
| `org/entity-transfers/route.ts` | for → employeeAssignment.create |
| `training/enrollments/[id]/completion/route.ts` | for → trainingEnrollment.findFirst |
| `performance/calibration/sessions/[id]/route.ts` | for → performanceEvaluation.update |
| `succession/plans/[id]/candidates/route.ts` | for → employee.findUnique |
| `benefits/claims/batch/route.ts` | map → benefitClaim.create |
| `attendance/overtime/approve/route.ts` | for → overtime.findFirst |
| `payroll/components/apply/route.ts` | for → payrollItem.create |
| `onboarding/tasks/bulk-assign/route.ts` | for → onboardingTask.upsert |
| `compliance/violations/route.ts` | forEach → employee.findFirst |
| `leave/batch-approve/route.ts` | for → leaveRequest.update |
| `analytics/headcount/route.ts` | map → department.findMany |

**수정 방향:** `createMany()` / `updateMany()` 또는 IN 절 배치 쿼리로 교체.

---

### M-4. Unbounded findMany — 페이지네이션 없음 (40+ 라우트)

직원 목록, 급여 항목 등 고빈도 목록 API에서 `take`/`skip` 없이 전체 조회.
데이터 증가 시 메모리 급증 + 응답 지연 발생.

**수정 방향:** 모든 목록 API에 cursor 또는 offset 페이지네이션 적용 필수.

---

### M-5. Soft Delete 4개 패턴 혼재 (12개 모델)

| 패턴 | 모델 수 | 대표 |
|------|---------|------|
| `isActive` + `deletedAt` (이중) | 8 | Company, Department, LeavePolicy, RewardRecord, BenefitPolicy, TrainingCourse, HrDocument, CustomField |
| `isActive` 만 | ~30 | JobCategory, Position, AttendanceTerminal |
| `deletedAt` 만 | ~10 | JobGrade, Employee, EmployeeDocument |
| Hard Delete | 다수 | Holiday, RecognitionLike |

이중 사용 모델에서 `isActive=false` 이지만 `deletedAt=null` 인 레코드 발생 가능 → 쿼리 로직 오류 위험.

**수정 방향:** `deletedAt DateTime?` 단일 패턴으로 통일.

---

### M-6. 응답 형식 불일치 (16개 파일)

```
apiSuccess() 사용: 945회
apiError()  사용: 79회
NextResponse.json() 직접: 60회 (16개 파일에서 표준 미적용)
```

대표 파일: `analytics/calculate/route.ts`, `payroll/anomalies/route.ts`, `hr-chatbot/route.ts`
(health check 엔드포인트는 허용)

**수정 방향:** 16개 파일 `apiSuccess()` / `apiError()` 교체.

---

## 🟡 Minor (다음 스프린트)

### N-1. 누락 DB 인덱스 (9개 핵심 모델)

| 모델 | 권장 인덱스 |
|------|------------|
| `Employee` | `@@index([employeeNumber])`, `@@index([hireDate])` |
| `JobPosting` | `@@index([companyId, status])` |
| `Applicant` | `@@index([email])` |
| `PayrollRun` | `@@index([companyId, status])`, `@@index([year, month])` |
| `MboGoal` | `@@index([cycleId, status])` |
| `PerformanceEvaluation` | `@@index([cycleId, companyId])` |
| `DisciplinaryAction` | `@@index([employeeId, status])` |
| `OneOnOne` | `@@index([employeeId, managerId, status])` |

---

### N-2. `as any` 남용 (78개)

78개 중 위험 구간: 인증/권한 타입 캐스팅.
`session.user as { role?: string; companyId?: string }` 패턴 → `types/session.ts`의 `SessionUser` 타입으로 통일.

---

### N-3. 직접 process.env 접근 (2개)

`src/lib/analytics/queries.ts` 에서 `env.ts` 우회하여 `process.env.DATABASE_URL` 직접 접근.
검증된 `env.ts` 변수만 사용하도록 교체.

---

### N-4. String status 필드 → enum 미변환 (11개 모델)

OrgRestructurePlan, BenefitClaim, Requisition, AttendanceApprovalRequest 등 11개 모델의 `status` 필드가 `String` 타입.
Prisma enum 변환 시 컴파일 타임 타입 안전성 확보.

---

### N-5. @db.Uuid 미적용 (182개 전 모델)

전체 182개 모델 `@id` 필드가 `@db.Uuid` 없이 TEXT로 저장됨.
UUID 네이티브 타입 전환 시 저장 용량 절반(36자 → 16바이트), 인덱스 효율 개선.
마이그레이션 필요하므로 별도 스케줄 권장.

---

## 💡 Suggestion (기술 부채 백로그)

### S-1. Json 필드 정규화 후보 (96개 중 우선 3개)

- `WorkSchedule.dailyConfig` → `WorkScheduleDay` 테이블 (요일별 근무시간)
- `ShiftPattern.slots` → `ShiftSlot` 테이블
- `EmsBlockConfig.blockDefinitions` → `EmsBlock` 테이블

설정 전용 Json(TenantSetting, AnalyticsConfig)은 현행 유지 허용.

---

### S-2. Employee 역방향 관계 선언 여부 결정

아래 모델은 단방향만 존재 → Employee에서 `include`로 역참조 불가:
`EmployeeAuth`, `SsoIdentity`, `SsoSession`, `ProfileVisibility`, `OnboardingCheckin`

의도적 단방향이라면 주석으로 명시. 역참조 필요 시 Employee 모델에 관계 추가.

---

### S-3. analytics/queries.ts $queryRawUnsafe INTERVAL 직접 삽입

```
INTERVAL '${weeks} weeks'
```

현재 Zod 정수 검증(min:4, max:52)으로 인젝션 불가. 향후 유지보수 시 검증 제거 위험.
`Prisma.sql` 태그 사용 권장.

---

## 공통화 후보

| 항목 | 현황 | 제안 |
|------|------|------|
| companyId 필터 검증 | 각 라우트에서 개별 구현 | `withCompanyFilter(user)` 미들웨어 헬퍼 |
| 페이지네이션 파라미터 파싱 | 40+ 라우트에서 중복 | `parsePagination(searchParams)` 유틸 |
| 배치 DB 처리 | 14곳에서 N+1 | `batchProcess<T>(items, fn, size=50)` 유틸 |
| 감사 로그 민감 필드 마스킹 | 수동 처리 | `sanitizeAuditChanges(changes, sensitiveKeys[])` 헬퍼 |

---

## 기술 부채 요약

| 범주 | 현황 | 목표 |
|------|------|------|
| TypeScript 오류 | 0 ✅ | 유지 |
| as any | 78개 | < 20개 |
| N+1 쿼리 | 14개 파일 | 0 |
| 무한 findMany | 40+ | 0 (모든 목록 API 페이지네이션) |
| Soft delete 패턴 | 4가지 혼재 | 1가지 통일 |
| 응답 형식 불일치 | 16개 파일 | 0 |
| Critical 보안 이슈 | 4건 | 0 |
| DB 인덱스 누락 | 9개 핵심 모델 | 추가 완료 |

---

## 잘 된 점 ✅

- **TypeScript 빌드:** `tsc --noEmit` 0 errors, `npm run build` 성공
- **XSS 방어:** 위험한 innerHTML 직접 삽입 없음
- **시크릿 하드코딩:** 없음 (전부 env.ts 경유)
- **Cron 인증:** 3개 cron 라우트 모두 `verifyCronSecret()` 정상 적용
- **Teams Webhook 인증:** `verifyWebhookSignature()` HMAC 정상 적용
- **이직/번아웃 API 권한:** HR_ADMIN/SUPER_ADMIN 전용 → 적절
- **`withPermission` HOC:** 290+ 라우트 대부분 적용
- **감사 로그:** 핵심 write 액션에 `logAudit()` 정상 적용
- **Prisma 네이밍:** 182개 모델 모두 PascalCase + @@map(snake_case) 일관 적용
- **멀티테넌트 일반:** 대부분 라우트에서 companyId 필터 정상 적용 (C-1, C-2 예외)

---

*이 보고서는 정적 분석 + 코드 검토 기반입니다. 실제 DB 실행 계획(EXPLAIN ANALYZE) 및 부하 테스트는 별도 수행이 필요합니다.*
