# N+31 Pre-flight — wd-stat-strip 4 chips 도입 (ON-002 + X4 + Q4)

> **base SHA**: `1cd4a77c` · **트랙**: codebase + cross-batch SSOT 의존 · **우선**: HIGH
> **결정 (Stage 3 Q4=A)**: PageHeader 유지 + wd-stat-strip 4 chips (진행 중/지연/완료/이번 주 입사). **batch 05 N+24 StatusChips SSOT cross-batch 활용**.
> **본 pre-flight 결과 (요약)**: ⭐ batch 05 N+24 선행 필수. consumer 2 dashboard surface 식별. chip data source 정합.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### batch 05 N+24 cross-ref

`docs/phase-3a/stage4-preflight/n24-page-h-status-chips.md` (192 lines):
- **StatusChips SSOT** = 신규 컴포넌트 `src/components/shared/StatusChips.tsx` (~80 lines) 신설 권고
- Props spec: `{ chips: StatusChip[], className }`, 6 variant (default/accent/success/warning/danger/zero)
- batch 03/04/05/07 공통화 cross-batch 진입 권고

### Codebase 현황

| 파일 | 라인 | 핵심 발견 |
|---|---|---|
| `src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx` | 221+ | **PageHeader 이미 적용** ✅ (title + description). chips 부재 |
| `src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx` | ~280 | **PageHeader 이미 적용** ✅. chips 부재 |
| 기타 6 sub-surface | — | StatusBadge 등은 row 단위, dashboard chips는 dashboard 2개 한정 |

### 적용 대상 surface 확정

**Dashboard 2 surface만 적용** (proto는 1 page에 통합 stat strip, codebase는 dashboard 별로 분리):

- `/onboarding` dashboard — 4 chips
- `/offboarding` dashboard — 4 chips (또는 통합 page-level 추후 검토)

**적용 제외** (proto에 없음, 운명 유지):
- `/onboarding/me` (개인 view) — 본인 단일 직원 progress만 표시, chips 미적용
- `/onboarding/[id]` (detail) — 개별 instance, chips 미적용
- `/onboarding/checkin` (form) — 입력 화면, chips 미적용
- `/onboarding/checkins` (admin) — table 위주, chips 미적용
- `/offboarding/[id]` (detail) — 미적용
- `/offboarding/exit-interviews` — 통계 chart 위주, 별도 chip 패턴 가능 (별도 트랙 후보)

### 4 chip 데이터 source

