/* global React, Icons, Card, CardHead */
// CTR HR Hub — 다른 페이지 플레이스홀더

function PlaceholderPage({ title, sub, icon }) {
  const Icon = Icons[icon] || Icons.Doc;
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>{title}</h1>
          <div className="greet-sub">{sub}</div>
        </div>
      </div>
      <Card>
        <div className="empty" style={{ padding: "var(--space-10)" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center" }}>
            <Icon size={26}/>
          </div>
          <div className="em-title fw-7" style={{ fontSize: 15, color: "var(--fg-muted)" }}>이 페이지는 프로토타입에 포함돼 있어요</div>
          <div className="small faint" style={{ maxWidth: 380 }}>
            대시보드 · 나의 업무 · 직원 관리 · 직원 상세 · 근태 관리 · 휴가/휴직 관리 · 온보딩/오프보딩 페이지가 실제로 작동해요.
          </div>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { PlaceholderPage });
