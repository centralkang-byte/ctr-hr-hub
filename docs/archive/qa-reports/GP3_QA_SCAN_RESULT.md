# GP#3 Payroll QA Scan Results

> Scanned: 2026-03-10

## Pages Found (14 total)
| # | Path | Title | Language | Layout Pattern |
|---|------|-------|----------|----------------|
| 1 | /payroll | 급여 대시보드 | ✅ 한국어 | Pipeline+Calendar+KPI+QuickActions |
| 2 | /payroll/close-attendance | 급여 근태 마감 | ✅ 한국어 | Status+ActionCard |
| 3 | /payroll/adjustments | 수동 조정 | ✅ 한국어 | RunSelector+CRUD Table |
| 4 | /payroll/anomalies | 급여 이상 탐지 | ✅ 한국어 | MonthNav+RuleCards |
| 5 | /payroll/[runId]/review | 이상 검토 (3-tab) | ✅ 한국어 | 3개 탭 (이상목록/예외목록/전월비교) |
| 6 | /payroll/[runId]/approve | 급여 결재 | ✅ 한국어 | ApprovalChain+KPI+Action |
| 7 | /payroll/[runId]/publish | 급여 발행 현황 | ✅ 한국어 | ViewRate+Downloads+History |
| 8 | /payroll/me | 내 급여명세서 목록 | ✅ 한국어 | Grid+NEWbadge+MoM |
| 9 | /payroll/me/[runId] | 급여명세서 상세 | ✅ 한국어 | Breakdown |
| 10 | /payroll/simulation | 급여 시뮬레이션 | ✅ 한국어 | SimulationForm |
| 11 | /payroll/global | 글로벌 급여 현황 | ✅ 한국어 | GlobalTable |
| 12 | /payroll/import | (import page) | ? | Import |
| 13 | /payroll/bank-transfers | 급여 이체 | ✅ 한국어 | BatchList |
| 14 | /payroll/year-end | 연말정산 | ✅ 한국어 | Table |

## API Routes Found (48 total)
| # | Path | Method | Purpose |
|---|------|--------|---------|
| 1 | /api/v1/payroll/dashboard | GET | 파이프라인 통합 현황 |
| 2 | /api/v1/payroll/runs | GET/POST | 급여 실행 목록/생성 |
| 3 | /api/v1/payroll/runs/[id] | GET/PATCH | 급여 실행 상세/수정 |
| 4 | /api/v1/payroll/attendance-close | POST | STEP 1: 근태 마감 |
| 5 | /api/v1/payroll/attendance-reopen | POST | 근태 마감 해제 |
| 6 | /api/v1/payroll/calculate | POST | STEP 2: 자동 계산 |
| 7 | /api/v1/payroll/[runId]/adjustments | GET/POST | STEP 2.5: 수동 조정 |
| 8 | /api/v1/payroll/[runId]/adjustments/complete | POST | STEP 3 전환 |
| 9 | /api/v1/payroll/[runId]/anomalies | GET | 이상 목록 |
| 10 | /api/v1/payroll/[runId]/anomalies/[id]/resolve | POST | 이상 해제 |
| 11 | /api/v1/payroll/[runId]/anomalies/bulk-resolve | POST | 일괄 해제 |
| 12 | /api/v1/payroll/[runId]/submit-for-approval | POST | STEP 4 전환 |
| 13 | /api/v1/payroll/[runId]/approve | POST | 결재 승인 |
| 14 | /api/v1/payroll/[runId]/reject | POST | 결재 반려 |
| 15 | /api/v1/payroll/[runId]/approval-status | GET | 결재 현황 |
| 16 | /api/v1/payroll/[runId]/publish-status | GET | 발행 현황 |
| 17 | /api/v1/payroll/[runId]/notify-unread | POST | 미열람 재알림 |
| 18 | /api/v1/payroll/[runId]/export/transfer | GET | 이체 CSV 생성 |
| 19 | /api/v1/payroll/[runId]/export/comparison | GET | 전월 비교 Excel |
| 20 | /api/v1/payroll/[runId]/export/ledger | GET | 급여 대장 Excel |
| 21 | /api/v1/payroll/[runId]/export/journal | GET | 분개 Excel |
| 22 | /api/v1/payroll/me | GET | 직원별 명세서 목록 |
| 23 | /api/v1/payroll/payslips/[id] | GET/PATCH | 명세서 상세+열람 처리 |
| ... | (etc) | ... | ... |

## Components Found
| # | Path | Purpose |
|---|------|---------|
| 1 | PayrollPipeline.tsx | 6열 파이프라인 그리드 |
| 2 | PayrollCalendar.tsx | 법인별 마감/지급일 캘린더 |
| 3 | PayrollStatusBadge.tsx | 급여 실행 상태 배지 |
| 4 | PayrollCreateDialog.tsx | 급여 실행 생성 다이얼로그 |
| 5 | PayrollAdjustDialog.tsx | 수동 조정 추가 다이얼로그 |
| 6 | PayrollKpiCards.tsx | KPI 카드 컴포넌트 |
| 7 | AnomalyPanel.tsx | AI 이상 감지 패널 |
| 8 | PayStubBreakdown.tsx | 급여명세서 상세 breakdown |

## Sidebar Menu Structure (payroll section)
```
급여 (섹션)
  ├─ 급여 대시보드        /payroll              ← ✅ 한국어
  ├─ 근태 마감 [NEW]     /payroll/close-attendance ← ✅ 한국어
  ├─ 수동 조정 [NEW]     /payroll/adjustments    ← ✅ 한국어
  ├─ 이상 검토           /payroll/anomalies      ← ✅ 한국어
  ├─ 글로벌 급여         /payroll/global         ← ✅ 한국어
  ├─ 급여 시뮬레이션     /payroll/simulation     ← ✅ 한국어
  ├─ 이체 내역           /payroll/bank-transfers ← ✅ 한국어
  └─ 연말정산 [NEW]      /payroll/year-end       ← ✅ 한국어, KR only
```

## i18n Coverage
- i18n 파일: `src/lib/i18n/ko.ts` (400 lines)
- payroll 관련 기존 키: `nav.payroll.*`, `salary.*` 일부
- **Gap**: `payrollPage`, `payrollMe` 네임스페이스 없음 (pages use `useTranslations()` but no keys exist in ko.ts)
- 대부분 하드코딩 한국어 → 수용 가능 (ko.ts에 payroll 섹션 추가 필요)

## Issues Found (수정 필요)

### 🔴 Critical
1. **PayrollStatusBadge** — `ATTENDANCE_CLOSED`, `ADJUSTMENT`, `PENDING_APPROVAL`, `PAID` 상태 누락
   → Dashboard 파이프라인에서 알 수 없는 상태로 표시됨
2. **AdjustmentsClient L248** — `"ADJUSTMENT 상태 급여 없음"` (영문 상태 코드 노출)
   → `"수동 조정 단계의 급여 정산이 없습니다"` 로 변경 필요

### 🟡 Minor
3. **PayrollReviewClient** — `capitalize` CSS 클래스로 영문 키 자동 대문자화 (개발자 전용 detail table)
4. **ko.ts** — payroll 상태 번역 키 없음 (각 페이지가 직접 한국어 하드코딩 중 — OK)

### ✅ Already Good
- PayrollPipeline.tsx — 완전 한국어
- PayrollCalendar.tsx — 완전 한국어
- PayrollCreateDialog.tsx — 완전 한국어
- PayrollApproveClient.tsx — 완전 한국어
- PayrollPublishDashboardClient.tsx — 완전 한국어
- CloseAttendanceClient.tsx — 완전 한국어
- PayrollMeClient.tsx — 완전 한국어

## Seed Data Status (as of scan)
- 기존 seed 06-payroll.ts: PayrollRun 있음 (이전 데이터)
- GP#3 파이프라인 테스트용 시드 없음
- 필요: 17-payroll-pipeline.ts 생성
