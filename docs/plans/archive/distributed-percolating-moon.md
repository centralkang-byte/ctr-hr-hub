# STEP 9-2: 국가별 컴플라이언스 (Country-specific Compliance)

## Context

글로벌 6개 법인(KR/CN/RU/US/VN/MX) 운영에 필요한 국가별 법정보고서, GDPR 개인정보보호, 한국 노동법 강화 기능을 구현합니다. 기존 인프라(Labor modules, AuditLog, Training, Attendance)를 최대한 활용합니다.

### 기존 자산 활용
- `src/lib/labor/` — 국가별 노동법 모듈 (kr, cn, ru, us, vn, mx, eu)
- `src/lib/audit.ts` — logAudit(), logAuditSync(), extractRequestMeta()
- `TrainingCourse.category = COMPLIANCE` — 법정교육 카테고리 이미 존재
- `krLaborModule.validateWorkHours()` — 52시간 검증 이미 구현
- Sidebar `countryFilter` 패턴으로 법인별 메뉴 필터링

---

## Phase 1: 스키마 + 기반 설정 (~11파일)

### 1-1. Prisma Enums 추가 (schema.prisma)

| Enum | 용도 |
|------|------|
| KedoDocumentType | 러시아 전자문서 유형 (7종) |
| KedoSignatureLevel | 전자서명 수준 (PEP/UNEP/UKEP) |
| KedoDocumentStatus | KEDO 상태 (DRAFT→SIGNED/REJECTED/EXPIRED) |
| MilitaryCategory | 군복무 구분 (OFFICER/SOLDIER/RESERVIST/EXEMPT) |
| MilitaryFitness | 군적합도 (FIT_A~D/UNFIT) |
| GdprConsentPurpose | 동의 목적 (8종) |
| GdprConsentStatus | 동의 상태 (ACTIVE/REVOKED/EXPIRED) |
| GdprRequestType | 정보주체 요청 유형 (ACCESS/RECTIFICATION/ERASURE/PORTABILITY/RESTRICTION/OBJECTION) |
| GdprRequestStatus | 요청 상태 (PENDING→COMPLETED/REJECTED/EXPIRED) |
| DataRetentionCategory | 데이터 보관 카테고리 (9종) |
| DpiaStatus | DPIA 상태 (DRAFT/IN_REVIEW/APPROVED/REJECTED) |
| SocialInsuranceType | 중국 사회보험 유형 (6종: 5험1금) |
| MandatoryTrainingType | 한국 법정교육 유형 (5종) |
| SeveranceInterimReason | 퇴직금 중간정산 사유 (6종) |
| SeveranceInterimStatus | 중간정산 상태 (PENDING→APPROVED/REJECTED/PAID) |

### 1-2. Prisma Models 추가 (11개)

| Model | 용도 | 관련 법인 |
|-------|------|-----------|
| MilitaryRegistration | 러시아 군복무 기록 | CTR-RU |
| KedoDocument | 전자문서 관리 (КЭДО) | CTR-RU |
| SocialInsuranceConfig | 사회보험 요율 설정 | CTR-CN |
| SocialInsuranceRecord | 월별 사회보험 기록 | CTR-CN |
| GdprConsent | 데이터 처리 동의 | ALL |
| GdprRequest | 정보주체 권리 요청 | ALL |
| DataRetentionPolicy | 데이터 보존 정책 | ALL |
| DpiaRecord | 개인정보 영향평가 | ALL |
| PiiAccessLog | 개인정보 접근 로그 | ALL |
| MandatoryTraining | 법정의무교육 관리 | CTR-KR |
| SeveranceInterimPayment | 퇴직금 중간정산 | CTR-KR |

### 1-3. 기존 모델 수정

- **Employee**: 11개 compliance 관계 필드 추가
- **Company**: 11개 compliance 관계 필드 추가
- **TrainingCourse**: `mandatoryTrainings` 관계 추가

### 1-4. 기반 파일 수정/생성

| # | File | Action |
|---|------|--------|
| 1 | `prisma/schema.prisma` | 15 enums + 11 models + 관계 필드 추가 |
| 2 | `src/lib/constants.ts` | MODULE에 `COMPLIANCE` 추가, ALL_MODULES에 추가 |
| 3 | `src/components/layout/Sidebar.tsx` | 컴플라이언스 nav group 추가, `countryFilter` 로직 |
| 4 | `src/lib/schemas/compliance.ts` | **신규** — 모든 Zod 검증 스키마 |
| 5 | `src/types/index.ts` | 새 모델 타입 re-export 추가 |
| 6-10 | `messages/{ko,en,zh,ru,vi,es,pt}.json` | `compliance` + `menu` 네임스페이스 키 추가 |
| 11 | `context.md` | STEP 9-2 기록 |

