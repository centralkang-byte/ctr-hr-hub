# CTR HR Hub — Settings Design Spec v1.1
# 작성일: 2026-03-10
# 최종 수정: 2026-03-11 (v1.1c 구현 전략 확정: Hub-First Rebuild — 허브 우선 재구축 + 기존 39페이지 흡수 + 74건 연결)
# 용도: Settings 페이지 구현 시 참조 문서 (로드맵 마지막 단계)

---

## 1. 설계 철학

### 핵심 비유
> Settings = HR 운영의 중앙 관제실.
> 각 모듈(근태, 급여, 성과...)에 리모컨은 있지만, 한 곳에서 전체를 제어하는 관제실이 필요하다.

### 왜 마지막에 하나?
- 모든 GP(Golden Path)가 완성되어야 "어떤 설정이 필요한지" 확정됨
- 먼저 만들면 GP 진행 중 설정 항목이 계속 추가/변경되어 재작업 발생
- 비유: 집 인테리어 끝나기 전에 수납장 짜면 안 맞음
- GP 개발 중 하드코딩한 값들을 나중에 Settings로 추출(Extract)하는 전략이 가장 빠르고 안전함

---

## 2. UI 패턴 — FLEX 스타일 "카드 그리드 허브"

### 벤치마킹 3가지 패턴 비교

| 패턴 | 대표 제품 | 장점 | 단점 | CTR 적합도 |
|------|----------|------|------|:---:|
| A. 검색 중심 | Workday | 수백 개 항목 확장 가능 | 한눈에 구조 안 보임 | △ |
| B. 카드 그리드 허브 | FLEX | 직관적, 6~8개 카테고리 한눈에 | 항목 매우 많으면 한계 | ✅ 채택 |
| C. 사이드바 풀리스트 | Notion/Linear | 개발자에 익숙 | HR 사용자에게 압도적 | × |

### 채택: 패턴 B (카드 그리드 허브)

**허브 페이지 (`/settings`)**
- 6개 카테고리 카드를 3×2 그리드로 표시
- 각 카드: 아이콘 + 카테고리명 + 설정 항목 수 + 주요 항목 미리보기
- 상단: 검색바 (키워드로 설정 항목 필터)

**서브페이지 (`/settings/[category]`)**
- 좌측: 사이드 탭 (해당 카테고리 내 설정 항목 목록)
- 우측: 설정 폼/에디터
- 상단: 법인 선택 드롭다운 (기본값: "글로벌 기본값")
- 브레드크럼: 설정 > 카테고리명 > 항목명

---

## 3. 6개 카테고리 × 세부 항목

### 3-1. 조직/인사 (Organization & HR)

> 다른 모든 설정의 토대. 여기가 잘못되면 전부 흔들림.

| 항목 | 설정 내용 | 법인 오버라이드 | 비고 |
|------|----------|:---:|------|
| 법인 기본정보 | 법인명, 주소, 사업자번호, 대표자 | 필수 | |
| 부서 구조 | 부서 트리, 코드 체계 | 필수 | |
| 직급 체계 | 직급 목록, 승진 순서, 체류 연수 | 가능 | KR: 사원→부장, US: Associate→Director |
| 직종/직무 | Job Family, Job Profile 매핑 | 가능 | 글로벌 등급(G1~G10) + 로컬 직급명 매핑 |
| 발령 규칙 | 발령 유형(승진/전보/파견), 승인 절차 | 가능 | |
| 수습 기간 | 기간, 평가 기준, 자동 전환 규칙 | 가능 | |

### 3-2. 근태/휴가 (Attendance & Leave)

> HR이 가장 자주 들어오는 카테고리. 법정 규정이 나라마다 달라 오버라이드 최다.

| 항목 | 설정 내용 | 법인 오버라이드 | 비고 |
|------|----------|:---:|------|
| 근무 스케줄 | 기본 근무시간, 점심시간, 유연근무 허용 | 필수 | |
| 주간 근무한도 | KR 52h, US 40h, CN 44h, VN/MX 48h, RU 40h | 필수 | 현재 하드코딩 가능성 높음 |
| 교대근무 | 교대 패턴(3조2교대 등), 수당 배율 | 가능 | |
| 휴가 유형 | 연차/병가/경조사/출산 등 목록 | 필수 | LeavePolicy 모델 존재 |
| 휴가 부여 규칙 | 입사일 기준 vs 회계연도 기준, 비례 부여 | 필수 | |
| 연차촉진 | 알림 시점, 미사용 소멸 규칙 | 가능 | |
| 법정 공휴일 | 나라별 공휴일 캘린더 | 필수 | |
| 초과근무 | 사전승인 필수 여부, 수당 계산 배율 | 가능 | |

