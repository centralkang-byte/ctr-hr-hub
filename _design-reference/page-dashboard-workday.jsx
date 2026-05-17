/* global React, Icons, Avatar, ToastContext, fmtKDate, dDayLabel */
// CTR HR Hub — Dashboard "Workday" 버전 (Worklet 타일 + 히어로 + Awaiting Action)

const { useContext: useCtxWD } = React;

// ── 히어로 우측 일러스트 (계절감 SVG) ───────────────
function HeroScene() {
  return (
    <svg viewBox="0 0 600 240" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      {/* 큰 도형들 */}
      <circle cx="500" cy="70" r="48" fill="rgba(255,255,255,0.10)" />
      <circle cx="480" cy="60" r="28" fill="rgba(255,255,255,0.14)" />
      {/* 부드러운 빌딩 실루엣 */}
      <g opacity="0.18">
        <rect x="380" y="140" width="44" height="100" rx="4" fill="white" />
        <rect x="430" y="100" width="56" height="140" rx="4" fill="white" />
        <rect x="492" y="125" width="40" height="115" rx="4" fill="white" />
        <rect x="538" y="155" width="52" height="85" rx="4" fill="white" />
      </g>
      {/* 점 패턴 */}
      <g opacity="0.4" fill="white">
        {Array.from({ length: 30 }).map((_, i) => {
          const cx = 350 + (i % 10) * 28;
          const cy = 50 + Math.floor(i / 10) * 22;
          return <circle key={i} cx={cx} cy={cy} r="1.4" />;
        })}
      </g>
      {/* 곡선 */}
      <path d="M 280 200 Q 380 180 480 200 T 600 200" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" fill="none" />
      <path d="M 320 220 Q 420 200 520 220 T 600 220" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
    </svg>
  );
}

// ── 워클릿 타일 아이콘 (Workday 스타일 — 가는 흰색 라인) ────────
const WI = {
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.5" /><path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5" />
      <circle cx="17" cy="8" r="2.5" /><path d="M21 17c-.3-2-1.7-3.5-4-4" />
    </svg>
  ),
  pay: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M16 14h2" />
    </svg>
  ),
  time: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  leave: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  perf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  recruit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4" /><path d="M2 20c1-4 4-6 8-6c1 0 2 .2 3 .5" />
      <path d="M19 14v6M16 17h6" />
    </svg>
  ),
  org: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="9" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 12h12v4" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 10v6M12 7v9M16 12v4" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  benefit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="1.5" /><path d="M3 12h18M12 8v12" />
      <path d="M12 8c-2 0-3-1-3-2.5S10 3 12 5c2-2 3-1 3 .5S14 8 12 8z" />
    </svg>
  ),
  learn: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v6c0 2 4 4 9 4s9-2 9-4V7M19 11v6" />
    </svg>
  ),
  expense: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h13l3 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4z" /><path d="M4 9h16M9 14h6M9 17h4" />
    </svg>
  ),
};

