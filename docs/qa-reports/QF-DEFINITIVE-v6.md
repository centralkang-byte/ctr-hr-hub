# QF-DEFINITIVE v6: Two-Track QA 최종 전략

> **v5.1 → v6 변경:**
> - Phase A 전체 + Phase B 완료 반영 (P0 35건 Fix, ~429 endpoints 테스트)
> - Phase S 전면 재설계: S-0 감사 완료 → S-Fix 7세션 신설 → S-1/S-2 후순위로
> - S-Fix Common Rules 추가 (Gemini 크로스리뷰 3+2건 반영)
> - Post-launch 제외 항목 명시
> - 세션 배분 및 타임라인 업데이트
>
> **기준 데이터:** API 526 routes, UI 148 pages, Settings 44 tabs (43 Active + 1 Stub)
> **최종 수정일:** 2026-03-18

---

## 1. 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                    QF-DEFINITIVE v6                           │
│                                                              │
│  Track 1: CRUD + 안전성 검증            Track 2: UX/UI 감사  │
│  ┌──────────────────────────┐         ┌──────────────────┐   │
│  │ Claude Code Desktop      │         │ Antigravity      │   │
│  │ (Opus / Sonnet)          │         │ Browser          │   │
│  │                          │         │                  │   │
│  │ Phase A: Core CRUD    ✅ │         │ • 실제 렌더링    │   │
│  │ Phase B: Analytics+AI ✅ │         │ • 스크린샷 비교  │   │
│  │ Phase S: Settings     🔄 │         │ • DOM Style 추출 │   │
│  │ Phase C: Cross-Cut       │         │ • 모바일 반응형  │   │
│  │ Phase E: Edge+Safety     │         │ • i18n 시각 검증 │   │
│  └──────────────────────────┘         └──────────────────┘   │
│                                                              │
│  29 Runs (22 기존 + 7 S-Fix)          8 Runs                 │
│  ~12시간                              ~3시간 (병렬 ~1h)      │
└──────────────────────────────────────────────────────────────┘
                    총 37 Runs, ~13시간
```

---

## 2. 전체 진행 현황

### ✅ 완료된 Phase

| Phase | Runs | P0 Fix | P1 | P2 | Endpoints | 상태 |
|-------|------|--------|----|----|-----------|------|
| **Pre-Run** | 1 | 0 | 0 | 0 | — | ✅ 완료 |
| **Phase 0** | 1 | 0 | 6 | 0 | 43 queries | ✅ COND. PASS |
| **Phase A** (세션 1~5) | 13 | 31 | 13 | 29 | ~363 | ✅ 완료 |
| **Phase B** (세션 6) | 2 | 4 | 2 | 13 | ~66 | ✅ 완료 |
| **S-0 Pre-flight** | 1 | 0 | 0 | 0 | — | ✅ 완료 |
| **S-0 Audit** | 1 | 0 | 0 | 0 | — | ✅ Blueprint 산출 |
| **S-Fix-1** | 1 | 2 bugs | 9 Zod | 1 bug | — | ✅ PASS |
| **S-Fix-2** | 1 | 14 seeds | 9 fn | — | — | ✅ PASS |
| **누적** | **21** | **37+** | **24+** | **43+** | **~429** | — |

### 🔄 진행 중: Phase S (Settings 완전 정복)

| 세션 | 테마 | 모델 | 시간 | 상태 |
|------|------|------|------|------|
| ~~S-Fix-1~~ | 버그 Fix + Zod 전수 | Sonnet | 35min | ✅ 완료 |
| ~~S-Fix-2~~ | 근로시간 + 최저임금 → Settings | Opus | 30min | ✅ 완료 |
| **S-Fix-3** | OT 배율 → Settings + overtime 탭 | Opus | 40min | **← 다음** |
| S-Fix-4 | 수습기간 + 휴가유형 seed | Sonnet | 30min | 프롬프트 미작성 |
| S-Fix-5 | 시스템 임계값 | Sonnet | 30min | 프롬프트 미작성 |
| S-Fix-6 | Aguinaldo + PL 공제 + 세션 타임아웃 | Opus | 50min | 프롬프트 미작성 |
| S-Fix-7 | Audit Trail + 탭 연동 spot check | Opus | 40min | 프롬프트 미작성 |

### 🔲 대기 중

| Phase | Runs | 선행 조건 |
|-------|------|----------|
| **S-1** Settings CRUD Part 1 (24탭) | 1 | S-Fix 전체 완료 |
| **S-2** Settings CRUD Part 2 (20탭) | 1 | S-Fix 전체 완료 |
| **C-1** Security & RBAC | 1 | Phase A Fix 완료 (✅) |
| **C-2** Cross-Module Integration | 1 | Phase A Fix 완료 (✅) |
| **E-1** Edge Cases & Safety | 1 | C-1, C-2 완료 |
| **E-2** Performance & Audit | 1 | C-1, C-2 완료 |
| **UX-1~8** UI/UX 감사 | 8 | 모든 Fix 완료 |

---

## 3. Phase S: Settings 완전 정복 — 상세 설계

### 왜 7세션이 필요한가

S-0 감사에서 발견된 핵심 문제: **한국만 Settings 기반, 나머지 5개국은 코드에 하드코딩.**

```
lib/labor/
  kr.ts    ← Settings에서 읽음 (FromSettings) ✅
  cn.ts    ← laborConfig 상수 하드코딩 ⚠️
  us.ts    ← laborConfig 상수 하드코딩 ⚠️
  vn.ts    ← laborConfig 상수 하드코딩 ⚠️  (+ "India OT" 라벨 → S-Fix-1에서 수정)
  mx.ts    ← laborConfig 상수 하드코딩 ⚠️
  ru.ts    ← 터키 데이터 버그 🔴 → S-Fix-1에서 수정 완료
  eu.ts    ← laborConfig 상수 하드코딩 ⚠️