### 3-3. 급여/보상 (Payroll & Compensation)

> 가장 민감하고 복잡. 실수 = 직원 급여 오류.

| 항목 | 설정 내용 | 법인 오버라이드 | 비고 |
|------|----------|:---:|------|
| 급여 항목 | 기본급, 식대, 교통비, 직책수당 등 | 필수 | |
| 공제 항목 | 4대보험, 소득세, 주민세 (나라별 상이) | 필수 | |
| 비과세 한도 | 식대 20만원, 교통비 등 | 필수 | 현재 0원 처리 이슈 있음 |
| 연봉 밴드 | 직급별 최소/중간/최대 범위 | 가능 | |
| 인상률 매트릭스 | 성과등급 × 밴드 위치 → 인상률 | 가능 | 인터랙티브 테이블 에디터 필요 |
| 성과급 규칙 | 등급별 성과급 배율 | 가능 | |
| 급여일 | 매월 N일 | 필수 | |
| 통화 | KRW, USD, CNY, RUB, VND, MXN | 필수 | |

**인상률 매트릭스 UX:**
```
              │ E(탁월) │ M+(우수) │ M(보통) │ B(미흡)
─────────────┼────────┼─────────┼────────┼───────
밴드 하위     │ 8~10%  │  5~7%   │  3~5%  │  0~2%
밴드 중간     │ 6~8%   │  4~6%   │  2~4%  │  0~1%
밴드 상위     │ 4~6%   │  3~5%   │  1~3%  │   0%
```
- 셀 클릭 → 숫자 직접 편집
- 법인마다 다른 매트릭스 설정 가능

### 3-4. 성과/평가 (Performance & Evaluation)

| 항목 | 설정 내용 | 법인 오버라이드 | 비고 |
|------|----------|:---:|------|
| 평가 주기 | 반기/연간/분기 | 필수 | KR 반기, US 연간 등 |
| 평가 방법론 | MBO 비중, 역량 비중, 다면평가 비중 | 가능 | |
| 등급 체계 | E/M+/M/B (Exceeds/Meets+/Meets/Below) 4등급 | 가능 | 법인별 전환 가능해야 함 |
| 배분 가이드라인 | E 10% / M+ 30% / M 50% / B 10% (강제 아님, 경고만) | 가능 | |
| 캘리브레이션 | 필수 여부, 참여 범위 | 가능 | |
| CFR 설정 | 1:1 최소 빈도, 피드백 익명 허용 | 글로벌만 | |
| 역량 라이브러리 | CTR 핵심가치 13개 행동지표 + 직무 역량 | 글로벌만 | 핵심가치는 법인별 차이 불가 |

### 3-5. 채용/온보딩 (Recruitment & Onboarding)

| 항목 | 설정 내용 | 법인 오버라이드 | 비고 |
|------|----------|:---:|------|
| 채용 파이프라인 | 단계 수, 단계명 (서류→1차→2차→최종) | 가능 | |
| 면접 평가 항목 | 평가표 기본 항목 | 가능 | |
| AI 스크리닝 | 사용 여부, 기준 점수 | 글로벌만 | |
| 온보딩 템플릿 | 체크리스트 기본 항목 | 필수 | 법인별 다른 체크리스트 |
| 오프보딩 체크리스트 | 장비 회수, IT 계정 비활성화 등 | 필수 | |
| 수습 평가 | 평가 시점(30/60/90일), 기준 | 가능 | |

### 3-6. 시스템 (System)

| 항목 | 설정 내용 | 법인 오버라이드 | 비고 |
|------|----------|:---:|------|
| 알림 채널 | 이메일/Teams/앱 푸시 | 글로벌만 | |
| 알림 규칙 | 어떤 이벤트에 누구한테 알림 | 가능 | |
| 언어 기본값 | 법인별 기본 언어 | 필수 | |
| 타임존 | 법인별 타임존 | 필수 | |
| 역할/권한 | RBAC 역할 정의 | 글로벌만 | |
| 감사 로그 | 보존 기간, 조회 범위 | 글로벌만 | |
| 데이터 보존 | GDPR 삭제 주기, PII 마스킹 | 가능 | |
| **연동 (Integrations)** | 아래 별도 상세 | 혼합 | **v1.1 추가** |

#### 연동 (Integrations) 탭 상세 [v1.1 추가]

> HR 시스템은 절대 혼자 돌지 않는다. 외부 시스템과의 연결점을 관리하는 곳.

