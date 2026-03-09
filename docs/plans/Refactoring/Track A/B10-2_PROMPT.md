# B10-2: HR KPI 대시보드 + CFR 고도화 + Feedback Badges

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **트랙**: Week 12 **[A]** 트랙
> **선행 완료**: B10-1(HR 애널리틱스 엔진 — [B] 트랙에서 완료), Phase B 전체 모듈

---

## DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `npx prisma migrate dev --name a_kpi_dashboard`
- 쿼리는 **Prisma Client만** 사용 (raw SQL 금지)
- Supabase는 Auth + Storage + Realtime 용도만
- **마이그레이션 네이밍**: `a_` 접두사 필수 (A 트랙)
- 동시에 [B] B11 전반부(설정 패치)가 진행 중 — **migrate는 B 트랙 완료 확인 후** 실행

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 전부 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md      # B10-1 애널리틱스 결과 확인 필수

# 2. 디자인 시스템 + UI 패턴 확인
cat CLAUDE.md
cat CTR_UI_PATTERNS.md

# 3. B10-1 analytics 테이블 확인
# - turnover_risk_scores, burnout_scores, team_health_scores
# - analytics_snapshots, analytics_configs

# 4. 각 모듈별 KPI 데이터 소스 확인
# 존재하는 테이블만 위젯에 연결 (방어 코딩)

# ⚡ 이 세션 결과는 context/TRACK_A.md에만 기록하세요
```

---

## 세션 목표

HR 리더와 경영진이 **한눈에 조직 건강도를 파악**할 수 있는 KPI 대시보드를 구축합니다. 전체 Phase B 모듈에서 핵심 지표를 추출하여 **실시간 위젯 + 트렌드 차트 + 법인 비교**로 시각화합니다.

**핵심**: B10-1이 "분석 엔진"이라면 B10-2는 "경영진 보고용 대시보드". 복잡한 분석 없이 KPI 숫자와 트렌드를 즉시 보여줍니다.

**UI 기준**: CLAUDE.md 디자인 토큰(green #00C853 primary, Pretendard) + CTR_UI_PATTERNS.md 대시보드/카드 패턴 준수. 차트는 **Recharts** 통일.

---

## 핵심 설계 원칙

### 1. 위젯 기반 = 모듈별 독립, 조합 자유

각 위젯은 독립적으로 데이터를 조회합니다. 특정 모듈이 미완료여도 해당 위젯만 "데이터 없음"으로 표시하고 나머지는 정상 동작.

### 2. 3계층 대시보드

```
Level 1: 경영진 요약 (CEO/CHRO) — 6개 핵심 KPI 카드
Level 2: HR 상세 — 모듈별 위젯 그리드 (15~20개)
Level 3: 드릴다운 — 위젯 클릭 시 해당 모듈로 이동
```

### 3. 법인 비교 = 글로벌 뷰

법인별 동일 KPI를 나란히 비교하는 뷰.

---

## 작업 순서 (7 Tasks)

### Task 1: DB 마이그레이션

> 마이그레이션명: `a_kpi_dashboard`

```prisma
model KpiDashboardConfig {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @db.Uuid              // 사용자별 대시보드 구성
  layout        Json                           // 위젯 배치 [{ widgetId, position, size }]
  filters       Json?                          // 기본 필터 (법인, 기간)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId])
  @@map("kpi_dashboard_configs")
}
```

---

### Task 2: 경영진 요약 — 6개 핵심 KPI

> **경로**: `/dashboard` (메인 대시보드, HR Admin + 경영진)
> **디자인**: CLAUDE.md 카드 패턴 + 전월 대비 변동 표시

```
┌─────────────────────────────────────────────────────┐
│ HR Dashboard            [법인: 전체 ▼] [2025 ▼]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ 총 인원   │ │ 이직률    │ │ 채용 중   │             │
│ │  1,247명  │ │  8.2%    │ │  15건    │             │
│ │ ▲+12 전월 │ │ ▼-0.5%p │ │ 평균45일  │             │
│ └──────────┘ └──────────┘ └──────────┘             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ 이직위험  │ │ 연차사용  │ │ 교육이수  │             │
│ │ 🔴11명   │ │  62%     │ │  87%     │             │
│ │ High+Crit│ │ ▲+5%p   │ │ 법정 92% │             │
│ └──────────┘ └──────────┘ └──────────┘             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**6개 핵심 KPI**:

