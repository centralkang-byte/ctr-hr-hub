# CTR HR Hub — Pre-Launch Roadmap v4.0

> **작성일:** 2026-03-11
> **작성자:** Claude (CTO/CDO) + Sangwoo (CEO)
> **목적:** 전체 파이프라인 완성 → 통합 허브 연결 → 인사이트 → 설정 → 프로덕션 준비까지의 실행 계획
> **예상 잔여 세션:** 13~15세션
> **기준:** 각 GP 설계 스펙 v1.1 FINAL 대비 갭 분석 완료

---

## 현재 상태 요약 (GP#4-D 완료 후 기준)

| 파이프라인 | 백엔드 | 프론트엔드 | 설계 스펙 | 갭 |
|-----------|:------:|:--------:|:--------:|:--:|
| GP#1 Leave | ✅ 완성 | ✅ 완성 | ✅ v1.1 | 중 (6건) |
| GP#3 Payroll | ✅ 완성 | ✅ 완성 | ✅ v1.1 | ✅ 없음 |
| GP#4 Performance | ✅ 완성 | ✅ 완성 | ✅ v1.1 | ✅ 없음 |
| GP#2 Onboarding/Offboarding | 기초만 | 기초만 | ✅ v1.1 FINAL | 대 (3세션) |
| Unified Task Hub | API 존재 | ❌ 없음 | ✅ v1.1 | 대 (2세션) |
| 인사이트 (Analytics) | 초기 빌드 | 초기 빌드 | ❌ 미작성 | 대 (설계+2세션) |
| Settings | ❌ 셸만 | ❌ 셸만 | ✅ v1.1 | 대 (2세션) |
| 최적화/보안 | 미착수 | 미착수 | N/A | (3세션) |

### 완료된 파이프라인

| 완료 항목 | 세션 | 주요 산출물 |
|----------|------|-----------|
| GP#3 Payroll A~D + QA | 6세션 | 8-status 상태머신, 이상감지 6규칙, 다단계 결재, 명세서, 은행이체CSV, 대시보드 |
| GP#4 Performance A~D | 4세션 | 9-state 사이클, 동료평가(반익명), 캘리브레이션 투트랙, Merit Matrix, Soft Warning, 보상기획 대시보드 |
| GP#1 Leave (초기) | 1세션 | 이중잔액, Optimistic UI, 팀부재 컨텍스트, 벌크승인 |

### 코드베이스 규모
- TS/TSX: 920+ | API routes: 320+ | Pages: 166 | Prisma models: 92+ | Enums: 74+ | Git: 73+ commits

---

## 로드맵 전체 구조

```
Phase 1: GP#2 파이프라인 완성   ─── "마지막 남은 Golden Path"
  │
  ├─ Session E-1   온보딩 (공유 인프라 + 4단계 파이프라인)
  ├─ Session E-2   오프보딩 (퇴직면담 + 자산공제 + 정산)
  └─ Session E-3   QA + 크로스보딩 + ATS 연결
  │
Phase 2: 허브 + 공통 인프라      ─── "모든 것을 하나로 연결"
  │
  ├─ Session F-1   Unified Task Hub UI + 홈 위젯
  ├─ Session F-2   Delegation 시스템 + 인라인 승인
  └─ Session F-3   GP#1 보강 (마이너스 연차 + 취소 + HR 대시보드)
  │
Phase 3: 인사이트               ─── "데이터로 의사결정"
  │
  ├─ (설계)        인사이트 설계 스펙 작성 (Claude.ai에서)
  ├─ Session G-1   인사이트 대시보드 재구축
  └─ Session G-2   예측 분석 + AI 리포트
  │
Phase 4: 설정                   ─── "HR이 직접 운영"
  │
  ├─ Session H-1   Settings 프레임워크 + 급여/근태
  └─ Session H-2   성과/채용/시스템 + 법인 오버라이드
  │
Phase 5: 프로덕션 레디           ─── "안전하고 빠르게"
  │
  ├─ Session I-1   SWR 전환
  ├─ Session I-2   Realtime + 헬퍼 표준화
  └─ Session I-3   RLS 정책
```

---

## Phase 1: GP#2 파이프라인 완성

> **목표:** GP#1/3/4는 100% 완료. 마지막 남은 GP#2(온보딩/오프보딩)를 설계 스펙 v1.1 수준으로 풀 구현.
> **왜 먼저:** Phase 2의 Unified Task Hub가 5개 파이프라인을 연결하므로, GP#2가 없으면 허브가 불완전.
> **스펙:** `CTR_GP2_ONBOARDING_OFFBOARDING_DESIGN_SPEC_v1_1_FINAL.md`

---

### Session E-1 — GP#2: 공유 인프라 + 온보딩 파이프라인

**스펙 참조:** PART 0 (공유 아키텍처) + PART A (온보딩)

#### 공유 인프라 (온보딩/오프보딩 공통 — 먼저 구축)

