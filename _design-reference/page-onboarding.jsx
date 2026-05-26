/* global React, Icons, Avatar, Card, ToastContext, fmtKDate, dDayLabel */
// CTR HR Hub — 온보딩 (Workday Hire 패턴: 인물 카드 + 여정)

const { useState: useStateOB, useMemo: useMemoOB, useContext: useCtxOB } = React;

// 신규입사 온보딩 템플릿 (6단계)
const ONBOARD_STEPS = [
  { key: "doc",     label: "서류 제출",       cat: "DOCUMENT" },
  { key: "ojt",     label: "OJT 교육",        cat: "TRAINING" },
  { key: "security", label: "보안 교육",       cat: "TRAINING" },
  { key: "buddy",   label: "버디 매칭 + 미팅", cat: "MEETING" },
  { key: "system",  label: "시스템 접근 권한",  cat: "ACCESS" },
  { key: "intro",   label: "팀 소개 + 인사",    cat: "MEETING" },
];

function OnboardingPage({ data }) {
  const toast = useCtxOB(ToastContext);
  const [tab, setTab] = useStateOB("all");
  const [status, setStatus] = useStateOB("all");
  const [view, setView] = useStateOB("grid"); // grid | table | journey
  const [selectedPerson, setSelectedPerson] = useStateOB(null);

  const all = useMemoOB(() => {
    const onb = data.onboarding.map((p) => ({ ...p, kind: "onboarding", date: p.joinDate }));
    const off = data.offboarding.map((p) => ({ ...p, kind: "offboarding", date: p.leaveDate }));
    return [...onb, ...off];
  }, [data]);

  const filtered = useMemoOB(() => {
    let list = all;
    if (tab === "onboarding")  list = list.filter((p) => p.kind === "onboarding");
    if (tab === "offboarding") list = list.filter((p) => p.kind === "offboarding");
    if (status === "progress") list = list.filter((p) => p.status === "progress");
    if (status === "done")     list = list.filter((p) => p.status === "done");
    if (status === "delay")    list = list.filter((p) => p.status === "delay");
    return list;
  }, [all, tab, status]);

  const delayed = all.filter((p) => p.status === "delay");
  const inProgress = all.filter((p) => p.status === "progress").length;
  const done = all.filter((p) => p.status === "done").length;
  const avgDelay = delayed.length > 0
    ? Math.abs(Math.round(delayed.reduce((a, p) => a + p.dDay, 0) / delayed.length))
    : 0;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>온보딩</h1>
          <div className="greet-sub">신규 입사자 · 퇴직자 프로세스를 한곳에서 관리해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Doc size={13} sw={2} /> 템플릿</button>
          <button className="btn"><Icons.Sparkle size={13} /> 버디 일괄 매칭</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 새 프로세스</button>
        </div>
      </div>

      {/* ── Stat Strip ─────────────────── */}
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 진행 중</div>
          <div className="ss-val">{inProgress + delayed.length}<span className="u">명</span></div>
          <div className="ss-foot">온보딩 {data.onboarding.length} · 오프보딩 {data.offboarding.length}</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 지연</div>
          <div className="ss-val">{delayed.length}<span className="u">명</span></div>
          <div className="ss-foot">평균 <b style={{ color: "var(--danger)" }}>{avgDelay}일</b> 지연</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 완료</div>
          <div className="ss-val">{done}<span className="u">명</span></div>
          <div className="ss-foot">이번 달 누계</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.UserPlus size={13} sw={1.8} /></span> 이번 주 입사</div>
          <div className="ss-val">2<span className="u">명</span></div>
          <div className="ss-foot">5/19 (월) · 5/21 (수)</div>
        </div>
      </div>

      {/* ── Process tabs ─────────────────── */}
      <div className="wd-tab-bar">
        <button aria-selected={tab === "all"} onClick={() => setTab("all")}>
          전체 <span className="count">{all.length}</span>
        </button>
        <button aria-selected={tab === "onboarding"} onClick={() => setTab("onboarding")}>
          온보딩 <span className="count">{data.onboarding.length}</span>
        </button>
        <button aria-selected={tab === "offboarding"} onClick={() => setTab("offboarding")}>
          오프보딩 <span className="count">{data.offboarding.length}</span>
        </button>
      </div>

      {/* ── Status + View toolbar ─────────────────── */}
      <div className="wd-result-toolbar">
        <div className="pill-tabs">
          <button aria-pressed={status === "all"}      onClick={() => setStatus("all")}>전체</button>
          <button aria-pressed={status === "progress"} onClick={() => setStatus("progress")}>진행 중</button>
          <button aria-pressed={status === "done"}     onClick={() => setStatus("done")}>완료</button>
          <button aria-pressed={status === "delay"}    onClick={() => setStatus("delay")}>지연</button>
        </div>
        <span className="count-display"><b>{filtered.length}</b>건</span>
        <div className="right">
          <div className="seg">
            <button aria-pressed={view === "grid"}    onClick={() => setView("grid")}><Icons.Grid size={12} sw={2} /> 카드</button>
            <button aria-pressed={view === "table"}   onClick={() => setView("table")}><Icons.Inbox size={12} sw={2} /> 테이블</button>
            <button aria-pressed={view === "journey"} onClick={() => setView("journey")}><Icons.ArrowR size={12} sw={2} /> 여정</button>
            <button aria-pressed={view === "analytics"} onClick={() => setView("analytics")}><Icons.Chart size={12} sw={2} /> 분석</button>
          </div>
        </div>
      </div>

      {/* ── Grid View (Hire Cards) ────────────── */}
      {view === "grid" && (
        <div className="wd-hire-grid">
          {filtered.map((p, i) => {
            const pct = Math.round((p.progress / p.total) * 100);
            const isOver = p.kind === "offboarding";
            const cardCls = `wd-hire-card ${p.status} ${isOver ? "offboarding" : ""}`;
            return (
              <div key={i} className={cardCls} onClick={() => { setSelectedPerson(p); setView("journey"); }}>
                <div className="hc-banner">
                  <span className="hc-status-pill">
                    {p.status === "delay" && "지연"}
                    {p.status === "progress" && "진행"}
                    {p.status === "done" && "완료"}
                    {isOver && p.status !== "delay" && p.status !== "done" && "오프보딩"}
                  </span>
                </div>
                <div className="hc-body">
                  <div className="hc-avatar" style={{ "--av-hue": p.hue }}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="hc-name">{p.name}</div>
                  <div className="hc-role">{p.template} · {isOver ? "퇴사" : "신규 입사"}</div>

                  <div className="hc-meta">
                    <div className="item">
                      <div className="k">{isOver ? "퇴사일" : "입사일"}</div>
                      <div className="v">{p.date.slice(5).replace("-", "/")}</div>
                    </div>
                    <div className="item">
                      <div className="k">D-day</div>
                      <div className={`v ${p.status === "delay" ? "danger" : ""}`}>{dDayLabel(p.dDay)}</div>
                    </div>
                    <div className="item">
                      <div className="k">버디</div>
                      <div className={`v ${p.buddy ? "" : "muted"}`}>{p.buddy || "미배정"}</div>
                    </div>
                  </div>

                  <div className="hc-progress">
                    <div className="pg-h">
                      <span className="lbl">진행률</span>
                      <span className="val">{p.progress}/{p.total} · {pct}%</span>
                    </div>
                    <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  </div>

                  <div className="hc-actions">
                    <button className="btn sm" onClick={(e) => { e.stopPropagation(); toast(`${p.name} 진행 보기`); }}>
                      여정 보기
                    </button>
                    {p.status === "delay" ? (
                      <button className="btn sm btn-primary" onClick={(e) => { e.stopPropagation(); toast(`${p.name} 강제 완료`); }}>
                        강제 완료
                      </button>
                    ) : (
                      <button className="btn sm btn-primary" onClick={(e) => { e.stopPropagation(); toast(`${p.name} 알림 발송`); }}>
                        리마인드
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty standalone" style={{ gridColumn: "1/-1" }}>
              <Icons.EmptyBox size={28} />
              <div className="em-title">조건에 맞는 케이스가 없습니다</div>
            </div>
          )}
        </div>
      )}

      {/* ── Table View ────────────── */}
      {view === "table" && (
        <Card>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>직원명</th>
                  <th>입사/퇴사일</th>
                  <th>유형</th>
                  <th>버디</th>
                  <th>템플릿</th>
                  <th>진행률</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const pct = Math.round((p.progress / p.total) * 100);
                  return (
                    <tr key={i} className="clickable" onClick={() => { setSelectedPerson(p); setView("journey"); }}>
                      <td>
                        <div className="person">
                          <Avatar name={p.name} hue={p.hue} size="sm" />
                          <span className="fw-6">{p.name}</span>
                        </div>
                      </td>
                      <td className="mono">{fmtKDate(p.date)}</td>
                      <td>{p.kind === "offboarding" ? <span className="chip">오프보딩</span> : <span className="chip accent">온보딩</span>}</td>
                      <td className="small muted">{p.buddy || "—"}</td>
                      <td className="small">{p.template}</td>
                      <td>
                        <div className="flex center gap-2" style={{ minWidth: 140 }}>
                          <div className="progress grow" style={{ height: 6 }}>
                            <i style={{ width: `${pct}%`, background: p.status === "delay" ? "var(--danger)" : p.status === "done" ? "var(--success)" : "var(--accent)" }} />
                          </div>
                          <span className="mono tnum small fw-6" style={{ minWidth: 32, textAlign: "right" }}>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        {p.status === "done"     && <span className="chip success">완료</span>}
                        {p.status === "progress" && <span className="chip info">진행중</span>}
                        {p.status === "delay"    && <span className="chip danger">지연</span>}
                      </td>
                      <td>
                        {p.status === "delay" && (
                          <button className="btn sm" onClick={(e) => { e.stopPropagation(); toast(`${p.name} 강제 완료`); }}>강제 완료</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Analytics View ──────────── */}
      {view === "analytics" && (
        <>
          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">단계별 평균 소요 시간</span>
                <span className="sub">전체 신규입사 온보딩</span>
              </div>
              <div className="card-pad">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { step: "서류 제출",   avg: 2.4, target: 1.0, n: 18 },
                    { step: "OJT 교육",    avg: 5.8, target: 3.0, n: 16 },
                    { step: "보안 교육",   avg: 1.2, target: 1.0, n: 16 },
                    { step: "버디 매칭",   avg: 3.5, target: 1.0, n: 12 },
                    { step: "시스템 권한", avg: 1.8, target: 1.0, n: 14 },
                    { step: "팀 소개",     avg: 0.8, target: 0.5, n: 14 },
                  ].map((s) => {
                    const ratio = s.avg / s.target;
                    const color = ratio > 2 ? "var(--danger)" : ratio > 1.5 ? "oklch(50% 0.16 60)" : "var(--accent)";
                    return (
                      <div key={s.step} style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px", gap: 10, alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "var(--fg-muted)" }}>{s.step}</span>
                        <div style={{ position: "relative", height: 12, background: "var(--bg-sunk)", borderRadius: 3 }}>
                          <div style={{ position: "absolute", left: `${(s.target / 6) * 100}%`, top: -2, bottom: -2, width: 1, background: "var(--fg-faint)" }} title={`목표 ${s.target}일`} />
                          <div style={{ width: `${(s.avg / 6) * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
                        </div>
                        <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color }}>{s.avg}일 / {s.target}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--fg-faint)" }}>
                  ※ 회색 선 = 목표 소요 시간 · OJT/버디 매칭이 가장 길어짐
                </div>
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">단계별 정체율</span>
                <span className="sub">어디서 막히는가</span>
              </div>
              <div className="card-pad">
                {[
                  { step: "OJT 교육",     stuck: 38, total: 6, color: "var(--danger)" },
                  { step: "버디 매칭",    stuck: 32, total: 5, color: "var(--danger)" },
                  { step: "서류 제출",    stuck: 18, total: 3, color: "oklch(50% 0.16 60)" },
                  { step: "시스템 권한",  stuck: 8,  total: 1, color: "oklch(55% 0.16 60)" },
                  { step: "팀 소개",      stuck: 4,  total: 0, color: "var(--success)" },
                  { step: "보안 교육",    stuck: 0,  total: 0, color: "var(--success)" },
                ].map((s) => (
                  <div key={s.step} style={{ display: "grid", gridTemplateColumns: "100px 1fr 70px", gap: 10, alignItems: "center", fontSize: 12, marginBottom: 10 }}>
                    <span style={{ color: "var(--fg-muted)" }}>{s.step}</span>
                    <div style={{ height: 10, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${s.stuck}%`, height: "100%", background: s.color, borderRadius: 3 }} />
                    </div>
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: s.color }}>
                      {s.stuck}%
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--wd-orange-soft)", borderRadius: 8, fontSize: 12, color: "var(--wd-orange-ink)", lineHeight: 1.5, fontWeight: 500 }}>
                  ⚠️ <b>OJT·버디 매칭</b>에서 38% / 32% 정체. HR 담당자 우선 점검 권장.
                </div>
              </div>
            </Card>
          </div>

          <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">버디 매칭 효과</span>
                <span className="sub">최근 12개월 입사자</span>
              </div>
              <div className="card-pad">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ padding: "16px 18px", background: "oklch(95% 0.05 145)", borderRadius: 10, border: "1px solid oklch(85% 0.08 145)" }}>
                    <div style={{ fontSize: 11, color: "oklch(45% 0.14 145)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                      버디 매칭됨 (8명)
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 600, color: "oklch(45% 0.14 145)", letterSpacing: "-0.025em", fontFeatureSettings: '"tnum"', lineHeight: 1 }}>
                      94<span style={{ fontSize: 14, marginLeft: 4 }}>%</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 6 }}>평균 진행률 (6주 시점)</div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 2 }}>12개월 잔존율 <b style={{ color: "oklch(45% 0.14 145)" }}>100%</b></div>
                  </div>
                  <div style={{ padding: "16px 18px", background: "oklch(96% 0.05 25)", borderRadius: 10, border: "1px solid oklch(85% 0.08 25)" }}>
                    <div style={{ fontSize: 11, color: "var(--danger)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                      버디 미매칭 (3명)
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 600, color: "var(--danger)", letterSpacing: "-0.025em", fontFeatureSettings: '"tnum"', lineHeight: 1 }}>
                      52<span style={{ fontSize: 14, marginLeft: 4 }}>%</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 6 }}>평균 진행률 (6주 시점)</div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 2 }}>12개월 잔존율 <b style={{ color: "var(--danger)" }}>67%</b></div>
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  <b style={{ color: "var(--fg)" }}>인사이트</b> · 버디 매칭이 진행률 +42%p, 잔존율 +33%p 차이. 입사 D-day 이전 버디 배정 필수.
                </div>
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">템플릿별 완료율</span>
              </div>
              <div className="card-pad">
                {[
                  { tpl: "신규입사 온보딩", done: 80, total: 12 },
                  { tpl: "경력입사 온보딩", done: 92, total: 5 },
                  { tpl: "임원 온보딩",     done: 100, total: 2 },
                  { tpl: "오프보딩",       done: 67, total: 3 },
                ].map((t) => {
                  const color = t.done >= 90 ? "var(--success)" : t.done >= 70 ? "oklch(50% 0.16 60)" : "var(--danger)";
                  return (
                    <div key={t.tpl} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{t.tpl}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--fg-faint)" }}>{t.total}건</span>
                        <span style={{ marginLeft: 10, fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700, color }}>{t.done}%</span>
                      </div>
                      <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${t.done}%`, height: "100%", background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}
        <div className="grid-12">
          <Card>
            <div className="card-head"><span className="title">인원 ({filtered.length})</span></div>
            <div className="list" style={{ maxHeight: 580, overflowY: "auto" }}>
              {filtered.map((p, i) => (
                <div
                  key={i}
                  className="item"
                  style={{
                    cursor: "pointer",
                    background: selectedPerson?.name === p.name ? "var(--accent-soft)" : undefined,
                  }}
                  onClick={() => setSelectedPerson(p)}>
                  <Avatar name={p.name} hue={p.hue} size="sm" />
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <div className="meta">
                      <span>{p.progress}/{p.total}</span>
                      <span className="sep">·</span>
                      <span>{dDayLabel(p.dDay)}</span>
                    </div>
                  </div>
                  {p.status === "delay" && <span className="chip danger" style={{ fontSize: 10 }}>지연</span>}
                  {p.status === "done" && <span className="chip success" style={{ fontSize: 10 }}>완료</span>}
                </div>
              ))}
            </div>
          </Card>

          {selectedPerson ? (
            <div>
              <div className="wd-section-h">
                <h3>{selectedPerson.name} · 여정</h3>
                <span className="sub">{selectedPerson.template}</span>
                <div className="right">
                  <button className="btn sm">템플릿 보기</button>
                  {selectedPerson.status === "delay" && (
                    <button className="btn sm btn-primary" onClick={() => toast(`${selectedPerson.name} 강제 완료`)}>강제 완료</button>
                  )}
                </div>
              </div>
              <div className="wd-journey">
                {ONBOARD_STEPS.map((step, i) => {
                  let stepStatus = "upcoming";
                  if (i < selectedPerson.progress) stepStatus = "done";
                  else if (i === selectedPerson.progress) {
                    stepStatus = selectedPerson.status === "delay" ? "overdue" : "current";
                  }
                  return (
                    <div key={step.key} className={`jr-step ${stepStatus}`}>
                      <div className="jr-dot">
                        {stepStatus === "done" ? <Icons.Check size={12} sw={2.4} /> :
                          stepStatus === "current" || stepStatus === "overdue" ? i + 1 :
                          i + 1}
                      </div>
                      <div className="jr-body">
                        <div className="jr-title">{step.label}</div>
                        <div className="jr-meta">
                          <span>{step.cat}</span>
                          <span className="sep">·</span>
                          <span>
                            {stepStatus === "done" && "완료"}
                            {stepStatus === "current" && "진행 중"}
                            {stepStatus === "overdue" && <b style={{ color: "var(--danger)" }}>기한 초과</b>}
                            {stepStatus === "upcoming" && "예정"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="empty standalone">
              <Icons.UserPlus size={40} sw={1.4} />
              <div className="em-title">좌측에서 인원을 선택하세요</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { OnboardingPage });
