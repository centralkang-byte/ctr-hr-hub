# STEP 6A: 성과관리 코어 설계 문서
> 날짜: 2026-02-28

## 범위
EMS 9블록 + MBO 목표관리 + 성과평가 + 캘리브레이션 + CFR(1:1/Recognition) + Pulse Survey + 다면평가(360°)

## 기술 결정

### Prisma 스키마
이미 정의됨. 주요 모델: PerformanceCycle, MboGoal, MboProgress, PerformanceEvaluation, EmsBlockConfig, CalibrationRule, CalibrationSession, CalibrationAdjustment, OneOnOne, Recognition, PulseSurvey, PulseQuestion, PulseResponse, CollaborationScore, PeerReviewNomination

### 주요 패턴
- API: `withPermission(handler, perm(MODULE.PERFORMANCE, ACTION.VIEW))`
- 페이지: Server Component(session) → Client Component(user prop)
- 데이터: `apiClient.getList<T>()` / `apiClient.get<T>()`
- AI: `callClaude()` → `JSON.parse()` + `ai_logs` 기록 + `AiGeneratedBadge`
- 차트: recharts 3.7.0
- Decimal 필드: `Number()` 변환 필수
- PerformanceCycle, EmsBlockConfig 등: deletedAt 없음 → hard delete

### EMS 9블록 산출 로직 (lib/ems.ts)
```
thresholds: [0, 2.33, 3.67, 5.01]
  Low: 0 ≤ score < 2.33
  Mid: 2.33 ≤ score < 3.67
  High: 3.67 ≤ score < 5.01

performanceLow + competencyLow = 블록 1
performanceMid + competencyLow = 블록 2
performanceHigh + competencyLow = 블록 3
performanceLow + competencyMid = 블록 4
performanceMid + competencyMid = 블록 5
performanceHigh + competencyMid = 블록 6
performanceLow + competencyHigh = 블록 7
performanceMid + competencyHigh = 블록 8
performanceHigh + competencyHigh = 블록 9
```

### 사이클 상태 머신
```
DRAFT → ACTIVE → EVAL_OPEN → CALIBRATION → CLOSED
```
(스키마의 CycleStatus 기준)

### 페이지 구조
```
/performance                     → 성과 대시보드 (역할별)
/performance/cycles              → 사이클 관리 (HR_ADMIN)
/performance/cycles/new          → 사이클 생성
/performance/cycles/[id]         → 사이클 상세
/performance/goals               → 내 목표 (EMPLOYEE)
/performance/goals/new           → 목표 생성
/performance/team-goals          → 팀 목표 (MANAGER)
/performance/self-eval           → 자기평가
/performance/manager-eval        → 매니저 평가
/performance/calibration         → 캘리브레이션 세션 (HR_ADMIN)
/performance/calibration/[id]    → 9블록 매트릭스
/performance/results             → 내 결과 (EMPLOYEE)
/performance/team-results        → 팀 결과 (MANAGER)
/performance/admin               → 전사 분석 (HR_ADMIN)
/performance/one-on-one          → 1:1 미팅
/performance/one-on-one/[id]     → 1:1 상세
/performance/recognition         → Recognition 피드
/performance/recognition/stats   → Recognition 통계
/pulse                           → Pulse 응답 (EMPLOYEE)
/pulse/surveys                   → 설문 관리 (HR_ADMIN)
/pulse/surveys/new               → 설문 생성
/pulse/surveys/[id]              → 설문 상세/질문관리
/pulse/results/[id]              → 결과 분석
/performance/peer-review/setup   → 다면평가 평가자 선정 (HR_ADMIN)
/performance/peer-review         → 내 다면평가 실시 (EMPLOYEE)
/performance/peer-review/results → 다면평가 결과
```

## API 라우트 설계
스펙 STEP6A의 API 섹션 그대로 따름 (총 ~30개 엔드포인트)

## 구현 순서 (6 Phases)
1. 기반: EMS 유틸 + 사이클 CRUD + MBO 목표 CRUD
2. 평가 코어: 자기평가 + 매니저 평가 + AI 코멘트
3. 캘리브레이션 + 결과: 규칙/세션 + 9블록 매트릭스 + 결과 조회
4. CFR: 1:1 미팅 + Recognition
5. Pulse Survey: 설문 관리 + 응답 + 결과
6. 다면평가: 추천엔진 + 선정 + 실시 + 결과

## UI 디자인 원칙
- 기존 CTR 브랜드 (primary #003876, accent #E63312)
- PageHeader + 커스텀 table (discipline 패턴)
- 9블록: CSS Grid 3x3, 블록별 색상 (🔴🟠🟡🟢🔵🟣)
- 차트: recharts (RadarChart, BarChart, LineChart, PieChart)
- 모든 AI 결과: AiGeneratedBadge 표시
