# CTR HR Hub — QA 결함 등록부 (2026-05)

> 환경: 로컬 격리 QA DB `ctr_hr_hub_qa` (메인 스키마 push + 마스터 시드 + qa-accounts 시드).
> staging이 아닌 **클린 시드에서도 재현** = 시드/폼 설계 결함 (staging 한정 아님).

## Screen 1 — 직원등록 `/employees/new` (HR_ADMIN/SUPER_ADMIN, 4-step 위자드)

테스트: SUPER_ADMIN(대조영), 법인=CTR홀딩스. Step 1→2→3 진행 자체는 정상.

| ID | 화면/스텝 | 기대 | 실제 | 분류 | 근본원인 | 상태 |
|----|-----------|------|------|------|----------|------|
| S1-D1 | Step3 배정·직급* | 법인의 직급 목록 표시, 선택 후 등록 진행 | **옵션 0개(전 법인, 항상)** → 직급 필수라 등록 불가 = "다음 안 넘어감"의 실제 원인 | 버그(치명) | ① 마스터 시드가 `seedJobGrades`(37-job-grades.ts) **미호출** → 2법인만 grade 생성(qa-accounts 경유). ② `gradeTitleMapping` 생성 시드 **전역 0건**. ③ 폼(`EmployeeNewClient.tsx:421`)·편집(`employees/[id]/page.tsx`)이 `JobGrade` 아닌 `GradeTitleMapping` 소스 → 매핑 없으면 빔 | 코드확인완료·수정안논의 |
| S1-D2 | Step3 배정·직군* | 직군 종류만큼만 표시 | **같은 값 12개씩**(관리직/사무직/생산직/연구개발 ×12) | 버그 | `page.tsx:52-55` `jobCategory.findMany` 법인필터·dedup 없음. `job_categories` 48행=4종×12법인(company_id 존재하나 미사용) | 논의대기 |
| S1-D3 | Step3 배정·부서* | 법인 부서 목록(중복 없음, 명칭 일관) | `품질관리팀` ×2(한 법인), KO/EN 혼재(`경영지원본부` vs `Strategy & Planning`) | 버그+의도확인 | qa-accounts 시드가 마스터 시드와 겹치는 부서 생성 → 중복. 명칭 i18n 정책 부재 | 논의대기 |
| S1-D4 | Step3 배정·직위 | 법인 직위 목록(중복 없음) | `대표이사` ×2, `생산기술팀원` ×2(한 법인) | 버그 | qa-accounts vs 마스터 시드 직위 충돌 | 논의대기 |

### ✅ 검증 완료 (2026-05-17)
- `npx tsc --noEmit` 0 · `npm run lint` clean · `npm run i18n:validate` PASS
- **Layer 1 정합성 스윕: HIGH 29 → 0** (재시드 후) — 직급 8→63(12법인), 호칭 0→63
- **브라우저 직접 검증(HR_ADMIN, /employees/new step3)**: 직급 0개→`E1/S1/L2/L1` 4개, 직군 12중복→정확히 4개
- `npm run build` (NODE_OPTIONS heap 8192) GREEN — 356 pages. *기본 heap은 OOM=INF-2*
- Codex Gate 2: HIGH 0, P2 1건(스윕 안전가드 `*.supabase.co` 누락)→수정
- 잔여: MED 7(해외 호칭 설계상 deferral 5, 레거시 position 중복 2=정리 트랙), LOW 12(매핑 커버리지=정보성). 전부 비차단·추적됨
- ⚠️ dev-mode e2e(`next dev`+4워커)는 스켈레톤 15초 타임아웃 산물로 신뢰 불가 신호 — 프로덕션 빌드 e2e가 정식 게이트(별도)

