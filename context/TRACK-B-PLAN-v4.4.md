# Track B: CTR 실제 조직도 반영 — 최종 실행 계획 v4.4

> **작성일:** 2026-03-20
> **버전:** v4.4 FINAL (v4.3 + Flex/Lemonbase 5건 + RBAC 방어 4건)
> **목적:** 실제 CTR 그룹 2,500명 데이터 마이그레이션 시 문제 없는 시스템 구축
> **원칙:** 급하지 않음. 가장 안전하고 확실한 방법으로.
> **총 예상:** ~57h (Phase 1: 19h, Phase 2: 7h, Phase 3: 21.5h, Phase 3.5: 5h, Phase 4: 4.5h)

---

## 변경 이력

| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1 | 03-19 | 초안 (조직도 분석 기반) |
| v2 | 03-19 | 코드 스캔 전 설계 |
| v3 | 03-20 | 코드 스캔 결과 반영 + Gemini 1~3차 패치 10건 |
| v4 | 03-20 | 코드 실사 스캔 10건 + Gemini 4차 나비효과 4건 추가. 총 패치 18건 |
| v4.1 | 03-20 | Gemini 5차 계획 평가 반영: B-1a+ 검증 이연, B-3g 보안 3중 체크, B-1h 매핑 함수 확정 |
| v4.2 | 03-20 | 운영 자립 2건: B-3l 겸직 Admin UI, B-5a CSV Import UI |
| v4.3 | 03-20 | Workday 관점 4건: 전적 정책, 국가별 연차, 겸직 연차 차감, 근속 기산일 |
| v4.4 | 03-20 | Flex/Lemonbase 관점 5건: 급여 스코프 확정(국내 직접/해외 데이터 연동), 근태 법인별 상한, 알림 locale, 평가 주기/등급 법인별 |
| **v4.4** | **03-20** | **RBAC/권한 방어 4건 보강: Location 권한 소속, CSV Import SUPER_ADMIN 제한, 해외 급여 Upload 전용 권한, Dotted Line UI 버튼 숨김. FINAL** |

### v4.4 RBAC/권한 방어 보강 (4건, 추가 공수 0h — 기존 항목에 지침 추가)

| # | 항목 | 위험 | 반영 위치 |
|---|------|------|---------|
| R-1 | WorkLocation API 권한 소속 미지정 | Location CRUD를 아무나 호출 가능 | **B-2d에 RBAC 가드 명시** |
| R-2 | CSV Import가 HR_ADMIN에게 열리면 글로벌 데이터 대참사 | 446~2,500명 한 방에 변경 가능 | **B-5a에 SUPER_ADMIN 제한 명시** |
| R-3 | 해외 HR_ADMIN이 급여 계산 엔진 실행 가능 | 국가별 세법 미지원 상태에서 잘못된 계산 | **B-3j에 해외 Upload 전용 권한 명시** |
| R-4 | Dotted Line 직원에 액션 버튼 렌더링 → 403 팝업 UX 파괴 | 백엔드만 막고 프론트 미처리 | **B-3i에 프론트엔드 버튼 숨김 명시** |

### v4.3 → v4.4 변경 사항 (Flex/Lemonbase 관점)

| # | 항목 | 성격 | 추가 공수 | 반영 위치 |
|---|------|------|---------|---------|
| F-1 | 해외법인 급여 스코프 확정 | 정책 확정 | 0h | **정책 문서 추가** |
| F-2 | 근태 주간 상한 법인별 Setting | Settings 키 추가 | B-1f에 포함 | **B-1f 체크리스트** |
| F-3 | 알림/이메일 수신자 locale | 필드 확인/추가 | 최대 0.5h | **Phase 2 B-2b 보강** |
| F-4 | 평가 주기 법인별 | 필드 확인 | 최대 0.5h | **B-1f 체크리스트** |
| F-5 | 평가 등급 법인별 | Settings 확인 | 0h | **B-1f 체크리스트** |

**급여 스코프 최종 결정:**
- 국내법인(CTR-HOLD, CTR, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML): **HR Hub 급여 모듈 직접 처리**
- 해외법인(CTR-CN, CTR-US, CTR-VN, CTR-RU, CTR-EU): **로컬 시스템(현지 회계사무소/ERP) 처리, HR Hub는 데이터 연동만**

---

## 누적 패치 목록 (총 42건)

| # | 패치 | 출처 | 반영 위치 | 상태 |
|---|------|------|---------|------|
| G1-1 | N+1 쿼리 폭탄 → 이원화 헬퍼 | Gemini 1차 | B-3a | 설계 완료 |
| G1-2 | Worker Type 파편화 → resolveWorkerType() SSOT | Gemini 1차 | B-1f | 설계 완료 |
| G1-3 | 70:30 평가 복잡도 → 배포 후 2차 | Gemini 1차 | B-3f | 정책 확정 |
| G1-4 | isPrimary 무결성 → Append-Only 강제 | Gemini 1차 | B-3e | 설계 완료 |
| G2-5 | RLS vs 매트릭스 충돌 → Dotted READ-ONLY | Gemini 2차 | B-3g | 설계 완료 |
| G2-6 | 겸직자 결재 꼬임 → Primary reportsTo 고정 | Gemini 2차 | B-3h | 설계 완료 |
| G2-7 | PII Git 커밋 → import 스크립트 분리 | Gemini 2차 | B-1g | 설계 완료 |
| G2-8 | 비용 정산 → Out of Scope (ERP) | Gemini 2차 | 정책 | 확정 |
| G3-9 | Effective Dating → effectiveDate <= now | Gemini 3차 | B-3a | 설계 완료 |
| G3-10 | Cost Center → costCenterCode 필드 예약 | Gemini 3차 | B-2e | 설계 완료 |
| C-1 | Auth 세션 companyId → Primary Assignment 기준 | 코드 실사 | B-1a+ | v4 |
| C-2 | Seed 27파일 전수 치환 (시간 상향) | 코드 실사 | B-1a | v4 |
| C-3 | employmentType enum 통일 | 코드 실사 | B-1h | v4 |
| C-4 | RLS withRLS() 우회 방식 → 옵션 A 확정 | 코드 실사 | B-3g | v4 |
| C-5 | resolveCompanyId() 보호 파일 → 미수정 (옵션 A) | 코드 실사 | B-3g | v4 |
| C-6 | assignments[0] 실제 56파일 72건 | 코드 실사 | B-3c~d | v4 |
| C-7 | Org Studio 하드코딩 → API 전환 | 코드 실사 | B-1i | v4 |
| C-8 | 캐시 고아 → Redis flush | 코드 실사 | B-1a | v4 |
| C-9 | E2E 테스트 계정 동기화 | 코드 실사 | B-1a | v4 |
| C-10 | Manager Hub dotted line 미표시 | 코드 실사 | B-3i | v4 |
| G4-1 | 타 법인 API 접근 시 Assignment 검증 | Gemini 4차 | B-3g | v4 |
| G4-2 | Payroll 겸직자 급여 중복 방지 | Gemini 4차 | B-3j | v4 |
| G4-3 | 미래 입사자 Pre-hire 안내 화면 | Gemini 4차 | B-3k | v4 |
| G4-4 | Location별 공휴일 → Out of Scope + Setting 예약 | Gemini 4차 | B-2c | v4 |
| G5-1 | B-1a+ 검증 타이밍 — Phase 1에서 겸직 테스트 불가 | Gemini 5차 | Phase 1 Regression | v4.1 |
| G5-2 | B-3g 우회 API 보안 3중 체크 필요 | Gemini 5차 | B-3g | v4.1 |
| G5-3 | B-1h enum 통일 → 매핑 함수 확정 | Gemini 5차 | B-1h | v4.1 |
| OP-1 | 겸직 Admin UI 없으면 HR Admin 운영 불가 | 운영 자립 | B-3l | v4.2 |
| OP-2 | 대량 인사이동 CLI만으로는 HR팀 자립 불가 | 운영 자립 | B-5a | v4.2 |
| OP-3 | 법인 신설 원스톱 → 배포 후 2차 | 운영 자립 | 정책 | v4.2 |
| W-1 | 법인 간 전적(Entity Transfer) 정책 문서화 | Workday | B-1j | v4.3 |
| W-2 | 국가별 연차 정책 + Settings 확인 | Workday | B-1f | v4.3 |
| W-3 | 겸직자 연차 차감 → Primary 기준 확정 | Workday | B-3h | v4.3 |
| W-4 | 근속년수 기산일 → groupHireDate/companyHireDate 확인 | Workday | B-1f | v4.3 |
| **F-1** | **해외 급여 = 로컬 처리 + 데이터 연동** | **Flex** | **정책** | **v4.4** |
| **F-2** | **근태 주간 상한 법인별 Setting** | **Flex** | **B-1f** | **v4.4** |
| **F-3** | **알림/이메일 수신자 locale** | **Flex** | **B-2b** | **v4.4** |
| **F-4** | **평가 주기 법인별 (PerformanceCycle.companyId)** | **Lemonbase** | **B-1f** | **v4.4** |
| **R-1** | **WorkLocation API → MODULE.ORGANIZATION + ACTION.MANAGE 권한 가드** | **RBAC 체크** | **B-2d** | **v4.4** |
| **R-2** | **CSV Import → SUPER_ADMIN 전용 제한** | **RBAC 체크** | **B-5a** | **v4.4** |
| **R-3** | **해외법인 HR_ADMIN → 급여 Upload만 허용, 계산 엔진 차단** | **RBAC 체크** | **B-3j** | **v4.4** |
| **R-4** | **Dotted Line 직원 → 프론트엔드 액션 버튼 숨김 처리** | **RBAC 체크** | **B-3i** | **v4.4** |