| KPI | 데이터 소스 | 계산 |
|-----|-----------|------|
| 총 인원 | A2 employee_profiles (status='active') | COUNT |
| 이직률 | A2 (퇴직자/평균인원 ×100) | 최근 12개월 |
| 채용 진행 | B4 requisitions (status='approved') + job_postings | COUNT + 평균 소요일 |
| 이직 위험 | B10-1 turnover_risk_scores (high+critical) | COUNT |
| 연차 사용률 | B6-2 leave_balances (used/entitled) | AVG |
| 교육 이수율 | B9-1 course_enrollments (completed/total) | % |

**전월 대비**: B10-1 `analytics_snapshots`에서 전월 데이터 비교. 스냅샷 없으면 변동 표시 생략.

---

### Task 3: HR 상세 — 모듈별 위젯 그리드

```
┌─────────────────────────────────────────────────────┐
│ [요약]  [인력]  [채용]  [성과]  [근태]  [급여]  [교육] │
├─────────────────────────────────────────────────────┤

── 인력 섹션 ──
│ ┌────────────────────┐ ┌────────────────────┐      │
│ │ 📊 직급별 인원 분포  │ │ 📊 법인별 인원 분포  │      │
│ │ (수평 바 차트)       │ │ (도넛 차트)         │      │
│ └────────────────────┘ └────────────────────┘      │
│ ┌────────────────────┐ ┌────────────────────┐      │
│ │ 📊 입퇴사 추이      │ │ 📊 근속 분포         │      │
│ │ (12개월 라인 차트)   │ │ (히스토그램)         │      │
│ └────────────────────┘ └────────────────────┘      │

── 채용 섹션 ──
│ ┌────────────────────┐ ┌────────────────────┐      │
│ │ 📊 채용 파이프라인   │ │ 📊 평균 충원 소요일  │      │
│ │ (단계별 퍼널)       │ │ (법인별 바 차트)     │      │
│ └────────────────────┘ └────────────────────┘      │
│ ┌────────────────────┐                             │
│ │ 📊 Talent Pool 현황 │                             │
│ │ 활성/만료예정/매칭   │                             │
│ └────────────────────┘                             │

── 성과 섹션 ──
│ ┌────────────────────┐ ┌────────────────────┐      │
│ │ 📊 평가 등급 분포    │ │ 📊 9-Block 분포     │      │
│ │ (법인별 바 차트)     │ │ (9칸 히트맵)        │      │
│ └────────────────────┘ └────────────────────┘      │
│ ┌────────────────────┐                             │
│ │ 📊 스킬 갭 Top 5    │                             │
│ │ (갭 큰 역량 순위)    │                             │
│ └────────────────────┘                             │

── 근태 섹션 ──
│ ┌────────────────────┐ ┌────────────────────┐      │
│ │ 📊 52시간 현황      │ │ 📊 연차 사용 추이    │      │
│ │ (경고 단계별 인원)   │ │ (12개월 라인)       │      │
│ └────────────────────┘ └────────────────────┘      │
│ ┌────────────────────┐                             │
│ │ 📊 번아웃 위험 분포  │                             │
│ │ (B10-1 연동)       │                             │
│ └────────────────────┘                             │

── 급여 섹션 ──
│ ┌────────────────────┐ ┌────────────────────┐      │
│ │ 📊 법인별 인건비     │ │ 📊 급여 밴드 분포    │      │
│ │ (KRW 환산 바 차트)   │ │ (밴드 이탈 경고)     │      │
│ └────────────────────┘ └────────────────────┘      │

── 교육 섹션 ──
│ ┌────────────────────┐ ┌────────────────────┐      │
│ │ 📊 법정교육 이수현황 │ │ 📊 복리후생 활용률   │      │
│ │ (과정별 %)         │ │ (카테고리별 %)      │      │
│ └────────────────────┘ └────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

**탭 전환 시 해당 탭 위젯만 로드** (lazy loading) — 15~20개 동시 호출 방지.
**요약 탭의 6개 KPI만 초기 로드**.

---

### Task 4: 위젯 컴포넌트 아키텍처

```typescript
// components/dashboard/KpiWidget.tsx
interface KpiWidgetProps {
  title: string;
  dataFetcher: () => Promise<any>;
  chartType: 'number' | 'bar' | 'line' | 'donut' | 'heatmap' | 'funnel';
  drilldownPath?: string;    // 클릭 시 이동할 경로
}