| 항목 | 설정 내용 | 법인 오버라이드 | 비고 |
|------|----------|:---:|------|
| Teams/Slack 웹훅 | 웹훅 URL + 알림 이벤트 매핑 | 가능 | 법인별 다른 Teams 채널 가능 |
| SSO/SAML | Google Workspace, Azure AD 연동 | 가능 | 법인별 다른 IdP 가능 |
| ERP 연동 | 급여 데이터 내보내기 주기, 포맷(CSV/API) | 가능 | KR: 더존, 해외: SAP 등 |
| API 키 관리 | 키 발급, 만료일, 사용량 모니터링 | 글로벌만 | |
| 웹훅 이벤트 로그 | 발송 성공/실패 이력, 재시도 | 글로벌만 | |

현재 CTR 규모에서는 시스템 카테고리 안의 탭으로 충분. 향후 연동이 10개 이상으로 늘어나면 별도 7번째 카테고리로 분리 검토.

---

## 4. 법인 오버라이드 UX (핵심 UX)

### 개념
> 비유: 건물 중앙 난방. 중앙 온도를 올리면 개별 보일러 없는 방은 다 올라가고, 개별 보일러 있는 방은 그대로.

- `companyId = NULL` → 글로벌 기본값 (중앙 난방)
- `companyId = 'CTR-VN'` → 법인 오버라이드 (개별 보일러)
- `getCompanySettings()` → fallback 자동 처리

### 화면 동작

**① 기본 화면 = 글로벌 기본값**
- 법인 드롭다운 기본: "글로벌 (기본값)"
- 여기서 수정 = 전 법인에 적용 (오버라이드 없는 법인)

**② 법인 선택 시 = 오버라이드 화면**
각 필드 옆에 상태 표시:
```
연차 일수:     12일  🟠 법인 커스텀 (글로벌: 15일) [기본값으로 되돌리기]
반차 허용:     허용  🔵 글로벌 기본값 사용 중
연차촉진 알림:  30일전 🔵 글로벌 기본값 사용 중
```
- 🔵 = 글로벌 기본값 사용 중 (이 법인은 별도 설정 없음)
- 🟠 = 법인 커스텀 (이 법인만 다른 값)

**③ 글로벌 고정 항목**
- CTR 핵심가치(Challenge, Trust, Responsibility, Respect) 등
- 법인 드롭다운 바꿔도 수정 불가
- "글로벌 고정" 라벨 + 자물쇠 아이콘 표시

**④ 오버라이드 요약 대시보드**
시스템 카테고리 내 "법인별 커스텀 현황" 뷰:
```
CTR-KR: 커스텀 3건 (52시간 규칙, 연말정산, 반기평가)
CTR-CN: 커스텀 5건 (44시간, 법정휴일, 사회보험료, ...)
CTR-US: 커스텀 4건 (FLSA 40시간, USD, PTO 정책, ...)
CTR-VN: 커스텀 2건 (연차 12일, 48시간)
CTR-MX: 커스텀 1건 (48시간)
CTR-RU: 커스텀 2건 (40시간, 러시아 공휴일)
```
→ Workday의 "Tenant Configuration Report"에 해당

---

## 5. 권한 — 3단계 접근 제어

### 레벨 1: 그룹 HR (SUPER_ADMIN)
- **모든 설정 변경 가능**
- 글로벌 기본값 수정 가능
- 모든 법인 오버라이드 수정 가능
- 역할: CTR 본사 인사팀장

### 레벨 2: 법인 HR (HR_ADMIN)
- **자기 법인 오버라이드만 변경 가능**
- 글로벌 기본값: 보기만 가능 (수정 불가)
- 타 법인 설정: 접근 불가
- 역할: 각 법인 HR 담당자

### 레벨 3: 나머지 (MANAGER, EMPLOYEE)
- **Settings 메뉴 자체 미노출**
- 사이드바에서 숨김 처리

### [v1.1] 서브 카테고리 권한 — 향후 확장 대비

> 현재 CTR은 법인당 HR 1~2명이라 당장 불필요. 하지만 데이터 모델에 확장 여지를 남겨둔다.

**v1 (현재):** HR_ADMIN은 자기 법인의 모든 카테고리 접근 가능
**v2 (향후):** HR_ADMIN 내에서 카테고리별 세분화 가능
- 예: CTR-MX 급여 담당자 → 급여/보상만 수정 가능, 채용 설정은 읽기 전용

**구현 방식:** `settings_permissions` 테이블에 `categoryId` 컬럼 예비:
```
| userId | companyId | categoryId | permission |
|--------|-----------|------------|------------|
| hr-mx  | CTR-MX    | NULL       | read_write |  ← v1: 전체 접근
| hr-mx  | CTR-MX    | payroll    | read_write |  ← v2: 카테고리별
| hr-mx  | CTR-MX    | recruitment| read_only  |  ← v2: 카테고리별
```
v1에서는 `categoryId = NULL` (전체)만 사용. UI에 카테고리별 권한 설정은 미노출.

