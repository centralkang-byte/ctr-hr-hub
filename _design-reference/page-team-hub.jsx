/* global React, Icons, Avatar, Card, ToastContext */
// CTR HR Hub — 매니저 허브 / 팀 현황 (Workday Manager Dashboard)

const { useState: useStateTH, useContext: useCtxTH } = React;

// ── Radar (pentagon) chart ─────────────────────────────────────
function Radar({ data, size = 280 }) {
  const cx = size / 2, cy = size / 2;
  const radius = size / 2 - 50;
  const n = data.length;

  const pt = (i, r) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };

  const rings = [0.25, 0.5, 0.75, 1].map((p) => {
    const pts = data.map((_, i) => pt(i, radius * p).join(",")).join(" ");
    return <polygon key={p} points={pts} fill="none" stroke="var(--border)" strokeWidth="1" />;
  });
  const axes = data.map((_, i) => {
    const [x, y] = pt(i, radius);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
  });
  const dataPts = data.map((d, i) => pt(i, radius * (d.value / 100)).join(",")).join(" ");
  const labels = data.map((d, i) => {
    const [x, y] = pt(i, radius + 22);
    const align = Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end";
    return (
      <text key={i} x={x} y={y} fontSize="11" textAnchor={align} dominantBaseline="middle" fill="var(--fg-muted)">
        {d.axis}
      </text>
    );
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size + 40 }}>
      {rings}
      {axes}
      <polygon points={dataPts} fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="1.5" />
      {data.map((d, i) => {
        const [x, y] = pt(i, radius * (d.value / 100));
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" />;
      })}
      {labels}
    </svg>
  );
}

