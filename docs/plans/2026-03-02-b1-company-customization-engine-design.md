# B1: 법인별 커스터마이징 엔진 — Design Document

**Date:** 2026-03-02
**Phase:** B1 (기능 구현 첫 세션)
**Scope:** 법인별 설정 엔진 + 평가/승진/보상 설정 UI

---

## 1. Problem Statement

Phase A에서 `CompanyProcessSetting`은 단일 flat 키-값 테이블로 구현되었다.
B Phase 전체(B2~B11)가 참조하는 법인별 커스터마이징 엔진이 부재한 상태이므로,
카테고리별 테이블 분리 + 글로벌 디폴트 패턴을 갖춘 설정 엔진을 구축한다.

---

## 2. Design Decisions

### 2.1 DB 접근법
- **결정:** Prisma 스키마 확장 (`prisma migrate dev`)
- **근거:** 프로젝트가 Prisma ORM을 사용하며 TypeScript 타입 자동 생성 필요
- **기존 `CompanyProcessSetting`:** 유지 (기존 settings 기능이 이 테이블을 참조하므로)

### 2.2 글로벌 디폴트 메커니즘
```
companyId = NULL → 글로벌 기본값
companyId = 'ctr-kr' → 법인 오버라이드
조회 시 법인 레코드 우선, 없으면 NULL 레코드 fallback
```

### 2.3 카테고리 라우트 개편
- `performance` → `evaluation` (라벨: "평가 설정", 영문: Evaluation)
- `organization` → `promotion` (라벨: "승진 설정", 영문: Promotion)
- `compensation` 유지 (라벨: "보상 설정")

---

## 3. Architecture

### 3.1 새 Prisma 모델 (9개)

**설정 테이블 6개** — 모두 `companyId String? @map("company_id")` 패턴:
- `EvaluationSetting` (`evaluation_settings`)
- `PromotionSetting` (`promotion_settings`)
- `CompensationSetting` (`compensation_settings`)
- `AttendanceSetting` (`attendance_settings`) — UI는 B6
- `LeaveSetting` (`leave_settings`) — UI는 B6
- `OnboardingSetting` (`onboarding_settings`) — UI는 B5

**공통 테이블 3개:**
- `ExchangeRate` (`exchange_rates`)
- `ApprovalFlow` (`approval_flows`) — module: 'benefits'|'recruitment'|'leave'|'promotion'|'general'
- `ApprovalFlowStep` (`approval_flow_steps`) — CASCADE 삭제

### 3.2 TypeScript 타입 (`src/types/settings.ts`)
모든 설정 테이블의 JSONB 구조를 인터페이스로 정의:
- `EvaluationSettings` — gradeScales, distribution, reviewProcess
- `PromotionSettings` — jobLevels, promotionRules, approvalChain
- `CompensationSettings` — payComponents, salaryBands, raiseMatrix, bonusRules

### 3.3 getCompanySettings 헬퍼 (`src/lib/settings/getCompanySettings.ts`)
Prisma 버전 fallback 헬퍼:
```typescript
// companyId가 있는 레코드 우선, 없으면 companyId=null fallback
async function getCompanySettings<T>(model: PrismaModel, companyId: string): Promise<T>
```

---

## 4. UI Components

| 컴포넌트 | 경로 | 재사용처 |
|---------|------|---------|
| `CompanySelector` | `components/settings/CompanySelector.tsx` | B5~B10 Admin 페이지 |
| `GlobalOverrideBadge` | `components/settings/GlobalOverrideBadge.tsx` | B5~B10 오버라이드 UI |
| `SettingsPageLayout` | `components/settings/SettingsPageLayout.tsx` | 모든 설정 페이지 |
| `ApprovalFlowEditor` | `components/settings/ApprovalFlowEditor.tsx` | B4, B6, B9 |
| `ApprovalFlowSelect` | `components/settings/ApprovalFlowSelect.tsx` | B4, B6, B9 |

