/* global React, Icons, Avatar, Card, ToastContext, fmtKDate */
// CTR HR Hub — Final 4: 목표/평가 + 분기 리뷰 + 나의 온보딩 + 징계/포상

const { useState: useStateR4, useContext: useCtxR4 } = React;

// ═══════════════════════════════════════════════════════════
// 1. 목표/평가 (My Goals) — Self-service
// ═══════════════════════════════════════════════════════════

const MY_GOALS = [
  { id: "g1", title: "결재 처리 SLA 단축",   weight: 30, progress: 78, status: "진행", category: "비즈니스 성과",  due: "2026-06-30" },
  { id: "g2", title: "신규 입사자 멘토링 5명", weight: 20, progress: 60, status: "진행", category: "조직 문화",     due: "2026-06-30" },
  { id: "g3", title: "HRIS 데이터 정합성 90%", weight: 25, progress: 92, status: "달성", category: "프로세스 개선",  due: "2026-05-31" },
  { id: "g4", title: "리더십 코칭 자격증 취득", weight: 15, progress: 30, status: "진행", category: "역량 개발",     due: "2026-06-30" },
  { id: "g5", title: "1:1 미팅 정기 운영",   weight: 10, progress: 100, status: "달성", category: "조직 문화",    due: "2026-06-30" },
];

