/* global React, Icons, Avatar, Card, ToastContext, fmtKDate, dDayLabel, NewTaskDrawer */
// CTR HR Hub — 나의 업무 (Workday My Inbox)

const { useState: useStateMW, useMemo: useMemoMW, useContext: useCtxMW } = React;

const TASK_TYPE_HUE = {
  성과: 290, 휴가: 230, 급여: 60, 온보딩: 145, 오프보딩: 25, 출장: 200,
};
const TASK_TYPE_ICON = {
  성과: "Target", 휴가: "Calendar", 급여: "Wallet", 온보딩: "UserPlus", 오프보딩: "Logout", 출장: "ArrowR",
};

function MyTasksPage({ data }) {
  const toast = useCtxMW(ToastContext);
  const [tab, setTab] = useStateMW("todo");
  const [phase, setPhase] = useStateMW("ongoing");
  const [typeFilter, setTypeFilter] = useStateMW("전체");
  const [sort, setSort] = useStateMW("priority");
  const [tasks, setTasks] = useStateMW(data.myTasks);
  const [newOpen, setNewOpen] = useStateMW(false);

  const counts = useMemoMW(() => {
    const c = { 전체: 0, 휴가: 0, 급여: 0, 온보딩: 0, 오프보딩: 0, 성과: 0, 출장: 0 };
    tasks.filter((t) => phase === "ongoing" ? !t.done : t.done).forEach((t) => {
      c.전체 += 1;
      if (c[t.type] != null) c[t.type] += 1;
    });
    return c;
  }, [tasks, phase]);

  const open = tasks.filter((t) => !t.done);
  const doneCount = tasks.filter((t) => t.done).length;
  const overdue = open.filter((t) => t.dDay < 0).length;
  const soon = open.filter((t) => t.dDay >= 0 && t.dDay <= 7).length;
  const overdueApprovals = data.approvalQueue.filter((a) => a.urgency === "overdue").length;

  const visible = useMemoMW(() => {
    let list = tasks.filter((t) => phase === "ongoing" ? !t.done : t.done);
    if (typeFilter !== "전체") list = list.filter((t) => t.type === typeFilter);
    if (sort === "priority") list = [...list].sort((a, b) => a.dDay - b.dDay);
    if (sort === "recent")   list = [...list].sort((a, b) => b.dDay - a.dDay);
    return list;
  }, [tasks, phase, typeFilter, sort]);

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>나의 업무</h1>
          <div className="greet-sub">개인 업무와 결재 요청을 한곳에서 처리해요.</div>
          <div className="wd-status-chips">
            {overdue > 0 ? (
              <span className="sc danger"><span className="dot" /><b>{overdue}건</b> 마감 지남</span>
            ) : (
              <span className="sc zero"><span className="dot" /><b>0건</b> 마감 지남</span>
            )}
            {soon > 0 ? (
              <span className="sc warn"><span className="dot" /><b>{soon}건</b> 7일 안 마감</span>
            ) : (
              <span className="sc zero"><span className="dot" /><b>0건</b> 7일 안 마감</span>
            )}
            {data.approvalQueue.length > 0 ? (
              <span className="sc accent"><span className="dot" /><b>{data.approvalQueue.length}건</b> 결재 대기 {overdueApprovals > 0 && <span style={{ opacity: 0.7 }}>({overdueApprovals} 연체)</span>}</span>
            ) : (
              <span className="sc zero"><span className="dot" /><b>0건</b> 결재 대기</span>
            )}
            <span className="sc zero"><span className="dot" />완료 <b>{doneCount}건</b></span>
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 내보내기</button>
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icons.Plus size={13} sw={2.2} /> 새 업무</button>
        </div>
      </div>

      {/* Removed wd-stat-strip (replaced by inline chips above) */}

      {/* ── Main tabs ─────────────────── */}
      <div className="wd-tab-bar">
        <button aria-selected={tab === "todo"} onClick={() => setTab("todo")}>
          <Icons.Check size={13} sw={1.8} /> 내 할 일
          <span className="count">{open.length}</span>
        </button>
        <button aria-selected={tab === "approvals"} onClick={() => setTab("approvals")}>
          <Icons.Inbox size={13} sw={1.8} /> 승인 요청
          <span className="count">{data.approvalQueue.length}</span>
        </button>
      </div>

      {tab === "todo" && (
        <>
          <div className="wd-result-toolbar">
            <div className="seg">
              <button aria-pressed={phase === "ongoing"} onClick={() => setPhase("ongoing")}>
                진행 중 ({tasks.filter((t) => !t.done).length})
              </button>
              <button aria-pressed={phase === "done"} onClick={() => setPhase("done")}>
                완료 ({doneCount})
              </button>
            </div>
            <span className="count-display"><b>{visible.length}</b>건</span>
            <div className="right">
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: "7px 12px", fontSize: 12 }}>
                <option value="priority">우선순위</option>
                <option value="recent">최신순</option>
              </select>
            </div>
          </div>

          {/* Type filter pills */}
          <div className="pill-tabs" style={{ marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
            {["전체", "휴가", "급여", "온보딩", "오프보딩", "성과"].map((t) => (
              <button key={t} aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>
                {t} <span className="n tnum">{counts[t] || 0}</span>
              </button>
            ))}
          </div>

          {/* Task list (Workday action-card pattern) */}
          {visible.length === 0 ? (
            <div className="empty standalone">
              <Icons.EmptyBox size={28} />
              <div className="em-title">진행중인 업무가 없습니다</div>
            </div>
          ) : (
            <div className="wd-action-stack">
              {visible.map((t) => {
                const isOverdue = t.dDay < 0;
                const isSoon = t.dDay >= 0 && t.dDay <= 7;
                const hue = TASK_TYPE_HUE[t.type] || 268;
                const IconC = Icons[TASK_TYPE_ICON[t.type] || "Inbox"];
                return (
                  <div
                    key={t.id}
                    className={`wd-action-card ${isOverdue ? "overdue" : isSoon ? "warn" : ""}`}
                    onClick={() => toast(`${t.title} 열기`)}>
                    <div className="ico" style={{ background: `oklch(94% 0.05 ${hue})`, color: `oklch(45% 0.16 ${hue})` }}>
                      <IconC size={18} sw={1.8} />
                    </div>
                    <div className="body">
                      <div className="title">{t.title}</div>
                      <div className="meta">
                        <span style={{ color: `oklch(45% 0.16 ${hue})`, fontWeight: 600 }}>{t.type}</span>
                        <span className="sep">·</span>
                        <span>{t.sub}</span>
                        {t.team && t.team !== "—" && (
                          <>
                            <span className="sep">·</span>
                            <span>{t.team}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="right">
                      <span className="chip-due">{dDayLabel(t.dDay)}</span>
                      <button className="btn sm btn-primary" onClick={(e) => { e.stopPropagation(); toast(`${t.title} 처리`); }}>
                        처리
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "approvals" && (
        <Card>
          <div className="card-head">
            <span className="title">내가 결재해야 할 요청</span>
            <span className="sub">{data.approvalQueue.length}건 대기</span>
          </div>
          <div className="list">
            {data.approvalQueue.map((a) => (
              <div key={a.id} className="appr-row">
                <Avatar name={a.who} hue={(a.who.charCodeAt(0) * 31) % 360} />
                <div className="grow">
                  <div className="title fw-7">{a.who} · {a.what}</div>
                  <div className="meta">
                    <span className="chip accent">{a.type}</span>
                    <span>{a.team}</span>
                    <span className="sep">·</span>
                    <span className="mono small">{a.id}</span>
                    <span className="sep">·</span>
                    <span>{fmtKDate(a.submitted)}</span>
                  </div>
                </div>
                {a.urgency === "overdue" && <span className="chip danger">연체</span>}
                {a.urgency === "today" && <span className="chip warning">오늘 처리</span>}
                {a.urgency !== "overdue" && a.urgency !== "today" && <span className="chip">대기</span>}
                <button className="btn sm btn-danger" onClick={() => toast(`${a.who} 반려`)}>반려</button>
                <button className="btn sm btn-primary" onClick={() => toast(`${a.who} 승인`)}>승인</button>
              </div>
            ))}
          </div>
        </Card>
      )}
      <NewTaskDrawer open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

Object.assign(window, { MyTasksPage });
