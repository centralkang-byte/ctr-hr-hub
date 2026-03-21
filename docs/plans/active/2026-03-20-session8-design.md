# Track B Phase 3 Session 8 — Design Document

> **Date**: 2026-03-20
> **Branch**: `track-b-phase3-session8` (from `track-b-phase3-session7`)
> **Scope**: B-3e, B-3f, B-3g, B-3h, B-3j, B-3k
> **Estimated**: ~7h
> **Deferred to Session 9**: B-3i (Manager Hub dotted line UI), B-3l (겸직 Admin UI)

---

## B-3e: 겸직 Seed (1h)

**목표**: 6명의 겸직자에게 Secondary Assignment 추가

| 이름 | Primary | Secondary |
|------|---------|-----------|
| 이동옥 | CTR 대표이사 | CTR CFO, CTR-ECO CFO |
| 정병주 | CTR 품질경영팀장 | CTR-MOB 품질경영팀장(겸) |
| 이경수 | CTR-MOB 경영관리팀장 | EHS팀장(겸), 정보보안팀장(겸) |
| 방우영 | CTR SCM본부장 | OM팀 팀장(겸) |
| 한성욱 | CTR 재무회계팀장 | CTR-ECO 재무회계팀장(겸) |
| 박양원 | AM R&D센터장 | 설계팀V 팀장(겸) |

**구현**:
- 새 seed 파일 `prisma/seeds/41-concurrent-assignments.ts`
- Append-Only: 기존 Primary 미수정, Secondary만 `isPrimary: false`로 추가
- deterministic UUID 패턴 유지
- `seed.ts`에 import 추가