**Sidebar 구조:**
```
📋 컴플라이언스 (ShieldCheck) — MODULE.COMPLIANCE
  ├─ GDPR / 개인정보 (/compliance/gdpr) — ALL
  ├─ 데이터 보관 (/compliance/data-retention) — ALL
  ├─ 개인정보 접근 로그 (/compliance/pii-audit) — ALL
  ├─ 영향평가 DPIA (/compliance/dpia) — ALL
  ├─ 러시아 컴플라이언스 (/compliance/ru) — countryFilter: ['RU']
  ├─ 중국 컴플라이언스 (/compliance/cn) — countryFilter: ['CN']
  └─ 한국 컴플라이언스 (/compliance/kr) — countryFilter: ['KR']
```

NavItem에 `countryFilter?: string[]` 필드 추가. 렌더링 시 user의 Company.countryCode로 필터링.

---

## Phase 2: 러시아 컴플라이언스 (CTR-RU) — ~19파일

### 2-1. 라이브러리

| # | File | Description |
|---|------|-------------|
| 12 | `src/lib/compliance/ru.ts` | **신규** — T-2/P-4/57-T 보고서 생성 + KEDO 서명 해시 유틸 |

**핵심 함수:**
- `generateT2Report(companyId)` — 군복무 기록 T-2 양식 Excel (exceljs)
- `generateP4Report(companyId, year, quarter)` — 분기별 인원/급여 통계
- `generate57TReport(companyId, year)` — 직종별 급여 조사
- `generateKedoSignatureHash(docId, signerId, timestamp)` — SHA-256 해시
- `validateKedoSignature(signatureLevel, documentType)` — 서명 수준 검증

### 2-2. API Routes (8파일)

| # | Route | Method | Description |
|---|-------|--------|-------------|
| 13 | `/api/v1/compliance/ru/military` | GET, POST | 군복무 기록 목록/생성 |
| 14 | `/api/v1/compliance/ru/military/[employeeId]` | GET, PUT | 개별 조회/수정 |
| 15 | `/api/v1/compliance/ru/military/export/t2` | GET | T-2 양식 Excel 내보내기 |
| 16 | `/api/v1/compliance/ru/kedo` | GET, POST | KEDO 문서 목록/생성 |
| 17 | `/api/v1/compliance/ru/kedo/[id]` | GET, PUT | 개별 조회/수정 |
| 18 | `/api/v1/compliance/ru/kedo/[id]/sign` | POST | 전자서명 |
| 19 | `/api/v1/compliance/ru/kedo/[id]/reject` | POST | 반려 |
| 20 | `/api/v1/compliance/ru/reports/p4` | GET | P-4 보고서 생성 |
| 21 | `/api/v1/compliance/ru/reports/57t` | GET | 57-T 보고서 생성 |

### 2-3. Dashboard Page (1 page + 6 components)

| # | File | Description |
|---|------|-------------|
| 22 | `src/app/(dashboard)/compliance/ru/page.tsx` | Server component 래퍼 |
| 23 | `src/app/(dashboard)/compliance/ru/RuComplianceClient.tsx` | 3-tab 클라이언트: 군복무/KEDO/보고서 |
| 24 | `src/components/compliance/ru/MilitaryRegistrationTab.tsx` | 군복무 기록 테이블 + T-2 내보내기 |
| 25 | `src/components/compliance/ru/MilitaryRegistrationForm.tsx` | 군복무 등록/수정 모달 |
| 26 | `src/components/compliance/ru/KedoDocumentsTab.tsx` | KEDO 문서 목록 + 상태 워크플로우 |
| 27 | `src/components/compliance/ru/KedoDocumentForm.tsx` | KEDO 문서 생성/편집 모달 |
| 28 | `src/components/compliance/ru/KedoSignDialog.tsx` | 전자서명 확인 다이얼로그 |
| 29 | `src/components/compliance/ru/RuReportsTab.tsx` | P-4/57-T 보고서 생성 UI |

---

## Phase 3: 중국 컴플라이언스 (CTR-CN) — ~11파일

### 3-1. 라이브러리

| # | File | Description |
|---|------|-------------|
| 30 | `src/lib/compliance/cn.ts` | **신규** — 사회보험 계산 + 보고서 생성 |

**핵심 함수:**
- `calculateSocialInsurance(salary, configs[])` — 5험1금 계산
- `generateSocialInsuranceReport(companyId, year, month)` — 월간 보험 보고서 Excel
- `generateEmployeeRegistry(companyId)` — 직원 명부(花名册) Excel

### 3-2. API Routes (6파일)

| # | Route | Method | Description |
|---|-------|--------|-------------|
| 31 | `/api/v1/compliance/cn/social-insurance/config` | GET, POST | 보험 요율 설정 CRUD |
| 32 | `/api/v1/compliance/cn/social-insurance/config/[id]` | PUT | 요율 수정 |
| 33 | `/api/v1/compliance/cn/social-insurance/records` | GET | 월별 보험 기록 조회 |
| 34 | `/api/v1/compliance/cn/social-insurance/calculate` | POST | 월간 보험 일괄 계산 |
| 35 | `/api/v1/compliance/cn/social-insurance/export` | GET | 보험 보고서 Excel 내보내기 |
| 36 | `/api/v1/compliance/cn/employee-registry/export` | GET | 직원 명부 Excel 내보내기 |

### 3-3. Dashboard Page (1 page + 4 components)

| # | File | Description |
|---|------|-------------|
| 37 | `src/app/(dashboard)/compliance/cn/page.tsx` | Server component 래퍼 |
| 38 | `src/app/(dashboard)/compliance/cn/CnComplianceClient.tsx` | 3-tab: 요율설정/월간보고/직원명부 |
| 39 | `src/components/compliance/cn/SocialInsuranceConfigTab.tsx` | 6종 보험 요율 테이블 |
| 40 | `src/components/compliance/cn/SocialInsuranceConfigForm.tsx` | 요율 설정 모달 |
| 41 | `src/components/compliance/cn/SocialInsuranceReportTab.tsx` | 월간 보험 보고서 + 계산 + 내보내기 |
| 42 | `src/components/compliance/cn/EmployeeRegistryTab.tsx` | 직원 명부 조회/내보내기 |

---

## Phase 4: GDPR / 개인정보 보호 (전 법인) — ~24파일

### 4-1. 라이브러리

| # | File | Description |
|---|------|-------------|
| 43 | `src/lib/compliance/gdpr.ts` | **신규** — PII 로거, 보존 정책 실행, 데이터 내보내기, 익명화 |
| 44 | `src/lib/compliance/pii-middleware.ts` | **신규** — withPiiTracking 래퍼 (API 핸들러 감싸기) |

**핵심 함수:**
- `logPiiAccess(actorId, targetId, companyId, accessType, field, headers)` — fire-and-forget PII 접근 기록
- `enforceRetention(companyId, policyId)` — 보존기간 초과 데이터 익명화/삭제
- `generateDataExport(employeeId)` — 정보이동권용 전체 데이터 JSON 내보내기
- `anonymizeEmployeeData(employeeId)` — PII 필드 null 처리
- `calculateGdprDeadline(requestDate)` — 30일 GDPR 처리 기한 계산

### 4-2. API Routes (11파일)

| # | Route | Method | Description |
|---|-------|--------|-------------|
| 45 | `/api/v1/compliance/gdpr/consents` | GET, POST | 동의 목록/수집 |
| 46 | `/api/v1/compliance/gdpr/consents/[id]/revoke` | POST | 동의 철회 |
| 47 | `/api/v1/compliance/gdpr/requests` | GET, POST | 정보주체 요청 목록/제출 |
| 48 | `/api/v1/compliance/gdpr/requests/[id]` | GET, PUT | 요청 상세/상태 변경 |
| 49 | `/api/v1/compliance/gdpr/retention` | GET, POST | 보존 정책 목록/생성 |
| 50 | `/api/v1/compliance/gdpr/retention/[id]` | PUT | 보존 정책 수정 |
| 51 | `/api/v1/compliance/gdpr/retention/run` | POST | 보존 정책 수동 실행 |
| 52 | `/api/v1/compliance/gdpr/dpia` | GET, POST | DPIA 목록/생성 |
| 53 | `/api/v1/compliance/gdpr/dpia/[id]` | GET, PUT | DPIA 상세/수정 |
| 54 | `/api/v1/compliance/gdpr/pii-access` | GET | PII 접근 로그 조회 |
| 55 | `/api/v1/compliance/gdpr/pii-access/dashboard` | GET | PII 접근 통계 대시보드 |