### 실수 방지 UX
글로벌 기본값 변경 시 확인 모달:
```
⚠️ 이 변경은 다음 법인에 즉시 적용됩니다:
  ✅ CTR-KR, CTR-MX, CTR-RU (글로벌 기본값 사용 중)

  다음 법인은 법인 커스텀 설정이 있어 영향 없습니다:
  ⬜ CTR-CN, CTR-US, CTR-VN

  [취소] [적용]
```
→ 영향 범위를 구체적 법인명으로 표시

---

## 6. 추가 고려사항

### 6-1. 변경 이력 (Settings Audit Trail)
- 모든 설정 변경에 who / when / before / after 기록
- 기존 `audit_logs` 테이블 재활용 가능
- Settings 전용 "변경 이력" 탭 필요
- 감사 대응: "작년 식대 비과세 한도를 누가 언제 바꿨는지" 추적

### 6-2. 설정 간 의존성 검증
저장 시 충돌/모순 자동 감지:
- 평가 주기 "반기" ↔ MBO 목표 기간 "연간" → 경고
- 강제배분 ON ↔ 등급 체계 2단계(Pass/Fail) → 경고
- 연차 부여 규칙 변경 ↔ 올해 이미 부여 완료 → 경고
- "이 설정을 바꾸면 연결된 X도 확인이 필요합니다" 안내

### 6-3. 설정 적용 시점 [v1.1 수정: 즉시 발효 원칙]

> **원칙: 저장 즉시 발효 (Immediate Effect)**
>
> Gemini 피드백 반영: 설정 자체에 미래 시점 예약을 넣으면 백엔드 복잡도가 기하급수적으로 증가.
> "다음 달부터 등급 5→3단계" 예약 시 중간 발생 이벤트(퇴사자 평가, 중간점검)의 기준 판단이 극도로 복잡해짐.

**적용 규칙:**

| 구분 | 설정 유형 | 적용 시점 | 예시 |
|------|----------|----------|------|
| 기본 | 운영 설정 대부분 | **즉시 발효** | 알림 채널, 언어, 승인 절차 |
| 기본 | 정책 설정 대부분 | **즉시 발효** | 초과근무 배율, 비과세 한도, 휴가 유형 |
| 예외 | 평가 주기/등급 체계 | **현재 진행 중 주기 완료 후 적용** | "현재 2026-H1 평가 진행 중 → 2026-H2부터 적용" |
| 예외 | 연봉 밴드/인상률 매트릭스 | **다음 연봉 조정 시즌부터 적용** | "현재 진행 중인 조정에는 영향 없음" |

**즉시 발효의 안전장치:**
- 변경 전 확인 모달 (영향 법인 + 영향 인원수 표시)
- 변경 후 30일간 "최근 변경" 배지 표시
- 감사 로그에 before/after 기록 (롤백 참조용)

**예외 항목의 UX:**
- 저장 시 "이 변경은 현재 진행 중인 2026-H1 평가 주기에는 적용되지 않으며, 2026-H2부터 적용됩니다" 안내 메시지 표시
- 예약 상태를 별도 뱃지로 표시: "🕐 2026-H2부터 적용 예정"

### 6-4. 설정 초기화/복제
- 새 법인 생성 시 기존 법인 설정 복제 기능
- "CTR-VN 설정을 복제해서 CTR-IN 만들기"
- 복제 후 법인 특화 항목만 수정

### 6-5. 영향도 미리보기 [v1.1 추가]

> 민감한 설정 변경 시 "저장하면 무슨 일이 벌어지는지" 미리 보여주는 기능.

**v1 (현재 스코프): 영향 인원수 표시**
- [저장] 클릭 시 확인 모달에 영향받는 직원 수 표시
- 단순 DB 카운트 쿼리로 구현 가능
- 예: "이 설정 변경 시 영향받는 직원: 47명 (CTR-KR 32명, CTR-CN 15명)"

**v2 (향후): 예산 영향 시뮬레이션**
- [저장] 옆에 [시뮬레이션] 버튼 별도 배치
- "이 인상률 매트릭스를 적용하면 2026년 총 급여 예산이 약 5,000만 원 증가합니다"
- 전 직원 연봉 + 밴드 위치 + 성과등급 실시간 조회 + 환율 변환 필요
- 별도 급여 시뮬레이션 엔진 필요 → Settings와 별개 모듈급 작업

---

## 7. 현재 백엔드 준비 상태 평가 (2026-03-11 코드스캔 기준)