---

## 확정된 의사결정 (v4.4 FINAL)

| 항목 | 결정 |
|------|------|
| 배포 범위 | 전 계열사 동시 (~2,500명), 13개 법인 |
| CTR-MX | 삭제 → CTR-US Location(몬테레이)으로 전환 |
| 매트릭스 보고 | 필수 — dottedLinePositionId 이미 구현됨 |
| 겸직 | 필수 — isPrimary 이미 구현됨, 56파일 코드 패치 필요 |
| 직원 유형 | 4종 — FULL_TIME(관리직+생산직), DISPATCH(파견직), CONTRACT(계약직) |
| 유형별 기능 | Settings로 제어 (법인별 override 가능) |
| 직위 vs 직책 | 독립 2축 (JobGrade=직위, Position.title=직책) |
| 해외 직급 | 법인별 별도 — JobGrade.companyId 이미 있음 |
| 70:30 평가 | 배포 후 2차. Dotted=Peer Review로 우회 |
| 겸직자 결재 | Primary Assignment reportsTo에게만 |
| 겸직자 연차 | **Primary Assignment 법인에서만 관리/차감** |
| 겸직자 비용 정산 | Out of Scope (ERP 수동 전표) |
| 실데이터 PII | Git 커밋 금지, 별도 import 스크립트 |
| Cost Center | Department.costCenterCode 필드 예약 (값은 비움) |
| 공휴일 캘린더 | 법인(Company) 기준. Location별은 Out of Scope + Setting 예약 |
| RLS 크로스-법인 | 옵션 A — API 레벨 우회 + 앱 체크. RLS 정책 자체 미수정 |
| resolveCompanyId() | 미수정 — 보호 파일 유지. 별도 경로로 우회 |
| 겸직 Admin UI | Phase 3에 포함 — HR Admin 운영 자립 필수 |
| 대량 인사이동 | Phase 3.5에 포함 — Phase 4 시뮬레이션의 첫 검증 대상 |
| 법인 신설 원스톱 | 배포 후 2차 — 실 사례 기반 체크리스트 정의 후 자동화 |
| **급여 모듈 스코프** | **국내법인 7개 = HR Hub 직접 처리. 해외법인 6개 = 로컬 시스템 처리 + HR Hub 데이터 연동** |
| **전적(Entity Transfer)** | **정책 문서화 필수 (연차 이관, 급여 연속성, 근속 통산 — 대표님 확인)** |
| **근속년수 기산일** | **groupHireDate(그룹 최초) + companyHireDate(현 법인) 분리 — 스키마 확인 후 필요 시 추가** |
| **Location API 권한** | **MODULE.ORGANIZATION + ACTION.MANAGE (HR_ADMIN 이상). Permission Seed 반영 필수** |
| **CSV Import 권한** | **SUPER_ADMIN 전용. requireRole(['SUPER_ADMIN']) 하드코딩. 일반 HR_ADMIN 접근 불가** |
| **해외 급여 권한** | **해외법인 HR_ADMIN은 Upload(연동)만 가능. 계산 엔진(POST /calculate) 차단 — company.country 체크** |
| **Dotted Line UI** | **타 법인 직원(session.companyId ≠ employee.companyId)의 액션 버튼은 프론트엔드에서 렌더링 제외** |

---

## 아키텍처 의사결정 상세

### AD-1: Auth 세션 companyId 결정 로직

**문제:** `loadEmployeePermissions()`이 `EmployeeRole.findFirst({ orderBy: startDate desc })`로 가장 최근 역할의 companyId를 세션에 저장. 겸직자의 경우 Primary Assignment 회사와 세션 companyId 불일치 가능.

**결정:** Phase 1에서 즉시 수정 (B-1a+)
- 세션 companyId = Primary Assignment의 companyId (항상)
- 단일 assignment 직원에게는 영향 없음 (Primary가 유일하므로)
- Phase 3에서 겸직 seed 들어올 때 이미 안전한 상태

**코드 변경:**
```typescript
// AS-IS: 가장 최근 역할 기준
const role = await prisma.employeeRole.findFirst({
  where: { employeeId },
  orderBy: { startDate: 'desc' }
})

// TO-BE: Primary Assignment 기준
const primaryAssignment = await prisma.employeeAssignment.findFirst({
  where: { employeeId, isPrimary: true, endDate: null }
})
// primaryAssignment.companyId를 세션에 저장
```

### AD-2: RLS 크로스-법인 접근 방식

**문제:** `withRLS()` 트랜잭션 내에서는 `current_company_id()` 단일 값으로 격리. DB 레벨에서 타 법인 데이터 쿼리 자체가 차단됨.

**결정:** 옵션 A — API 레벨 우회
- Dotted Line 관련 API 3~4개만 `withRLS()` 밖에서 실행
- 앱 코드에서 READ-ONLY 체크
- `resolveCompanyId()` 보호 파일은 미수정
- RLS 정책에 예외 조건 추가하지 않음 (보안 + 성능 유지)

**적용 API 목록:**
| API | 용도 | 접근 수준 |
|-----|------|---------|
| Manager Hub 직원 목록 | Dotted Line 직원 포함 조회 | READ-ONLY |
| Org Tree 조회 | 타 법인 점선 표시 | READ-ONLY |
| Performance 피드백 조회 | Dotted Manager 피드백 열람 | READ-ONLY |

**적용 제외 (RLS 유지):**
- 급여 조회/수정
- Employee 개인정보 수정/삭제
- Leave 승인
- Attendance 수정

**🔴 우회 API 보안 3중 체크 (G5-2):**
우회 API에 접근하려면 아래 3개 조건을 AND로 전부 충족해야 함:
1. 호출자 역할 MANAGER 이상
2. 호출자가 dottedLinePositionId 보유 또는 타 법인 Secondary Assignment 보유
3. 요청 대상 직원이 호출자의 dotted line 또는 secondary 관계에 해당
→ 미충족 시 기존 `withRLS()` 경로 fallback (타 법인 데이터 차단)

**검증 체크리스트:**
```
□ Dotted Manager → Manager Hub에서 타 법인 직원 보임 (READ)
□ Dotted Manager → 타 법인 직원 급여 조회 → 403
□ Dotted Manager → 타 법인 직원 수정 → 403
□ 해당 법인 HR Admin → 자기 법인 직원 전체 권한 유지
□ 🔴 일반 EMPLOYEE → 우회 API → 타 법인 데이터 안 보임
□ 🔴 MANAGER + dotted 없음 → 우회 API → 타 법인 데이터 안 보임
```

### AD-3: 미래 입사자(Pre-hire) 처리

**문제:** `effectiveDate <= now` 필터 적용 시, 미래 발령 입사자가 로그인하면 `extractPrimaryAssignment()` → `undefined` → 500 에러

**결정:** Pre-hire 안내 화면으로 우아하게 처리 (Phase 3 B-3k)
- 위치: 대시보드 레이아웃 컴포넌트 (미들웨어가 아님)
- 로그인 자체는 허용 (프로필, 온보딩 체크리스트 접근 가능)
- assignment가 없는 상태에서 접근하는 모듈별 API는 적절한 에러 메시지 반환
- "발령일이 도래하지 않았습니다. [발령일]에 다시 접근해 주세요." 안내

### AD-4: 공휴일 캘린더 기준

**문제:** CTR-US 법인 아래 디트로이트(미국)와 몬테레이(멕시코) — 국경일이 다름

**결정:** Out of Scope + Setting 예약
- 현재: 법인(Company) 기준 달력으로 통일
- Settings에 `holiday_calendar_basis` 키 추가, 기본값 `COMPANY`
- 향후 `LOCATION`으로 변경하면 Location별 캘린더 적용 가능
- 디트로이트/몬테레이 차이는 근태 담당자 매뉴얼 조정
- 시스템 다중 국가 캘린더 자동화는 배포 후 2차

### AD-5: 운영 자립 도구 (v4.2)

**문제:** Seed로 최초 데이터 로딩 후, 조직 변경을 HR Admin이 직접 할 수 있어야 함.

**결정 3건:**
| 항목 | 결정 | 근거 |
|------|------|------|
| 겸직 Admin UI | Phase 3에 포함 (B-3l, 3h) | B-3e seed 이후 운영 UI 없으면 실제 겸직 발령 불가 |
| CSV Import UI | Phase 3.5로 추가 (B-5a, 5h) | Phase 4 시뮬레이션을 이 UI로 돌려서 Import UI 자체를 검증 |
| 법인 신설 원스톱 | 배포 후 2차 | 연 1~2회 발생. 첫 실제 신설 사례에서 체크리스트 정의 후 자동화 |