**[Gemini 패치 #1] 시간의 역전 방어**:
- Secondary Assignment의 `effectiveDate`는 반드시 해당 직원의 기존 Primary Assignment의 `effectiveDate`와 동일하게 설정
- 이유: Seed는 초기 마이그레이션이므로 "겸직 시작 시점"이라는 이력 변경점을 만들지 않음. 기존 Primary를 닫지 않고 Secondary를 얹는 타협이므로, effectiveDate 불일치에 의한 시계열 데이터 꼬임을 원천 차단
- 운영 시(B-3l Admin UI)에는 정식 Append-Only 절차 적용: 기존 Primary 닫기 → 새 Primary + Secondary 동시 발급

---

## B-3f: Performance 매트릭스 데이터 연결 (0.5h)

**목표**: dottedLinePositionId를 Performance 모듈에 연결

**구현 범위**:
- Dotted Line Manager를 Peer Review 후보에 자동 포함
- `src/app/api/v1/performance/peer-review/candidates/route.ts`에서 dotted line manager 조회 추가
- Org Tree 조회 시 dotted line 점선 표시

**명시적 제외 (배포 후 2차)**:
- Solid/Dotted 가중 합산 로직
- 가중치는 Settings에서 법인별/부서별 조정 가능하게 설계 (기본값 70:30)
- 정책 확정 + 구현 복잡도로 인해 미룸

---

## B-3g: 크로스-법인 READ 허용 — 옵션 A (3h)

**목표**: Dotted Line / Secondary Assignment로 연결된 타 법인 직원을 READ-ONLY 조회

**가장 복잡한 항목.**

### 대상 API (3~4개)
| API | 용도 | 접근 수준 |
|-----|------|---------|
| Manager Hub 직원 목록 | Dotted Line 직원 포함 조회 | READ-ONLY |
| Org Tree 조회 | 타 법인 점선 표시 | READ-ONLY |
| Performance 피드백 조회 | Dotted Manager 피드백 열람 | READ-ONLY |

### 구현 방식
1. 대상 API만 `withRLS()` 바깥에서 실행
2. 앱 코드에서 Assignment 기반 접근 검증
3. READ-ONLY만 허용 (수정/삭제/급여 → 403)

### 보안 3중 체크 (AND 조건)
```
조건 1: 호출자 역할 MANAGER 이상
조건 2: 호출자가 dottedLinePositionId 보유 또는 타 법인 Secondary Assignment 보유
조건 3: 요청 대상 직원이 호출자의 dotted/secondary 관계에 해당
→ 3개 전부 충족 시에만 READ-ONLY 반환
→ 1개라도 미충족 → withRLS() 경로 fallback
```

### 핵심 헬퍼 함수 (신규)
```typescript
// src/lib/api/cross-company-access.ts

// 단건 검증용 (상세 조회)
async function verifyCrossCompanyAccess(
  callerId: string,
  targetEmployeeId: string
): Promise<{ allowed: boolean; readOnly: true }>

// 다건 리스트 조회용 (WHERE 조건 빌더) — [Gemini 패치 #2]
async function getCrossCompanyReadFilter(
  callerId: string
): Promise<Prisma.EmployeeWhereInput>
```

**[Gemini 패치 #2] N+1 방지**:
- Manager Hub 리스트 API 등에서 직원 N명을 루프로 `verifyCrossCompanyAccess()`하면 N+1 쿼리 폭탄
- `getCrossCompanyReadFilter()`는 호출자의 dotted/secondary 관계를 1회 조회 → Prisma WHERE 조건 객체 반환
- 리스트 API는 이 WHERE 조건을 쿼리에 합성하여 1회 DB 호출로 처리
- 단건 `verifyCrossCompanyAccess()`는 상세 조회(Employee Detail) 등 단건 접근 시에만 사용

### 보호 원칙
- `resolveCompanyId()` — 미수정 (보호 파일)
- `prisma-rls.ts` — 미수정 (보호 파일)
- `withRLS.ts` — 미수정 (보호 파일)

### 검증
```
□ CTR 본부장(dotted 보유) → Manager Hub에서 CTR-CN dotted 직원 보임 (READ)
□ CTR 본부장 → CTR-CN 직원 급여 조회 → 403
□ CTR 본부장 → CTR-CN 직원 수정 → 403
□ CTR-CN HR Admin → CTR-CN 전체 권한 유지
□ 이동옥(CTR Primary) → CTR-ECO Manager Hub 접근 가능 (Secondary)
□ 일반 EMPLOYEE → 우회 API → 타 법인 데이터 안 보임
□ MANAGER + dotted/secondary 없음 → 타 법인 데이터 안 보임
□ MANAGER + dotted 보유 → 관계 없는 직원 → 안 보임
```

---

## B-3h: 겸직자 결재 + 연차 차감 Primary 고정 (1h)

**목표**: 결재선과 연차를 Primary Assignment 기준으로 고정

### 결재
- Leave/Attendance/Performance 결재 → Primary Assignment의 `reportsToPositionId` 상위자에게만
- Secondary의 reportsTo는 결재 대상에서 명시적 제외
- `src/lib/workflow.ts`의 `resolveApprover()`에서 `isPrimary: true` 강화
- edge case 방어: 코드 레벨에서 Primary만 사용 명시

### 연차 차감
- 겸직자가 어느 법인 업무 중 연차를 쓰든, **Primary 법인 잔여일수에서 차감**
- Secondary 법인에 별도 잔여일수 생성하지 않음
- `leave/requests/route.ts` — 신청 시 Primary companyId 기준 balance 조회
- `leave/balances/[employeeId]/route.ts` — 잔여일수 조회도 Primary 기준

### 검증
```
□ 한성욱(CTR Primary, CTR-ECO Secondary) → 연차 → CTR 상위자에게만
□ 이동옥(3 assignment) → 결재 → Primary 기준
□ Secondary 조직장 → 결재 inbox에 안 나타남
□ 한성욱 연차 조회 → CTR 잔여일수만 표시
□ CTR-ECO에서 한성욱 연차 잔여일수 → 표시 안 됨
```

---

## B-3j: 급여 모듈 isPrimary 필터 + 해외법인 제외 (0.5h)

**목표**: Payroll Run 겸직 중복 방지 + 해외법인 계산 엔진 차단

### 국내법인 Payroll Run
- 기존 코드 대부분 `isPrimary: true, endDate: null` 필터 적용됨
- `effectiveDate: { lte: now }` 명시 필요한 곳 점검 및 추가
- 이동옥 → CTR Payroll에만 포함, CTR-ECO에는 미포함

### 해외법인 차단 (R-3)

**[Gemini 패치 #3] 하드코딩 국내법인 목록으로 검증**:
- `company.country !== 'KR'` 데이터 속성 의존 → 캐시 오류/클라이언트 조작 위험
- 안전한 하드코딩 상수 목록으로 차단:
```typescript
// src/lib/constants.ts에 추가
export const DOMESTIC_COMPANY_CODES = [
  'CTR-HOLD', 'CTR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENR', 'CTR-FML'
] as const;

// POST /api/v1/payroll/periods/[id]/calculate 최상단
if (!DOMESTIC_COMPANY_CODES.includes(company.code)) {
  throw forbidden('해외법인은 로컬 시스템에서 급여를 처리합니다.')
}
```
- 해외법인 HR_ADMIN: Upload(연동)만 허용, 계산 엔진 차단
- 해외법인 직원 급여 화면 → "로컬 시스템에서 처리됩니다" 안내

### 검증
```
□ CTR Payroll Run → 이동옥 포함 (Primary: CTR)
□ CTR-ECO Payroll Run → 이동옥 미포함 (Secondary)
□ CTR-CN Payroll Run → 실행 불가 ("로컬 처리" 안내)
□ CTR-CN HR_ADMIN → POST /calculate → 403
□ CTR-CN HR_ADMIN → POST /import → 200 (Upload 허용)
```

---

## B-3k: Pre-hire 안내 화면 (1h)

**목표**: 미래 발령 입사자 로그인 시 500 에러 대신 안내 화면

### 현재 상태
- `src/lib/auth.ts`에서 `effectiveDate: { lte: now }` 필터 → pre-hire는 assignment 없음
- 로그인 성공하지만 대시보드 모듈에서 `fetchPrimaryAssignment()` → `undefined` → 500 가능

### 구현

**[Gemini 패치 #4] 별도 라우트 격리 (무한 리다이렉트 방지)**:
- 레이아웃 단에서 컴포넌트 교체만 하면, 하위 page.tsx의 서버 컴포넌트가 API/DB 조회 → throw Error → React 에러 바운더리/미들웨어와 엉켜 무한 리다이렉트 위험
- 해결: Pre-hire 상태일 경우 `redirect('/pre-hire')`로 완전히 격리된 라우트로 이동

1. **대시보드 레이아웃** (`src/app/(dashboard)/layout.tsx`):
   - session 확인 후 `fetchPrimaryAssignment(employeeId)` 호출
   - 결과 없으면 → `redirect('/pre-hire')` (Next.js server redirect)

2. **Pre-hire 전용 라우트** (`src/app/(auth)/pre-hire/page.tsx`):
   - 대시보드 레이아웃 바깥의 독립 라우트
   - 미래 assignment 조회 (`effectiveDate: { gt: now }`)
   - "발령일이 도래하지 않았습니다. [YYYY-MM-DD]에 다시 접근해 주세요."
   - 제한적 링크: 프로필 조회, 온보딩 체크리스트
   - 미래 assignment도 없으면 → "관리자에게 문의하세요" 에러 표시

3. **API 방어**:
   - 주요 API에서 `assignment === undefined` 시 적절한 에러 반환 (500 방지)
   - `apiError('발령일 이전에는 접근할 수 없습니다.', 403)` 패턴

---

## DO NOT TOUCH (Session 8 범위 외)

```
- src/components/layout/*       (Sidebar, MobileDrawer)
- src/config/navigation.ts      (Sidebar IA)
- messages/*.json                (i18n)
- prisma/seed.ts                 (오케스트레이터 — import 추가만 허용)
- prisma/schema.prisma           (스키마 변경 없음)
- src/middleware.ts              (Auth middleware)
- src/lib/api/companyFilter.ts   (resolveCompanyId — 보호)
- src/lib/prisma-rls.ts          (RLS wrapper — 보호)
- src/lib/api/withRLS.ts         (withRLS — 보호)
- B-3i (Manager Hub dotted line UI) → Session 9
- B-3l (겸직 Admin UI) → Session 9
```

---

## 실행 순서

```
B-3e (겸직 seed) → B-3f (Performance 연결) → B-3h (결재/연차 Primary)
→ B-3j (급여 isPrimary) → B-3k (Pre-hire) → B-3g (크로스-법인 READ)
```

B-3g를 마지막으로 배치: 가장 복잡하고, B-3e seed 데이터가 있어야 검증 가능