> **핵심 발견:** Settings 인프라는 "빈 껍데기"가 아니라 **상당량 이미 구축**되어 있음.
> 39개 페이지 + 33개 API + 6개 전용 설정 모델이 작동 중.
> 남은 작업은 "밑바닥 구축"이 아니라 **"74개 하드코딩 값을 기존 인프라에 연결"**.

### ✅ 준비된 것 — 인프라

| 항목 | 상태 | 비고 |
|------|:---:|------|
| 글로벌/법인 오버라이드 패턴 | ✅ | `companyId = NULL` = 글로벌 기본값 |
| `getCompanySettings()` fallback | ✅ | `src/lib/settings/getSettings.ts` — company→global 자동 fallback |
| `CompanyProcessSetting` 모델 | ✅ | `settingType` + `settingKey` + `settingValue`(JSON) — 범용 설정 저장소 |
| `resolveCompanyId` 보안 필터 | ✅ | 전 API 적용 |
| audit_logs 테이블 | ✅ | 변경 이력 기반 |
| Teams 연동 | ✅ | 알림 시스템 구현 완료 |

### ✅ 준비된 것 — 6개 전용 설정 모델

| 모델 | 용도 | 사용 현황 |
|------|------|----------|
| `EvaluationSetting` | 평가 주기/방법론/등급 체계 | Settings API에서 CRUD 사용 중 |
| `PromotionSetting` | 승진 규칙/체류 연수 | Settings API에서 CRUD 사용 중 |
| `CompensationSetting` | 보상 정책/인상률 매트릭스 | Settings API에서 CRUD 사용 중 |
| `AttendanceSetting` | 근태 규칙/초과근무 배율 | Settings API에서 CRUD 사용 중 |
| `LeaveSetting` | 휴가 정책 (allowNegativeBalance 등) | Leave 파이프라인에서 실제 참조 중 |
| `OnboardingSetting` | 온보딩 정책 | Settings API에서 CRUD 사용 중 |

### ✅ 준비된 것 — GP별 모델

| 모델 | 용도 | 비고 |
|------|------|------|
| LeavePolicy + LeaveTypeDef | 휴가 유형별 설정 | 이미 운영 중 |
| PerformanceCycle | 평가 주기 설정 | 사이클별 CRUD 작동 |
| ShiftPattern | 교대근무 패턴 | 이미 운영 중 |
| MeritMatrix (SalaryAdjustmentMatrix) | 등급×밴드위치→인상률 | GP#4-D1 구현, 시드 12건 |
| EmployeeLevelMapping | L1~L5+Exec 레벨 매핑 | GP#4 구현, 시드 12건 |
| TaxBracket | 세율 구간 관리 | 모델 존재, UI 최소화 |

### ✅ 준비된 것 — Settings 페이지 & API (스캔 결과)

| 구분 | 수량 | 상태 |
|------|:---:|------|
| Settings 페이지 (`page.tsx`) | **39개** | 대부분 기본 폼 수준 — 기능은 작동하나 UX 폴리시 필요 |
| Settings API (`route.ts`) | **33개** | CRUD 기본 동작 완료 — 법인 오버라이드 UX 미반영 |

**카테고리별 페이지 현황:**

| 카테고리 | 페이지 예시 | 상태 |
|---------|-----------|------|
| General | company, branding, modules, dashboard-widgets | ⚠️ 기본 폼 |
| 근태/휴가 | attendance, shift-patterns, shift-roster, work-schedules, holidays, terminals, leave, leave-policies | ⚠️ 기본 폼 |
| 급여/보상 | payroll-items, salary-bands, salary-matrix, exchange-rates, tax-brackets | ⚠️ 기본 폼 |
| 성과/평가 | performance-cycles(CRUD), calibration, evaluation-scale, competencies | 🟡 부분 기능 |
| 채용/온보딩 | onboarding, offboarding | ⚠️ 기본 폼 |
| 시스템 | audit-logs, monitoring, data-migration, m365, teams, workflows, approval-flows, notifications | ⚠️ 기본 폼 |

### ❌ 남은 작업 — 74개 하드코딩 연결

| 카테고리 | TODO 건수 | 핵심 항목 |
|---------|:---:|----------|
| **Payroll** | **54건** | 4대보험 요율, US/CN/VN/RU/MX 세율, 비과세 한도(식대 20만원 등), 이상탐지 임계값, 은행코드, 계정과목, 승인체계, 급여마감/지급일 |
| **Performance** | **9건** | 배분 가이드라인 비율, 수습 제외 로직, 편차 임계치(5pp), 직무계열 매칭, CRON_SECRET, 등급 스케일 |
| **Attendance** | **8건** | 주간 근무한도 52/44/48h, 월 소정근로시간 209h |
| **System** | **1건** | 이직률 벤치마크(4.5%) |
| **미태그** | **2건** | 은행 기본코드 '004', 이직률 산업평균 |
| **합계** | **74건** | |

