/* global React, Icons, Avatar, Card, CardHead, ToastContext, fmtKDate, OneOnOneDrawer */
// CTR HR Hub — 팀 관리 페이지들

const { useState: useStateTS, useContext: useCtxTS } = React;

// ── 팀 근태 (team attendance) ─────────────────────────────
function TeamAttnPage({ data }) {
  const t = data.teamAttn;
  const total = (t.present || 0) + (t.missing || 0) + (t.late || 0);

  // Mock weekly trend
  const week = [
    { d: "월 5/12", present: 11, late: 1, absent: 0 },
    { d: "화 5/13", present: 12, late: 0, absent: 0 },
    { d: "수 5/14", present: 10, late: 2, absent: 0 },
    { d: "목 5/15", present: 12, late: 0, absent: 0 },
    { d: "금 5/16", present: 11, late: 0, absent: 1 },
  ];

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>팀 근태</h1>
          <div className="greet-sub">팀원의 출퇴근·휴가 현황을 한눈에 확인하세요.</div>
          <div className="wd-status-chips">
            <span className="sc success"><span className="dot" />출근 <b>{t.present}</b></span>
            <span className="sc warn"><span className="dot" />지각 <b>{t.late}</b></span>
            <span className="sc danger"><span className="dot" />미출근 <b>{t.missing}</b></span>
            <span className="sc zero"><span className="dot" />전체 <b>{total}명</b></span>
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 엑셀</button>
        </div>
      </div>

      {/* 주간 트렌드 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">이번 주 출근 현황</span>
          <span className="sub">최근 5영업일</span>
        </div>
        <div className="card-pad">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {week.map((d) => {
              const rate = ((d.present / (d.present + d.late + d.absent)) * 100) || 100;
              const color = rate >= 95 ? "var(--success)" : rate >= 85 ? "var(--accent)" : "oklch(50% 0.16 60)";
              return (
                <div key={d.d} style={{
                  background: "var(--bg-sunk)",
                  borderRadius: 10,
                  borderTop: `2px solid ${color}`,
                  padding: "12px 10px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 600 }}>{d.d}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 6, color }}>
                    {Math.round(rate)}<span style={{ fontSize: 11, color: "var(--fg-faint)" }}>%</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                    {d.present}/{d.present + d.late + d.absent}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 팀원별 근태 */}
      <Card>
        <div className="card-head">
          <span className="title">팀원별 근태</span>
          <span className="sub">오늘</span>
          <div className="right">
            <select className="select" style={{ padding: "5px 10px", fontSize: 12 }}>
              <option>전체 상태</option><option>근무중</option><option>지각</option><option>휴가</option>
            </select>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>팀원</th><th>직책</th><th>출근</th><th>퇴근</th><th>상태</th><th>근무 유형</th><th className="right"></th></tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <div className="person">
                      <Avatar name={r.name} hue={(r.name.charCodeAt(0) * 47) % 360} size="sm" />
                      <div>
                        <div className="fw-6">{r.name}</div>
                        <div className="en">{r.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small muted">{r.title}</td>
                  <td className="mono small">{r.inAt || "—"}</td>
                  <td className="mono small">{r.outAt || "—"}</td>
                  <td>
                    {r.status === "근무중" && <span className="chip success">근무중</span>}
                    {r.status === "지각"   && <span className="chip warning">지각</span>}
                    {r.status === "결근"   && <span className="chip danger">결근</span>}
                    {r.status === "휴가"   && <span className="chip info">휴가</span>}
                    {r.status === "출장"   && <span className="chip info">출장</span>}
                    {r.status === "미출근" && <span className="chip">미출근</span>}
                  </td>
                  <td className="small muted">{r.type || "—"}</td>
                  <td className="right"><button className="btn sm btn-ghost"><Icons.Eye size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── 팀 목표 관리 ─────────────────────────────
function TeamGoalsPage({ data }) {
  const toast = useCtxTS(ToastContext);
  const [open, setOpen] = useStateTS({ 0: true });
  return (
    <div className="content">
      <div className="page-h">
        <div className="flex center gap-2">
          <Icons.Users size={20}/>
          <h1>팀 목표 관리</h1>
        </div>
        <div className="right">
          <select className="select"><option>2026년 상반기 성과평가</option></select>
        </div>
      </div>

      <div className="flex col gap-4">
        {data.teamGoals.map((tg, i) => (
          <Card key={i} style={{ border: open[i] ? "1px solid var(--accent)" : undefined }}>
            <button onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
              style={{
                width: "100%", padding: "var(--space-4) var(--space-6)",
                display: "flex", alignItems: "center", gap: "var(--space-4)",
                borderBottom: open[i] ? "1px solid var(--border)" : "0",
              }}>
              <Icons.ChevD size={16} style={{ transform: open[i] ? "none" : "rotate(-90deg)", transition: "transform 140ms", color: "var(--fg-faint)" }}/>
              <Avatar name={tg.member.name} hue={tg.member.hue}/>
              <div>
                <div className="fw-7">{tg.member.name}</div>
                <div className="tiny faint mono">{tg.member.code}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 24 }}>
                <div className="flex col" style={{ alignItems: "center" }}>
                  <div className="tiny faint">목표 수</div>
                  <div className="fw-7 mono">{tg.summary.goalCount}</div>
                </div>
                <div className="flex col" style={{ alignItems: "center" }}>
                  <div className="tiny faint">가중치 합계</div>
                  <div className="fw-7 mono" style={{ color: "var(--success)" }}>{tg.summary.weight}%</div>
                </div>
                <div className="flex col" style={{ alignItems: "center" }}>
                  <div className="tiny faint">평균 달성률</div>
                  <div className="fw-7 mono">{tg.summary.avgComp}%</div>
                </div>
                <div className="flex col" style={{ alignItems: "center" }}>
                  <div className="tiny faint">상태</div>
                  <div className="fw-7 small">{tg.summary.statusLabel}</div>
                </div>
                {tg.summary.statusChip === "정상" ? (
                  <span className="chip success">정상</span>
                ) : (
                  <span className="chip warning">{tg.summary.statusChip}</span>
                )}
              </div>
            </button>
            {open[i] && tg.goals.length > 0 && (
              <div style={{ padding: "var(--space-4) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {tg.goals.map((g) => (
                  <div key={g.id} style={{ padding: "var(--space-4)", border: "1px solid var(--border)", borderRadius: 10 }}>
                    <div className="flex center gap-2" style={{ marginBottom: 4 }}>
                      <Icons.Target size={14} style={{ color: "var(--accent)" }}/>
                      <span className="fw-7">{g.title}</span>
                      {g.status === "승인" && <span className="chip accent" style={{ fontSize: 10 }}>승인</span>}
                      {g.status === "승인대기" && <span className="chip warning" style={{ fontSize: 10 }}>승인대기</span>}
                    </div>
                    <div className="small muted mono" style={{ marginBottom: 12 }}>{g.desc}</div>
                    <div className="flex center gap-4 small">
                      <span className="muted">가중치: <b>{g.weight}%</b></span>
                      <span className="muted">달성률: <b>{g.comp}%</b></span>
                    </div>
                    <div className="progress" style={{ marginTop: 6, height: 6 }}>
                      <i style={{ width: `${g.comp}%` }}/>
                    </div>
                    {g.status === "승인대기" && (
                      <div className="flex gap-2" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                        <button className="btn sm btn-primary" style={{ background: "var(--success)", borderColor: "var(--success)" }} onClick={() => toast("승인됨")}>
                          <Icons.Check size={12} sw={2.4}/> 승인
                        </button>
                        <button className="btn sm" style={{ background: "oklch(70% 0.14 40)", borderColor: "oklch(70% 0.14 40)", color: "white" }} onClick={() => toast("수정요청 발송")}>
                          <Icons.Doc size={12}/> 수정요청
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 1:1 미팅 ─────────────────────────────
function Team1on1Page({ data }) {
  const toast = useCtxTS(ToastContext);
  const o = data.oneOnOne;
  const [tab, setTab] = useStateTS("all");
  const [newOpen, setNewOpen] = useStateTS(false);

  const visible =
    tab === "all"       ? [...o.upcoming.map((x) => ({ ...x, kind: "upcoming" })), ...o.completed.map((x) => ({ ...x, kind: "completed" }))] :
    tab === "upcoming"  ? o.upcoming.map((x) => ({ ...x, kind: "upcoming" })) :
                          o.completed.map((x) => ({ ...x, kind: "completed" }));

  return (
    <div className="content">
      <div className="page-h">
        <div className="flex center gap-2">
          <Icons.Inbox size={20}/>
          <h1>1:1 미팅</h1>
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
            <Icons.Plus size={14} sw={2.2}/> 1:1 예약
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: "var(--space-4)" }}>
        <button aria-selected={tab === "all"}      onClick={() => setTab("all")}>전체</button>
        <button aria-selected={tab === "upcoming"} onClick={() => setTab("upcoming")}>예정</button>
        <button aria-selected={tab === "completed"}onClick={() => setTab("completed")}>완료</button>
      </div>

      {/* Upcoming */}
      {(tab === "all" || tab === "upcoming") && o.upcoming.length > 0 && (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <div className="flex center gap-2" style={{ marginBottom: 12 }}>
            <Icons.Calendar size={16} style={{ color: "var(--accent)" }}/>
            <span className="fw-7">예정된 1:1</span>
          </div>
          {o.upcoming.map((u, i) => (
            <Card key={i} style={{ marginBottom: 8 }}>
              <div className="card-pad" style={{ display: "flex", alignItems: "center", gap: 14, padding: "var(--space-4) var(--space-6)" }}>
                <Avatar name={u.with.name} initials={u.with.name.charAt(0) + u.with.name.charAt(1)} hue={u.with.hue}/>
                <div className="grow">
                  <div className="fw-7">{u.with.name} ({u.with.en})</div>
                  <div className="tiny faint">{u.with.team} · {u.with.title}</div>
                </div>
                <div className="small fw-6">{new Date(u.when).toLocaleString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                <span className="chip info">{u.type}</span>
                <button className="action small" onClick={() => toast("1:1 기록 페이지로 이동")} style={{ color: "var(--accent-ink)" }}>기록하기 <Icons.ArrowR size={11}/></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Completed */}
      {(tab === "all" || tab === "completed") && o.completed.length > 0 && (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <div className="card-head">
            <Icons.Check size={14} style={{ color: "var(--success)" }}/>
            <span className="title">완료된 1:1</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>팀원</th><th>일시</th><th>유형</th><th className="right">액션 미완료</th></tr></thead>
              <tbody>
                {o.completed.map((c, i) => (
                  <tr key={i}>
                    <td className="fw-6">{c.with.name}</td>
                    <td className="mono">{fmtKDate(c.when)}</td>
                    <td><span className="chip">{c.type}</span></td>
                    <td className="right">
                      {c.openActions > 0 && <span style={{ color: "var(--danger)", fontWeight: 700 }}>{c.openActions}건</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Frequency dashboard */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <CardHead title="1:1 빈도 대시보드" icon="Users"/>
        <div className="card-pad">
          <svg viewBox="0 0 600 200" width="100%" preserveAspectRatio="none" style={{ height: 200 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line x1="40" x2="580" y1={20 + i * 40} y2={20 + i * 40} stroke="var(--border)" strokeDasharray="2 4"/>
                <text x="32" y={24 + i * 40} fontSize="10" fill="var(--fg-faint)" textAnchor="end">{4 - i}</text>
              </g>
            ))}
            {o.monthlyFreq.map((d, i) => {
              const x = 40 + (i + 0.5) * ((600 - 80) / o.monthlyFreq.length);
              return <text key={i} x={x} y="194" fontSize="10" textAnchor="middle" fill="var(--fg-faint)">{d.m}</text>;
            })}
          </svg>
        </div>
        {o.warnings.length > 0 && (
          <div style={{ padding: "12px var(--space-6)", borderTop: "1px solid var(--border)", background: "var(--danger-soft)" }}>
            {o.warnings.map((w, i) => (
              <div key={i} className="flex center gap-2 small" style={{ color: "var(--danger)" }}>
                <Icons.Alert size={14}/> <b>{w.msg}</b>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending action items */}
      <Card>
        <CardHead title="미완료 액션 아이템" icon="Clock"/>
        <div className="list">
          {o.pendingActions.map((a) => (
            <div key={a.id} className="item">
              <button style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid var(--border-strong)" }}/>
              <div className="grow">
                <span className="fw-6 small">{a.title}</span>
              </div>
              <span className="tiny faint mono">기한: {a.due}</span>
            </div>
          ))}
        </div>
      </Card>

      {newOpen && (
        <OneOnOneDrawer
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onSubmit={() => { setNewOpen(false); }}
        />
      )}
    </div>
  );
}

// ── 업무 위임 ─────────────────────────────
function TeamDelegPage({ data }) {
  const toast = useCtxTS(ToastContext);
  const [open, setOpen] = useStateTS(false);

  // Mock active delegations
  const active = [
    { to: "강하준", scope: "휴가", from: "2026-05-17", to_: "2026-05-21", reason: "출장", daysLeft: 4 },
  ];
  const past = [
    { to: "박서연", scope: "전체",  from: "2026-03-10", to_: "2026-03-14", reason: "휴가",     daysLeft: -65 },
    { to: "이정환", scope: "휴가",  from: "2026-02-01", to_: "2026-02-05", reason: "교육 참석", daysLeft: -101 },
  ];

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>업무 위임</h1>
          <div className="greet-sub">부재 시 결재 권한을 위임하여 업무 중단을 방지해요.</div>
          <div className="wd-status-chips">
            <span className="sc accent"><span className="dot" />활성 위임 <b>{active.length}</b></span>
            <span className="sc zero"><span className="dot" />과거 이력 <b>{past.length}</b></span>
          </div>
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Icons.Plus size={13} sw={2.2} /> 새 위임
          </button>
        </div>
      </div>

      <div style={{
        padding: "12px 16px",
        background: "var(--accent-soft)",
        borderRadius: 10,
        display: "flex", gap: 12, alignItems: "flex-start",
        marginBottom: "var(--space-4)",
        fontSize: 12.5,
        color: "var(--accent-ink)",
        lineHeight: 1.5,
      }}>
        <Icons.Alert size={15} sw={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <b>승인 위임 안내</b> · 출장·휴가 등 부재 시 다른 매니저에게 결재 권한을 위임할 수 있어요.
          수임자는 위임 기간 동안 귀하의 팀 휴가/휴직 승인을 처리할 수 있어요. 최대 30일까지 설정 가능해요.
        </div>
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">활성 위임</span>
          <span className="sub">{active.length}건 진행 중</span>
        </div>
        {active.length > 0 ? (
          <div className="list">
            {active.map((d, i) => (
              <div key={i} className="item">
                <Avatar name={d.to} hue={(d.to.charCodeAt(0) * 47) % 360} size="sm" />
                <div className="grow">
                  <div className="title">→ {d.to}에게 위임</div>
                  <div className="meta">
                    <span className="chip accent">{d.scope}</span>
                    <span>{fmtKDate(d.from)} ~ {fmtKDate(d.to_)}</span>
                    <span className="sep">·</span>
                    <span style={{ fontStyle: "italic", fontSize: 11 }}>{d.reason}</span>
                  </div>
                </div>
                <span className="chip warning">{d.daysLeft <= 0 ? "종료" : `D-${d.daysLeft}`}</span>
                <button className="btn sm" onClick={() => toast("위임 취소")}>취소</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: "var(--space-8)" }}>
            <Icons.Shield size={28} />
            <div className="em-title">활성 위임이 없습니다</div>
            <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>부재 시 위임을 설정하면 결재 업무가 원활하게 처리돼요.</div>
          </div>
        )}
      </Card>

      <Card>
        <div className="card-head">
          <span className="title">위임 이력</span>
          <span className="sub">최근 6개월</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>수임자</th><th>범위</th><th>기간</th><th>사유</th><th className="right">상태</th></tr></thead>
            <tbody>
              {past.map((d, i) => (
                <tr key={i}>
                  <td>
                    <div className="person">
                      <Avatar name={d.to} hue={(d.to.charCodeAt(0) * 47) % 360} size="sm" />
                      <span className="fw-6">{d.to}</span>
                    </div>
                  </td>
                  <td><span className="chip">{d.scope}</span></td>
                  <td className="mono small">{fmtKDate(d.from)} ~ {fmtKDate(d.to_)}</td>
                  <td className="small muted">{d.reason}</td>
                  <td className="right"><span className="chip success">완료</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <DelegationDrawer open={open} onClose={() => setOpen(false)} data={data} />
    </div>
  );
}

function DelegationDrawer({ open, onClose, data }) {
  const toast = useCtxTS(ToastContext);
  const [delegate, setDelegate] = useStateTS("");
  const [scope, setScope] = useStateTS("휴가");
  const [from, setFrom] = useStateTS("");
  const [to, setTo] = useStateTS("");
  const [reason, setReason] = useStateTS("");

  const submit = () => { toast("위임 설정 완료"); onClose(); };
  const valid = delegate && from && to;

  if (!open) return null;
  return (
    <>
      <div className="wd-drawer-scrim" onClick={onClose} />
      <aside className="wd-drawer">
        <div className="wdr-h">
          <div>
            <div className="eyebrow">팀 관리</div>
            <h2>새 위임 설정</h2>
          </div>
          <div className="right">
            <button className="close" onClick={onClose}><Icons.Close size={14} sw={2} /></button>
          </div>
        </div>
        <div className="wdr-body">
          <div className="wdr-note">
            수임자는 위임 기간 동안 귀하의 팀 휴가/휴직 결재를 처리할 수 있어요. 최대 <b>30일</b>까지 설정 가능.
          </div>

          <div className="wdr-field">
            <label>수임자<span className="req">*</span></label>
            <select value={delegate} onChange={(e) => setDelegate(e.target.value)}>
              <option value="">팀원을 선택하세요</option>
              {data.directory.slice(0, 6).map((p) => (
                <option key={p.code} value={p.name}>{p.name} · {p.dept}</option>
              ))}
            </select>
          </div>

          <div className="wdr-field">
            <label>위임 범위<span className="req">*</span></label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option>휴가</option>
              <option>휴직</option>
              <option>출장</option>
              <option>전체 결재</option>
            </select>
          </div>

          <div className="wdr-row">
            <div className="wdr-field">
              <label>시작일<span className="req">*</span></label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="wdr-field">
              <label>종료일<span className="req">*</span></label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="wdr-field">
            <label>사유 (선택)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 출장, 휴가, 교육 참석" />
          </div>
        </div>
        <div className="wdr-foot">
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={submit} disabled={!valid}>
            <Icons.Check size={13} sw={2.2} /> 위임 저장
          </button>
        </div>
      </aside>
    </>
  );
}

Object.assign(window, {
  TeamAttnPage, TeamGoalsPage, Team1on1Page, TeamDelegPage,
});
