# B10-2 HR KPI 대시보드 설계

> 날짜: 2026-03-03
> 트랙: Week 12 [A]
> 승인: ✅

---

## 1. 목표

HR 리더와 경영진이 한눈에 조직 건강도를 파악할 수 있는 KPI 대시보드 구축.
Phase B 전체 모듈의 핵심 지표를 실시간 위젯 + 트렌드 차트 + 법인 비교로 시각화.

---

## 2. 라우트 구조

```
/dashboard          ← HR KPI 메인 대시보드 (신규)
/dashboard/compare  ← 글로벌 법인 비교 뷰 (신규)
/                   ← 기존 역할별 홈 (유지)
```

접근 권한: `HR_ADMIN`, `SUPER_ADMIN`, `EXECUTIVE`

---

## 3. 아키텍처

### 접근법: 클라이언트 완전 독립 위젯

- 모든 위젯이 클라이언트에서 독립적으로 API 호출
- 한 위젯 실패 → 다른 위젯 정상 동작
- 탭 전환 시 해당 탭 위젯만 마운트 (lazy loading)
- 기존 `apiClient` 패턴 재사용, 추가 의존성 없음

### 파일 구조

```
src/app/(dashboard)/dashboard/
├── page.tsx                    ← Server Component (권한 체크 + 법인 목록)
├── DashboardClient.tsx         ← 탭 상태 + 필터 (법인/연도)
└── compare/
    ├── page.tsx
    └── CompareClient.tsx

src/components/dashboard/
├── KpiWidget.tsx               ← 추상 위젯 (로딩/에러/빈상태)
├── KpiSummaryCard.tsx          ← 숫자형 KPI 카드 + 전월 대비
├── ChartRenderer.tsx           ← chartType별 Recharts 렌더러
├── WidgetSkeleton.tsx
└── WidgetEmpty.tsx

src/app/api/v1/dashboard/
├── summary/route.ts            ← GET: 6개 핵심 KPI
├── widgets/[widgetId]/route.ts ← GET: 탭별 위젯 데이터
└── compare/route.ts            ← GET: 법인 비교 데이터
```

---

## 4. DB 변경

### 신규 모델

```prisma
model KpiDashboardConfig {
  id        String   @id @default(uuid())
  userId    String
  layout    Json
  filters   Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId])
  @@map("kpi_dashboard_configs")
}
```

- 마이그레이션명: `a_kpi_dashboard`
- `@db.Uuid` 사용 금지 (프로젝트 컨벤션)

---

## 5. 3계층 대시보드

### Level 1: 경영진 요약 (초기 로드)

| KPI | 데이터 소스 | 방어 코딩 |
|-----|------------|----------|
| 총 인원 | EmployeeAssignment (status=ACTIVE, isPrimary=true, endDate=null) | null → `–` |
| 이직률 | terminated / 평균인원 × 100 (최근 12개월) | AnalyticsSnapshot 없으면 직접 계산 |
| 채용 진행 | Requisition (status=approved) + 평균 소요일 | 테이블 없으면 null |
| 이직 위험 | TurnoverRiskScore (HIGH + CRITICAL) | B10-1 존재 확인됨 |
| 연차 사용률 | LeaveYearBalance avg(used/entitled) | null → `–` |
| 교육 이수율 | TrainingEnrollment COMPLETED / total | B9-1 존재 확인됨 |

전월 대비: `AnalyticsSnapshot`에서 비교, 없으면 변동 표시 생략.

### Level 2: HR 상세 (탭별 lazy 로드)

**6탭 × 총 17개 위젯:**

| 탭 | widgetId | 차트 | 드릴다운 |
|----|---------|------|---------|
| 인력 | workforce-grade | bar (horizontal) | /employees |
| 인력 | workforce-company | donut | /org |
| 인력 | workforce-trend | line (12개월) | /employees |
| 인력 | workforce-tenure | bar (histogram) | /employees |
| 채용 | recruit-pipeline | funnel | /recruitment |
| 채용 | recruit-ttr | bar (법인별) | /recruitment |
| 채용 | recruit-talent-pool | number | /recruitment/talent-pool |
| 성과 | perf-grade | bar (법인별) | /performance |
| 성과 | perf-9block | heatmap | /performance/calibration |
| 성과 | perf-skill-gap | bar (Top5) | /organization/skill-matrix |
| 근태 | attend-52h | bar (단계별) | /attendance/admin |
| 근태 | attend-leave-trend | line (12개월) | /leave |
| 근태 | attend-burnout | bar | /analytics/team-health |
| 급여 | payroll-cost | bar (KRW 환산) | /payroll/global |
| 급여 | payroll-band | bar (밴드 이탈) | /compensation |
| 교육 | training-mandatory | bar (%) | /training |
| 교육 | training-benefit | bar (카테고리) | /benefits |

### Level 3: 드릴다운

위젯 클릭 → `drilldownPath`로 `router.push()` 이동.

---

## 6. 법인 비교 뷰 (`/dashboard/compare`)

- KPI 선택 드롭다운: 이직률, 연차사용, 초과근무, 교육이수, 평균급여, 채용소요일, 인건비
- 가로 바 차트 (Recharts BarChart horizontal): 6법인 + 전체 평균
- 12개월 추이 라인 차트 (Recharts LineChart): 법인별 색상 구분

---

## 7. 접근 권한 + 법인 필터

- SUPER_ADMIN / CHRO / CEO → 법인 필터 기본값: "전체"
- HR_ADMIN (법인 소속) → 자기 법인만
- EXECUTIVE → 자기 법인 (전체 읽기 권한 없음)

---

## 8. 디자인 토큰

- Primary: `#00C853` (FLEX Green)
- 카드: `rounded-xl border border-[#E8E8E8]` (shadow 없음)
- KPI 숫자: `text-3xl font-bold text-[#1A1A1A]`
- 차트 팔레트: `#00C853, #059669, #F59E0B, #8B5CF6, #EC4899, #06B6D4`
- 차트 라이브러리: Recharts 통일

---

## 9. 방어 코딩 원칙

- `Promise.allSettled` — 하나의 쿼리 실패가 전체를 망가뜨리지 않음
- 위젯별 독립 `try/catch` — 개별 실패 시 `WidgetEmpty` 표시
- 테이블 미존재 시 → `null` 반환 → `–` 표시
- B10-1 스냅샷 없으면 전월 비교 생략 (에러 없이)
