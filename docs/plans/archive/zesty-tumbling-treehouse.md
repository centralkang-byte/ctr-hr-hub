# CTR Pulse 3차 QA — 통합 테스트 계획

## Context

U1~U11 UX 개선까지 모두 완료된 상태. 이전 QA 1차/2차에서 보안, RBAC, silent failure를 점검했으나, U8~U11 신규 기능 및 전체 모듈 간 통합 테스트는 미실시. HR 시스템 QA 프레임워크(QF_FINAL_RUN 1~3)를 CTR Pulse 도메인에 맞게 적용하여 **배포 전 최종 통합 검증**을 수행한다.

## 테스트 환경

- **URL:** http://localhost:3000
- **Viewport:** Desktop 1920×1080 / Mobile 375×812
- **Console + Network 탭 항상 오픈**
- **비밀번호:** 전 계정 `Test1234!`

| 역할 | 이메일 | 스코프 |
|------|--------|--------|
| System Admin | admin@ctr.co.kr | 글로벌 |
| Group Auditor | auditor@ctr.co.kr | 전 법인 |
| Company Admin | admin.ctr@ctr.co.kr | CTR 본사 |
| Dept Head (경영) | head.mgt@ctr.co.kr | 경영지원부 |
| Dept Head (영업) | head.sales@ctr.co.kr | 영업부 |
| User (영업) | user.sales1a@ctr.co.kr | 영업부 거래 |
| User (재무) | user.fin1@ctr.co.kr | 재무부 거래 |
| External Auditor | ext.auditor@audit.co.kr | 읽기전용 |

## 심각도 기준

| Level | 정의 | 배포 영향 |
|-------|------|----------|
| **P0** | 앱 크래시, 데이터 유출, 보안 위반, 워크플로 차단 | ❌ 반드시 수정 |
| **P1** | 기능 고장 (우회 가능) | ⚠️ 1주 내 수정 |
| **P2** | 시각적 결함, 경미한 UX | ✅ 다음 스프린트 |

## 버그 아닌 것 (리포트 제외)
- 시드 데이터 없어서 빈 목록 → OK
- dev 서버 HMR 깜빡임 → OK
- Console warning (노란색) → OK
- tsc EPERM → OK

## 버그인 것 (반드시 리포트)
- 흰 화면 / 크래시
- 버튼 클릭 무반응
- 폼 제출 후 새로고침 시 데이터 소실
- 권한 밖 데이터 접근 가능
- Console 500 에러
- 10초+ 무한 스켈레톤
- Toast 미표시

---

## Run 1/3: Golden Path E2E + UX/UI Audit

> **역할:** 10년차 금융감사 SaaS PM + CTO 시각
> "실제 CTR 감사팀 과장이 3초 안에 이해할 수 있는가?"

### GP1: Finding 탐지 → 조사 → 해결 (핵심 워크플로)

**Step 1: system_admin 로그인 + 대시보드**
1. Login → 대시보드 로딩 확인
2. KPI 카드 4개 (총 거래, 건수, 고위험, 평균 리스크) — 숫자 표시?
3. TrendChart (AreaChart) 렌더?
4. RiskDonut (PieChart) 렌더?
5. Top Findings 목록 표시?

**Step 2: Finding 조사 워크플로**
6. Navigate → `/findings`
7. FindingsWorkbench 2패널 UI 로딩?
8. 좌측 목록에서 `new` 상태 Finding 클릭
9. 우측 상세패널: 리스크 점수, 규칙 breakdown, 거래 정보 표시?
10. **상태 변경**: new → investigating → ConfirmDialog 뜨는가?
11. 확인 클릭 → 상태 변경 + Toast?
12. Timeline에 상태 변경 이벤트 기록?
13. Comment 추가 → 저장 → 새로고침 → 유지?

**Step 3: 소명 요청 → 응답 → 검토**
14. investigating 상태에서 "소명 요청" 클릭
15. 소명 폼: 질문 입력 + 기한 설정 → 제출
16. 상태 → `clarification_requested`?
17. Login as **user** (소명 대상자)
18. 소명 요청 알림 또는 Finding 접근 → 응답 폼?
19. 응답 제출 → 상태 → `clarification_submitted`?
20. Login as **system_admin** 다시
21. 소명 검토 → 승인/반려 → 상태 → `resolved`?
22. Resolution Type 선택 (legitimate/policy_violation 등)?

**Step 4: 결과 확인**
23. 대시보드 KPI 업데이트? (resolved_rate 변화?)
24. 알림 벨 → 관련 알림 존재?
25. Console에 500 에러 없음?

**체크리스트:**
- [ ] 대시보드 KPI + 차트 로딩
- [ ] FindingsWorkbench 2패널
- [ ] 상태 머신 전이 (new→investigating→clarification→resolved)
- [ ] ConfirmDialog on 상태변경
- [ ] 소명 요청/응답/검토 전체 플로
- [ ] Timeline 이벤트 기록
- [ ] Comment CRUD + 영속성
- [ ] Toast 알림
- [ ] Console 500 없음

---

### GP2: 예산 모니터링 + 알림

**Step 1: 예산 대시보드**
1. Login as **company_admin**
2. Navigate → `/budget`
3. 3단계 드릴다운: 그룹 → 법인 → 부서 로딩?
4. 예산 소진율 ProgressBar 표시?
5. 상태별 색상: safe(초록) / warning(노랑) / danger(빨강)?
6. 트렌드 차트 로딩?

**Step 2: Excel 임포트**
7. "Excel 임포트" 버튼 → 임포트 화면?
8. 템플릿 다운로드 → 파일 생성?
9. (실제 임포트는 스킵 — 테스트 데이터 오염 방지)
10. 임포트 히스토리 로딩?

**Step 3: 예산 초과 알림**
11. 예산 소진율 90%+ 부서가 있다면 → 알림 생성 확인
12. Navigate → `/alerts` → budget_warning 타입 알림?

**체크리스트:**
- [ ] 3단계 드릴다운
- [ ] ProgressBar + 상태 색상
- [ ] 트렌드 차트
- [ ] 템플릿 다운로드
- [ ] 임포트 히스토리
- [ ] Console 500 없음

---

### GP3: 카드 분석 + 거래내역

**Step 1: 카드 분석**
1. Login as **group_auditor**
2. Navigate → `/card`
3. MCC 카테고리 파이차트 로딩?
4. 7×24 히트맵 렌더?
5. Top Merchants 목록?
6. 카드 사용자 분석?
7. 기간 필터 변경 → 데이터 갱신?

**Step 2: 거래내역**
8. Navigate → `/transactions`
9. 거래 목록 테이블 로딩?
10. 검색 (가맹점명) → 필터링?
11. 날짜 범위 필터 → 결과 변경?
12. 상태/리스크 필터?
13. 페이지네이션 동작?
14. 거래 클릭 → 상세 정보 (금액, MCC, 카드번호, 시간)?

**Step 3: 카드 현황**
15. Navigate → `/cards`
16. 카드 포트폴리오 로딩?

**체크리스트:**
- [ ] MCC 파이차트 + 히트맵 + 가맹점
- [ ] 거래 검색/필터/페이지네이션
- [ ] 거래 상세
- [ ] 카드 현황
- [ ] Console 500 없음

---

### GP4: 알림 시스템 (U11 포함)

**Step 1: 알림 드롭다운 (U11)**
1. Login as **system_admin**
2. 헤더 벨 아이콘 → AlertDropdown 열림?
3. 최근 10개 알림 표시?
4. 읽음/미읽음 구분 (파란 세로줄 + 배경색)?
5. 개별 읽음 처리 → 미읽음 카운트 감소?
6. "모두 읽음" → 전체 처리?
7. 바깥 클릭 → 닫힘?
8. "전체 알림 보기" → `/alerts` 이동?

**Step 2: 알림 목록 페이지**
9. Navigate → `/alerts`
10. 타입별 탭 (전체/이상거래/예산/소명/보고서/시스템)?
11. 읽음 상태 토글?
12. 알림 클릭 → 해당 모듈 딥링크 이동?

**Step 3: 알림 설정**
13. Navigate → `/alerts/settings`
14. 채널별 설정 (이메일/Teams/인앱)?
15. 이벤트별 ON/OFF 토글?
16. 저장 → 새로고침 → 유지?

**Step 4: Toast hover pause (U11)**
17. 어떤 액션으로 Toast 트리거
18. Toast에 마우스 올림 → 타이머 일시중지?
19. 마우스 뗌 → 남은 시간으로 재개?