### AD-6: 급여 모듈 스코프 (v4.4 신규)

**문제:** 해외법인의 급여 계산은 국가별로 완전히 다름 (한국 4대보험 / 중국 五险一金 / 미국 FICA+State Tax / 멕시코 ISR+IMSS 등). HR Hub 하나로 전 법인 급여를 커버하려면 국가별 급여 엔진이 필요 — Track B 범위 초과.

**결정:**
```
국내법인 7개 (CTR-HOLD, CTR, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML)
  → HR Hub 급여 모듈 직접 처리 (한국 4대보험 + 소득세)

해외법인 6개 (CTR-CN, CTR-US, CTR-VN, CTR-RU, CTR-EU, + CTR-US 몬테레이)
  → 로컬 시스템 처리 (현지 회계사무소 또는 ERP)
  → HR Hub는 데이터 연동만 (급여 명세 표시용)
```

**데이터 연동 방식:**
- 해외법인 급여 데이터 → CSV 또는 API로 HR Hub에 업로드
- Employee 급여 이력에 `source: 'LOCAL'` 플래그로 구분
- HR Hub에서는 조회만 가능 (수정/계산 불가)
- 연동 주기: 월 1회 (급여 확정 후)

**영향:**
- B-3j(Payroll isPrimary 필터)는 국내법인 Payroll Run에만 적용
- 해외법인 직원은 Payroll Run 대상에서 자동 제외 (급여 모듈 접근 시 "로컬 시스템 처리" 안내)
- Phase 4 검증에 해외법인 급여 데이터 연동 테스트 항목 추가 (B-4h)

### AD-7: 법인 간 전적 정책 (v4.3~4.4)

**문제:** 겸직(concurrent)은 잡혀있지만, 전적(permanent transfer)의 연차/급여/근속 처리가 미정.

**결정:** 정책 문서화 (Phase 1 B-1j) — 대표님 확인 3건 필요

| 항목 | 선택지 | 추천 |
|------|--------|------|
| 연차 잔여일수 | A) 이관 B) 소멸+재산정 C) 정산(현금)+재산정 | 대표님 확인 |
| 급여 이력 연속성 | A) 통산 B) 법인별 분리 | 대표님 확인 |
| 근속년수 | A) 그룹 통산 B) 법인별 리셋 | 대표님 확인 (한국법상 통산이 일반적) |

**코드 영향:** 정책 확정 후 기존 Assignment CRUD로 처리 가능. 전적 = 기존 assignment 종료 + 신규 assignment 생성 (Append-Only).

---

## 전체 실행 순서

```
[완료] P1 Fix 2건 ✅
[완료] F-i18n 검증 ✅
[완료] Code Scan ✅
[완료] 코드 실사 스캔 + Gemini 4차 크로스리뷰 ✅
   │
   ▼
[Phase 1] 안전 작업 — 스키마 변경 없이 데이터 + Auth + 정책 (~19h)
   │
   ├── B-1a:  법인 코드/명칭 + 27개 seed 전수 치환 + Redis + E2E  [2.5h, Opus]
   ├── B-1a+: Auth 세션 companyId → Primary Assignment 기준       [1h, Opus]
   ├── B-1b:  부서 체계 재설계 (~195개)                            [3h, Opus]
   ├── B-1c:  JobGrade 확장 (한국 7단계 + 해외 placeholder)        [1h, Sonnet]
   ├── B-1d:  Position Tree 재설계 (보고라인 + dotted line)        [3h, Opus]
   ├── B-1e:  직원 데이터 재배치 (법인별 446명)                     [2h, Opus]
   ├── B-1f:  Worker Type Settings + resolveWorkerType()           [1.5h, Sonnet]
   │          + 🔍 국가별 연차 정책 Settings 확인 (W-2)
   │          + 🔍 근속 기산일 필드 확인 — groupHireDate/companyHireDate (W-4)
   │          + 🔍 근태 주간 상한 법인별 Setting 확인 (F-2)
   │          + 🔍 PerformanceCycle.companyId 확인 (F-4)
   │          + 🔍 평가 등급 법인별 Settings 확인 (F-5)
   ├── B-1g:  실데이터 import 스크립트 설계                         [0.5h, Sonnet]
   ├── B-1h:  employmentType enum 통일 (ATS↔Employee)             [1h, Sonnet]
   ├── B-1i:  Org Studio 하드코딩 → API 호출 전환                  [1.5h, Opus]
   ├── B-1j:  전적(Entity Transfer) 정책 문서화                    [0.5h] ← v4.3 신규
   └── ────:  Mini Regression                                     [1h]
   │
   ├── ✅ 검증: Core CRUD + Org Tree + Seed Count + Auth 세션 + Settings 키 확인
   ├── ✅ git tag: track-b-phase1
   │
   ▼
[Phase 2] 스키마 변경 — Location 모델 + Cost Center + locale (~7h)
   │
   ├── B-2a:  WorkLocation 모델 설계 + prisma 스키마               [2h, Opus]
   ├── B-2b:  Company/Employee/Assignment에 locationId 연결        [1.5h, Sonnet]
   │          + 🔍 Employee.preferredLocale 확인/추가 (F-3)
   │          + 🔍 서버 사이드 알림/이메일 수신자 locale 적용 확인
   ├── B-2c:  Location seed + holiday_calendar_basis Setting       [1h, Sonnet]
   ├── B-2d:  Location API + UI 기본 지원                          [2h, Opus]
   │          + 🔴 RBAC: MODULE.ORGANIZATION + ACTION.MANAGE 권한 가드 (R-1)
   └── B-2e:  Department.costCenterCode 필드 추가                  [0.5h, Sonnet]
   │
   ├── ✅ 검증: tsc + build + Location API + Employee API + locale 확인
   ├── ✅ git tag: track-b-phase2
   │
   ▼
[Phase 3] 고위험 — 겸직 패치 + 매트릭스 + 방어 + 운영 UI (~21.5h)
   │
   ├── B-3a:  56파일 72건 패턴 전수 분석 + 헬퍼 이원화 설계         [1.5h, Opus]
   ├── B-3b:  패치 전략 수립 (일괄 스크립트 vs 수동)                [0.5h]
   ├── B-3c:  패치 Batch 1 — 핵심 25파일                          [3.5h, Opus]
   ├── B-3d:  패치 Batch 2 — 나머지 31파일                        [3h, Opus]
   ├── B-3e:  겸직 seed (Append-Only 원칙)                        [1h, Sonnet]
   ├── B-3f:  Performance 매트릭스 (데이터 연결만, 로직 2차)         [0.5h, Sonnet]
   ├── B-3g:  크로스-법인 READ 허용 — 옵션 A 구현                  [3h, Opus]
   │          (API 우회 + Assignment 기반 접근 검증 + 보안 3중 체크)
   ├── B-3h:  겸직자 결재 + 연차 차감 Primary 고정                  [1h, Sonnet]
   │          결재: Primary reportsTo에게만
   │          연차: Primary Assignment 법인에서만 관리/차감 (W-3)
   ├── B-3i:  Manager Hub dotted line 직원 목록 추가               [1.5h, Opus]
   │          + 🔴 프론트엔드: 타 법인 직원 액션 버튼 숨김 처리 (R-4)
   ├── B-3j:  급여 모듈 isPrimary 필터 강제 + 중복 방지 검증        [0.5h, Sonnet]
   │          ※ 국내법인 Payroll Run에만 적용. 해외법인은 급여 모듈 대상 제외 (AD-6)
   │          + 🔴 해외법인 HR_ADMIN: Upload만 허용, 계산 엔진 차단 (R-3)
   ├── B-3k:  Pre-hire 안내 화면 + assignment undefined 방어       [1h, Opus]
   ├── B-3l:  겸직 Assignment 추가/종료 Admin UI                   [3h, Opus] ← v4.2 신규
   │          - Employee 상세 → Assignment 탭에 "겸직 추가" 버튼
   │          - isPrimary: false로 Secondary 생성
   │          - 기존 createAssignment() 재활용 + UI 분기만
   └── ────:  Full Regression + 겸직 시나리오 6가지                [1.5h]
   │
   ├── ✅ 검증: 112+ tests + 겸직 + 매트릭스 + 급여 + Pre-hire + 겸직 Admin UI
   ├── ✅ git tag: track-b-phase3
   │
   ▼
[Phase 3.5] 대량 Import UI (~5h) ← v4.2 신규
   │
   ├── B-5a:  대량 인사이동 CSV Import UI                          [5h, Opus]
   │          - Admin Settings → "일괄 인사이동" 메뉴
   │          - CSV 업로드 → Preview → Confirm 3단계
   │          - 부서/직책/법인 변경 지원
   │          - 신규 직원 일괄 등록도 지원
   │          - Append-Only 원칙 준수 (기존 assignment 종료 + 신규 생성)
   │          - 🔴 SUPER_ADMIN 전용 — HR_ADMIN 접근 불가 (R-2)
   └── ────:  Import UI 자체 검증 (소규모 테스트 CSV)               [포함]
   │
   ├── ✅ 검증: CSV 10명 테스트 → 정상 반영 확인
   ├── ✅ git tag: track-b-phase3.5
   │
   ▼
[Phase 4] 마이그레이션 시뮬레이션 검증 (~4.5h)
   │  ※ B-5a CSV Import UI를 사용하여 446명 투입 → Import UI의 실전 검증 겸용
   │
   ├── B-4a:  Full Regression 재실행                               [1h]
   ├── B-4b:  겸직자 시나리오 (이동옥 3 assignment 등)              [0.5h]
   ├── B-4c:  매트릭스 평가 시나리오                                [0.5h]
   ├── B-4d:  Worker Type 기능 제한 테스트                          [0.5h]
   ├── B-4e:  Location 구분 테스트 (디트로이트/몬테레이)             [0.5h]
   ├── B-4f:  전 법인 Org Tree 정합성                               [0.5h]
   ├── B-4g:  해외법인 별도 직급 테스트                              [0.5h]
   └── B-4h:  해외법인 급여 데이터 연동 테스트                       [0.5h] ← v4.4 신규
   │          - 로컬 급여 CSV → HR Hub 업로드
   │          - source: 'LOCAL' 표시 확인
   │          - 조회 가능 / 수정 불가 확인
   │
   ├── ✅ git tag: track-b-complete
   │
   ▼
[QF 마무리]
   ├── F-UX (실제 조직도 데이터로 테스트)
   ├── F-Smoke
   └── 🚀 배포 준비 완료
```

---

## Phase 1: 안전 작업 (19h)

> 스키마 변경 없음. Seed 데이터 교체 + Auth 로직 수정 + Org Studio 정비 + 정책 확정.
> Phase 1 완료 후 겸직 없이도 13개 법인 + 195개 부서 + 446명이 정상 동작해야 함.

### B-1a: 법인 코드/명칭 업데이트 (2.5h, Opus)

**범위:**
- Company 테이블의 code/name/parentCompanyId 변경
- 27개 seed 파일 전수 문자열 치환 (Node.js 스크립트)
- Redis 전체 flush (고아 캐시 방지)
- E2E 테스트 계정 동기화 (`e2e/helpers/auth.ts`)

**법인 코드 변경 매핑:**
| 현재 | → 변경 | 법인명 |
|------|--------|--------|
| CTR-HQ | **CTR-HOLD** | CTR홀딩스 |
| CTR-KR | **CTR** | CTR (주) |
| CTR-ENG | **CTR-ENR** | CTR에너지 |
| FML | **CTR-FML** | 포메이션랩스 |
| CTR-MX | **삭제** | → CTR-US Location |

**parentCompanyId 계층:**
```
CTR-HOLD (지주회사)
├── CTR (자동차 본업)
│   ├── CTR-MOB
│   ├── CTR-ECO
│   ├── CTR-CN
│   ├── CTR-US (+몬테레이)
│   ├── CTR-VN
│   ├── CTR-RU
│   └── CTR-EU
├── CTR-ROB
├── CTR-ENR
└── CTR-FML
```

**Seed 치환 스크립트 패턴:**
```
'CTR-HQ'  → 'CTR-HOLD'  (전 파일)
'CTR-KR'  → 'CTR'        (전 파일)
'CTR-ENG' → 'CTR-ENR'    (전 파일)
'FML'     → 'CTR-FML'    (전 파일)
CTR-MX 참조 → CTR-US로 통합 또는 제거
```

**DO NOT TOUCH:**
- prisma/schema.prisma (스키마 변경 없음)
- src/lib/api/companyFilter.ts (보호 파일)
- src/middleware.ts

---

### B-1a+: Auth 세션 companyId 수정 (1h, Opus)

> 🔴 코드 실사 C-1 + Gemini 4차 G4-1 대응

**문제:** `loadEmployeePermissions()`이 `EmployeeRole.findFirst({ orderBy: startDate desc })`로 세션 companyId 결정. 겸직자의 Secondary가 더 최근이면 세션 오염.

**수정:**
- `src/lib/auth.ts` — `loadEmployeePermissions()` 수정
- 세션 companyId = Primary Assignment(`isPrimary: true, endDate: null`)의 companyId
- Primary가 없는 경우(Pre-hire 등) → 기존 로직 fallback (가장 최근 역할)

**검증:**
```
□ 단일 assignment 직원 로그인 → 세션 companyId 정상
□ 역할 없는 직원 로그인 → 기존 에러 처리 유지
⏳ 겸직자 로그인 → Phase 3 B-3e seed 후 검증 (Phase 1에서는 겸직 데이터 없어 테스트 불가)
```

**DO NOT TOUCH:**
- NextAuth 설정 파일 (providers, callbacks 구조)
- middleware.ts
- 기존 RBAC 로직 (역할 판단은 그대로)

---

### B-1b: 부서 체계 재설계 (3h, Opus)

**현재:** CTR-KR에 4개 부서만 (MGMT, HR, DEV, SALES)
**목표:** 13개 법인 × 조직도 기반 ~195개 실제 부서

**부서 level 체계:**
| level | 한글 | 영문 |
|-------|------|------|
| 1 | 사업부문 | Business Unit |
| 2 | 본부 / 공장 | Division / Plant |
| 3 | 실 | Section |
| 4 | 팀 | Team |
| 5 | 파트 | Part |

**법인별 부서 수:**
| 법인 | 부서 수 | 주요 구조 |
|------|--------|---------|
| CTR-HOLD | ~12 | 경영관리본부/컴플라이언스본부/BTS본부 + 하위팀 |
| CTR (OE) | ~50 | 6본부 + 4공장 + 하위팀 |
| CTR (AM) | ~25 | CCO/CDO/CMO/COO + 지역팀 + R&D센터 |
| CTR-MOB | ~30 | 연구개발/영업/경영관리/구매/재무/품질 + 3공장 |
| CTR-ECO | ~15 | 영업/연구/구매 + 밀양공장 |
| CTR-ROB | ~12 | 경영지원/시스템사업/기술 본부 |
| CTR-ENR | ~7 | 신재생에너지사업본부 + 6파트 |
| CTR-FML | ~6 | CEO 직속 5팀 |
| CTR-CN | ~15 | 경영/연구/영업/구매/품질 + 장가항공장 |
| CTR-US | ~10 | CFO/PM/Sales/SCM + 몬테레이공장 |
| CTR-VN | ~8 | COO V + R&D + 마케팅 |
| CTR-RU | ~3 | 마케팅/영업 |
| CTR-EU | ~2 | 법인만 (조직 미정) |

**상세 부서 데이터:** `CTR-OrgStructure-HRHub-Plan.md` 섹션 7 참조

**DO NOT TOUCH:**
- Department 모델 스키마 (기존 parentId + level 구조 그대로 사용)
- 다른 법인의 기존 seed 로직

---

### B-1c: JobGrade 확장 (1h, Sonnet)

**한국 직급 (companyId = NULL → 글로벌 기본):**
| Code | 한글 | 영문 |
|------|------|------|
| G0 | 회장 | Chairman |
| G1 | 경영리더 | Management Leader |
| G2 | 전문리더 | Expert Leader |
| G3 | 책임매니저 | Senior Manager |
| G4 | 매니저 | Manager |
| G5 | 책임연구원 | Senior Engineer |
| G6 | 연구원 | Engineer |

**해외법인:** 각 법인별 companyId로 3~5단계 placeholder seed

---

### B-1d: Position Tree 재설계 (3h, Opus)

**직책 유형:**
| titleKo | titleEn | 대응 부서 level |
|---------|---------|--------------|
| 대표이사 | CEO | 법인 전체 |
| 사업부문장 | Head of Business Unit | 1 |
| 본부장 | Division Director | 2 |
| 공장장 | Plant Manager | 2 |
| 센터장 | Director of the Center | 2 |
| 실장 | Section Leader | 3 |
| 팀장 | Team Leader | 4 |
| 파트장 | Part Leader | 5 |
| 팀원 | Team Member | — |

**Dotted Line 사례 (dottedLinePositionId):**
| Position | Solid Line | Dotted Line |
|----------|-----------|-------------|
| 대합공장 팀장들 | CTR모빌리티 대표 | OE 사업부문장 (엄용일) |
| CTR-CN 팀장들 | CTR CHINA 총경리 | CTR 해당 본부장 |
| CTR-US 팀장들 | CTR AMERICA 법인장 | CTR 해당 본부장 |
| CTR-VN 팀장들 | CTR VINA COO | AM 사업부문장 |

---

### B-1e: 직원 데이터 재배치 (2h, Opus)

**법인별 인원:**
| 법인 | 관리직 | 생산직 | 파견직 | 계약직 | 합계 |
|------|--------|--------|--------|--------|------|
| CTR-HOLD | 30 | 0 | 0 | 0 | 30 |
| CTR (OE+AM) | 50 | 50 | 10 | 10 | 120 |
| CTR-MOB | 20 | 30 | 5 | 5 | 60 |
| CTR-ECO | 8 | 12 | 3 | 2 | 25 |
| CTR-ROB | 39 | 0 | 0 | 2 | 41 |
| CTR-ENR | 15 | 0 | 0 | 0 | 15 |
| CTR-FML | 15 | 0 | 0 | 0 | 15 |
| CTR-CN | 15 | 25 | 5 | 5 | 50 |
| CTR-US+MX | 10 | 15 | 3 | 2 | 30 |
| CTR-VN | 12 | 20 | 5 | 3 | 40 |
| CTR-RU | 8 | 0 | 0 | 2 | 10 |
| CTR-EU | 10 | 0 | 0 | 0 | 10 |
| **합계** | **232** | **152** | **31** | **31** | **446** |

**EmploymentType + jobCategory 매핑:**
```
관리직 → employmentType: FULL_TIME, jobCategory: OFFICE
생산직 → employmentType: FULL_TIME, jobCategory: PRODUCTION
파견직 → employmentType: DISPATCH
계약직 → employmentType: CONTRACT, contractType: FIXED_TERM
```

**전 직원 최소 EMPLOYEE 역할 배정** (현재 42명 역할 없음 → 0)

---

### B-1f: Worker Type Settings + resolveWorkerType() + 법인별 정책 확인 (1.5h, Sonnet)

> 🔴 Gemini 1차 G1-2 + Workday W-2/W-4 + Flex F-2/F-4/F-5 대응

**SSOT 헬퍼:**
```typescript
// src/lib/employee/worker-type-resolver.ts
type WorkerType = 'OFFICE' | 'PRODUCTION' | 'DISPATCH' | 'CONTRACT'

export function resolveWorkerType(assignment: {
  employmentType: string
  jobCategoryId?: string | null
  contractType?: string | null
}): WorkerType {
  if (assignment.employmentType === 'DISPATCH') return 'DISPATCH'
  if (assignment.employmentType === 'CONTRACT') return 'CONTRACT'
  if (assignment.jobCategoryId === 'PRODUCTION') return 'PRODUCTION'
  return 'OFFICE'
}
```

**ProcessSettings 추가 키 (category: 'worker-type'):**
| Key | Default | 설명 |
|-----|---------|------|
| `FULL_TIME.OFFICE.performance.enabled` | `true` | 관리직 성과평가 |
| `FULL_TIME.PRODUCTION.performance.enabled` | `false` | 생산직 성과평가 (off) |
| `DISPATCH.performance.enabled` | `false` | 파견직 성과평가 |
| `CONTRACT.performance.enabled` | `true` | 계약직 성과평가 |
| `DISPATCH.leave.enabled` | `false` | 파견직 연차 |
| `DISPATCH.payroll.enabled` | `false` | 파견직 급여 |
| `DISPATCH.benefits.enabled` | `false` | 파견직 복리후생 |
| `DISPATCH.attendance.enabled` | `true` | 파견직 출퇴근 |
| `DISPATCH.training.enabled` | `true` | 파견직 교육 |

**🔍 Phase 1에서 반드시 확인할 체크리스트 (W-2/W-4/F-2/F-4/F-5):**
```
□ Leave 모듈: leave.accrual.policy 키가 법인별 override 가능한지 확인
  - 한국 15일 / 중국 5~15일(근속별) / 베트남 12일 / 미국 회사정책 / 멕시코 12일+
  → 안 되면 Settings 키 추가

□ 근속 기산일: Employee 모델에 groupHireDate + companyHireDate 분리 여부 확인
  - 연차 계산(중국 등)에 근속이 입력값으로 필요
  → 없으면 Phase 2에서 nullable 필드 추가

□ 근태 주간 상한: attendance.weekly_hour_limit 키가 법인별 override 가능한지 확인
  - 한국 52h / 중국 44h / 베트남 48h / 미국 FLSA exempt/non-exempt
  → 안 되면 Settings 키 추가

□ 평가 주기: PerformanceCycle에 companyId가 있는지 확인
  - 법인별 별도 평가 주기(반기/분기) 지원 필요
  → 없으면 Phase 2에서 nullable companyId 추가

□ 평가 등급: 등급 체계가 법인별 Settings로 override 가능한지 확인
  - 한국 S/A/B/C/D vs 해외 Exceeds/Meets/Below
  → 안 되면 Settings 키 추가
```

---

### B-1g: 실데이터 import 스크립트 설계 (0.5h, Sonnet)

> 🔴 Gemini 2차 G2-7 대응

```
scripts/import-prod-migration.ts  — Git 추적됨 (코드만)
data/prod-employees.csv           — .gitignore (실데이터)
data/prod-departments.csv         — .gitignore
```

---

### B-1h: employmentType enum 통일 (1h, Sonnet)

> 🔴 코드 실사 C-3 / Gemini 5차 G5-3: 매핑 함수 방식 확정

**문제:**
- ATS Requisition: `'permanent' | 'contract' | 'intern'` (소문자)
- Employee/Assignment: `'FULL_TIME' | 'CONTRACT' | 'DISPATCH' | 'INTERN'` (대문자 Prisma enum)

**결정: 매핑 함수 방식 (스키마 통일 아님)**

```typescript
// src/lib/ats/employment-type-mapper.ts
function mapRequisitionTypeToEmploymentType(type: string): EmploymentType {
  const map: Record<string, EmploymentType> = {
    'permanent': 'FULL_TIME',
    'contract': 'CONTRACT',
    'intern': 'INTERN',
  }
  return map[type] ?? 'FULL_TIME'
}
```

**영향 파일:** ~5개 라우트 (ATS 관련, `convert-to-employee` 진입점)

---

### B-1i: Org Studio 하드코딩 제거 (1.5h, Opus)

> 🔴 코드 실사 C-7 대응

**수정 대상:**
1. `ImpactAnalysisPanel.tsx` — `totalHeadcount: 109`, `departmentCount: 12` → DB 조회 API 호출
2. `DraggableOrgTree.tsx` 59~172라인 — mock 데이터 → 실제 Org Tree API 호출

---

### B-1j: 전적(Entity Transfer) 정책 문서화 (0.5h)

> 🔴 Workday W-1 대응

**전적 = 겸직과 다른 시나리오:**
- 겸직: 동시에 여러 assignment 활성 (isPrimary + Secondary)
- 전적: A법인 assignment 종료 → B법인 assignment 신규 생성 (영구 이동)

**코드 처리:** 기존 Assignment CRUD + Append-Only로 충분
- 기존 assignment에 endDate 찍기
- 새 법인에 assignment 생성 (isPrimary: true)

**대표님 확인 필요 3건:**
| 항목 | 선택지 | 비고 |
|------|--------|------|
| 연차 잔여일수 | A) 이관 B) 소멸+재산정 C) 정산(현금)+재산정 | 한국법상 이관이 일반적이지만 해외→국내 등은 정책 필요 |
| 급여 이력 연속성 | A) 통산 B) 법인별 분리 | HR Hub 조회 시 전 법인 이력을 보여줄지 |
| 근속년수 | A) 그룹 통산 B) 법인별 리셋 | 한국법상 통산이 일반적. 퇴직금/연차/포상에 직결 |

**코드 영향:**
- 정책 확정 전: 아무것도 하지 않음 (기존 CRUD로 전적 자체는 가능)
- 정책 확정 후: Leave 모듈에 잔여일수 이관 로직 추가 가능 (배포 후도 OK)

---

### Phase 1 Mini Regression (1h)

```
□ tsc --noEmit PASS
□ npm run build PASS
□ 13개 법인 정상 조회
□ ~195개 부서 Org Tree 렌더링 (고아 0, 순환참조 0)
□ 4역할 로그인 (SA/HA/MG/EA) — 세션 companyId 정상
□ 446명 직원 목록 정상
□ Worker Type Settings 조회 정상
□ Org Studio ImpactAnalysis 실제 수치 표시
□ E2E smoke (auth 계정 동기화 확인)
□ 🔍 법인별 Settings override 확인 (연차/근태/평가)
⏳ 겸직자 Auth 세션 검증 → Phase 3 B-3e 이후로 이연
```

---

## Phase 2: Location 모델 + 스키마 보강 (7h)

### B-2a: WorkLocation 모델 (2h, Opus)

```prisma
model WorkLocation {
  id           String   @id @default(cuid())
  companyId    String
  company      Company  @relation(fields: [companyId], references: [id])
  code         String   // "DETROIT", "MONTERREY", "CHANGWON"
  name         String
  nameEn       String?
  country      String   // "US", "MX", "KR"
  city         String?
  timezone     String?
  address      String?
  locationType String?  // "OFFICE", "PLANT", "WAREHOUSE", "BRANCH_OFFICE"
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  employees    EmployeeAssignment[]

  @@unique([companyId, code])
  @@map("work_locations")
}
```

### B-2b: EmployeeAssignment에 locationId + preferredLocale 연결 (1.5h, Sonnet)

> 🔍 Flex F-3 대응 포함

```prisma
model EmployeeAssignment {
  // ... 기존 필드
  workLocationId  String?
  workLocation    WorkLocation? @relation(...)
}
```

