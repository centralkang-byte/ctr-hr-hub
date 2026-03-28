# CTR HR Hub E2E QA & PM Report

## 1. [테스트 커버리지]
*(방문 및 검증한 전체 페이지 목록 — 섹션별로 정리, 각 페이지의 상태 (✅ 정상 / ⚠️ 경미 / 🚨 심각))*

## 2. [사이드바 7섹션 검증 결과]
- **HR Admin 계정 접속 결과**: 7개 섹션(홈, 나의 공간, 팀 관리, 인사 운영, 인재 관리, 인사이트, 설정) 모두 정상 노출됨.
- **Employee 계정 접속 결과**: 2개 섹션(홈, 나의 공간)만 노출됨 (의도된 권한 작동 확인).
- **Manager 계정 접속 결과**: 3개 섹션(홈, 나의 공간, 팀 관리)만 노출됨 (의도된 권한 작동 확인).
- **정상 작동 메뉴**: 홈, 나의 공간, 인사 운영, 인재 관리, 설정, 팀 관리(팀 현황)
- **비정상 작동 메뉴**:
  - **인사이트**: `Executive Summary` 화면 진입 시 완전히 빈 화면 렌더링 (헤더만 보임).
  - **팀 관리**:
    - `팀 현황` 메뉴 진입 시 무한 로딩 발생 이력이 있었으나, 재확인 결과 정상 진입 가능.
    - `팀 성과` 메뉴 진입 시 애플리케이션 크래시 발생 (`ReferenceError: dialogProps is not defined`).

## 3. [EmployeeCell/Peek Card 15개 화면 검증 결과]
*(화면별 정상/비정상 여부, Peek Card hover 작동, trailing 정상 여부)*

## 4. [결함 및 미구현 (Red Flag) 🚨]
- **P0** `[팀 성과 크래시]`: Manager 계정으로 팀 관리 -> 팀 성과 진입 시 `ReferenceError: dialogProps is not defined` 에러 발생하며 앱 전체 크래시 발생 (TeamGoalsClient.tsx). 증빙: ![Team Performance Crash](/Users/sangwoo/.gemini/antigravity/brain/604a1adf-3478-4598-b6cc-403361b24d22/manager_team_performance_error_1773494541095.png)
- **P0** `[나의 공간 - 목표/평가 크래시]`: 나의 공간 -> 목표/평가 진입 후 내부의 '팀 목표 조회(`/performance/goals`)' 메뉴 클릭 시 원인 불명의 오류로 앱 크래시 발생. 증빙: ![](/Users/sangwoo/.gemini/antigravity/brain/604a1adf-3478-4598-b6cc-403361b24d22/.system_generated/click_feedback/click_feedback_1773495113622.png)
- **P1** `[인사이트 빈 화면]`: 인사이트 -> Executive Summary 진입 시 콘텐츠 렌더링 안 됨 (빈 회색 배경만 표시). 증빙: ![Insights Blank Area](/Users/sangwoo/.gemini/antigravity/brain/604a1adf-3478-4598-b6cc-403361b24d22/blank_executive_summary_1773494124862.png)
- **P1** `[승인함 데이터 불일치]`: 사이드바의 '승인함' 뱃지에는 46개의 대기가 있다고 표시되나, 실제 `/approvals/inbox` 페이지 진입 시 아무런 데이터가 표시되지 않음 (빈 화면). 증빙: ![](/Users/sangwoo/.gemini/antigravity/brain/604a1adf-3478-4598-b6cc-403361b24d22/.system_generated/click_feedback/click_feedback_1773495285071.png)

## 5. [Silent Error & 경미한 UI 버그 목록]
- **휴가 신청 모달 UI 버그**: 휴가 신청 모달창 내 최상단에 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석 텍스트가 그대로 노출되어 있음. (코드 레벨에서 임시 패치 완료)
- **Date Picker 불안정**: 모달 등 좁은 영역에서 캘린더 컴포넌트(Date Picker) 클릭 시 날짜 선택이 리셋되거나 다른 영역을 가리는 등 UX 플로우가 불안정함.
- **모바일 햄버거 메뉴 누락 (375px)**: 모바일 뷰포트 시 하단 탭 바 (Home, Attendance, Approvals, Profile)만 나타날 뿐, 그 외의 메뉴(Performance, Settings 등)로 진입할 수 있는 햄버거 형태(Hamburger Menu)의 토글 UI가 헤더에 구현되어 있지 않아 내비게이션 불능 상태에 빠짐.
- **모바일 그리드 압박**: Dashboard의 '주의가 필요합니다' Alert 카드들이 375px 화면에서도 2x2 그리드로 표시되어 글자가 깨지거나 심하게 압축되어 보임. 1열(1 Column)로 풀려야 함.

## 6. [다국어 검증 결과]
*(영문 전환 시 발견된 하드코딩 한국어 목록)*
- **일부 번역 누락 (Mixed State)**: 헤더의 Language Switcher 작동 시 GNB, 기본 메뉴 등은 EN으로 전환되나 메인 데스크탑 컨텐츠 영역의 헤딩(예: "설정", "매니저 허브", "팀원 수", "주의가 필요합니다" 등)은 번역되지 않고 **한국어로 하드코딩**되어 노출되는 상태임. 다국어(`next-intl` 또는 기타) 처리의 커버리지가 매우 낮음.

## 7. [모바일 반응형 검증 결과]
- 375px 뷰포트 테스트 결과, 앞서 명시된 것처럼 **햄버거 메뉴의 부재**로 인해 하단 탭(Home, Attendance, Approvals, Profile)을 제외한 나머지 뎁스 메뉴(팀 관리, 인재 관리, 설정 등)로 일절 접근할 수 없는 **치명적 내비게이션 결함**이 존재함.
- Dashboard 위젯 중 일부(특히 Alert 카드)가 모바일 분기(breakpoint) 처리가 안 되어 우겨넣어지듯 렌더링되며 텍스트 가독성이 거의 상실됨.

## 8. [데이터 품질]
- **데이터 정합성 오류**: 승인함 사이드바 뱃지에는 대기 항목 개수가 표시되나, 실제 리스트는 API/조건 불일치 문제로 빈 배열을 뱉고 있음.
- **Talent 데이터 404**: 인재 관리 페이지 자체 라우팅 및 데이터 로드가 실패하여 빈 화면이 출력되는 현상 확인.

## 9. [성능 체감]
- 인증 후 첫 진입 속도는 우수하나, 페이지 및 탭 전환 시 `Skeleton` UI가 너무 길게, 그리고 잦게 렌더링 됨. 특히 서버사이드 데이터 패칭의 최적화가 필요해 보임.

## 10. [UX & 업무 플로우 개선 제안 💡]
1. [**다국어(i18n) 처리 구조 정비**]: 현재 GNB 등 껍데기만 영문화되고 실제 메인 콘텐츠 헤딩과 상태 라벨은 하드코딩된 'Mixed State' 상태임. 관리자/팀원 글로벌 스케일 대응을 위해 모든 정적 텍스트를 [messages/en.json](file:///Users/sangwoo/VibeCoding/HR_Hub/ctr-hr-hub/messages/en.json) 기반 키 구조로 스윕(Sweep)하고 추출해야 함.
2. [**EmployeeCell 및 Peek Card 상호작용 인입**]: 글로벌 선두 HR 솔루션들처럼 직원 이름/아바타에 hover 시 팝오버를 통해 상태(휴가 중인지, 부서, 직급)와 퀵 액션(메시지 보내기, 이메일, 프로필)을 한눈에 볼 수 있도록 [EmployeeCell](file:///Users/sangwoo/VibeCoding/HR_Hub/ctr-hr-hub/src/components/common/EmployeeCell.tsx#283-435) 컴포넌트의 전면적인 공통화와 팝오버 연동이 필요함.
3. [**모바일 내비게이션 (Drawer) 도입**]: 모바일 사용자를 위한 Bottom Navigation만으로는 복잡한 HR 메뉴를 감당할 수 없음. 모바일 레이아웃 시 최상단 헤더에 햄버거 아이콘을 배치하고, 좌측에서 슬라이드 인(Slide-in) 되는 Drawer 형태의 전체 메뉴 내비게이션 시스템을 구축해야 함.
4. [**승인/결재 뱃지(Count) 동기화 파이프라인 정비**]: 사이드바 뱃지를 반환하는 쿼리와 리스트를 그리는 쿼리의 로직을 일치시켜 유령 알림 현상을 즉각 제거해야 함.

## 11. [Next Step (CTO 의사결정 옵션)]
보고된 이슈 중 어떤 작업을 우선 전개할지 선택해 주십시오:

- 👉 **[Option A] 크리티컬 결함 및 크래시 제거 (안정화 집중)**
  - '팀 목표' 페이지 크래시 원인 제거 (React Hook Rules 위반 수정 등)
  - 인사이트 빈 화면 이슈 및 Talent 404 라우트 수정
  - 승인함 알림 개수 뱃지와 실제 리스트 데이터 불일치 버그 픽스
- 👉 **[Option B] 모바일/다국어/UX 고도화 (사용성 향상 집중)**
  - 모바일(375px)용 글로벌 내비게이션 햄버거 메뉴/Drawer 구현
  - 앱 전체 하드코딩 텍스트 스캔 및 `next-intl` 적용 (KO/EN 완전 분리)
  - [EmployeeCell](file:///Users/sangwoo/VibeCoding/HR_Hub/ctr-hr-hub/src/components/common/EmployeeCell.tsx#283-435) Peek Card 컴포넌트 전면 공통화 및 Quick Action 구현
