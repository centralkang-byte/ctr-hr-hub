/* global React, Icons, Avatar, Card, ToastContext, fmtKDate */
// CTR HR Hub — 근태 관리 (Workday Time Tracking: 주간 그리드 + 이상치)

const { useState: useStateAT, useMemo: useMemoAT, useContext: useCtxAT } = React;

// ── Generate mock weekly time grid ──────────────────────
function generateWeekGrid(directory, weekStart) {
  // Pick 8 employees for the grid demo
  const employees = directory.slice(0, 8);
  const today = new Date("2026-05-17");

  return employees.map((emp, ei) => {
    const days = Array.from({ length: 7 }, (_, di) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + di);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isFuture = date > today;

      if (isWeekend) {
        return { date, status: "weekend" };
      }
      if (isFuture) {
        return { date, status: "future" };
      }

      // Pseudo-random pattern based on emp+day
      const seed = (ei * 7 + di * 13) % 100;
      if (seed < 5) return { date, status: "absent", hrs: 0 };
      if (seed < 12) {
        return { date, status: "leave", hrs: 0, label: seed < 8 ? "연차" : "반차" };
      }
      if (seed < 22) {
        return { date, status: "late", hrs: 7.5, inAt: "09:15", outAt: "18:30" };
      }
      const ot = seed > 75;
      return {
        date,
        status: "normal",
        hrs: ot ? 9.8 : 8.0 + (seed % 5) * 0.1,
        inAt: "08:5" + (seed % 9),
        outAt: ot ? "20:30" : "18:00",
        overtime: ot,
      };
    });

    return { employee: emp, days };
  });
}

function AttendancePage({ data }) {
  const toast = useCtxAT(ToastContext);
  const t = data.attendanceToday;
  const [view, setView] = useStateAT("today");
  const [weekOffset, setWeekOffset] = useStateAT(0);

  const today = new Date("2026-05-17");
  const weekStart = useMemoAT(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + weekOffset * 7); // Sunday-start
    return d;
  }, [weekOffset]);

  const grid = useMemoAT(() => generateWeekGrid(data.directory, weekStart), [data.directory, weekStart]);

  const wkPresent = data.attendanceWeek.reduce((a, d) => a + d.present, 0);
  const wkTotal = data.attendanceWeek.length * 72;
  const wkPct = Math.round((wkPresent / wkTotal) * 100);

  const isToday = (d) => d.toDateString() === today.toDateString();
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  // Outliers from grid
  const lateThisWeek = grid.flatMap((r) =>
    r.days.filter((d) => d.status === "late").map((d) => ({ emp: r.employee, day: d }))
  ).slice(0, 4);
  const absentThisWeek = grid.flatMap((r) =>
    r.days.filter((d) => d.status === "absent").map((d) => ({ emp: r.employee, day: d }))
  ).slice(0, 4);
  const overtimeThisWeek = grid.flatMap((r) =>
    r.days.filter((d) => d.overtime).map((d) => ({ emp: r.employee, day: d }))
  ).slice(0, 4);

  const fmtDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>근태 관리</h1>
          <div className="greet-sub">{today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })} · 실시간</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 엑셀</button>
          <button className="btn"><Icons.Sparkle size={13} /> 패턴 분석</button>
        </div>
      </div>

      {/* ── Stat strip ─────────────────────────── */}
      {/* ── View tabs ─────────────────────────── */}
      <div className="wd-tab-bar">
        <button aria-selected={view === "today"} onClick={() => setView("today")}>
          <Icons.Clock size={13} sw={1.8} /> 오늘 현황
        </button>
        <button aria-selected={view === "week"} onClick={() => setView("week")}>
          <Icons.Grid size={13} sw={1.8} /> 주간 그리드
        </button>
        <button aria-selected={view === "trend"} onClick={() => setView("trend")}>
          <Icons.Chart size={13} sw={1.8} /> 추세
        </button>
      </div>

      {/* ── Weekly Grid View ──────────────────────────── */}
      {view === "week" && (
        <>
          <div className="wd-result-toolbar">
            <button className="btn sm" onClick={() => setWeekOffset((o) => o - 1)}>
              <Icons.ChevL size={11} sw={2} /> 지난 주
            </button>
            <button className="btn sm" onClick={() => setWeekOffset(0)}>이번 주</button>
            <button className="btn sm" onClick={() => setWeekOffset((o) => o + 1)}>
              다음 주 <Icons.ChevR size={11} sw={2} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 12 }}>
              {fmtKDate(weekStart.toISOString().slice(0, 10))} 주
            </span>
            <span className="count-display" style={{ marginLeft: "auto" }}>
              <b>{grid.length}</b>명 표시 (전체 {data.directory.length}명)
            </span>
          </div>

          {/* Outliers preview */}
          <div className="wd-outliers">
            <div className="ol-card late">
              <div className="ol-h">
                <Icons.Clock size={12} sw={2} /> 이번 주 지각
                <span className="num">{lateThisWeek.length}</span>
              </div>
              {lateThisWeek.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-faint)", textAlign: "center", padding: "8px 0" }}>없음</div>
              ) : lateThisWeek.map((x, i) => (
                <div key={i} className="ol-row">
                  <Avatar name={x.emp.name} hue={x.emp.hue} size="sm" />
                  <span className="nm">{x.emp.name}</span>
                  <span className="det">{fmtDate(x.day.date)} {x.day.inAt}</span>
                </div>
              ))}
            </div>
            <div className="ol-card absent">
              <div className="ol-h">
                <Icons.Alert size={12} sw={2} /> 이번 주 결근
                <span className="num">{absentThisWeek.length}</span>
              </div>
              {absentThisWeek.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-faint)", textAlign: "center", padding: "8px 0" }}>없음</div>
              ) : absentThisWeek.map((x, i) => (
                <div key={i} className="ol-row">
                  <Avatar name={x.emp.name} hue={x.emp.hue} size="sm" />
                  <span className="nm">{x.emp.name}</span>
                  <span className="det">{fmtDate(x.day.date)}</span>
                </div>
              ))}
            </div>
            <div className="ol-card overtime">
              <div className="ol-h">
                <Icons.Clock size={12} sw={2} /> 초과근무 (9h+)
                <span className="num">{overtimeThisWeek.length}</span>
              </div>
              {overtimeThisWeek.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-faint)", textAlign: "center", padding: "8px 0" }}>없음</div>
              ) : overtimeThisWeek.map((x, i) => (
                <div key={i} className="ol-row">
                  <Avatar name={x.emp.name} hue={x.emp.hue} size="sm" />
                  <span className="nm">{x.emp.name}</span>
                  <span className="det">{fmtDate(x.day.date)} {x.day.hrs}h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Time Grid */}
          <div className="wd-time-grid">
            <table>
              <thead>
                <tr>
                  <th>구성원</th>
                  {grid[0]?.days.map((d, i) => {
                    const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                    return (
                      <th key={i} className={`${isWeekend ? "weekend" : ""} ${isToday(d.date) ? "today" : ""}`}>
                        {dayLabels[d.date.getDay()]}
                        <span className="d-num">{d.date.getDate()}</span>
                      </th>
                    );
                  })}
                  <th className="wt-summary">주간 합계</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => {
                  const totalHrs = row.days.reduce((sum, d) => sum + (d.hrs || 0), 0);
                  return (
                    <tr key={row.employee.code}>
                      <td>
                        <div className="wt-person">
                          <Avatar name={row.employee.name} hue={row.employee.hue} size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <div className="nm">{row.employee.name}</div>
                            <div className="dpt">{row.employee.dept}</div>
                          </div>
                        </div>
                      </td>
                      {row.days.map((d, i) => {
                        const cls = `wt-cell ${d.status} ${d.overtime ? "overtime" : ""}`;
                        return (
                          <td key={i} className={cls}>
                            {d.status === "normal" && (
                              <>
                                <span className="hrs">{d.hrs.toFixed(1)}h</span>
                                <span className="time">{d.inAt}–{d.outAt}</span>
                                {d.overtime && <span className="ot-flag">OT</span>}
                              </>
                            )}
                            {d.status === "late" && (
                              <>
                                <span className="hrs">{d.hrs.toFixed(1)}h</span>
                                <span className="status-pill">지각</span>
                              </>
                            )}
                            {d.status === "absent" && <span className="status-pill">결근</span>}
                            {d.status === "leave" && <span className="status-pill">{d.label || "휴가"}</span>}
                            {d.status === "weekend" && <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>—</span>}
                            {d.status === "future" && <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>—</span>}
                          </td>
                        );
                      })}
                      <td className="wt-summary">
                        <span className="total">{totalHrs.toFixed(1)}h</span>
                        <span className="sub">표준 40h</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Today's status view ──────────────────────────── */}
      {view === "today" && (
        <>
          <div className="wd-stat-strip">
            <div className="ss-card ss-green">
              <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={2} /></span> 정상 출근</div>
              <div className="ss-val">{t.present}<span className="u">/{t.total}명</span></div>
              <div className="ss-foot">출근율 {wkPct}% · 7일 평균</div>
            </div>
            <div className="ss-card ss-amber">
              <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={2} /></span> 지각</div>
              <div className="ss-val">{t.late}<span className="u">명</span></div>
              <div className="ss-foot">평균 8분 지연</div>
            </div>
            <div className="ss-card ss-red">
              <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={2} /></span> 결근</div>
              <div className="ss-val">{t.absent}<span className="u">명</span></div>
              <div className="ss-foot">미신청 결근 2건</div>
            </div>
            <div className="ss-card ss-purple">
              <div className="ss-h"><span className="ico"><Icons.Calendar size={13} sw={2} /></span> 휴가/외근</div>
              <div className="ss-val">3<span className="u">명</span></div>
              <div className="ss-foot">박지훈 · 정유진 · 권하은</div>
            </div>
          </div>
          <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head"><span className="title">최근 7일 출근율</span></div>
              <div className="card-pad">
                <div className="vbar" style={{ height: 160 }}>
                  {data.attendanceWeek.map((d, i) => {
                    const rate = (d.present / 72) * 100;
                    return (
                      <div key={i} className="col">
                        <span className="tiny tnum faint">{d.present}</span>
                        <div className="bar accent" style={{ height: `${Math.max(2, rate)}%` }} />
                        <div className="bar-lbl">{d.dayKr}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
            <Card>
              <div className="card-head"><span className="title">오늘 근태 분포</span></div>
              <div className="card-pad">
                {[
                  ["정상 출근", t.total ? (t.present / t.total) * 100 : 0, "var(--success)"],
                  ["지각", t.total ? (t.late / t.total) * 100 : 0, "var(--warning)"],
                  ["결근", t.total ? (t.absent / t.total) * 100 : 0, "var(--danger)"],
                ].map(([lbl, pct, color]) => (
                  <div key={lbl} className="flex center gap-3" style={{ marginBottom: 10 }}>
                    <span className="small fw-6" style={{ width: 80 }}>{lbl}</span>
                    <div className="progress grow" style={{ height: 8 }}>
                      <i style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="mono tnum small fw-6" style={{ width: 50, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div className="card-head">
              <span className="title">직원별 근태</span>
              <span className="sub">{data.attendanceList.length}명 · 오늘</span>
              <span className="right">
                <input className="input" placeholder="이름·사번 검색" style={{ padding: "5px 10px", fontSize: 12, width: 180, marginRight: 6 }} />
                <select className="select" style={{ padding: "5px 10px", fontSize: 12 }}>
                  <option>전체 상태</option><option>근무중</option><option>지각</option><option>결근</option><option>휴가</option>
                </select>
              </span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>이름</th><th>사번</th><th>출근</th><th>퇴근</th><th>근태 상태</th><th>근무 유형</th><th></th></tr>
                </thead>
                <tbody>
                  {data.attendanceList.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <div className="person">
                          <Avatar name={row.name} hue={(row.name.charCodeAt(0) * 47) % 360} size="sm" />
                          <span className="fw-6">{row.name}</span>
                        </div>
                      </td>
                      <td className="code">{row.code}</td>
                      <td className="mono">{row.inAt}</td>
                      <td className="mono">{row.outAt}</td>
                      <td>
                        {row.status === "근무중" && <span className="chip success">근무중</span>}
                        {row.status === "지각" && <span className="chip warning">지각</span>}
                        {row.status === "결근" && <span className="chip danger">결근</span>}
                        {row.status === "휴가" && <span className="chip info">휴가</span>}
                        {row.status === "출장" && <span className="chip info">출장</span>}
                        {row.status === "반차" && <span className="chip info">반차</span>}
                      </td>
                      <td className="small muted">{row.type}</td>
                      <td><button className="btn sm btn-ghost"><Icons.Eye size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Trend view ──────────────────────────── */}
      {view === "trend" && (
        <>
          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">월별 출근율 추이</span>
                <span className="sub">12개월</span>
                <div className="right"><span className="chip success">평균 94.2%</span></div>
              </div>
              <div className="card-pad">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4, alignItems: "flex-end", height: 160 }}>
                  {[
                    { m: "6월", v: 93 }, { m: "7월", v: 91 }, { m: "8월", v: 89 },
                    { m: "9월", v: 94 }, { m: "10월", v: 95 }, { m: "11월", v: 96 },
                    { m: "12월", v: 92 }, { m: "1월", v: 95 }, { m: "2월", v: 94 },
                    { m: "3월", v: 96 }, { m: "4월", v: 95 }, { m: "5월", v: 94 },
                  ].map((b, i) => {
                    const color = b.v >= 95 ? "var(--success)" : b.v >= 90 ? "var(--accent)" : "oklch(50% 0.16 60)";
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.v}%</span>
                        <div style={{ width: "72%", height: `${(b.v - 80) * 5}%`, background: color, borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                        <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>{b.m}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--fg-faint)" }}>
                  ※ 7-8월 휴가 시즌 일시 하락 · 가을부터 회복
                </div>
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">근태 유형 추세</span>
                <span className="sub">최근 6개월</span>
              </div>
              <div className="card-pad">
                {[
                  { type: "정상 출근", trend: [88, 89, 90, 91, 92, 92], color: "var(--success)" },
                  { type: "지각",     trend: [4, 4, 3, 3, 3, 3], color: "oklch(50% 0.16 60)" },
                  { type: "결근",     trend: [2, 2, 2, 2, 2, 2], color: "var(--danger)" },
                  { type: "휴가/외근", trend: [6, 5, 5, 4, 3, 3], color: "oklch(55% 0.14 230)" },
                ].map((t) => {
                  const last = t.trend[t.trend.length - 1];
                  const first = t.trend[0];
                  const delta = last - first;
                  return (
                    <div key={t.type} style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px", gap: 10, alignItems: "center", marginBottom: 12, fontSize: 12 }}>
                      <span>{t.type}</span>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
                        {t.trend.map((v, i) => (
                          <div key={i} style={{ flex: 1, height: `${(v / 100) * 100}%`, background: t.color, borderRadius: 2, opacity: 0.4 + (i / t.trend.length) * 0.6 }} />
                        ))}
                      </div>
                      <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: t.color }}>
                        {last}% {delta !== 0 && <span style={{ fontSize: 10 }}>({delta > 0 ? "+" : ""}{delta})</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head">
              <span className="title">부서별 근태 종합 비교</span>
              <span className="sub">최근 30일</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>부서</th>
                    <th className="right">출근율</th>
                    <th className="right">지각 (회)</th>
                    <th className="right">결근 (회)</th>
                    <th className="right">평균 출근</th>
                    <th className="right">평균 퇴근</th>
                    <th className="right">평균 OT</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { dept: "재무/회계팀", rate: 99, late: 1, absent: 0, in: "08:48", out: "18:12", ot: 0.8 },
                    { dept: "인사팀",     rate: 100, late: 0, absent: 0, in: "08:52", out: "18:24", ot: 2.4 },
                    { dept: "품질관리팀", rate: 97, late: 2, absent: 0, in: "08:45", out: "18:30", ot: 3.2 },
                    { dept: "개발팀",     rate: 96, late: 8, absent: 1, in: "09:08", out: "19:42", ot: 8.4 },
                    { dept: "생산/제조팀", rate: 94, late: 5, absent: 2, in: "08:30", out: "18:30", ot: 6.5 },
                    { dept: "영업팀",     rate: 88, late: 12, absent: 3, in: "08:55", out: "20:14", ot: 12.2 },
                    { dept: "구매/조달팀", rate: 92, late: 3, absent: 1, in: "08:52", out: "18:48", ot: 4.8 },
                  ].map((d) => {
                    const rateColor = d.rate >= 97 ? "var(--success)" : d.rate >= 92 ? "var(--accent)" : "var(--danger)";
                    const otColor = d.ot >= 10 ? "var(--danger)" : d.ot >= 5 ? "oklch(50% 0.16 60)" : "var(--fg-muted)";
                    return (
                      <tr key={d.dept}>
                        <td className="fw-6">{d.dept}</td>
                        <td className="right mono tnum"><span style={{ color: rateColor, fontWeight: 700 }}>{d.rate}%</span></td>
                        <td className="right mono tnum" style={{ color: d.late >= 5 ? "oklch(50% 0.16 60)" : "var(--fg-muted)" }}>{d.late}</td>
                        <td className="right mono tnum" style={{ color: d.absent >= 2 ? "var(--danger)" : "var(--fg-muted)" }}>{d.absent}</td>
                        <td className="right mono tnum small">{d.in}</td>
                        <td className="right mono tnum small">{d.out}</td>
                        <td className="right mono tnum"><span style={{ color: otColor, fontWeight: 700 }}>{d.ot}h</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "14px var(--space-6)", background: "var(--bg-sunk)", fontSize: 12.5, color: "var(--fg-muted)", borderTop: "1px solid var(--border)", lineHeight: 1.6 }}>
              <b style={{ color: "var(--fg)" }}>인사이트</b> · 영업팀이 OT 12.2h로 1위 (52h 위반 위험), 출근율 88%로 최저. 매니저와 업무 조정 권의 권장.
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <span className="title">출근 시간 분포</span>
              <span className="sub">30일 평균 · 정시 09:00 기준</span>
            </div>
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, alignItems: "flex-end", height: 140 }}>
                {[
                  { t: "8:00", n: 2 },
                  { t: "8:15", n: 5 },
                  { t: "8:30", n: 12 },
                  { t: "8:45", n: 22 },
                  { t: "9:00", n: 18 },
                  { t: "9:15", n: 6 },
                  { t: "9:30", n: 2 },
                  { t: "9:45", n: 0 },
                  { t: "10:00+", n: 0 },
                  { t: "기타", n: 0 },
                ].map((b, i) => {
                  const max = 22;
                  const isOnTime = i <= 4;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.n > 0 ? b.n : ""}</span>
                      <div style={{ width: "70%", height: `${(b.n / max) * 100}%`, background: isOnTime ? "var(--success)" : "oklch(50% 0.16 60)", borderRadius: "3px 3px 0 0", minHeight: 2, opacity: b.n === 0 ? 0.15 : 1 }} />
                      <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>{b.t}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--fg-faint)", display: "flex", gap: 16 }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--success)", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 정시 (9:00 이전)</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: "oklch(50% 0.16 60)", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 지각</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

Object.assign(window, { AttendancePage });