### GlobalOverrideBadge 동작
- 법인 오버라이드 없음: "글로벌 기본값 사용 중" (회색) + "커스터마이징 시작" 버튼
- 법인 오버라이드 있음: "커스텀" (파란색) + "글로벌로 복귀" 버튼
- "커스터마이징 시작" → 글로벌 값 복사하여 법인 오버라이드 생성

---

## 5. Settings UI Pages (실제 폼)

### `/settings/evaluation`
- 평가방법론: MBO만 / MBO+BEI 선택
- 등급편집기: 업적/역량/종합 각각 (라벨, 코드, 순서 편집)
- 강제배분: soft/hard, 등급별 min%/max%
- 리뷰 프로세스 순서 체크박스

### `/settings/promotion`
- 직급체계 편집기: job_levels 배열 시각적 편집
- 승진규칙 매트릭스: from_level × to_level, 최소체류월수+필요등급
- 결재선 단계 편집

### `/settings/compensation`
- 급여항목 리스트: 코드/라벨/유형/과세여부
- 연봉밴드 테이블: job_level × min/mid/max
- 인상률 매트릭스: 평가등급 × 밴드위치
- 성과급 규칙 설정

---

## 6. API Routes

- `GET /api/v1/settings/[category]?companyId=` — fallback 조회
- `PUT /api/v1/settings/[category]` — 업데이트 (HR Admin)
- `POST /api/v1/settings/[category]/override` — 법인 오버라이드 생성
- `DELETE /api/v1/settings/[category]/override?companyId=` — 오버라이드 삭제
- `GET /api/v1/settings/approval-flows?module=&companyId=`
- `POST/PUT/DELETE /api/v1/settings/approval-flows`

---

## 7. Seed Data

**evaluation_settings:**
- NULL(글로벌): MBO+BEI, 4등급(O/E/M/S), soft 강제배분
- CTR-KR: 종합등급 활성, 업적60%+역량40%
- CTR-US: MBO만, 5등급, 자유배분

**promotion_settings:**
- NULL(글로벌): S1→S4 4단계, 최소36개월
- CTR-KR: 사원→부장 5단계
- CTR-US: IC/Manager 트랙 분리

**compensation_settings:**
- NULL(글로벌): 기본급+직책수당
- CTR-KR: +식대+차량유지비(비과세), KRW
- CTR-US: Base+Bonus, USD
- CTR-CN: +주택보조+교통보조, CNY

**approval_flows (모듈별):**
- 1단계: 건강검진, 출산축하금
- 2단계: 경조사, 학자금, 채용/일반, 휴가/일반
- 3단계: 숙소지원
- 4단계: 채용/임원, 승진/일반

---

## 8. Files to Create/Modify

### New (18+ files)
```
prisma/schema.prisma                    ← 9개 모델 추가
prisma/migrations/...b1_settings_engine/
src/types/settings.ts                   ← 설정 타입 정의
src/lib/settings/getCompanySettings.ts  ← Prisma fallback 헬퍼
src/components/settings/CompanySelector.tsx
src/components/settings/GlobalOverrideBadge.tsx
src/components/settings/SettingsPageLayout.tsx
src/components/settings/ApprovalFlowEditor.tsx
src/components/settings/ApprovalFlowSelect.tsx
src/app/(dashboard)/settings/[category]/evaluation/page.tsx  ← 또는 카테고리 내 콘텐츠
src/app/(dashboard)/settings/[category]/promotion/page.tsx
src/app/(dashboard)/settings/[category]/compensation/page.tsx
src/app/api/v1/settings/[category]/route.ts
src/app/api/v1/settings/[category]/override/route.ts
src/app/api/v1/settings/approval-flows/route.ts
src/app/api/v1/settings/approval-flows/[id]/route.ts
```

### Modified
```
src/lib/settings/categories.ts          ← performance→evaluation, organization→promotion
prisma/seed.ts                          ← 설정 시드 데이터 추가
```
