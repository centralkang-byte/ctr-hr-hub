# B10-1: HR 애널리틱스 (이직예측 + 번아웃 감지 + 팀 건강도)

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **트랙**: Week 11 **[B]** 트랙
> **선행 완료**: 전체 Phase B 모듈(B1~B9)의 데이터가 축적된 상태. 이 세션은 모든 모듈의 데이터를 **읽기 전용으로 집계/분석**합니다.

---

## DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `npx prisma migrate dev --name b_analytics`
- 쿼리는 **Prisma Client만** 사용 (raw SQL 금지)
- Supabase는 Auth + Storage + Realtime 용도만
- **마이그레이션 네이밍**: `b_` 접두사 필수 (B 트랙)
- 동시에 [A] B9-2 복리후생 신청이 진행 중 — **migrate는 A 트랙 완료 확인 후** 실행

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 전부 읽기
cat context/SHARED.md
cat context/TRACK_A.md      # A 트랙 상태 참고
cat context/TRACK_B.md      # 이전 B 트랙 작업 확인

# 2. 디자인 시스템 + UI 패턴 확인
cat CLAUDE.md
cat CTR_UI_PATTERNS.md

# 3. 데이터 소스 존재 여부 확인 (최소 5개 이상 있어야 의미있는 분석)
# B3-2: bias_detection_logs (평가 편향)
# B5:   exit_interviews (퇴직면담 — resignationReason, satisfaction)
# B6-1: work_hour_alerts (52시간 경고 이력)
# B6-1: 출퇴근 기록 (초과근무 시간)
# B6-2: leave_balances (연차 사용률)
# B6-2: 원온원 sentimentTag
# B7-1a: payroll_items (급여 데이터)
# B8-3: employee_skill_assessments (역량 갭)
# B9-1: course_enrollments (교육 이수율)

# 4. 위 테이블 중 실제로 존재하는 것만 사용
# 없는 테이블은 해당 지표를 0점(데이터 없음)으로 처리

# ⚡ 이 세션 결과는 context/TRACK_B.md에만 기록하세요
```

---

## 세션 목표

Phase B 전체에서 축적된 데이터를 활용하여 **이직 위험 예측, 번아웃 감지, 팀 심리안전 지수**를 산출하고, HR이 선제적으로 대응할 수 있는 **예측 기반 HR 애널리틱스**를 구축합니다.

**핵심**: 이 세션은 새로운 데이터를 생성하는 것이 아니라, 기존 모듈의 데이터를 **집계→가중합→위험도 산출**하는 분석 레이어입니다.

**UI 기준**: CLAUDE.md 디자인 토큰(green #00C853 primary, Pretendard) + CTR_UI_PATTERNS.md 인터랙션 패턴 준수. 차트는 recharts 사용.

### ⚠️ 이 세션의 특수성

1. **데이터 의존성이 매우 높음** — 전체 B 모듈의 테이블을 참조합니다. 존재하지 않는 테이블에 대한 쿼리가 에러를 내지 않도록 방어 코딩.

2. **분석 결과는 민감 데이터** — "김과장 이직 위험 높음"을 해당 직원이 보면 안 됩니다. HR Admin + 해당 부서장만 열람 가능.

3. **예측 = 확률적 신호, 판단이 아님** — "이직 위험 78%"는 "곧 퇴사합니다"가 아니라 "관심이 필요합니다" 수준.

---

## 핵심 설계 원칙

### 1. 이직 위험 예측 — 10개 신호 가중합

| 신호 | 데이터 소스 | 가중치 | 점수 기준 |
|------|-----------|--------|----------|
| 초과근무 지속 | B6-1 work_hour_alerts | 15% | 최근 4주 중 3주+ 경고 = 높음 |
| 연차 미사용 | B6-2 leave_balances | 10% | 사용률 < 30% = 높음 |
| 원온원 감정 부정 | B6-2 sentimentTag | 15% | 최근 3회 중 2회+ negative = 높음 |
| 급여 밴드 하위 | B7-1a/B7-2 payroll_items | 10% | 밴드 하위 25% = 높음 |
| 승진 정체 | A2 assignments | 10% | 동일 직급 3년+ = 높음 |
| 역량 갭 큼 | B8-3 assessments | 5% | 평균 갭 > 1.5 = 높음 |
| 교육 미이수 | B9-1 enrollments | 5% | 필수교육 미이수 2건+ = 높음 |
| 퇴직면담 패턴 매칭 | B5 exit_interviews | 10% | 동일 부서/직급 퇴직 사유와 현 상황 유사 |
| 평가 등급 하락 | B3-2 evaluations | 10% | 전기 대비 등급 하락 = 높음 |
| 재직기간 | A2 hireDate | 10% | 2~3년차 (이직 피크) = 중간 |

**가중치는 하드코딩 금지** — `AnalyticsConfig` 테이블로 관리하여 HR이 법인별로 조정 가능하게 설계.

### 2. 번아웃 감지 — 5개 지표

```
번아웃 점수 = 가중합(0~100)

