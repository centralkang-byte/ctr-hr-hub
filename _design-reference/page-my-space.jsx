/* global React, Icons, Avatar, Card, CardHead, ToastContext, fmtKDate, Radar,
   LoaRequestDrawer, CertRequestDrawer, BenefitRequestDrawer */
// CTR HR Hub — 나의 공간 (my-space) 페이지 모음

const { useState: useStateMS, useContext: useCtxMS, useMemo: useMemoMS } = React;

// ── 출퇴근 (Attendance — me) ─────────────────────────────
function AttendanceMyPage({ data }) {
  const toast = useCtxMS(ToastContext);
  const [checkedIn, setCheckedIn] = useStateMS(false);
  const [inAt, setInAt] = useStateMS(null);
  const onCheckIn = () => { setCheckedIn(true); setInAt(new Date()); toast("출근 처리 완료"); };
  const onCheckOut = () => { setCheckedIn(false); toast("퇴근 처리 완료"); };

  // 주간 데이터 (목 + 본인 데이터)
  const week = [
    { d: "월", date: "5/12", in: "08:48", out: "18:24", hrs: 8.6, status: "normal" },
    { d: "화", date: "5/13", in: "08:52", out: "18:32", hrs: 8.7, status: "normal" },
    { d: "수", date: "5/14", in: "09:15", out: "18:48", hrs: 8.5, status: "late" },
    { d: "목", date: "5/15", in: "08:50", out: "19:32", hrs: 9.7, status: "overtime" },
    { d: "금", date: "5/16", in: "08:42", out: "18:18", hrs: 8.6, status: "normal" },
    { d: "토", date: "5/17", in: "—",      out: "—",      hrs: 0,   status: "off" },
    { d: "일", date: "5/18", in: "—",      out: "—",      hrs: 0,   status: "off" },
  ];
  const weekHrs = week.reduce((s, d) => s + d.hrs, 0);
  const otHrs = Math.max(0, weekHrs - 40);

  // 월간 캘린더 (30일)
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const r = (i * 31) % 100;
    return r < 5 ? "absent" : r < 12 ? "late" : r < 18 ? "leave" : r >= 80 ? "overtime" : "present";
  });
  const colorOf = (s) => ({ present: "var(--success)", late: "var(--warning)", absent: "var(--danger)", leave: "var(--info)", overtime: "oklch(55% 0.16 290)", off: "var(--bg-sunk)" }[s]);

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>출퇴근</h1>
          <div className="greet-sub">오늘의 근무 현황과 주간·월간 기록을 확인하세요.</div>
        </div>
      </div>

      {/* 출퇴근 액션 카드 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 }}>
              {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", display: "flex", alignItems: "baseline", gap: 12 }}>
              {checkedIn ? (
                <>
                  <span style={{ color: "var(--success)" }}>근무중</span>
                  <span style={{ fontSize: 14, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    {inAt && inAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 출근
                  </span>
                </>
              ) : (
                <>
                  <span>아직 출근 전이에요</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 4 }}>
              {checkedIn ? "퇴근 시 자동으로 시간이 기록돼요." : "출근 버튼을 눌러 근무를 시작하세요."}
            </div>
          </div>
          {checkedIn ? (
            <button className="btn btn-primary lg" onClick={onCheckOut} style={{ borderRadius: 999, padding: "12px 28px" }}>
              <Icons.Logout size={15} /> 퇴근하기
            </button>
          ) : (
            <button className="btn btn-primary lg" onClick={onCheckIn} style={{ borderRadius: 999, padding: "12px 28px" }}>
              <Icons.Check size={15} sw={2.2} /> 출근하기
            </button>
          )}
        </div>
      </Card>

      {/* 이번 주 요약 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">이번 주 근무</span>
          <span className="sub">{week[0].date} ~ {week[6].date}</span>
          <div className="right" style={{ display: "flex", gap: 14, fontSize: 12 }}>
            <span style={{ color: "var(--fg-muted)" }}>주간 합계 <b style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{weekHrs.toFixed(1)}h</b></span>
            <span style={{ color: "var(--fg-muted)" }}>표준 <b style={{ fontFamily: "var(--font-mono)" }}>40h</b></span>
            <span style={{ color: otHrs > 0 ? "oklch(55% 0.16 290)" : "var(--fg-muted)" }}>
              초과 <b style={{ fontFamily: "var(--font-mono)" }}>{otHrs.toFixed(1)}h</b>
            </span>
          </div>
        </div>
        <div className="card-pad">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {week.map((d) => {
              const bg = d.status === "off" ? "var(--bg-sunk)" :
                         d.status === "late" ? "oklch(98% 0.02 60)" :
                         d.status === "overtime" ? "oklch(98% 0.02 290)" :
                         "oklch(98% 0.012 145)";
              const accent = colorOf(d.status === "off" ? "off" : d.status);
              return (
                <div key={d.d} style={{
                  background: bg,
                  borderRadius: 10,
                  padding: "12px 10px",
                  borderTop: d.status !== "off" ? `2px solid ${accent}` : "2px solid var(--border)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 600 }}>{d.d}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFeatureSettings: '"tnum"', marginTop: 2 }}>{d.date}</div>
                  {d.status !== "off" ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 8, color: accent }}>{d.hrs}h</div>
                      <div style={{ fontSize: 10, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{d.in}–{d.out}</div>
                      {d.status === "late" && <div style={{ fontSize: 9.5, color: "oklch(50% 0.16 60)", marginTop: 3, textTransform: "uppercase", fontWeight: 700 }}>지각</div>}
                      {d.status === "overtime" && <div style={{ fontSize: 9.5, color: "oklch(55% 0.16 290)", marginTop: 3, textTransform: "uppercase", fontWeight: 700 }}>OT</div>}
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 16 }}>휴무</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 월간 캘린더 + 통계 */}
      <div className="grid-21">
        <Card>
          <div className="card-head">
            <span className="title">최근 30일 근무</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 5 }}>
              {days30.map((s, i) => (
                <div key={i} title={`${i + 1}일`} style={{ aspectRatio: "1", borderRadius: 5, background: colorOf(s), opacity: 0.78 }} />
              ))}
            </div>
            <div className="flex gap-4" style={{ marginTop: 16, fontSize: 11, color: "var(--fg-muted)", flexWrap: "wrap" }}>
              {[["present", "정상"], ["late", "지각"], ["absent", "결근"], ["leave", "휴가"], ["overtime", "초과근무"]].map(([k, l]) => (
                <span key={k} className="flex center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: colorOf(k), opacity: 0.78 }} /> {l}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">월간 통계</span>
            <span className="sub">5월</span>
          </div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { lbl: "근무일", val: "21", u: "일", color: "var(--fg)" },
              { lbl: "출근 평균", val: "08:52", u: "", color: "var(--success)" },
              { lbl: "퇴근 평균", val: "18:48", u: "", color: "var(--accent)" },
              { lbl: "초과근무 누계", val: "4.2", u: "h", color: "oklch(55% 0.16 290)" },
              { lbl: "지각", val: "1", u: "회", color: "oklch(50% 0.16 60)" },
            ].map((k) => (
              <div key={k.lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{k.lbl}</span>
                <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", color: k.color }}>
                  {k.val}<span style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 500, marginLeft: 2 }}>{k.u}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── 휴가 신청 (Leave request page) ─────────────────────────────
function LeaveReqPage({ data, onOpenModal }) {
  const [tab, setTab] = useStateMS("all");
  const allRequests = [
    { policy: "병가",       from: "2026-02-09", to: "2026-02-09", days: 1, status: "승인됨", reason: "몸이 좋지 않아 휴가 신청합니다" },
    { policy: "연차유급휴가", from: "2026-01-16", to: "2026-01-16", days: 1, status: "승인됨", reason: "개인 사유" },
    { policy: "병가",       from: "2026-01-12", to: "2026-01-12", days: 1, status: "승인됨", reason: "몸이 좋지 않아 휴가 신청합니다" },
    { policy: "연차유급휴가", from: "2025-12-22", to: "2025-12-22", days: 1, status: "승인됨", reason: "개인 사유" },
    { policy: "연차유급휴가", from: "2025-12-08", to: "2025-12-08", days: 1, status: "승인됨", reason: "개인 사유" },
    { policy: "병가",       from: "2025-11-10", to: "2025-11-10", days: 1, status: "승인됨", reason: "몸이 좋지 않아 휴가 신청합니다" },
    { policy: "연차유급휴가", from: "2025-10-14", to: "2025-10-14", days: 1, status: "승인됨", reason: "개인 사유" },
    { policy: "연차유급휴가", from: "2025-10-02", to: "2025-10-02", days: 1, status: "대기",   reason: "개인 사유" },
    { policy: "연차유급휴가", from: "2025-09-16", to: "2025-09-16", days: 1, status: "승인됨", reason: "개인 사유" },
  ];
  const filter = (s) => s === "all" ? allRequests : allRequests.filter((r) => r.status === ({ wait: "대기", approve: "승인됨", reject: "반려됨", cancel: "취소됨" }[s]));
  const visible = filter(tab);
  const tabs = [["all", "전체"], ["wait", "대기"], ["approve", "승인됨"], ["reject", "반려됨"], ["cancel", "취소됨"]];

  // 잔여 정책별
  const balances = [
    { name: "연차유급휴가", remain: 12.5, total: 15, used: 2.5,  color: 230 },
    { name: "병가",        remain: 7,    total: 10, used: 3,    color: 25  },
    { name: "경조사 휴가",  remain: 5,    total: 5,  used: 0,    color: 290 },
    { name: "리프레시 휴가", remain: 3,    total: 3,  used: 0,    color: 145 },
  ];

  // 월별 사용 추세
  const byMonth = [
    { m: "9월", n: 1 }, { m: "10월", n: 1 }, { m: "11월", n: 1 },
    { m: "12월", n: 2 }, { m: "1월", n: 2 }, { m: "2월", n: 2 },
  ];

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>휴가 신청</h1>
          <div className="greet-sub">잔여 휴가를 확인하고 휴가를 신청·관리해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 이력 다운로드</button>
          <button className="btn btn-primary" onClick={onOpenModal}>
            <Icons.Plus size={13} sw={2.2} /> 휴가 신청
          </button>
        </div>
      </div>

      {/* 잔여 카드들 */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head"><span className="title">잔여 휴가</span><span className="sub">2026년 회계연도</span></div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {balances.map((b) => {
              const pct = (b.used / b.total) * 100;
              return (
                <div key={b.name}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 4, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 500 }}>{b.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: `oklch(45% 0.14 ${b.color})` }}>
                      {b.remain}<span style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 500 }}>/{b.total}일</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `oklch(60% 0.14 ${b.color})`, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{b.used}일 사용</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="card-head"><span className="title">월별 사용 패턴</span><span className="sub">최근 6개월</span></div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, alignItems: "flex-end", height: 130 }}>
              {byMonth.map((b, i) => {
                const max = 3;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.n}</span>
                    <div style={{ width: "72%", height: `${(b.n / max) * 100}%`, background: "var(--accent)", borderRadius: "3px 3px 0 0", minHeight: 6 }} />
                    <div style={{ fontSize: 10.5, color: "var(--fg-muted)" }}>{b.m}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--fg)" }}>인사이트</b> · 최근 6개월 평균 1.5일/월 사용. 연말 강제 소진 캠페인 참여 권장.
            </div>
          </div>
        </Card>
      </div>

      {/* 신청 이력 */}
      <div className="wd-result-toolbar">
        <div className="pill-tabs">
          {tabs.map(([id, label]) => (
            <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <span className="count-display" style={{ marginLeft: "auto" }}><b>{visible.length}</b>건</span>
      </div>

      <Card>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>휴가 정책</th><th>시작일</th><th>종료일</th><th>일수</th><th>상태</th><th>사유</th><th></th></tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={i}>
                  <td><span className="chip accent">{r.policy}</span></td>
                  <td className="mono">{fmtKDate(r.from)}</td>
                  <td className="mono">{fmtKDate(r.to)}</td>
                  <td className="mono">{r.days}일</td>
                  <td>
                    {r.status === "승인됨" && <span className="chip success">승인됨</span>}
                    {r.status === "대기"   && <span className="chip warning">대기</span>}
                    {r.status === "반려됨" && <span className="chip danger">반려됨</span>}
                    {r.status === "취소됨" && <span className="chip">취소됨</span>}
                  </td>
                  <td className="small muted">{r.reason}</td>
                  <td>{r.status === "대기" && <button className="btn sm">취소</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── 휴직 신청 (LOA) ─────────────────────────────
function LoaReqPage({ data }) {
  const [openType, setOpenType] = useStateMS(null);
  const items = [
    { type: "출산 휴직",   from: "2025-08-01", to: "2026-07-31", reason: "출산", status: "복직완료" },
    { type: "육아 휴직",   from: "2024-03-01", to: "2024-08-31", reason: "육아", status: "복직완료" },
  ];
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>휴직 신청</h1>
          <div className="greet-sub">출산·육아·기타 휴직을 신청하고 이력을 관리해요.</div>
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => setOpenType("")}>
            <Icons.Plus size={13} sw={2.2} /> 휴직 신청
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
        {[
          { title: "출산 휴직", id: "출산", sub: "출산일 기준 90일 (다태아 120일)", icon: "Heart",    color: 25 },
          { title: "육아 휴직", id: "육아", sub: "만 8세 이하 또는 초2 이하 자녀", icon: "User",     color: 230 },
          { title: "병가 휴직", id: "병가", sub: "장기 치료가 필요한 경우",         icon: "Alert",    color: 60 },
        ].map((t) => {
          const Icon = Icons[t.icon];
          return (
            <button key={t.title} className="card" onClick={() => setOpenType(t.id)} style={{
              padding: "18px 20px", textAlign: "left", cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `oklch(95% 0.05 ${t.color})`, color: `oklch(45% 0.16 ${t.color})`, display: "grid", placeItems: "center" }}>
                <Icon size={16} sw={1.8} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>{t.sub}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>신청하기 →</div>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="card-head"><span className="title">내 휴직 이력</span><span className="sub">{items.length}건</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>유형</th><th>기간</th><th className="right">일수</th><th>사유</th><th className="right">상태</th></tr></thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={i}>
                  <td className="fw-6">{r.type}</td>
                  <td className="mono">{fmtKDate(r.from)} ~ {fmtKDate(r.to)}</td>
                  <td className="right mono tnum">{Math.round((new Date(r.to) - new Date(r.from)) / 86400000)}일</td>
                  <td className="small muted">{r.reason}</td>
                  <td className="right"><span className="chip success">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <LoaRequestDrawer open={openType !== null} onClose={() => setOpenType(null)} defaultType={openType} />
    </div>
  );
}

// ── 급여명세서 (My payslips) ─────────────────────────────
function PayslipMyPage({ data }) {
  const toast = useCtxMS(ToastContext);
  const newCount = data.payslips.filter((p) => p.isNew).length;
  const latest = data.payslips[0];

  // 12개월 추이 (mock — 본인 연봉)
  const yearly = [
    { m: "6월", v: 5.62 }, { m: "7월", v: 5.62 }, { m: "8월", v: 5.62 }, { m: "9월", v: 5.62 },
    { m: "10월", v: 5.62 }, { m: "11월", v: 5.62 }, { m: "12월", v: 5.81 }, { m: "1월", v: 5.81 },
    { m: "2월", v: 5.81 }, { m: "3월", v: 5.81 }, { m: "4월", v: 5.81 }, { m: "5월", v: 5.81 },
  ];

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>급여명세서</h1>
          <div className="greet-sub">
            {newCount > 0 ? (
              <span style={{ color: "var(--wd-orange-ink, oklch(45% 0.13 75))", fontWeight: 600 }}>
                <Icons.Sparkle size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                미열람 명세서 {newCount}건
              </span>
            ) : (
              <span>월별 급여 명세서를 확인하고 다운로드할 수 있어요.</span>
            )}
          </div>
        </div>
        <div className="right">
          <select className="select" defaultValue="2026" style={{ padding: "7px 12px", fontSize: 13 }}>
            <option>2026년</option>
            <option>2025년</option>
            <option>2024년</option>
          </select>
        </div>
      </div>

      {/* 최근 명세서 + 연봉 추이 */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">최근 명세서</span>
            <span className="sub">{latest.period}</span>
            <div className="right">
              <button className="btn sm" onClick={() => toast("PDF 다운로드")}><Icons.Download size={11} sw={2} /> PDF</button>
            </div>
          </div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "8px 0 18px", borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>총 지급액</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>₩{(latest.gross / 10000).toFixed(0)}<span style={{ fontSize: 12, color: "var(--fg-faint)", marginLeft: 2 }}>만</span></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>공제</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", color: "var(--danger)" }}>−₩{(latest.deduction / 10000).toFixed(0)}<span style={{ fontSize: 12, color: "var(--fg-faint)", marginLeft: 2 }}>만</span></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>실수령액</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", color: "var(--accent-ink)" }}>₩{(latest.net / 10000).toFixed(0)}<span style={{ fontSize: 12, color: "var(--fg-faint)", marginLeft: 2 }}>만</span></div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { lbl: "기본급",        v: 4500000 },
                { lbl: "직책수당",      v: 800000  },
                { lbl: "식대보조",      v: 200000  },
                { lbl: "교통비",        v: 100000  },
                { lbl: "기타수당",      v: 210000  },
              ].map((row) => (
                <div key={row.lbl} style={{ display: "flex", padding: "5px 0", fontSize: 12.5, color: "var(--fg-muted)" }}>
                  <span>{row.lbl}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>₩{row.v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head"><span className="title">12개월 추이</span><span className="sub">실수령액 (백만원)</span></div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3, alignItems: "flex-end", height: 130 }}>
              {yearly.map((b, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: "72%", height: `${(b.v / 6.5) * 100}%`, background: i === yearly.length - 1 ? "var(--accent)" : "var(--accent-soft-2)", borderRadius: "2px 2px 0 0", minHeight: 4 }} />
                  <div style={{ fontSize: 9, color: "var(--fg-faint)" }}>{b.m}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--fg)" }}>2025.12</b> 정기 인상 +3.4%. 다음 정기 인상은 <b>2026.12</b> 예정.
            </div>
          </div>
        </Card>
      </div>

      {/* 명세서 그리드 */}
      <div className="wd-section-h">
        <h3>전체 명세서</h3>
        <span className="sub">{data.payslips.length}건</span>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        {data.payslips.map((p) => (
          <button key={p.period} onClick={() => toast(`${p.period} 명세서 열기`)} style={{
            display: "block", width: "100%", textAlign: "left",
            border: p.isNew ? "1.5px solid var(--accent)" : "1px solid var(--border)",
            background: "var(--bg-elev)",
            borderRadius: 12,
            padding: "16px 18px",
            cursor: "pointer",
            transition: "transform 120ms, box-shadow 120ms",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.01em" }}>{p.period}</span>
              {p.isNew ? (
                <span className="chip" style={{ marginLeft: "auto", background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 10.5 }}>
                  <Icons.Sparkle size={10} /> NEW
                </span>
              ) : (
                <span className="chip success" style={{ marginLeft: "auto", fontSize: 10.5 }}>지급완료</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)", marginBottom: 12 }}>월급여 명세</div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--fg-muted)", marginBottom: 3 }}>
              <span>총 지급</span><span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>₩{p.gross.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--fg-muted)", marginBottom: 8 }}>
              <span>공제</span><span style={{ fontFamily: "var(--font-mono)", color: "var(--danger)" }}>−₩{p.deduction.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-ink)" }}>실수령</span>
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-ink)" }}>₩{p.net.toLocaleString()}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 복리후생 (Benefits) ─────────────────────────────
function BenefitsMyPage({ data }) {
  const [open, setOpen] = useStateMS(false);
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>나의 복리후생</h1>
          <div className="greet-sub">2026년 복리후생 사용 현황과 신청 가능 항목을 확인하세요.</div>
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Icons.Plus size={13} sw={2.2} /> 복리후생 신청
          </button>
        </div>
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head"><span className="title">2026년 사용 현황</span></div>
        <div className="card-pad">
          {data.benefitsUsage.map((b) => (
            <div key={b.name} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                  ₩{b.used.toLocaleString()} <span style={{ color: "var(--fg-faint)" }}>/ ₩{b.total.toLocaleString()}</span>
                </span>
              </div>
              <div className="progress" style={{ height: 6 }}>
                <i style={{ width: `${(b.used / b.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="card-head"><span className="title">신청 내역</span></div>
        <div className="empty" style={{ padding: "var(--space-10)" }}>
          <Icons.Gift size={28} />
          <div className="em-title">신청 내역이 없습니다</div>
          <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>대학학자금·자기개발비 등 복리후생을 신청해보세요.</div>
          <button className="btn btn-primary sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>복리후생 신청</button>
        </div>
      </Card>

      <BenefitRequestDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

// ── 역량 자기평가 (Skills self-assessment) ─────────────────────────────
function SkillsAssessPage({ data }) {
  const s = data.skillsAssess;
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>역량 자기평가</h1>
          <div className="greet-sub">역량별 현재 수준을 자기평가하고, 개발 방향을 확인하세요.</div>
        </div>
        <div className="right">
          <select className="select" defaultValue="2026H1"><option>2026 H1</option></select>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-pad">
            <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>평가 완료</div>
            <div style={{ fontSize: 28, fontWeight: 600, marginTop: 4, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>
              {s.completed}<span style={{ color: "var(--fg-faint)", fontSize: 14, fontWeight: 500 }}>/{s.total}</span>
            </div>
            <div className="progress" style={{ marginTop: 12, height: 6 }}>
              <i style={{ width: `${(s.completed / s.total) * 100}%` }} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="card-pad">
            <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>미달 역량</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "var(--danger)", marginTop: 4, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{s.weak}</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>기대 수준 미달</div>
          </div>
        </Card>
        <Card>
          <div className="card-pad">
            <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>강점 역량</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "var(--success)", marginTop: 4, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{s.strong}</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>기대 수준 이상</div>
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head"><span className="title">역량 레이더 차트</span></div>
        <div className="card-pad" style={{ display: "grid", placeItems: "center" }}>
          <Radar data={s.radar.map((r) => ({ axis: r.axis, value: r.expected }))} />
        </div>
      </Card>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <Icons.Book size={14} />
          <span className="title">핵심가치 역량</span>
          <span className="sub">0 / 6 완료</span>
        </div>
        {s.coreValues.map((c, i) => <SkillRow key={i} data={c} />)}
      </Card>

      <Card>
        <div className="card-head">
          <Icons.Book size={14} />
          <span className="title">리더십 역량</span>
          <span className="sub">0 / 3 완료</span>
        </div>
        {s.leadership.map((c, i) => <SkillRow key={i} data={c} />)}
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "var(--space-4)" }}>
        <button className="btn"><Icons.Doc size={13} /> 임시저장</button>
        <button className="btn btn-primary"><Icons.Check size={13} sw={2.2} /> 제출 (0/14)</button>
      </div>
    </div>
  );
}

function SkillRow({ data }) {
  const [selected, setSelected] = useStateMS(data.my);
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{data.name}</div>
      <div style={{ fontSize: 11, color: "var(--fg-faint)", marginBottom: 10 }}>기대 수준: {data.expected} ({data.expectedLabel || "우수"})</div>
      <div style={{ display: "flex", gap: 6 }}>
        {data.levels.map((lbl, i) => {
          const isExpected = i + 1 === data.expected;
          const isSelected = selected === i + 1;
          return (
            <button key={i} onClick={() => setSelected(i + 1)} style={{
              flex: 1, padding: "10px 8px", borderRadius: 8,
              border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
              background: isSelected ? "var(--accent-soft)" : isExpected ? "var(--bg-sunk)" : "var(--bg-elev)",
              textAlign: "center", cursor: "pointer",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "var(--accent-ink)" : "var(--fg)" }}>{i + 1}</div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>{lbl}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 내 교육 (My education) ─────────────────────────────
const EDU_CAT = {
  "myTraining.category.safety":     "안전",
  "myTraining.category.compliance": "법정",
  "myTraining.category.leadership": "리더십",
  "myTraining.category.technical":  "기술",
  "myTraining.category.design":     "디자인",
  "myTraining.category.language":   "어학",
};

function EduMyPage({ data }) {
  const toast = useCtxMS(ToastContext);
  const e = data.education;
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>내 교육</h1>
          <div className="greet-sub">필수 교육 이수와 추천 과정을 확인하세요.</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head"><span className="title">이수 현황</span></div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { lbl: "미이수 필수", v: e.counts.missing, color: "var(--danger)" },
              { lbl: "신청 필요",  v: e.counts.toRequest, color: "oklch(50% 0.16 60)" },
              { lbl: "추천 과정",  v: e.counts.recommended, color: "var(--accent)" },
              { lbl: "이수 완료",  v: e.counts.done, color: "var(--success)" },
            ].map((k) => (
              <div key={k.lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{k.lbl}</span>
                <span style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-mono)", color: k.color, letterSpacing: "-0.02em" }}>{k.v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head"><span className="title">이번 분기 학습 목표</span></div>
          <div className="card-pad">
            <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>목표 이수 시간</div>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", fontFamily: "var(--font-mono)", color: "var(--accent-ink)" }}>
              0<span style={{ fontSize: 14, color: "var(--fg-faint)", fontWeight: 500 }}>/40h</span>
            </div>
            <div className="progress" style={{ height: 8, marginTop: 12 }}><i style={{ width: "0%" }} /></div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--fg)" }}>권장</b> · 분기당 40시간 학습이 권장돼요. 필수 5개 과정을 우선 신청하세요.
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <Icons.Book size={14} />
          <span className="title">신청 가능 과정</span>
          <span className="sub">{e.courses.length}개</span>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {e.courses.map((c, i) => {
            const catLabel = EDU_CAT[c.category] || c.category;
            return (
              <div key={i} style={{
                padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10,
                display: "grid", gridTemplateColumns: "36px 1fr auto auto", gap: 12, alignItems: "center",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-sunk)", color: "var(--fg-muted)", display: "grid", placeItems: "center" }}>
                  <Icons.Book size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.title}</span>
                    {c.required && <span className="chip danger" style={{ fontSize: 10 }}>필수</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                    {catLabel} · {c.hours}h · {c.team}
                  </div>
                </div>
                <span className="chip" style={{ fontSize: 11 }}>{c.hours}시간</span>
                <button className="btn sm btn-primary" onClick={() => toast(`${c.title} 신청`)}>수강 신청</button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── 칭찬/인정 (Kudos / Recognition feed) ─────────────────────────────
function KudosMyPage({ data }) {
  const toast = useCtxMS(ToastContext);
  const [tab, setTab] = useStateMS("feed");

  const myStats = { sent: 14, received: 18, byValue: [
    { v: "도전",   n: 4, c: 25  },
    { v: "신뢰",   n: 6, c: 145 },
    { v: "책임",   n: 5, c: 230 },
    { v: "존중",   n: 3, c: 290 },
  ] };

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>칭찬/인정</h1>
          <div className="greet-sub">동료의 좋은 점을 인정하고, 받은 칭찬을 확인하세요.</div>
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => toast("칭찬 보내기")}>
            <Icons.Heart size={13} /> 칭찬 보내기
          </button>
        </div>
      </div>

      <div className="wd-tab-bar" style={{ marginBottom: "var(--space-4)" }}>
        <button aria-selected={tab === "feed"} onClick={() => setTab("feed")}>
          <Icons.Heart size={13} sw={1.8} /> 피드
        </button>
        <button aria-selected={tab === "sent"} onClick={() => setTab("sent")}>
          <Icons.ArrowR size={13} sw={1.8} /> 내가 보낸 <span className="count">{myStats.sent}</span>
        </button>
        <button aria-selected={tab === "received"} onClick={() => setTab("received")}>
          <Icons.Inbox size={13} sw={1.8} /> 내가 받은 <span className="count">{myStats.received}</span>
        </button>
        <button aria-selected={tab === "stats"} onClick={() => setTab("stats")}>
          <Icons.Chart size={13} sw={1.8} /> 통계
        </button>
      </div>

      {tab === "feed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.kudos.map((k, i) => (
            <Card key={i}>
              <div className="card-pad">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Avatar name={k.from.name} hue={k.from.hue} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{k.from.name}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{k.from.team} · {k.from.title}</div>
                  </div>
                  <Icons.ArrowR size={14} style={{ color: "var(--fg-faint)" }} />
                  <Avatar name={k.to.name} hue={k.to.hue} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{k.to.name}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{k.to.team} · {k.to.title}</div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--fg-faint)" }}>{k.time}</span>
                </div>
                <span className="chip" style={{
                  background: `oklch(95% 0.04 ${k.valueColor})`,
                  color: `oklch(40% 0.18 ${k.valueColor})`,
                  border: 0, marginBottom: 10,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: `oklch(60% 0.18 ${k.valueColor})`, display: "inline-block" }} />
                  {k.value} ({k.valueEn})
                </span>
                <div style={{ fontSize: 14, lineHeight: 1.6, fontStyle: "italic", color: "var(--fg)" }}>
                  "고객 가치를 우선하며 빠르게 협업해주신 점이 인상 깊었어요. 감사해요."
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn sm btn-ghost"><Icons.Heart size={12} /> {k.likes}</button>
                  <button className="btn sm btn-ghost">댓글</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "stats" && (
        <div className="grid-2">
          <Card>
            <div className="card-head"><span className="title">활동 요약</span></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>내가 보낸 칭찬</div>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 4, color: "var(--accent-ink)" }}>{myStats.sent}<span style={{ fontSize: 13, color: "var(--fg-faint)", marginLeft: 2 }}>건</span></div>
              </div>
              <div style={{ padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>내가 받은 칭찬</div>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 4, color: "oklch(50% 0.18 25)" }}>{myStats.received}<span style={{ fontSize: 13, color: "var(--fg-faint)", marginLeft: 2 }}>건</span></div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-head"><span className="title">받은 칭찬 가치 분포</span></div>
            <div className="card-pad">
              {myStats.byValue.map((v) => (
                <div key={v.v} style={{ display: "grid", gridTemplateColumns: "60px 1fr 40px", gap: 10, alignItems: "center", marginBottom: 10, fontSize: 12 }}>
                  <span>{v.v}</span>
                  <div style={{ height: 8, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(v.n / 7) * 100}%`, height: "100%", background: `oklch(60% 0.14 ${v.c})`, borderRadius: 3 }} />
                  </div>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v.n}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {(tab === "sent" || tab === "received") && (() => {
        const items = tab === "sent" ? [
          { to: { name: "이정환", team: "인사팀", hue: 145 }, value: "리더십", valueColor: 290, time: "어제",     msg: "갑작스러운 평가 일정 변경에도 차분하게 대응해주셨어요. 덕분에 팀 전체가 흔들림 없이 진행할 수 있었어요." },
          { to: { name: "박서연", team: "기획팀", hue: 35 },  value: "협업",   valueColor: 230, time: "3일 전",  msg: "타팀과의 미팅 조율을 먼저 챙겨주셔서 일정 손실 없이 끝났어요. 감사해요." },
          { to: { name: "최서연", team: "개발팀", hue: 200 }, value: "친절함", valueColor: 25,  time: "1주 전",  msg: "신입 멘토링 자료까지 직접 정리해서 공유해주신 점 정말 인상 깊었어요." },
          { to: { name: "정유진", team: "재무팀", hue: 290 }, value: "전문성", valueColor: 145, time: "2주 전",  msg: "급여 시뮬레이션 결과 검토가 꼼꼼해서 결재 한 번에 끝났어요." },
          { to: { name: "홍채원", team: "마케팅팀", hue: 60 }, value: "주도성", valueColor: 60,  time: "3주 전",  msg: "내부 캠페인 아이디어를 먼저 제안하고 추진해주셔서 팀 분위기가 좋아졌어요." },
        ] : [
          { from: { name: "이정환", team: "인사팀", hue: 145 }, value: "리더십", valueColor: 290, time: "어제",     msg: "어려운 결재 흐름을 빠르게 정리해주신 점 정말 도움이 됐어요." },
          { from: { name: "박서연", team: "기획팀", hue: 35 },  value: "협업",   valueColor: 230, time: "1주 전",  msg: "타팀 협의를 잘 이끌어주셔서 일정이 단축됐어요." },
          { from: { name: "최서연", team: "개발팀", hue: 200 }, value: "친절함", valueColor: 25,  time: "2주 전",  msg: "온보딩 도움이 정말 컸어요. 첫 주 빠르게 적응했어요." },
          { from: { name: "홍채원", team: "마케팅팀", hue: 60 }, value: "전문성", valueColor: 145, time: "1개월 전", msg: "데이터 기반 의사결정 방식이 인상적이었어요." },
          { from: { name: "권하은", team: "운영팀", hue: 290 },  value: "주도성", valueColor: 230, time: "2개월 전", msg: "1:1 미팅을 먼저 제안해주셔서 큰 도움이 됐어요." },
          { from: { name: "정유진", team: "재무팀", hue: 290 }, value: "친절함", valueColor: 25,  time: "3개월 전", msg: "급여 관련 문의에 친절하게 답변해주셔서 감사해요." },
        ];
        const directionLabel = tab === "sent" ? "보낸" : "받은";
        return (
          <>
            <div className="wd-status-chips" style={{ marginBottom: "var(--space-4)" }}>
              <span className="sc accent"><b>{items.length}</b>건 {directionLabel} 칭찬</span>
              <span className="sc">최근 90일 누적</span>
              <span className="sc success">가장 많은 가치 <b>{tab === "sent" ? "협업" : "리더십"}</b></span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((k, i) => {
                const other = tab === "sent" ? k.to : k.from;
                return (
                  <Card key={i}>
                    <div className="card-pad">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <Avatar name={other.name} hue={other.hue} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                              {tab === "sent" ? `→ ${other.name}` : `${other.name} 님`}
                            </span>
                            <span style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>· {other.team}</span>
                            <span className="chip" style={{
                              background: `oklch(95% 0.04 ${k.valueColor})`,
                              color: `oklch(40% 0.18 ${k.valueColor})`,
                              border: 0,
                              fontSize: 10.5,
                            }}>{k.value}</span>
                            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--fg-faint)" }}>{k.time}</span>
                          </div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-muted)", fontStyle: "italic" }}>
                            "{k.msg}"
                          </div>
                          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                            {tab === "received" && <button className="btn sm btn-ghost"><Icons.Heart size={11} /> 감사 표시</button>}
                            <button className="btn sm btn-ghost">{tab === "sent" ? "이력 보기" : "프로필 보기"}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── 문서/증명서 (Documents/Certs) ─────────────────────────────
const CERT_TYPE = {
  "myDocuments.certType.INCOME_CERT":   "소득금액증명원",
  "myDocuments.certType.EMP_CERT":      "재직증명서",
  "myDocuments.certType.CAREER_CERT":   "경력증명서",
  "myDocuments.certType.SEVERANCE_CERT": "퇴직증명서",
};
const CERT_STATUS = {
  REQUESTED: { label: "요청됨", chip: "warning" },
  APPROVED:  { label: "발급완료", chip: "success" },
  REJECTED:  { label: "반려",   chip: "danger" },
};

function DocsMyPage({ data }) {
  const toast = useCtxMS(ToastContext);
  const [tab, setTab] = useStateMS("cert");
  const [openCert, setOpenCert] = useStateMS(null);
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>내 문서함</h1>
          <div className="greet-sub">증명서를 신청하고, 발급 이력을 확인하세요.</div>
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => setOpenCert("")}>
            <Icons.Plus size={13} sw={2.2} /> 증명서 신청
          </button>
        </div>
      </div>

      <div className="wd-tab-bar" style={{ marginBottom: "var(--space-4)" }}>
        <button aria-selected={tab === "cert"} onClick={() => setTab("cert")}>
          <Icons.Doc size={13} sw={1.8} /> 증명서 <span className="count">{data.myCerts.length}</span>
        </button>
        <button aria-selected={tab === "docs"} onClick={() => setTab("docs")}>
          <Icons.Doc size={13} sw={1.8} /> 보관 문서
        </button>
      </div>

      {tab === "cert" && (
        <>
          {/* 빠른 신청 카드 */}
          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            {[
              { type: "재직증명서",   sub: "현재 재직 상태 증명", time: "즉시 발급" },
              { type: "경력증명서",   sub: "근속 기간 + 직책 이력", time: "1영업일" },
              { type: "소득금액증명원", sub: "연간 소득 증빙", time: "즉시 발급" },
              { type: "퇴직증명서",   sub: "퇴직 후 발급 가능", time: "퇴직자 전용" },
            ].map((c) => (
              <button key={c.type} onClick={() => setOpenCert(c.type)} style={{
                background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12,
                padding: "16px 18px", textAlign: "left", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
                  <Icons.Doc size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.type}</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 2 }}>{c.sub}</div>
                </div>
                <span className="chip" style={{ fontSize: 10.5 }}>{c.time}</span>
              </button>
            ))}
          </div>

          {/* 신청 이력 */}
          <Card>
            <div className="card-head">
              <span className="title">발급 이력</span>
              <span className="sub">최근 12개월</span>
              <div className="right">
                <button className="btn sm"><Icons.Download size={11} /> 일괄 다운로드</button>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>유형</th><th>용도</th><th>신청일</th><th>발급일</th><th>상태</th><th></th></tr>
                </thead>
                <tbody>
                  {(() => {
                    const history = [
                      { type: "소득금액증명원", purpose: "주택 대출",     req: "2026-05-16", iss: null,           status: "REQUESTED" },
                      { type: "재직증명서",     purpose: "비자 갱신",     req: "2026-04-22", iss: "2026-04-22",   status: "APPROVED" },
                      { type: "경력증명서",     purpose: "이직 (외부)",   req: "2026-03-08", iss: "2026-03-09",   status: "APPROVED" },
                      { type: "재직증명서",     purpose: "전세 자금 대출", req: "2026-02-15", iss: "2026-02-15",   status: "APPROVED" },
                      { type: "소득금액증명원", purpose: "신용카드 발급", req: "2025-11-30", iss: "2025-11-30",   status: "APPROVED" },
                      { type: "재직증명서",     purpose: "관공서 제출",   req: "2025-09-12", iss: null,           status: "REJECTED" },
                    ];
                    return history.map((c, i) => {
                      const status = CERT_STATUS[c.status] || { label: c.status, chip: "" };
                      return (
                        <tr key={i}>
                          <td className="fw-6">{c.type}</td>
                          <td className="small muted">{c.purpose}</td>
                          <td className="mono">{fmtKDate(c.req)}</td>
                          <td className="mono">{c.iss ? fmtKDate(c.iss) : <span style={{ color: "var(--fg-faint)" }}>—</span>}</td>
                          <td><span className={`chip ${status.chip}`}>{status.label}</span></td>
                          <td>
                            {c.status === "APPROVED" && <button className="btn sm" onClick={() => toast("PDF 다운로드")}><Icons.Download size={11} /> PDF</button>}
                            {c.status === "REJECTED" && <button className="btn sm" onClick={() => setOpenCert(c.type)}>재신청</button>}
                            {c.status === "REQUESTED" && <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>처리 중</span>}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", background: "var(--bg-sunk)", fontSize: 11.5, color: "var(--fg-muted)" }}>
              ※ 발급 완료 후 30일간 다운로드 가능. PDF 는 인사부서 직인 자동 삽입.
            </div>
          </Card>
        </>
      )}

      {tab === "docs" && (() => {
        const docs = [
          { kind: "근로계약서",     title: "근로계약서 (2024 갱신)",       date: "2024-01-02", category: "계약",   color: 230, size: "342 KB" },
          { kind: "발령서",         title: "정기 승진 발령 (과장)",       date: "2024-01-01", category: "발령",   color: 145, size: "118 KB" },
          { kind: "발령서",         title: "부서 이동 발령 (인사팀)",      date: "2023-06-01", category: "발령",   color: 145, size: "104 KB" },
          { kind: "비밀유지서약",    title: "정보보안 서약서",             date: "2022-08-15", category: "서약",   color: 290, size: "82 KB" },
          { kind: "교육 수료증",     title: "리더십 부트캠프 Lv.2 수료증",   date: "2025-11-28", category: "교육",   color: 60,  size: "256 KB" },
          { kind: "교육 수료증",     title: "직장 내 괴롭힘 예방 (법정)",    date: "2025-06-04", category: "법정",   color: 25,  size: "210 KB" },
          { kind: "교육 수료증",     title: "정보보안 기초 (법정)",         date: "2025-03-11", category: "법정",   color: 25,  size: "198 KB" },
          { kind: "근로계약서",     title: "근로계약서 (최초)",           date: "2022-08-01", category: "계약",   color: 230, size: "318 KB" },
        ];
        return (
          <>
            <div className="wd-status-chips" style={{ marginBottom: "var(--space-4)" }}>
              <span className="sc"><b>{docs.length}</b>건 보관 중</span>
              <span className="sc accent">계약 <b>2</b>건</span>
              <span className="sc success">발령 <b>2</b>건</span>
              <span className="sc warn">법정 교육 <b>2</b>건</span>
            </div>
            <Card>
              <div className="card-head">
                <span className="title">보관 문서</span>
                <span className="sub">발령서·계약·교육 수료증</span>
                <div className="right">
                  <select className="select" style={{ padding: "5px 10px", fontSize: 12 }}>
                    <option>전체 분류</option>
                    <option>계약</option>
                    <option>발령</option>
                    <option>서약</option>
                    <option>교육</option>
                    <option>법정</option>
                  </select>
                </div>
              </div>
              <div className="list">
                {docs.map((d, i) => (
                  <div key={i} className="item" style={{ padding: "12px var(--space-6)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `oklch(95% 0.04 ${d.color})`, color: `oklch(40% 0.16 ${d.color})`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icons.Doc size={16} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="title">{d.title}</div>
                      <div className="meta">
                        <span className="chip" style={{ background: `oklch(96% 0.03 ${d.color})`, color: `oklch(40% 0.16 ${d.color})`, fontSize: 10.5 }}>{d.category}</span>
                        <span className="sep">·</span>
                        <span className="mono">{fmtKDate(d.date)}</span>
                        <span className="sep">·</span>
                        <span>{d.size}</span>
                      </div>
                    </div>
                    <button className="btn sm btn-ghost" onClick={() => toast("미리보기")}><Icons.Eye size={11} /></button>
                    <button className="btn sm" onClick={() => toast("PDF 다운로드")}><Icons.Download size={11} /> PDF</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", background: "var(--bg-sunk)", fontSize: 11.5, color: "var(--fg-muted)" }}>
                ※ 모든 문서는 GDPR/개인정보보호법에 따라 안전하게 보관돼요. 퇴직 후 3년간 보존.
              </div>
            </Card>
          </>
        );
      })()}

      <CertRequestDrawer open={openCert !== null} onClose={() => setOpenCert(null)} defaultType={openCert} />
    </div>
  );
}

Object.assign(window, {
  AttendanceMyPage, LeaveReqPage, LoaReqPage,
  PayslipMyPage, BenefitsMyPage,
  SkillsAssessPage, EduMyPage, KudosMyPage, DocsMyPage,
});