| chip | data source | variant |
|---|---|---|
| 진행 중 | `EmployeeOnboarding.status IN (IN_PROGRESS, ASSIGNED)` count | default |
| 지연 | `EmployeeOnboarding.completedAt IS NULL AND dueDate < NOW()` count + StateBlocked | danger |
| 완료 | `EmployeeOnboarding.status = COMPLETED AND completedAt >= startOfMonth()` count | success |
| 이번 주 입사 (onboarding) / 이번 주 퇴사 (offboarding) | `Employee.hireDate BETWEEN startOfWeek AND endOfWeek` count | warning |

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx` | PageHeader 아래 `<StatusChips chips={[...]}/>` 추가 | +20 |
| `src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx` | 동일 패턴 | +20 |
| `src/app/api/v1/onboarding/dashboard/route.ts` | response에 4 chip data 필드 추가 (`inProgressCount`, `delayedCount`, `completedThisMonth`, `newHiresThisWeek`) | +20 |
| `src/app/api/v1/offboarding/dashboard/route.ts` | 동일 패턴 (4 chip data, `newDeparturesThisWeek`) | +20 |
| `messages/{ko,en,zh,vi,es}.json` | chips 라벨 4 키 × 5 locale | +20 entries |

### (b) StatusChips SSOT consumer (cross-batch)

| Batch | Surface | Chips |
|---|---|---|
| batch 03 dashboard | `/home` (HrAdminHomeV2) | TBD (Stage 4 진입 시) |
| batch 04 employees | `/employees` (list, Q3=A pattern B chips) | 재직/휴직/퇴사예정/입사예정 |
| batch 05 org | `/org` (PageHeader 적용) | root 법인/부서/내 팀/발효일 |
| **batch 07 onboarding** | `/onboarding` + `/offboarding` (본 RECORD) | **진행 중/지연/완료/이번 주 입사** |

→ batch 03/04/05/07 = 4 batch 공통 SSOT consumer. StatusChips Props spec 정합 검증 필수.

### (c) 예상 총 line delta

- src code: +80 lines (2 dashboard × 20 + 2 API × 20)
- i18n: +20 entries
- N+24 SSOT 자체는 batch 05 PR에 포함 (별도 변경 0)

---

## §3. i18n / DB / API 영향 평가

### i18n
- 4 chip 라벨 × 5 locale = 20 entries (`onboarding.statChip.*` + `offboarding.statChip.*`)
- 또는 batch 05/07 공통 `dashboard.statChip.*` namespace 통합 (별도 SSOT 검토)

### DB
- 변경 0 (read-only query)
- 기존 모델 (EmployeeOnboarding) 재사용

### API
- `/api/v1/onboarding/dashboard` + `/api/v1/offboarding/dashboard` 응답에 4 chip data 필드 추가 (무손실 후방호환)
- 새 endpoint 신설 0
- prisma query 보강: COUNT + WHERE 조건 4건 추가

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH)**: ⭐ **batch 05 N+24 (StatusChips SSOT) 미완 시 N+31 진입 불가**. PR 머지 순서: N+24 → N+31 (또는 동일 PR scope)
- **R2 (MEDIUM)**: 4 chip data 계산 성능 — 12 법인 × N employee onboarding instance scan. 인덱스 `EmployeeOnboarding(status, dueDate, completedAt)` 검증 필요
- **R3 (LOW)**: "이번 주 입사" timezone 정합 — `src/lib/timezone.ts` SSOT 사용 (raw `new Date()` 금지, CLAUDE.md 가드)

### 의존성
- **N+24 (batch 05)** 선행 필수 — StatusChips SSOT 신설
- **PR-5A 머지** 후 진입 (모든 codebase 트랙)
- **batch 03/04 N+24 사용 surface** 와 정합 검증 (props spec 동기)

### 가드
- ❌ chip data 계산 raw SQL 금지 (Prisma client 사용)
- ❌ N+24 StatusChips 시그니처 변경 금지 (회귀 위험 cross-batch)
- ❌ raw `new Date()` 금지 (`src/lib/timezone.ts` 사용)
- ✅ Workday wt 토큰 사용 (chip variant 색상)
- ✅ 다크 known-deferred (Phase 4 합본)

---

## §5. Implementation 단계 (N+24 선행 머지 후 진입)

1. **사전 합의 게이트**:
   - N+24 PR 머지 상태 확인
   - 4 chip 데이터 정의 (timezone / count window) sign-off
2. **branch**: `feat/onboarding-status-chips`
3. **commit 1 (API 확장)**:
   - 2 dashboard API에 4 chip data 필드 추가 (zod schema 확장)
   - prisma COUNT + WHERE 4건
4. **commit 2 (UI 적용)**:
   - 2 dashboard Client에 StatusChips invoke
   - i18n 신규 키 5 locale
5. **e2e**: `e2e/flows/onboarding-status-chips.spec.ts` — 4 chips 렌더 + 데이터 정합 + 모바일 reflow
6. **gstack 시각**: 라이트 + 모바일 (다크 known-deferred)
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/onboarding-status-chips` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **N+24 SSOT 정합**: StatusChips props spec 변경 0
- ✅ **e2e**: 4 chips 렌더 + chip data 정합 + 모바일 reflow (3 시나리오)
- ✅ **시각 회귀**: gstack 라이트 dashboard 2개 + chips 위치 정합
- ✅ **성능**: 12 법인 × N instance count 응답 시간 < 500ms (인덱스 검증)
- ✅ **회귀 0**: 기존 dashboard surface (table/filter/plan type tabs) 무변동

---

**상태**: pre-flight 완료, batch 05 N+24 선행 의존
**Stage 4 예상 PR 크기**: 2 commits, ~80 lines + 20 i18n entries, 4 file diff