| # | 항목 | 설명 | 스펙 섹션 |
|---|------|------|----------|
| 1 | 태스크 상태 머신 | PENDING → IN_PROGRESS → DONE / BLOCKED / SKIPPED. 전환 규칙 가드 | P0-3 |
| 2 | BLOCKED 깃발 시스템 | BLOCKED 설정 시 사유 필수. HR 대시보드 🔴 경고. 관련 담당자 알림. 2일 초과 시 추가 Nudge. 모든 BLOCKED/Unblock 이력 감사 추적 | P0-2 |
| 3 | Unblock 권한 | 담당자 본인: 본인 태스크, HR_ADMIN: 전체, 매니저: 팀원 태스크 | P0-2 |
| 4 | 템플릿 엔진 강화 | companyId=NULL 글로벌 + 법인별 오버라이드. targetType(NEW_HIRE/TRANSFER/REHIRE) 분기. 템플릿 없으면 warn 로그 + skip | P0-5 |
| 5 | 동적 Nudge 인프라 | 마일스톤별 간격 차등: Day 0-1(지연 1일 후, 1일 간격, 2회), Day 2-7(1일 후, 2일, 3회), Day 8+(3일 후, 3일, 3회) | A-1 |
| 6 | UnifiedTask Hub 매핑 규칙 | 상태→UnifiedTask 변환, Priority 동적 계산 (overdue 기반), Title 포맷 `[온보딩] Day {N} ❘ {태스크명}` | P0-4 |

#### 온보딩 파이프라인 (STEP 1~4)

| # | 항목 | 설명 | 스펙 섹션 |
|---|------|------|----------|
| 7 | STEP 1: 신입 등록 → 이벤트 | HR이 POST /employees → Employee 생성 → EMPLOYEE_HIRED 이벤트 발행 (fire-and-forget, TX 외부). payload: { employeeId, companyId, hireDate, employmentType } | A4 |
| 8 | STEP 2: 체크리스트 자동 생성 | employee-hired.handler: (1) 회사 전용 템플릿 조회 (2) 없으면 글로벌 fallback (3) EmployeeOnboarding 인스턴스 생성 (4) 태스크 일괄 생성 (5) 마지막에 매니저 Sign-off 태스크 자동 추가 (dueDays=90, assigneeType=MANAGER) | A5 |
| 9 | STEP 3: 태스크 수행 UI | 마일스톤별 그룹핑 (Day 1/7/30/90) + 담당자별 필터 (HR/IT/MANAGER/BUDDY/EMPLOYEE) + 진행률 프로그레스바 + BLOCKED 태스크 시각적 구분 | (신규) |
| 10 | STEP 4: 매니저 Sign-off | 모든 isRequired=true 태스크 DONE → 매니저에게 Sign-off 태스크 자동 생성. 매니저 확인: 필수 태스크 완료 여부 + 감정 체크인 추이 + BLOCKED 이력. Sign-off 클릭 → ONBOARDING_COMPLETED 이벤트 → 수습 평가 트리거 + Employee.status 갱신 | A-2 |
| 11 | Sign-off 지연 처리 | 3일+ 미처리 시 Nudge (2일 간격, 최대 3회). 매니저 부재 시 Delegation 수임자가 Sign-off 가능 (Phase 2 F-2에서 구현, 여기서는 TODO) | A-2 |
| 12 | 감정 체크인 | Day 7/30/90 마일스톤에 Mood/Energy/Belonging 3항목 (4단계: 😀/🙂/😐/😞). Sign-off 화면에 추이 요약 차트 | A-1 |
| 13 | HR 대시보드 | 진행 중 온보딩 목록 + 법인별 필터 + 진행률 + BLOCKED 건수 배지 + Sign-off 대기 목록 | (신규) |
| 14 | 직원 셀프서비스 뷰 | `/onboarding/me` — 본인 태스크 목록 + 완료 체크 + 감정 체크인 입력 | (신규) |

#### 온보딩 이벤트 체인

| 이벤트 | 트리거 | 자동 처리 |
|--------|--------|----------|
| EMPLOYEE_HIRED | HR이 직원 등록 | 체크리스트 자동 생성 + 관련자 알림 |
| ONBOARDING_TASK_COMPLETED | 담당자가 태스크 완료 | 진행률 업데이트 + 전체 필수 완료 시 Sign-off 태스크 생성 |
| ONBOARDING_CHECKIN_SUBMITTED | 직원 감정 체크인 | 매니저에게 알림 (부정적 응답 시 하이라이트) |
| ONBOARDING_COMPLETED | 매니저 Sign-off | Employee.status 갱신 + 수습 평가 트리거 + 만족도 설문 발송 |

#### 시드 데이터