**🔍 추가 확인:**
```
□ Employee 또는 User에 preferredLocale 필드 존재 여부
  → 없으면 추가: preferredLocale String? // 'ko' | 'en' | 'zh' | 'vi' | 'es'
□ 서버 사이드 알림/이메일 발송 시 수신자 locale로 렌더링하는지
  → next-intl 서버 사이드 지원 확인
  → 안 되면 알림 발송 함수에 locale 파라미터 추가
```

**기본값 매핑:**
| 법인 | 기본 locale |
|------|------------|
| 국내법인 전체 | ko |
| CTR-CN | zh |
| CTR-US | en |
| CTR-VN | vi |
| CTR-RU | en (러시아어 미지원) |
| CTR-EU | en |

### B-2c: Location Seed + holiday_calendar_basis Setting (1h, Sonnet)

**Location 데이터:**
| 법인 | Code | 이름 | 국가 | 타입 |
|------|------|------|------|------|
| CTR | CHANGWON | 창원공장 | KR | PLANT |
| CTR | MASAN | 마산공장 | KR | PLANT |
| CTR | YEONGSAN | 영산공장 | KR | PLANT |
| CTR | DAEHAP | 대합공장 | KR | PLANT |
| CTR | SANTIAGO | 산티아고 사무소 | CL | BRANCH_OFFICE |
| CTR | BANGKOK | 방콕 사무소 | TH | BRANCH_OFFICE |
| CTR | JAKARTA | 자카르타 사무소 | ID | BRANCH_OFFICE |
| CTR-MOB | ULSAN | 울산공장 | KR | PLANT |
| CTR-MOB | SEOSAN | 서산공장 | KR | PLANT |
| CTR-MOB | DAEGU | 대구공장 | KR | PLANT |
| CTR-ECO | MIRYANG | 밀양공장 | KR | PLANT |
| CTR-CN | ZHANGJIAGANG | 장가항공장 | CN | PLANT |
| CTR-US | DETROIT | 디트로이트 사무소 | US | OFFICE |
| CTR-US | MONTERREY | 몬테레이 공장 | MX | PLANT |
| CTR-VN | DANANG | 다낭 | VN | PLANT |

**추가 Setting:**
```
category: 'leave'
key: 'holiday_calendar_basis'
value: 'COMPANY'
description: 'COMPANY=법인 기준, LOCATION=근무지 기준 (미래)'
```

### B-2d: Location API + UI (2h, Opus)

> 🔴 RBAC R-1 대응

**권한 가드:**
- Location CRUD API에 `withPermission(MODULE.ORGANIZATION, ACTION.MANAGE)` 적용
- Permission Seed에 HR_ADMIN + SUPER_ADMIN에게 해당 권한 부여
- MANAGER, EMPLOYEE는 Location 조회(READ)만 가능

### B-2e: Department.costCenterCode (0.5h, Sonnet)

```prisma
model Department {
  // ... 기존 필드
  costCenterCode  String?  // ERP 연동용 비용센터 코드 (미래 대비)
}
```

---

## Phase 3: 겸직 패치 + 매트릭스 + 방어 + 운영 UI (21.5h)

> ⚠️ 가장 위험한 Phase. 56파일 72건 코드 패치 + 아키텍처 수준 변경 포함.
> 매 Batch 후 tsc + Mini Regression 필수.

### B-3a: 56파일 72건 분석 + 헬퍼 이원화 (1.5h, Opus)

> 🔴 Gemini 1차 G1-1 + 3차 G3-9 대응

**두 가지 헬퍼:**
```typescript
const now = new Date()

// 헬퍼 1: DB 조회용 (단일 직원 상세)
async function fetchPrimaryAssignment(employeeId: string) {
  return prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      endDate: null,
      effectiveDate: { lte: now }
    }
  })
}

// 헬퍼 2: 메모리 필터용 (리스트, include로 이미 로드된 배열)
function extractPrimaryAssignment(assignments: EmployeeAssignment[]) {
  const now = new Date()
  return assignments.find(
    a => a.isPrimary && !a.endDate && a.effectiveDate <= now
  ) ?? assignments[0]  // fallback
}
```

**56파일 분류:**
| 유형 | 파일 수 | 적용 헬퍼 |
|------|--------|---------|
| 리스트 API (include 사용) | ~30 | `extractPrimaryAssignment()` |
| 상세 API (단일 조회) | ~15 | `fetchPrimaryAssignment()` |
| 혼합/특수 | ~11 | 수동 판단 |

### B-3b: 패치 전략 수립 (0.5h)

### B-3c: 패치 Batch 1 — 핵심 25파일 (3.5h, Opus)

Employee detail, Attendance, Leave, Payroll, Performance 모듈.
매 10파일마다 `npx tsc --noEmit` 체크포인트.

### B-3d: 패치 Batch 2 — 나머지 31파일 (3h, Opus)

Teams, Directory, Analytics, Skills, CFR, Year-end 등.
매 10파일마다 체크포인트.

### B-3e: 겸직 Seed (Append-Only) (1h, Sonnet)

> 🔴 Gemini 1차 G1-4 대응

| 이름 | Primary | Secondary |
|------|---------|-----------|
| 이동옥 | CTR 대표이사 | CTR CFO, CTR-ECO CFO |
| 정병주 | CTR 품질경영팀장 | CTR-MOB 품질경영팀장(겸) |
| 이경수 | CTR-MOB 경영관리팀장 | EHS팀장(겸), 정보보안팀장(겸) |
| 방우영 | CTR SCM본부장 | OM팀 팀장(겸) |
| 한성욱 | CTR 재무회계팀장 | CTR-ECO 재무회계팀장(겸) |
| 박양원 | AM R&D센터장 | 설계팀V 팀장(겸) |

### B-3f: Performance 매트릭스 데이터 연결 (0.5h, Sonnet)

- ✅ dottedLinePositionId → Org Tree 점선 표시
- ✅ Manager Hub에 Solid + Dotted 양쪽 팀장에게 직원 보임
- ❌ 70:30 자동 가중 → 배포 후 2차
- Dotted Line Manager = Peer Review 형태 피드백만

### B-3g: 크로스-법인 READ 허용 — 옵션 A (3h, Opus)

> 🔴 Gemini 2차 G2-5 + 코드 실사 C-4/C-5 + Gemini 4차 G4-1 + Gemini 5차 G5-2 대응

**구현 방식:**
1. Dotted Line 관련 API 3~4개를 식별
2. 해당 API만 `withRLS()` 밖에서 실행
3. 앱 코드에서 `EmployeeAssignment` 테이블 조회 → 관계 검증
4. READ-ONLY만 허용 (수정/삭제/급여 → 403)
5. `resolveCompanyId()` 보호 파일 미수정

**🔴 보안 3중 체크 (필수 AND 조건):**
```
조건 1: 호출자 역할 MANAGER 이상
조건 2: 호출자가 dottedLinePositionId 보유 또는 타 법인 Secondary Assignment 보유
조건 3: 요청 대상 직원이 호출자의 dotted/secondary 관계에 해당
→ 3개 AND 전부 충족 시에만 READ-ONLY 데이터 반환
→ 1개라도 미충족 → withRLS() 경로로 fallback
```

**핵심 검증:**
```
□ CTR 본부장(dotted 보유) → Manager Hub에서 CTR-CN dotted 직원 보임 (READ)
□ CTR 본부장 → CTR-CN 직원 급여 조회 → 403
□ CTR 본부장 → CTR-CN 직원 수정 → 403
□ CTR-CN HR Admin → CTR-CN 전체 권한 유지
□ 이동옥(CTR Primary) → CTR-ECO Manager Hub 접근 가능 (Secondary)
□ 🔴 일반 EMPLOYEE → 우회 API → 타 법인 데이터 안 보임
□ 🔴 MANAGER + dotted/secondary 없음 → 타 법인 데이터 안 보임
□ 🔴 MANAGER + dotted 보유 → 관계 없는 직원 → 안 보임
```

### B-3h: 겸직자 결재 + 연차 차감 Primary 고정 (1h, Sonnet)

> 🔴 Gemini 2차 G2-6 + Workday W-3 대응

**결재:** Primary Assignment reportsTo에게만
- Leave/Attendance/Expense/Performance 결재 → Primary 상위자
- Secondary의 reportsTo는 결재 대상에서 명시적 제외

**연차 차감:** Primary Assignment 법인에서만 관리/차감
- 겸직자가 어느 법인 업무 중 연차를 쓰든, Primary 법인 잔여일수에서 차감
- Secondary 법인에 별도 연차 잔여일수 생성하지 않음

**검증:**
```
□ 한성욱(겸직) → 연차 → CTR(Primary) 상위자에게만
□ 이동옥(3 assignment) → 결재 → Primary 기준
□ Secondary 조직장 → 결재 inbox에 안 나타남
□ 한성욱 연차 조회 → CTR 잔여일수만 표시
□ CTR-ECO에서 한성욱 연차 잔여일수 → 표시 안 됨 (또는 "Primary 법인 관리" 안내)
```

### B-3i: Manager Hub dotted line 직원 목록 추가 (1.5h, Opus)

> 🔴 코드 실사 C-10 + RBAC R-4 대응

- `pending-approvals` API에 dotted line 직원 조회 추가
- Manager Hub UI에 "Solid Line Team" / "Dotted Line Team" 구분 표시
- Dotted Line 직원은 READ-ONLY 표시 (수정/결재 버튼 비활성)

**🔴 프론트엔드 액션 버튼 숨김 (R-4):**
- `session.companyId !== employee.companyId`인 경우 (Dotted로 가져온 타 법인 직원):
  - [평가 수정], [급여 탭], [연차 승인], [인사정보 수정] 등 액션 버튼을 렌더링 단계에서 **아예 숨김**
  - 조회용 UI(프로필 카드, 기본 정보)만 표시
  - 이유: 백엔드에서 403으로 막아도, 버튼이 보이면 매니저가 누르고 → 403 팝업 → UX 파괴
- Solid Line 직원(같은 법인)은 기존 동작 유지

### B-3j: 급여 모듈 isPrimary 필터 + 해외법인 제외 (0.5h, Sonnet)

> 🔴 Gemini 4차 G4-2 + Flex F-1 + RBAC R-3 대응

**국내법인 Payroll Run:**
```
WHERE companyId = ? AND isPrimary = true AND endDate IS NULL AND effectiveDate <= now
```

**해외법인:**
- Payroll Run 대상에서 자동 제외
- 급여 화면 접근 시 "로컬 시스템에서 처리됩니다" 안내
- 로컬 급여 데이터 연동 (조회 전용): source 필드로 구분

**🔴 해외법인 HR_ADMIN 권한 분리 (R-3):**
- 해외법인(company.country !== 'KR') HR_ADMIN:
  - ✅ 허용: 급여 데이터 Upload/연동 (`POST /api/v1/payroll/import`)
  - ❌ 차단: 급여 계산 엔진 실행 (`POST /api/v1/payroll/periods/[id]/calculate`)
- 구현 방식: 별도 RBAC ACTION 추가보다 **API에서 company.country 체크가 간결**
  ```typescript
  // calculate API 최상단
  if (company.country !== 'KR') {
    throw forbidden('해외법인은 로컬 시스템에서 급여를 처리합니다.')
  }
  ```
- 국내법인 HR_ADMIN: 기존 동작 유지 (계산 + 승인 + 조회 전부 가능)

**검증:**
```
□ CTR Payroll Run → 이동옥 포함 (Primary: CTR)
□ CTR-ECO Payroll Run → 이동옥 미포함 (Secondary)
□ CTR-CN Payroll Run → 실행 불가 또는 "로컬 처리" 안내
□ CTR-CN 직원 급여 조회 → 로컬 연동 데이터만 표시 (source: LOCAL)
□ 🔴 CTR-CN HR_ADMIN → POST /calculate → 403 (R-3)
□ 🔴 CTR-CN HR_ADMIN → POST /import → 200 (Upload 허용)
```

### B-3k: Pre-hire 안내 화면 (1h, Opus)

> 🔴 Gemini 4차 G4-3 대응

- 대시보드 레이아웃에서 assignment 존재 여부 체크
- 없으면 Pre-boarding 안내 화면 렌더링
- "발령일이 도래하지 않았습니다. [YYYY-MM-DD]에 다시 접근해 주세요."
- 프로필 조회, 온보딩 체크리스트 등 제한적 접근 허용
- 백엔드: 전 모듈 API에서 `assignment === undefined` 시 적절한 에러 (500 방지)

### B-3l: 겸직 Assignment 추가/종료 Admin UI (3h, Opus)

> 🔴 운영 자립 OP-1 대응

**위치:** Employee 상세 페이지 → Assignment 탭

**기능:**
1. **"겸직 추가" 버튼** → 모달
   - 법인 선택 (Company dropdown)
   - 부서 선택 (Department dropdown, 선택된 법인 기준)
   - 직책 선택 (Position dropdown)
   - 발령일 (effectiveDate)
   - isPrimary: false (자동 고정, UI에서 변경 불가)
2. **"겸직 종료" 버튼** → Secondary Assignment에 endDate 찍기
3. **"Primary 변경"** → 전적 시 사용. 기존 Primary 종료 + 새 Primary 생성

**재활용:** 기존 `createAssignment()` API + `updateAssignment()` API
**UI 분기:** isPrimary 여부에 따라 "종료" 버튼만 활성/비활성

**검증:**
```
□ HR Admin → 이동옥 상세 → Assignment 탭 → 3개 assignment 보임
□ HR Admin → "겸직 추가" → CTR-MOB 선택 → Secondary 생성 성공
□ HR Admin → Secondary "종료" → endDate 정상 반영
□ HR Admin → Primary "종료" → 경고 ("Primary는 전적 절차를 사용하세요")
□ 일반 직원 → Assignment 탭 → 조회만 가능 (추가/종료 버튼 없음)
```

---

### Phase 3 Full Regression (1.5h)

```
□ tsc --noEmit PASS
□ npm run build PASS
□ 112+ 기존 테스트 PASS
□ 겸직 시나리오 6가지 (이동옥, 정병주, 이경수, 방우영, 한성욱, 박양원)
□ 크로스-법인 보안 3중 체크 (8개 테스트 케이스)
□ 급여 중복 방지 (국내 4건 + 해외 제외 2건)
□ Pre-hire 안내 화면 (500 아님 확인)
□ 겸직 Admin UI (추가/종료/Primary 보호)
□ 겸직자 연차 차감 Primary 법인 확인
⏳ 겸직자 Auth 세션 검증 (Phase 1 이연분)
```

---

## Phase 3.5: 대량 Import UI (5h)

### B-5a: 대량 인사이동 CSV Import UI (5h, Opus)

> 🔴 운영 자립 OP-2 + RBAC R-2 대응

**🔴 권한: SUPER_ADMIN 전용 (R-2)**
- API: `requireRole(['SUPER_ADMIN'])` 하드코딩 — HR_ADMIN 접근 불가
- UI: 사이드바 메뉴 자체를 SUPER_ADMIN에게만 표시
- 이유: 446~2,500명의 부서/직책/법인을 한 방에 변경할 수 있는 파괴력. 일반 HR_ADMIN이 실수로 글로벌 데이터를 엎으면 대참사

**위치:** Admin Settings → "일괄 인사이동" 메뉴 (SUPER_ADMIN only)

**3단계 플로우:**

**Step 1: CSV 업로드**
- 템플릿 다운로드 버튼 (컬럼 설명 포함)
- 파일 드래그앤드롭 또는 선택
- 지원 작업 유형: 부서 변경, 직책 변경, 법인 변경(전적), 신규 등록, 퇴사 처리

**Step 2: Preview**
- 파싱 결과 테이블 표시
- 오류 행 빨간색 하이라이트 (없는 부서코드, 중복 사번 등)
- 변경 전/후 diff 표시 (현재값 → 새값)
- 오류 건수 / 정상 건수 요약

**Step 3: Confirm**
- "n건 반영합니다" 확인 다이얼로그
- Append-Only 원칙: 기존 assignment endDate 찍고 → 신규 생성
- 처리 결과 리포트 (성공/실패/스킵 건수)
- 결과 CSV 다운로드

**CSV 컬럼 예시:**
```csv
action,employeeCode,companyCode,departmentCode,positionCode,effectiveDate,isPrimary
TRANSFER,E001,CTR-MOB,DEV-DESIGN1,TL-DESIGN1,2026-04-01,true
NEW_HIRE,E500,CTR,HR-PC,TM-HR,2026-04-01,true
TERMINATE,,E123,,,2026-03-31,
ADD_SECONDARY,E001,CTR-ECO,QA-QM,TL-QM,2026-04-01,false
```

**검증 (Phase 3.5 내):**
```
□ 템플릿 다운로드 → 컬럼 설명 포함 CSV
□ 10명 테스트 CSV 업로드 → Preview 정상
□ 잘못된 부서코드 포함 → 오류 하이라이트
□ Confirm → 정상 반영 (DB 확인)
□ 결과 리포트 CSV 다운로드
□ 🔴 HR_ADMIN 로그인 → CSV Import 메뉴 안 보임 (R-2)
□ 🔴 HR_ADMIN → API 직접 호출 → 403 (R-2)
□ 🔴 SUPER_ADMIN → 정상 접근 + 실행 (R-2)
```

---

## Phase 4: 마이그레이션 시뮬레이션 검증 (4.5h)

> ※ B-5a CSV Import UI를 사용하여 446명 투입 → Import UI의 실전 검증 겸용

### 전체 체크리스트 (60가지)

**기본 건강 (4):**
```
□ tsc --noEmit PASS
□ npm run build PASS
□ 4역할 로그인 (SA/HA/MG/EA)
□ DB 연결 정상
```

**조직 구조 (6):**
```
□ 13개 법인 정상 조회
□ ~195개 부서 Org Tree 렌더링
□ 고아 부서 0개
□ 순환 참조 0개
□ Dotted line 점선 표시 (대합공장 등)
□ Location 필터 동작 (Detroit/Monterrey)
```

**겸직 (6):**
```
□ 이동옥 프로필 → 3개 assignment 표시
□ 이동옥 급여 → CTR(primary)에서만
□ 이동옥 Employee 목록 → 1명 카운트
□ 정병주 → CTR + CTR-MOB 양쪽 표시
□ 한성욱 → CTR + CTR-ECO 양쪽 표시
□ 겸직자 삭제 → 전체 assignment soft-delete
```

**Worker Type (6):**
```
□ 파견직 → 성과평가 API → 403
□ 파견직 → 출퇴근 API → 200
□ 파견직 → 연차 API → 403
□ 생산직 → 성과평가 → 403 (Settings off)
□ Settings 변경 후 → 200 전환
□ CTR-CN override → 해당 법인만 적용
```

**직급/직책 (4):**
```
□ CTR 직원 → 한국 직급 (경영리더 등)
□ CTR-CN 직원 → 해외 placeholder 직급
□ "팀장인데 경영리더" 표현 정상
□ 파트장 직책 표시
```

**성능 (2):**
```
□ 전 엔드포인트 < 1s (446명 기준)
□ Org Tree 렌더링 < 2s
```

**크로스-법인 매트릭스 + 보안 (7):**
```
□ CTR 본부장(dotted 보유) → Manager Hub에서 CTR-CN dotted 직원 READ
□ CTR 본부장 → CTR-CN 직원 급여 조회 → 403
□ CTR 본부장 → CTR-CN 직원 수정 → 403
□ CTR-CN HR Admin → CTR-CN 전체 권한 유지
□ 🔴 일반 EMPLOYEE → 우회 API → 타 법인 데이터 안 보임
□ 🔴 MANAGER + dotted/secondary 없음 → 타 법인 데이터 안 보임
□ 🔴 MANAGER + dotted 보유 → 관계 없는 직원 → 안 보임
```

**겸직자 Auth 세션 (Phase 1 이연분) (3):**
```
□ 이동옥(3 assignment) 로그인 → 세션 companyId = CTR (Primary)
□ 한성욱(CTR+CTR-ECO) 로그인 → 세션 companyId = CTR (Primary)
□ Secondary가 더 최근 생성이어도 Primary 법인으로 세션 고정 확인
```

**겸직자 결재 + 연차 (5):**
```
□ 한성욱(겸직) → 연차 → CTR(Primary) 상위자에게만
□ 이동옥(3 assignment) → 결재 → Primary 기준
□ Secondary 조직장 → 결재 inbox에 안 나타남
□ 한성욱 연차 잔여 → CTR에서만 표시
□ CTR-ECO에서 한성욱 연차 → 미표시 또는 "Primary 법인 관리" 안내
```

**급여 — 국내 + 해외 분리 (6):**
```
□ CTR Payroll → 이동옥 포함
□ CTR-ECO Payroll → 이동옥 미포함
□ CTR Payroll → 한성욱 포함
□ CTR-ECO Payroll → 한성욱 미포함
□ CTR-CN → Payroll Run 불가 또는 "로컬 처리" 안내
□ CTR-CN 직원 급여 조회 → 로컬 연동 데이터 표시 (source: LOCAL)
```

**Pre-hire (3):**
```
□ 미래 발령 직원 로그인 → Pre-boarding 안내 (500 아님)
□ 미래 발령 직원 → 프로필 조회 가능
□ 발령일 지난 후 → 정상 대시보드 표시
```

**🔴 RBAC 권한 방어 (8):**
```
□ Location CRUD API → EMPLOYEE 호출 → 403 (R-1)
□ Location CRUD API → HR_ADMIN 호출 → 200 (R-1)
□ CSV Import API → HR_ADMIN 호출 → 403 (R-2)
□ CSV Import API → SUPER_ADMIN 호출 → 200 (R-2)
□ CTR-CN HR_ADMIN → POST /calculate → 403 "로컬 처리" (R-3)
□ CTR-CN HR_ADMIN → POST /import → 200 Upload 허용 (R-3)
□ Dotted Line 직원(타 법인) → Manager Hub에서 액션 버튼 안 보임 (R-4)
□ Solid Line 직원(같은 법인) → Manager Hub에서 액션 버튼 정상 표시 (R-4)
```

---

## 대표님 확인 대기 사항 (v4.4 업데이트)

| # | 항목 | 상태 | 필요 시점 |
|---|------|------|---------|
| 1 | 해외법인 실제 직급 체계 | 대표님이 추후 제공 | Phase 1 B-1c (placeholder 가능) |
| 2 | CTR-EU (폴란드) 조직 구조 | 미정 | Phase 1 B-1b (법인만 등록) |
| 3 | 법인별 실제 인원수 | 조직도 기반 추정 사용 | Phase 1 B-1e |
| **4** | **전적 시 연차 잔여일수 처리** | **미정** | **Phase 1 B-1j (정책 문서화)** |
| **5** | **전적 시 급여 이력 연속성** | **미정** | **Phase 1 B-1j** |
| **6** | **전적 시 근속년수 통산 여부** | **미정** | **Phase 1 B-1j** |

**블로커 없음** — 6건 모두 placeholder/추정값/정책 미확정 상태로 진행 가능. 확정 시 반영.

---

## 정책 문서 (확정, v4.4 FINAL)

### 급여 모듈 스코프
> **국내법인 7개** (CTR-HOLD, CTR, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML): HR Hub 급여 모듈 직접 처리
> **해외법인 6개** (CTR-CN, CTR-US, CTR-VN, CTR-RU, CTR-EU + 몬테레이): 로컬 시스템 처리, HR Hub는 데이터 연동만 (조회 전용)
> 해외 급여 연동 주기: 월 1회 (급여 확정 후 CSV/API 업로드)

### 겸직자 결재 + 연차
> 결재: Primary Assignment reportsTo에게만 (Leave/Attendance/Expense/Performance)
> 연차: Primary Assignment 법인에서만 관리/차감. Secondary 법인에 별도 잔여일수 없음.
> 급여: Primary Assignment 법인에서만 지급 (국내). 해외 Secondary는 로컬 처리.

### 겸직자 비용 정산 (Out of Scope)
> HR Hub 범위: 급여 명세서 생성 (Primary Assignment 법인 기준)
> HR Hub 범위 밖: 겸직자 인건비의 법인간 비용 전가 (Cross-charging)
> → ERP/재무팀이 월말 전표(Journal Entry)로 수동 조정

### 전적(Entity Transfer) 정책 (대표님 확인 대기)
> 코드 처리: 기존 assignment endDate → 신규 assignment 생성 (Append-Only)
> 연차/급여/근속 정책: 대표님 확인 후 확정. 코드 영향 최소 (정책 확정 후 반영 가능)

### 공휴일 캘린더 (법인 기준)
> 현재: 법인(Company) 기준 달력으로 통일
> Location별 캘린더 자동화: 배포 후 2차
> 임시 대응: 근태 담당자 매뉴얼 조정 (디트로이트/몬테레이 차이)
> 시스템 확장 포인트: `holiday_calendar_basis` Setting

### 매트릭스 평가 (배포 후 2차)
> 현재: Solid Line Manager 100% 평가. Dotted = Peer Review 피드백만.
> 배포 후: "매트릭스 평가 모드" Settings on → 70:30 가중치 활성화

### 법인 신설 원스톱 (배포 후 2차)
> 연 1~2회 발생. Settings 항목이 계속 늘어나는 중.
> 첫 실제 신설 사례에서 체크리스트 정의 → 자동화.

---

## 시간 요약

| Phase | 항목 수 | 시간 | 위험도 |
|-------|---------|------|--------|
| Phase 1 | 11개 + Regression | 19h | 🟢 SAFE |
| Phase 2 | 5개 | 7h | 🟡 MEDIUM |
| Phase 3 | 12개 + Regression | 21.5h | 🔴 HIGH |
| Phase 3.5 | 1개 | 5h | 🟡 MEDIUM |
| Phase 4 | 8개 (60 체크) | 4.5h | 🟢 검증 |
| **합계** | **37개 항목** | **57h** | |

---

## 리뷰 이력

| 리뷰어 | 관점 | 지적 건수 | 반영 |
|--------|------|---------|------|
| Gemini 1차 | 아키텍처 | 4건 | G1-1~4 |
| Gemini 2차 | 보안/정합성 | 4건 | G2-5~8 |
| Gemini 3차 | 시간축/비용 | 2건 | G3-9~10 |
| 코드 실사 | 실제 코드 기반 | 10건 | C-1~10 |
| Gemini 4차 | 나비효과 | 4건 | G4-1~4 |
| Gemini 5차 | 계획 평가 | 3건 | G5-1~3 |
| 운영 자립 검토 | HR Admin 자립 | 3건 | OP-1~3 |
| Workday 관점 | 글로벌 HR 표준 | 4건 | W-1~4 |
| **Flex/Lemonbase 관점** | **근태/급여/성과 운영** | **5건** | **F-1~5** |
| **RBAC/권한 체크** | **권한 누락 방어** | **4건** | **R-1~4** |
| **합계** | | **43건** | **42건 반영 + 1건 확인만(F-5)** |