function KpiWidget({ title, dataFetcher, chartType, drilldownPath }: KpiWidgetProps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    dataFetcher()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetEmpty title={title} message="데이터를 불러올 수 없습니다" />;
  
  return (
    <div className="..." onClick={() => drilldownPath && router.push(drilldownPath)}>
      <h3>{title}</h3>
      <ChartRenderer type={chartType} data={data} />
    </div>
  );
}
```

**핵심**: 각 위젯이 독립적으로 데이터 fetch → 하나가 실패해도 나머지 정상.

---

### Task 5: 법인 비교 뷰

> **경로**: `/dashboard/compare`

```
┌─────────────────────────────────────────────────────┐
│ 글로벌 비교                      KPI: [이직률 ▼]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 이직률 법인 비교 (최근 12개월)                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ KR  ████████  8.2%                               │ │
│ │ US  ██████████████  14.5%                        │ │
│ │ CN  ██████████  10.3%                            │ │
│ │ RU  ████████████  12.1%                          │ │
│ │ VN  ██████  6.8%                                 │ │
│ │ MX  ████████████████  16.2%                      │ │
│ │ 전체 ██████████  10.5%                            │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📈 12개월 추이 (법인별 라인) — Recharts LineChart     │
│                                                     │
│ KPI 선택: [이직률] [연차사용] [초과근무] [교육이수]    │
│           [평균급여] [채용소요일] [인건비]             │
└─────────────────────────────────────────────────────┘
```

---

### Task 6: 데이터 집계 API

```typescript
// API Routes — /api/v1/dashboard/

// 핵심 KPI 6개 요약
// GET /api/v1/dashboard/summary?companyId=&year=
async function getDashboardSummary(companyId: string | null, year: number) {
  const [headcount, turnover, openPositions, riskCount, leaveUsage, trainingRate] = await Promise.allSettled([
    countActiveEmployees(companyId),
    calcTurnoverRate(companyId, year),
    countOpenRequisitions(companyId),
    countHighRiskEmployees(companyId),
    calcAvgLeaveUsage(companyId, year),
    calcTrainingCompletionRate(companyId, year),
  ]);
  
  // fulfilled → value, rejected → null
  return {
    headcount: headcount.status === 'fulfilled' ? headcount.value : null,
    turnoverRate: turnover.status === 'fulfilled' ? turnover.value : null,
    // ... 동일 패턴
  };
}

// 모듈별 위젯 데이터
// GET /api/v1/dashboard/widgets/:widgetId?companyId=&period=

// 법인 비교
// GET /api/v1/dashboard/compare?kpi=turnover_rate&year=
async function getGlobalComparison(kpi: string, year: number) {
  const companies = await prisma.company.findMany();
  const results = await Promise.all(
    companies.map(async (c) => ({
      company: c.code,
      value: await calcKpiValue(kpi, c.id, year),
    }))
  );
  return results;
}
```

**`Promise.allSettled` 사용** — 하나의 쿼리 실패가 전체를 망가뜨리지 않음.

---

### Task 7: 시드 + 빌드 검증

```bash
# 1. 경영진 요약
#    - 6개 KPI 카드 표시 (데이터 있으면 숫자, 없으면 "–")
#    - 전월 대비 변동 표시 (analytics_snapshots 연동)