function DashboardWorkday({ data, setPage, openEmployee }) {
  const toast = useCtxWD(ToastContext);
  const queue = data.approvalQueue;
  const k = data.kpis;
  const today = new Date();
  const dateStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const overdue = queue.filter((a) => a.urgency === "overdue").length;
  const todayCnt = queue.filter((a) => a.urgency === "today").length;
  const delayedOnboarding = data.onboarding.filter((p) => p.status === "delay").length;
  const totalActions = queue.length + delayedOnboarding;

  // 워클릿 정의 — HR_ADMIN 관점 (인라인 데이터 포함)
  const worklets = [
    {
      color: "t1", icon: WI.team, title: "직원 관리", sub: "전체 67명 · 이번 주 입사 2", count: null, page: "employees",
      inline: [
        { tone: "", text: <>이번 주 입사 <b>2명</b> · 이민준 · 테스트직원</> },
        { tone: "warn", text: <>휴직 예정 <b>1명</b> · 권하은</> },
      ],
    },
    {
      color: "t3", icon: WI.recruit, title: "채용", sub: "진행 5개 · 지원 12명", count: null, page: "jobs",
      inline: [
        { tone: "", text: <><b>을 수락</b> 2건 ↑ · 이번 주</> },
        { tone: "", text: <>대기 인터뷰 <b>3건</b></> },
      ],
    },
    {
      color: "t2", icon: WI.time, title: "근태 관리", sub: "오늘 출근 64/72 · 지각 3", count: null, page: "attendance",
      inline: [
        { tone: "danger", text: <>결근 <b>2명</b> · 미신청</> },
        { tone: "warn", text: <>초과근무 9h+ · <b>5명</b></> },
      ],
    },
    {
      color: "t4", icon: WI.leave, title: "휴가 관리", sub: "승인 대기 7건", count: 7, page: "leave",
      inline: [
        { tone: "danger", text: <>박지훈 · 연차 3일 <b>D+5 연체</b></> },
        { tone: "", text: <>정유진 · 반차 · 권하은 외 4명</> },
      ],
    },
    {
      color: "t5", icon: WI.perf, title: "성과/평가", sub: "MBO 47% 제출 (31/66)", count: null, page: "perf-cycle",
      inline: [
        { tone: "warn", text: <>마감 <b>D-16</b> · 미제출 35명</> },
        { tone: "", text: <>1:1 미팅 <b>12건</b> 예정</> },
      ],
    },
    {
      color: "t6", icon: WI.pay, title: "급여", sub: "다음 지급 5/25 (금)", count: null, page: "payroll",
      inline: [
        { tone: "", text: <>D-<b>7</b> · 지급 대상 67명</> },
        { tone: "", text: <>수동 조정 <b>2건</b> 대기</> },
      ],
    },
    {
      color: "t7", icon: WI.org, title: "조직 관리", sub: "7개 부서 · 1개 팀", count: null, page: "org",
      inline: [
        { tone: "", text: <>발효일 <b>2026.05.16</b></> },
        { tone: "", text: <>예정된 조직개편 없음</> },
      ],
    },
    {
      color: "t8", icon: WI.report, title: "분석/리포트", sub: "Executive 요약", count: null, page: "i-exec",
      inline: [
        { tone: "danger", text: <>번아웃 위험 <b>5명</b> 감지</> },
        { tone: "", text: <>이직률 0.0% · 안정</> },
      ],
    },
  ];

  return (
    <div className="wd-page">
      {/* ── 히어로 배너 ─────────────────────────────── */}
      <div className="wd-hero">
        <div className="wd-hero-scene"><HeroScene /></div>
        <div className="wd-hero-body">
          <div className="wd-hero-eyebrow">{dateStr}</div>
          <h1>안녕하세요, {data.me.name}님</h1>
          <div className="wd-hero-sub">
            오늘 처리하실 일이 <b style={{ color: "white" }}>{totalActions}건</b> 있어요.
            그중 <b style={{ color: "oklch(85% 0.14 50)" }}>{overdue}건은 시작일이 지났으니</b> 먼저 살펴봐 주세요.
          </div>
          <div className="wd-hero-actions">
            <button className="btn btn-primary" onClick={() => setPage("my-tasks")}>
              결재함 열기 →
            </button>
            <button className="btn" onClick={() => setPage("alerts")}>
              알림 보기
            </button>
          </div>
        </div>

        <div className="wd-hero-stat">
          <div className="item">
            <div className="v">{k.headcount.value}</div>
            <div className="k">전사 인원</div>
          </div>
          <div className="item">
            <div className="v">{k.openRoles.value}</div>
            <div className="k">채용 진행</div>
          </div>
          <div className="item">
            <div className="v">{k.turnoverRate.value.toFixed(1)}%</div>
            <div className="k">이직률</div>
          </div>
        </div>
      </div>

      {/* ── 빠른 작업 (Quick Tasks) ──────────────────── */}
      <div className="wd-quick-row">
        <button className="wd-quick" onClick={() => setPage("employees")}>
          <span className="ico"><Icons.UserPlus size={13} sw={2} /></span>
          직원 등록
        </button>
        <button className="wd-quick" onClick={() => toast("급여 실행 시뮬레이션")}>
          <span className="ico"><Icons.Wallet size={13} sw={2} /></span>
          급여 실행
        </button>
        <button className="wd-quick" onClick={() => setPage("i-exec")}>
          <span className="ico"><Icons.Chart size={13} sw={2} /></span>
          분석 리포트
        </button>
        <button className="wd-quick" onClick={() => setPage("jobs")}>
          <span className="ico"><Icons.UserPlus size={13} sw={2} /></span>
          채용 공고 작성
        </button>
        <button className="wd-quick" onClick={() => setPage("onboarding")}>
          <span className="ico"><Icons.Doc size={13} sw={2} /></span>
          온보딩 시작
        </button>
      </div>

      {/* ── Your Top Apps (Worklet 타일) ────────────── */}
      <div className="wd-sec-h">
        <h2>주요 메뉴</h2>
        <span className="sub">자주 쓰는 기능</span>
        <span className="right">
          <a onClick={() => setPage("settings")}>편집하기 →</a>
        </span>
      </div>
      <div className="wd-worklets">
        {worklets.map((w, i) => (
          <button key={i} className="wd-worklet" onClick={() => setPage(w.page)}>
            {w.count && <span className="wd-w-count">{w.count}</span>}
            <div className={`wd-tile ${w.color}`}>{w.icon}</div>
            <div className="wd-w-title">{w.title}</div>
            <div className="wd-w-sub">{w.sub}</div>
            {w.inline && (
              <div className="wd-w-inline">
                {w.inline.map((r, j) => (
                  <div key={j} className={`wi-row ${r.tone || ""}`}>
                    <span className="wi-dot" />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.text}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ── Awaiting Your Action ─────────────────────── */}
      <div className="wd-sec-h">
        <h2>처리 대기</h2>
        <span className="sub">{queue.length}건 · 우선순위 정렬</span>
        <span className="right">
          <a onClick={() => setPage("my-tasks")}>전체 결재함 →</a>
        </span>
      </div>
      <div className="wd-action-stack">
        {queue.slice(0, 4).map((a) => (
          <div
            key={a.id}
            className={`wd-action-card ${a.urgency === "overdue" ? "overdue" : a.urgency === "today" ? "warn" : ""}`}
            onClick={() => setPage("my-tasks")}>
            <div className="ico">
              {a.type === "휴가" ? <Icons.Calendar size={18} sw={1.8} /> :
                a.type === "급여" ? <Icons.Wallet size={18} sw={1.8} /> :
                <Icons.Inbox size={18} sw={1.8} />}
            </div>
            <div className="body">
              <div className="title">{a.what}</div>
              <div className="meta">
                <b>{a.who}</b> · {a.team}
                <span className="sep">·</span>
                <span>{fmtKDate(a.submitted)} 제출</span>
                {a.note && <><span className="sep">·</span><span style={{ fontStyle: "italic", color: "var(--fg-faint)" }}>"{a.note}"</span></>}
              </div>
            </div>
            <div className="right">
              {a.urgency === "overdue" && <span className="chip-due">연체</span>}
              {a.urgency === "today" && <span className="chip-due">오늘</span>}
              {a.urgency !== "overdue" && a.urgency !== "today" && <span className="chip-due">대기</span>}
              <button
                className="btn sm btn-primary"
                onClick={(e) => { e.stopPropagation(); toast(`${a.who} · 승인`); }}>
                승인
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Announcements ──────────────────────────── */}
      <div className="wd-sec-h">
        <h2>공지사항</h2>
        <span className="sub">전사</span>
        <span className="right">
          <a onClick={() => setPage("alerts")}>전체 보기 →</a>
        </span>
      </div>
      <div className="wd-announce-grid">
        <div className="wd-announce-card" onClick={() => setPage("perf-cycle")}>
          <div className="cover cv-1">
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="32" cy="32" r="22" />
              <circle cx="32" cy="32" r="13" />
              <circle cx="32" cy="32" r="4" fill="currentColor" />
              <path d="M32 4v6M32 54v6M4 32h6M54 32h6" />
            </svg>
          </div>
          <div className="body">
            <div className="tag">성과 관리</div>
            <h3 className="title">2026년 상반기 MBO 목표 등록이 시작됐어요</h3>
            <div className="sub">모든 구성원은 5월 31일까지 본인의 상반기 목표 3~5개를 등록해 주세요. 팀장 면담 후 확정돼요.</div>
            <div className="by">
              <Avatar name="한지영" hue={210} size="sm" />
              <span>한지영 · HR팀 · 어제</span>
            </div>
          </div>
        </div>
        <div className="wd-announce-card" onClick={() => setPage("leave")}>
          <div className="cover cv-2">
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="10" y="16" width="44" height="40" rx="3" />
              <path d="M10 26h44M22 8v12M42 8v12" />
              <circle cx="22" cy="38" r="3" fill="currentColor" />
              <circle cx="32" cy="38" r="3" fill="currentColor" opacity="0.6" />
              <circle cx="42" cy="38" r="3" fill="currentColor" opacity="0.4" />
            </svg>
          </div>
          <div className="body">
            <div className="tag">휴가 캠페인</div>
            <h3 className="title">여름 연차 권장 사용 기간 안내 (6/15~8/31)</h3>
            <div className="sub">현재 전사 평균 잔여 10.3일. 분기별 강제 소진 캠페인으로 미소진 86.9%를 줄여보세요.</div>
            <div className="by">
              <Avatar name="한지영" hue={210} size="sm" />
              <span>한지영 · HR팀 · 3일 전</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Timely Suggestions ─────────────────────── */}
      <div className="wd-sec-h">
        <h2>이번 주 권장 작업</h2>
        <span className="sub">AI 자동 감지</span>
      </div>
      <div className="wd-suggest-grid">
        <div className="wd-suggest s1" onClick={() => setPage("i-health")}>
          <div className="ico-pill"><Icons.Alert size={16} sw={1.8} /></div>
          <div className="title">번아웃 위험 신호 5명 감지</div>
          <div className="sub">박지훈 · 정유진 등 — 주 52시간 한도 근접 + 연차 사용률 20% 미만. 1:1 미팅을 권장해요.</div>
          <div className="cta">팀 헬스 보기 <Icons.ArrowR size={11} sw={2} /></div>
        </div>
        <div className="wd-suggest s2" onClick={() => setPage("onboarding")}>
          <div className="ico-pill"><Icons.UserPlus size={16} sw={1.8} /></div>
          <div className="title">온보딩 5명 평균 80일 지연</div>
          <div className="sub">이민준 (D-12), 오승현 (D-74), 윤지호 (D-102). 버디 매칭과 강제 완료를 검토하세요.</div>
          <div className="cta">온보딩 보기 <Icons.ArrowR size={11} sw={2} /></div>
        </div>
        <div className="wd-suggest s3" onClick={() => setPage("perf-cycle")}>
          <div className="ico-pill"><Icons.Target size={16} sw={1.8} /></div>
          <div className="title">MBO 목표 등록 마감 D-16</div>
          <div className="sub">현재 47% 제출 완료 (31/66명). 미제출자 35명에게 리마인더 발송을 권장해요.</div>
          <div className="cta">성과 관리 보기 <Icons.ArrowR size={11} sw={2} /></div>
        </div>
      </div>

      {/* ── 활동 피드 + 온보딩 현황 ─────────── */}
      <div className="grid-2" style={{ marginTop: "var(--space-6)" }}>
        <div>
          <div className="wd-sec-h" style={{ marginTop: 0 }}>
            <h2>활동 피드</h2>
            <span className="sub">최근 알림</span>
            <span className="right">
              <a onClick={() => setPage("alerts")}>전체 →</a>
            </span>
          </div>
          <div className="wd-inbox-card">
            {data.notifications.slice(0, 5).map((n) => {
              const catColor =
                n.category === "채용" ? "var(--wt-3)" :
                n.category === "근태" ? "var(--wt-2)" :
                n.category === "성과" ? "var(--wt-4)" :
                n.category === "승인" ? "var(--wt-6)" :
                "var(--fg-faint)";
              return (
                <div
                  key={n.id}
                  className={`row ${n.unread ? "unread" : ""}`}
                  onClick={() => setPage("alerts")}>
                  <span className="stat" style={n.unread ? {} : { background: "transparent" }} />
                  <div className="body">
                    <div className="title">{n.text}</div>
                    <div className="meta">
                      <span style={{ color: catColor, fontWeight: 600 }}>{n.category}</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{n.kind}</span>
                    </div>
                  </div>
                  <div className="when">{fmtKDate(n.date)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="wd-sec-h" style={{ marginTop: 0 }}>
            <h2>온보딩 진행</h2>
            <span className="sub">{data.onboarding.length}명</span>
            <span className="right">
              <a onClick={() => setPage("onboarding")}>전체 →</a>
            </span>
          </div>
          <div className="wd-inbox-card">
            {data.onboarding.slice(0, 5).map((p) => (
              <div key={p.name} className="row" onClick={() => setPage("onboarding")}>
                <Avatar name={p.name} hue={p.hue} size="sm" />
                <div className="body">
                  <div className="title">{p.name}</div>
                  <div className="meta">
                    입사 {fmtKDate(p.joinDate)} · 진행 {Math.round((p.progress / p.total) * 100)}%
                    {p.status === "delay" && <span style={{ color: "var(--danger)", fontWeight: 600, marginLeft: 6 }}>· 지연</span>}
                  </div>
                </div>
                <div className="when">{dDayLabel(p.dDay)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardWorkday });
