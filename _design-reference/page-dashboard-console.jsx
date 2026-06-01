/* global React, Icons, Avatar, ToastContext, fmtKDate */
// CTR HR Hub — Dashboard "Console" 버전 (Linear/Vercel — operator's tool)

const { useState: useStateCS, useContext: useCtxCS, useMemo: useMemoCS } = React;

function DashboardConsole({ data, setPage, openEmployee }) {
  const toast = useCtxCS(ToastContext);
  const k = data.kpis;
  const queue = data.approvalQueue;

  const overdue = queue.filter((a) => a.urgency === "overdue").length;
  const today = queue.filter((a) => a.urgency === "today").length;
  const delayedOnboarding = data.onboarding.filter((p) => p.status === "delay").length;

  const [selectedId, setSelectedId] = useStateCS(queue[0]?.id);
  const selected = useMemoCS(() => queue.find((a) => a.id === selectedId) || queue[0], [selectedId, queue]);

  const ageDays = (d) => {
    const submitted = new Date(d);
    const diff = Math.floor((Date.now() - submitted.getTime()) / 86400000);
    return diff;
  };

  return (
    <div className="content">
      {/* 헤더 바 — slim, dense, no greeting decoration */}
      <div className="cs-headerbar">
        <h1>
          Inbox <span className="count">{queue.length}</span>
        </h1>
        <span className="cs-statusdot"><span className="d red" /> {overdue} overdue</span>
        <span className="cs-statusdot"><span className="d amber" /> {today} due today</span>
        <span className="cs-statusdot"><span className="d green" /> queue moving</span>
        <div className="right">
          <button className="btn sm" onClick={() => setPage("my-tasks")}>
            <Icons.Inbox size={12} /> 전체 결재함
          </button>
          <button className="btn sm btn-primary" onClick={() => toast("일괄 승인 시뮬레이션")}>
            <Icons.Check size={12} /> 빠른 승인
            <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.7, marginLeft: 4 }}>⌘⏎</kbd>
          </button>
        </div>
      </div>

      {/* KPI strip — mono, no decoration */}
      <div className="cs-kpi-row">
        <div className="c">
          <div className="lbl">Headcount</div>
          <div className="v">{k.headcount.value}<span className="u">people</span></div>
          <div className="delta">±0 · 30d</div>
        </div>
        <div className="c">
          <div className="lbl">Pending Approvals</div>
          <div className="v danger">{k.pendingApprovals.value}<span className="u">items</span></div>
          <div className="delta up">+12 · 7d</div>
        </div>
        <div className="c">
          <div className="lbl">Turnover</div>
          <div className="v">{k.turnoverRate.value.toFixed(1)}<span className="u">%</span></div>
          <div className="delta">flat · 30d</div>
        </div>
        <div className="c">
          <div className="lbl">Open Roles</div>
          <div className="v">{k.openRoles.value}<span className="u">reqs</span></div>
          <div className="delta down">−1 · 7d</div>
        </div>
        <div className="c">
          <div className="lbl">Leave Usage</div>
          <div className="v">{data.leaveSummary.companyUsage}<span className="u">%</span></div>
          <div className="delta down">−2.3pp</div>
        </div>
        <div className="c">
          <div className="lbl">Avg Overtime</div>
          <div className="v warn">1.6<span className="u">h</span></div>
          <div className="delta up">+0.2h</div>
        </div>
      </div>

      {/* Split: queue table + inspector */}
      <div className="cs-split">
        <div className="cs-queue">
          <div className="cs-queue-h">
            <span />
            <span>Request</span>
            <span>Type</span>
            <span>Age</span>
            <span>Status</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>
          {queue.slice(0, 8).map((a) => {
            const age = ageDays(a.submitted);
            return (
              <div
                key={a.id}
                className={`cs-queue-r ${selectedId === a.id ? "selected" : ""}`}
                onClick={() => setSelectedId(a.id)}>
                <span className={`stat-d ${a.urgency}`} />
                <div className="who">
                  <Avatar name={a.who} hue={(a.who.charCodeAt(0) * 31) % 360} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{a.who} · {a.what}</div>
                    <div className="sub">{a.team} · {a.id}</div>
                  </div>
                </div>
                <div className="typ">{a.type}</div>
                <div className={`age ${a.urgency === "overdue" ? "overdue" : ""}`}>{age}d</div>
                <div>
                  {a.urgency === "overdue" && <span className="chip danger">overdue</span>}
                  {a.urgency === "today" && <span className="chip warning">due today</span>}
                  {a.urgency !== "overdue" && a.urgency !== "today" && <span className="chip">queued</span>}
                </div>
                <div className="actions">
                  <button
                    className="btn sm"
                    onClick={(e) => { e.stopPropagation(); toast(`${a.who} · 반려`); }}>
                    Reject
                  </button>
                  <button
                    className="btn sm btn-primary"
                    onClick={(e) => { e.stopPropagation(); toast(`${a.who} · 승인`); }}>
                    Approve
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Inspector — selected approval detail */}
        {selected && (
          <aside className="cs-inspector">
            <div className="cs-inspector-h">
              <Avatar name={selected.who} hue={(selected.who.charCodeAt(0) * 31) % 360}  />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.who}</div>
                <div className="typ">{selected.team}</div>
              </div>
              <div className="id">{selected.id}</div>
            </div>
            <div className="cs-inspector-body">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{selected.what}</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                  {selected.type} · {selected.days}일
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="kvline"><span className="k">제출</span><span className="v mono">{selected.submitted}</span></div>
                <div className="kvline"><span className="k">경과</span><span className="v mono">{ageDays(selected.submitted)}일</span></div>
                <div className="kvline"><span className="k">결재자</span><span className="v">이정환</span></div>
                <div className="kvline"><span className="k">잔여연차</span><span className="v mono">12.5일</span></div>
                <div className="kvline"><span className="k">대체자</span><span className="v">미지정</span></div>
              </div>
              {selected.note && (
                <div style={{
                  padding: 10,
                  background: "var(--bg-sunk)",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontStyle: "italic",
                  color: "var(--fg-muted)",
                  borderLeft: "2px solid var(--border-strong)"
                }}>
                  "{selected.note}"
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500, marginBottom: 2 }}>Activity</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 60 }}>5d ago</span>
                  <span>{selected.who} 제출</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 60 }}>5d ago</span>
                  <span>김민지 → 이정환 라우팅</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-faint)", display: "flex", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 60 }}>now</span>
                  <span style={{ fontStyle: "italic" }}>대기 중…</span>
                </div>
              </div>
            </div>
            <div className="cs-inspector-foot">
              <button className="btn sm" onClick={() => toast(`${selected.who} · 반려`)}>
                Reject
              </button>
              <button className="btn sm btn-primary" onClick={() => toast(`${selected.who} · 승인`)}>
                Approve
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Signals (replaces narrative storytelling) */}
      <div className="sec-h" style={{ marginTop: "var(--space-5)" }}>
        <h2>Signals</h2>
        <span className="sub">자동 감지 · 5건</span>
        <span className="right" style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
          updated 09:00 KST
        </span>
      </div>
      <div className="cs-signals">
        <div className="s danger" onClick={() => setPage("my-tasks")}>
          <div className="ic">!</div>
          <div className="body">
            <div className="head">결재 적체 +250% YoY</div>
            <div className="meta"><b>3건</b> 5일+ 미처리 · 박지훈 · 정유진 · 권하은</div>
          </div>
          <Icons.ArrowR size={12} className="arrow" />
        </div>
        <div className="s warning" onClick={() => setPage("onboarding")}>
          <div className="ic">2</div>
          <div className="body">
            <div className="head">온보딩 평균 +80일 지연</div>
            <div className="meta">신규 입사자 <b>5명</b> · D-12 ~ D-102</div>
          </div>
          <Icons.ArrowR size={12} className="arrow" />
        </div>
        <div className="s accent" onClick={() => setPage("leave")}>
          <div className="ic">3</div>
          <div className="body">
            <div className="head">연말 연차 미소진 예상 86.9%</div>
            <div className="meta">전사 잔여 평균 <b>10.3일</b> · 미소진 대상 70명</div>
          </div>
          <Icons.ArrowR size={12} className="arrow" />
        </div>
        <div className="s danger" onClick={() => setPage("i-health")}>
          <div className="ic">!</div>
          <div className="body">
            <div className="head">번아웃 위험 신호 5명</div>
            <div className="meta">박지훈 — 주 52h 한도 근접 <b>8주</b> · 연차 사용 &lt;20%</div>
          </div>
          <Icons.ArrowR size={12} className="arrow" />
        </div>
        <div className="s success" onClick={() => setPage("perf-cycle")}>
          <div className="ic">✓</div>
          <div className="body">
            <div className="head">MBO 등록 마감 D-16</div>
            <div className="meta">제출 <b>31 / 66</b> (47%)</div>
          </div>
          <Icons.ArrowR size={12} className="arrow" />
        </div>
      </div>

      {/* Mini overview: onboarding + attendance side-by-side dense */}
      <div className="sec-h" style={{ marginTop: "var(--space-5)" }}>
        <h2>Operations</h2>
        <span className="sub">실시간</span>
      </div>
      <div className="grid-2">
        <div className="cs-queue">
          <div className="cs-queue-h" style={{ gridTemplateColumns: "1.4fr 80px 80px 60px" }}>
            <span>Onboarding</span>
            <span>Progress</span>
            <span>D-day</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>
          {data.onboarding.slice(0, 6).map((p) => (
            <div
              key={p.name}
              className="cs-queue-r"
              style={{ gridTemplateColumns: "1.4fr 80px 80px 60px" }}
              onClick={() => setPage("onboarding")}>
              <div className="who">
                <Avatar name={p.name} hue={p.hue} size="sm" />
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{p.name}</div>
                  <div className="sub">입사 {fmtKDate(p.joinDate)}</div>
                </div>
              </div>
              <div className="age">{Math.round((p.progress / p.total) * 100)}%</div>
              <div className={`age ${p.status === "delay" ? "overdue" : ""}`}>D{p.dDay >= 0 ? "+" : ""}{p.dDay}</div>
              <div style={{ textAlign: "right" }}>
                {p.status === "delay" && <span className="chip danger">delay</span>}
                {p.status === "done" && <span className="chip success">done</span>}
                {p.status === "progress" && <span className="chip info">go</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="cs-queue">
          <div className="cs-queue-h" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
            <span>Today · Attendance</span>
            <span>출근</span>
            <span>지각</span>
            <span style={{ textAlign: "right" }}>결근</span>
          </div>
          <div className="cs-queue-r" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", cursor: "default" }}>
            <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>전사 (n=72)</div>
            <div className="age" style={{ color: "var(--success)" }}>64</div>
            <div className="age" style={{ color: "oklch(50% 0.15 75)" }}>3</div>
            <div className="age" style={{ color: "var(--danger)", textAlign: "right" }}>2</div>
          </div>
          {/* week chart inline as bar table */}
          <div style={{ padding: "14px 14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--fg-faint)", marginBottom: 12, fontWeight: 500 }}>최근 7일 출근율</div>
            <div className="vbar" style={{ height: 80, padding: 0 }}>
              {data.attendanceWeek.map((d, i) => {
                const rate = (d.present / 72) * 100;
                return (
                  <div key={i} className="col">
                    <div className="bar accent" style={{ height: `${Math.max(4, rate)}%`, background: "var(--accent)", maxWidth: 18, borderRadius: "2px 2px 0 0" }} />
                    <div className="bar-lbl">{d.dayKr}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardConsole });
