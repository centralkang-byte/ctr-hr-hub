# B1: 법인별 커스터마이징 엔진 + 평가 설정 확장

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A(A1 사이드바 IA + A2 Core HR 데이터 모델) 완료 상태. Phase B 첫 세션입니다.

### DB 접근 규칙 (전 세션 공통)

- **모든 테이블 생성/변경은 `prisma/schema.prisma` 모델 추가 → `prisma migrate dev`로 수행**
- Raw SQL 마이그레이션 금지 — Prisma 스키마와 실제 DB가 어긋남
- 기존 `CompanyProcessSetting` 모델은 유지한 채 새 모델을 **병행 추가** (데이터 이관 후 제거)
- 쿼리는 Prisma Client 사용 (`prisma.evaluationSettings.findFirst(...)`)
- Supabase는 Auth + Storage + Realtime 용도만, 테이블 조작은 Prisma 경유

---

## 세션 목표

6개 법인(CTR-KR, CTR-CN, CTR-RU, CTR-US, CTR-VN, CTR-MX)의 HR 프로세스 차이를 **코드가 아닌 설정**으로 관리할 수 있는 엔진을 구축합니다. 이 세션의 산출물은 Phase B 전체(B2~B11)가 참조하는 **가장 중요한 기반**입니다.

---

## ⚠️ 시작 전 필수 확인 (Phase A 검증)

세션 시작 시 아래를 반드시 확인하고, 문제가 있으면 먼저 수정하세요.

```bash
# 1. context.md 읽기
cat CONTEXT.md

# 2. company_process_settings 현재 상태 확인
# A2에서 단일 테이블이면 → 이번 세션에서 6개로 분리
# 이미 분리되어 있으면 → JSONB 구조만 B1 확정안으로 업데이트

# 3. companies 테이블에 6개 법인 시드 존재 확인
# CTR-KR, CTR-CN, CTR-RU, CTR-US, CTR-VN, CTR-MX

# 4. exchange_rates 테이블 존재 여부 확인
# 없으면 이번 세션에서 생성

# 5. 기존 settings 관련 페이지 경로 확인
# /settings/evaluation 등이 A1에서 어느 섹션에 배치되었는지
```

---

## 핵심 설계 원칙

### 1. 글로벌 디폴트 메커니즘: `company_id = NULL`

```sql
-- 조회 패턴 (모든 설정 테이블 공통)
SELECT * FROM evaluation_settings
WHERE company_id = :target OR company_id IS NULL
ORDER BY company_id NULLS LAST
LIMIT 1;

-- company_id IS NULL → 글로벌 기본값
-- company_id = 'ctr-kr' → 법인 오버라이드
-- 해당 법인 레코드 있으면 사용, 없으면 NULL 레코드 fallback
```

### 2. 하이브리드 저장 구조

카테고리별 테이블 분리 + 세부 옵션 JSONB:
- 스키마가 곧 문서 → 3개월 후에도 구조 파악 가능
- 법인 특수 항목(한국만 있는 수당 등)은 JSONB로 유연하게

### 3. 재사용 가능한 컴포넌트 설계

이 세션에서 만드는 UI 패턴은 B2~B11에서 반복 재사용됩니다:
- **법인 선택 드롭다운** → 모든 Admin 설정 페이지 공통
- **글로벌↔오버라이드 전환 컴포넌트** → B5, B6, B9, B10에서 재사용
- **공통 승인 플로우 UI** → B4, B6, B9에서 재사용

---

## 작업 순서 (10 Tasks)

### Task 0: 설정 라우트 개편 (기존 카테고리 rename + 재배치)

현재 `categories.ts`에 `performance`, `compensation`, `organization` 3개 카테고리가 있고, B1 스펙은 `/settings/evaluation`, `/settings/promotion`, `/settings/compensation` 3개 독립 경로를 요구합니다.

**전략: 기존 카테고리 rename + 탭 재배치**

```
[기존]                              [변경 후]
performance (eval-cycle, grade-system)  → evaluation (eval-cycle, grade-system, methodology, forced-distribution)
organization (...)                      → promotion (job-levels, promotion-rules, approval-chain)
compensation (salary-band, ...)         → compensation (pay-components, salary-band, raise-matrix, bonus-rules)
```

**작업 내용**:
1. `categories.ts`에서 `performance` → `evaluation`으로 rename
2. `categories.ts`에서 `organization` → `promotion`으로 rename  
3. `compensation`은 유지, 기존 탭 아이템에 새 탭(pay-components, raise-matrix, bonus-rules) 추가
4. 기존 탭 아이템(eval-cycle, grade-system 등)은 보존하되 새 카테고리 아래로 재배치
5. 라우트 변경: `/settings/performance?tab=...` → `/settings/evaluation?tab=...` 등
6. 사이드바 메뉴 / 내부 링크에서 이전 경로 참조하는 곳 일괄 업데이트

**주의**: 기존 탭 UI 코드는 최대한 재사용. rename과 재배치만 수행하고, 새로운 B1 기능(법인 선택, 오버라이드 등)은 Task 5~8에서 추가.

### Task 1: A2 산출물 확인 + 마이그레이션 결정

```
1. company_process_settings 현재 구조 점검
   - 단일 테이블이면 → 카테고리별 6개 테이블로 마이그레이션
   - 이미 분리되어 있으면 → JSONB 구조만 B1 확정안으로 업데이트
2. exchange_rates 테이블 유무 확인 → 없으면 생성
3. company_id = NULL 글로벌 디폴트 패턴 적용 여부 확인
```

### Task 2: DB 마이그레이션 — Prisma 모델 9개 추가

`prisma/schema.prisma`에 아래 모델을 추가한 후 `npx prisma migrate dev --name b1_settings_engine`으로 마이그레이션.

**설정 테이블 6개** (모두 동일 패턴: `companyId` nullable FK):

| 모델 | B1 UI | 비고 |
|------|-------|------|
| `EvaluationSetting` | ✅ | 평가 방법론, 등급체계, 강제배분 |
| `PromotionSetting` | ✅ | 직급체계, 승진요건, 결재선 |
| `CompensationSetting` | ✅ | 급여항목, 연봉밴드, 인상률, 성과급 |
| `AttendanceSetting` | ❌→B6 | 근무시간, 교대제 (모델만 생성, UI는 B6) |
| `LeaveSetting` | ❌→B6 | 휴가유형, 부여규칙 (모델만 생성, UI는 B6) |
| `OnboardingSetting` | ❌→B5 | 체크리스트 템플릿 (모델만 생성, UI는 B5) |

**공통 테이블 3개**:

| 모델 | 설명 |
|------|------|
| `ExchangeRate` | 통화 환율 (B7-2에서도 사용) |
| `ApprovalFlow` | 공통 승인 플로우 템플릿 — B4(채용), B6(휴가), B9(복리후생) 전 모듈 참조 |
| `ApprovalFlowStep` | 플로우 단계별 승인자 역할/사용자, 자동승인 일수 |

**Prisma 모델 예시 — `ApprovalFlow` + `ApprovalFlowStep`**:
```prisma
model ApprovalFlow {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(200)
  description String?  @db.Text
  companyId   String?  @db.Uuid
  company     Company? @relation(fields: [companyId], references: [id])
  module      String   @db.VarChar(50)  // 'benefits' | 'recruitment' | 'leave' | 'promotion' | 'general'
  isActive    Boolean  @default(true)
  steps       ApprovalFlowStep[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("approval_flows")
}

model ApprovalFlowStep {
  id             String       @id @default(uuid()) @db.Uuid
  flowId         String       @db.Uuid
  flow           ApprovalFlow @relation(fields: [flowId], references: [id], onDelete: Cascade)
  stepOrder      Int
  approverType   String       @db.VarChar(20)  // 'role' | 'specific_user'
  approverRole   String?      @db.VarChar(50)  // 'direct_manager' | 'hr_admin' | 'dept_head' | 'finance' | 'ceo'
  approverUserId String?      @db.Uuid
  isRequired     Boolean      @default(true)
  autoApproveDays Int?        // N일 후 자동 승인 (null = 없음)
  createdAt      DateTime     @default(now())

  @@map("approval_flow_steps")
}
```