### ❌ TODO 주석 없이 하드코딩된 값 (추가 발견)

| 파일 | 값 | 설명 |
|------|-----|------|
| `src/lib/labor/kr.ts` | `MAX_WEEKLY_HOURS = 52` | 주 52시간 한도 |
| `src/lib/analytics/predictive/burnout.ts` | `52, 48, 44` | 번아웃 임계값 |
| `src/lib/analytics/queries.ts` | `52` | 근태 이상 쿼리 기준 |
| `src/types/settings.ts` | `forcedDistribution` | 타입 정의 있으나 Settings UI 미연결 |
| `src/types/process-settings.ts` | `forced_distribution` | 프로세스 설정 타입 정의 |

### 📊 스캔 전후 비교

| 항목 | 스캔 전 (기획서 추정) | 스캔 후 (실제) |
|------|:---:|:---:|
| Settings 페이지 | 0 (빈 껍데기) | **39개** |
| Settings API | 0 | **33개** |
| 전용 설정 모델 | 2~3개 | **6개** + CompanyProcessSetting |
| `getCompanySettings()` | 존재 확인 필요 | **작동 중** (3개 API에서 사용) |
| TODO: Move to Settings | 31건 (GP#3 scope) | **74건** (전체 스캔) |

---

## 8. Settings 구현 전략 (최종 확정)

> **전략: 허브 우선 재구축 (Hub-First Rebuild)**
>
> 비유: 수납장 구조를 먼저 짜고, 물건을 올바른 자리에 정리한다.
> 기존 39페이지를 "살려서 확장"하는 게 아니라, 6카테고리 허브 구조 안에 **흡수·재편**한다.
> 사용자가 0명이므로 기존 페이지를 유지할 이유 없음. 처음부터 올바른 구조로.

### Phase H-1: 허브 + 6카테고리 서브페이지 골격 (구조 잡기)

**목표:** `/settings` 진입 → 6카테고리 조망 → 서브페이지 진입 → 법인 선택 → 설정 편집

**산출물:**

1. **허브 페이지 (`/settings`)**
   - 6개 카드 (3×2 그리드)
   - 카드별: 아이콘 + 카테고리명 + 설정 항목 수 + 주요 항목 미리보기
   - 상단: 키워드 검색바

2. **6개 서브페이지 (`/settings/[category]`)**
   - 좌측: 사이드 탭 (카테고리 내 항목 목록)
   - 우측: 설정 폼/에디터
   - 상단: 법인 선택 드롭다운 (기본값: "글로벌 기본값")
   - 브레드크럼: 설정 > 카테고리명 > 항목명
   - 🔵 글로벌 기본값 / 🟠 법인 커스텀 시각적 구분
   - [기본값으로 되돌리기] 버튼

3. **법인 오버라이드 공통 컴포넌트**
   - `CompanySettingSelector` — 법인 드롭다운 (글로벌/법인별)
   - `SettingFieldWithOverride` — 각 필드 옆 🔵/🟠 상태 표시
   - `GlobalChangeConfirmModal` — 글로벌 변경 시 영향 법인 표시
   - `SettingSideTab` — 카테고리 내 항목 탐색

**기존 39페이지 흡수 매핑:**

| 6카테고리 | 흡수 대상 (기존 페이지) | 사이드탭 항목 |
|----------|----------------------|-------------|
| 조직/인사 | company, branding, modules, custom-fields, enums, terms, profile-requests, entity-transfers, org-changes, contract-rules | 법인 기본정보, 부서 구조, 직급 체계, 직종/직무, 발령 규칙, 수습 기간, 커스텀 필드, 코드 관리 |
| 근태/휴가 | attendance, shift-patterns, shift-roster, work-schedules, holidays, terminals, leave, leave-policies | 근무 스케줄, 주간 근무한도, 교대근무, 휴가 유형, 휴가 부여 규칙, 연차촉진, 법정 공휴일, 초과근무 |
| 급여/보상 | payroll-items, salary-bands, salary-matrix, exchange-rates, tax-brackets | 급여 항목, 공제 항목, 비과세 한도, 연봉 밴드, 인상률 매트릭스, 성과급 규칙, 급여일, 통화/환율 |
| 성과/평가 | performance-cycles, calibration, evaluation-scale, competencies | 평가 주기, 평가 방법론(MBO:BEI 비중), 등급 체계(E/M+/M/B), 배분 가이드라인, 캘리브레이션, CFR 설정, 역량 라이브러리 |
| 채용/온보딩 | onboarding, offboarding | 채용 파이프라인, 면접 평가항목, AI 스크리닝, 온보딩 템플릿, 오프보딩 체크리스트, 수습 평가 |
| 시스템 | audit-logs, monitoring, data-migration, m365, teams, workflows, approval-flows, email-templates, export-templates, notifications, dashboard-widgets | 알림 채널, 알림 규칙, 언어/타임존, 역할/권한, 감사 로그, 데이터 보존, 연동(Integrations) |

### Phase H-2: 74개 하드코딩 → 새 구조에 연결

**목표:** 기획서 섹션 7의 74개 TODO 항목을 H-1에서 만든 서브페이지 폼과 연결. HR이 실제로 값을 변경하면 시스템에 반영.

| 배치 | 카테고리 | 건수 | 핵심 항목 |
|------|---------|:---:|----------|
| H-2a | **Payroll** | 54 | 4대보험 요율, 세율, 비과세 한도, 이상탐지 임계값, 계정과목, 승인체계, 급여일 |
| H-2b | **Performance** | 9 | 배분 가이드라인, 수습 제외, 편차 임계치, 등급 스케일 |
| H-2c | **Attendance** | 8 | 주간 근무한도 52/44/48h, 월 소정근로시간 209h |
| H-2d | **System + 미태그** | 3 | 이직률 벤치마크(4.5%), 은행코드, 산업평균 |

**연결 방식:**
- 기존 `CompanyProcessSetting` + `getCompanySettings()` 재활용
- 각 하드코딩 위치에서 `const value = await getCompanySettings(companyId, 'category', 'key')` 호출로 전환
- fallback: DB에 값이 없으면 기존 하드코딩 값을 기본값으로 유지 (안전장치)

### Phase H-3: Audit Trail + 확인 모달 + 최종 폴리시

**목표:** 설정 변경의 안전성과 추적 가능성 확보.

| 항목 | 내용 |
|------|------|
| 변경 이력 탭 | 각 서브페이지 내 "변경 이력" 탭. who/when/before/after 기록 |
| 글로벌 변경 확인 모달 | "이 변경은 CTR-KR, CTR-MX, CTR-RU에 적용됩니다" + 영향 인원수 |
| 최근 변경 배지 | 변경 후 30일간 "최근 변경" 표시 |
| 오버라이드 요약 대시보드 | 시스템 카테고리 내 "법인별 커스텀 현황" (법인당 커스텀 건수) |
| UX 통일 | CRAFTUI 디자인 시스템 적용 (카드, 폼, 테이블, 모달) |

### 예상 세션

| 단계 | 작업 | 예상 세션 |
|------|------|:---:|
| H-1 | 허브 + 6서브페이지 + 법인 오버라이드 UX + 기존 39페이지 흡수 | 2~3 |
| H-2a | Payroll 54건 연결 | 2~3 |
| H-2b~d | Performance + Attendance + System 20건 연결 | 1~2 |
| H-3 | Audit Trail + 확인 모달 + 폴리시 | 1~2 |
| **합계** | | **6~10세션** |

> **전략 요약:** 구조 먼저 → 74개 올바른 자리에 연결 → 안전장치. 기존 39페이지는 새 구조 안에 흡수.

---

## 9. GP 진행 중 하드코딩 추적 규칙 [v1.1 추가]

### TODO 주석 필수 규칙

> GP#3~4 및 모든 이후 작업에서 정책값을 하드코딩할 때 반드시 따를 것.

**규칙:** 상수를 하드코딩할 때 반드시 주석을 달 것:
```typescript
// TODO: Move to Settings (Attendance) — 주간 근무한도
const WEEKLY_HOUR_LIMIT = 52;

// TODO: Move to Settings (Payroll) — 식대 비과세 한도
const MEAL_ALLOWANCE_TAX_FREE = 200000;

// TODO: Move to Settings (Performance) — 배분 가이드라인 비율
const DISTRIBUTION_GUIDELINE = { E: 0.1, 'M+': 0.3, M: 0.5, B: 0.1 };
```

**주석 형식:**
```
// TODO: Move to Settings ({카테고리명}) — {설명}
```

**카테고리명 목록 (6개 중 택1):**
- `Organization` — 조직/인사
- `Attendance` — 근태/휴가
- `Payroll` — 급여/보상
- `Performance` — 성과/평가
- `Recruitment` — 채용/온보딩
- `System` — 시스템

**수집 방법:**
```bash
# Settings 작업 시작 전 전체 목록 추출
grep -rn "TODO: Move to Settings" src/ --include="*.ts" --include="*.tsx"

# 카테고리별 집계
grep -rn "TODO: Move to Settings" src/ | grep -oP '\(.*?\)' | sort | uniq -c | sort -rn
```

이 주석 목록이 곧 **Settings 개발 요구사항 명세서**가 된다.

### Claude Code 프롬프트에 추가할 문구
모든 GP 프롬프트 상단에 아래 규칙을 포함할 것:
```
MANDATORY RULE: When hardcoding any policy value (hours limit, tax threshold,
distribution ratio, etc.), always add this comment above it:
// TODO: Move to Settings ({Category}) — {description}
Categories: Organization, Attendance, Payroll, Performance, Recruitment, System
```

### GP 진행 중 발견 로그

| GP | 발견된 하드코딩/설정 필요 항목 | 카테고리 | 파일 |
|----|------------------------------|---------|------|
| (GP 진행하면서 자동 수집됨 — TODO 주석으로) | | | |

---

## 10. 라우팅 구조

```
/settings                          → 허브 (6개 카드 그리드)
/settings/organization             → 조직/인사
/settings/attendance               → 근태/휴가
/settings/payroll                  → 급여/보상
/settings/performance              → 성과/평가
/settings/recruitment              → 채용/온보딩
/settings/system                   → 시스템 (Integrations 탭 포함)
```

각 서브페이지 내부: `?tab=항목슬러그`로 사이드탭 상태 유지
- 예: `/settings/attendance?tab=leave-types`
- 예: `/settings/payroll?tab=salary-bands`
- 예: `/settings/system?tab=integrations`

---

## 부록 A: 법인별 필수 오버라이드 요약

| 설정 항목 | KR | US | CN | RU | VN | MX |
|----------|:--:|:--:|:--:|:--:|:--:|:--:|
| 주간 근무한도 | 52h | 40h | 44h | 40h | 48h | 48h |
| 통화 | KRW | USD | CNY | RUB | VND | MXN |
| 평가 주기 | 반기 | 연간 | 반기 | 연간 | 반기 | 연간 |
| 타임존 | Asia/Seoul | America/Chicago | Asia/Shanghai | Europe/Moscow | Asia/Ho_Chi_Minh | America/Mexico_City |
| 언어 기본값 | ko | en | zh | ru | vi | es |
| 공휴일 | KR 법정 | US Federal | CN 법정 | RU 법정 | VN 법정 | MX 법정 |
| 4대보험/사회보험 | 국민+건강+고용+산재 | FICA+Medicare | 五险一金 | ПФР+ФСС+ФОМС | BHXH+BHYT+BHTN | IMSS |

---

## 부록 B: 변경 이력 (이 문서의 수정 내역)

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-03-10 | 초안 작성 — 6개 카테고리, 법인 오버라이드 UX, 3단계 권한, 백엔드 준비 상태 |
| v1.1 | 2026-03-10 | Gemini 피드백 5건 반영: (1) Effective Dating → 즉시 발효 원칙 + 극소수 예외, (2) TODO 주석 필수 규칙 추가, (3) 시스템 카테고리에 Integrations 탭 추가, (4) 영향도 미리보기 v1(인원수)/v2(예산 시뮬레이션) 단계 분리, (5) HR_ADMIN 서브 카테고리 권한 데이터 모델 예비 |
| v1.1a | 2026-03-11 | 교차검토 수정: (1) 등급 체계 S/A/B/C → E/M+/M/B (GP#4 확정 반영), (2) 배분 가이드라인 10/30/40/20 → 10/30/50/10, (3) 인상률 매트릭스 예시 갱신, (4) MeritMatrix/EmployeeLevelMapping "준비됨"으로 이동 |
| v1.1b | 2026-03-11 | 코드스캔 전면 검증: (1) 섹션 7 "현재 상태" 전면 재작성 — 39페이지+33API+6전용모델+CompanyProcessSetting 이미 작동 중, (2) 섹션 8 작업 범위 재정의 — "신규 구축"→"기존 인프라 확장+74건 연결", (3) TODO 74건 카테고리별 분류 (Payroll 54/Performance 9/Attendance 8/System 1/미태그 2), (4) Phase H-1~H-4 로드맵 재설계 |
| v1.1c | 2026-03-11 | 구현 전략 최종 확정: Hub-First Rebuild — (1) 기존 39페이지 "살려서 확장"이 아닌 6카테고리 허브에 흡수·재편, (2) Phase H-1~H-3 3단계로 압축 (구조→연결→안전장치), (3) 기존 39페이지→6카테고리 흡수 매핑표 추가, (4) H-2 배치 분할 (a:Payroll 54 / b:Performance 9 / c:Attendance 8 / d:System 3) |