# 2. 모듈별 위젯
#    - 각 탭별 위젯 렌더링 (lazy loading 확인)
#    - Recharts 차트 정확성
#    - 위젯 클릭 → 드릴다운 경로 이동

# 3. 법인 비교
#    - KPI 선택 → 6법인 바 차트
#    - 12개월 추이 라인 차트

# 4. 방어 코딩
#    - 특정 모듈 테이블 없을 때 → 해당 위젯만 "데이터 없음"
#    - 나머지 위젯 정상 동작

# 5. 접근 권한
#    - HR Admin + 경영진만 접근

# 6. 빌드 검증
npx tsc --noEmit      # TypeScript 0 errors
npm run build         # Next.js 빌드 성공

# 7. 컨텍스트 업데이트
# → context/TRACK_A.md에만 기록 (SHARED.md, TRACK_B.md 수정 금지)
```

---

## 검증 체크리스트

- [ ] Prisma 모델 1개 (KpiDashboardConfig)
- [ ] 마이그레이션명 `a_` 접두사 (`a_kpi_dashboard`)
- [ ] 경영진 요약 — 6개 핵심 KPI 카드 + 전월 대비 변동
- [ ] HR 상세 — 모듈별 위젯 그리드 (인력/채용/성과/근태/급여/교육 6탭, 15~20개 위젯)
- [ ] KpiWidget 독립 컴포넌트 (로딩/에러/빈상태 처리)
- [ ] 탭별 lazy loading (요약 탭만 초기 로드)
- [ ] 법인 비교 뷰 (KPI 선택 + 바 차트 + 추이 라인)
- [ ] 데이터 집계 API (Promise.allSettled 방어 코딩)
- [ ] 드릴다운 — 위젯 클릭 시 해당 모듈로 이동
- [ ] 경영진 접근 시 법인 필터 기본값 (CHRO/CEO → 전체, 법인장 → 자기 법인)
- [ ] CLAUDE.md 디자인 토큰 준수 (green primary, Pretendard, minimal shadow)
- [ ] CTR_UI_PATTERNS.md 인터랙션 패턴 준수
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` 성공
- [ ] `context/TRACK_A.md` 업데이트 완료

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B10-2 완료 (날짜)

### DB 테이블
- kpi_dashboard_configs
- 마이그레이션: a_kpi_dashboard

### 주요 라우트
- /dashboard — 메인 HR KPI 대시보드
- /dashboard/compare — 글로벌 법인 비교

### 위젯 목록 (실제 구현된 것만 기록)
- (widgetId: 데이터소스: 차트타입)

### 다음 세션 연동 포인트
- B11 ([B] 트랙 전반부): 시스템 설정에 대시보드 위젯 설정 통합
- B11 (후반부): 대시보드 알림 뱃지 (위험 KPI 하이라이트), Teams 연동
```

---

## 주의사항

1. **위젯은 독립적이어야 함** — 하나의 위젯이 실패해도 다른 위젯에 영향 없음. `Promise.allSettled` + 개별 `try/catch`.

2. **전월 대비 변동은 analytics_snapshots 활용** — B10-1에서 저장한 스냅샷으로 전월/전주 데이터를 비교합니다. 스냅샷이 없으면 변동 표시 생략.

3. **차트 라이브러리는 Recharts 통일** — 이미 다른 세션에서 Recharts를 사용하고 있으므로 통일. 바 차트, 라인 차트, 도넛 차트, 레이더 차트 등.

4. **대시보드 로딩 성능** — 15~20개 위젯이 동시에 API를 호출하면 부하가 큼. **탭 전환 시 해당 탭의 위젯만 로드**(lazy loading). 요약 탭의 6개 KPI만 초기 로드.

5. **경영진 접근 시 법인 필터 기본값** — CHRO/CEO는 "전체" 기본, 법인장은 자기 법인 기본. 사용자 역할에 따라 기본 필터 설정.

6. **[B] 트랙 충돌 방지** — 이 세션에서 SHARED.md, TRACK_B.md를 수정하지 마세요. migrate 실행 전 [B] 트랙 migrate 완료 여부 확인.
