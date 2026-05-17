/* global React, Icons, Avatar, Card, ToastContext, fmtKDate */
// CTR HR Hub — Round 1: 칸반 보드 + 캘리브레이션 + 인재 풀

const { useState: useStateR1, useContext: useCtxR1, useMemo: useMemoR1 } = React;

// ═══════════════════════════════════════════════════════════
// 1. 칸반 보드 (Recruitment Kanban — Swimlane × Stage)
// ═══════════════════════════════════════════════════════════

const KANBAN_STAGES = [
  { id: "APPLIED",     label: "지원",     color: "var(--fg-faint)" },
  { id: "SCREENING",   label: "서류",     color: "var(--accent)" },
  { id: "INTERVIEW_1", label: "1차 면접",  color: "var(--accent)" },
  { id: "INTERVIEW_2", label: "2차 면접",  color: "var(--accent)" },
  { id: "FINAL",       label: "최종",     color: "oklch(60% 0.16 60)" },
  { id: "OFFER",       label: "오퍼",     color: "oklch(55% 0.18 290)" },
  { id: "HIRED",       label: "입사",     color: "var(--success)" },
];

const MOCK_BOARD = [
  {
    id: "p1", title: "프론트엔드 엔지니어 (시니어)", dept: "개발팀", headcount: 2,
    applications: [
      { id: "a1", name: "김민준", email: "minjun@ex.com", stage: "APPLIED",     score: 78, applied: "5/12" },
      { id: "a2", name: "이서연", email: "seoyeon@ex.com", stage: "APPLIED",    score: 85, applied: "5/14" },
      { id: "a3", name: "박지훈", email: "jihun@ex.com",  stage: "SCREENING",   score: 92, applied: "5/08" },
      { id: "a4", name: "최예진", email: "yejin@ex.com",  stage: "INTERVIEW_1", score: 88, applied: "5/05" },
      { id: "a5", name: "정우진", email: "wj@ex.com",     stage: "INTERVIEW_2", score: 91, applied: "5/01" },
      { id: "a6", name: "강하은", email: "haeun@ex.com",  stage: "FINAL",       score: 95, applied: "4/28" },
      { id: "a7", name: "윤도현", email: "dohyun@ex.com", stage: "OFFER",       score: 89, applied: "4/22" },
    ],
  },
  {
    id: "p2", title: "백엔드 엔지니어", dept: "개발팀", headcount: 1,
    applications: [
      { id: "b1", name: "송태민", email: "taemin@ex.com",  stage: "APPLIED",     score: 72, applied: "5/13" },
      { id: "b2", name: "홍지수", email: "jisu@ex.com",    stage: "SCREENING",   score: 86, applied: "5/10" },
      { id: "b3", name: "임주영", email: "juyoung@ex.com", stage: "SCREENING",   score: 80, applied: "5/11" },
      { id: "b4", name: "오승현", email: "sh@ex.com",      stage: "INTERVIEW_1", score: 84, applied: "5/06" },
      { id: "b5", name: "장미경", email: "mk@ex.com",      stage: "FINAL",       score: 90, applied: "4/30" },
    ],
  },
  {
    id: "p3", title: "재무회계 대리", dept: "재무/회계팀", headcount: 1,
    applications: [
      { id: "c1", name: "신현우", email: "hw@ex.com",  stage: "APPLIED",     score: 75, applied: "5/14" },
      { id: "c2", name: "황보라", email: "bora@ex.com", stage: "INTERVIEW_1", score: 82, applied: "5/04" },
      { id: "c3", name: "조경수", email: "ks@ex.com",  stage: "OFFER",       score: 88, applied: "4/25" },
    ],
  },
];

