/* global React, Icons, Avatar, Card, ToastContext, fmtKDate */
// CTR HR Hub — 휴가 관리 (Workday Time Off: 팀 캘린더 + 잔여 요약)

const { useState: useStateLV, useMemo: useMemoLV, useContext: useCtxLV } = React;

// ── Mock team calendar events ─────────────────────────
function generateLeaveEvents(directory, daysSpan = 14) {
  const today = new Date("2026-05-17");
  const events = [];

  const samples = [
    { name: "박지훈", offset: -3,  duration: 3, kind: "annual",  label: "연차 3일" },
    { name: "정유진", offset: -1,  duration: 1, kind: "half",    label: "반차" },
    { name: "권하은", offset: 2,   duration: 5, kind: "annual",  label: "연차 5일" },
    { name: "이상민", offset: 6,   duration: 2, kind: "annual",  label: "출장" },
    { name: "최서연", offset: 4,   duration: 1, kind: "sick",    label: "병가" },
    { name: "김민지", offset: 8,   duration: 3, kind: "annual",  label: "연차" },
    { name: "오승현", offset: -2,  duration: 1, kind: "half",    label: "반차" },
    { name: "윤지호", offset: 5,   duration: 7, kind: "special", label: "결혼 휴가" },
    { name: "강성민", offset: 10,  duration: 3, kind: "annual",  label: "연차" },
    { name: "권시우", offset: 1,   duration: 1, kind: "pending", label: "신청 중" },
  ];

  samples.forEach((s) => {
    const employee = directory.find((d) => d.name === s.name);
    const start = new Date(today);
    start.setDate(today.getDate() + s.offset);
    events.push({
      ...s,
      employee: employee || { name: s.name, dept: "—", hue: (s.name.charCodeAt(0) * 31) % 360 },
      start,
      end: new Date(start.getTime() + (s.duration - 1) * 86400000),
    });
  });

  return events;
}

function LeavePage({ data }) {
  const toast = useCtxLV(ToastContext);
  const s = data.leaveSummary;
  const [view, setView] = useStateLV("calendar"); // calendar | by-dept | distribution
  const today = new Date("2026-05-17");
  const daysSpan = 14;
  const [startOffset, setStartOffset] = useStateLV(-2);

  const events = useMemoLV(() => generateLeaveEvents(data.directory, daysSpan), [data.directory]);

  // build day array
  const days = useMemoLV(() => {
    return Array.from({ length: daysSpan }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + startOffset + i);
      return d;
    });
  }, [startOffset]);

  // Compute per-employee event bars for the visible window
  const rows = useMemoLV(() => {
    const windowStart = days[0];
    const windowEnd = days[days.length - 1];
    const visibleEvents = events.filter((e) => e.end >= windowStart && e.start <= windowEnd);
    const map = new Map();
    visibleEvents.forEach((e) => {
      if (!map.has(e.employee.name)) map.set(e.employee.name, []);
      // Calculate position
      const startIdx = Math.max(0, Math.floor((e.start - windowStart) / 86400000));
      const endIdx = Math.min(daysSpan - 1, Math.floor((e.end - windowStart) / 86400000));
      const leftPct = (startIdx / daysSpan) * 100;
      const widthPct = ((endIdx - startIdx + 1) / daysSpan) * 100;
      map.get(e.employee.name).push({ ...e, leftPct, widthPct });
    });
    return [...map.entries()].map(([name, evs]) => ({
      name,
      employee: evs[0].employee,
      events: evs,
    }));
  }, [events, days]);

  const topDept = data.leaveByDept[0];
  const bottomDept = data.leaveByDept[data.leaveByDept.length - 1];
  const maxBucket = Math.max(...data.leaveDistribution.map((d) => d.count));

  const isToday = (d) => d.toDateString() === today.toDateString();
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const pendingLeave = data.approvalQueue.filter((a) => a.type === "휴가" || a.type === "휴직");

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>휴가 관리</h1>
          <div className="greet-sub">2026년 회계연도 · 전사 연차 현황을 한눈에 파악해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 엑셀</button>
          <button className="btn"><Icons.Mail size={13} sw={2} /> 일괄 알림</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 일괄 부여</button>
        </div>
      </div>

      {/* ── Stat strip ─────────────────────────── */}
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Calendar size={13} sw={1.8} /></span> 평균 잔여</div>
          <div className="ss-val">{s.avgRemaining}<span className="u">일</span></div>
          <div className="ss-foot">전사 {s.employees}명 기준</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Chart size={13} sw={1.8} /></span> 사용률</div>
          <div className="ss-val">{s.companyUsage}<span className="u">%</span></div>
          <div className="ss-foot">
            <span className="delta-down">−2.3%p</span>
            <span style={{ opacity: 0.5 }}>전월 대비</span>
          </div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 연말 미소진 예상</div>
          <div className="ss-val">{s.forecastUnused}<span className="u">%</span></div>
          <div className="ss-foot">대상 {s.employees}명 알림 권장</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Inbox size={13} sw={1.8} /></span> 승인 대기</div>
          <div className="ss-val">{s.pending}<span className="u">건</span></div>
          <div className="ss-foot">평균 처리 시간 2.4일</div>
        </div>
      </div>

      {/* ── Pending requests ─────────────────────── */}
      <div className="wd-tab-bar">
        <button aria-selected={view === "calendar"} onClick={() => setView("calendar")}>
          <Icons.Calendar size={13} sw={1.8} /> 팀 캘린더
        </button>
        <button aria-selected={view === "by-dept"} onClick={() => setView("by-dept")}>
          <Icons.Chart size={13} sw={1.8} /> 부서별 사용률
        </button>
        <button aria-selected={view === "distribution"} onClick={() => setView("distribution")}>
          <Icons.Users size={13} sw={1.8} /> 잔여일수 분포
        </button>
        <button aria-selected={view === "analytics"} onClick={() => setView("analytics")}>
          <Icons.Chart size={13} sw={1.8} /> 사용 패턴 분석
        </button>
      </div>

      {/* ── Calendar View ─────────────────────── */}
      {view === "calendar" && (
        <>
          <div className="wd-result-toolbar">
            <button className="btn sm" onClick={() => setStartOffset((o) => o - 7)}>
              <Icons.ChevL size={11} sw={2} /> 이전 주
            </button>
            <button className="btn sm" onClick={() => setStartOffset(-2)}>오늘</button>
            <button className="btn sm" onClick={() => setStartOffset((o) => o + 7)}>
              다음 주 <Icons.ChevR size={11} sw={2} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 12 }}>
              {fmtKDate(days[0].toISOString().slice(0, 10))} — {fmtKDate(days[days.length - 1].toISOString().slice(0, 10))}
            </span>
            <span className="count-display" style={{ marginLeft: "auto" }}>
              <b>{rows.length}</b>명 일정
            </span>
          </div>

          <div className="wd-calendar">
            <div className="wc-h">
              <div className="wc-person-h">구성원</div>
              <div className="wc-day-h" style={{ gridTemplateColumns: `repeat(${daysSpan}, 1fr)` }}>
                {days.map((d, i) => (
                  <div key={i} className={`wc-day ${isWeekend(d) ? "weekend" : ""} ${isToday(d) ? "today" : ""}`}>
                    <span style={{ display: "block", fontSize: 10 }}>{dayNames[d.getDay()]}</span>
                    <span className="wc-d-num">{d.getDate()}</span>
                  </div>
                ))}
              </div>
            </div>

            {rows.map((row) => (
              <div className="wc-row" key={row.name}>
                <div className="wc-person">
                  <Avatar name={row.employee.name} hue={row.employee.hue} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{row.employee.name}</div>
                    <div className="dpt">{row.employee.dept}</div>
                  </div>
                </div>
                <div className="wc-track" style={{ gridTemplateColumns: `repeat(${daysSpan}, 1fr)` }}>
                  {days.map((d, i) => (
                    <div key={i} className={`wc-cell ${isWeekend(d) ? "weekend" : ""} ${isToday(d) ? "today" : ""}`} />
                  ))}
                  {row.events.map((e, i) => (
                    <div
                      key={i}
                      className={`wc-bar ${e.kind}`}
                      style={{ left: `${e.leftPct}%`, width: `${e.widthPct}%` }}
                      title={e.label}
                      onClick={() => toast(`${row.employee.name} · ${e.label}`)}>
                      {e.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="wd-calendar-legend">
              <span className="lg"><span className="sw" style={{ background: "linear-gradient(135deg, oklch(58% 0.16 230), oklch(48% 0.16 250))" }} /> 연차</span>
              <span className="lg"><span className="sw" style={{ background: "linear-gradient(135deg, oklch(60% 0.14 200), oklch(50% 0.14 220))" }} /> 반차</span>
              <span className="lg"><span className="sw" style={{ background: "linear-gradient(135deg, oklch(60% 0.16 25), oklch(50% 0.16 15))" }} /> 병가</span>
              <span className="lg"><span className="sw" style={{ background: "linear-gradient(135deg, oklch(62% 0.16 290), oklch(52% 0.16 305))" }} /> 특별/경조</span>
              <span className="lg"><span className="sw" style={{ background: "linear-gradient(135deg, oklch(72% 0.12 75), oklch(62% 0.14 60))" }} /> 승인 대기</span>
            </div>
          </div>
        </>
      )}

      {/* ── By-dept View ─────────────────────── */}
      {view === "by-dept" && (
        <div className="grid-2">
          <Card>
            <div className="card-head">
              <span className="title">부서별 사용률</span>
              <span className="sub">2026년 누계</span>
            </div>
            <div className="card-pad">
              <div className="bar-chart">
                {data.leaveByDept.map((d) => (
                  <div key={d.dept} className="bar-row">
                    <span className="lbl">{d.dept}</span>
                    <div className="track">
                      <i style={{ width: `${d.pct}%`, "--bar-hue": d.color }} />
                    </div>
                    <span className="pct">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head"><span className="title">연차 소진 예측</span></div>
            <div className="card-pad">
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                    현재 추세 유지 시
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 600, color: "var(--danger)", letterSpacing: "-0.025em", marginTop: 4 }}>
                    {s.forecastUnused}<span style={{ fontSize: 16, color: "var(--fg-faint)" }}>%</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 4 }}>전사 미소진 예상치 (전년 +1.2일)</div>
                </div>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>권장 액션</div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.6 }}>
                    분기별 강제 소진 캠페인 · {s.employees}명 대상 알림 · {bottomDept.dept} 위험군 1:1 면담
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 12 }}>
                    <Icons.Mail size={13} sw={2} /> 미소진 직원 알림 발송
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Distribution View ─────────────────────── */}
      {view === "distribution" && (
        <Card>
          <div className="card-head">
            <span className="title">잔여일수 분포</span>
            <span className="sub">{s.employees}명 · 2026년 5월 17일 기준</span>
          </div>
          <div className="card-pad">
            <div className="vbar" style={{ height: 240 }}>
              {data.leaveDistribution.map((d) => (
                <div key={d.bucket} className="col">
                  <span className="tiny tnum faint" style={{ marginBottom: 4 }}>{d.count > 0 ? d.count : ""}</span>
                  <div
                    className={`bar ${d.count >= maxBucket ? "accent" : ""}`}
                    style={{
                      height: `${Math.max(2, (d.count / maxBucket) * 100)}%`,
                      background: d.count >= maxBucket ? "var(--accent)" : "var(--accent-soft-2)",
                    }}
                  />
                  <div className="bar-lbl">{d.bucket}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Analytics View ─────────────────────── */}
      {view === "analytics" && (
        <>
          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">요일별 신청 패턴</span>
                <span className="sub">최근 12개월 누계</span>
              </div>
              <div className="card-pad">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, alignItems: "flex-end", height: 140 }}>
                  {[
                    { d: "월", n: 28 },
                    { d: "화", n: 32 },
                    { d: "수", n: 18 },
                    { d: "목", n: 22 },
                    { d: "금", n: 68 },
                    { d: "토", n: 4 },
                    { d: "일", n: 2 },
                  ].map((b, i) => {
                    const max = 70;
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.n}</span>
                        <div style={{ width: "70%", height: `${(b.n / max) * 100}%`, background: b.d === "금" ? "var(--accent)" : "var(--accent-soft-2)", borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{b.d}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  <b style={{ color: "var(--fg)" }}>인사이트</b> · <b>금요일 신청 38%</b> 집중 — 황금연휴·연차 연결 패턴. 인력 운영 시 금요일 백업 인원 고려.
                </div>
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">신청 사유 분포</span>
                <span className="sub">12개월 누계 · 374건</span>
              </div>
              <div className="card-pad">
                {[
                  { reason: "개인 휴식", n: 158, pct: 42, color: 230 },
                  { reason: "여행/휴양", n: 94, pct: 25, color: 200 },
                  { reason: "가족 행사", n: 56, pct: 15, color: 290 },
                  { reason: "병가/건강", n: 38, pct: 10, color: 25 },
                  { reason: "경조사",   n: 18, pct: 5,  color: 75 },
                  { reason: "기타",     n: 10, pct: 3,  color: 145 },
                ].map((r) => (
                  <div key={r.reason} style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px", gap: 10, alignItems: "center", marginBottom: 9, fontSize: 12 }}>
                    <span>{r.reason}</span>
                    <div style={{ height: 8, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${r.pct * 2.4}%`, height: "100%", background: `oklch(60% 0.14 ${r.color})`, borderRadius: 3 }} />
                    </div>
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.n} · {r.pct}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head">
              <span className="title">월별 신청 추세</span>
              <span className="sub">계절성 패턴</span>
            </div>
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4, alignItems: "flex-end", height: 160 }}>
                {[
                  { m: "1월", n: 18 }, { m: "2월", n: 22 }, { m: "3월", n: 24 },
                  { m: "4월", n: 26 }, { m: "5월", n: 38 }, { m: "6월", n: 28 },
                  { m: "7월", n: 52 }, { m: "8월", n: 64 }, { m: "9월", n: 30 },
                  { m: "10월", n: 28 }, { m: "11월", n: 18 }, { m: "12월", n: 26 },
                ].map((b, i) => {
                  const max = 70;
                  const isPeak = b.n >= 50;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.n}</span>
                      <div style={{ width: "70%", height: `${(b.n / max) * 100}%`, background: isPeak ? "var(--accent)" : "var(--accent-soft-2)", borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                      <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>{b.m}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--wd-orange-soft)", borderRadius: 8, fontSize: 12, color: "var(--wd-orange-ink)", lineHeight: 1.5, fontWeight: 500 }}>
                ⚠️ <b>7-8월 여름 휴가 시즌</b>에 신청 집중 (월 평균 58건, 다른 달의 2배). 사전 인력 운영 계획 권장.
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <span className="title">부서별 잔여 연차 분위수</span>
              <span className="sub">P25 / 중앙값 / P75 박스플롯</span>
              <div className="right" style={{ fontSize: 11, color: "var(--fg-muted)" }}>단위: 일</div>
            </div>
            <div className="card-pad">
              {[
                { dept: "경영지원본부", p25: 4, p50: 7, p75: 11, n: 4 },
                { dept: "재무/회계팀",  p25: 5, p50: 8, p75: 12, n: 6 },
                { dept: "개발팀",      p25: 6, p50: 9, p75: 13, n: 24 },
                { dept: "인사팀",      p25: 7, p50: 10, p75: 13, n: 4 },
                { dept: "영업팀",      p25: 9, p50: 12, p75: 14, n: 12 },
                { dept: "품질관리팀",   p25: 8, p50: 11, p75: 14, n: 8 },
                { dept: "생산/제조팀",  p25: 10, p50: 13, p75: 15, n: 11 },
                { dept: "구매/조달팀",  p25: 11, p50: 14, p75: 15, n: 2 },
              ].map((d) => {
                const max = 15;
                const start = (d.p25 / max) * 100;
                const mid = (d.p50 / max) * 100;
                const end = (d.p75 / max) * 100;
                const risk = d.p50 >= 12;
                return (
                  <div key={d.dept} style={{ display: "grid", gridTemplateColumns: "110px 60px 1fr 130px", gap: 10, alignItems: "center", marginBottom: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>{d.dept}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontSize: 10.5 }}>{d.n}명</span>
                    <div style={{ position: "relative", height: 22, background: "var(--bg-sunk)", borderRadius: 4 }}>
                      <div style={{ position: "absolute", left: `${start}%`, width: `${end - start}%`, top: 3, bottom: 3, background: risk ? "oklch(85% 0.07 25)" : "oklch(80% 0.08 230)", borderRadius: 3 }} />
                      <div style={{ position: "absolute", left: `${mid}%`, top: 0, bottom: 0, width: 2, background: risk ? "var(--danger)" : "var(--accent)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
                      <span>{d.p25}</span>
                      <span style={{ color: risk ? "var(--danger)" : "var(--accent)", fontWeight: 700 }}>{d.p50}</span>
                      <span>{d.p75}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                <b style={{ color: "var(--fg)" }}>인사이트</b> · 생산/제조팀 · 구매조달팀 · 영업팀이 잔여 12일+ (위험군). 부서별 강제 사용 캠페인 차등 적용 권장.
              </div>
            </div>
          </Card>
        </>
      )}
      <div className="sec-h" style={{ marginTop: "var(--space-6)" }}>
        <h2>휴가 신청 대기</h2>
        <span className="sub">{pendingLeave.length}건 · 우선순위 자동 정렬</span>
      </div>
      <Card>
        <div className="list">
          {pendingLeave.map((a) => (
            <div key={a.id} className="appr-row">
              <Avatar name={a.who} hue={(a.who.charCodeAt(0) * 31) % 360} />
              <div className="grow">
                <div className="title fw-7">{a.who} · {a.what}</div>
                <div className="meta">
                  <span className="chip accent">{a.type}</span>
                  <span>{a.team}</span>
                  <span className="sep">·</span>
                  <span>{fmtKDate(a.submitted)} 제출</span>
                </div>
              </div>
              {a.urgency === "overdue" && <span className="chip danger">연체</span>}
              {a.urgency === "today" && <span className="chip warning">오늘</span>}
              <button className="btn sm" onClick={() => toast(`${a.who} · 반려`)}>반려</button>
              <button className="btn sm btn-primary" onClick={() => toast(`${a.who} · 승인`)}>승인</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { LeavePage });