### 수정 적용 (F1–F5, Codex Gate 1 하드닝 반영)
| Fix | 내용 | 해소 결함 | 파일 |
|----|------|----------|------|
| F1 | `seedJobGrades` 오케스트레이터 연결 (Step7 후·QA계정 전, idempotent) | L1-A1·A2, S1-D1(근본) | `prisma/seed.ts` |
| F2 | 직급 드롭다운 소스 = JobGrade 직접(법인필터·rankOrder), 매핑은 호칭 자동완성 보조로만. 신규+편집 표시 | S1-D1 | `employees/new/{page,EmployeeNewClient}`, `employees/[id]/{page,EmployeeDetailClient}` |
| F3 | jobCategory/jobGrade/매핑 법인필터 + 폼 선택법인 필터(법인당 4종, FK 정합) + 법인변경 시 종속값 리셋 | S1-D2, L1-B1 | 동상 |
| F4 | qa-accounts 부서명 `[QA]` 접두 → 마스터 시드명 비충돌 (code/id 불변, FK 무영향) | S1-D3, L1-B2 | `prisma/seeds/00-qa-accounts.ts` |
| F5 | 스윕 CHECK C: 매핑 0건 HIGH→LOW(정보성) — F2로 매핑 선택사항화 | (게이트 정합) | `scripts/qa/integrity-sweep.ts` |

### Settings global 등록 — 근본 + 분류 (CEO 원칙: 정책/기본값=global, 법인고유=company)
**근본**: `SettingsSubPageLayout` `showCompanyGuide = companyId===null && !isGlobalOnly && !hasGlobalDefault`
→ 두 플래그 없는 탭은 global에서 등록 UI 대신 "법인 선택" 안내. `settings-config.ts` 메타 누락이 원인.

**플래그 부여 대상 (정책/기본값 → `hasGlobalDefault: true`)**:
- 근태/휴가: leave-types, leave-accrual, leave-promotion, holidays, loa-types, shift-patterns, work-schedules
- 급여/보상: earnings, deductions, tax-free, salary-bands, merit-matrix, bonus-rules
- 성과/평가: cycle, grade-scale
- 채용/온보딩: onboarding-templates, offboarding-checklist
- 시스템: notification-rules, approval-flows, audit
- 조직/인사: grade-title-mappings, job-families

**company-only 유지 (법인 고유 구조/마스터 — 안내 정상)**:
- company-info, departments, positions, custom-fields, code-management, locations, currency,
  designated-leave, weekly-hours, pay-schedule (description상 "법인별" 명시)

**구현 주의 (Codex 관점)**: 플래그 flip ≠ 작동하는 global UI. 부여 대상 각 탭은 global 경로
(companyId 없이 조회·기본값 저장·전파·법인 override)를 실제 구현/검증해야 함 → F1–F5처럼
별도 수정+탭별 검증 1세트. **분류 확정 후 착수.**

**🔴 정밀 근본 (템플릿 grade-title-mappings 조사 중 발견 — 더 깊음)**:
레이아웃 안내는 표면. 진짜 근본 = **API 시맨틱**. `/api/v1/settings/grade-title-mappings`:
- GET `companyId = searchParams.get('companyId') ?? user.companyId` → global이어도 본인 법인만
- POST `companyId = body.companyId ?? user.companyId` → global 등록이 본인 법인에만
즉 플래그를 켜도 "global=전 법인"이 **동작 안 함**(조용히 본인 법인 스코프). 22개 탭 대부분 동일 API 패턴 추정 = CEO "global 안 됨"의 진짜 정체.
**올바른 템플릿** = 레이아웃 플래그 + API global 시맨틱(SUPER_ADMIN+companyId 없음 →
GET 전 법인, POST 전 법인 일괄 upsert, PUT/DELETE 법인별 override). cross-company
일괄 쓰기 = 권한·resolveCompanyId SSOT 인접·Codex 게이트 필요 → **전용 세션 권장**
(긴 세션 말미 급조 금지).

### 별도 트랙 (본 수정 범위 밖, 기록)
- **직원 편집 배정 미저장**: `PUT /api/v1/employees/[id]`가 직급/직군/호칭 등 배정 필드를 버림 → 편집해도 저장 안 됨 (기존 결함, Codex Gate1 발견). 별도 트랙.
- **레거시 중복 정리**: 이미 시드된 DB의 기존 중복(대표이사 등)은 FK 재매핑 포함 승인형 정리 스크립트 (원 플랜 Codex HIGH 2 트랙).
- **S1-D1 직위/직책 용어 재정의**: CEO 개념모델(메모리 기록)과 코드 명명(EmployeeTitle=호칭) 정합 — 별도.
- **로케일 명칭**(한/영/중/서) 전면 적용 — 별도 디자인 트랙.
- INF-1(마이그레이션 from-scratch), INF-2(빌드 OOM) — 인프라 트랙.

