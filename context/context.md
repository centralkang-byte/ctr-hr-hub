# CTR HR Hub — 세션 컨텍스트

**최종 업데이트:** 2026-03-02 (B1 완료)
**프로젝트 경로:** `/Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub`

---

## 현재 상태

**전체 STEP 0~9 구현 완료 + 디자인 리팩토링(R1~R9) 완료.**
**리팩토링 마스터플랜 v2.0 Phase A (전체) + B1 (법인 커스터마이징 엔진) 완료.**
- A2-1: employee_assignments 테이블 생성 + 8 필드 마이그레이션 완료
- A2-1b: 설정 허브 UI 완료 (사이드바 37개 → 1개, 3×2 카드 허브, 카테고리 서브페이지)
- A2-2: Position/Job 모델 + 보고라인 + company_process_settings 완료
- A2-3: API 레이어 마이그레이션 완료 (418 → 0 TS errors)
- B1: 법인 커스터마이징 엔진 완료 (9개 Prisma 모델 + API + Admin UI + 승인플로우)
- `npx tsc --noEmit` = 0 errors ✅
- `npm run build` = 성공 ✅

---

## 리팩토링 마스터플랜 v2.0 진행 현황

> 총 16세션 / 약 15주. Notion 마스터플랜 참조.

| Phase | 세션 | 상태 |
|-------|------|------|
| **A: 아키텍처 기반** | A1 사이드바 IA 재설계 | ✅ 완료 |
| | A2-1 Core HR 데이터 모델 (employee_assignments) | ✅ 완료 |
| | A2-1b Settings Hub UI (설정 허브 3×2 카드 + 서브페이지) | ✅ 완료 |
| | A2-2 Position 기반 보고 라인 (포지션 체계) | ✅ 완료 |
| | A2-3 API 레이어 마이그레이션 (418 errors 수정) | ✅ 완료 |
| **B: 기능 구현** | B1 법인 커스터마이징 엔진 | ✅ 완료 |
| | B2~B11 | 📋 예정 |
| **C: UX 리팩토링** | C1~C3 | 📋 예정 |

### A1: 사이드바 IA 재설계 (완료)

**변경/생성된 파일:**
| 파일 | 상태 | 줄 수 |
|------|------|-------|
| `src/config/navigation.ts` | 신규 생성 | ~530줄 |
| `src/hooks/useNavigation.ts` | 신규 생성 | ~65줄 |
| `src/components/layout/Sidebar.tsx` | 전면 재구축 | ~310줄 (기존 493줄 → 310줄) |
| `messages/ko.json` | nav 섹션 추가 | +110줄 |
| `messages/en.json` | nav 섹션 추가 | +110줄 |

