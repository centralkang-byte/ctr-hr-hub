# Wave1 PR-3A 잔여 — Attendance admin roster endpoint (`/admin/roster?date=`)

> Branch `feat/attendance-admin-roster-endpoint` (base=main, 비스택). S301 프로그램 PR-3A에서 specced됐으나
> 미빌드된 마지막 절반. 형제 weekly endpoint(#179, 머지됨)의 single-date 변형.

## Ground truth (verified in merged main)

- `weekly` endpoint 존재(`src/app/api/v1/attendance/admin/weekly/route.ts`, 224 LOC), `trends` 존재(PR-4).
  **`roster` 미존재** = 갭.
- 현 `/attendance/admin` (route.ts)은 KPI(`totalEmployees/presentCount/lateCount/absentCount/avgTotalMinutes`)
  + 20행 anomaly 리스트만 반환. **전체 명단(roster) 없음** → "오늘" 탭은 KPI카드 + 52h알림 + anomaly테이블만,
  전 직원 명단 리스트 부재. 이것이 proto `page-attendance.jsx:312-355` "직원별 근태" 테이블과의 갭.
- proto roster 테이블 컬럼: 이름 / 사번 / 출근 / 퇴근 / 근태 상태 / 근무 유형 / [보기]. 칩 = 근무중(success)·
  지각(warning)·결근(danger)·휴가/출장/반차(info). 부제 `{n}명 · 오늘`.

## Contract (mirrors weekly, single date)

`GET /api/v1/attendance/admin/roster?date=YYYY-MM-DD&cursor=&limit=&departmentId=&companyId=`

- **RBAC**: `withPermission(perm(ATTENDANCE, APPROVE))` + 핸들러 내 명시 HR_ADMIN/SUPER_ADMIN 체크(att-05 정합,
  EXECUTIVE 제외). MANAGER/EMPLOYEE → 403. weekly와 동일 이중 방어.
- **멀티테넌트**: `resolveCompanyId(user, searchParams.get('companyId'))` SSOT. 비-SUPER 자기 법인 강제.
- **date**: 미지정 → 대상 법인 `resolveDayContext(companyId, now).localDateStr` ("오늘", 법인 tz).
  형식 검증 `/^\d{4}-\d{2}-\d{2}$/` + `isRealDate`(2026-02-31 등 차단) → 위반 400.
  **미래 날짜 거부**(`parseDateOnly(date) > parseDateOnly(법인오늘)` → 400) — Gate1 P1-1 미래 PII 가드를
  날짜파라미터 차원에서 원천 차단(date<=오늘이면 effectiveDate<=date도 미래전적 노출 불가).
- **employee set (Gate1 P1-1: date-aware 역사 fence)**: assignment가 **그 날짜 D에 active**였던 직원.
  `assignments.some{ companyId, isPrimary:true, effectiveDate:{lte: parseDateOnly(D)},
  OR:[{endDate:null}, {endDate:{gte: parseDateOnly(D)}}], departmentId? }` + `employee.deletedAt:null`.
  (effectiveDate/endDate = `@db.Date` → parseDateOnly 경계.) 과거일=당시재직·이후퇴직자 포함·미입사 제외 /
  오늘=endDate:null 분기. soft-deleted는 정책상 제외(전역 일관). **부서명**: 동일 fence + `department:{companyId}`
  스코프 nested select(orderBy effectiveDate desc take 1 — D 시점 부서; 동시발령 타법인 부서명 누출 차단, P1-3).
- **departmentId 필터(Gate1-R2 P1 tenant fence)**: 제공 시 `Department.findFirst{id:departmentId, companyId}`
  선검증 → 없으면 400. 타 법인 departmentId로 대상법인 직원 필터링(손상데이터) 차단.
- **pagination**: 커서(employee.id UUID, offset 금지), DEFAULT 30 / MAX 50. cursor 비-UUID → 400.
  **cursor 소유권 검증(Gate1 P2-1, R2 tightened)**: `employeeWhere`(아래 employee-set 술어 = deletedAt·역사fence·
  departmentId 포함) 상수를 추출해 페이지 쿼리와 cursor `count({where:{id:cursor, ...employeeWhere}})===1`에
  **동일 술어** 재사용 → 결과집합 밖/타테넌트 UUID 커서 400.
- **bulk 2 쿼리**(per-employee 없음): (1) `attendance.findMany` pageIds × `workDate∈[D, D+1)`
  (`@@unique([employeeId,workDate])` → 직원당 ≤1 = 단일 객체 안전), (2) `leaveRequest.findMany` APPROVED
  pageIds + **`policy:{companyId}`**(P1-3 relation tenant fence) + overlap `startDate < D+1 AND endDate >= D`
  (weekly overlap predicate 미러), `orderBy [startDate asc, id asc]`(결정적). JS 병합.
- **leave 날짜 저장 불변조건(Gate1-R2 P1)**: leave create가 `new Date('YYYY-MM-DD')` = **로컬 달력일의 UTC-자정**
  으로 저장(`leave/requests:74-75` 확인). 따라서 `toISOString().slice(0,10)`(toDateStr)가 달력일을 정확히 복원 —
  **tz 변환 금지**(저장값이 이미 UTC-자정이라 변환 시 이중 시프트 손상). weekly endpoint(Gate2 통과)와 동일 방식.
  불변조건 명시 + 테스트로 고정(D일 휴가 → D roster에 노출).
- **leave overlay(C2, Gate1 P1-2)**: APPROVED만. JS 멤버십 재확인 `toDateStr(start)<=D<=toDateStr(end)`(상기 불변조건
  하 정확). **`leaves` 배열**(직원당 같은날 AM/PM 반차 2건·중복 표현 — 단일 객체 order-dependent 버그 회피).
  halfDayType 보존. 셀은 다중 fact(attendance + leaves) — AttendanceStatus enum에 휴가 안 욱여넣음.
- **response**: `{ date, rows: [{ employeeId, name, employeeNo, department,
  attendance: { id, clockIn, clockOut, totalMinutes, overtimeMinutes, status, workType } | null,
  leaves: [{ leaveType, halfDayType }] }], nextCursor }`.
  attendance에 `id` 포함(추후 보정 드로어용 — 후속 API가 tenant·perm 재검증하므로 IDOR 아님, Gate1 Q4).
- **cache(C3)**: weekly와 동일하게 **withCache 미적용**(실시간 오늘 데이터·authorize-before-cache 위험 회피).
  형제 endpoint가 Codex Gate2 후 무캐시 선택 → 정합.
- **마이그레이션 없음**: 전부 기존 컬럼(weekly가 이미 사용 중).

## UI wiring (오늘 탭에 roster 리스트 추가)

- NEW `TodayRosterList.tsx`(WeeklyAttendanceGrid 구조 미러): `/admin/roster` fetch, proto 테이블 렌더
  (이름·사번·출근·퇴근·근태상태·근무유형), 상태 칩 매핑, 커서 "더 보기". 빈/로딩/에러 3분법.
  데이터 전부 서버 응답(클라 날조 0 — Codex P2-4). 부제 `{rows.length}명 · 오늘`(페이지 기준 라벨 명시).
- `AttendanceAdminClient.tsx` "오늘" 탭(`TabsContent value="today"`)에 anomaly 테이블 **위/아래** 섹션으로
  추가(기존 KPI·52h알림·anomaly 무변경 = keep-live). anomaly(문제만) vs roster(전원) = 보완 관계.
- **defer**: roster 행클릭 → #144 보정 드로어 연결은 PR-3B UI 후속(응답에 attendance.id는 포함해 준비만).
  proto의 검색·상태필터는 경량 클라 필터로 선택 추가(범위 비대화 시 defer).

## i18n (add-only, ×5 locale)

`attendance.roster.*` 신규 소수만: `title`(직원별 근태)·`present`(근무중)·`notClockedIn`(미출근)·
`statusCol`(근태 상태)·`workTypeCol`(근무 유형)·`countToday`(`{count}명 · 오늘`)·`empty`. 나머지는 기존 재사용
(`weekly.member`·`weekly.loadMore`·`clockIn`·`clockOut`·`late`·`absent`·`earlyOut`·`onLeave`). 기존 키 편집 금지.

## E2E (mirror weekly block)

`e2e/helpers/attendance-fixtures.ts`에 `getAdminRoster` 추가. `attendance-core.spec.ts`에 describe:
HR 200+shape(date·rows[attendance|null·leaves[]]·nextCursor), 커서 no-overlap, `?date=invalid`→400,
`?date=2026-02-31`→400, **`?date=`미래→400**, `?cursor=non-uuid`→400, **HR이 타 법인 companyId 보내도 자기법인만**
(resolveCompanyId 강제), **타 법인 employee UUID cursor→400**(P2-1), 기본 date=법인오늘 shape,
SUPER `?companyId` 200(cross-company), MANAGER 403, EMPLOYEE 403.

## Verification

tsc=0, lint=0, `prisma migrate status` clean(no migration), rules 패턴, **Codex Gate 2(/verify)**,
ultracode 적대 리뷰 워크플로, Pixel Gate(proto side-by-side) + 멀티롤 dogfood(super@ + hr@ + employee-a@ 403).

## 파일

NEW: `src/app/api/v1/attendance/admin/roster/route.ts` ·
`src/app/(dashboard)/attendance/admin/TodayRosterList.tsx`.
EDIT: `AttendanceAdminClient.tsx`(오늘 탭 섹션 추가) · `e2e/helpers/attendance-fixtures.ts` ·
`e2e/api/attendance-core.spec.ts` · `messages/{ko,en,zh,ja,vi}.json`(roster.* add-only).
