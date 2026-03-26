# CTR HR Hub — Session 23: UX 디테일 업그레이드 계획 (v2)

## Context

Phase 3 UX 리뷰에서 47개 이슈 중 코드 레벨 수정 완료 후, 기능 추가가 필요한 UX 이슈 + 새로 발견한 디테일 개선점을 구현한다. Workday/BambooHR급 완성도를 목표. CEO 리뷰에서 지적된 4개 치명적 함정을 방어하고, 추가 제안 4개를 통합한다.

---

## 리뷰 반영: 치명적 함정 방어

| # | 함정 | Step | 방어책 |
|---|------|------|--------|
| 1 | 대시보드 실시간 집계 → DB 과부하 | Step 4 | Redis 캐시 (1시간 TTL) + SWR stale-while-revalidate |
| 2 | 프로필 위젯 API 워터폴 | Step 2 | 서버 컴포넌트에서 `Promise.all` 병렬 fetch → props 전달 |
| 3 | localStorage 열 설정 버전 충돌 | Step 9 | 버전 키 (`v1`) + 유효 컬럼 검증 → 불일치 시 silent reset |
| 4 | 브레드크럼 UUID 노출 | Step 5 | 서버에서 name 조회 → PageHeader prop 매핑 |

---

## 작업 구조 (13개 스텝)

### Step 1: DpiaForm/DataRequestForm i18n 클린업 [LOW, 2파일]

**파일:**
- `src/components/compliance/gdpr/DpiaForm.tsx`
- `src/components/compliance/gdpr/DataRequestForm.tsx`

**변경:**
- DpiaForm: STATUS_OPTIONS (4개) + RISK_LEVELS (4개) → `t()` 함수
- DataRequestForm: REQUEST_TYPES (6개) + STATUS_OPTIONS (4개) → `t()` 함수
- messages/ko.json, messages/en.json에 ~18개 키 추가