1. 초과근무 강도 (30%): 주 평균 근무시간 / 법정상한
2. 연차 미사용률 (20%): 1 - (사용일 / 부여일)
3. 원온원 감정 추이 (20%): 최근 5회 감정 점수 하락 추세
4. 연속 근무일수 (15%): 최근 3개월 내 최장 연속 근무
5. 야간/휴일 근무 빈도 (15%): 야간+휴일 근무 비율
```

### 3. 팀 심리안전 지수 — 팀 단위 집계

```
팀 심리안전 = 팀원 지표 집계

1. 팀 평균 원온원 감정 점수
2. 팀 이직률 (최근 12개월)
3. 팀 평균 연차 사용률
4. 팀 초과근무 분포 편차
5. 퇴직면담 피드백 (해당 팀에서 퇴직한 사람의 만족도)
```

---

## 작업 순서 (8 Tasks)

### Task 1: DB 마이그레이션

> 마이그레이션명: `b_analytics`

```prisma
model TurnoverRiskScore {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @db.Uuid
  calculatedAt    DateTime @default(now())
  overallScore    Float                            // 0~100 (높을수록 위험)
  riskLevel       String   @db.VarChar(10)         // 'low' | 'medium' | 'high' | 'critical'
  signals         Json                             // [{ signal, weight, score, rawData }]
  topFactors      String[] @default([])            // ["초과근무 지속", "원온원 부정적"]
  createdAt       DateTime @default(now())

  @@index([employeeId, calculatedAt])
  @@map("turnover_risk_scores")
}

model BurnoutScore {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @db.Uuid
  calculatedAt    DateTime @default(now())
  overallScore    Float                            // 0~100
  riskLevel       String   @db.VarChar(10)
  indicators      Json                             // [{ indicator, weight, score }]
  createdAt       DateTime @default(now())

  @@index([employeeId, calculatedAt])
  @@map("burnout_scores")
}

model TeamHealthScore {
  id              String   @id @default(uuid()) @db.Uuid
  departmentId    String   @db.Uuid
  companyId       String   @db.Uuid
  calculatedAt    DateTime @default(now())
  overallScore    Float                            // 0~100 (높을수록 건강)
  metrics         Json                             // { avgSentiment, turnoverRate, leaveUsageRate, overtimeVariance, exitSatisfaction }
  riskLevel       String   @db.VarChar(10)         // 'healthy' | 'caution' | 'at_risk'
  memberCount     Int
  createdAt       DateTime @default(now())

  @@index([departmentId, calculatedAt])
  @@map("team_health_scores")
}

model AnalyticsSnapshot {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  snapshotDate    DateTime @db.Date
  type            String   @db.VarChar(30)         // 'turnover_risk' | 'burnout' | 'team_health' | 'headcount' | 'diversity'
  data            Json                             // 스냅샷 데이터
  createdAt       DateTime @default(now())

  @@unique([companyId, snapshotDate, type])
  @@map("analytics_snapshots")
}

model AnalyticsConfig {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  company         Company  @relation(fields: [companyId], references: [id])
  configType      String   @db.VarChar(30)         // 'turnover_weights' | 'burnout_weights' | 'team_health_weights'
  config          Json                             // { signals: [{ key, weight, threshold }] }
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([companyId, configType])
  @@map("analytics_configs")
}
```

---

### Task 2: 이직 위험 예측 엔진

```typescript
// lib/analytics/turnoverRisk.ts

interface SignalResult {
  signal: string;
  weight: number;
  score: number;       // 0~100
  rawData: any;
  available: boolean;  // 데이터 소스 존재 여부
}

async function calculateTurnoverRisk(employeeId: string): Promise<TurnoverRiskResult> {
  const signals: SignalResult[] = [];
  
  // 1~10. 각 신호 계산 (아래 방어적 코딩 패턴 적용)
  signals.push(await calcOvertimeSignal(employeeId));
  signals.push(await calcLeaveUsageSignal(employeeId));
  signals.push(await calcSentimentSignal(employeeId));
  signals.push(await calcSalaryBandSignal(employeeId));
  signals.push(await calcPromotionStagnationSignal(employeeId));
  signals.push(await calcSkillGapSignal(employeeId));
  signals.push(await calcTrainingSignal(employeeId));
  signals.push(await calcExitPatternSignal(employeeId));
  signals.push(await calcEvalTrendSignal(employeeId));
  signals.push(await calcTenureSignal(employeeId));
  
  // 가중합 (available=false인 신호는 가중치 재분배)
  const availableSignals = signals.filter(s => s.available);
  
  // 사용 가능 신호 3개 미만 → "데이터 부족으로 분석 불가"
  if (availableSignals.length < 3) {
    return { overallScore: 0, riskLevel: 'insufficient_data', signals, topFactors: [] };
  }
  
  const totalWeight = availableSignals.reduce((sum, s) => sum + s.weight, 0);
  const overallScore = availableSignals.reduce((sum, s) => {
    const normalizedWeight = s.weight / totalWeight;
    return sum + s.score * normalizedWeight;
  }, 0);
  
  const riskLevel = overallScore >= 75 ? 'critical' 
    : overallScore >= 55 ? 'high'
    : overallScore >= 35 ? 'medium' 
    : 'low';
  
  const topFactors = availableSignals
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)
    .map(s => s.signal);
  
  return { overallScore, riskLevel, signals, topFactors };
}
```

**각 신호 계산 함수 — 방어적 코딩 패턴**:
```typescript
async function calcOvertimeSignal(employeeId: string): Promise<SignalResult> {
  try {
    const alerts = await prisma.workHourAlert.findMany({
      where: {
        employeeId,
        createdAt: { gte: subWeeks(new Date(), 4) }
      }
    });
    
    const weeksWithAlert = new Set(alerts.map(a => a.weekStart.toISOString())).size;
    const score = weeksWithAlert >= 3 ? 90 : weeksWithAlert >= 2 ? 60 : weeksWithAlert >= 1 ? 30 : 0;
    
    return { signal: '초과근무 지속', weight: 0.15, score, rawData: { weeksWithAlert }, available: true };
  } catch {
    return { signal: '초과근무 지속', weight: 0.15, score: 0, rawData: null, available: false };
  }
}