나머지 6개 설정 모델도 동일 패턴으로:
- `companyId String? @db.Uuid` + `company Company? @relation(...)` — nullable FK
- 세부 설정은 `Json` 타입 필드 (JSONB)
- `@@map("snake_case_table_name")`으로 DB 테이블명 지정

**RLS 정책**: Supabase Dashboard에서 별도 설정 — 설정 테이블은 전체 조회 허용, HR Admin만 수정.

### Task 3: 시드 데이터

글로벌 디폴트(company_id = NULL) + 6개 법인 오버라이드 샘플:

**evaluation_settings 시드**:
- 글로벌(NULL): MBO+BEI, 4등급(O/E/M/S), soft 강제배분
- CTR-KR 오버라이드: 종합등급 활성, 업적60%+역량40%
- CTR-US 오버라이드: MBO만, 5등급, 자유배분(강제배분 비활성)
- 나머지 4개 법인: 글로벌 디폴트 사용 (오버라이드 없음)

**promotion_settings 시드**:
- 글로벌: S1→S2→S3→S4 4단계, 최소 36개월 체류
- CTR-KR: 사원→대리→과장→차장→부장 5단계 확장
- CTR-US: Individual Contributor / Manager 트랙 분리

**compensation_settings 시드**:
- 글로벌: 기본급+직책수당 기본 구조
- CTR-KR: 기본급+직책수당+식대(비과세)+차량유지비(비과세), KRW
- CTR-US: Base Salary + Bonus, USD
- CTR-CN: 기본급+주택보조+교통보조, CNY

**approval_flows 시드** (모듈별 3개씩):
- 1단계(HR확인): benefits/건강검진, benefits/출산축하금
- 2단계(팀장→HR): benefits/경조사, benefits/학자금, recruitment/일반, leave/일반
- 3단계(팀장→경영관리→HR): benefits/숙소지원
- 4단계(팀장→부서장→HR→대표): recruitment/임원, promotion/일반

### Task 4: 설정 조회 API (Prisma Client + fallback 로직)

```typescript
// lib/settings/getSettings.ts — 모든 설정 모델 공통 헬퍼

import { prisma } from '@/lib/prisma';

type SettingsModel = 'evaluationSetting' | 'promotionSetting' | 'compensationSetting' 
  | 'attendanceSetting' | 'leaveSetting' | 'onboardingSetting';

export async function getCompanySettings<T>(
  model: SettingsModel,
  companyId: string
): Promise<T> {
  // 법인 오버라이드 우선, 없으면 글로벌 디폴트(companyId=null) fallback
  const result = await (prisma[model] as any).findFirst({
    where: {
      OR: [
        { companyId: companyId },
        { companyId: null }
      ]
    },
    orderBy: {
      companyId: { sort: 'asc', nulls: 'last' }  // non-null(법인) 우선
    }
  });
  
  return result as T;
}

// 사용 예시
const evalSettings = await getCompanySettings<EvaluationSetting>(
  'evaluationSetting',
  currentCompanyId
);
```

**API Routes**:
- `GET /api/v1/settings/[category]?companyId=` — 설정 조회 (fallback 포함)
- `PUT /api/v1/settings/[category]` — 설정 CRUD (HR Admin)
- `POST /api/v1/settings/[category]/override` — 법인 오버라이드 생성
- `DELETE /api/v1/settings/[category]/override?companyId=` — 오버라이드 삭제 (글로벌로 복귀)
- `GET /api/v1/settings/approval-flows?module=&companyId=` — 승인 플로우 조회
- `POST/PUT/DELETE /api/v1/settings/approval-flows` — 승인 플로우 CRUD

### Task 5: 공통 컴포넌트 — 법인 선택 + 글로벌↔오버라이드 전환

```
components/settings/
├── CompanySelector.tsx         — 법인 선택 드롭다운 (전체 Admin 설정 공통)
├── GlobalOverrideBadge.tsx     — "글로벌 기본값 사용 중" ↔ "커스텀" 뱃지 전환
├── SettingsPageLayout.tsx      — 설정 페이지 공통 레이아웃 (법인 셀렉터 + 탭 + 콘텐츠)
├── ApprovalFlowEditor.tsx      — 승인 플로우 설계 UI (플로우 CRUD + 단계 편집)
└── ApprovalFlowSelect.tsx      — 다른 모듈에서 플로우 선택할 때 쓰는 드롭다운
```

**GlobalOverrideBadge 동작**:
- 법인 선택 시 해당 법인 오버라이드 레코드 체크
- 존재하면: "커스텀" 뱃지 (파란색) + 편집 가능
- 미존재면: "글로벌 기본값 사용 중" 뱃지 (회색) + "커스터마이징 시작" 버튼
- "커스터마이징 시작" 클릭 → 글로벌 값 복사하여 법인 오버라이드 생성
- "글로벌로 복귀" 클릭 → 오버라이드 삭제 확인 모달

### Task 6: 평가 설정 UI

**라우트**: `/settings/evaluation` (설정 섹션)

**2축 평가 구조**:
- 업적(MBO): 등급 라벨/코드/개수 법인별 자유 정의
- 역량(BEI): 등급 라벨/코드/개수 법인별 자유 정의
- 종합등급: 유무 선택, 계산방식(matrix/weighted/manual), 비중

**UI 구성**:
- 평가 방법론 선택 (MBO만 / MBO+BEI 병행)
- 등급 편집기 (업적/역량/종합 각각): 드래그로 순서 변경, 라벨/코드 인라인 편집
- 강제배분 설정: soft/hard 선택, 등급별 min%/max% 슬라이더
- 리뷰 프로세스 순서: 자기평가→상사평가→동료평가→캘리브레이션 체크박스 순서

### Task 7: 승진 설정 UI

**라우트**: `/settings/promotion` (설정 섹션)

**UI 구성**:
- 직급체계 편집기: `job_levels` JSON 배열 시각적 편집 (추가/삭제/순서변경)
- 승진규칙 매트릭스: from_level × to_level 매트릭스, 각 셀에 최소체류월수 + 필요등급
- 결재선 편집: 단계 추가/삭제, 각 단계 역할 선택 드롭다운
- 승진 주기 설정: 연1회/반기/분기 선택 + 실행 월 선택

### Task 8: 보상 설정 UI

**라우트**: `/settings/compensation` (설정 섹션)

**UI 구성**:
- 급여항목 편집기: pay_components 리스트 (코드/라벨/유형/과세여부/필수여부)
- 연봉밴드 테이블: job_level × min/mid/max 편집 가능 테이블
- 인상률 매트릭스: 평가등급 × 밴드 내 위치(lower/mid/upper) → 인상률 %
- 성과급 규칙: 유형(등급기반/이익분배/혼합) 선택 + 등급별 월수 설정
- 통화 표시: 법인 선택 시 해당 통화(KRW/USD/CNY/RUB/VND/MXN) 자동 적용

### Task 9: 승인 플로우 설계 탭

`approval_flows` + `approval_flow_steps` Admin UI. 법인별 모듈별 승인 플로우를 설계하는 탭을 설정 페이지에 추가합니다. B4(채용), B6(휴가), B9(복리후생)에서 이 플로우를 참조합니다.