**구현 내용:**
- 기존 17개 flat NavGroup → 7개 역할 기반 섹션 (홈/나의 공간/팀 관리/인사 운영/인재 관리/인사이트/설정)
- 다크 테마 사이드바 (bg-[#111], 활성 bg-[#00C853])
- 아코디언 섹션 (펼침/접힘)
- 역할 기반 가시성: EMPLOYEE(홈+나의 공간), MANAGER+(+팀 관리+인사이트), HR_ADMIN+(전체)
- 국가 필터 유지 (compliance RU/CN/KR)
- comingSoon 항목 지원 (Lock 아이콘 + cursor-not-allowed)
- 접기/펼치기 모드 (w-64 ↔ w-16)

**빌드 검증:**
| 검증 항목 | 결과 |
|-----------|------|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | 성공 (.next 캐시 정리 후) |

**다음 세션(A2)에 전달 사항:**
- 라우팅 구조는 변경하지 않음 — 기존 경로 그대로 유지
- 나의 공간의 일부 항목(출퇴근, 휴가 등)은 기존 관리자 뷰와 동일 경로 사용 중 — A2에서 개인/관리자 뷰 분리 필요
- 팀 관리의 1:1 미팅과 나의 공간의 1:1/피드백이 동일 경로(`/performance/one-on-one`) 사용 — 뷰 분리 검토 필요

---

### A2-1: Core HR 데이터 모델 변경 — employee_assignments (완료)

**작업 일자:** 2026-03-02

**생성/변경된 파일:**
| 파일 | 상태 | 내용 |
|------|------|------|
| `prisma/schema.prisma` | 수정 | Employee 8필드 제거, EmployeeAssignment + EmployeeManagerBackup 모델 추가 |
| `prisma/migrations/20260302000000_employee_assignments/migration.sql` | 신규 생성 | 마이그레이션 SQL |
| `src/lib/assignments.ts` | 신규 생성 | Prisma 기반 Effective Dating 헬퍼 함수 |
| `src/types/assignment.ts` | 신규 생성 | TypeScript 타입 정의 |

**스키마 변경 내용:**
- `Employee` 모델에서 제거된 8개 필드:
  - `companyId`, `departmentId`, `jobGradeId`, `jobCategoryId`
  - `managerId`, `employmentType`, `contractType`, `status`
- Employee의 Company/Department/JobGrade/JobCategory 관계도 제거
- `EmployeeAssignment` 모델 신규 추가 (Effective Dating 지원)
- `EmployeeManagerBackup` 모델 신규 추가 (A2-2 보고 라인 구성용)

**마이그레이션 결과:**
| 검증 항목 | 결과 |
|-----------|------|
| employee_assignments 레코드 | 4건 (시드 직원 4명 전원 이관) |
| employee_manager_backup 레코드 | 0건 (시드 데이터에 manager_id 없음 — 정상) |
| current_employee_view | 정상 작동 확인 (company_id, status 등 조회 가능) |
| `prisma generate` | 성공 |
| `npx tsc --noEmit` | 418 errors (A2-3에서 일괄 수정 예정) |

**A2-2에 전달 사항:**
- `employee_manager_backup` 테이블에 manager_id 보존 (현재 0건 — 시드 데이터 한계)
- Position 기반 보고 라인 구현 시 `assignments.ts`의 `getManagerBackup()` 활용 가능
- A2-2 완료 후 `EmployeeManagerBackup` 테이블은 삭제 가능

---

### A2-2: Position 기반 보고 라인 (완료)

**작업 일자:** 2026-03-02

**생성/변경된 파일:**
| 파일 | 상태 | 내용 |
|------|------|------|
| `prisma/schema.prisma` | 수정 | Job, Position, CompanyProcessSetting 모델 추가 |
| `prisma/migrations/20260302010000_*` | 신규 | jobs, positions, company_process_settings 테이블 생성 |
| `prisma/migrations/20260302030000_*` | 신규 | current_employee_view 업데이트 (position/job/manager 조인) |
| `prisma/seed.ts` | 수정 | Jobs(15) + CTR-KR Positions(59) + Other Positions(81) + ProcessSettings(23) |
| `src/lib/assignments.ts` | 수정 | getManagerByPosition, getDirectReports, getDottedLineManager 추가 |
| `src/lib/process-settings.ts` | 신규 | getProcessSetting, getAllSettingsForType (Prisma 기반, 글로벌→법인 폴백) |
| `src/types/process-settings.ts` | 신규 | SettingType(8종 대문자), EvaluationSettings 등 타입 정의 |
| `src/types/position.ts` | 신규 | PositionWithRelations, PositionTreeNode |
| `src/lib/workflow.ts` | 수정 | reportsToPosition → reportsTo (Prisma 관계명 수정) |

**시드 데이터:**
| 항목 | 건수 | 비고 |
|------|------|------|
| Global Jobs | 15 | 글로벌 공통 직무 (companyId=NULL) |
| CTR-KR Positions | 59 | 9개 부서, 보고라인 설정 완료 |
| Other Co Positions | 81 | CTR-CN/RU/US/VN/MX (간소화) |
| Global Process Settings | 8 | EVALUATION/PROMOTION/ATTENDANCE/LEAVE/ONBOARDING/RECRUITMENT/BENEFITS/COMPENSATION |
| CTR-KR Overrides | 3 | ATTENDANCE(52h), LEAVE(한국법), ONBOARDING(4대보험) |
| CTR-CN Overrides | 2 | ATTENDANCE(44h), LEAVE(춘절) |
| CTR-US Overrides | 4 | EVALUATION(5등급), LEAVE(PTO), COMPENSATION(USD), ONBOARDING(I-9) |
| CTR-RU Overrides | 2 | LEAVE(28일), ONBOARDING(군복무) |
| CTR-VN Overrides | 2 | LEAVE(12일), ONBOARDING |
| CTR-MX Overrides | 2 | LEAVE, COMPENSATION(MXN) |

**current_employee_view 필드 추가:**
- `position_title`, `position_title_en`, `position_code`
- `job_title`, `job_title_en`, `job_code`
- `manager_employee_id` (Position 보고라인 기반)

**빌드 검증:**
| 검증 항목 | 결과 |
|-----------|------|
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run build` | 성공 ✅ |
| `npx prisma db seed` | 성공 (Process Settings: 23) ✅ |

**다음 세션 (B1) 전달 사항:**
- Position API 없음 — B1(법인엔진) 또는 B2(Core HR)에서 CRUD API 구현 필요
- company_process_settings 관리 UI 없음 — Settings Hub에 추가 예정
- EmployeeManagerBackup 테이블 아직 보존 중 (B2 완료 후 삭제 가능)
- SettingType 값은 대문자 (EVALUATION, ATTENDANCE 등)

---

### A2-1b: Settings Hub UI (완료)

**작업 일자:** 2026-03-02

**생성/변경된 파일:**
| 파일 | 상태 | 내용 |
|------|------|------|
| `src/lib/settings/categories.ts` | 신규 생성 | 6개 카테고리 × 37개 항목 데이터 |
| `src/config/navigation.ts` | 수정 | 설정 items 37개 → 단일 링크 (`/settings`) |
| `src/app/(dashboard)/settings/layout.tsx` | 신규 생성 | 설정 공통 레이아웃 래퍼 |
| `src/app/(dashboard)/settings/page.tsx` | 교체 | 3×2 카드 허브 (CompanySettingsClient → 새 허브) |
| `src/app/(dashboard)/settings/[category]/page.tsx` | 신규 생성 | 카테고리 서브페이지 (사이드탭 + 플레이스홀더) |
| `src/components/settings/SettingsCard.tsx` | 신규 생성 | 허브 카테고리 카드 (hover 좌측 녹색 액센트) |
| `src/components/settings/SettingsSearch.tsx` | 신규 생성 | 검색바 + 드롭다운 결과 (카테고리.href?tab=item.id 이동) |
| `src/components/settings/SettingsSideTabs.tsx` | 신규 생성 | 좌측 사이드탭 (모바일: Select) |
| `src/components/settings/SettingsPlaceholder.tsx` | 신규 생성 | 폼 미구현 플레이스홀더 (Phase B에서 구현 예정 표시) |

**보존된 파일 (삭제 안 함):**
- `src/app/(dashboard)/settings/CompanySettingsClient.tsx` — Phase B에서 system 카테고리에 재활용 예정
- 기존 37개 설정 서브라우트 디렉터리 전체 보존 (Next.js static routes가 [category] dynamic route보다 우선)

**주요 구현 내용:**
- 사이드바 settings 섹션: 37개 items → 단일 hub 링크
- 설정 허브: 6개 카테고리 카드 3×2 그리드 + 검색바 (37개 항목 필터링)
- 카테고리 서브페이지: 좌측 사이드탭 + 우측 플레이스홀더, ?tab= URL 상태 유지
- 잘못된 ?tab= 파라미터 → activeItem 기준으로 resolvedTabId 파생 (desync 버그 수정)
- 잘못된 카테고리 ID → /settings 리다이렉트
- 액센트 컬러: `#00C853` (CTR Green, CLAUDE.md 일관성)

**빌드 검증:**
| 검증 항목 | 결과 |
|-----------|------|
| 신규 파일 TypeScript 에러 | 0개 |
| 전체 에러 수 | 418개 (A2-1에서 이월, 변화 없음) |

**A2-3에 전달 사항 (빌드 에러 목록):**

총 418개 TypeScript 에러, 107개 파일 영향.

주요 에러 패턴 (발생 횟수):
| 에러 패턴 | 건수 | 원인 |
|-----------|------|------|
| `'companyId' does not exist in type EmployeeWhereInput` | 34 | WHERE 절 직접 참조 |
| `'department' does not exist in type EmployeeSelect` | 36 | include 직접 참조 |
| `Property 'companyId' does not exist on Employee` | 39 | 결과 객체 접근 |
| `'companyId' does not exist in type EmployeeSelect` | 24 | select 직접 참조 |
| `'managerId' does not exist in type EmployeeWhereInput` | 14 | WHERE 절 직접 참조 |
| `Property 'departmentId' does not exist on Employee` | 13 | 결과 객체 접근 |
| `Property 'jobGradeId' does not exist on Employee` | 12 | 결과 객체 접근 |
| `Property 'department' does not exist on Employee` | 12 | 결과 객체 접근 |
| `'departmentId' does not exist in type EmployeeSelect` | 11 | select 직접 참조 |
| `Property 'jobGrade' does not exist on Employee` | 10 | 결과 객체 접근 |
| `'managerId' does not exist in type EmployeeScalarRelationFilter` | 7 | 관계 필터 |
| `Property 'status' does not exist on Employee` | 5 | 결과 객체 접근 |
| `Property 'managerId' does not exist on Employee` | 3 | 결과 객체 접근 |
| 기타 (include/select 타입 불일치 등) | ~148 | 각종 타입 불일치 |

영향받는 주요 파일:
- `prisma/seed.ts`
- `src/lib/workflow.ts`, `src/lib/attrition.ts`, `src/lib/auth.ts`
- `src/lib/compliance/kr.ts`, `cn.ts`, `ru.ts`, `gdpr.ts`
- `src/lib/payroll/batch.ts`, `severance.ts`
- `src/lib/pending-actions.ts`, `teams-digest.ts`, `peer-recommend.ts`
- `src/lib/org-snapshot-builder.ts`
- `src/app/(dashboard)/employees/[id]/page.tsx`
- API 라우트 60개 이상 (employees, attendance, leave, performance, compensation, analytics 등)

**A2-3 수정 전략:**
```typescript
// AS-IS (에러): Employee 직접 필터
prisma.employee.findMany({ where: { companyId: 'xxx' } })

// TO-BE: assignments를 통한 접근
prisma.employee.findMany({
  where: { assignments: { some: { companyId: 'xxx', endDate: null } } }
})
// 또는 current_employee_view 사용 (queryCurrentEmployeeView)
```

---

### A2-3: API 레이어 마이그레이션 (완료)

**작업 일자:** 2026-03-02

**목표:** A2-1에서 발생한 418개 TypeScript 에러를 수정하여 빌드 복원.

**수정 패턴:**
| 패턴 | 설명 |
|------|------|
| WHERE 절 | `companyId` 직접 → `assignments: { some: { companyId, isPrimary: true, endDate: null } }` |
| SELECT/INCLUDE | `department: true` 직접 → `assignments: { where: { isPrimary: true, endDate: null }, take: 1, include: { department: true } }` |
| 프로퍼티 접근 | `employee.companyId` → `employee.assignments?.[0]?.companyId` |
| Prisma 타입 추론 실패 | 중첩 select 시 `never`/`{}` 타입 → `(assignments?.[0] as any)?.field as string \| undefined` |
| managerId | Employee에서 제거됨 → Position 계층 2-step 조회 또는 `null` 플레이스홀더 |
| Department._count | `employees` → `assignments` |
| Employee UPDATE | 제거된 필드 → `employeeAssignment.updateMany()` |

**빌드 검증:**
| 검증 항목 | 결과 |
|-----------|------|
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run build` | 성공 ✅ |

**다음 세션(A2-2)에 전달 사항:**
- managerId 필드 제거로 인해 일부 라우트에서 manager 관련 로직을 `null` 또는 TODO로 남겨둠
- Position 기반 보고 라인 구조(A2-2)가 완성되면 해당 TODO들을 Position 계층 조회로 교체해야 함
- `src/lib/pending-actions.ts`의 managerId 관련 로직 미완성 상태

---

### B1: 법인 커스터마이징 엔진 (완료)

**작업 일자:** 2026-03-02

**핵심 설계:** `companyId = NULL` 레코드 = 글로벌 기본값, 법인 레코드 = 오버라이드. `getCompanySettings()` 헬퍼가 법인 → 글로벌 폴백 자동 처리.

**생성/변경된 파일:**
| 파일 | 상태 | 내용 |
|------|------|------|
| `prisma/schema.prisma` | 수정 | 9개 모델 추가 (EvaluationSetting, PromotionSetting, CompensationSetting, AttendanceSetting, LeaveSetting, OnboardingSetting, ExchangeRate, ApprovalFlow, ApprovalFlowStep) |
| `prisma/migrations/…b1_settings_engine/` | 신규 | B1 마이그레이션 |
| `prisma/seed.ts` | 수정 | B1 시드 섹션 추가 (글로벌 기본값 3개 + 법인별 오버라이드 + 환율 6개 + 승인플로우 9개) |
| `src/types/settings.ts` | 신규 | 설정 TypeScript 인터페이스 전체 (EvaluationSettings, PromotionSettings, CompensationSettings 등) |
| `src/lib/settings/categories.ts` | 수정 | performance→evaluation, organization→promotion 재명명; pay-components/bonus-rules 탭 추가 |
| `src/lib/settings/getSettings.ts` | 신규 | `getCompanySettings`, `hasCompanyOverride`, `createCompanyOverride`, `deleteCompanyOverride` |
| `src/app/api/v1/settings/evaluation/route.ts` | 신규 | GET/PUT + override POST/DELETE |
| `src/app/api/v1/settings/promotion/route.ts` | 신규 | GET/PUT + override POST/DELETE |
| `src/app/api/v1/settings/compensation/route.ts` | 신규 | GET/PUT + override POST/DELETE |
| `src/app/api/v1/settings/approval-flows/route.ts` | 신규 | GET/POST/PUT/DELETE |
| `src/app/api/v1/org/companies/route.ts` | 신규 | GET — 활성 법인 목록 |
| `src/components/settings/CompanySelector.tsx` | 신규 | 법인 선택 드롭다운 |
| `src/components/settings/GlobalOverrideBadge.tsx` | 신규 | 글로벌/커스텀 전환 뱃지 |
| `src/components/settings/SettingsPageLayout.tsx` | 신규 | 법인 선택 + 오버라이드 뱃지 래퍼 |
| `src/components/settings/ApprovalFlowEditor.tsx` | 신규 | 단계별 결재선 편집기 |
| `src/components/settings/ApprovalFlowSelect.tsx` | 신규 | 승인플로우 선택 드롭다운 |
| `src/components/settings/EvaluationSettingsClient.tsx` | 신규 | 평가 설정 Admin UI (methodology/grade-system/forced-distribution) |
| `src/components/settings/PromotionSettingsClient.tsx` | 신규 | 승진 설정 Admin UI (job-levels/promotion-rules/approval-chain) |
| `src/components/settings/CompensationSettingsClient.tsx` | 신규 | 보상 설정 Admin UI (pay-components/salary-band/raise-matrix/bonus-rules) |
| `src/components/settings/ApprovalFlowManagerClient.tsx` | 신규 | 승인플로우 CRUD 관리 UI |
| `src/app/(dashboard)/settings/[category]/page.tsx` | 수정 | B1 탭별 실제 컴포넌트 조건부 렌더링 |

**중요 패턴:**
- Prisma `upsert`는 nullable unique 필드에 사용 불가 → `findFirst` + 조건부 `create` 사용
- `ACTION.READ` 상수 없음 → `ACTION.VIEW` 사용 (constants.ts)
- 설정 오버라이드 API URL: `/api/v1/settings/{endpoint}/override`
- 시드 후 `npx prisma generate` 필수 (클라이언트 재생성)

**시드 데이터:**
| 항목 | 건수 |
|------|------|
| 글로벌 기본값 (EvaluationSetting, PromotionSetting, CompensationSetting) | 3 |
| CTR-KR 오버라이드 (평가 5등급 S/A/B+/B/C, 직급 G1-G6) | 2 |
| CTR-US 오버라이드 (MBO only, 5점 척도) | 2 |
| CTR-CN 오버라이드 (CNY) | 1 |
| ExchangeRate (KRW↔6개 통화) | 6 |
| ApprovalFlow (복리후생/채용/휴가/승진 1~4단계) | 9 |

**빌드 검증:**
| 검증 항목 | 결과 |
|-----------|------|
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run build` | 성공 ✅ |
| `npx prisma db seed` | 성공 (B1: 25 records) ✅ |

**다음 세션 (B2: Core HR) 전달 사항:**
- `src/types/process-settings.ts`의 `EvaluationSettings` 타입과 B1의 `src/types/settings.ts` 타입이 병존 중 — B2에서 통합 검토 필요
- B6(근태) UI에서 `AttendanceSetting`, `LeaveSetting` 모델 활용 가능 (API 없음)
- B5(온보딩) UI에서 `OnboardingSetting` 모델 활용 가능 (API 없음)
- `ExchangeRate` API 없음 — 필요 시 B7(급여) 세션에서 추가
- `ApprovalFlowSelect` 컴포넌트는 B3(성과), B5(온보딩), B9(복리후생) 에서 재사용 가능

---

## STEP 진행 현황

| STEP | 모듈 | 상태 | 커밋 범위 |
|------|------|------|-----------|
| 0 | Supabase 스키마 + Seed 데이터 | ✅ 완료 | `76b8016`~`8069a12` |
| 1 | 대시보드 + 사이드바 + 구성원 목록 | ✅ 완료 | STEP1 커밋들 |
| 2 | 구성원 상세 프로필 + 조직도 | ✅ 완료 | STEP2 커밋들 |
| 2.5 | Gap 보완 (협업 요청) | ✅ 완료 | |
| 3 | 온보딩 + 퇴직 + 셀프서비스 | ✅ 완료 | |
| 4 | 근태 + 휴가 + 단말기 | ✅ 완료 | |
| 5 | 채용 ATS + 징계/포상 | ✅ 완료 | `3b51ed8`~`8cc0d66` |
| 6-A | 성과관리 (MBO + CFR + 캘리브레이션) | ✅ 완료 | `62d2124`~`aa60293` |
| 6-B | 연봉 + 복리후생 + Attrition + 승계 | ✅ 완료 | `ecdee8f`, `ebf4cd9` |
| 7-1 | 급여 처리 (6-state machine + 한국세법) | ✅ 완료 | `30aae02` |
| 7-2 | HR 애널리틱스 대시보드 (9개 모듈 + AI) | ✅ 완료 | `e10c0f7` |
| 7-3 | 알림 시스템 (벨 + 트리거 설정) | ✅ 완료 | `85c1c59` |
| 8-1 | 관리자 설정 (11개 섹션) | ✅ 완료 | `9a0f89d` |
| 8-2 | 홈 + 매니저 허브 + HR 챗봇 + 커맨드 팔레트 | ✅ 완료 | `310584a` |
| 9-1 | i18n 다국어 (7개 언어) | ✅ 완료 | `e586055` |
| 9-2 | 컴플라이언스 (KR/CN/RU + GDPR) | ✅ 완료 | `edb0648` |
| R1~R6 | STEP 1~6A 디자인 리팩토링 (FLEX Green) | ✅ 완료 | |
| R7~R9 | STEP 7~9 디자인 리팩토링 (FLEX Green) | ✅ 완료 | 2026-03-01 |

---

## 디자인 리팩토링 요약 (R1~R9)

### 적용 기준
- **프라이머리:** `#00C853` (FLEX Green) — `tailwind.config.ts`의 `ctr-primary`
- **중립색:** hex 기반 (`#1A1A1A`, `#333`, `#555`, `#666`, `#999` 등) — `ctr-gray-*` 토큰
- **시맨틱:** emerald→`#059669`, amber→`#B45309`, indigo→`#4338CA`, red→`#EF4444` (hex 전환)
- **Shadow:** 카드에서 shadow-sm/md 제거 — 모달/드롭다운만 shadow-lg/xl 유지
- **제외:** `src/components/ui/` (shadcn, CSS 변수 기반), Prisma 생성 파일

### R7~R9 최종 검증 결과 (2026-03-01)
| 검증 항목 | 결과 |
|-----------|------|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | 성공 |
| 금지 패턴 잔존 | 0건 (slate/blue/gray/shadow-sm/md/emerald/amber/indigo) |

---

## 코드베이스 통계

| 항목 | 수량 |
|------|------|
| 총 TS/TSX 파일 | 894 |
| TSX 파일 | 347 |
| API 라우트 (route.ts) | 294 |
| 페이지 (page.tsx) | 115 |
| 컴포넌트 (components/) | 118 |
| Prisma 모델 | 87+2 (EmployeeAssignment, EmployeeManagerBackup 추가) |
| Prisma enum | 70 |
| Git 커밋 | 61 |

---

## QA 감사 스크립트 (Script/ 디렉토리)

| 파일 | 상태 |
|------|------|
| `QA1A_결과리포트.md` | ✅ STEP 0~6A (138항목: ✅110/⚠️12/❌16) |
| `QA1B_결과리포트.md` | ✅ STEP 6B~9 (151항목: ✅135/⚠️8/❌8) |
| `QA1_통합_기능정합성_리포트.md` | ✅ 전체 (289항목: ✅245(85%)/⚠️20(7%)/❌24(8%)) |
| `QA2_결과리포트.md` | ✅ 빌드·코드품질 (빌드 PASS, ESLint 0err/119warn) |
| `QA3_결과리포트.md` | ✅ 디자인 일관성 (금지패턴 0건, 경미 18건) |

---

## FIX 이력

| 항목 | 내용 | 상태 |
|------|------|------|
| FIX-1 | 사이드바 Dead Link + 차트 컬러 | ✅ |
| 6A-FIX-1 | 성과관리 코어 (12 API + 14 컴포넌트) | ✅ |
| 6A-FIX-2 | CFR 1:1 미팅 + Recognition | ✅ |
| 6A-FIX-3 | Pulse Survey + 360° Peer Review | ✅ |

---

## 주요 설정 파일

| 파일 | 역할 |
|------|------|
| `tailwind.config.ts` | `ctr-primary: #00C853`, `ctr-gray` 팔레트 정의 |
| `CLAUDE.md` | 디자인 토큰 + 7섹션 IA + RBAC + 컴포넌트 스펙 |
| `CTR_UI_PATTERNS.md` | UI/UX 패턴 가이드 (P01~P13 + NP01~NP04) |
| `prisma/schema.prisma` | 89 모델, 70 enum |
| `src/config/navigation.ts` | 7섹션 메뉴 구조 정의 |
| `src/hooks/useNavigation.ts` | 역할 기반 네비게이션 훅 |
| `src/lib/assignments.ts` | Effective Dating 헬퍼 함수 (A2-1 신규) |
| `src/types/assignment.ts` | EmployeeAssignment 타입 정의 (A2-1 신규) |

---

## 다음 작업

- [x] **A1: 사이드바 IA 재설계** — ✅ 완료 (2026-03-02)
- [x] **A2-1: employee_assignments 데이터 모델** — ✅ 완료 (2026-03-02)
- [x] **A2-1b: Settings Hub UI** — ✅ 완료 (2026-03-02)
- [x] **A2-2: Position 기반 보고 라인** — ✅ 완료
- [x] **A2-3: API 레이어 마이그레이션** (418 TS errors 수정) — ✅ 완료
- [x] **B1: 법인 커스터마이징 엔진** — ✅ 완료 (2026-03-02)
- [ ] B2~B11: 기능 구현 (Core HR → 통합 연동)
- [ ] C1~C3: UX 리팩토링 (테이블 표준화, 대시보드 통일, DnD)
- [ ] RLS 정책 추가