### 4-3. Dashboard Pages (4 pages + 8 components)

| # | File | Description |
|---|------|-------------|
| 56 | `src/app/(dashboard)/compliance/gdpr/page.tsx` | GDPR 메인 페이지 |
| 57 | `src/app/(dashboard)/compliance/gdpr/GdprClient.tsx` | 4-tab: 동의/요청/보존/DPIA |
| 58 | `src/app/(dashboard)/compliance/pii-audit/page.tsx` | PII 접근 로그 페이지 |
| 59 | `src/app/(dashboard)/compliance/pii-audit/PiiAuditClient.tsx` | 접근 로그 대시보드 + 테이블 |
| 60 | `src/app/(dashboard)/compliance/data-retention/page.tsx` | 데이터 보존 페이지 |
| 61 | `src/app/(dashboard)/compliance/data-retention/DataRetentionClient.tsx` | 보존 정책 관리 |
| 62 | `src/app/(dashboard)/compliance/dpia/page.tsx` | DPIA 페이지 |
| 63 | `src/app/(dashboard)/compliance/dpia/DpiaClient.tsx` | DPIA 관리 |
| 64 | `src/components/compliance/gdpr/ConsentManagementTab.tsx` | 동의 관리 탭 |
| 65 | `src/components/compliance/gdpr/ConsentForm.tsx` | 동의 수집 폼 |
| 66 | `src/components/compliance/gdpr/DataRequestsTab.tsx` | 정보주체 요청 탭 |
| 67 | `src/components/compliance/gdpr/DataRequestForm.tsx` | 요청 제출/처리 폼 |
| 68 | `src/components/compliance/gdpr/RetentionPolicyForm.tsx` | 보존 정책 폼 |
| 69 | `src/components/compliance/gdpr/DpiaForm.tsx` | DPIA 생성/수정 폼 |
| 70 | `src/components/compliance/gdpr/PiiAccessDashboard.tsx` | PII 접근 통계 차트 |
| 71 | `src/components/compliance/gdpr/PiiAccessLogTable.tsx` | PII 접근 로그 테이블 |

### 4-4. Cron Job

| # | File | Description |
|---|------|-------------|
| 72 | `src/app/api/v1/compliance/cron/retention/route.ts` | 데이터 보존 자동 실행 cron |

---

## Phase 5: 한국 노동법 강화 (CTR-KR) — ~16파일

### 5-1. 라이브러리

| # | File | Description |
|---|------|-------------|
| 73 | `src/lib/compliance/kr.ts` | **신규** — 52시간 집계, 법정교육 현황, 퇴직금 계산 |

**핵심 함수:**
- `getWeeklyWorkHoursSummary(companyId, weekStart)` — Attendance 기반 주간 근무시간 집계
- `classifyWorkHoursStatus(hours)` — COMPLIANT/WARNING/VIOLATION (기존 krLaborModule 활용)
- `getMandatoryTrainingStatus(companyId, year)` — TrainingEnrollment JOIN → 이수율 산출
- `calculateSeveranceInterim(employeeId)` — 근속/평균임금 기반 퇴직금 산정
- `validateSeveranceEligibility(employeeId, reason)` — 중간정산 법적 요건 검증

### 5-2. API Routes (9파일)

| # | Route | Method | Description |
|---|-------|--------|-------------|
| 74 | `/api/v1/compliance/kr/work-hours` | GET | 52시간 대시보드 데이터 |
| 75 | `/api/v1/compliance/kr/work-hours/employees` | GET | 직원별 주간 근무시간 목록 |
| 76 | `/api/v1/compliance/kr/work-hours/alerts` | GET | 52시간 초과 위험 직원 |
| 77 | `/api/v1/compliance/kr/mandatory-training` | GET, POST | 법정교육 설정 CRUD |
| 78 | `/api/v1/compliance/kr/mandatory-training/[id]` | PUT | 법정교육 수정 |
| 79 | `/api/v1/compliance/kr/mandatory-training/status` | GET | 법정교육 이수 현황 |
| 80 | `/api/v1/compliance/kr/severance-interim` | GET, POST | 중간정산 목록/신청 |
| 81 | `/api/v1/compliance/kr/severance-interim/[id]` | GET, PUT | 상세/심사 |
| 82 | `/api/v1/compliance/kr/severance-interim/calculate` | GET | 퇴직금 사전 계산 |