### Task 10: 검증

```bash
# 1. 법인 전환 시 설정 정상 로드 확인
#    - CTR-KR 선택 → 커스텀 값 표시
#    - CTR-VN 선택 → 글로벌 디폴트 표시 + "글로벌 기본값 사용 중" 뱃지
#    - CTR-VN에서 "커스터마이징 시작" → 오버라이드 생성 → "커스텀" 뱃지

# 2. 승인 플로우 CRUD 확인
#    - 플로우 생성 → 단계 추가 → 모듈 매핑 → 조회

# 3. 빌드 확인
npx tsc --noEmit
npm run build

# 4. context.md 업데이트
```

---

## 산출물 체크리스트

- [ ] DB 테이블 9개 생성 (설정6 + 환율1 + 승인2)
- [ ] 글로벌 디폴트 + 6개 법인 시드 데이터
- [ ] 설정 조회 API (fallback 로직 포함)
- [ ] 공통 컴포넌트 5개 (CompanySelector, GlobalOverrideBadge, SettingsPageLayout, ApprovalFlowEditor, ApprovalFlowSelect)
- [ ] 평가 설정 Admin UI
- [ ] 승진 설정 Admin UI
- [ ] 보상 설정 Admin UI
- [ ] 승인 플로우 설계 Admin UI
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] context.md 업데이트

---

## context.md 업데이트 내용 (세션 종료 시)

```markdown
## B1 완료 (날짜)

### DB 테이블
- evaluation_settings, promotion_settings, compensation_settings
- attendance_settings, leave_settings, onboarding_settings
- exchange_rates
- approval_flows, approval_flow_steps

### 공통 컴포넌트 (다른 세션에서 재사용)
- CompanySelector → B5, B6, B8, B9, B10 Admin 페이지
- GlobalOverrideBadge → B5, B6, B9, B10 오버라이드 UI
- SettingsPageLayout → 모든 설정 페이지
- ApprovalFlowEditor → B4, B6, B9 승인 설정
- ApprovalFlowSelect → B4, B6, B9 승인 플로우 선택
- getCompanySettings() → 모든 세션에서 법인별 설정 조회

### API Routes
- GET/PUT /api/v1/settings/[category]
- POST/DELETE /api/v1/settings/[category]/override
- CRUD /api/v1/settings/approval-flows

### 알려진 이슈
- (여기에 발견된 이슈 기록)

### 다음 세션 주의사항
- B2: SettingsPageLayout 활용, 직원 프로필에서 compensation_settings 참조
- B3: evaluation_settings의 grade_scales 구조를 동적 평가 폼에서 사용
- B4: approval_flows(module='recruitment') 참조
- B5: onboarding_settings UI 구현
- B6: attendance_settings + leave_settings UI 구현
- B9: approval_flows(module='benefits') 참조
```

---

## 주의사항

1. **approval_flows는 이번 세션의 숨은 핵심** — B4, B6, B9가 모두 이 테이블을 참조합니다. 설계가 부실하면 3개 세션이 영향받으므로 충분히 고민하세요.

2. **JSONB 구조를 TypeScript 타입으로 반드시 정의** — `types/settings.ts`에 `EvaluationSettings`, `PromotionSettings`, `CompensationSettings` 등 인터페이스를 만들어야 B3, B7 등에서 타입 안전하게 사용 가능합니다.

3. **6개 테이블 모두 동일한 fallback 패턴** — `getCompanySettings()` 헬퍼 하나로 통일하세요. 테이블마다 다른 조회 로직을 만들면 나중에 유지보수 지옥입니다.

4. **시드 데이터는 현실적으로** — CTR-KR은 상세하게(실제 한국 기업 수준), 나머지 법인은 최소한으로. 완벽한 시드보다는 구조가 동작하는 것이 중요합니다.
