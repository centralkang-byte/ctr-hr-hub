/* global React, Icons, Avatar, Card, ToastContext, fmtKDate, PerfCycleWizard */
// CTR HR Hub — 성과 관리 (Workday Performance Cycle)

const { useState: useStatePC, useContext: useCtxPC } = React;

function PerfCyclePage({ data }) {
  const toast = useCtxPC(ToastContext);
  const c = data.perfCycle;
  const [tab, setTab] = useStatePC("overview");
  const [wizOpen, setWizOpen] = useStatePC(false);

  if (wizOpen) {
    return <PerfCycleWizard onCancel={() => setWizOpen(false)} onComplete={() => setWizOpen(false)} />;
  }

  // Mock dates per step
  const stepDates = ["2026.01.10", "2026.02.01", "2026.06.15", "2026.07.31"];

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>성과 관리</h1>
          <div className="wd-summary-lead">
            <b>{c.current.label}</b> 사이클 진행 중. 목표 제출률 <b>{c.submission.rate}%</b> ({c.submission.submitted}/{c.submission.total}명),
            평균 달성률 <b>{c.current.avgComp}%</b>. 목표 등록 마감까지 <span className="hl-warn">D-16 남았어요</span>.
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Gear size={13} sw={2} /> 사이클 관리</button>
          <button className="btn btn-primary" onClick={() => setWizOpen(true)}><Icons.Plus size={13} sw={2.2} /> 새 사이클</button>
        </div>
      </div>

      {/* KPI strip removed — summary lead above replaces it */}

      {/* ── Tabs ─────────────────── */}
      <div className="wd-tab-bar">
        <button aria-selected={tab === "overview"} onClick={() => setTab("overview")}>
          <Icons.Grid size={13} sw={1.8} /> 개요
        </button>
        <button aria-selected={tab === "goals"} onClick={() => setTab("goals")}>
          <Icons.Target size={13} sw={1.8} /> 목표 관리
        </button>
        <button aria-selected={tab === "results"} onClick={() => setTab("results")}>
          <Icons.Trophy size={13} sw={1.8} /> 성과 결과
        </button>
        <button aria-selected={tab === "peer"} onClick={() => setTab("peer")}>
          <Icons.Users size={13} sw={1.8} /> 동료 평가
        </button>
      </div>

      {tab === "overview" && (
        <>
          {/* ── Stepper Card ─────────────────── */}
          <div className="wd-stepper">
            <div className="ws-h">
              <span className="id">{c.current.id}</span>
              <h2>{c.current.label}</h2>
              <span className="badge">진행 중</span>
              <div className="right">
                <button className="btn sm">사이클 상세</button>
              </div>
            </div>

            <div className="wd-stepper-track">
              {c.steps.map((s, i) => {
                const state =
                  i < c.current.phase ? "done" :
                  i === c.current.phase ? "current" : "upcoming";
                return (
                  <React.Fragment key={i}>
                    <div className={`step ${state}`}>
                      <div className="dot">
                        {state === "done" ? <Icons.Check size={18} sw={2.4} /> : i + 1}
                      </div>
                      <div className="lbl">{s}</div>
                      <div className="when">{stepDates[i] || ""}</div>
                    </div>
                    {i < c.steps.length - 1 && (
                      <div className={`connector ${i < c.current.phase ? "done" : ""}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="ws-todo">
              <span className="label-chip">할 일</span>
              <span className="txt">{c.todo}</span>
              <div className="right">
                <button className="btn sm btn-primary" onClick={() => toast("사이클 활성화됨")}>
                  활성화
                </button>
              </div>
            </div>
          </div>

          {/* ── Active Cycles + Submission ─────────────────── */}
          <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
            <div>
              <div className="wd-section-h">
                <h3>활성 사이클</h3>
                <span className="sub">{c.activeCycles.length}개</span>
              </div>
              <div className="wd-cycle-grid">
                {c.activeCycles.map((cy) => (
                  <div key={cy.id} className="wd-cycle-card" onClick={() => toast(`${cy.type} 사이클 열기`)}>
                    <div className="cc-h">
                      <span className={`type ${cy.phase === "진행중" ? "progress" : "draft"}`}>{cy.type}</span>
                      <span className="phase-pill">{cy.phase}</span>
                    </div>
                    <div>
                      <div className="cc-name">{cy.type === "Goals" ? "목표 사이클" : cy.type === "Checkin" ? "체크인" : cy.type}</div>
                      <div className="cc-id">{cy.id}</div>
                    </div>
                    <div className="cc-meta">
                      <span>{cy.range}</span>
                      {cy.count > 0 && <b>{cy.count}건</b>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Card>
              <div className="card-head"><span className="title">전체 목표 제출 진행</span></div>
              <div className="card-pad">
                <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--accent-ink)" }}>
                  {c.submission.rate}%
                </div>
                <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 4, marginBottom: 12 }}>
                  {c.submission.submitted} / {c.submission.total}명 제출 완료
                </div>
                <div className="progress" style={{ height: 10 }}>
                  <i style={{ width: `${c.submission.rate}%` }} />
                </div>
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={() => toast("미제출자 35명 알림")}>
                  <Icons.Mail size={13} sw={2} /> 미제출자 알림
                </button>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "center", marginTop: 6 }}>
                  대상 {c.submission.total - c.submission.submitted}명
                </div>
              </div>
            </Card>
          </div>

          {/* ── Key dates timeline ─────────────────── */}
          <div className="wd-section-h">
            <h3>주요 일정</h3>
            <span className="sub">2026 H1</span>
          </div>
          <Card>
            <div className="list">
              <div className="item">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--success-soft)", color: "var(--success)", display: "grid", placeItems: "center" }}>
                  <Icons.Check size={16} />
                </div>
                <div className="grow">
                  <div className="title">사이클 개시</div>
                  <div className="meta">2026.01.10 · 완료</div>
                </div>
              </div>
              <div className="item">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center" }}>
                  <Icons.Target size={16} />
                </div>
                <div className="grow">
                  <div className="title">목표 설정 마감</div>
                  <div className="meta">2026.06.01 · D-16 남음 · 47% 제출</div>
                </div>
                <span className="chip warning">진행 중</span>
              </div>
              <div className="item">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-sunk)", color: "var(--fg-faint)", display: "grid", placeItems: "center" }}>
                  <Icons.Trophy size={16} />
                </div>
                <div className="grow">
                  <div className="title" style={{ color: "var(--fg-faint)" }}>중간 점검 (Checkin)</div>
                  <div className="meta">2026.06.15 ~ 06.30</div>
                </div>
              </div>
              <div className="item">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-sunk)", color: "var(--fg-faint)", display: "grid", placeItems: "center" }}>
                  <Icons.Chart size={16} />
                </div>
                <div className="grow">
                  <div className="title" style={{ color: "var(--fg-faint)" }}>평가 실시</div>
                  <div className="meta">2026.06.15 ~ 07.15</div>
                </div>
              </div>
              <div className="item">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-sunk)", color: "var(--fg-faint)", display: "grid", placeItems: "center" }}>
                  <Icons.Mail size={16} />
                </div>
                <div className="grow">
                  <div className="title" style={{ color: "var(--fg-faint)" }}>결과 통보</div>
                  <div className="meta">2026.07.31</div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {tab === "goals" && (
        <>
          <div className="wd-status-chips" style={{ marginBottom: "var(--space-4)" }}>
            <span className="sc"><b>128</b>건 전체 목표 · 인당 평균 4.1건</span>
            <span className="sc warn"><b>35</b>명 미제출 · 전체 47% 제출</span>
            <span className="sc success">평균 달성률 <b>68%</b></span>
            <span className="sc accent">매니저 승인 <b>82%</b></span>
          </div>

          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">부서별 목표 제출 진척</span>
                <span className="sub">사이클 마감 D-16</span>
              </div>
              <div className="card-pad">
                {[
                  { dept: "재무/회계팀", submitted: 6, total: 6 },
                  { dept: "인사팀", submitted: 4, total: 4 },
                  { dept: "품질관리팀", submitted: 7, total: 8 },
                  { dept: "개발팀", submitted: 18, total: 24 },
                  { dept: "영업팀", submitted: 6, total: 12 },
                  { dept: "생산/제조팀", submitted: 4, total: 11 },
                  { dept: "구매/조달팀", submitted: 0, total: 2 },
                ].map((d) => {
                  const pct = Math.round((d.submitted / d.total) * 100);
                  const color = pct >= 90 ? "var(--success)" : pct >= 60 ? "oklch(50% 0.16 60)" : "var(--danger)";
                  return (
                    <div key={d.dept} style={{ display: "grid", gridTemplateColumns: "110px 1fr 70px", gap: 10, alignItems: "center", marginBottom: 8, fontSize: 12 }}>
                      <span style={{ color: "var(--fg-muted)" }}>{d.dept}</span>
                      <div style={{ height: 8, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                      </div>
                      <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {d.submitted}/{d.total} · <span style={{ color }}>{pct}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">목표 카테고리 분포</span>
                <span className="sub">128건 분류</span>
              </div>
              <div className="card-pad">
                {[
                  { cat: "비즈니스 성과", n: 52, pct: 41, color: 230 },
                  { cat: "고객 만족", n: 26, pct: 20, color: 145 },
                  { cat: "프로세스 개선", n: 22, pct: 17, color: 290 },
                  { cat: "역량 개발", n: 18, pct: 14, color: 75 },
                  { cat: "조직 문화", n: 10, pct: 8, color: 35 },
                ].map((c) => (
                  <div key={c.cat} style={{ display: "grid", gridTemplateColumns: "100px 1fr 70px", gap: 10, alignItems: "center", marginBottom: 9, fontSize: 12 }}>
                    <span>{c.cat}</span>
                    <div style={{ height: 8, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${c.pct * 2.4}%`, height: "100%", background: `oklch(60% 0.14 ${c.color})`, borderRadius: 3 }} />
                    </div>
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{c.n} · {c.pct}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div className="card-head">
              <span className="title">미제출자 명단</span>
              <span className="sub">35명 · 마감 D-16</span>
              <div className="right"><button className="btn sm btn-primary"><Icons.Mail size={11} /> 일괄 알림</button></div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>이름</th><th>부서</th><th>직급</th><th className="right">매니저</th><th className="right">최근 1:1</th><th className="right">상태</th></tr>
                </thead>
                <tbody>
                  {[
                    { name: "박지훈", dept: "생산기술팀", rank: "대리", mgr: "홍채원", last1on1: "4주 전", status: "미제출" },
                    { name: "정유진", dept: "재무/회계팀", rank: "과장", mgr: "이정환", last1on1: "2주 전", status: "초안" },
                    { name: "이상민", dept: "영업팀", rank: "주임", mgr: "박서연", last1on1: "1주 전", status: "초안" },
                    { name: "권하은", dept: "생산/제조팀", rank: "사원", mgr: "홍채원", last1on1: "6주 전", status: "미제출" },
                    { name: "최서연", dept: "개발팀", rank: "대리", mgr: "한지영", last1on1: "1주 전", status: "초안" },
                  ].map((p) => (
                    <tr key={p.name}>
                      <td>
                        <div className="person">
                          <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 47) % 360} size="sm" />
                          <span className="fw-6">{p.name}</span>
                        </div>
                      </td>
                      <td>{p.dept}</td>
                      <td>{p.rank}</td>
                      <td className="right">{p.mgr}</td>
                      <td className="right small muted">{p.last1on1}</td>
                      <td className="right">
                        {p.status === "미제출" ? <span className="chip danger">미제출</span> : <span className="chip warning">초안</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px var(--space-6)", background: "var(--bg-sunk)", fontSize: 11.5, color: "var(--fg-faint)", borderTop: "1px solid var(--border)" }}>
              ※ 전체 35명 중 상위 5명 표시. 엑셀로 전체 다운로드 가능.
            </div>
          </Card>
        </>
      )}

      {tab === "results" && (
        <>
          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head">
              <span className="title">등급 분포 미리보기</span>
              <span className="sub">전사 67명 · 평가 완료 58명</span>
              <div className="right">
                <button className="btn sm" onClick={() => toast("인사이트로 이동")}><Icons.Chart size={11} /> 상세 분석</button>
              </div>
            </div>
            <div className="card-pad">
              <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                {[
                  { g: "O", n: 4, color: 290 },
                  { g: "E", n: 14, color: 230 },
                  { g: "M", n: 31, color: 145 },
                  { g: "S", n: 9, color: 25 },
                ].map((g) => (
                  <div key={g.g} style={{ flex: g.n, background: `oklch(60% 0.14 ${g.color})`, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 12 }}>
                    {g.g} · {g.n}
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                <b style={{ color: "var(--fg)" }}>캘리브레이션 권장</b> · 영업팀·생산팀에 S 등급 집중 (각 2명). 매니저 평가 일관성 검증 후 결과 통보 단계 진입 권장.
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <span className="title">평가-보상 연동률</span>
              <span className="sub">등급별 인상률 일치도</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>등급</th><th className="right">인원</th><th className="right">권장 인상률</th><th className="right">실제 인상률</th><th className="right">일치도</th></tr>
                </thead>
                <tbody>
                  {[
                    { g: "O", n: 4,  rec: "8~12%", actual: "10.2%", match: 95, color: "var(--success)" },
                    { g: "E", n: 14, rec: "5~8%",  actual: "6.8%",  match: 92, color: "var(--success)" },
                    { g: "M", n: 31, rec: "3~5%",  actual: "4.1%",  match: 88, color: "var(--success)" },
                    { g: "S", n: 9,  rec: "0~2%",  actual: "1.8%",  match: 67, color: "oklch(50% 0.16 60)" },
                  ].map((r) => (
                    <tr key={r.g}>
                      <td className="fw-7 mono" style={{ fontSize: 14 }}>{r.g}</td>
                      <td className="right mono tnum">{r.n}명</td>
                      <td className="right">{r.rec}</td>
                      <td className="right mono tnum">{r.actual}</td>
                      <td className="right">
                        <span style={{ color: r.color, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{r.match}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px var(--space-6)", background: "var(--bg-sunk)", fontSize: 12, color: "var(--fg-muted)", borderTop: "1px solid var(--border)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--fg)" }}>인사이트</b> · S 등급 일치도 67%는 예외 케이스 多 (개인 사유). 일반 등급은 88~95%로 평가-보상 일관성 양호.
            </div>
          </Card>
        </>
      )}

      {tab === "peer" && (
        <Card>
          <div className="empty" style={{ padding: "var(--space-10)" }}>
            <Icons.Users size={28} />
            <div className="em-title">동료 평가는 평가 실시 단계에서 활성화돼요</div>
            <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>현재 사이클: 목표 설정 (D-16)</div>
          </div>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { PerfCyclePage });