**주의:** messages/*.json은 DO NOT TOUCH이나 i18n 키 추가는 허용 (Session 22 선례)

---

### Step 2: 내 프로필 대시보드화 [MED, 3~5파일]

**파일:**
- `src/app/(dashboard)/my/profile/page.tsx` — 서버 데이터 병렬 fetch
- `src/app/(dashboard)/my/profile/MyProfileClient.tsx` — 개요탭 미니 위젯

**방어: 워터폴 방지** — page.tsx (서버 컴포넌트)에서 `Promise.all` 로 한 번에 fetch:
```ts
const [employee, leaveBalance, rewards] = await Promise.all([
  prisma.employee.findUnique(...),
  prisma.employeeLeaveBalance.findMany({ where: { employeeId } }),
  prisma.rewardRecord.findMany({ where: { employeeId }, take: 3 }),
])
```
→ 클라이언트는 props만 받아 렌더링 (추가 API 호출 없음)

**추가할 미니 위젯 (개요탭 상단 그리드):**
1. **At a Glance 카드** — 팀명, 매니저명, 직급, 입사일, 근속연수
2. **휴가 잔여** — 연차 잔여일/총일수 프로그레스 바
3. **자격증/언어** — profileExtension JSON 렌더링 (데이터 이미 로드됨)
4. **최근 리워드** — 수상 이력 배지 (최근 3건)

**UX:** shadcn Card, 2열 그리드 (모바일 1열), 각 카드에 "자세히" 링크 → 해당 My 페이지

---

### Step 3: 매니저 평가 컨텍스트 강화 [MED, 3~4파일]

**파일:**
- `src/components/performance/EmployeeInsightPanel.tsx` — 패널 확장
- `src/app/api/v1/employees/[id]/insights/route.ts` — 이전 연도 데이터 추가
- `src/app/(dashboard)/performance/manager-evaluation/ManagerEvaluationClient.tsx`

**추가할 정보:**
1. **이전 연도 평가 등급** — Insight 패널에 최근 3년 미니 차트 (Recharts BarChart)
2. **AI 추천 등급 배지** — Summary 탭에 참고용 표시 (기존 API 활용)
3. **바이어스 경고 배너** — 평가 제출 버튼 위에 Alert (기존 API 활용)
4. **등급 분포 미니차트** — 내 팀 E:M+:M:B 비율 도넛

---

### Step 4: 대시보드 KPI + 사이드바 동적화 [MED, 3~4파일]

**파일:**
- `src/components/home/HrAdminHome.tsx` — 하드코딩 → 캐시된 데이터
- `src/app/api/v1/dashboard/stats/route.ts` — 새 API (Redis 캐시)

**방어: DB 과부하 방지**
```
요청 → Redis 캐시 확인 (TTL 1시간)
  ├─ HIT → 캐시 데이터 반환 (0ms DB)
  └─ MISS → DB 집계 쿼리 → Redis 저장 → 반환
```
- 집계 쿼리: `COUNT`, `GROUP BY status` 등 (인덱스 활용)
- SWR `refreshInterval: 3600000` (1시간) 클라이언트 갱신
- 사이드바 카운트: `/api/v1/sidebar/counts` (이미 존재) 재사용

**변경:**
- KPI 카드 → Redis 캐시 API 연동 + 전월 대비 △ 표시
- 사이드바 카드 → sidebar/counts API + 클릭 → 해당 페이지 Link
- 0건: "모두 완료됨" 긍정적 피드백

---

### Step 5: 브레드크럼 네비게이션 [MED, 2~3파일]

**파일:**
- `src/components/shared/PageHeader.tsx` — breadcrumbs prop 추가
- `src/components/shared/Breadcrumb.tsx` — 새 컴포넌트 (shadcn)

**방어: UUID 노출 방지**
- 동적 라우트([id])에서는 서버 page.tsx가 조회한 name을 breadcrumb label로 전달
- 예: `직원 관리 > 강상우` (O), `직원 관리 > 123e4567...` (X)

**패턴:**
```tsx
<PageHeader
  title="강상우"
  breadcrumbs={[
    { label: t('employees.title'), href: '/employees' },
    { label: employee.name },
  ]}
/>
```
- 최대 3단계, 모바일: 뒤로가기 버튼만
- 점진 적용: 직원 상세, 성과 평가, 채용 상세, 설정 하위

---

### Step 6: 승인 UX 개선 [LOW~MED, 1파일]

**파일:**
- `src/app/(dashboard)/approvals/inbox/ApprovalInboxClient.tsx`

**변경:**
1. **버튼 로딩 상태** — 클릭 시 Loader2 스피너 + disabled + 토스트
2. **대량 승인 진행률** — BulkConfirmModal에 프로그레스 바 (`processed/total`)
3. **병렬 처리** — `Promise.allSettled()` + 항목별 성공/실패 아이콘
4. **실패 항목 재시도** — 실패 건만 모아서 재시도 버튼

---

### Step 7: 폼 검증 + 스켈레톤 안정화 [LOW, 3~4파일]

**파일:**
- `src/components/shared/DataTable.tsx` — 스켈레톤 행 수 동적화
- 주요 폼: `PostingFormClient.tsx`, `EmployeeNewClient.tsx`, `LeaveRequestForm` 등

**변경:**
1. **스켈레톤**: `pageSize` prop 기반 행 수 (기본 10 → 실제와 일치)
2. **폼 검증**: `mode: 'onBlur'` + 필드 아래 즉시 에러 표시
3. **필수 필드 표시**: 라벨에 `*` (빨간 별) 통일

---

### Step 8: 모바일 UX [MED, 2~3파일]

**파일:**
- `src/components/employees/EmployeeFilterPanel.tsx` — Sheet 전환
- `src/components/employees/ProfileSidebar.tsx` — 모바일 요약 카드

**변경:**
1. **필터 패널**: `md:` 이하에서 shadcn Sheet(바텀시트) + 적용 후 자동 닫힘 + 필터 개수 배지
2. **프로필 사이드바**: 모바일에서 상단 고정 요약 바 (이름, 직급, 부서, 상태 배지)

---

### Step 9: 테이블 열 커스터마이징 [MED, 1~2파일]

**파일:**
- `src/components/shared/DataTable.tsx`

**방어: localStorage 버전 충돌 방지**
```ts
const STORAGE_VERSION = 'v1'
const key = `table_columns_${tableId}_${STORAGE_VERSION}`
const saved = JSON.parse(localStorage.getItem(key) || 'null')
// 유효성 검증: 저장된 키가 현재 columns에 없으면 silent reset
const validColumns = saved?.filter(col => currentColumnIds.includes(col))
if (!validColumns || validColumns.length === 0) {
  localStorage.removeItem(key)
  return defaultColumns
}
```

**변경:**
1. 테이블 헤더에 Settings 버튼 → DropdownMenuCheckboxItem으로 열 토글
2. 유효성 검증 + 버전 관리
3. "기본값 복원" 버튼

---

### Step 10: Sticky Action Bar (플로팅 저장 버튼) [LOW, 2~3파일] ← 추가

**파일:**
- `src/components/shared/StickyActionBar.tsx` — 새 컴포넌트
- 적용: `EmployeeNewClient.tsx`, `ManagerEvaluationClient.tsx`, `PostingFormClient.tsx`

**변경:**
- 긴 폼 하단에 `sticky bottom-0` 바 (저장/제출/취소 버튼)
- 스크롤해도 항상 보임 → 버튼 찾아 헤매는 피로 제거
- 배경 blur + 상단 그라데이션으로 구분

---

### Step 11: Contextual Help Tooltips (인라인 정책 가이드) [LOW~MED, 2~3파일] ← 추가

**파일:**
- `src/components/shared/HelpTooltip.tsx` — 새 컴포넌트
- 적용: 휴가 신청 폼, 성과 평가 폼, 급여 시뮬레이션

**변경:**
- 폼 라벨 옆 `(i)` 아이콘 → Tooltip으로 HR 정책 안내
- 예: 휴가 `경조휴가 기준: 결혼 5일, 출산 10일...`
- 예: 평가 `S등급: 상위 10% 이내, 목표 달성률 120% 이상`
- i18n 지원 (messages에 tooltips 네임스페이스)

---

### Step 12: Session Timeout Warning [LOW, 1~2파일] ← 추가

**파일:**
- `src/components/shared/SessionTimeoutWarning.tsx` — 새 컴포넌트
- `src/app/(dashboard)/layout.tsx` — 마운트

**변경:**
- NextAuth 세션 만료 3분 전 모달: "세션이 곧 만료됩니다. 연장하시겠습니까?"
- "연장" 클릭 → `/api/auth/session` 호출로 세션 갱신
- "로그아웃" → signOut()
- 평가서 작성 중 데이터 증발 방지

---

### Step 13: Data Grid Inline Editing [HIGH, 별도 세션] ← 추가 (이번 세션 미포함)

> 엑셀형 인라인 편집은 DataTable 아키텍처 변경이 크므로 별도 세션에서 진행.
> @tanstack/table의 column meta + editable cell 패턴 채택 예정.

---

## 실행 순서

```
Phase A: 빠른 승리 (Step 1, 10, 11, 12)     ← ~30분
  Step 1  — i18n 클린업 (5분)
  Step 10 — Sticky Action Bar (10분)
  Step 11 — Help Tooltips (10분)
  Step 12 — Session Timeout Warning (5분)

Phase B: 핵심 기능 (Step 2, 3, 4)            ← ~60분
  Step 2  — 내 프로필 대시보드화 (25분)
  Step 3  — 매니저 평가 컨텍스트 (25분)
  Step 4  — 대시보드 동적화 (20분, Redis 캐시)

Phase C: 구조 개선 (Step 5, 6, 7)            ← ~40분
  Step 5  — 브레드크럼 (20분)
  Step 6  — 승인 UX (10분)
  Step 7  — 폼/스켈레톤 (10분)

Phase D: 반응형 + 파워유저 (Step 8, 9)       ← ~25분
  Step 8  — 모바일 UX (15분)
  Step 9  — 테이블 열 (10분)
```

**총 예상:** ~155분 (12 Steps, Step 13은 별도 세션)
**수정 파일:** ~25파일
**커밋 전략:** Step별 1 커밋 (atomic)

---

## 검증

각 Step 완료 후:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — no new warnings

Phase별 완료 후:
- Vercel preview 배포로 시각적 확인

전체 완료 후:
- 주요 역할별 (SA, HR_ADMIN, MANAGER, EMPLOYEE) 플로우 검증
- 모바일 반응형 확인 (필터, 프로필, 폼 Sticky Bar)
- 대시보드 Redis 캐시 동작 확인