function TeamHubPage({ data }) {
  const toast = useCtxTH(ToastContext);
  const m = data.managerHub;
  const [tab, setTab] = useStateTH("overview");

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>매니저 허브</h1>
          <div className="greet-sub">팀 현황을 한눈에 확인하고 매니저 액션을 실행해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Mail size={13} sw={2} /> 팀 공지</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 1:1 예약</button>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────── */}
      <div className="wd-tab-bar">
        <button aria-selected={tab === "overview"} onClick={() => setTab("overview")}>
          <Icons.Grid size={13} sw={1.8} /> 개요
        </button>
        <button aria-selected={tab === "members"} onClick={() => setTab("members")}>
          <Icons.Users size={13} sw={1.8} /> 팀원 ({m.member_count})
        </button>
        <button aria-selected={tab === "activity"} onClick={() => setTab("activity")}>
          <Icons.Inbox size={13} sw={1.8} /> 1:1 & 활동
        </button>
        <button aria-selected={tab === "perf"} onClick={() => setTab("perf")}>
          <Icons.Trophy size={13} sw={1.8} /> 성과
        </button>
        <button aria-selected={tab === "ai"} onClick={() => setTab("ai")}>
          <Icons.Sparkle size={13} sw={1.8} /> AI 추천
        </button>
      </div>

      {/* ── Overview Tab ─────────────────────── */}
      {tab === "overview" && (
        <>
          <div className="wd-stat-strip">
            <div className="ss-card">
              <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 팀원 수</div>
              <div className="ss-val">{m.member_count}<span className="u">명</span></div>
              <div className="ss-foot">{data.me.team}</div>
            </div>
            <div className="ss-card ss-red">
              <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 이직 위험</div>
              <div className="ss-val">{m.risk_count}<span className="u">명</span></div>
              <div className="ss-foot">HIGH 위험 신호</div>
            </div>
            <div className="ss-card ss-amber">
              <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 평균 초과근무</div>
              <div className="ss-val">{m.overtime_avg}<span className="u">h</span></div>
              <div className="ss-foot">주당 / 팀 평균</div>
            </div>
            <div className="ss-card ss-purple">
              <div className="ss-h"><span className="ico"><Icons.Inbox size={13} sw={1.8} /></span> 1:1 미완료</div>
              <div className="ss-val">{m.one_on_one_pending}<span className="u">건</span></div>
              <div className="ss-foot">이번 분기</div>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">팀 건강 지표</span>
                <span className="sub">레이더 차트</span>
              </div>
              <div className="card-pad" style={{ display: "grid", placeItems: "center" }}>
                <Radar data={m.radar} />
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">AI 추천</span>
                <span className="right chip accent"><Icons.Sparkle size={11} /> 자동 생성</span>
              </div>
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{
                  background: "var(--success-soft)",
                  borderLeft: "3px solid var(--success)",
                  padding: "14px 16px",
                  borderRadius: 8,
                }}>
                  <div style={{ fontWeight: 600, color: "var(--success)", fontSize: 13.5, marginBottom: 6 }}>
                    {m.aiRec.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.6 }}>{m.aiRec.body}</div>
                </div>

                <div style={{ fontSize: 11.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginTop: 4 }}>
                  추천 액션
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="btn" style={{ justifyContent: "flex-start" }}>
                    <Icons.Mail size={13} sw={2} /> 팀 전체에 격려 메시지 발송
                  </button>
                  <button className="btn" style={{ justifyContent: "flex-start" }}>
                    <Icons.Calendar size={13} sw={2} /> 분기 1:1 미팅 일괄 예약
                  </button>
                  <button className="btn" style={{ justifyContent: "flex-start" }}>
                    <Icons.Trophy size={13} sw={2} /> 칭찬/인정 카드 보내기
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Team member preview */}
          <div className="wd-section-h">
            <h3>팀원 현황</h3>
            <span className="sub">{m.teamMembers.length}명 · 상태 요약</span>
            <span className="right">
              <button className="btn sm" onClick={() => setTab("members")}>전체 보기 →</button>
            </span>
          </div>
          <div className="wd-member-grid">
            {m.teamMembers.slice(0, 8).map((p, i) => {
              const statusCls = p.status === "정상" ? "" : p.status === "주의" ? "warn" : "danger";
              const hue = (p.name.charCodeAt(0) * 47) % 360;
              return (
                <div key={i} className={`wd-member-tile ${statusCls}`} onClick={() => toast(`${p.name} 프로필`)}>
                  {p.risk && p.risk !== "LOW" && <span className="mt-risk">{p.risk}</span>}
                  <div className="mt-top">
                    <Avatar name={p.name} hue={hue} size="sm" />
                    <div className="body">
                      <div className="nm">{p.name}</div>
                      <div className="role">{p.grade || "—"}</div>
                    </div>
                    <span className="mt-status" />
                  </div>
                  <div className="mt-meta">
                    <span className="k">초과근무</span>
                    <span className={`v ${p.overtime > 5 ? "warn" : ""}`}>{p.overtime}h</span>
                    <span className="k">연차사용</span>
                    <span className="v">{p.leaveUsage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Members tab ─────────────────────── */}
      {tab === "members" && (
        <Card>
          <div className="card-head">
            <span className="title">팀원 현황</span>
            <span className="sub">{m.teamMembers.length}명</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>이름</th>
                  <th className="right">초과근무</th>
                  <th className="right">연차사용률</th>
                  <th>성과등급</th>
                  <th>이직위험</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {m.teamMembers.map((p, i) => (
                  <tr key={i} className="clickable">
                    <td>
                      <div className="person">
                        <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 47) % 360} size="sm" />
                        <span className="fw-6">{p.name}</span>
                      </div>
                    </td>
                    <td className="right mono tnum">{p.overtime}h</td>
                    <td className="right mono tnum">{p.leaveUsage}%</td>
                    <td className="mono">{p.grade}</td>
                    <td>
                      {p.risk === "LOW"    && <span className="chip success">LOW</span>}
                      {p.risk === "MEDIUM" && <span className="chip warning">MEDIUM</span>}
                      {p.risk === "HIGH"   && <span className="chip danger">HIGH</span>}
                    </td>
                    <td>
                      <span className="dot" style={{ background: p.status === "정상" ? "var(--success)" : p.status === "주의" ? "var(--warning)" : "var(--danger)", display: "inline-block", marginRight: 6 }} />
                      <span className="small">{p.status}</span>
                    </td>
                    <td>
                      <button className="btn sm btn-ghost" onClick={() => toast(`${p.name} 1:1 예약`)}>
                        <Icons.Calendar size={12} /> 1:1
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Activity tab ─────────────────────── */}
      {tab === "activity" && (
        <>
          <div className="wd-status-chips" style={{ marginBottom: "var(--space-4)" }}>
            <span className="sc"><b>28</b>건 이번 분기 1:1 · 완료 16/예정 12</span>
            <span className="sc warn"><b>3</b>명 6주+ 미실시</span>
            <span className="sc success"><b>14</b>건 보낸 칭찬</span>
            <span className="sc accent"><b>2</b>건 위임 · 1건 만료 임박</span>
          </div>

          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">다가오는 1:1 미팅</span>
                <span className="sub">이번 주 · 다음 주</span>
                <div className="right"><button className="btn sm btn-primary"><Icons.Plus size={11} sw={2.2} /> 일괄 예약</button></div>
              </div>
              <div className="list">
                {[
                  { who: "박서연", when: "5/22 (목) 10:40", since: "8주 전", topic: "MBO 목표 점검" },
                  { who: "이정환", when: "5/23 (금) 14:00", since: "4주 전", topic: "분기 회고" },
                  { who: "최서연", when: "5/24 (토) 11:00", since: "2주 전", topic: "성과 피드백" },
                  { who: "한지영", when: "5/27 (월) 09:30", since: "6주 전", topic: "커리어 상담" },
                  { who: "권하은", when: "5/28 (화) 15:00", since: "신규",  topic: "온보딩 점검" },
                ].map((m, i) => (
                  <div key={i} className="item" style={{ padding: "12px var(--space-6)" }}>
                    <Avatar name={m.who} hue={(m.who.charCodeAt(0) * 47) % 360} size="sm" />
                    <div className="grow">
                      <div className="title">{m.who}</div>
                      <div className="meta">
                        <span>{m.topic}</span>
                        <span className="sep">·</span>
                        <span style={{ fontSize: 11 }}>이전 {m.since}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--fg-muted)", fontWeight: 500 }}>{m.when}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">최근 보낸 칭찬</span>
                <span className="sub">이번 분기 14건</span>
                <div className="right"><button className="btn sm"><Icons.Heart size={11} /> 칭찬 보내기</button></div>
              </div>
              <div className="list">
                {[
                  { to: "최서연", date: "어제", reason: "릴리즈 일정 지키며 품질 유지", value: "리더십" },
                  { to: "박지훈", date: "3일 전", reason: "긴급 장비 트러블 신속 해결", value: "주도성" },
                  { to: "정유진", date: "1주 전", reason: "월말 결산 빠른 마감", value: "전문성" },
                  { to: "이상민", date: "2주 전", reason: "신규 클라이언트 성공적 영입", value: "성과" },
                  { to: "권하은", date: "3주 전", reason: "온보딩 도움이 됐다는 피드백", value: "협업" },
                ].map((k, i) => (
                  <div key={i} className="item" style={{ padding: "12px var(--space-6)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "oklch(95% 0.05 25)", color: "oklch(50% 0.18 25)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icons.Heart size={14} sw={1.8} />
                    </div>
                    <div className="grow">
                      <div className="title">→ {k.to}</div>
                      <div className="meta">
                        <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>"{k.reason}"</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <span className="chip accent" style={{ fontSize: 10.5 }}>{k.value}</span>
                      <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>{k.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head">
              <span className="title">팀 일정 (이번 주)</span>
              <span className="sub">휴가 · 외근 · 출장</span>
            </div>
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {[
                  { day: "월 5/19", events: [{ who: "박지훈", type: "연차", color: "var(--accent)" }] },
                  { day: "화 5/20", events: [{ who: "정유진", type: "반차", color: "oklch(50% 0.14 200)" }, { who: "이상민", type: "출장", color: "oklch(50% 0.16 60)" }] },
                  { day: "수 5/21", events: [{ who: "이상민", type: "출장 (2일차)", color: "oklch(50% 0.16 60)" }] },
                  { day: "목 5/22", events: [] },
                  { day: "금 5/23", events: [{ who: "최서연", type: "외근", color: "oklch(55% 0.16 290)" }] },
                ].map((d, i) => (
                  <div key={i} style={{ background: "var(--bg-sunk)", borderRadius: 8, padding: "10px 12px", minHeight: 100 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>{d.day}</div>
                    {d.events.length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "center", marginTop: 16 }}>—</div>
                    ) : d.events.map((e, j) => (
                      <div key={j} style={{ background: "var(--bg-elev)", borderLeft: `3px solid ${e.color}`, padding: "5px 8px", borderRadius: 4, fontSize: 11, marginBottom: 4 }}>
                        <div style={{ fontWeight: 600 }}>{e.who}</div>
                        <div style={{ color: "var(--fg-muted)", fontSize: 10 }}>{e.type}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <span className="title">업무 위임 현황</span>
              <span className="sub">진행 중 2건</span>
              <div className="right"><button className="btn sm"><Icons.Plus size={11} sw={2.2} /> 새 위임</button></div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>위임 대상</th><th>위임 받은 사람</th><th>업무</th><th className="right">기간</th><th className="right">상태</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="person">
                        <Avatar name="한지영" hue={210} size="sm" />
                        <span className="fw-6">한지영 (본인)</span>
                      </div>
                    </td>
                    <td>강하준</td>
                    <td className="small">휴가 결재 (5/17~5/21)</td>
                    <td className="right small mono">5일</td>
                    <td className="right"><span className="chip warning">D-2 만료</span></td>
                  </tr>
                  <tr>
                    <td>
                      <div className="person">
                        <Avatar name="홍채원" hue={120} size="sm" />
                        <span className="fw-6">홍채원</span>
                      </div>
                    </td>
                    <td>박서연</td>
                    <td className="small">생산기술팀 일상 결재</td>
                    <td className="right small mono">14일</td>
                    <td className="right"><span className="chip info">진행 중</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Perf tab ─────────────────────── */}
      {tab === "perf" && (
        <Card>
          <div className="card-head"><span className="title">성과 등급 분포</span></div>
          <div className="card-pad">
            {m.perfDist.every((d) => d.count === 0) ? (
              <div className="empty">
                <Icons.EmptyBox size={24} />
                <div className="em-title">평가 데이터가 없습니다</div>
                <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>평가 사이클이 결과 통보 단계에 도달하면 표시돼요.</div>
              </div>
            ) : (
              <>
                <div className="flex" style={{ height: 32, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                  {m.perfDist.map((d) => (
                    <div key={d.grade} title={`${d.label}: ${d.count}명`} style={{
                      flex: d.count,
                      background: `oklch(60% 0.16 ${d.color})`,
                      minWidth: d.count ? 24 : 0,
                    }} />
                  ))}
                </div>
                <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                  {m.perfDist.map((d) => (
                    <div key={d.grade} className="flex center gap-2 small">
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: `oklch(60% 0.16 ${d.color})` }} />
                      <span className="fw-6">{d.grade}</span>
                      <span className="faint">{d.label}</span>
                      <span className="mono tnum">{d.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="divider" style={{ margin: "var(--space-5) 0" }} />
            <div className="flex between center">
              <div className="flex center gap-2">
                <Icons.Target size={14} />
                <span className="small fw-6">MBO 평균 달성률</span>
              </div>
              <span className="mono tnum fw-7" style={{ fontSize: 18 }}>{m.mboAvg}%</span>
            </div>
            <div className="progress" style={{ marginTop: 10, height: 8 }}>
              <i style={{ width: `${m.mboAvg}%` }} />
            </div>
          </div>
        </Card>
      )}

      {/* ── AI tab ─────────────────────── */}
      {tab === "ai" && (
        <Card>
          <div className="card-head">
            <span className="title">AI 인사이트</span>
            <span className="right chip accent"><Icons.Sparkle size={11} /> 매주 월요일 09:00 갱신</span>
          </div>
          <div className="card-pad">
            <div style={{
              background: "var(--success-soft)",
              borderLeft: "3px solid var(--success)",
              padding: "16px 20px",
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{ fontWeight: 600, color: "var(--success)", fontSize: 14, marginBottom: 8 }}>
                {m.aiRec.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.6 }}>{m.aiRec.body}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              <Icons.Alert size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4, color: "var(--fg-faint)" }} />
              AI 추천은 팀의 근태·성과·1:1 미팅 데이터를 기반으로 자동 생성돼요. 결정 참고용으로만 사용하세요.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { TeamHubPage, Radar });