// 나머지 9개 신호도 동일 패턴 — try/catch로 테이블 부재 시 available: false
```

**가중치 로딩**: AnalyticsConfig에서 법인별 가중치를 읽어 사용. 설정이 없으면 위 기본값 사용.

---

### Task 3: 번아웃 감지 엔진

```typescript
async function calculateBurnoutScore(employeeId: string): Promise<BurnoutResult> {
  const indicators = [];
  
  indicators.push(await calcOvertimeIntensity(employeeId));      // 30%
  indicators.push(await calcLeaveNonUsage(employeeId));          // 20%
  indicators.push(await calcSentimentTrend(employeeId));         // 20%
  indicators.push(await calcConsecutiveWorkDays(employeeId));    // 15%
  indicators.push(await calcNightHolidayFrequency(employeeId)); // 15%
  
  // 가중합 (available 기반 재분배 — 이직위험과 동일 패턴)
  const overallScore = weightedSum(indicators);
  const riskLevel = overallScore >= 70 ? 'critical' : overallScore >= 50 ? 'high' : overallScore >= 30 ? 'medium' : 'low';
  
  return { overallScore, riskLevel, indicators };
}
```

---

### Task 4: 팀 심리안전 지수

```typescript
async function calculateTeamHealth(departmentId: string, companyId: string): Promise<TeamHealthResult> {
  const members = await getTeamMembers(departmentId);
  
  const metrics = {
    avgSentiment: await calcTeamAvgSentiment(members),
    turnoverRate: await calcTeamTurnover(departmentId, 12),
    leaveUsageRate: await calcTeamLeaveUsage(members),
    overtimeVariance: await calcTeamOvertimeVariance(members),
    exitSatisfaction: await calcTeamExitSatisfaction(departmentId),
  };
  
  const overallScore = normalizeTeamHealth(metrics);
  const riskLevel = overallScore >= 70 ? 'healthy' : overallScore >= 40 ? 'caution' : 'at_risk';
  
  return { overallScore, riskLevel, metrics, memberCount: members.length };
}
```

---

### Task 5: HR 애널리틱스 대시보드

> **경로**: `/analytics` (HR Admin 전용)
> **디자인**: CLAUDE.md 토큰 + CTR_UI_PATTERNS.md 대시보드 패턴
> **차트**: recharts 사용

```
┌─────────────────────────────────────────────────────┐
│ HR 애널리틱스                      [법인: CTR-KR ▼]  │
│ [이직예측] [번아웃] [팀건강] [인력현황]               │
├─────────────────────────────────────────────────────┤

── 이직예측 탭 ──
│ 📊 이직 위험 분포                                    │
│ 🔴 Critical (75+): 3명  [상세]                      │
│ 🟠 High (55-74):    8명  [상세]                     │
│ 🟡 Medium (35-54):  25명                            │
│ 🟢 Low (0-34):     117명                            │
│                                                     │
│ ⚠️ 주의 대상 (Critical + High)                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 김과장 · 개발팀 · 78점 (Critical)                 │ │
│ │ 주요 요인: 초과근무 지속, 원온원 부정적, 승진 정체   │ │
│ │ [상세 분석] [1-on-1 요청] [보상 검토]              │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ 이대리 · 영업팀 · 68점 (High)                     │ │
│ │ 주요 요인: 급여 밴드 하위, 교육 미이수              │ │
│ │ [상세 분석] [1-on-1 요청] [보상 검토]              │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📈 이직 위험 추이 (최근 6개월) — recharts LineChart   │

── 번아웃 탭 ──
│ 📊 번아웃 위험 분포                                  │
│ (위와 유사한 구조)                                   │
│                                                     │
│ 📈 부서별 번아웃 히트맵                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │        초과근무  연차미사용  감정  연속근무  야간   │ │
│ │ 개발팀    🟠      🟡       🟠     🟡      🟢    │ │
│ │ 생산1팀   🔴      🟡       🟡     🔴      🔴    │ │
│ │ 영업팀    🟡      🔴       🟡     🟢      🟢    │ │
│ └─────────────────────────────────────────────────┘ │

── 팀건강 탭 ──
│ 📊 팀별 심리안전 지수                                │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 인사팀       ██████████████████  82점 🟢 건강    │ │
│ │ 개발팀       ████████████████    72점 🟢 건강    │ │
│ │ 영업팀       ██████████████      62점 🟡 주의    │ │
│ │ 생산1팀      ██████████          45점 🟡 주의    │ │
│ │ 품질관리팀   ████████            35점 🔴 위험    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 품질관리팀 상세:                                     │
│ 감정: 2.1/5 | 이직률: 25% | 연차사용: 28%            │
│ 💡 최근 퇴직자 사유: "관리자 리더십"(2건)              │