```

S-Fix는 이 구조를 "모든 국가가 DB Settings에서 읽고, 코드 배포 없이 값 변경 가능"으로 전환합니다.

### S-0 감사 결과 수치

| 항목 | Pre-flight 추정 | S-0 실제 |
|------|----------------|---------|
| FromSettings 함수 | 15 | **16** (확인, +1 dispatcher) |
| Stub 탭 | 19 | **1** (overtime만 — Pre-flight 대폭 과대평가) |
| 하드코딩 값 | ~45 | **32** 확인 |
| 미구현 기능 | ~18 | **4** 확인 |
| P0 Gap | — | **8건** (6개국 근로시간 + RU 버그 + PL 공제) |
| P1 Gap | — | **15건** |
| P2 Gap | — | **8건** |

### 의존성 그래프

```
S-Fix-1 (버그/Zod) ──┐                          ✅ 완료
                      ├──→ S-Fix-3 (OT배율+탭)
S-Fix-2 (근로시간)  ──┘    ✅ 완료   ↓            ← 다음
                           ──→ S-Fix-6 (Aguinaldo+PL)
S-Fix-4 (수습/휴가) ────────────────────────────── (독립)
S-Fix-5 (시스템 임계값) ───────────────────────── (독립)
S-Fix-7 (Audit+spot check) ← 모든 S-Fix 완료 후
                              ↓
                         S-1 / S-2 CRUD 전수 검증
