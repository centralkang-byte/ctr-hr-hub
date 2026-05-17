/* global React, Icons, Avatar, ToastContext, fmtKDate */
// CTR HR Hub — 활동 피드 (Workday Inbox 레이아웃: 리스트 + 상세)

const { useState: useStateAL, useMemo: useMemoAL, useContext: useCtxAL } = React;

const CATEGORY_META = {
  채용:   { cls: "recruit", label: "채용" },
  근태:   { cls: "attend",  label: "근태" },
  시스템: { cls: "system",  label: "시스템" },
  승인:   { cls: "approve", label: "승인" },
  성과:   { cls: "perf",    label: "성과" },
};

function AlertsPage({ data }) {
  const toast = useCtxAL(ToastContext);
  const [tab, setTab] = useStateAL("전체");
  const [read, setRead] = useStateAL("전체");
  const [items, setItems] = useStateAL(data.notifications);
  const [selectedId, setSelectedId] = useStateAL(data.notifications[0]?.id);

  const counts = useMemoAL(() => {
    const c = { 전체: items.length, 미읽음: 0 };
    items.forEach((n) => {
      c[n.category] = (c[n.category] || 0) + 1;
      if (n.unread) c.미읽음 += 1;
    });
    return c;
  }, [items]);

  const visible = useMemoAL(() => {
    return items.filter((n) => {
      if (tab !== "전체" && n.category !== tab) return false;
      if (read === "미읽음" && !n.unread) return false;
      if (read === "읽음" && n.unread) return false;
      return true;
    });
  }, [items, tab, read]);

  // Group by date for headers
  const grouped = useMemoAL(() => {
    const map = new Map();
    visible.forEach((n) => {
      if (!map.has(n.date)) map.set(n.date, []);
      map.get(n.date).push(n);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const selected = useMemoAL(() => {
    return items.find((n) => n.id === selectedId) || visible[0] || null;
  }, [selectedId, items, visible]);

  const handleSelect = (n) => {
    setSelectedId(n.id);
    if (n.unread) {
      setItems((arr) => arr.map((x) => x.id === n.id ? { ...x, unread: false } : x));
    }
  };

  const readAll = () => {
    setItems((arr) => arr.map((n) => ({ ...n, unread: false })));
    toast("전체 읽음 처리");
  };

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>활동 피드</h1>
          <div className="greet-sub">결재, 채용, 근태, 성과, 시스템 알림을 한 곳에서 확인해요.</div>
        </div>
        <div className="right">
          <span className="chip" style={{
            background: "var(--wd-orange-soft, var(--warning-soft))",
            color: "var(--wd-orange-ink, oklch(45% 0.13 75))",
            fontWeight: 600,
          }}>
            {counts.미읽음} 미읽음
          </span>
          <button className="btn" onClick={readAll}>
            <Icons.Check size={13} sw={2} /> 전체 읽기
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="wd-tab-bar" style={{ marginBottom: "var(--space-3)" }}>
        {["전체", "승인", "성과", "근태", "채용", "시스템"].map((t) => (
          <button key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {t} {counts[t] != null && <span className="count">{counts[t] || 0}</span>}
          </button>
        ))}
      </div>

      {/* Read filter pills */}
      <div className="wd-result-toolbar" style={{ marginBottom: "var(--space-3)" }}>
        <div className="pill-tabs">
          {["전체", "미읽음", "읽음"].map((r) => (
            <button key={r} aria-pressed={read === r} onClick={() => setRead(r)}>{r}</button>
          ))}
        </div>
        <span className="count-display" style={{ marginLeft: "auto" }}>
          <b>{visible.length}</b>건
        </span>
      </div>

      {/* Inbox layout */}
      <div className="wd-inbox-layout">
        {/* Left: list */}
        <div className="wd-inbox-list">
          <div className="ilist-h">
            <Icons.Inbox size={12} sw={2} />
            <span>받은 알림 ({visible.length})</span>
          </div>
          <div className="ilist-scroll">
            {grouped.length === 0 ? (
              <div className="empty" style={{ padding: "var(--space-8)" }}>
                <Icons.EmptyBox size={28} />
                <div className="em-title">알림이 없습니다</div>
              </div>
            ) : (
              grouped.map(([date, list]) => (
                <React.Fragment key={date}>
                  <div className="day-h">{fmtKDate(date)} · {list.length}건</div>
                  {list.map((n) => {
                    const meta = CATEGORY_META[n.category] || { cls: "system", label: n.category };
                    return (
                      <div
                        key={n.id}
                        className={`il-row ${n.unread ? "unread" : ""} ${selected?.id === n.id ? "selected" : ""}`}
                        onClick={() => handleSelect(n)}>
                        <span className="dot" />
                        <div className="body">
                          <div className="top">
                            <span className={`cat-pill ${meta.cls}`}>{meta.label}</span>
                            <span className="kind">{n.kind}</span>
                          </div>
                          <div className="snippet">{n.text}</div>
                          <div className="when">{n.date.slice(5)}</div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="wd-inbox-detail">
          {!selected ? (
            <div className="empty-detail">
              <Icons.Inbox size={40} sw={1.4} />
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-muted)" }}>알림을 선택하세요</div>
              <div style={{ fontSize: 12 }}>좌측 목록에서 항목을 클릭하면 상세 정보가 표시돼요.</div>
            </div>
          ) : (
            <>
              <div className="id-h">
                <span className={`cat-pill ${(CATEGORY_META[selected.category] || { cls: "system" }).cls}`}>
                  {selected.category}
                </span>
                <span className="when">{fmtKDate(selected.date)}</span>
              </div>

              <h2>{selected.kind}</h2>
              <div className="body-text">{selected.text}</div>

              <div className="meta-grid">
                <div>
                  <div className="mg-k">ID</div>
                  <div className="mg-v mono">{selected.id}</div>
                </div>
                <div>
                  <div className="mg-k">채널</div>
                  <div className="mg-v mono">{selected.channel}</div>
                </div>
                <div>
                  <div className="mg-k">상태</div>
                  <div className="mg-v">
                    {selected.unread ? (
                      <span style={{ color: "var(--wd-orange-ink, oklch(45% 0.13 75))", fontWeight: 600 }}>미읽음</span>
                    ) : (
                      <span style={{ color: "var(--fg-muted)" }}>읽음</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="actions-row">
                <button className="btn btn-primary" onClick={() => toast("바로가기")}>
                  바로가기 <Icons.ArrowR size={12} sw={2} />
                </button>
                <button className="btn" onClick={() => toast("보관 처리")}>
                  <Icons.EmptyBox size={13} sw={2} /> 보관
                </button>
                <button className="btn" onClick={() => toast("스누즈")}>
                  <Icons.Clock size={13} sw={2} /> 나중에
                </button>
                <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => toast("삭제")}>
                  <Icons.Close size={13} sw={2} /> 삭제
                </button>
              </div>

              <div className="activity-section">
                <div className="as-h">처리 이력</div>
                {(() => {
                  // 알림 ID·카테고리·채널 기반 결정론적 타임라인
                  const seed = parseInt(selected.id.replace(/\D/g, ""), 10) || 0;
                  const baseHr = 9 + (seed % 9);
                  const baseMin = (seed * 7) % 60;
                  const fmt = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                  const events = [
                    { time: fmt(baseHr, baseMin), actor: "시스템", text: <>알림을 생성했어요 (<span className="mono">{selected.channel}</span>)</> },
                    { time: fmt(baseHr, baseMin + 1 > 59 ? baseMin + 1 - 60 : baseMin + 1),
                      actor: "라우터", text: <>수신자 <b>한지영</b>에게 라우팅 (소요 <span className="mono">{120 + seed % 200}ms</span>)</> },
                  ];
                  if (selected.category === "결재" || selected.category === "승인") {
                    events.push({ time: fmt(baseHr, (baseMin + 5) % 60), actor: "결재선", text: <><b>이정환</b> · <b>박서연</b> · <b>최서연</b> 결재 라인 활성</> });
                  }
                  if (selected.category === "근태") {
                    events.push({ time: fmt(baseHr, (baseMin + 3) % 60), actor: "감사 로그", text: <>출근/지각 기록 검증 — 위반 사항 없음</> });
                  }
                  if (selected.category === "채용") {
                    events.push({ time: fmt(baseHr, (baseMin + 8) % 60), actor: "ATS 동기화", text: <>외부 ATS 와 동기화 완료 (Greenhouse)</> });
                  }
                  if (selected.category === "성과") {
                    events.push({ time: fmt(baseHr, (baseMin + 4) % 60), actor: "사이클 엔진", text: <>2026 H1 사이클에 연결됨</> });
                  }
                  if (!selected.unread) {
                    events.push({ time: "방금 전", actor: "사용자", text: <><b>한지영</b>이 읽음 처리</> });
                  } else {
                    events.push({ time: "—", actor: "대기 중", text: <>아직 읽음 처리되지 않았어요</>, pending: true });
                  }
                  return events.map((e, i) => (
                    <div key={i} className="activity-row" style={e.pending ? { opacity: 0.55 } : null}>
                      <span className="ar-time">{e.time}</span>
                      <span className="ar-text">
                        <b style={{ color: "var(--accent-ink)" }}>{e.actor}</b>
                        <span style={{ color: "var(--fg-faint)", margin: "0 6px" }}>·</span>
                        {e.text}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AlertsPage });
