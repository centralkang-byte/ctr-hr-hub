// CTR HR Hub — 통합 인사관리 시스템 데이터 (HR_ADMIN 뷰)
window.HR_DATA = {
  me: {
    name: "한지영",
    nameEn: "Jiyoung Han",
    role: "HR_ADMIN",
    title: "인사담당선임",
    rank: "과장",
    team: "인사팀",
    dept: "인사팀",
    avatar: "한",
    avatarHue: 268,
    code: "CTR-KR-0001",
    email: "hr@ctr.co.kr",
    startDate: "2024-01-01",
    certCount: 1,
    languageCount: 1,
    skills: ["인사관리", "Six Sigma"],
    emergency: [],
    pendingRequests: [
      { kind: "연락처 (개인)", to: "010-46128-9999", date: "2026-05-04", status: "대기중" },
      { kind: "연락처 (개인)", to: "010-6597-9999",  date: "2026-05-04", status: "대기중" },
    ],
  },
  company: {
    name: "CTR",
    fullName: "CTR HR Hub",
    sub: "통합 인사관리 시스템",
    headcount: 67,
    fiscalYear: "1월 1일 — 12월 31일",
  },
  alerts: {
    notifications: 46,
    pendingMyTasks: 98,
    pendingApprovals: 25,
    onboardingOverdue: 5,
    offboardingOverdue: 1,
  },
  kpis: {
    headcount:        { value: 67, delta: 0,    series: [62, 63, 65, 65, 67, 67, 67] },
    pendingApprovals: { value: 25, delta: +12,  series: [4, 8, 12, 15, 18, 22, 25] },
    turnoverRate:     { value: 0.0, deltaPct: 0, series: [0.6, 0.4, 0.4, 0.0, 0.0, 0.0, 0.0] },
    openRoles:        { value: 2,  delta: -1,   series: [3, 3, 3, 3, 3, 2, 2] },
    avgTenure:        { value: 3.2, unit: "년", series: [3.0, 3.1, 3.1, 3.1, 3.2, 3.2, 3.2] },
    leaveBalance:     { value: 10.3, unit: "일", series: [12, 11.8, 11.4, 11.0, 10.8, 10.5, 10.3] },
  },
  // 결재 대기 큐
  approvalQueue: [
    { id: "APR-1027", type: "휴가",     who: "박지훈", team: "생산기술팀", what: "연차 3일 (6/2–6/4)",      submitted: "2026-05-13", days: 3, urgency: "overdue", note: "가족 행사" },
    { id: "APR-1026", type: "휴가",     who: "정유진", team: "재무/회계팀", what: "반차 (오전)",             submitted: "2026-05-14", days: 0.5, urgency: "overdue" },
    { id: "APR-1025", type: "휴직",     who: "권하은", team: "생산/제조팀", what: "육아휴직 6개월",         submitted: "2026-05-15", days: 180, urgency: "overdue", note: "복귀 예정 11월" },
    { id: "APR-1024", type: "출장",     who: "이상민", team: "영업팀",     what: "부산 출장 2일",          submitted: "2026-05-15", days: 2, urgency: "today" },
    { id: "APR-1023", type: "증명서",   who: "김수빈", team: "영업팀",     what: "재직증명서 발급",         submitted: "2026-05-16", days: 0, urgency: "today" },
    { id: "APR-1022", type: "발령",     who: "오승현", team: "개발팀",     what: "팀 이동 (개발 → 연구개발)", submitted: "2026-05-12", days: 0, urgency: "soon" },
  ],
  // 온보딩 진행 현황
  onboarding: [
    { name: "이민준",  hue: 200, joinDate: "2026-05-04", template: "신규입사 온보딩", progress: 0,   total: 6, dDay: -12, buddy: null,   status: "delay" },
    { name: "오승현",  hue: 40,  joinDate: "2025-12-18", template: "신규입사 온보딩", progress: 2,   total: 6, dDay: -74, buddy: "최사원", status: "delay" },
    { name: "윤지호",  hue: 155, joinDate: "2026-02-20", template: "신규입사 온보딩", progress: 4,   total: 6, dDay: -102, buddy: "최사원", status: "delay" },
    { name: "정하은",  hue: 295, joinDate: "2025-12-25", template: "신규입사 온보딩", progress: 6,   total: 6, dDay: 0,   buddy: "최사원", status: "done" },
    { name: "류병철",  hue: 10,  joinDate: "2025-12-11", template: "신규입사 온보딩", progress: 6,   total: 6, dDay: 0,   buddy: "최사원", status: "done" },
    { name: "테스트직원", hue: 245, joinDate: "2026-01-01", template: "신규입사 온보딩", progress: 0, total: 6, dDay: -135, buddy: null,   status: "delay" },
  ],
  offboarding: [
    { name: "임준서", hue: 340, leaveDate: "2026-07-01", template: "퇴사 오프보딩", progress: 0, total: 8, dDay: -46, status: "delay" },
    { name: "한상우", hue: 100, leaveDate: "2026-06-15", template: "퇴사 오프보딩", progress: 3, total: 8, dDay: -30, status: "progress" },
  ],
  // 나의 업무
  myTasks: [
    { id: "T-301", type: "성과",   title: "[성과] MBO 목표 등록",                  sub: "E2E Checkin 1777832084477 — 목표 가중치 합계 100% 제출", who: null, team: "인사팀",     dDay: +46, owner: "인사팀",   done: false },
    { id: "T-302", type: "온보딩", title: "서류제출 — 테스트직원 1777832052064 (Day 1)", sub: "카테고리: DOCUMENT · 담당: HR", who: "테스트직원 1777832052064", team: "생산기술팀", dDay: +134, owner: "HR",     done: false },
    { id: "T-303", type: "온보딩", title: "OJT — 테스트직원 1777832052064 (Day 7)",       sub: "카테고리: TRAINING · 담당: MANAGER", who: "테스트직원 1777832052064", team: "생산기술팀", dDay: +130, owner: "MANAGER", done: false },
    { id: "T-304", type: "온보딩", title: "보안교육 — 테스트직원 1777832052064 (Day 7)",  sub: "카테고리: TRAINING · 담당: EMPLOYEE", who: "테스트직원 1777832052064", team: "생산기술팀", dDay: +132, owner: "EMPLOYEE", done: false },
    { id: "T-305", type: "휴가",   title: "연차 신청 — 박지훈",                     sub: "6월 2일 – 6월 4일 (3일)", who: "박지훈", team: "생산기술팀", dDay: -3, owner: "결재", done: false },
    { id: "T-306", type: "급여",   title: "5월 급여명세서 확인",                    sub: "지급일 2026-05-25", who: null, team: "—",       dDay: +9, owner: "본인",   done: false },
    { id: "T-307", type: "오프보딩", title: "장비 회수 — 임준서",                    sub: "MacBook Pro, 모니터, 키보드 회수 확인", who: "임준서", team: "개발팀",   dDay: +30, owner: "IT",   done: false },
  ],
  myTasksCounts: { 전체: 61, 휴가: 25, 급여: 4, 온보딩: 25, 오프보딩: 6, 성과: 1 },
  // 부서별 휴가 사용률
  leaveByDept: [
    { dept: "경영지원본부",  pct: 60, color: 268, used: 56,  total: 92 },
    { dept: "개발팀",       pct: 58, color: 215, used: 84,  total: 145 },
    { dept: "영업팀",       pct: 55, color: 155, used: 47,  total: 86 },
    { dept: "재무/회계팀",   pct: 52, color: 40,  used: 41,  total: 78 },
    { dept: "품질관리팀",    pct: 52, color: 10,  used: 38,  total: 73 },
    { dept: "인사팀",       pct: 50, color: 230, used: 33,  total: 66 },
    { dept: "생산기술팀",    pct: 50, color: 295, used: 45,  total: 90 },
    { dept: "연구개발팀",    pct: 47, color: 200, used: 62,  total: 132 },
    { dept: "생산/제조팀",   pct: 40, color: 130, used: 92,  total: 230 },
    { dept: "구매/조달팀",   pct: 38, color: 65,  used: 25,  total: 66 },
  ],
  leaveSummary: {
    companyUsage: 48.3, used: 673.0, total: 1392.0,
    avgRemaining: 10.3, employees: 70,
    minus: 0,
    pending: 4,
    forecastUnused: 86.9,
  },
  leaveDistribution: [
    { bucket: "0일 이하",  count: 0 },
    { bucket: "1–3일",    count: 7 },
    { bucket: "4–7일",    count: 19 },
    { bucket: "8–11일",   count: 26 },
    { bucket: "12–15일",  count: 4 },
    { bucket: "15일 초과", count: 14 },
  ],
  // 근태
  attendanceToday: {
    total: 72, present: 0, late: 0, absent: 72, avgHours: { h: 0, m: 0 },
  },
  attendanceWeek: [
    { dayKr: "월", day: "05/11", present: 64, late: 2,  absent: 6 },
    { dayKr: "화", day: "05/12", present: 66, late: 1,  absent: 5 },
    { dayKr: "수", day: "05/13", present: 65, late: 3,  absent: 4 },
    { dayKr: "목", day: "05/14", present: 67, late: 0,  absent: 5 },
    { dayKr: "금", day: "05/15", present: 60, late: 4,  absent: 8 },
    { dayKr: "월", day: "05/18", present: 0,  late: 0,  absent: 72 },
  ],
  attendanceList: [
    { name: "강성민", code: "CTR-KR-3026", inAt: "08:52", outAt: "—",     status: "근무중", type: "정규" },
    { name: "강하준", code: "CTR-KR-3066", inAt: "08:48", outAt: "—",     status: "근무중", type: "정규" },
    { name: "권시우", code: "CTR-KR-3035", inAt: "09:12", outAt: "—",     status: "지각",   type: "정규" },
    { name: "권동혁", code: "CTR-KR-3055", inAt: "—",     outAt: "—",     status: "결근",   type: "정규" },
    { name: "김민준", code: "CTR-KR-3001", inAt: "08:31", outAt: "—",     status: "근무중", type: "정규" },
    { name: "김민준", code: "CTR-KR-3061", inAt: "08:55", outAt: "—",     status: "근무중", type: "정규" },
    { name: "김수빈", code: "CTR-KR-3041", inAt: "—",     outAt: "—",     status: "휴가",   type: "연차" },
    { name: "박지훈", code: "CTR-KR-3088", inAt: "08:43", outAt: "—",     status: "근무중", type: "정규" },
    { name: "이상민", code: "CTR-KR-3091", inAt: "—",     outAt: "—",     status: "출장",   type: "외근" },
    { name: "정유진", code: "CTR-KR-3022", inAt: "13:00", outAt: "—",     status: "반차",   type: "오후" },
  ],
  // 직원 디렉토리 (직원 관리 페이지용)
  directory: [
    { code: "CTR-KR-3026", name: "강성민", nameEn: "Kang Sungmin", dept: "연구개발팀",  team: "연구개발", title: "연구사원B", rank: "사원",  joinDate: "2022-06-01", employment: "정규직", status: "재직", hue: 268, manager: "홍채원", email: "kr3026@ctr.co.kr" },
    { code: "CTR-KR-3066", name: "강하준", nameEn: "Kang Hajun",   dept: "인사팀",     team: "사무직", title: "주임",     rank: "주임",  joinDate: "2022-10-01", employment: "정규직", status: "재직", hue: 200 },
    { code: "CTR-KR-3006", name: "강하준", nameEn: "Kang Hajun",   dept: "생산/제조팀", team: "생산직", title: "기사",     rank: "기사",  joinDate: "2022-10-01", employment: "정규직", status: "재직", hue: 130 },
    { code: "CTR-KR-3055", name: "권동혁", nameEn: "Kwon Donghyuk",dept: "구매/조달팀", team: "사무직", title: "대리",     rank: "대리",  joinDate: "2023-11-01", employment: "정규직", status: "재직", hue: 40 },
    { code: "CTR-KR-3035", name: "권시우", nameEn: "Kwon Siwoo",   dept: "품질관리팀",  team: "생산직", title: "사원",     rank: "사원",  joinDate: "2023-03-01", employment: "정규직", status: "재직", hue: 10 },
    { code: "CTR-KR-3015", name: "권하은", nameEn: "Kwon Haeun",   dept: "생산/제조팀", team: "생산직", title: "주임",     rank: "주임",  joinDate: "2023-07-01", employment: "정규직", status: "휴직", hue: 295 },
    { code: "CTR-KR-3001", name: "김민준", nameEn: "Kim Minjun",   dept: "생산/제조팀", team: "생산직", title: "기장",     rank: "기장",  joinDate: "2021-05-01", employment: "정규직", status: "재직", hue: 155 },
    { code: "CTR-KR-3061", name: "김민준", nameEn: "Kim Minjun",   dept: "재무/회계팀", team: "사무직", title: "대리",     rank: "대리",  joinDate: "2021-05-01", employment: "정규직", status: "재직", hue: 230 },
    { code: "CTR-KR-3041", name: "김수빈", nameEn: "Kim Subin",    dept: "영업팀",     team: "사무직", title: "사원",     rank: "사원",  joinDate: "2021-09-01", employment: "정규직", status: "재직", hue: 320 },
    { code: "CTR-KR-3088", name: "박지훈", nameEn: "Park Jihoon",  dept: "생산기술팀",  team: "사무직", title: "선임",     rank: "선임",  joinDate: "2020-04-01", employment: "정규직", status: "재직", hue: 50  },
    { code: "CTR-KR-3091", name: "이상민", nameEn: "Lee Sangmin",  dept: "영업팀",     team: "사무직", title: "차장",     rank: "차장",  joinDate: "2018-02-01", employment: "정규직", status: "재직", hue: 245 },
    { code: "CTR-KR-3022", name: "정유진", nameEn: "Jung Yujin",   dept: "재무/회계팀", team: "사무직", title: "과장",     rank: "과장",  joinDate: "2019-08-01", employment: "정규직", status: "재직", hue: 340 },
    { code: "CTR-KR-3077", name: "홍채원", nameEn: "Hong Chaewon", dept: "연구개발팀",  team: "연구개발", title: "수석",     rank: "수석",  joinDate: "2016-03-01", employment: "정규직", status: "재직", hue: 215 },
    { code: "CTR-KR-3045", name: "최승현", nameEn: "Choi Seunghyun",dept: "개발팀",    team: "연구개발", title: "책임",     rank: "책임",  joinDate: "2019-11-01", employment: "정규직", status: "재직", hue: 100 },
    { code: "CTR-KR-3058", name: "임수정", nameEn: "Lim Sujung",   dept: "경영지원본부", team: "사무직", title: "부장",     rank: "부장",  joinDate: "2015-06-01", employment: "정규직", status: "재직", hue: 280 },
    { code: "CTR-KR-3072", name: "송하늘", nameEn: "Song Haneul",  dept: "연구개발팀",  team: "연구개발", title: "사원",     rank: "사원",  joinDate: "2024-01-01", employment: "정규직", status: "재직", hue: 175 },
    { code: "CTR-KR-3081", name: "유서아", nameEn: "Yoo Seoa",     dept: "인사팀",     team: "사무직", title: "사원",     rank: "사원",  joinDate: "2024-09-01", employment: "수습",  status: "재직", hue: 30  },
    { code: "CTR-KR-3018", name: "노태형", nameEn: "Noh Taehyung", dept: "구매/조달팀", team: "사무직", title: "주임",     rank: "주임",  joinDate: "2022-04-01", employment: "정규직", status: "재직", hue: 75  },
  ],
  departments: ["전체 부서", "연구개발팀", "인사팀", "생산/제조팀", "구매/조달팀", "품질관리팀", "영업팀", "재무/회계팀", "생산기술팀", "개발팀", "경영지원본부"],
  employmentTypes: ["전체 고용형태", "정규직", "계약직", "수습", "파트타임"],
  // N+20: HireWorker 위저드 옵션 SSOT (인라인 → 동적 생성)
  ranks: ["사원", "주임", "대리", "과장", "차장", "부장", "임원"],
  salaryBands: ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "M1", "M2"],
  onboardingTemplates: ["신규입사 온보딩", "경력입사 온보딩 (시니어)", "인턴 온보딩", "임원 온보딩"],
  // N+20: 매핑 layer (proto L 체계 ↔ codebase R 체계, employeeDetail.payroll.band="R3" 정합)
  // 단일 체계 채택은 X4 cross-surface 별도 트랙
  salaryBandMapping: { L0: "R0", L1: "R1", L2: "R2", L3: "R3", L4: "R4", L5: "R5", L6: "R5", M1: "R5", M2: "R5" },
  statuses: ["전체 상태", "재직", "휴직", "퇴사예정"],
  // 알림 피드
  notifications: [
    { id: "N-201", kind: "오퍼 수락",     channel: "recruitment.offer_accepted", text: "테스트지원자-offer-1777832098143님이 [E2E offer 채용공고 1777832097842] 오퍼를 수락했어요.", date: "2026-05-04", unread: true,  category: "채용" },
    { id: "N-200", kind: "오퍼 발송",     channel: "recruitment.offer_sent",     text: "테스트지원자-offer-1777832098143님에게 [E2E offer 채용공고 1777832097842] 오퍼가 발송됐어요.", date: "2026-05-04", unread: true,  category: "채용" },
    { id: "N-199", kind: "휴직 활성화 알림", channel: "LOA_ACTIVATED",            text: "E2E 휴직유형 SM 68260 휴직이 시작됐어요 (UNPAID)", date: "2026-05-04", unread: true,  category: "근태" },
    { id: "N-198", kind: "증명서 발급 요청", channel: "CERTIFICATE_REQUESTED",     text: "이민준님이 재직증명서를 신청했어요.", date: "2026-05-04", unread: true,  category: "시스템" },
    { id: "N-197", kind: "오퍼 수락",     channel: "recruitment.offer_accepted", text: "테스트지원자-offer-1777830191169님이 [E2E offer 채용공고 1777830184565] 오퍼를 수락했어요.", date: "2026-05-04", unread: true,  category: "채용" },
    { id: "N-196", kind: "오퍼 발송",     channel: "recruitment.offer_sent",     text: "테스트지원자-offer-1777830191169님에게 [E2E offer 채용공고 1777830184565] 오퍼가 발송됐어요.", date: "2026-05-04", unread: true,  category: "채용" },
    { id: "N-195", kind: "결재 위임됨",     channel: "delegation.assigned",        text: "강하준님에게 5월 17일 ~ 5월 21일 휴가 결재 권한이 위임됐어요.", date: "2026-05-03", unread: false, category: "승인" },
    { id: "N-194", kind: "1:1 미팅 예정",   channel: "manager.one_on_one",         text: "박서연님과의 1:1 미팅이 5월 22일 오전 10:40에 예정돼 있어요.", date: "2026-05-03", unread: false, category: "성과" },
    { id: "N-193", kind: "MBO 목표 등록",   channel: "performance.mbo_open",       text: "2026 상반기 MBO 목표 등록이 시작됐어요. 6월 1일까지 제출해 주세요.", date: "2026-05-01", unread: false, category: "성과" },
    { id: "N-192", kind: "지각 알림",       channel: "attendance.late",            text: "권시우님이 09:12에 출근했어요. (정시 09:00)", date: "2026-04-30", unread: false, category: "근태" },
    { id: "N-191", kind: "시스템 점검 공지", channel: "system.maintenance",        text: "5월 19일 (월) 02:00 ~ 04:00 시스템 점검 예정", date: "2026-04-29", unread: false, category: "시스템" },
  ],

  // 매니저 허브 / 팀 현황
  managerHub: {
    member_count: 12,
    risk_count: 0,
    overtime_avg: 0,
    one_on_one_pending: 0,
    radar: [
      { axis: "출근율",       value: 100 },
      { axis: "초과근무 준수", value:  72 },
      { axis: "1:1 완료율",    value:  45 },
      { axis: "목표 진행률",   value:  30 },
      { axis: "칭찬 횟수",     value:  15 },
    ],
    teamAlerts: [],
    aiRec: {
      title: "우수한 팀 관리",
      body: "팀 건강 지표가 양호해요. 현재의 관리 수준을 유지하세요.",
      kind: "positive",
    },
    perfDist: [
      { grade: "O", label: "탁월", count: 1, color: 268 },
      { grade: "E", label: "우수", count: 3, color: 200 },
      { grade: "M", label: "평균", count: 6, color: 155 },
      { grade: "S", label: "미흡", count: 2, color: 25  },
    ],
    mboAvg: 62,
    teamMembers: [
      { name: "강성민", overtime: 0,  leaveUsage: 50, grade: "B+", risk: "LOW",    status: "정상" },
      { name: "강하준", overtime: 0,  leaveUsage: 50, grade: "—",  risk: "MEDIUM", status: "정상" },
      { name: "권시우", overtime: 4,  leaveUsage: 38, grade: "C",  risk: "MEDIUM", status: "주의" },
      { name: "박지훈", overtime: 12, leaveUsage: 20, grade: "A-", risk: "HIGH",   status: "위험" },
      { name: "송하늘", overtime: 0,  leaveUsage: 65, grade: "B",  risk: "LOW",    status: "정상" },
    ],
  },

  // 성과 관리 사이클
  perfCycle: {
    current: { id: "E2E Checkin 1777832088989", phase: 1, label: "초안", myGoals: 0, avgComp: 0, nextDeadline: null },
    steps: ["개시", "목표설정", "평가실시", "결과통보"],
    todo: "사이클을 활성화하세요",
    activeCycles: [
      { id: "E2E Checkin 1777832088989",        type: "Checkin",        phase: "초안",   range: "—~—", count: 0 },
      { id: "E2E Goals Workflow 1777832088380", type: "Goals Workflow", phase: "초안",   range: "—~—", count: 0 },
      { id: "E2E Checkin 1777832084477",        type: "Checkin",        phase: "진행중", range: "—~—", count: 28 },
      { id: "E2E Goals Workflow 1777832083940", type: "Goals Workflow", phase: "진행중", range: "—~—", count: 22 },
      { id: "E2E GoalRevision 1777832062032",   type: "GoalRevision",   phase: "진행중", range: "—~—", count: 12 },
    ],
    submission: { rate: 47, submitted: 31, total: 66 },
  },

  // Executive insights
  insights: {
    overview: {
      headcount: 67, headcountDelta: 0,
      pipeline: { 지원: 5, 서류통과: 0, 면접: 0, 합격: 0, 입사: 0 },
      riskSignals: [
        { title: "번아웃 위험", count: 5, severity: "danger" },
      ],
      corps: [
        { name: "CTR",         people: 67, risk: 0.1, tenure: 3.0,  cost: "₩308.9M" },
        { name: "CTR China",   people: 27, risk: 0.4, tenure: 3.6,  cost: "¥0"      },
        { name: "CTR America", people: 10, risk: 1.0, tenure: 4.4,  cost: "$0"      },
        { name: "CTR Vietnam", people:  8, risk: 1.3, tenure: 4.4,  cost: "₫0"      },
        { name: "CTR Russia",  people:  5, risk: 2.0, tenure: 4.4,  cost: "₽0"      },
        { name: "CTR Mexico",  people:  5, risk: 2.0, tenure: 4.4,  cost: "$0"      },
      ],
    },
    attendance: {
      leaveUsageRate: 46.7,
      h52Violations: 28,
      overtimeAvg: 1.6,
      minusLeave: 0,
      monthlyOvertime: [
        { m: "05", v: 0 }, { m: "06", v: 0 }, { m: "07", v: 5 },
        { m: "08", v: 108 }, { m: "09", v: 100 }, { m: "10", v: 100 },
        { m: "11", v: 100 }, { m: "12", v: 100 }, { m: "01", v: 100 },
        { m: "02", v: 100 }, { m: "03", v: 10 }, { m: "04", v: 0 },
        { m: "05", v: 0 },
      ],
      h52Trend: [
        { m: "05", v: 0 }, { m: "06", v: 0 }, { m: "07", v: 0 },
        { m: "08", v: 20 }, { m: "09", v: 400 }, { m: "10", v: 360 },
        { m: "11", v: 395 }, { m: "12", v: 395 }, { m: "01", v: 380 },
        { m: "02", v: 325 }, { m: "03", v: 0 }, { m: "04", v: 0 },
        { m: "05", v: 0 },
      ],
    },
    teamHealth: {
      score: 84,
      label: "건강한 상태",
      subs: [
        { key: "초과근무",       v: 100 },
        { key: "연차 사용",      v:  63 },
        { key: "성과 분포",      v:  50 },
        { key: "이직 위험",      v: 100 },
        { key: "번아웃 위험",    v: 100 },
      ],
    },
  },

  // 급여 시뮬레이션
  payrollSim: {
    scope: "법인 전체",
    corp: "CTR (주)",
    baseRaise: 3.0,
    bonusMonths: 0,
  },

  channels: [
    { id: "email", label: "이메일",        icon: "Mail",  on: true  },
    { id: "push",  label: "앱 푸시",       icon: "Bell",  on: true  },
    { id: "teams", label: "Microsoft Teams", icon: "Inbox", on: false },
    { id: "slack", label: "Slack",          icon: "Inbox", on: false },
  ],

  // ── 추가 데이터 ──
  payslips: [
    { period: "2026-02", title: "CTR-KR 2026-02 급여", gross: 5810000, deduction: 773156, net: 5036844, status: "지급완료", isNew: false },
    { period: "2026-01", title: "CTR-KR 2026-01 급여", gross: 5810000, deduction: 773156, net: 5036844, status: "new",        isNew: true  },
    { period: "2025-12", title: "CTR-KR 2025-12 급여", gross: 5810000, deduction: 773156, net: 5036844, status: "new",        isNew: true  },
    { period: "2025-11", title: "CTR-KR 2025-11 급여", gross: 5810000, deduction: 773156, net: 5036844, status: "new",        isNew: true  },
    { period: "2025-10", title: "CTR-KR 2025-10 급여", gross: 5810000, deduction: 773156, net: 5036844, status: "new",        isNew: true  },
    { period: "2025-09", title: "CTR-KR 2025-09 급여", gross: 5810000, deduction: 773156, net: 5036844, status: "new",        isNew: true  },
  ],

  benefitsUsage: [
    { name: "대학학자금",       used: 0, total: 2000000 },
    { name: "자기개발비",       used: 0, total: 1000000 },
    { name: "종합건강검진",     used: 0, total: 500000  },
    { name: "안경/렌즈 지원",   used: 0, total: 200000  },
    { name: "사내동호회",       used: 0, total: 50000   },
  ],

  // 역량 자기평가
  skillsAssess: {
    completed: 0, total: 14, weak: 0, strong: 0,
    radar: [
      { axis: "도전",       expected: 60, my: 0 },
      { axis: "신뢰",       expected: 60, my: 0 },
      { axis: "책임",       expected: 60, my: 0 },
      { axis: "존중",       expected: 60, my: 0 },
      { axis: "E2E 역량",   expected: 60, my: 0 },
      { axis: "전략적 사고", expected: 60, my: 0 },
      { axis: "팀 빌딩",    expected: 60, my: 0 },
    ],
    coreValues: [
      { name: "도전", expected: 3, expectedLabel: "우수", levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
      { name: "신뢰", expected: 3, expectedLabel: "우수", levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
      { name: "책임", expected: 3, expectedLabel: "우수", levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
      { name: "존중", expected: 3, expectedLabel: "우수", levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
      { name: "E2E 역량 수정됨", expected: 3, expectedLabel: "우수", levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
      { name: "E2E 역량 수정됨", expected: 3, expectedLabel: "우수", levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
    ],
    leadership: [
      { name: "전략적 사고", expected: 3, levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
      { name: "팀 빌딩",    expected: 3, levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
      { name: "변화 관리",   expected: 3, levels: ["초급", "기본", "우수", "고급", "전문가"], my: null },
    ],
  },

  // 내 교육
  education: {
    counts: { missing: 0, toRequest: 8, recommended: 0, done: 0 },
    courses: [
      { title: "산업안전보건교육", required: true,  hours: 8,  team: "CTR 안전보건팀", category: "myTraining.category.safety"     },
      { title: "성희롱 예방교육",   required: true,  hours: 1,  team: "CTR HR팀",       category: "myTraining.category.compliance" },
      { title: "개인정보보호 교육", required: true,  hours: 2,  team: "CTR IT보안팀",   category: "myTraining.category.compliance" },
      { title: "리더십 기본 과정", required: true,  hours: 16, team: "CTR 인재개발팀", category: "myTraining.category.leadership" },
      { title: "품질관리 심화 과정",required: true,  hours: 24, team: "CTR 품질혁신팀", category: "myTraining.category.technical"  },
      { title: "디자인 시스템 워크숍", required: false, hours: 4, team: "CTR 디자인팀",  category: "myTraining.category.design"    },
      { title: "고급 SQL & 데이터", required: false, hours: 12, team: "CTR 데이터팀",  category: "myTraining.category.technical"  },
      { title: "글로벌 비즈니스 영어", required: false, hours: 20, team: "CTR 글로벌팀", category: "myTraining.category.language"  },
    ],
  },

  // 칭찬/인정 피드
  kudos: [
    { from: { name: "박준혁", en: "Junhyuk Park", team: "생산기술팀", title: "생산기술팀장", hue: 25 },
      to:   { name: "이민준", en: "Minjun Lee",   team: "생산기술팀", title: "생산기술팀원", hue: 200 },
      value: "도전", valueEn: "Challenge", valueColor: 25,
      msg: "E2E recognition test message with sufficient length 1777832081680",
      time: "12일 전", likes: 0 },
    { from: { name: "박준혁", en: "Junhyuk Park", team: "생산기술팀", title: "생산기술팀장", hue: 25 },
      to:   { name: "이민준", en: "Minjun Lee",   team: "생산기술팀", title: "생산기술팀원", hue: 200 },
      value: "도전", valueEn: "Challenge", valueColor: 25,
      msg: "E2E recognition test message with sufficient length 1777832080530",
      time: "12일 전", likes: 0 },
    { from: { name: "한지영", en: "Jiyoung Han",  team: "인사팀",     title: "인사담당선임", hue: 268 },
      to:   { name: "강하준", en: "Kang Hajun",   team: "인사팀",     title: "인사담당",   hue: 200 },
      value: "신뢰", valueEn: "Trust", valueColor: 155,
      msg: "E2E recognition message for outstanding work 44679",
      time: "12일 전", likes: 1 },
  ],

  // 문서/증명서
  myCerts: [
    { type: "myDocuments.certType.INCOME_CERT", date: "2026-05-16", status: "REQUESTED" },
  ],

  // 팀 근태
  teamAttn: {
    present: 0, missing: 4, late: 0,
    rows: [
      { name: "강하준", code: "CTR-KR-3066", title: "대리", inAt: null, outAt: null, status: "미출근", type: null },
      { name: "윤지호", code: "CTR-KR-3068", title: "사원", inAt: null, outAt: null, status: "미출근", type: null },
      { name: "조주원", code: "CTR-KR-3067", title: "사원", inAt: null, outAt: null, status: "미출근", type: null },
      { name: "한지영", code: "CTR-KR-0001", title: "과장", inAt: null, outAt: null, status: "미출근", type: null },
    ],
  },

  // 팀 목표 (manager view)
  teamGoals: [
    { member: { name: "강하준", code: "CTR-KR-3066", hue: 200 },
      summary: { goalCount: 4, weight: 100, avgComp: 0, statusLabel: "승인대기 있음", statusChip: "승인대기 1건" },
      goals: [
        { id: "G1", title: "HR 시스템 활용",   desc: "${데이터 정확도 99% 이상}",   weight: 15, comp: 0, status: "승인",   approver: null },
        { id: "G2", title: "교육 이수율",     desc: "${법정 의무교육 이수율 100%}", weight: 20, comp: 0, status: "승인",   approver: null },
        { id: "G3", title: "직원 유지율",     desc: "${자발적 이직률 5% 이하}",     weight: 30, comp: 0, status: "승인",   approver: null },
        { id: "G4", title: "채용 목표 달성",   desc: "${채용 계획 대비 90% 이상 완료}", weight: 35, comp: 0, status: "승인대기", approver: null },
      ],
    },
    { member: { name: "윤지호", code: "CTR-KR-3068", hue: 155 },
      summary: { goalCount: 3, weight: 100, avgComp: 12, statusLabel: "정상", statusChip: "정상" },
      goals: [],
    },
  ],

  // 1:1 미팅
  oneOnOne: {
    upcoming: [
      { with: { name: "박서연", en: "Park Seoyeon", team: "영업팀", title: "영업사원A", hue: 155 },
        when: "2026-05-22T10:40", type: "목표 점검" },
    ],
    completed: [
      { with: { name: "강성민", hue: 268 }, when: "2026-05-04", type: "정기", openActions: 1 },
      { with: { name: "강성민", hue: 268 }, when: "2026-05-04", type: "정기", openActions: 1 },
    ],
    monthlyFreq: [
      { m: "12", v: 0 }, { m: "01", v: 0 }, { m: "02", v: 0 },
      { m: "03", v: 0 }, { m: "04", v: 0 }, { m: "05", v: 0 },
    ],
    pendingActions: [
      { id: "A1", title: '"Action item 45159"',  due: "2026-05-17T18:14:05.159Z" },
      { id: "A2", title: '"Action item 86334"',  due: "2026-05-17T17:26:26.334Z" },
    ],
    warnings: [
      { msg: "30일+ 미실시: 강하준" },
    ],
  },

  // 조직도
  orgTree: {
    root: { name: "경영지원본부", title: "임원", count: "x명/팀 4팀", code: "1.71억" },
    departments: [
      { name: "개발팀",    title: "서나", count: "x 사원 · 사원", code: "1팀" },
      { name: "영업팀",    title: "정하", count: "x 정직 · 사원", code: "2팀" },
      { name: "생산/제조팀", title: "윤지", count: "x 설치공 · 대리", code: "2팀" },
      { name: "품질관리팀", title: "오지", count: "x 검사관 · 대리", code: "1팀" },
      { name: "재무/회계팀", title: "경시", count: "x 회계사 · 사원", code: "1팀" },
      { name: "구매/조달팀", title: "임명", count: "x 차장 · 사원", code: "1팀" },
      { name: "연구개발팀", title: "최재", count: "x 차장 · 사원", code: "1팀" },
    ],
    hrTeam: { name: "인사팀", title: "수석", count: "x 부장 · 사원", code: "4명" },
  },

  settingsCategories: [
    { id: "org",     title: "조직/인사",       en: "Organization",          icon: "Building",  items: ["법인 기본정보", "부서 구조", "직위 관리", "직급 관리", "직군 관리", "근태 정책", "휴가 정책", "온보딩 템플릿", "오프보딩 템플릿", "감사 로그"], count: 10 },
    { id: "attn",    title: "근태/휴가",        en: "Attendance & Leave",     icon: "Clock",     items: ["근무 스케줄", "주간 근무한도", "교대근무", "유연근무", "휴가 종류", "휴직 종류", "공휴일", "출퇴근 정책", "초과근무 정책", "위치 정책"], count: 10 },
    { id: "pay",     title: "급여/보상",        en: "Payroll & Compensation", icon: "Wallet",    items: ["급여 항목", "공제 항목", "비과세 한도", "연봉 밴드", "인상률 매트릭스", "성과급 규칙", "급여일", "통화/환율"], count: 8 },
    { id: "perf",    title: "성과/평가",        en: "Performance",           icon: "Target",    items: ["평가 주기", "평가 방법론", "등급 체계", "평가 항목", "보정 규칙", "1:1 템플릿", "피드백 정책"], count: 7 },
    { id: "rcr",     title: "채용/온보딩",      en: "Recruitment & Onboarding", icon: "UserPlus", items: ["채용 파이프라인", "면접 평가항목", "AI 스크리닝", "인재 풀", "버디 매칭", "지원 양식"], count: 6 },
    { id: "sys",     title: "시스템",           en: "System",                 icon: "Gear",      items: ["알림 채널", "알림 규칙", "언어/타임존", "역할/권한", "결재 플로우", "감사 로그", "데이터 보존", "연동"], count: 8 },
  ],

  // 직원 상세 (강성민 기본)
  employeeDetail: {
    code: "CTR-KR-3026",
    appointments: [
      { date: "2022-06-01", type: "신규채용",   from: null,         to: "연구개발팀 · 연구사원A", reason: "공개채용 합격" },
      { date: "2023-07-01", type: "직급 변경",  from: "연구사원A",   to: "연구사원B",            reason: "정기 인사" },
      { date: "2024-12-15", type: "팀 이동",   from: "연구개발팀 1파트", to: "연구개발팀 2파트",   reason: "TF 종료 후 본 소속 복귀" },
    ],
    payroll: {
      annual: 52000000,
      monthlyGross: 4333333,
      lastPaid: { date: "2026-04-25", net: 3621400, gross: 4333333 },
      band: "R3 (52,000 ~ 58,000)",
    },
    attendance30: {
      workDays: 22, late: 1, absent: 0, leaveUsed: 1, avgWork: "8h 24m",
      // N+19: 30일 일별 status (p=present, l=late, a=absent, v=leave) — 강성민 시드 다양화
      daily: ["p","p","l","p","p","p","p","a","p","v","p","p","p","p","l","p","p","p","p","p","v","p","p","p","p","p","p","p","p","p"],
    },
    leaveBalance: { remaining: 12.5, total: 18, used: 5.5 },
    evaluation: [
      { period: "2025 상반기", score: "A", manager: "홍채원", comment: "신규 클라이언트 영입 우수, 멘토링 모범" },
      { period: "2024 하반기", score: "A", manager: "홍채원", comment: "신제품 라인 개발 기여 우수" },
      { period: "2024 상반기", score: "B+", manager: "홍채원", comment: "안정적 수행, 협업 강화 필요" },
      { period: "2023 하반기", score: "A-", manager: "홍채원", comment: "성장 가속 구간" },
    ],
    // N+19: MBO 달성 이력 (perf 탭 EM-003 해소)
    mboHistory: [
      { cycle: "2025 H2", goals: 4, achievement: 115, summary: "매출 목표 초과 · 신규 클라이언트 3건 영입" },
      { cycle: "2025 H1", goals: 3, achievement: 108, summary: "팀 프로세스 개선 · 신규 입사자 멘토링 완료" },
      { cycle: "2024 H2", goals: 4, achievement: 102, summary: "시스템 마이그레이션 주도" },
      { cycle: "2024 H1", goals: 3, achievement: 106, summary: "신규 기능 출시 + 안정화" },
    ],
    // N+19: 받은 칭찬 (perf 탭 EM-003 해소)
    praises: [
      { from: "한지영", value: "리더십", reason: "릴리즈 일정 지키며 품질 유지", date: "어제" },
      { from: "홍채원", value: "주도성", reason: "긴급 장비 트러블 신속 해결", date: "1주 전" },
      { from: "이정환", value: "전문성", reason: "월말 결산 빠른 마감", date: "2주 전" },
      { from: "박서연", value: "협업", reason: "타팀 협의 잘 이끌어줌", date: "1개월 전" },
      { from: "한지영", value: "성과", reason: "신규 클라이언트 성공적 영입", date: "2개월 전" },
      { from: "정유진", value: "친절함", reason: "온보딩 도움이 됐어요", date: "3개월 전" },
    ],
    // N+19: 학력 (career 탭 EM-004 해소)
    education: [
      { school: "서울대학교 대학원", major: "산업공학 석사", period: "2018.03 — 2020.02", status: "졸업" },
      { school: "한양대학교",       major: "산업공학 학사", period: "2014.03 — 2018.02", status: "졸업" },
      { school: "서울고등학교",     major: "이공계열",     period: "2011.03 — 2014.02", status: "졸업" },
    ],
    // N+19: 자격증 / 인증 (career 탭 EM-004 해소)
    certifications: [
      { name: "PMP",                     issuer: "PMI",            date: "2023.06", status: "유효" },
      { name: "정보처리기사",            issuer: "한국산업인력공단", date: "2019.05", status: "유효" },
      { name: "TOEIC 950",               issuer: "ETS",            date: "2022.11", status: "갱신 임박" },
      { name: "AWS Solutions Architect", issuer: "Amazon",         date: "2024.03", status: "유효" },
      { name: "Six Sigma Green Belt",    issuer: "사내",           date: "2024.09", status: "유효" },
    ],
    // N+19: 교육 이수 이력 (career 탭 EM-004 해소)
    trainings: [
      { course: "리더십 부트캠프 Lv.2",         hours: 24, type: "내부", date: "2025.11", status: "수료" },
      { course: "데이터 분석 입문",              hours: 16, type: "외부", date: "2025.09", status: "수료" },
      { course: "직장 내 괴롭힘 예방 (법정)",    hours: 1,  type: "법정", date: "2025.06", status: "수료" },
      { course: "정보보안 기초 (법정)",          hours: 2,  type: "법정", date: "2025.03", status: "수료" },
      { course: "Workday 사용자 교육",           hours: 4,  type: "내부", date: "2025.02", status: "수료" },
    ],
    // N+19: 사내 활동 (career 탭 EM-004 해소)
    activities: ["사내 봉사단", "독서 동아리 회장", "OKR 워킹그룹", "사내 발표 (2025 H1)", "신입 멘토"],
  },

  // N+19: directory entry quickStats + recentActivity SSOT (inspector EM-007/EM-008 해소)
  // employee code → { quickStats: {잔여연차/평균OT/최근등급}, recentActivity: [{date,action,icon,color}] }
  directoryStats: {
    "CTR-KR-3026": { // 강성민 (연구개발, 사원)
      quickStats: { leaveRemaining: 12.5, avgOt: 4.2, recentGrade: "A" },
      recentActivity: [
        { date: "어제",    action: "1:1 미팅 완료",            icon: "Users",    color: "var(--accent)" },
        { date: "3일 전",  action: "분기 리뷰 제출",            icon: "Doc",      color: "oklch(50% 0.16 290)" },
        { date: "1주 전",  action: "휴가 1일 사용",             icon: "Calendar", color: "var(--success)" },
        { date: "2주 전",  action: "교육 수료 (HR 애널리틱스)", icon: "Book",     color: "oklch(45% 0.13 230)" },
      ],
    },
    "CTR-KR-3066": { // 강하준 (인사, 주임)
      quickStats: { leaveRemaining: 8.0, avgOt: 2.1, recentGrade: "B+" },
      recentActivity: [
        { date: "오늘",    action: "온보딩 자료 검토",   icon: "Doc",      color: "var(--accent)" },
        { date: "2일 전",  action: "팀 미팅 참여",       icon: "Users",    color: "oklch(50% 0.16 290)" },
        { date: "1주 전",  action: "법정 교육 수료",     icon: "Book",     color: "var(--success)" },
      ],
    },
    "CTR-KR-3006": { // 강하준 (생산/제조, 기사)
      quickStats: { leaveRemaining: 14.0, avgOt: 6.8, recentGrade: "B" },
      recentActivity: [
        { date: "어제",    action: "야간 교대 완료",     icon: "Clock",    color: "var(--warning)" },
        { date: "4일 전",  action: "안전 교육 수료",     icon: "Shield",   color: "var(--success)" },
      ],
    },
    "CTR-KR-3055": { // 권동혁 (구매/조달, 대리)
      quickStats: { leaveRemaining: 5.5, avgOt: 3.4, recentGrade: "A-" },
      recentActivity: [
        { date: "오늘",    action: "벤더 미팅",          icon: "Users",    color: "var(--accent)" },
        { date: "1주 전",  action: "발주 결재 완료",     icon: "Check",    color: "var(--success)" },
        { date: "3주 전",  action: "1:1 미팅",          icon: "Users",    color: "oklch(50% 0.16 290)" },
      ],
    },
    "CTR-KR-3035": { // 권시우 (품질관리, 사원)
      quickStats: { leaveRemaining: 11.0, avgOt: 1.5, recentGrade: "B" },
      recentActivity: [
        { date: "2일 전",  action: "품질 점검 보고",     icon: "Doc",      color: "var(--accent)" },
        { date: "2주 전",  action: "휴가 2일 사용",      icon: "Calendar", color: "var(--success)" },
      ],
    },
    "CTR-KR-3015": { // 권하은 (생산/제조, 주임) — 휴직
      quickStats: { leaveRemaining: 9.5, avgOt: 0,   recentGrade: "—" },
      recentActivity: [
        { date: "2개월 전", action: "휴직 개시",         icon: "Pin",      color: "var(--warning)" },
      ],
    },
    "CTR-KR-3001": { // 김민준 (생산/제조, 기장)
      quickStats: { leaveRemaining: 7.0, avgOt: 8.2, recentGrade: "A" },
      recentActivity: [
        { date: "어제",    action: "팀 빌딩 진행",       icon: "Users",    color: "var(--accent)" },
        { date: "5일 전",  action: "안전 점검 완료",     icon: "Shield",   color: "var(--success)" },
      ],
    },
    "CTR-KR-3061": { // 김민준 (재무/회계, 대리)
      quickStats: { leaveRemaining: 6.5, avgOt: 4.5, recentGrade: "B+" },
      recentActivity: [
        { date: "오늘",    action: "월말 결산 마감",     icon: "Receipt",  color: "var(--success)" },
        { date: "1주 전",  action: "분기 리뷰 제출",     icon: "Doc",      color: "oklch(50% 0.16 290)" },
      ],
    },
    "CTR-KR-3041": { // 김수빈 (영업, 사원)
      quickStats: { leaveRemaining: 10.5, avgOt: 5.0, recentGrade: "A-" },
      recentActivity: [
        { date: "2일 전",  action: "고객사 미팅",        icon: "Users",    color: "var(--accent)" },
        { date: "1주 전",  action: "제안서 제출",        icon: "Doc",      color: "oklch(50% 0.16 290)" },
      ],
    },
    "CTR-KR-3088": { // 박지훈 (생산기술, 선임)
      quickStats: { leaveRemaining: 4.0, avgOt: 7.1, recentGrade: "S" },
      recentActivity: [
        { date: "어제",    action: "신규 라인 가동",     icon: "Hammer",   color: "var(--success)" },
        { date: "1주 전",  action: "기술 리뷰 주재",     icon: "Users",    color: "var(--accent)" },
      ],
    },
    "CTR-KR-3091": { // 이상민 (영업, 차장)
      quickStats: { leaveRemaining: 3.5, avgOt: 5.8, recentGrade: "A" },
      recentActivity: [
        { date: "오늘",    action: "월간 영업 리뷰",     icon: "Chart",    color: "var(--accent)" },
        { date: "3일 전",  action: "팀원 1:1 (3건)",    icon: "Users",    color: "oklch(50% 0.16 290)" },
      ],
    },
    "CTR-KR-3022": { // 정유진 (재무/회계, 과장)
      quickStats: { leaveRemaining: 6.0, avgOt: 4.8, recentGrade: "A-" },
      recentActivity: [
        { date: "오늘",    action: "결산 보고 제출",     icon: "Receipt",  color: "var(--success)" },
        { date: "1주 전",  action: "예산 검토 회의",     icon: "Users",    color: "var(--accent)" },
      ],
    },
    "CTR-KR-3077": { // 홍채원 (연구개발, 수석)
      quickStats: { leaveRemaining: 2.0, avgOt: 9.5, recentGrade: "S" },
      recentActivity: [
        { date: "어제",    action: "팀원 5명 평가 작성", icon: "Doc",      color: "var(--accent)" },
        { date: "3일 전",  action: "기술 위원회 참석",   icon: "Users",    color: "oklch(50% 0.16 290)" },
        { date: "1주 전",  action: "신제품 데모",        icon: "Sparkle",  color: "var(--success)" },
      ],
    },
    "CTR-KR-3045": { // 최승현 (개발, 책임)
      quickStats: { leaveRemaining: 8.5, avgOt: 6.3, recentGrade: "A" },
      recentActivity: [
        { date: "오늘",    action: "코드 리뷰 (8건)",    icon: "Check",    color: "var(--success)" },
        { date: "2일 전",  action: "스프린트 플래닝",    icon: "Users",    color: "var(--accent)" },
      ],
    },
  },
};