```

### S-Fix 세션별 상세

#### S-Fix-1: 긴급 버그 + Settings Zod 검증 전수 ✅ 완료

| 결과 | 값 |
|------|---|
| Bug-1 RU→Turkey | ✅ 러시아 값으로 교체 |
| Bug-2 VN "India OT" | ✅ Vietnam으로 수정 |
| Zod 추가 | 25/35 → **34/35** (97%) |
| companyId 자동감지 | **6 핸들러** 통일 (evaluation, compensation, promotion) |
| 보너스 Fix | approval-flows 주석 버그 발견/수정 |

#### S-Fix-2: 6개국 근로시간 한도 + 최저임금 → Settings ✅ 완료

| 결과 | 값 |
|------|---|
| 새 파일 | `lib/labor/settings.ts` — 공통 FromSettings 2개 함수 |
| 국가별 async 래퍼 | 7개 (`get*LaborConfigFromSettings`) |
| Seed | 14건 (7 work-hour-limits + 7 min-wage, 법인별) |
| 설계 결정 | sync LaborModule 인터페이스 유지 + async 함수 병행 |
| tsc | PASS |
| ⚠️ 확인 필요 | US maxWeekly=45 (FLSA는 40) → S-Fix-3에서 수정 |

#### S-Fix-3: OT 배율 → Settings + Overtime 탭 ← 프롬프트 작성 완료

| 작업 | 내용 |
|------|------|
| `getOvertimeRatesFromSettings()` | 7개국 OT 배율 (평일/주말/공휴일/야간) |
| calculator 연결 | `laborConfig.overtime_rates` → FromSettings 호출로 교체 |
| overtime 탭 구현 | 유일한 stub → active (rate 테이블 + 야간시간 설정) |
| Seed | 7건 per-company OT rates |
| US maxWeekly 수정 | 45 → 40 (FLSA 준수) |

#### S-Fix-4: 조직 설정 — 수습기간 + 휴가유형

| 작업 | 내용 |
|------|------|
| `getProbationRulesFromSettings()` | 6개국 수습기간 (CN: 직급별 1~6개월) |
| `contract/rules.ts` 연결 | 하드코딩 상수 → FromSettings |
| 법정 휴가유형 seed | 6개국 출산/육아/경조 등 `LeaveTypeDef` 추가 |

#### S-Fix-5: 시스템 설정 — 임계값

| 작업 | 내용 |
|------|------|
| 넛지 규칙 | 리마인더 주기/반복/최대 → `SYSTEM/nudge-rules` |
| 액션 우선순위 | 긴급/중요 분류 기준 → `SYSTEM/alert-thresholds` |
| 분석 점수 경계 | 이탈위험/팀건강 스코어 → `SYSTEM/analytics-thresholds` |

#### S-Fix-6: 누락 기능 — Aguinaldo + PL 공제 + 세션 타임아웃

| 작업 | 내용 |
|------|------|
| Aguinaldo | 멕시코 LFT Art.87 연말 15일 상여 → 급여 계산기 + Settings |
| PL 공제 | `calculateDeductionsPLFromSettings()` — ZUS/건강보험/PIT |
| dispatcher 확장 | `calculateDeductionsByCountryFromSettings` PL 분기 추가 |
| 세션 타임아웃 | `SYSTEM/session-config` + 미들웨어 적용 |

#### S-Fix-7: Audit Trail 확인 + 탭 연동 Spot Check

| 작업 | 내용 |
|------|------|
| Audit Trail | CompanyProcessSetting 변경 → `settings-audit-log` 기록 확인/보완 |
| 탭 연동 5건 | methodology→평가, distribution→캘리브레이션, pipeline→ATS, grade-scale→평가폼, leave-accrual→잔여일수 |
| 연동 끊김 Fix | spot check에서 발견된 문제 즉시 수정 |

### S-Fix Common Execution Rules (Gemini 크로스리뷰 반영)

| # | 규칙 | 이유 |
|---|------|------|
| **Rule 1** | Seed 파일 수정 후 반드시 `npx tsx prisma/seeds/해당파일.ts` 실행 + SELECT 검증 | 파일 수정 ≠ DB에 데이터 존재 |
| **Rule 2** | i18n 키는 `ko.json`, `en.json`만 추가 허용. `zh/vi/es.json` 금지 | 번역은 일괄 처리 |
| **Rule 3** | `prisma/schema.prisma` **절대 수정 금지**. 모든 설정은 CompanyProcessSetting JSON | DB push 사고 방지 |
| **Rule 4** | 각 논리 단위 후 `npx tsc --noEmit` | 누적 에러 방지 |
| **Rule 5** | UI 컴포넌트에 `'use client'` 필수 (useState/onClick 사용 시) | Server Component 런타임 crash 방지 (tsc 미감지) |
| **Rule 6** | 새 필드 PUT 시 해당 라우트의 Zod 스키마도 반드시 업데이트 | S-Fix-1의 `.strict()` Zod가 새 필드 400 튕김 |

### Settings 완료 후 → S-1 / S-2 CRUD 전수 검증

S-Fix 7세션으로 Settings 인프라가 완성된 후, 44탭 전수 CRUD 검증:

| Run | 범위 | 탭 수 |
|-----|------|-------|
| **S-1** | Organization(8) + Attendance(8) + Payroll(8) | 24탭 |
| **S-2** | Performance(7) + Recruitment(6) + System(7) | 20탭 |

S-1 프롬프트는 작성 완료. S-2는 S-1 결과 후 작성.

---

## 4. 의식적으로 제외한 항목 (Post-launch)

| 항목 | 이유 | 시점 |
|------|------|------|
| **Pay cycle bi-weekly** | 급여 엔진 구조 변경 필요 — QF 범위 초과 | Post-launch Phase 2 |
| **Crossboarding 모듈** | 신규 모듈 6시간+ — 수동 워크어라운드 있음 | Post-launch Phase 2 |
| **Offer 템플릿 엔진** | 수동 오퍼 가능 — nice-to-have | Post-launch Phase 2 |
| **Cross-setting 충돌 감지** | Workday도 없음 — HR 교육으로 커버 | Post-launch Phase 3 |
| **13th month (VN/PH)** | VN은 별도 보너스 처리 가능. MX Aguinaldo만 S-Fix-6 구현 | Post-launch Phase 2 |
| **i18n zh/vi/es 번역** (S-Fix 추가분) | S-Fix에서 ko/en만 추가 → 배포 전 일괄 번역 세션 | Pre-deploy |

---

## 5. 테스트 계정 (변경 없음)

| # | 약어 | 역할 | 법인 | 이메일 | 이름 |
|---|------|------|------|--------|------|
| 1 | **SA** | SUPER_ADMIN | 전체 | super@ctr.co.kr | 최상우 |
| 2 | **HK** | HR_ADMIN | CTR-KR | hr@ctr.co.kr | 한지영 |
| 3 | **HC** | HR_ADMIN | CTR-CN | hr@ctr-cn.com | 陈美玲 |
| 4 | **M1** | MANAGER | CTR-KR | manager@ctr.co.kr | 박준혁 |
| 5 | **M2** | MANAGER | CTR-KR | manager2@ctr.co.kr | 김서연 |
| 6 | **EA** | EMPLOYEE | CTR-KR | employee-a@ctr.co.kr | 이민준 |
| 7 | **EB** | EMPLOYEE | CTR-KR | employee-b@ctr.co.kr | 정다은 |
| 8 | **EC** | EMPLOYEE | CTR-KR | employee-c@ctr.co.kr | 송현우 |

---

## 6. 나머지 Phase 상세 (변경 없음)

### Phase C: Cross-Cutting (2 Runs)

| Run | 이름 | 범위 | 시간 |
|-----|------|------|------|
| **C-1** | Security & RBAC | 4역할 접근제어, URL조작, Error Boundary, 위임, 감사로그 | 40min |
| **C-2** | Cross-Module Integration | 12 pipelines (Recruit→Onboard, Att→Payroll 등) | 40min |

### Phase E: Edge Cases & Safety (2 Runs)

| Run | 이름 | 범위 | 시간 |
|-----|------|------|------|
| **E-1** | Edge Cases & Safety | Cascading Delete, Idempotency, Boundary, Cache Bleed, 외부 API, GDPR | 40min |
| **E-2** | Performance & Audit | Page Performance 15p, Session Auth 7건, Audit Trail 10건, Rate Limiting | 40min |

### Track 2: Antigravity Browser (8 Runs)

| Run | 이름 | 시간 |
|-----|------|------|
| UX-1 | Design Token — 목록 | 20min |
| UX-2 | Design Token — 상세/폼 | 20min |
| UX-3 | Cross-Page Consistency | 20min |
| UX-4 | Interaction Patterns | 20min |
| UX-5 | Loading & Error States | 20min |
| UX-6 | Mobile Part 1 | 20min |
| UX-7 | Mobile Part 2 | 20min |
| UX-8 | i18n + Export + a11y | 20min |

---

## 7. 업데이트된 실행 순서

```
═══ Pre-Run ~ Phase 0 ✅ 완료 ═══
8계정 + Quick Login + Data Sanity

═══ Phase A: Core CRUD ✅ 완료 (세션 1~5) ═══
A-1 ~ A-11: P0 31건 Fix, ~363 endpoints

═══ Phase B: Analytics+AI ✅ 완료 (세션 6) ═══
B-1 + B-2: P0 4건 Fix, ~66 endpoints

═══ Phase S: Settings 완전 정복 🔄 진행 중 (세션 7~) ═══
  S-0 Pre-flight ✅ → S-0 Audit ✅ → S-Fix-1 ✅ → S-Fix-2 ✅
  → S-Fix-3 ← 다음
  → S-Fix-4 (독립, S-Fix-3과 병렬 가능)
  → S-Fix-5 (독립)
  → S-Fix-6 (S-Fix-2 의존)
  → S-Fix-7 (전체 S-Fix 완료 후)
  → S-1 CRUD (24탭) → S-2 CRUD (20탭)

═══ Phase C: Cross-Cut (모든 A Fix 완료 후 — 조건 충족 ✅) ═══
  C-1 (Security+RBAC) → C-2 (Cross-Module)
  ※ S-Fix와 병렬 가능 — 서로 다른 영역

═══ Phase E: 파괴+안전 (C-1, C-2 완료 후) ═══
  E-1 (Edge Cases) → E-2 (Performance+Audit)