**체크리스트:**
- [ ] AlertDropdown 열림/닫힘
- [ ] 읽음/미읽음 처리
- [ ] 타입별 탭 필터
- [ ] 딥링크 이동
- [ ] 알림 설정 CRUD
- [ ] Toast hover pause
- [ ] Console 500 없음

---

### GP5: 보고서 + 컴플라이언스

**Step 1: 보고서**
1. Login as **group_auditor**
2. Navigate → `/reports`
3. 보고서 목록 로딩?
4. 보고서 통계 (stats)?
5. 스케줄 관리 → 스케줄 목록?

**Step 2: 컴플라이언스**
6. Navigate → `/compliance`
7. 컴플라이언스 스코어 표시?
8. 리스크 분포 차트?
9. 부서별 랭킹?
10. 위반 규칙 카테고리?

**체크리스트:**
- [ ] 보고서 목록 + 통계
- [ ] 스케줄 CRUD
- [ ] 컴플라이언스 대시보드
- [ ] Console 500 없음

---

### GP6: 설정 전체 탭 순회

**Step 1: 설정 허브 (system_admin)**
1. Navigate → `/settings`
2. 6개 탭 네비게이션 표시?

**Step 2: 각 탭 로딩 확인**
3. `/settings/general` — 일반설정 로딩?
4. `/settings/users` — 사용자 목록? 역할 분포?
5. `/settings/organization` — 조직구조? 법인/부서 트리?
6. `/settings/mcc` — MCC 코드 목록?
7. `/settings/rules` — 탐지규칙 목록?
8. `/settings/rules/[id]` — 규칙 편집기 로딩?
9. `/settings/logs` — 감사로그 목록?
10. `/settings/notifications` — 알림 채널 설정?

**Step 3: CRUD 테스트 (1~2개 탭)**
11. 규칙 편집 → 저장 → 새로고침 → 유지?
12. 사용자 역할 변경 → 저장 → 유지?

**체크리스트:**
- [ ] 8개 설정 페이지 전부 로딩 (흰 화면 0)
- [ ] 규칙 편집 영속성
- [ ] 감사로그 표시
- [ ] Console 500 없음

---

### UX/UI Deep Audit (GP 순회 중 병행)

#### A. 디자인 시스템 일관성
| 항목 | 기준 | 위반 시 |
|------|------|--------|
| Primary color | `#5E81F4` 통일? | P2 |
| Card border | `border-[#F0F0F3] rounded-xl`? | P2 |
| Button primary | `bg-[#5E81F4] text-white rounded-lg`? | P2 |
| Page title | `text-2xl font-bold`? | P2 |
| Empty state | EmptyState 컴포넌트 사용? 흰 화면이면 P1 | P1 |
| Loading | Skeleton 표시? 프리즈면 P1 | P1 |
| Status badge | 색상 일관? (danger=빨강, warning=노랑, safe=초록) | P2 |
| 테이블 헤더 | 일관된 스타일? | P2 |

#### B. U1~U11 UX 개선 검증
- [ ] U1: 디자인 토큰 — 인라인 hex 없이 `T.*` 사용?
- [ ] U2: EmptyState — 빈 데이터에 아이콘+메시지?
- [ ] U3: Toast — 액션 후 피드백?
- [ ] U4: PageHeader — 제목+액션 통일?
- [ ] U5: Skeleton — API 호출 중 스켈레톤?
- [ ] U6: FilterBar — 필터 UI 통일?
- [ ] U7: Export — CSV/Excel 다운로드?
- [ ] U8: Cmd+K → 커맨드 팔레트? ? → 단축키 도움말?
- [ ] U9: Breadcrumb — 경로 표시?
- [ ] U10: SavedFilter — 필터 저장/불러오기?
- [ ] U11: AlertDropdown + Toast hover pause?

#### C. 모바일 반응형 (375×812)
- [ ] 사이드바 → 햄버거 메뉴 전환?
- [ ] 테이블 → 수평 스크롤?
- [ ] 카드 → 세로 스택?
- [ ] 모달 → 화면 안에 맞음?

---

## Run 2/3: Security & RBAC + 전체 기능 커버리지

### 3-1. RBAC 접근 제어

**user (최저 권한) → 차단 확인:**
1. Login as `user.sales1a@ctr.co.kr`
2. `/settings` → 리다이렉트 또는 403?
3. `/budget` → 차단? (budget.view 권한 없음)
4. `/compliance` → 차단?
5. 자기 부서 외 Finding 접근 → 차단?

**department_head → 범위 제한:**
6. Login as `head.sales@ctr.co.kr`
7. `/findings` → 영업부 관련 Finding만?
8. `/budget` → 영업부 예산만?
9. 경영지원부 데이터 → 안 보여야 함

**external_auditor → 읽기전용:**
10. Login as `ext.auditor@audit.co.kr`
11. Finding 조회 가능? 상태 변경 → 차단?
12. 보고서 조회 가능? 생성 → 차단?
13. 설정 → 접근 불가?

**group_auditor → 전 법인 읽기:**
14. Login as `auditor@ctr.co.kr`
15. CompanySelector → 전 법인 표시?
16. 법인 전환 → 데이터 변경?
17. Finding 관리 (상태변경, 소명요청) 가능?

**system_admin → 전체:**
18. 모든 페이지 접근 + 모든 CRUD

**체크리스트:**
- [ ] user → settings/budget/compliance 차단
- [ ] dept_head → 자기 부서만
- [ ] external_auditor → 읽기전용
- [ ] group_auditor → 전 법인 + 관리 가능
- [ ] system_admin → 전체 접근
- [ ] Console 403 (500 아님)

### 3-2. URL 조작 테스트

1. user 로그인 → 다른 사람 Finding URL 직접 입력 → 403?
2. dept_head → 타 부서 Finding ID 직접 입력 → 차단?
3. external_auditor → API에 POST/PATCH 직접 호출 → 차단?
4. `/api/findings/<random-uuid>` → 404/403 (크래시 아님)?
5. CompanySelector 없는 역할 → URL에 `?company_id=<other>` → 무시?

### 3-3. 데이터 일관성

1. Finding 상태 변경 → 새로고침 → 유지?
2. 2개 탭에서 같은 Finding → 탭1에서 변경 → 탭2 새로고침 → 반영?
3. 알림 읽음 처리 → 이동 → 복귀 → 읽음 유지?

---

## Run 3/3: Cross-Module Integration

### 5-1. Transaction → Finding 연결
1. Finding 상세 → 연관 거래 정보 표시?
2. 거래 금액/가맹점/MCC가 Finding과 일치?
3. "관련 거래" 탭 → 같은 사용자의 최근 거래 5건?

### 5-2. Finding → Alert 연동
1. Finding 상태 변경 → `/alerts`에 관련 알림 생성?
2. 알림 reference.type === 'finding'?
3. 알림 클릭 → 해당 Finding으로 딥링크?

### 5-3. Budget → Alert 연동
1. 예산 소진율 높은 부서 → budget_warning 알림 존재?
2. 알림 클릭 → `/budget` 이동?

### 5-4. Rules → Findings 영향
1. `/settings/rules`에서 규칙 확인
2. Finding 상세 → risk_breakdown에 규칙 ID/이름 매핑?
3. 규칙 카테고리와 Finding 카테고리 일치?

### 5-5. Dashboard ← 전 모듈 집계
1. 대시보드 KPI ← findings + transactions 데이터 반영?
2. Finding 상태 변경 후 → 대시보드 KPI 업데이트?
3. 리스크 도넛 ← Finding risk_level 분포?
4. 트렌드 차트 ← 월별 추이?

### 5-6. Compliance ← Findings + Rules
1. 컴플라이언스 스코어 = resolved/total × 100?
2. 부서별 랭킹 ← 부서별 Finding 건수?
3. 위반 규칙 분포 ← finding_rules 집계?

### 5-7. Saved Filters (U10) 교차 검증
1. `/findings`에서 필터 저장 → 새로고침 → 불러오기?
2. `/transactions`에서 필터 저장 → 새로고침 → 불러오기?
3. 다른 사용자 → 내 필터 안 보여야 함

### 5-8. Keyboard Shortcuts (U8) 통합
1. 아무 페이지에서 `Ctrl+K` → 커맨드 팔레트?
2. 메뉴 검색 (한글 "거래") → 결과?
3. Enter → 해당 페이지 이동?
4. `?` → 단축키 도움말 오버레이?
5. input 포커스 중 `?` → 오버레이 안 열려야 함