| 데이터 | 건수 | 설명 |
|--------|------|------|
| 글로벌 온보딩 템플릿 | 1 | Day 1/7/30/90 × 5역할 × ~15개 태스크 + Sign-off |
| 법인 오버라이드 템플릿 | 2 | CTR-KR, CTR-US 최소 |
| 진행 중 온보딩 인스턴스 | 4~5 | Day 1 진행중, Day 30 진행중, BLOCKED 포함, Sign-off 대기 등 |
| 감정 체크인 | ~10 | 다양한 Mood/Energy/Belonging 조합 |

**DO NOT modify:**
- Sidebar config, i18n files, layout components unless explicitly required
- prisma/seed.ts (master seed file)
- GP#1/GP#3/GP#4 기존 코드 (파이프라인 로직)
- Unified Task Hub API (Phase 2에서 별도 처리)

**추천 모델:** Opus — 이벤트 핸들러 + 상태 머신 + 템플릿 엔진 + UI가 복합적으로 엮임

**완료 기준:**
- [ ] HR이 직원 등록 → 체크리스트 자동 생성 확인 (글로벌 + 법인별)
- [ ] 태스크 상태 전환 (PENDING → IN_PROGRESS → DONE/BLOCKED/SKIPPED) 동작
- [ ] BLOCKED 설정 + 사유 기록 + HR 대시보드 경고 표시
- [ ] 매니저 Sign-off → ONBOARDING_COMPLETED 이벤트 발행
- [ ] 감정 체크인 입력 + 추이 차트 표시
- [ ] `/onboarding/me` 직원 셀프서비스 동작
- [ ] `tsc` 0 errors + `build` pass + UI에서 시드 데이터 확인

---

### Session E-2 — GP#2: 오프보딩 파이프라인

**스펙 참조:** PART B (오프보딩)