── 인력현황 탭 ──
│ (법인별 인원, 직급별 분포, 성별/연령 다양성 차트)      │
└─────────────────────────────────────────────────────┘
```

---

### Task 6: 개인 이직위험 상세 분석 뷰

HR이 특정 직원의 상세 분석을 볼 때:

```
┌────────────────────────────────────────────────┐
│ 김과장 — 이직 위험 상세 분석                      │
│ 위험도: 78/100 🔴 Critical                     │
├────────────────────────────────────────────────┤
│ 📊 신호별 점수                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ (레이더 차트 — recharts RadarChart)       │   │
│ └──────────────────────────────────────────┘   │
│                                                │
│ 상위 요인 분석:                                 │
│                                                │
│ 1. 🔴 초과근무 지속 (90점)                      │
│    최근 4주 중 3주 52시간 경고                    │
│    주 평균: 49.5시간                            │
│                                                │
│ 2. 🔴 원온원 감정 부정 (85점)                    │
│    최근 3회 원온원: 부정(2) + 보통(1)             │
│    "업무량 과다", "승진 기회 불만" 키워드          │
│                                                │
│ 3. 🟠 승진 정체 (70점)                          │
│    S3 직급 3년 2개월 (평균 승진 주기: 2.5년)      │
│                                                │
│ 💡 권장 조치:                                   │
│ ├── 1-on-1 긴급 면담 요청                       │
│ ├── 초과근무 조정 (업무 재분배 검토)              │
│ ├── 승진/보상 검토 (밴드 하위 25%)               │
│ └── 역량 개발 기회 제공                          │
│                                                │
│ [1-on-1 요청] [보상 검토] [이력 보기]             │
└────────────────────────────────────────────────┘
```

---

### Task 7: 배치 계산 + 스냅샷

```typescript
// CRON 또는 수동: 주 1회 전 직원 위험도 배치 계산
async function batchCalculateRiskScores(companyId: string) {
  const employees = await prisma.employeeProfile.findMany({
    where: { companyId, status: 'active' }
  });
  
  for (const emp of employees) {
    const turnover = await calculateTurnoverRisk(emp.id);
    await prisma.turnoverRiskScore.create({ data: { employeeId: emp.id, ...turnover } });
    
    const burnout = await calculateBurnoutScore(emp.id);
    await prisma.burnoutScore.create({ data: { employeeId: emp.id, ...burnout } });
  }
  
  // 팀 건강도
  const departments = await prisma.department.findMany({ where: { companyId } });
  for (const dept of departments) {
    const health = await calculateTeamHealth(dept.id, companyId);
    await prisma.teamHealthScore.create({ data: { departmentId: dept.id, companyId, ...health } });
  }
  
  // 스냅샷 저장 (추이 분석용)
  await prisma.analyticsSnapshot.create({
    data: {
      companyId,
      snapshotDate: new Date(),
      type: 'turnover_risk',
      data: { /* distribution counts */ }
    }
  });
}
```

**API 라우트**:
- `POST /api/v1/analytics/calculate` — 배치 계산 트리거 (HR Admin)
- `GET /api/v1/analytics/turnover-risk` — 이직 위험 목록/상세
- `GET /api/v1/analytics/burnout` — 번아웃 목록/상세
- `GET /api/v1/analytics/team-health` — 팀 건강도 목록
- `GET /api/v1/analytics/trends` — 추이 데이터 (스냅샷)

---

### Task 8: 시드 + 빌드 검증

```bash
# 1. 이직 위험 계산 — 시드 기반 위험도 산출 + 방어 코딩 확인
# 2. 번아웃 감지 — 초과근무 높은 직원 → 번아웃 높음 확인
# 3. 팀 건강도 — 부서별 집계 정확성
# 4. 대시보드 — 4탭 전환 + recharts 차트 렌더링
# 5. 접근 권한 — HR Admin만 열람, 일반 직원 차단
# 6. 배치 계산 — "계산 실행" → 전 직원 계산 → 결과 저장

# 7. 빌드 검증
npx tsc --noEmit      # TypeScript 0 errors
npm run build         # Next.js 빌드 성공