═══ i18n 일괄 번역 (배포 전) ═══
  S-Fix에서 추가된 ko/en 키 → zh/vi/es 일괄 번역

═══ Track 2: UX (마지막) ═══
  UX-1 ~ UX-8 (Antigravity, 병렬 가능)
```

---

## 8. 세션 배분 (업데이트)

| 세션 | 작성/실행할 프롬프트 | 개수 | 상태 |
|------|-------------------|------|------|
| **세션 1** | Pre-Run, Patch, Run 0, A-1 | 4 | ✅ 완료 |
| **세션 2** | A-2, A-3, A-4 | 3 | ✅ 완료 |
| **세션 3** | A-5a, A-5b | 2 | ✅ 완료 |
| **세션 4** | A-6a, A-6b, A-7 | 3 | ✅ 완료 |
| **세션 5** | A-8, A-9, A-10, A-11 | 4 | ✅ 완료 |
| **세션 6** | B-1, B-2 | 2 | ✅ 완료 |
| **세션 7** | S-0 Pre-flight, S-0 Audit, S-Fix-1, S-Fix-2, **S-Fix-3** | 5 | 🔄 진행 중 |
| **세션 8** | S-Fix-4, S-Fix-5, S-Fix-6, S-Fix-7 | 4 | 대기 |
| **세션 9** | S-1, S-2 | 2 | 대기 (S-Fix 완료 후) |
| **세션 10** | C-1, C-2, E-1, E-2 | 4 | 대기 |
| **세션 11** | UX-1 ~ UX-8 | 8 | 대기 |

**11개 세션에 41개 프롬프트.**

---

## 9. 프롬프트 작성 규칙

### 기존 5대 필수 패턴 (v5.1 계승)

| # | 규칙 | 이유 |
|---|------|------|
| 1 | Auth Token 자동 해결 — Login API + CSRF | Opus 대기 방지 |
| 2 | JSON Payload는 `/tmp/payload.json` heredoc | Bash 따옴표 지옥 방지 |
| 3 | FK ID는 psql 자동 조회 — 플레이스홀더 금지 | 리터럴 복붙 사고 방지 |
| 4 | Python 의존성 선행 설치 | Excel 검증 오진 방지 |
| 5 | Time Budget = 40분 (Opus), 30분 (Sonnet) | 대충 마무리 방지 |

### S-Fix 추가 규칙 (v6 신규)

| # | 규칙 | 이유 |
|---|------|------|
| 6 | Seed 파일 수정 후 `npx tsx` 실행 + SELECT 검증 | 파일 ≠ DB |
| 7 | i18n은 ko/en만. zh/vi/es 금지 | 일괄 번역 예정 |
| 8 | `prisma/schema.prisma` 절대 수정 금지 | DB push 사고 방지 |
| 9 | UI에 `'use client'` 필수 (hooks 사용 시) | SSR 런타임 crash 방지 |
| 10 | 새 필드 PUT 시 Zod 스키마도 업데이트 | `.strict()` 400 방지 |

### 프롬프트 작성 시 Gemini 크로스리뷰 기준

복잡 프롬프트(멀티 에이전트, API+UI+Export 결합)는 실행 전 Gemini Pro Hi에 리뷰:
- Edge cases / 런타임 에러 트랩
- Prisma 모델 의존성
- Next.js App Router 주의사항 (use client, binary response, server/client 경계)
- UI 에러 상태 누락

---

## 10. 리포트 출력

### 저장 경로
```
docs/qa-reports/
```

### 파일 목록 (v6 업데이트 — 41개)

```
docs/qa-reports/
├── QF-REPORT-PreRun-Accounts.md       ✅
├── QF-REPORT-R0-DataSanity.md         ✅
├── QF-REPORT-A1-Employee.md           ✅
├── QF-REPORT-A2-Organization.md       ✅
├── QF-REPORT-A3-Leave.md              ✅
├── QF-REPORT-A4-Attendance.md         ✅
├── QF-REPORT-A5a-PayrollPipeline.md   ✅
├── QF-REPORT-A5b-PayrollConfig.md     ✅
├── QF-REPORT-A6a-PerfCycles.md        ✅
├── QF-REPORT-A6b-PerfEval.md          ✅
├── QF-REPORT-A7-Recruitment.md        ✅
├── QF-REPORT-A8-OnOffboarding.md      ✅
├── QF-REPORT-A9-TalentDev.md          ✅
├── QF-REPORT-A10-CompBenefits.md      ✅
├── QF-REPORT-A11-Compliance.md        ✅
├── QF-REPORT-B1-Analytics.md          ✅
├── QF-REPORT-B2-AIDashboard.md        ✅
├── QF-REPORT-S0-SettingsAudit.md      ✅
├── QF-REPORT-SFix1.md                 ✅
├── QF-REPORT-SFix2.md                 ✅
├── QF-REPORT-SFix3.md                 ← 다음
├── QF-REPORT-SFix4.md
├── QF-REPORT-SFix5.md
├── QF-REPORT-SFix6.md
├── QF-REPORT-SFix7.md
├── QF-REPORT-S1-Settings1.md
├── QF-REPORT-S2-Settings2.md
├── QF-REPORT-C1-Security.md
├── QF-REPORT-C2-Integration.md
├── QF-REPORT-E1-EdgeCases.md
├── QF-REPORT-E2-PerfAudit.md
├── QF-REPORT-UX1-TokenList.md
├── QF-REPORT-UX2-TokenDetail.md
├── QF-REPORT-UX3-CrossPage.md
├── QF-REPORT-UX4-Interaction.md
├── QF-REPORT-UX5-LoadingError.md
├── QF-REPORT-UX6-Mobile1.md
├── QF-REPORT-UX7-Mobile2.md
├── QF-REPORT-UX8-i18nExport.md
├── QF-REPORT-i18n-BatchTranslation.md
└── QF-REPORT-FinalVerdict.md
```

---

## 11. 최종 숫자

| 항목 | v5.1 | **v6** |
|------|------|--------|
| 총 Runs | 30 | **37** (+7 S-Fix) |
| Track 1 (Claude Code) | 22 | **29** |
| Track 2 (Antigravity) | 8 | **8** |
| 프롬프트 작성 세션 | 8 | **11** |
| 완료 | Pre-Run, R0 | **Pre-Run~B-2 + S-0~SFix2** (21 Runs) |
| 완료율 | 7% | **57%** (21/37) |
| 누적 P0 Fix | 0 | **37+** |
| 누적 endpoints 테스트 | 0 | **~429** |
| 예상 잔여 시간 | ~10h | **~6h** |
| Post-launch 제외 | 미정의 | **6개 항목 명시** |

---

## 12. 이 문서의 역할

| 용도 | 설명 |
|------|------|
| **전략 문서** | 37개 Run의 범위, 순서, 도구, 시간, 의존성 |
| **프롬프트 생성 가이드** | 세션별 참고하여 프롬프트 생성 |
| **실행 체크리스트** | 각 Run 완료 시 체크 |
| **Gemini 크로스리뷰 입력** | 복잡 프롬프트 리뷰 |
| **세션 간 연속성** | 새 세션 시작 시 첨부로 맥락 복원 |

**다음: S-Fix-3 실행 (Opus) → S-Fix-4~7 프롬프트 작성 → S-1/S-2 → C/E → UX**