function MyGoalsPage({ data }) {
  const toast = useCtxR4(ToastContext);
  const totalWeight = MY_GOALS.reduce((s, g) => s + g.weight, 0);
  const avgProgress = Math.round(MY_GOALS.reduce((s, g) => s + g.progress, 0) / MY_GOALS.length);
  const achieved = MY_GOALS.filter((g) => g.status === "달성").length;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>목표 / 평가</h1>
          <div className="greet-sub">2026 H1 사이클 · 본인 목표를 등록·관리하고 진행률을 업데이트하세요.</div>
          <div className="wd-status-chips">
            <span className="sc accent"><span className="dot" />목표 <b>{MY_GOALS.length}개</b></span>
            <span className="sc"><span className="dot" />가중치 <b>{totalWeight}%</b></span>
            <span className="sc success"><span className="dot" />평균 달성률 <b>{avgProgress}%</b></span>
            <span className="sc warn"><span className="dot" />달성 <b>{achieved}건</b></span>
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Doc size={13} sw={2} /> 평가 가이드</button>
          <button className="btn btn-primary" onClick={() => toast("새 목표 추가")}>
            <Icons.Plus size={13} sw={2.2} /> 새 목표
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MY_GOALS.map((g) => {
          const color = g.progress >= 90 ? "var(--success)" : g.progress >= 60 ? "var(--accent)" : "oklch(50% 0.16 60)";
          return (
            <Card key={g.id}>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icons.Target size={16} sw={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{g.title}</span>
                      <span className="chip accent" style={{ fontSize: 10.5 }}>{g.category}</span>
                      {g.status === "달성" && <span className="chip success">달성</span>}
                      {g.status === "진행" && <span className="chip info">진행</span>}
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--fg-muted)" }}>
                      <span>가중치 <b style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{g.weight}%</b></span>
                      <span>마감 <b style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{g.due.slice(5)}</b></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", color, letterSpacing: "-0.02em" }}>{g.progress}<span style={{ fontSize: 12, color: "var(--fg-faint)" }}>%</span></span>
                    <button className="btn sm" onClick={() => toast(`${g.title} 진행률 업데이트`)}>업데이트</button>
                  </div>
                </div>
                <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${g.progress}%`, height: "100%", background: color, borderRadius: 3 }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. 분기 리뷰 (Quarterly Review) — Self-service
// ═══════════════════════════════════════════════════════════

const QUARTER_REVIEWS = [
  { period: "2026 Q1", status: "완료", score: "E", manager: "이정환", date: "2026-03-28", highlights: "HRIS 도입 주도, 결재 SLA 30% 단축" },
  { period: "2025 Q4", status: "완료", score: "M", manager: "이정환", date: "2025-12-22", highlights: "연말정산 안정적 운영" },
  { period: "2025 Q3", status: "완료", score: "E", manager: "이정환", date: "2025-09-25", highlights: "팀 멤버 멘토링 5명 완료" },
];

function QuarterlyReviewPage({ data }) {
  const toast = useCtxR4(ToastContext);
  const [tab, setTab] = useStateR4("current");

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>분기 리뷰</h1>
          <div className="greet-sub">매 분기 본인 회고와 매니저 피드백을 확인하고 다음 분기를 준비해요.</div>
        </div>
      </div>

      <div className="wd-tab-bar">
        <button aria-selected={tab === "current"} onClick={() => setTab("current")}>
          <Icons.Calendar size={13} sw={1.8} /> 2026 Q2 진행 중
        </button>
        <button aria-selected={tab === "history"} onClick={() => setTab("history")}>
          <Icons.Doc size={13} sw={1.8} /> 이력 <span className="count">{QUARTER_REVIEWS.length}</span>
        </button>
      </div>

      {tab === "current" && (
        <>
          {/* 현재 진행 분기 */}
          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head"><span className="title">2026 Q2 — 진행 중</span><span className="sub">마감 D-44</span></div>
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
                {[
                  { s: 1, label: "자기 회고",     done: true,  due: "2026.06.15" },
                  { s: 2, label: "매니저 작성",   done: false, due: "2026.06.20" },
                  { s: 3, label: "1:1 미팅",     done: false, due: "2026.06.25" },
                  { s: 4, label: "확정",         done: false, due: "2026.06.30" },
                ].map((st) => (
                  <div key={st.s} style={{ padding: "12px 14px", background: st.done ? "oklch(95% 0.05 145)" : "var(--bg-sunk)", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: st.done ? "var(--success)" : "var(--bg-elev)", color: st.done ? "white" : "var(--fg-muted)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                        {st.done ? <Icons.Check size={11} sw={2.4} /> : st.s}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>{st.due}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px 16px", background: "var(--accent-soft)", borderLeft: "3px solid var(--accent)", borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", marginBottom: 6 }}>자기 회고 완료됨 (2026.06.10)</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  이번 분기는 결재 SLA 단축과 신규 입사자 멘토링이 주요 성과였어요. 매니저 피드백을 기다리는 중이에요.
                </div>
                <button className="btn sm" style={{ marginTop: 10 }} onClick={() => toast("회고 수정")}>회고 수정</button>
              </div>
            </div>
          </Card>
        </>
      )}

      {tab === "history" && (
        <Card>
          <div className="card-head"><span className="title">분기 리뷰 이력</span></div>
          <div className="list">
            {QUARTER_REVIEWS.map((r, i) => (
              <div key={i} className="item">
                <div style={{ width: 44, height: 44, borderRadius: 10, background: r.score === "E" ? "oklch(94% 0.05 230)" : "oklch(94% 0.04 145)", color: r.score === "E" ? "oklch(40% 0.13 230)" : "oklch(40% 0.13 145)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16, fontFamily: "var(--font-mono)" }}>
                  {r.score}
                </div>
                <div className="grow">
                  <div className="title">{r.period}</div>
                  <div className="meta">
                    <span>평가자 {r.manager}</span>
                    <span className="sep">·</span>
                    <span className="mono">{r.date}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4, lineHeight: 1.5 }}>
                    "{r.highlights}"
                  </div>
                </div>
                <button className="btn sm"><Icons.Eye size={11} /> 상세</button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. 나의 온보딩 (My Onboarding) — Self-service
// ═══════════════════════════════════════════════════════════

const MY_ONBOARD_STEPS = [
  { key: "doc",      label: "서류 제출",       done: true,  date: "2024-03-12", who: "본인" },
  { key: "ojt",      label: "OJT 교육",        done: true,  date: "2024-03-15", who: "한지영 (HR)" },
  { key: "security", label: "보안 교육",       done: true,  date: "2024-03-15", who: "IT 보안팀" },
  { key: "buddy",    label: "버디 매칭",        done: true,  date: "2024-03-18", who: "박서연 (버디)" },
  { key: "system",   label: "시스템 권한 부여",  done: true,  date: "2024-03-20", who: "IT 헬프데스크" },
  { key: "intro",    label: "팀 소개 + 인사",   done: true,  date: "2024-03-21", who: "이정환 (매니저)" },
];

function MyOnboardingPage({ data }) {
  const completed = MY_ONBOARD_STEPS.filter((s) => s.done).length;
  const pct = Math.round((completed / MY_ONBOARD_STEPS.length) * 100);
  const isComplete = completed === MY_ONBOARD_STEPS.length;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>나의 온보딩</h1>
          <div className="greet-sub">
            {isComplete ? "축하해요! 온보딩을 모두 완료했어요." : `현재 진행률 ${pct}% — ${completed}/${MY_ONBOARD_STEPS.length} 단계`}
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 18, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: isComplete ? "oklch(95% 0.05 145)" : "var(--accent-soft)", color: isComplete ? "var(--success)" : "var(--accent-ink)", display: "grid", placeItems: "center" }}>
            {isComplete ? <Icons.Check size={26} sw={2.4} /> : <Icons.UserPlus size={26} sw={1.8} />}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{isComplete ? "온보딩 완료" : "신규입사 온보딩"}</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 2 }}>
              {isComplete ? "2024년 3월 21일 완료 · 입사 D+10일차" : "버디 박서연 · 매니저 이정환"}
            </div>
            <div style={{ marginTop: 10, height: 8, background: "var(--bg-sunk)", borderRadius: 4, overflow: "hidden", width: 320 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: isComplete ? "var(--success)" : "var(--accent)", borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", color: isComplete ? "var(--success)" : "var(--accent-ink)", letterSpacing: "-0.02em" }}>{pct}<span style={{ fontSize: 13, color: "var(--fg-faint)" }}>%</span></div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{completed}/{MY_ONBOARD_STEPS.length}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-head"><span className="title">온보딩 여정</span></div>
        <div style={{ padding: "16px 20px" }}>
          <div className="wd-journey" style={{ border: 0, padding: 0 }}>
            {MY_ONBOARD_STEPS.map((s, i) => (
              <div key={s.key} className={`jr-step ${s.done ? "done" : i === completed ? "current" : "upcoming"}`}>
                <div className="jr-dot">{s.done ? <Icons.Check size={12} sw={2.4} /> : i + 1}</div>
                <div className="jr-body">
                  <div className="jr-title">{s.label}</div>
                  <div className="jr-meta">
                    {s.done && (
                      <>
                        <span>완료</span>
                        <span className="sep">·</span>
                        <span className="mono">{s.date}</span>
                        <span className="sep">·</span>
                        <span>{s.who}</span>
                      </>
                    )}
                    {!s.done && <span>예정</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. 징계/포상 (Discipline & Awards)
// ═══════════════════════════════════════════════════════════

const DISCIPLINE_RECORDS = [
  { id: "DR-018", type: "포상", category: "특별 성과",   target: "최서연", dept: "개발팀",     reason: "긴급 릴리즈 안정화 기여", amount: 1000000, date: "2026-05-08", status: "지급 완료" },
  { id: "DR-017", type: "포상", category: "장기근속",   target: "이정환", dept: "재무/회계팀", reason: "근속 10년",            amount: 3000000, date: "2026-04-15", status: "지급 완료" },
  { id: "DR-016", type: "징계", category: "경고",      target: "—",      dept: "영업팀",     reason: "비밀 정보 유출 위반",    amount: 0,       date: "2026-04-02", status: "확정" },
  { id: "DR-015", type: "포상", category: "MVP",      target: "박서연", dept: "기획팀",     reason: "분기 MVP 선정",         amount: 2000000, date: "2026-03-30", status: "지급 완료" },
  { id: "DR-014", type: "징계", category: "주의",      target: "—",      dept: "생산기술팀",  reason: "안전 수칙 미준수",       amount: 0,       date: "2026-03-15", status: "확정" },
];

function DisciplinePage({ data }) {
  const toast = useCtxR4(ToastContext);
  const [tab, setTab] = useStateR4("all");

  const visible = tab === "all" ? DISCIPLINE_RECORDS : DISCIPLINE_RECORDS.filter((r) => r.type === (tab === "award" ? "포상" : "징계"));
  const awards = DISCIPLINE_RECORDS.filter((r) => r.type === "포상").length;
  const discs = DISCIPLINE_RECORDS.filter((r) => r.type === "징계").length;
  const totalAward = DISCIPLINE_RECORDS.filter((r) => r.type === "포상").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>징계 / 포상</h1>
          <div className="greet-sub">직원 포상 이력과 징계 처분 기록을 관리해요.</div>
          <div className="wd-status-chips">
            <span className="sc success"><span className="dot" />포상 <b>{awards}건</b></span>
            <span className="sc danger"><span className="dot" />징계 <b>{discs}건</b></span>
            <span className="sc accent"><span className="dot" />포상금 총액 <b>₩{(totalAward / 10000).toFixed(0)}만</b></span>
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 이력 내보내기</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 새 기록</button>
        </div>
      </div>

      <div className="wd-tab-bar">
        <button aria-selected={tab === "all"}      onClick={() => setTab("all")}>전체 <span className="count">{DISCIPLINE_RECORDS.length}</span></button>
        <button aria-selected={tab === "award"}    onClick={() => setTab("award")}>포상 <span className="count">{awards}</span></button>
        <button aria-selected={tab === "discipline"} onClick={() => setTab("discipline")}>징계 <span className="count">{discs}</span></button>
      </div>

      <Card>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th style={{ width: 90 }}>ID</th><th>유형</th><th>구분</th><th>대상자</th><th>사유</th><th className="right">금액</th><th className="right">일자</th><th>상태</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => toast(`${r.id} 상세`)}>
                  <td className="mono" style={{ fontSize: 11 }}>{r.id}</td>
                  <td>
                    {r.type === "포상" ? (
                      <span className="chip success">🏆 포상</span>
                    ) : (
                      <span className="chip danger">⚠ 징계</span>
                    )}
                  </td>
                  <td><span className="chip">{r.category}</span></td>
                  <td>
                    {r.target !== "—" ? (
                      <div className="person">
                        <Avatar name={r.target} hue={(r.target.charCodeAt(0) * 47) % 360} size="sm" />
                        <div>
                          <div className="fw-6">{r.target}</div>
                          <div className="en">{r.dept}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="small muted">— ({r.dept})</span>
                    )}
                  </td>
                  <td className="small muted" style={{ maxWidth: 240 }}>{r.reason}</td>
                  <td className="right mono tnum">
                    {r.amount > 0 ? (
                      <span style={{ color: "var(--success)", fontWeight: 700 }}>+₩{r.amount.toLocaleString()}</span>
                    ) : (
                      <span style={{ color: "var(--fg-faint)" }}>—</span>
                    )}
                  </td>
                  <td className="right mono small">{r.date}</td>
                  <td>
                    {r.status === "지급 완료" && <span className="chip success">{r.status}</span>}
                    {r.status === "확정"     && <span className="chip">{r.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { MyGoalsPage, QuarterlyReviewPage, MyOnboardingPage, DisciplinePage });