### 5-3. Dashboard Page (1 page + 7 components)

| # | File | Description |
|---|------|-------------|
| 83 | `src/app/(dashboard)/compliance/kr/page.tsx` | Server component 래퍼 |
| 84 | `src/app/(dashboard)/compliance/kr/KrComplianceClient.tsx` | 3-tab: 52시간/법정교육/중간정산 |
| 85 | `src/components/compliance/kr/WorkHoursMonitorTab.tsx` | 52시간 모니터링 KPI + 직원 목록 |
| 86 | `src/components/compliance/kr/WorkHoursChart.tsx` | 주간 근무시간 분포 차트 |
| 87 | `src/components/compliance/kr/WorkHoursEmployeeList.tsx` | 직원별 상태 뱃지 테이블 |
| 88 | `src/components/compliance/kr/MandatoryTrainingTab.tsx` | 법정교육 이수율 + 기한 |
| 89 | `src/components/compliance/kr/MandatoryTrainingForm.tsx` | 법정교육 설정 폼 |
| 90 | `src/components/compliance/kr/SeveranceInterimTab.tsx` | 중간정산 요청 목록 + 심사 |
| 91 | `src/components/compliance/kr/SeveranceInterimForm.tsx` | 중간정산 신청/심사 폼 |

---

## Phase 6: 랜딩페이지 + 마무리 — ~4파일

| # | File | Description |
|---|------|-------------|
| 92 | `src/app/(dashboard)/compliance/page.tsx` | 컴플라이언스 메인 대시보드 |
| 93 | `src/app/(dashboard)/compliance/ComplianceClient.tsx` | GDPR 현황 카드 + 국가별 요약 |
| 94 | `context.md` | STEP 9-2 세션 기록 |

---

## 파일 요약

| Category | New | Modified | Total |
|----------|-----|----------|-------|
| Prisma Schema | 0 | 1 | 1 |
| Config/Constants | 1 | 2 | 3 |
| Lib (Compliance) | 5 | 0 | 5 |
| Zod Schemas | 1 | 0 | 1 |
| API Routes | ~35 | 0 | ~35 |
| Dashboard Pages | ~14 | 0 | ~14 |
| Components | ~30 | 0 | ~30 |
| Sidebar | 0 | 1 | 1 |
| Translation JSON | 0 | 7 | 7 |
| Types | 0 | 1 | 1 |
| Context | 0 | 1 | 1 |
| **합계** | **~86** | **~13** | **~99** |

## 실행 순서

```
1. Phase 1: schema.prisma 수정 → prisma generate → constants → types
2. Phase 1: Zod schemas, Sidebar, i18n 키 추가
3. Phase 2: Russian compliance (lib → API → pages)
4. Phase 3: Chinese compliance (lib → API → pages)
5. Phase 4: GDPR (lib → API → pages → cron)
6. Phase 5: Korean compliance (lib → API → pages)
7. Phase 6: Landing page + context.md
8. npx tsc --noEmit → 0 errors
```

## Verification

```
1. npx prisma generate → 성공
2. npx tsc --noEmit = 0 errors
3. 러시아 법인 로그인 → 컴플라이언스 메뉴에 러시아/GDPR 탭만 노출
4. 중국 법인 로그인 → 중국/GDPR 탭만 노출
5. 한국 법인 로그인 → 한국/GDPR 탭만 노출
6. 미국 법인 로그인 → GDPR 탭만 노출
7. GDPR 동의 수집 → 철회 → 이력 확인
8. 정보주체 요청 → 30일 기한 자동 설정 → 처리
9. P-4/57-T/T-2 보고서 Excel 다운로드 확인
10. 사회보험 요율 설정 → 월간 계산 → Excel 내보내기
11. 52시간 모니터링 대시보드 → 경고/위반 상태 확인
12. 법정의무교육 이수 현황 확인
13. 중간정산 신청 → 심사 워크플로우 확인
14. PII 접근 로그 대시보드 확인
15. ko/en 언어 전환 시 컴플라이언스 번역 확인
```

### NPM 의존성

- `exceljs` — Excel 보고서 생성 (T-2, P-4, 57-T, 사회보험, 직원명부)