| # | 항목 | 설명 | 스펙 섹션 |
|---|------|------|----------|
| 1 | STEP 1: 오프보딩 시작 | HR이 퇴직 프로세스 개시. 퇴직 유형 5가지 선택 (VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END/MUTUAL). lastWorkingDate 입력 → EMPLOYEE_OFFBOARDING_STARTED 이벤트 | B4 |
| 2 | 퇴직 유형별 분기 | INVOLUNTARY: IT 계정 즉시 비활성화 + 간소화 체크리스트 (D-Day=당일). VOLUNTARY: 표준 체크리스트 (D-30) | B11 엣지 #1 |
| 3 | STEP 2: 체크리스트 자동 생성 | 핸들러: 중복 가드 + 퇴직 유형별 템플릿 선택 + lastWorkingDate - dueDaysBefore로 듀 날짜 역산 | B5 |
| 4 | STEP 3: 태스크 수행 UI | D-30→D-Day 타임라인 뷰. 역할별(본인/HR/IT/FINANCE/매니저) 태스크 표시. BLOCKED 깃발 (E-1 공유 인프라 재활용) | B6 |
| 5 | 퇴직 면담 (Exit Interview) | ExitInterview 모델: 주요 퇴직 사유(8종 enum), 만족도(1~5), 재입사 의향(Boolean), 자유 피드백(텍스트), AI 요약, 면담자 ID | B7 |
| 6 | **퇴직 면담 데이터 격리** | API 레벨: `isDirectManager(requestingUser, employeeId)` → 403. HR_ADMIN/SUPER_ADMIN만 원본 열람. 퇴직자 본인도 제출 후 수정/열람 불가 | B7 |
| 7 | 익명화 통계 리포트 | 부서/기간에 5건 이상 축적 시에만 생성. 사유별 비율 차트. 5건 미만 → 통계 미생성 (개인 특정 방지). 매니저에게는 익명 통계만 공개 | B7 |
| 8 | M365 자동 차단 (수동 fallback) | v1: IT 수동 태스크로 구현 (API 미연동). 체크리스트에 3단계 명시: OOF 설정 → 계정 비활성화 → 라이선스 회수. D-Day+1 미처리 시 IT+HR에게 즉시 Nudge | B6, B11 #9 |
| 9 | 미반납 자산 공제 | 오프보딩 완료 시 IT '장비 반납' 태스크 미완료 → AssetReturn 조회 → `lib/labor/{country}.ts` canDeductUnreturnedAsset() + 동의서 확인 → 공제 가능: GP#3 PayrollAdjustment 자동 생성 / 불가: HR에게 "민사 청구 필요" 알림 | B8 |
| 10 | STEP 4: 완료 + 정산 | 모든 필수 태스크 DONE → OFFBOARDING_COMPLETED → 퇴직금 정산 + 미사용 연차 수당(GP#1 공식) + 마이너스 연차 공제 + 4대보험 상실 + 미반납 자산 공제 + Employee.status = INACTIVE | B8 |
| 11 | 오프보딩 Nudge | (1) 태스크 지연: 퇴직일 임박 시 12시간까지 단축 (2) 퇴직 면담 미실시: D-7부터 2일 간격 3회 (3) M365 미처리: D-Day+1 즉시, 12시간 간격, 5회 | B9 |
| 12 | 퇴직 철회 | EmployeeOffboarding CANCELLED + 미완료 태스크 일괄 취소 + Employee 상태 유지 | B11 #2 |
| 13 | 퇴직일 변경 | lastWorkingDate 수정 → dueDaysBefore 재계산 → 태스크 듀 날짜 일괄 갱신 | B11 #3 |

#### 오프보딩 이벤트 체인

| 이벤트 | 트리거 | 자동 처리 |
|--------|--------|----------|
| EMPLOYEE_OFFBOARDING_STARTED | HR이 퇴직 시작 | 체크리스트 가드 + 관련자 알림 |
| OFFBOARDING_TASK_COMPLETED | 담당자가 태스크 완료 | 진행률 업데이트 |
| OFFBOARDING_COMPLETED | 모든 필수 태스크 완료 | 상태 COMPLETED + 정산 트리거 + 미반납 자산 체크 |
| ASSET_DEDUCTION_CREATED | 미반납 자산 공제 상신 | HR 승인 대기열에 추가 |

#### 법인별 차이 (시드/검증 참조)

| 항목 | KR | US | CN | RU | VN | MX |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| 퇴직금 | 법정 (1년+) | 없음 (At-will) | 경제보상금 | 해고수당 | 퇴직수당 | 법정 3개월분 |
| 사전 통보 | 30일 | 없음 (2주 관행) | 30일 | 14일 | 30~45일 | 없음 |
| 자산 공제 | ✓ (동의 시) | 주별 상이 | ✓ (제한적) | ✓ (월급 20% 한도) | △ | △ |

#### 시드 데이터

| 데이터 | 건수 | 설명 |
|--------|------|------|
| 오프보딩 템플릿 | 2+ | 자발 퇴직용 (D-30), 비자발 퇴직용 (즉시) |
| 진행 중 오프보딩 | 3 | 다양한 단계 (D-15, D-3, 완료 직전) |
| ExitInterview | 6+ | 부서별 5건 이상 (익명 통계 테스트용) |
| AssetReturn | 2+ | 미반납 1건 포함 |

**DO NOT modify:**
- E-1에서 구축한 공유 인프라 (상태 머신, BLOCKED, 템플릿 엔진)
- GP#1/GP#3/GP#4 기존 코드
- prisma/seed.ts (master)

**추천 모델:** Opus — 데이터 격리 + 자산 공제 + 급여 정산 연동

**완료 기준:**
- [ ] HR이 오프보딩 시작 → 퇴직 유형별 체크리스트 자동 생성 (역산 듀 날짜)
- [ ] 비자발 퇴직: 간소화 체크리스트 + IT 계정 즉시 태스크
- [ ] 퇴직 면담 입력 + 매니저 403 차단 확인
- [ ] 익명 통계 5건 이상 시에만 생성 확인
- [ ] 미반납 자산 → PayrollAdjustment 자동 생성
- [ ] OFFBOARDING_COMPLETED → 급여 정산 항목 자동 생성
- [ ] 퇴직 철회 + 퇴직일 변경 동작
- [ ] `tsc` 0 errors + `build` pass

---

### Session E-3 — GP#2: QA + 크로스보딩 + ATS 연결

| # | 항목 | 설명 |
|---|------|------|
| 1 | **크로스보딩 (TRANSFER)** | 법인 간 전출 시 동일 온보딩 엔진 재활용. targetType=TRANSFER 전용 템플릿 (IT 재셋업 + 현지 법규 안내 등). 기존 법인에서는 잔여 연차 정산 (GP#1 공식) |
| 2 | **ATS → 온보딩 연결** | 채용 파이프라인 합격 확정 화면에 "직원으로 등록" 버튼 → POST /employees + EMPLOYEE_HIRED 자동 발행. 지원자 정보 프리필 |
| 3 | **온보딩 전체 QA** | 7개 법인 × 역할별(직원/매니저/HR/BUDDY) 시나리오 테스트 |
| 4 | **오프보딩 전체 QA** | 5개 퇴직 유형별 시나리오: 자발/비자발/퇴직 철회/퇴직일 변경/면담 격리 |
| 5 | **한국어 번역** | 신규 UI 한국어 라벨 + i18n 키 누락 확인 |
| 6 | **엣지 케이스** | 즉시 해고 간소화, 인수인계 대상자 부재, 면담 거부(SKIP), 소규모 팀 통계 미생성, 장비 공제 동의서 미존재 |
| 7 | **SHARED.md 업데이트** | GP#2 완료 상태 + 신규 모델/API/페이지/시드 기록 |

**추천 모델:** Sonnet — QA + 번역 + 엣지 케이스 수정

---

## Phase 2: 허브 + 공통 인프라

> **목표:** 모든 파이프라인의 "해야 할 일"을 하나의 허브로 통합. 승인 병목 해결. GP#1 갭 해소.
> **전제:** Phase 1에서 GP#2 완성 → Task Hub 5개 매퍼가 전부 의미 있는 데이터 반환.

---

### Session F-1 — Unified Task Hub UI + 홈 대시보드 위젯

**스펙 참조:** `CTR_UNIFIED_TASK_HUB_DESIGN_SPEC_v1_1.md`

| # | 항목 | 설명 | 스펙 섹션 |
|---|------|------|----------|
| 1 | `/my/tasks` 전용 페이지 | 타입 필터 탭 (전체/휴가/급여/온보딩/오프보딩/성과) + countByType 뱃지 | 섹션 12 |
| 2 | 태스크 카드 | Priority 아이콘(🔴🟡🟢🔵) + 타입 태그 + 제목 + 기한/경과일 + 클릭→sourceUrl 이동 | 섹션 12 |
| 3 | 진행중/완료 탭 | 진행중: 전체 표시. 완료: **90일 타임박스** + 하단 안내 문구 | 섹션 12 v1.1 |
| 4 | 정렬/필터 | priority / dueDate / createdAt 정렬. 역할별 자동 필터링 | 섹션 5, 7 |
| 5 | 역할별 표시 | 직원: 본인 태스크. 매니저: 팀원 승인+본인. HR: 급여/캘리브레이션+온보딩HR태스크 | 섹션 7 |
| 6 | 홈 대시보드 위젯 교체 | 하드코딩 PendingActionsPanel → Task Hub 위젯 (상위 5건 + "전체 보기 →") | (신규) |
| 7 | 5개 매퍼 검증 | leave/payroll/onboarding/offboarding/performance 매퍼 데이터 반환 확인 | 섹션 4 |
| 8 | Nudge 카드 | 홈 대시보드에 Nudge/AI Recommendation 시각 카드 (기존 벨 알림 대비 가시성 향상) | (신규) |

**추천 모델:** Opus — 5매퍼 통합 + 역할별 필터 + 홈 위젯 교체

**완료 기준:**
- [ ] `/my/tasks`에서 5개 파이프라인 태스크 통합 표시
- [ ] 홈 대시보드에 실시간 Task Hub 위젯
- [ ] 직원/매니저/HR 역할별 다른 태스크 확인
- [ ] 완료 탭 90일 타임박스 동작

---

### Session F-2 — Delegation 시스템 + 인라인 승인

**스펙 참조:** `CTR_GP1_LEAVE_DESIGN_SPEC_v1_1_FINAL.md` 섹션 3 원칙 4 + 섹션 8

#### Delegation 시스템 (전체 승인에 공통)

| # | 항목 | 설명 |
|---|------|------|
| 1 | ApprovalDelegation 모델 활성화 | delegatorId, delegateeId, startDate, endDate, scope(LEAVE / ALL) |
| 2 | 위임 설정 UI | 매니저가 부재 전 대상자 + 기간 + 범위 설정. 수임자 범위: 같은 팀 시니어, 상위 매니저, HR |
| 3 | 위임 기간 승인함 접근 | 수임자가 해당 팀 승인함 접근 가능 (Leave, Attendance, Onboarding Sign-off) |
| 4 | 위임 태그 | "위임 승인 by {수임자명}" 감사 추적 |
| 5 | 자동 회수 | 기간 종료 → 권한 자동 회수. DELEGATION_ENDED 이벤트 |
| 6 | 동시 위임 제한 | 1명 → 동시에 1명에게만 |
| 7 | 원래 매니저 유지 | 위임 중에도 원래 매니저 승인 가능 (추가, 회수 아님) |
| 8 | Nudge: 위임 미설정 | 매니저 휴가 신청 + 미설정 → 즉시 1회 경고 |
| 9 | Nudge: PENDING 에스컬레이션 | 미설정 + PENDING 3일+ → HR에게 에스컬레이션 |

#### 인라인 승인/반려 (Task Hub 내)

| # | 항목 | 설명 |
|---|------|------|
| 10 | 인라인 승인 | Task Hub 카드에서 [승인] [반려] 직접 처리 |
| 11 | 벌크 승인 | 다중 선택 → 일괄 승인 |
| 12 | 컨텍스트 팝오버 | 잔여일수, 팀 부재, 최근 이력, 마이너스 경고 미리보기 |
| 13 | Delegation + Task Hub | 수임자 Task Hub에 위임받은 팀 태스크 표시 |

**추천 모델:** Opus — 권한 체계 전반 영향

**완료 기준:**
- [ ] 위임 설정 → 수임자 승인함 접근
- [ ] "위임 승인 by {수임자명}" 태그
- [ ] 기간 종료 후 자동 회수
- [ ] Task Hub 인라인 승인/반려 + 벌크

---

### Session F-3 — GP#1 Leave 보강

**스펙 참조:** `CTR_GP1_LEAVE_DESIGN_SPEC_v1_1_FINAL.md` — 갭 6건

**의존성:** F-2 (Delegation) 완료 필수

| # | 항목 | 설명 | 스펙 섹션 |
|---|------|------|----------|
| 1 | **마이너스 연차** | 법인별 ON/OFF + 한도. 경고 표시. 연초 자동 상환 (이월→마이너스 차감) | 섹션 3 원칙 3, 섹션 6 |
| 2 | **취소 세분화** | PENDING: 직원 취소. APPROVED+시작 전: 직원 취소(복구). APPROVED+시작 후: HR만(부분 복구) | 섹션 8 |
| 3 | **사전 신청/연속 상한** | 법인별 최소 N일 전 + 최대 연속 N일. 서버 검증 | 섹션 7 |
| 4 | **팀 동시 부재 제한** | Soft Warning (경고만, 차단 안 함) | 섹션 7 |
| 5 | **HR Admin 대시보드** | 부서별 사용률 차트 + 잔여 분포 히스토그램 + 소진 예측 + 마이너스 현황 + 일괄 부여 | 섹션 15 |
| 6 | **Nudge 3종** | (1) 승인 독촉 3일+/2일/3회 (2) 연말 소진 11월~/잔여3일↓/7일/3회 (3) Delegation 미설정 즉시 1회 | 섹션 11 |
| 7 | **엣지 케이스** | 연말/연초 분할 차감, 반차+반차=1일, 퇴사 시 마이너스 공제(GP#2 연동), 전출 시 정산(GP#2 연동) | 섹션 13 |

**추천 모델:** Opus — 마이너스 연차 + 취소 세분화 + 대시보드 차트

**완료 기준:**
- [ ] 마이너스 연차 ON → 한도 내 신청 + 경고
- [ ] 연초 자동 상환 동작
- [ ] APPROVED 취소 시작 전/후 분기
- [ ] HR 대시보드 차트 + 소진 예측 + 일괄 부여
- [ ] Nudge 3종 발송 확인

---

## Phase 3: 인사이트

> **목표:** 파이프라인 데이터 기반 HR 분석 대시보드.
> **전제:** Phase 1~2 완료 후 GP#1~4 데이터 + Task Hub 동작.
> **핵심 문제:** 기존 `/analytics/*` 12개 페이지는 파이프라인 데이터와 미연결. 재구축 필요.

---

### 설계 — 인사이트 스펙 작성 (Claude.ai에서)

**왜 설계가 먼저:**
- "어떤 KPI를 누구에게" 미정의
- GP#2 퇴직면담, GP#3 급여추이, GP#4 등급분포 등 새 데이터 소스
- 설계 없이 구현 → "파이프라인과 미연결된 독립 차트" 반복

**스펙에 포함될 내용:**

| 항목 | 설명 |
|------|------|
| 역할별 대시보드 | 직원/매니저/HR/경영진 각 다른 뷰 |
| KPI 정의 | Leading vs Lagging |
| 데이터 소스 매핑 | Prisma 모델 → 지표 집계 |
| 차트 타입 | 지표별 최적 시각화 |
| 예측 분석 | 이직 예측, 번아웃, 승계 위험 |
| AI 리포트 | 법인별/부서별 월간 자동 요약 |
| 퇴직 면담 익명 통계 | GP#2 ExitInterview 연동 |
| 권한 매트릭스 | 역할별 접근 가능 지표 |

**산출물:** `CTR_INSIGHTS_DESIGN_SPEC_v1.0.md`

---

### Session G-1 — 인사이트 대시보드 재구축

**범위 (설계 스펙 확정 후 구체화):**

| # | 대시보드 | 데이터 소스 | 핵심 KPI |
|---|---------|-----------|---------|
| 1 | HR KPI 리뉴얼 | 전체 통합 | 총 인원, 이직률, 평균 근속, 급여 총액, 채용 진행, 온보딩 완료율 |
| 2 | 인력 분석 | Employee + Assignment | 직급 분포, 법인별 인원, 입사/퇴사 추이 |
| 3 | 급여 분석 | GP#3 PayrollRun | 법인/부서별 인건비 추이, 수당 비중, 전월 변동 |
| 4 | 성과 분석 | GP#4 PerformanceReview | 등급 분포 vs 가이드라인, Overdue 비율, 캘리브레이션 조정률 |
| 5 | 근태 분석 | Attendance | 초과근무 추이, 52h 위반, 법인별 비교 |
| 6 | 이직 분석 | GP#2 ExitInterview | 퇴직 사유 분류, 부서별 이직률, 익명 통계 |
| 7 | 팀 건강 | 복합 지표 | 근태+성과+이직위험+번아웃+휴가사용률 |

**추천 모델:** Opus

---

### Session G-2 — 예측 분석 + AI 리포트

| # | 항목 | 설명 |
|---|------|------|
| 1 | 이직 예측 개선 | ExitInterview 사유 + 성과등급(B) + Compa-Ratio 하위 반영 |
| 2 | 번아웃 감지 | 초과근무 3개월 연속 45h+ / 연차 미사용 80%+ / 성과 하락 복합 |
| 3 | AI 리포트 | 법인/부서별 월간 자동 생성: 변동 + 위험 신호 + 추천 액션 |
| 4 | 퇴직 면담 익명 리포트 | 5건+ 자동 집계. 사유 파이차트 + 트렌드 + 만족도 추이 |

**추천 모델:** Opus

---

## Phase 4: 설정

> **목표:** 하드코딩 정책값 → UI에서 직접 수정.
> **스펙:** `CTR_SETTINGS_DESIGN_SPEC_v1_1.md`

---

### Session H-1 — Settings 프레임워크 + 급여/근태

| # | 항목 | 설명 |
|---|------|------|
| 1 | Settings 허브 (`/settings`) | 6개 카테고리 카드 3×2 그리드 + 검색바 |
| 2 | 서브페이지 프레임워크 | 좌측 사이드탭 + 우측 폼 + 상단 법인 드롭다운 + 브레드크럼 |
| 3 | 법인 오버라이드 UX | 🔵 글로벌 기본값 / 🟠 법인 커스텀 + [되돌리기]. 글로벌 고정: 자물쇠 |
| 4 | 글로벌 변경 확인 모달 | 영향 법인 + 인원수 표시 |
| 5 | TODO 주석 수거 | `grep -rn "TODO: Move to Settings" src/` 전체 추출 |
| 6 | 근태/휴가 설정 | 근무 스케줄, 주간 한도(52h→DB), 교대, 휴가 유형, 부여 규칙, 이월, 마이너스 ON/OFF, 공휴일, 초과근무 배율, 사전 신청, 연속 상한 |
| 7 | 급여/보상 설정 | 급여 항목, 공제 항목, 비과세 한도(→DB), 급여일, 통화, 계정과목 매핑 |
| 8 | 변경 이력 | who/when/before/after + Settings 전용 탭 |
| 9 | 3단계 권한 | SUPER_ADMIN: 전체. HR_ADMIN: 자기 법인. 나머지: 미노출 |
| 10 | 즉시 발효 원칙 | 기본 즉시. 예외(평가 주기/등급): 현재 주기 완료 후 적용 |

**추천 모델:** Opus

---

### Session H-2 — 성과/채용/시스템 + 법인 오버라이드

| # | 항목 | 설명 |
|---|------|------|
| 1 | 성과/평가 설정 | 평가 주기, MBO:BEI 비중(레벨별/법인별), 등급 체계, 배분 가이드라인, 체크인 모드, 동료평가 ON/OFF |
| 2 | **인상률 매트릭스 에디터** | 등급×밴드 위치→인상률. 셀 편집. 법인별 다른 매트릭스 |
| 3 | 채용/온보딩 설정 | 파이프라인 단계, 평가 항목, AI 스크리닝, 온보딩/오프보딩 템플릿, 수습 평가 시점 |
| 4 | 시스템 설정 | 알림 채널, 알림 규칙, 언어, 타임존, 감사 로그, GDPR |
| 5 | Integrations | Teams 웹훅, ERP 연동, 이벤트 로그 |
| 6 | 오버라이드 요약 | 법인별 커스텀 건수 일람 |
| 7 | 의존성 검증 | 저장 시 충돌 자동 감지 (평가 주기↔MBO 기간 등) |
| 8 | 설정 복제 | "CTR-VN → CTR-IN 복제" |

**추천 모델:** Opus

---

## Phase 5: 프로덕션 레디

> **목표:** 1,000+ 유저 환경 안정 동작.
> **왜 마지막:** 기능 완료 후 일괄 최적화 = 재작업 최소화.

---

### Session I-1 — SWR 전환 (force-dynamic 대체)

**Gemini ISR 제안 거부 → SWR 접근:**

| # | 항목 | 설명 |
|---|------|------|
| 1 | 페이지 셸 static | 레이아웃/사이드바/헤더 → CDN 캐시 |
| 2 | 데이터 SWR | 서버 데이터 페칭 → `useSWR` 클라이언트 사이드 |
| 3 | force-dynamic 제거 | `(dashboard)/layout.tsx` |
| 4 | Skeleton UI | SWR 로딩 중 WidgetSkeleton |
| 5 | 에러 핸들링 | 바운더리 + 재시도 |

**추천 모델:** Sonnet — 반복 패턴

---

### Session I-2 — Supabase Realtime + Active Employee 헬퍼

**Gemini Prisma Global Filter 거부 → 헬퍼 접근:**

| # | 항목 | 설명 |
|---|------|------|
| 1 | Realtime 알림 | 60초 폴링 → WebSocket |
| 2 | Task Hub Realtime | 승인 즉시 반영 |
| 3 | `buildActiveFilter(companyId)` | 재직자만 (endDate: null + isPrimary) |
| 4 | `buildAllFilter(companyId)` | 이력 조회용 (퇴직자 포함) |
| 5 | 점진적 마이그레이션 | 320+ 라우트 중 주요 곳부터 |

**추천 모델:** Sonnet

---

### Session I-3 — RLS 정책

| # | 항목 | 설명 |
|---|------|------|
| 1 | RLS 설계 | 법인별 데이터 격리 |
| 2 | 주요 테이블 적용 | Employee, PayrollItem, LeaveRequest, PerformanceReview, ExitInterview 등 |
| 3 | 역할 기반 | SUPER_ADMIN: 전체, HR_ADMIN: 자기 법인, MANAGER: 팀원, EMPLOYEE: 본인 |
| 4 | resolveCompanyId 정합성 | 앱 레벨 + DB 레벨 이중 방어 |

**추천 모델:** Opus

---

## 의존성 그래프

```
Session E-1 (온보딩)        ← 즉시 시작 가능 ★
    │
Session E-2 (오프보딩)      ← E-1 (공유 인프라)
    │
Session E-3 (QA)           ← E-2
    │
Session F-1 (Task Hub)     ← E-3 (5매퍼 데이터)
    │
Session F-2 (Delegation)   ← F-1 (순차 권장)
    │
Session F-3 (GP#1 보강)    ← F-2 (Delegation Nudge)
    │
인사이트 설계              ← F-3
    │
Session G-1~G-2            ← 설계
    │
Session H-1~H-2            ← G-2
    │
Session I-1~I-3            ← H-2
```

---

## 세션별 추천 모델

| 세션 | 모델 | 근거 |
|------|------|------|
| E-1 (온보딩) | **Opus** | 이벤트+상태머신+템플릿+UI 복합 |
| E-2 (오프보딩) | **Opus** | 데이터 격리+자산 공제+급여 연동 |
| E-3 (QA) | **Sonnet** | 반복적 QA+번역 |
| F-1 (Task Hub) | **Opus** | API Aggregation+5매퍼+역할 필터 |
| F-2 (Delegation) | **Opus** | 권한 체계 전반 |
| F-3 (GP#1 보강) | **Opus** | 마이너스 연차+취소+대시보드 |
| G-1 (인사이트) | **Opus** | 복합 집계+차트 |
| G-2 (예측/AI) | **Opus** | AI 분석 로직 |
| H-1 (Settings 1) | **Opus** | 프레임워크+DB 전환 |
| H-2 (Settings 2) | **Opus** | 매트릭스 에디터 |
| I-1 (SWR) | **Sonnet** | 반복 패턴 |
| I-2 (Realtime) | **Sonnet** | 정형 작업 |
| I-3 (RLS) | **Opus** | 데이터 모델 전체 이해 |

---

## 마일스톤

| 시점 | 상태 | 의미 |
|------|------|------|
| **Phase 1 완료** | GP#1~4 전부 100% | "모든 기능이 있다" |
| **Phase 2 완료** | Task Hub + Delegation + GP#1 보강 | **"유저가 실제로 쓸 수 있다"** ← 내부 데모 가능 |
| **Phase 3 완료** | 인사이트 대시보드 | "데이터 기반 의사결정" |
| **Phase 4 완료** | Settings | **"HR이 직접 운영"** |
| **Phase 5 완료** | 성능 + 보안 | **"프로덕션 런칭"** |

---

## 부록: GP별 갭 요약

### GP#1 Leave — 6건 (Phase 2 F-3)

| 갭 | 해소 시점 |
|----|----------|
| Delegation | F-2 (공통 인프라) |
| 마이너스 연차 | F-3 |
| 취소 세분화 | F-3 |
| HR 대시보드 강화 | F-3 |
| 사전 신청/연속 상한 | F-3 |
| Nudge 3종 | F-3 |

### GP#3 Payroll — ✅ 갭 없음
### GP#4 Performance — ✅ 갭 없음 (D 완료)

### GP#2 Onboarding/Offboarding — 풀 구현 (Phase 1 E-1~E-3)

| 온보딩 미구현 | 오프보딩 미구현 |
|-------------|--------------|
| 마일스톤 태스크 (Day 1/7/30/90) | 퇴직일 역산 체크리스트 |
| BLOCKED 깃발 | 퇴직 유형 분기 (5가지) |
| 동적 Nudge | M365 차단 (수동 fallback) |
| 매니저 Sign-off | 퇴직 면담 + 데이터 격리 |
| 감정 체크인 | 미반납 자산 공제 |
| ATS → 온보딩 | 급여 정산 연동 |
| 크로스보딩 (TRANSFER) | BLOCKED + 12시간 Nudge |

### Gemini 제안 대비 결정

| Gemini | 우리 | 사유 |
|--------|------|------|
| ISR + revalidateTag | **SWR** | 개인화 대시보드에 ISR 부적합 |
| Prisma Global Filter | **헬퍼 표준화** | 이력 조회 깨뜨림 |
| Supabase Realtime | **동의** | UX 개선 |
| Wiring만 | **풀 구현** | 백엔드도 미구현 |
| 인사이트 미언급 | **Phase 3 독립** | 파이프라인 데이터 연결 필수 |

---

> **다음 액션:** Session E-1 (GP#2 온보딩) 프롬프트 작성