### 5-9. Export (U7) 전 모듈
1. `/findings` → CSV/Excel 내보내기 → 파일 다운로드?
2. `/transactions` → 내보내기?
3. Network 200 확인
4. 빈 결과 내보내기 → 에러 없이 처리?

### 5-10. Multi-Entity 데이터 격리
1. Login as **system_admin** → CompanySelector 전환
2. `/findings` → 해당 법인 Finding만?
3. `/transactions` → 해당 법인 거래만?
4. `/budget` → 해당 법인 예산만?
5. "전체" → 전사 합산?
6. Login as **company_admin** → 타 법인 CompanySelector 안 보여야 함

### 5-11. Alert Realtime (Supabase)
1. 알림 구독 연결 확인 (Network → WebSocket)
2. 새 알림 생성 시 → 벨 카운트 실시간 증가?
3. AlertDropdown 열린 상태 → 새 알림 반영?

### 5-12. Audit Trail 연쇄
1. Finding 상태 변경 → `/settings/logs` 감사로그에 기록?
2. 사용자 역할 변경 → 감사로그?
3. 규칙 수정 → 감사로그?

---

## 최종 판정 형식

```
============================================
CTR PULSE 3차 QA — FINAL VERDICT
============================================

Date: 2026-03-16

RUN 1 (GP & UX):
  GP1 (Finding 워크플로):  PASS / FAIL
  GP2 (예산):              PASS / FAIL
  GP3 (카드/거래):         PASS / FAIL
  GP4 (알림 U11):          PASS / FAIL
  GP5 (보고서/컴플라이언스): PASS / FAIL
  GP6 (설정):              PASS / FAIL
  UX Audit (U1~U11):       X/10

RUN 2 (Security):
  RBAC 6역할:              PASS / FAIL
  URL 조작:                PASS / FAIL
  데이터 일관성:            PASS / FAIL

RUN 3 (Integration):
  12개 파이프라인:          Connected X/12

ISSUES: P0: X | P1: X | P2: X

VERDICT: ✅ READY / ❌ NOT READY
============================================
```

---

## 실행 방법

**혼합 방식 (코드 + 브라우저)** | **Run 1부터 순차 진행**

### Run별 진행 방식
1. **Run 1 실행 → 결과 리포트 → 사용자 리뷰 → Run 2 → ... → Run 3**
2. 각 Run 완료 시 Verdict 출력 후 STOP

### 검증 방법 분배
| 영역 | 방법 | 이유 |
|------|------|------|
| RBAC / 스코프 필터 | **코드** | 권한 로직은 코드가 정확 |
| 데이터 흐름 / API 연결 | **코드** | 모듈 간 join/query 추적 |
| 페이지 로딩 / UI 렌더 | **브라우저** (Preview MCP) | 실제 렌더링 확인 필수 |
| UX 일관성 (U1~U11) | **브라우저** + 코드 | 시각적 확인 + 토큰 사용 검증 |
| 스켈레톤/Empty/Toast | **브라우저** | 런타임 동작 확인 |
| 모바일 반응형 | **브라우저** (375×812) | 뷰포트별 렌더 확인 |

### 실행 순서
1. `npm run dev` 서버 시작
2. **Run 1**: GP1~GP6 + UX Audit → Verdict 출력
3. 사용자 리뷰 후 **Run 2**: Security & RBAC → Verdict 출력
4. 사용자 리뷰 후 **Run 3**: Cross-Module Integration → Final Verdict

### 주요 검증 파일
- **RBAC**: `src/middleware.ts`, `src/types/rbac.ts`, 각 API route의 `requirePermission()` 호출
- **스코프 필터**: `src/types/scope.ts`, 각 API의 `scopeToQueryFilters()` 사용
- **UI 일관성**: `src/constants/colors.ts` (T 토큰), `src/components/ui/` 전체
- **모듈 연결**: `src/app/api/findings/`, `src/app/api/alerts/`, `src/app/api/dashboard/`
- **U8~U11**: `command-palette.tsx`, `AlertDropdown.tsx`, `useAlertRealtime.ts`, `AlertToast.tsx`