function KanbanBoardPage({ data }) {
  const toast = useCtxR1(ToastContext);
  const [board] = useStateR1(MOCK_BOARD);
  const totalCandidates = board.reduce((s, p) => s + p.applications.length, 0);

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>칸반 보드</h1>
          <div className="greet-sub">공고별 스윔레인 × 채용 단계 컬럼. 후보자를 드래그하여 단계를 이동하세요.</div>
          <div className="wd-status-chips">
            <span className="sc accent"><span className="dot" />공고 <b>{board.length}건</b></span>
            <span className="sc"><span className="dot" />전체 후보 <b>{totalCandidates}명</b></span>
            <span className="sc success"><span className="dot" />오퍼 단계 <b>{board.reduce((s, p) => s + p.applications.filter((a) => a.stage === "OFFER").length, 0)}명</b></span>
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 엑셀</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 새 공고</button>
        </div>
      </div>

      {/* 컬럼 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: `200px repeat(${KANBAN_STAGES.length}, minmax(150px, 1fr))`, gap: 6, marginBottom: 4, position: "sticky", top: "var(--topbar-h)", zIndex: 5, background: "var(--bg)", padding: "8px 0" }}>
        <div></div>
        {KANBAN_STAGES.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--fg-muted)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* 공고별 스윔레인 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {board.map((p) => (
          <div key={p.id} style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{p.title}</span>
              <span className="chip">{p.dept}</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fg-muted)" }}>
                <Icons.Users size={12} sw={1.8} />
                <span>{p.applications.length}명 / 채용 {p.headcount}명</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `200px repeat(${KANBAN_STAGES.length}, minmax(150px, 1fr))`, gap: 6, padding: 10, background: "var(--bg-sunk)" }}>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", padding: "4px 6px" }}>스윔레인</div>
              {KANBAN_STAGES.map((s) => {
                const cards = p.applications.filter((a) => a.stage === s.id);
                return (
                  <div key={s.id} style={{
                    minHeight: 60,
                    border: "1px solid var(--border)",
                    background: "var(--bg-elev)",
                    borderRadius: 8,
                    padding: 6,
                    display: "flex", flexDirection: "column", gap: 4,
                  }}>
                    {cards.length > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", marginBottom: 2 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</span>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontWeight: 600 }}>{cards.length}</span>
                      </div>
                    )}
                    {cards.map((a) => {
                      const scoreColor = a.score >= 85 ? "oklch(45% 0.14 145)" : a.score >= 70 ? "oklch(50% 0.16 60)" : "var(--danger)";
                      const scoreBg   = a.score >= 85 ? "oklch(95% 0.05 145)" : a.score >= 70 ? "var(--wd-orange-soft)" : "oklch(96% 0.05 25)";
                      return (
                        <div key={a.id} draggable
                          onClick={() => toast(`${a.name} 상세`)}
                          style={{
                            background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 8,
                            padding: "8px 9px", cursor: "grab",
                          }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <Icons.User size={10} sw={1.8} style={{ color: "var(--fg-faint)", marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                              <div style={{ fontSize: 10, color: "var(--fg-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{a.email}</div>
                              <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
                                <span style={{ background: scoreBg, color: scoreColor, fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3, fontFamily: "var(--font-mono)" }}>AI {a.score}</span>
                                <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>{a.applied}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {cards.length === 0 && (
                      <div style={{ height: 36, border: "1px dashed var(--border)", borderRadius: 6, display: "grid", placeItems: "center" }}>
                        <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>비어있음</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. 캘리브레이션 (4×4 Calibration Grid + 매니저 회의 UI)
// ═══════════════════════════════════════════════════════════

const CAL_GRID_LABELS = [
  ["Risk",      "Hidden Gem",  "Rising Star", "Star ⭐"],
  ["Develop",   "Solid",       "High Pro",    "Future Leader"],
  ["Coach",     "Effective",   "Core",        "Trusted Pro"],
  ["PIP",       "Inconsistent","Workhorse",   "Specialist"],
];
const CAL_AXIS_POT = ["O", "E", "M", "S"];
const CAL_AXIS_PERF = ["S", "M", "E", "O"];

// Mock employees per cell (row=potential O→S, col=performance S→O)
const CAL_EMPLOYEES = {
  "0,3": [{ name: "최서연", dept: "개발팀", rating: "E→O" }, { name: "윤도현", dept: "영업팀", rating: "O" }],
  "0,2": [{ name: "권하은", dept: "생산팀", rating: "E" }],
  "0,1": [{ name: "강성민", dept: "QA팀", rating: "M" }],
  "1,2": [{ name: "박지훈", dept: "개발팀", rating: "E" }, { name: "정유진", dept: "재무팀", rating: "E" }, { name: "이상민", dept: "영업팀", rating: "E" }, { name: "김민지", dept: "인사팀", rating: "E" }, { name: "오승현", dept: "개발팀", rating: "E" }, { name: "조경수", dept: "재무팀", rating: "E" }, { name: "황보라", dept: "영업팀", rating: "E" }, { name: "신현우", dept: "QA팀", rating: "E" }],
  "1,3": [{ name: "한지영", dept: "인사팀", rating: "O" }, { name: "임주영", dept: "개발팀", rating: "O" }, { name: "장미경", dept: "재무팀", rating: "O" }],
  "2,2": Array.from({ length: 20 }, (_, i) => ({ name: `직원${i + 1}`, dept: "다양", rating: "M" })),
  "2,1": [{ name: "송태민", dept: "QA팀", rating: "M" }, { name: "홍지수", dept: "영업팀", rating: "M" }, { name: "강하준", dept: "인사팀", rating: "M" }, { name: "이정환", dept: "재무팀", rating: "M" }, { name: "박서연", dept: "개발팀", rating: "M" }, { name: "최민호", dept: "QA팀", rating: "M" }, { name: "윤지호", dept: "영업팀", rating: "M" }, { name: "정현철", dept: "생산팀", rating: "M" }],
  "3,0": [{ name: "이민준", dept: "생산기술", rating: "S" }, { name: "오민서", dept: "영업팀", rating: "S" }, { name: "정태우", dept: "구매팀", rating: "S" }, { name: "한지수", dept: "QA팀", rating: "S" }, { name: "윤하은", dept: "재무팀", rating: "S" }],
  "3,1": [{ name: "박재민", dept: "개발팀", rating: "S" }, { name: "이서아", dept: "영업팀", rating: "S" }],
  "1,0": [{ name: "강유리", dept: "인사팀", rating: "S" }],
  "2,0": [{ name: "조성민", dept: "재무팀", rating: "S" }, { name: "김태현", dept: "QA팀", rating: "S" }],
};

function CalibrationPage({ data }) {
  const toast = useCtxR1(ToastContext);
  const [selected, setSelected] = useStateR1(null);
  const [cycle, setCycle] = useStateR1("2026 H1");

  const cellTone = (ri, ci) => {
    const score = (3 - ri) + ci;
    if (score >= 5) return { color: "oklch(55% 0.18 290)", bg: "oklch(96% 0.05 290)" };
    if (score >= 4) return { color: "oklch(55% 0.14 145)", bg: "oklch(96% 0.04 145)" };
    if (score >= 2) return { color: "oklch(45% 0.10 230)", bg: "oklch(96% 0.03 230)" };
    if (score >= 1) return { color: "oklch(55% 0.16 60)",  bg: "var(--wd-orange-soft)" };
    return { color: "oklch(58% 0.18 25)", bg: "oklch(96% 0.05 25)" };
  };

  const cellPeople = (ri, ci) => CAL_EMPLOYEES[`${ri},${ci}`] || [];
  const totalAssigned = Object.values(CAL_EMPLOYEES).flat().length;

  // 분포 합산
  const dist = { O: 0, E: 0, M: 0, S: 0 };
  Object.entries(CAL_EMPLOYEES).forEach(([k, v]) => {
    const ci = parseInt(k.split(",")[1]);
    const grade = CAL_AXIS_PERF[ci];
    dist[grade] += v.length;
  });

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>캘리브레이션</h1>
          <div className="greet-sub">매니저 평가 일관성을 검증하고 등급을 조정해요.</div>
          <div className="wd-status-chips">
            <span className="sc"><span className="dot" />총 <b>{totalAssigned}명</b> 배치</span>
            <span className="sc danger"><span className="dot" />하위 (S 등급) <b>{dist.S}명</b></span>
            <span className="sc accent"><span className="dot" />상위 (O+E) <b>{dist.O + dist.E}명</b></span>
          </div>
        </div>
        <div className="right">
          <select className="select" value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option>2026 H1</option><option>2025 H2</option>
          </select>
          <button className="btn"><Icons.Sparkle size={13} /> AI 추천 적용</button>
          <button className="btn btn-primary"><Icons.Check size={13} sw={2.2} /> 결과 확정</button>
        </div>
      </div>

      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        {/* 4×4 그리드 */}
        <Card>
          <div className="card-head">
            <span className="title">캘리브레이션 그리드 (4×4)</span>
            <span className="sub">성과 × 잠재력 · 셀 클릭으로 명단 확인</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "24px 36px 1fr", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                잠재력 ↑
              </div>
              <div style={{ display: "grid", gridTemplateRows: "repeat(4, 1fr)", gap: 6, alignItems: "stretch" }}>
                {CAL_AXIS_POT.map((a) => (
                  <div key={a} style={{ display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--fg-muted)" }}>{a}</div>
                ))}
              </div>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: 6 }}>
                  {CAL_GRID_LABELS.map((row, ri) =>
                    row.map((lbl, ci) => {
                      const tone = cellTone(ri, ci);
                      const people = cellPeople(ri, ci);
                      const isSelected = selected && selected.ri === ri && selected.ci === ci;
                      return (
                        <button key={`${ri}-${ci}`} onClick={() => setSelected({ ri, ci, label: lbl })} style={{
                          background: tone.bg,
                          border: `2px solid ${isSelected ? tone.color : "transparent"}`,
                          outline: `1.5px solid ${tone.color}`,
                          outlineOffset: -1,
                          borderRadius: 8,
                          padding: "10px 12px",
                          minHeight: 110,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          cursor: "pointer",
                          opacity: people.length === 0 ? 0.45 : 1,
                          textAlign: "left",
                        }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: tone.color, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2 }}>{lbl}</div>
                          <div style={{ fontSize: 22, fontWeight: 600, color: tone.color, fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                            {people.length}<span style={{ fontSize: 10, marginLeft: 3, color: "var(--fg-faint)", fontWeight: 500 }}>명</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8, fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--fg-muted)", textAlign: "center" }}>
                  {CAL_AXIS_PERF.map((a) => <span key={a}>{a}</span>)}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg-faint)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>성과 →</div>
              </div>
            </div>
          </div>
        </Card>

        {/* 선택된 셀 명단 */}
        <Card>
          <div className="card-head">
            <span className="title">{selected ? selected.label : "셀을 선택하세요"}</span>
            {selected && <span className="sub">{cellPeople(selected.ri, selected.ci).length}명</span>}
          </div>
          {selected ? (
            <div className="list" style={{ maxHeight: 460, overflowY: "auto" }}>
              {cellPeople(selected.ri, selected.ci).map((p, i) => (
                <div key={i} className="item" style={{ padding: "10px var(--space-6)" }}>
                  <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 47) % 360} size="sm" />
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <div className="meta"><span>{p.dept}</span><span className="sep">·</span><span>현재 {p.rating}</span></div>
                  </div>
                  <button className="btn sm btn-ghost" onClick={() => toast(`${p.name} 셀 이동`)}>이동</button>
                </div>
              ))}
              {cellPeople(selected.ri, selected.ci).length === 0 && (
                <div className="empty" style={{ padding: "var(--space-8)" }}>
                  <Icons.EmptyBox size={24} />
                  <div className="em-title">이 셀에 배치된 직원이 없습니다</div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty" style={{ padding: "var(--space-8)" }}>
              <Icons.Sparkle size={24} />
              <div className="em-title">좌측 그리드의 셀을 클릭하면 명단이 표시돼요</div>
            </div>
          )}
        </Card>
      </div>

      {/* 매니저 회의 정보 */}
      <Card>
        <div className="card-head">
          <span className="title">캘리브레이션 회의</span>
          <span className="sub">팀장 8명 참석 예정</span>
          <div className="right">
            <button className="btn sm"><Icons.Calendar size={11} sw={2} /> 일정 잡기</button>
            <button className="btn sm btn-primary"><Icons.Doc size={11} sw={2} /> 회의 자료 생성</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>회의 일정</th><th>참석자</th><th>대상</th><th className="right">상태</th></tr></thead>
            <tbody>
              <tr><td className="mono">2026.06.10 14:00</td><td>인사팀 + 본부장 3명</td><td className="small muted">상위 등급 (O/E) 검토</td><td className="right"><span className="chip warning">예정</span></td></tr>
              <tr><td className="mono">2026.06.12 10:00</td><td>전 팀장 8명</td><td className="small muted">M/S 등급 조정</td><td className="right"><span className="chip">미확정</span></td></tr>
              <tr><td className="mono">2026.06.15 15:00</td><td>대표이사 + 임원진</td><td className="small muted">최종 확정</td><td className="right"><span className="chip">미확정</span></td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. 인재 풀 (Talent Pool)
// ═══════════════════════════════════════════════════════════

const POOL_REASONS = {
  rejected_qualified: { label: "탈락 (자질 우수)", color: "oklch(45% 0.13 230)", bg: "oklch(94% 0.04 230)" },
  withdrawn:          { label: "지원 철회",        color: "oklch(50% 0.16 60)",  bg: "var(--wd-orange-soft)" },
  overqualified:      { label: "Overqualified",  color: "oklch(40% 0.13 200)",  bg: "oklch(94% 0.04 200)" },
  manual:             { label: "수동 등록",        color: "var(--fg-muted)",     bg: "var(--bg-sunk)" },
};

const POOL_STATUS = {
  active:    { label: "활성",   color: "oklch(45% 0.14 145)", bg: "oklch(95% 0.05 145)" },
  contacted: { label: "접촉 중", color: "oklch(50% 0.16 60)",  bg: "var(--wd-orange-soft)" },
  expired:   { label: "만료",   color: "var(--fg-muted)",     bg: "var(--bg-sunk)" },
  hired:     { label: "채용 완료", color: "var(--accent)",    bg: "var(--accent-soft)" },
};

const MOCK_POOL = [
  { id: "t1", name: "김지원", email: "jiwon@ex.com", phone: "010-1234-5678", reason: "rejected_qualified", status: "active",    tags: ["React", "TypeScript", "5년 경력"], expires: "2026-09-15", source: "프론트엔드 엔지니어 (시니어)", consent: true, lastApply: "FINAL" },
  { id: "t2", name: "이준석", email: "jslee@ex.com", phone: "010-2345-6789", reason: "withdrawn",          status: "contacted", tags: ["Java", "Spring", "AWS"],         expires: "2026-08-22", source: "백엔드 엔지니어",            consent: true, lastApply: "INTERVIEW_2" },
  { id: "t3", name: "박서영", email: "sypark@ex.com", phone: null,           reason: "overqualified",      status: "active",    tags: ["PM", "10년+", "리더십"],         expires: "2026-12-01", source: "HR Business Partner",        consent: true, lastApply: "OFFER" },
  { id: "t4", name: "최가람", email: "garam@ex.com", phone: "010-4567-8901", reason: "manual",             status: "active",    tags: ["디자인", "UI/UX"],              expires: "2026-06-10", source: null,                         consent: false, lastApply: null },
  { id: "t5", name: "강유진", email: "yj@ex.com",    phone: "010-5678-9012", reason: "rejected_qualified", status: "hired",     tags: ["회계", "ERP"],                 expires: "2026-07-30", source: "재무회계 대리",              consent: true, lastApply: "FINAL" },
  { id: "t6", name: "윤하늘", email: "haneul@ex.com", phone: "010-6789-0123", reason: "rejected_qualified", status: "active",    tags: ["품질관리", "ISO"],              expires: "2026-09-01", source: "품질관리 엔지니어",          consent: true, lastApply: "INTERVIEW_2" },
];

function TalentPoolPage({ data }) {
  const toast = useCtxR1(ToastContext);
  const [items] = useStateR1(MOCK_POOL);
  const [search, setSearch] = useStateR1("");
  const [statusFilter, setStatusFilter] = useStateR1("");

  const filtered = useMemoR1(() => {
    return items.filter((x) => {
      if (statusFilter && x.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return x.name.includes(q) || x.email.toLowerCase().includes(q) || x.tags.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const daysUntil = (date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  const stats = {
    total: items.length,
    active: items.filter((x) => x.status === "active").length,
    contacted: items.filter((x) => x.status === "contacted").length,
    expiring: items.filter((x) => x.status === "active" && daysUntil(x.expires) <= 30).length,
  };

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>인재 풀</h1>
          <div className="greet-sub">우수 탈락자·이전 지원자를 잠재 후보군으로 관리해요. GDPR 2년 보관.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Mail size={13} sw={2} /> 일괄 메일</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 후보자 추가</button>
        </div>
      </div>

      {/* KPI */}
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 전체 후보</div>
          <div className="ss-val">{stats.total}<span className="u">명</span></div>
          <div className="ss-foot">2년 보관 정책</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 활성</div>
          <div className="ss-val">{stats.active}<span className="u">명</span></div>
          <div className="ss-foot">접촉 가능</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Mail size={13} sw={1.8} /></span> 접촉 중</div>
          <div className="ss-val">{stats.contacted}<span className="u">명</span></div>
          <div className="ss-foot">팔로업 필요</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 30일 내 만료</div>
          <div className="ss-val">{stats.expiring}<span className="u">명</span></div>
          <div className="ss-foot">동의 갱신 필요</div>
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="wd-filter-bar">
        <div className="search-wrap">
          <Icons.Search />
          <input className="input" placeholder="이름·이메일·태그 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "7px 12px", fontSize: 12.5 }}>
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="contacted">접촉 중</option>
          <option value="hired">채용 완료</option>
          <option value="expired">만료</option>
        </select>
        <div className="right"><b style={{ color: "var(--accent)" }}>{filtered.length}</b><span style={{ color: "var(--fg-muted)" }}>명</span></div>
      </div>

      {/* 카드 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((p) => {
          const reason = POOL_REASONS[p.reason];
          const status = POOL_STATUS[p.status];
          const daysLeft = daysUntil(p.expires);
          const expiringSoon = p.status === "active" && daysLeft <= 30;
          return (
            <div key={p.id} style={{
              background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "16px 20px",
              display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "flex-start",
            }}>
              <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 47) % 360} />
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="chip" style={{ background: status.bg, color: status.color, fontWeight: 600 }}>{status.label}</span>
                  <span className="chip" style={{ background: reason.bg, color: reason.color }}>{reason.label}</span>
                  {!p.consent && (
                    <span className="chip" style={{ background: "oklch(96% 0.05 25)", color: "var(--danger)", fontWeight: 600 }}>
                      <Icons.Alert size={10} sw={2.2} /> 동의 없음
                    </span>
                  )}
                  {expiringSoon && (
                    <span className="chip" style={{ background: "var(--wd-orange-soft)", color: "oklch(50% 0.16 60)", fontWeight: 600 }}>
                      <Icons.Clock size={10} /> {daysLeft}일 후 만료
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--fg-muted)", flexWrap: "wrap" }}>
                  <span className="flex center gap-1"><Icons.Mail size={11} sw={1.8} /> {p.email}</span>
                  {p.phone && <span className="flex center gap-1"><Icons.Phone size={11} sw={1.8} /> {p.phone}</span>}
                </div>
                {p.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                    {p.tags.map((t) => (
                      <span key={t} className="chip" style={{ fontSize: 10.5, padding: "1px 7px", background: "var(--bg-sunk)" }}>{t}</span>
                    ))}
                  </div>
                )}
                {p.source && (
                  <div style={{ fontSize: 11.5, color: "var(--fg-faint)", marginTop: 8 }}>
                    출처 공고: <b style={{ color: "var(--fg-muted)" }}>{p.source}</b>
                    {p.lastApply && <span> · 마지막 단계 <b style={{ color: "var(--fg-muted)" }}>{p.lastApply}</b></span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <select className="select" defaultValue={p.status} style={{ padding: "5px 10px", fontSize: 11.5 }} onChange={() => toast(`${p.name} 상태 변경`)}>
                  <option value="active">활성</option>
                  <option value="contacted">접촉 중</option>
                  <option value="hired">채용 완료</option>
                  <option value="expired">만료</option>
                </select>
                <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>만료: {p.expires.slice(5)}</span>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button className="btn sm"><Icons.Mail size={11} /></button>
                  <button className="btn sm"><Icons.Eye size={11} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty standalone">
            <Icons.EmptyBox size={28} />
            <div className="em-title">검색 결과가 없습니다</div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { KanbanBoardPage, CalibrationPage, TalentPoolPage });