# 8. 컨텍스트 업데이트
# → context/TRACK_B.md에만 기록 (SHARED.md, TRACK_A.md 수정 금지)
```

---

## 검증 체크리스트

- [ ] Prisma 모델 5개 (TurnoverRiskScore, BurnoutScore, TeamHealthScore, AnalyticsSnapshot, AnalyticsConfig)
- [ ] 마이그레이션명 `b_` 접두사 (`b_analytics`)
- [ ] 이직 위험 예측 엔진 (10개 신호 가중합 + 방어 코딩 try/catch)
- [ ] 가중치 AnalyticsConfig 테이블에서 로딩 (하드코딩 금지)
- [ ] 번아웃 감지 엔진 (5개 지표 가중합)
- [ ] 팀 심리안전 지수 (5개 팀 메트릭)
- [ ] HR 애널리틱스 대시보드 (4탭 + recharts 차트 5~6개)
- [ ] 개인 이직위험 상세 분석 뷰 (레이더 차트 + 권장 조치)
- [ ] 배치 계산 + 스냅샷 저장
- [ ] HR Admin 전용 접근 권한
- [ ] CLAUDE.md 디자인 토큰 준수 (green primary, Pretendard, minimal shadow)
- [ ] CTR_UI_PATTERNS.md 인터랙션 패턴 준수
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` 성공
- [ ] `context/TRACK_B.md` 업데이트 완료

---

## context/TRACK_B.md 업데이트 내용 (세션 종료 시)

```markdown
## B10-1 완료 (날짜)

### DB 테이블
- turnover_risk_scores, burnout_scores, team_health_scores
- analytics_snapshots, analytics_configs
- 마이그레이션: b_analytics

### 핵심 함수
- calculateTurnoverRisk() — 10개 신호 가중합
- calculateBurnoutScore() — 5개 지표 가중합
- calculateTeamHealth() — 팀 5개 메트릭 집계
- batchCalculateRiskScores() — 전 직원 배치 계산

### 데이터 의존성 (실제 연결된 테이블 목록 기록!)
- (이 세션에서 실제로 쿼리에 성공한 테이블 목록)
- (available: false로 처리된 신호 목록)

### 다음 세션 연동 포인트
- B9-2 ([A] 트랙): 복리후생 활용률 데이터 → 향후 분석 지표 추가 가능
- B10-2: HR KPI 대시보드에서 이직위험 분포/번아웃 상위를 위젯으로 표시
- B11: 알림 — Critical 이직위험 감지 시 HR+부서장 알림
```

---

## 주의사항

1. **모든 데이터 소스 쿼리를 try/catch로 감싸세요** — B1~B9 중 일부 세션이 미완료일 수 있습니다. 테이블이 없어도 에러가 나지 않고 `available: false`로 처리하여 다른 신호로 분석을 계속합니다.

2. **가중치 재분배 로직이 핵심** — 10개 신호 중 3개가 `available: false`면, 나머지 7개 신호의 가중치를 합이 1.0이 되도록 비례 재분배합니다. 사용 가능한 신호가 **3개 미만**이면 "데이터 부족으로 분석 불가" 표시.

3. **이직 위험 점수는 직원 본인에게 절대 노출 금지** — "당신의 이직 위험이 78%입니다"를 보여주면 자기충족적 예언이 됩니다. HR Admin + 해당 부서장만 열람.

4. **가중치는 설정 테이블로** — 10개 신호의 가중치(15%, 10% 등)를 하드코딩하지 마세요. AnalyticsConfig 테이블로 관리하여 HR이 법인별로 조정 가능하게.

5. **퇴직 패턴 매칭(신호 8)은 충분한 데이터가 쌓인 후에 의미있음** — 초기에는 퇴직면담 데이터가 적으므로 이 신호는 `available: false`가 될 가능성 높음. 1~2년 운영 후 정확도 향상.

6. **스냅샷은 주 1회 저장** — 매일 저장하면 데이터가 너무 많아집니다. 주 1회(월요일 새벽 등) CRON으로 배치 계산 + 스냅샷 저장. 수동 트리거도 가능.

7. **[A] 트랙 충돌 방지** — 이 세션에서 SHARED.md, TRACK_A.md를 수정하지 마세요. migrate 실행 전 [A] 트랙 migrate 완료 여부 확인.
