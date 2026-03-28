# B-3i: Manager Hub 점선 보고 직원 패널

> Date: 2026-03-20
> Status: Approved
> Branch: track-b-phase3-session8

---

## Goal

Manager Hub 대시보드에 점선 보고(dotted line) 직원 목록을 별도 섹션으로 추가한다.
타 법인 직원은 조회만 가능하고 액션 버튼을 숨긴다 (R-4 read-only).

## Design Decision

Workday 패턴 참고 → 같은 화면, 별도 섹션 분리.
점선 직원은 보통 2~5명이므로 별도 페이지는 과잉, 섞어 보여주면 권한 차이로 혼란.

## UI

기존 대시보드 하단 (AI Recommendations 아래)에 카드 추가:

```
┌─────────────────────────────────────────────┐
│ 점선 보고 직원 (Matrix Reports)        3명   │
├─────────────────────────────────────────────┤
│ 👤 김구매  | CTR-MOB | 구매팀장  | 조회 →   │
│ 👤 박품질  | CTR-MOB | 품질팀장  | 조회 →   │
│ 👤 이영업  | CTR-ECO | 영업팀장  | 조회 →   │
├─────────────────────────────────────────────┤
│ ⓘ 타 법인 점선 보고 직원은 조회만 가능합니다  │
└─────────────────────────────────────────────┘
```

- 각 행: 이름, 법인명, 직위, "조회" 링크만 (액션 버튼 없음)
- 0명이면 패널 숨김
- 하단에 read-only 안내 문구

## API

**New endpoint**: `GET /api/v1/manager-hub/dotted-line-reports`

- 현재 유저의 positionId → `Position.dottedLineReports[]` 역방향 조회
- `getCrossCompanyReadFilter()` 활용하여 secondary assignment 기반 타 법인 직원도 포함
- Response: `{ employees: [{ id, name, companyName, positionTitle }] }`
- read-only 데이터만 반환 (민감 정보 제외)

## Security

- `withPermission(MODULE.EMPLOYEES, ACTION.READ)` — 읽기 권한만
- 타 법인 직원은 `cross-company-access.ts` 3중 보안 체크 적용
- 프로필 조회 클릭 시 서버에서 다시 권한 검증

## Files to Create/Modify

- `src/app/api/v1/manager-hub/dotted-line-reports/route.ts` — New API
- `src/components/manager-hub/DottedLineReportsCard.tsx` — New UI component
- `src/components/manager-hub/ManagerInsightsHub.tsx` — 카드 추가