### Layer 1 정합성 스윕 (전역 일반화) — `2026-05-integrity-sweep.md`
| ID | 범위 | 결함 | 비고 |
|----|------|------|------|
| L1-A1 | 10/12 법인 | 직급(JobGrade) 0건 | 마스터 시드가 일부 법인만 grade 생성 |
| L1-A2 | 12/12 법인 | 직위/호칭(EmployeeTitle) 0건 | `seedJobGrades` 호칭 시드 전역 미실행 |
| L1-B1 | 전사 | 직군(JobCategory) code별 12중복 | 폼 법인필터 부재 (S1-D2 일반화) |
| L1-C1 | 전사 | GradeTitleMapping 0건 | 생성 시드 부재 (S1-D1 근본) |
| L1-B2 | CTR | 부서·직위 중복 | qa-accounts 시드 충돌 (S1-D3/D4) |
> Layer 1 스크립트 `scripts/qa/integrity-sweep.ts` — 읽기전용, 로컬가드, CI 게이트(HIGH>0→exit1). 회귀검증 재사용.

### Layer 2 e2e flows 분류 (116 pass / 21 fail / 13 flaky, 14.3분)
- **실패 34개 상세블록 중 ~33개 = 동일 패턴**: `expect(.animate-pulse).not.toBeVisible()` 타임아웃
  → 페이지가 **로딩 스켈레톤에서 무한 대기** = 데이터 fetch 미해결.
  **Layer 1 데이터 결함의 하류 증상** (별개 코드 버그 아님). 영향 화면:
  analytics·attendance·employee-crud(목록/상세/신규폼/디렉토리)·my-space·payroll·
  performance·recruitment·onboarding·org skill-matrix·training 등 광범위.
- **진짜 기능결함 후보 1건**: `cross-cutting.spec.ts:69` i18n ko→en 토글 시 본문
  텍스트 미변경(`hasEnglishText=false`). 단 재시도는 스켈레톤으로 실패 → L1 수정 후 재검증 필요.
- **결론(수렴)**: Layer 1·2가 같은 곳을 가리킴. "여기저기 널린" 장애의 대다수가
  **단일 클래스(참조/시드 데이터 미연결 → 쿼리 빈값/에러 → 화면 스켈레톤 무한)**.
  → **L1 근본원인 수정이 블라스트 레이디어스 최대** (e2e 다수도 같이 해소). 116 pass =
  라우팅/인증/렌더 셸은 정상.

### 인프라 결함 (별도)
| ID | 내용 | 영향 |
|----|------|------|
| INF-1 | `prisma migrate deploy` from-scratch 실패: `20260302180319_a_benefit_claims`가 아직 없는 `exchange_rates.updated_at` 참조 | 신규 환경/CI에서 정상 셋업 불가 (staging은 점진 적용돼 미발현). 별도 마이그레이션 트랙 필요 |
| INF-2 | `npm run build`가 기본 Node heap에서 **OOM 크래시** (`Ineffective mark-compacts near heap limit`) | 프로덕션 빌드 미완 → 손상된 `.next/`가 동일 디렉터리 dev 서버까지 전 라우트 500 유발. CI/Vercel 빌드도 `NODE_OPTIONS=--max-old-space-size` 미설정 시 영향 가능. 빌드 메모리 설정 필요 |
| INF-3 (커버리지 갭) | 기존 e2e `flows`는 대부분 `assertPageLoads`(페이지 뜨나)만 단언 — 빈/중복 드롭다운·global 등록 누락·멀티스텝 차단을 단언 안 함 | UAT까지 결함 미검출의 구조적 원인. Layer 2b 스모크 매트릭스로 보강 필요 |
