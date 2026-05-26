/* global React, Icons, Card, CardHead, OrgRestructureWizard */
// CTR HR Hub — 조직 관리

const { useState: useStateOR } = React;

function OrgPage({ data }) {
  const [view, setView] = useStateOR("tree");
  const [showDotted, setShowDotted] = useStateOR(false);
  const [wizOpen, setWizOpen] = useStateOR(false);
  const [searchValue, setSearchValue] = useStateOR(""); // N+29: 검색 opacity highlight

  const root = data.orgTree.root;
  const depts = data.orgTree.departments;

  if (wizOpen) {
    return <OrgRestructureWizard onCancel={() => setWizOpen(false)} onComplete={() => setWizOpen(false)} />;
  }

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>조직도</h1>
          <div className="greet-sub">전사 조직 구조를 항해서 탐색해요.</div>
          <div className="wd-status-chips">
            <span className="sc"><span className="dot" /><b>{root.name}</b> · {root.count}</span>
            <span className="sc accent"><span className="dot" />부서 <b>{depts.length}개</b></span>
            <span className="sc success"><span className="dot" />내 팀 · <b>{data.orgTree.hrTeam.name}</b></span>
            <span className="sc zero"><span className="dot" />발효일 <b>2026.05.16</b></span>
          </div>
        </div>
        <div className="right">
          <div className="search-wrap" style={{ width: 240 }}>
            <Icons.Search/>
            <input className="input" placeholder="부서 검색..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)}/>
          </div>
          <button className="btn">
            <Icons.Calendar size={13} sw={2}/>
            <span>2026.05.16</span>
            <Icons.ChevD size={11} sw={2}/>
          </button>
          <button className="btn btn-primary" onClick={() => setWizOpen(true)}><Icons.Hammer size={13} sw={2}/> 조직 개편</button>
        </div>
      </div>

      <div className="wd-tab-bar" style={{ marginBottom: 'var(--space-4)' }}>
        <button aria-selected={view === "tree"} onClick={() => setView("tree")}><Icons.Org size={13} sw={1.8}/> 트리</button>
        <button aria-selected={view === "directory"} onClick={() => setView("directory")}><Icons.Users size={13} sw={1.8}/> 디렉토리</button>
        <button aria-selected={view === "list"} onClick={() => setView("list")}><Icons.Receipt size={13} sw={1.8}/> 목록</button>
        <button aria-selected={view === "grid"} onClick={() => setView("grid")}><Icons.Grid size={13} sw={1.8}/> 카드</button>
      </div>

      <Card>
        {view === "tree" ? (
        <div style={{
          position: "relative",
          background: "var(--bg-sunk)",
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          minHeight: 500,
          padding: "var(--space-8)",
          overflow: "auto",
        }}>
          {/* Root */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 60 }}>
            <OrgNode title={root.name} role={root.title} count={root.count} highlight isRoot/>
          </div>
          {/* Tree fan-out */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, position: "relative" }}>
            <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", width: "100%", height: "100%" }}>
              {/* connector lines drawn via CSS instead for simplicity */}
            </svg>
            {depts.map((d, i) => {
              const matched = !searchValue || d.name.includes(searchValue);
              return (
                <div key={i} style={{ opacity: matched ? 1 : 0.2, transition: "opacity 0.2s" }}>
                  <OrgNode title={d.name} role={d.title} count={d.count}/>
                </div>
              );
            })}
          </div>
          {/* HR team highlighted */}
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 32, paddingLeft: 80 }}>
            <div style={{ opacity: (!searchValue || data.orgTree.hrTeam.name.includes(searchValue)) ? 1 : 0.2, transition: "opacity 0.2s" }}>
              <OrgNode title={data.orgTree.hrTeam.name} role={data.orgTree.hrTeam.title} count={data.orgTree.hrTeam.count} mine/>
            </div>
          </div>

          {/* Zoom controls (N+29: aria-label 의미 명시) */}
          <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            <button className="btn sm" aria-label="확대" style={{ width: 36, height: 36, borderRadius: 8, padding: 0, justifyContent: "center" }}>+</button>
            <button className="btn sm" aria-label="축소" style={{ width: 36, height: 36, borderRadius: 8, padding: 0, justifyContent: "center" }}>−</button>
            <button className="btn sm" aria-label="전체 보기 (fit)" style={{ width: 36, height: 36, borderRadius: 8, padding: 0, justifyContent: "center" }}><Icons.Eye size={12}/></button>
            <button className="btn sm" aria-label="잠금 (lock)" style={{ width: 36, height: 36, borderRadius: 8, padding: 0, justifyContent: "center" }}><Icons.Shield size={12}/></button>
          </div>
        </div>
        ) : (
          <div className="card-pad" style={{ padding: 80, textAlign: "center", color: "var(--fg-faint)" }}>
            <Icons.EmptyBox size={28}/>
            <div style={{ marginTop: 12 }}>
              {view === "directory" && "디렉토리 보기"}
              {view === "list" && "목록 보기"}
              {view === "grid" && "카드 보기"}
              {" — 데모 한계"}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function OrgNode({ title, role, count, highlight, mine, isRoot }) {
  return (
    <div style={{
      background: mine ? "oklch(95% 0.05 155)" : highlight ? "var(--accent)" : "oklch(60% 0.18 263)",
      color: mine ? "var(--success)" : "white",
      borderRadius: 10,
      padding: "10px 14px",
      minWidth: isRoot ? 200 : 130,
      maxWidth: 180,
      boxShadow: "var(--shadow-card)",
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: mine ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.18)",
        color: mine ? "var(--success)" : "white",
        display: "grid", placeItems: "center",
        fontWeight: 700, fontSize: 12,
        flexShrink: 0,
      }}>
        {title.charAt(0)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="fw-7" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>{role}</div>
        <div style={{ fontSize: 10, opacity: 0.85 }}>{count}</div>
      </div>
    </div>
  );
}

Object.assign(window, { OrgPage });
