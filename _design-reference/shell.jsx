/* global React, Icons, Avatar */
// CTR HR Hub — 사이드바 + 톱바

const { useState: useStateS } = React;

const NAV = [
  { id: "dashboard",  label: "대시보드", icon: "Grid",  flat: true },
  { id: "alerts",     label: "알림",     icon: "Bell",  flat: true, badge: 46 },
  {
    group: "나의 공간",
    groupIcon: "User",
    id: "g-my",
    items: [
      { id: "my-tasks",      label: "나의 업무",     icon: "Inbox",    badge: 98 },
      { id: "attendance-my", label: "출퇴근",        icon: "Clock"    },
      { id: "leave-req",     label: "휴가/휴직",     icon: "Calendar" },
      { id: "payslip-my",    label: "급여명세서",   icon: "Receipt"  },
      { id: "benefits-my",   label: "복리후생",       icon: "Gift"     },
      { id: "goals-my",      label: "평가/성장",      icon: "Target"   },
      { id: "edu-my",        label: "내 교육",         icon: "Book"     },
      { id: "kudos-my",      label: "칭찬/인정",      icon: "Heart"    },
      { id: "docs-my",       label: "문서/증명서",   icon: "Doc"      },
      { id: "my-profile",    label: "내 프로필",       icon: "User"     },
    ],
  },
  {
    group: "팀 관리",
    groupIcon: "Users",
    id: "g-team",
    items: [
      { id: "team-hub",     label: "팀 현황",     icon: "Chart"    },
      { id: "team-attn",    label: "팀 근태/휴가", icon: "Clock"    },
      { id: "team-goals",   label: "팀 목표/성과", icon: "Target"   },
      { id: "team-1on1",    label: "1:1 미팅",   icon: "Inbox"    },
      { id: "team-deleg",   label: "업무 위임",   icon: "Shield"   },
    ],
  },
  {
    group: "인사 관리",
    groupIcon: "Building",
    id: "g-hr",
    open: true,
    items: [
      { id: "employees",  label: "직원 관리",        icon: "Users"    },
      { id: "org",        label: "조직 관리",        icon: "Org"      },
      { id: "attendance", label: "근태 관리",        icon: "Clock"    },
      { id: "leave",      label: "휴가/휴직 관리",   icon: "Calendar" },
      { id: "onboarding", label: "온보딩/오프보딩", icon: "UserPlus" },
      { id: "discipline", label: "징계/포상",        icon: "Hammer"   },
      { id: "compliance", label: "컴플라이언스",    icon: "Shield"   },
    ],
  },
  {
    group: "채용",
    groupIcon: "UserPlus",
    id: "g-recruit",
    items: [
      { id: "jobs",        label: "채용 공고",     icon: "Briefcase" },
      { id: "recruit-dash",label: "채용 대시보드", icon: "Chart"    },
      { id: "kanban",      label: "칸반 보드",     icon: "Grid"     },
      { id: "talent-pool", label: "인재 풀",       icon: "Trophy"   },
      { id: "internal",    label: "사내 채용",     icon: "Building" },
    ],
  },
  {
    group: "성과/보상",
    groupIcon: "Target",
    id: "g-perf",
    items: [
      { id: "perf-cycle",  label: "성과 관리",    icon: "Target"   },
      { id: "calibration", label: "캘리브레이션", icon: "Sparkle"  },
      { id: "comp",        label: "보상 관리",    icon: "Wallet"   },
      { id: "offcycle",    label: "비정기 조정",  icon: "Sparkle"  },
      { id: "benefits",    label: "복리후생 관리", icon: "Gift"     },
    ],
  },
  {
    group: "급여",
    groupIcon: "Wallet",
    id: "g-pay",
    items: [
      { id: "payroll",      label: "급여 관리",     icon: "Grid"   },
      { id: "manual-adj",   label: "수동 조정",     icon: "Sparkle"},
      { id: "global-pay",   label: "글로벌 급여",   icon: "Globe"  },
      { id: "payroll-sim",  label: "급여 시뮬레이션", icon: "Chart" },
      { id: "transfers",    label: "이체 관리",     icon: "Wallet" },
      { id: "yearend",      label: "연말정산",      icon: "Doc"    },
    ],
  },
  {
    group: "인사이트",
    groupIcon: "Chart",
    id: "g-insights",
    items: [
      { id: "i-exec",     label: "Executive Summary", icon: "Grid"     },
      { id: "i-people",   label: "인력 분석",         icon: "Users"    },
      { id: "i-pay",      label: "급여 분석",         icon: "Wallet"   },
      { id: "i-perf",     label: "성과 분석",         icon: "Target"   },
      { id: "i-attn",     label: "근태 분석",         icon: "Clock"    },
      { id: "i-churn",    label: "이직 예측",         icon: "Alert"    },
      { id: "i-health",   label: "팀 헬스",           icon: "Heart"    },
      { id: "i-ai",       label: "AI 리포트",         icon: "Sparkle"  },
    ],
  },
  {
    group: "설정",
    groupIcon: "Gear",
    id: "g-settings",
    items: [
      { id: "settings",   label: "설정",         icon: "Gear"   },
    ],
  },
];

const PAGE_GROUP = {};
NAV.forEach((n) => {
  if (n.items) n.items.forEach((it) => { PAGE_GROUP[it.id] = n.id; });
});

function Sidebar({ page, setPage, me, collapsed, onToggleCollapse, style = "default" }) {
  if (style === "modern") return <SidebarModern page={page} setPage={setPage} me={me} />;
  return <SidebarClassic page={page} setPage={setPage} me={me} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
}

function SidebarClassic({ page, setPage, me, collapsed, onToggleCollapse }) {
  const [openGroups, setOpenGroups] = useStateS(() => {
    const s = new Set(["g-hr"]);
    NAV.forEach((n) => { if (n.open) s.add(n.id); });
    const cur = PAGE_GROUP[page];
    if (cur) s.add(cur);
    return s;
  });
  const toggle = (id) => {
    setOpenGroups((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="mark">C</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="name">CTR HR Hub</div>
          <div className="sub">통합 인사관리 시스템</div>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2, paddingBottom: 8 }}>
        {NAV.map((n) => {
          if (n.flat) {
            const Icon = Icons[n.icon];
            const active = page === n.id;
            return (
              <button key={n.id} className="sb-item flat" aria-current={active ? "page" : undefined} onClick={() => setPage(n.id)}>
                <Icon className="ico"/>
                <span className="lbl">{n.label}</span>
                {n.badge && <span className="badge">{n.badge}</span>}
              </button>
            );
          }
          const GroupIcon = Icons[n.groupIcon];
          const isOpen = openGroups.has(n.id) || collapsed;
          const renderItems = () => {
            const blocks = [];
            let curSection = null;
            n.items.forEach((it) => {
              if (it.section && it.section !== curSection) {
                curSection = it.section;
                blocks.push(<div key={`sec-${curSection}`} className="sb-section-label">{curSection}</div>);
              }
              const Icon = Icons[it.icon];
              const active = page === it.id;
              blocks.push(
                <button key={it.id} className="sb-item" aria-current={active ? "page" : undefined} onClick={() => setPage(it.id)}>
                  <Icon className="ico"/>
                  <span className="lbl">{it.label}</span>
                  {it.badge && <span className="badge">{it.badge}</span>}
                </button>
              );
            });
            return blocks;
          };
          return (
            <div key={n.id} className="sb-group">
              <button className="sb-group-h" aria-expanded={isOpen} onClick={() => toggle(n.id)}>
                <GroupIcon className="ico"/>
                <span className="lbl">{n.group}</span>
                <Icons.ChevD className="caret"/>
              </button>
              {isOpen && renderItems()}
            </div>
          );
        })}
      </div>

      <button className="sb-collapse" onClick={onToggleCollapse}>
        <Icons.ChevL size={14}/>
        <span className="lbl">접기</span>
      </button>
      <div className="sb-foot">
        <Avatar initials={me.avatar} hue={me.avatarHue}/>
        <div className="who">
          <div className="name">{me.name}</div>
          <div className="sub">{me.role}</div>
        </div>
        <button className="tb-icon" title="로그아웃"><Icons.Logout size={14}/></button>
      </div>
    </aside>
  );
}

// ── Modern: rail (60px) + slide panel ─────────────────────────
function SidebarModern({ page, setPage, me }) {
  const groups = NAV.filter((n) => !n.flat);
  const flats = NAV.filter((n) => n.flat);
  const initial = PAGE_GROUP[page] || groups[0]?.id;
  const [activeGroup, setActiveGroup] = useStateS(initial);

  React.useEffect(() => {
    const g = PAGE_GROUP[page];
    if (g) setActiveGroup(g);
  }, [page]);

  const activeGroupDef = groups.find((n) => n.id === activeGroup) || groups[0];

  return (
    <>
      <aside className="sb">
        <div className="sb-brand">
          <div className="mark">C</div>
        </div>
        <div className="mr-rail">
          {flats.map((n) => {
            const Icon = Icons[n.icon];
            const active = page === n.id;
            return (
              <button key={n.id} className={`mr-rail-item ${active ? "active" : ""}`} onClick={() => setPage(n.id)}>
                <Icon size={20} sw={1.8} />
                {n.badge && <span className="badge">{n.badge}</span>}
                <span className="mr-tip">{n.label}</span>
              </button>
            );
          })}
          <div style={{ height: 1, width: 28, background: "var(--border)", margin: "8px 0" }} />
          {groups.map((g) => {
            const Icon = Icons[g.groupIcon];
            const active = activeGroup === g.id;
            return (
              <button key={g.id} className={`mr-rail-item ${active ? "active" : ""}`} onClick={() => setActiveGroup(g.id)}>
                <Icon size={20} sw={1.8} />
                <span className="mr-tip">{g.group}</span>
              </button>
            );
          })}
        </div>
        <div className="sb-foot">
          <Avatar initials={me.avatar} hue={me.avatarHue} size="sm" />
        </div>
      </aside>

      {activeGroupDef && (
        <aside className="mr-panel">
          <div className="mp-h">
            {(() => { const I = Icons[activeGroupDef.groupIcon]; return <I size={15} />; })()}
            <span className="lead">{activeGroupDef.group}</span>
          </div>
          {(() => {
            let curSection = null;
            const blocks = [];
            (activeGroupDef.items || []).forEach((it) => {
              if (it.section && it.section !== curSection) {
                curSection = it.section;
                blocks.push(<div key={`sec-${curSection}`} className="mp-section">{curSection}</div>);
              }
              const Icon = Icons[it.icon];
              const active = page === it.id;
              blocks.push(
                <button key={it.id} className="mp-item" aria-current={active ? "page" : undefined} onClick={() => setPage(it.id)}>
                  <Icon className="ico" />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                  {it.badge && <span className="badge">{it.badge}</span>}
                </button>
              );
            });
            return blocks;
          })()}
        </aside>
      )}
    </>
  );
}

const PAGE_LABELS = {
  dashboard: ["홈", "대시보드"],
  alerts:    ["홈", "알림"],
  "my-tasks":     ["홈", "my", "나의 업무"],
  "attendance-my":["홈", "my", "출퇴근"],
  "leave-req":    ["홈", "my", "휴가 신청"],
  "loa-req":      ["홈", "my", "휴직 신청"],
  "payslip-my":   ["홈", "my", "급여명세서"],
  "benefits-my":  ["홈", "my", "복리후생"],
  "goals-my":     ["홈", "my", "목표/평가"],
  "qrev-my":      ["홈", "my", "분기 리뷰"],
  "skills-my":    ["홈", "my", "역량 자기평가"],
  "edu-my":       ["홈", "my", "내 교육"],
  "kudos-my":     ["홈", "my", "칭찬/인정"],
  "docs-my":      ["홈", "my", "문서/증명서"],
  "my-profile":   ["홈", "my", "내 프로필"],
  "my-onboard":   ["홈", "my", "나의 온보딩"],
  "team-hub":     ["홈", "팀", "팀 현황"],
  "team-attn":    ["홈", "팀", "팀 근태/휴가"],
  "team-goals":   ["홈", "팀", "팀 목표/성과"],
  "team-1on1":    ["홈", "팀", "1:1 미팅"],
  "team-deleg":   ["홈", "팀", "업무 위임"],
  employees:  ["홈", "직원 관리"],
  "employee-detail": ["홈", "직원 관리", "프로필"],
  org:        ["홈", "조직 관리"],
  attendance: ["홈", "근태 관리"],
  leave:      ["홈", "휴가/휴직 관리"],
  onboarding: ["홈", "온보딩/오프보딩"],
  discipline: ["홈", "징계/포상"],
  jobs:           ["홈", "채용", "채용 공고"],
  "recruit-dash": ["홈", "채용", "채용 대시보드"],
  kanban:         ["홈", "채용", "칸반 보드"],
  "talent-pool":  ["홈", "채용", "인재 풀"],
  internal:       ["홈", "채용", "사내 채용"],
  "perf-cycle":   ["홈", "성과/보상", "성과 관리"],
  calibration:    ["홈", "성과/보상", "캘리브레이션"],
  comp:           ["홈", "성과/보상", "보상 관리"],
  offcycle:       ["홈", "성과/보상", "비정기 조정"],
  benefits:       ["홈", "성과/보상", "복리후생 관리"],
  payroll:        ["홈", "급여", "급여 관리"],
  "manual-adj":   ["홈", "급여", "수동 조정"],
  "global-pay":   ["홈", "급여", "글로벌 급여"],
  "payroll-sim":  ["홈", "급여", "급여 시뮬레이션"],
  transfers:      ["홈", "급여", "이체 관리"],
  yearend:        ["홈", "급여", "연말정산"],
  "i-exec":     ["홈", "인사이트", "Executive Summary"],
  "i-people":   ["홈", "인사이트", "인력 분석"],
  "i-pay":      ["홈", "인사이트", "급여 분석"],
  "i-perf":     ["홈", "인사이트", "성과 분석"],
  "i-attn":     ["홈", "인사이트", "근태 분석"],
  "i-churn":    ["홈", "인사이트", "이직 예측"],
  "i-health":   ["홈", "인사이트", "팀 헬스"],
  "i-ai":       ["홈", "인사이트", "AI 리포트"],
  compliance: ["홈", "설정", "컴플라이언스"],
  settings:   ["홈", "설정"],
};

function Topbar({ page, data, setPage, onSearch, onOpenLeave }) {
  const crumb = PAGE_LABELS[page] || ["홈"];
  const [bellOpen, setBellOpen] = useStateS(false);

  const notifications = (data && data.notifications) || [];
  const unreadCount = notifications.filter((n) => n.unread).length;
  const recent = notifications.slice(0, 5);

  React.useEffect(() => {
    if (!bellOpen) return;
    const handler = (e) => {
      if (!e.target.closest(".wd-bell-popover") && !e.target.closest("[data-bell-trigger]")) {
        setBellOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [bellOpen]);

  return (
    <header className="tb">
      <div className="tb-crumb">
        <button className="tb-mobile-toggle" onClick={() => {
          const app = document.querySelector(".app");
          if (app) app.setAttribute("data-sb", app.getAttribute("data-sb") === "mobile-open" ? "expanded" : "mobile-open");
        }} title="메뉴">
          <Icons.Grid size={16} />
        </button>
        {crumb.map((c, i) => (
          <React.Fragment key={i}>
            <span className={i === crumb.length - 1 ? "here" : ""}>{c}</span>
            {i < crumb.length - 1 && <span className="sep">/</span>}
          </React.Fragment>
        ))}
      </div>
      <button className="tb-search" onClick={onSearch}>
        <Icons.Search size={14}/>
        <span>검색...</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="tb-right">
        <button className="btn sm" onClick={() => window.postMessage({ type: "__activate_edit_mode" }, "*")} title="디자인 토글 열기">
          <Icons.Sparkle size={13}/> Tweaks
        </button>
        <button className="tb-corp">
          <Icons.Building size={14}/>
          <span>CTR</span>
          <Icons.ChevD size={12}/>
        </button>
        <button className="tb-icon" title="언어">
          <Icons.Globe size={16}/>
        </button>
        <button className="tb-icon" title="휴가 신청" onClick={onOpenLeave}>
          <Icons.Plus size={16}/>
        </button>
        <div style={{ position: "relative" }}>
          <button
            className="tb-icon"
            title="알림"
            data-bell-trigger
            style={{ position: "relative" }}
            onClick={(e) => { e.stopPropagation(); setBellOpen((v) => !v); }}>
            <Icons.Bell size={16}/>
            {unreadCount > 0 && <span className="dot">{unreadCount}</span>}
          </button>
          {bellOpen && (
            <div className="wd-bell-popover">
              <div className="bp-h">
                <div className="bp-h-title">
                  활동 피드
                  {unreadCount > 0 && <span className="bp-badge">{unreadCount}</span>}
                </div>
                <button
                  className="bp-h-action"
                  onClick={() => { setBellOpen(false); setPage && setPage("alerts"); }}>
                  전체 보기 →
                </button>
              </div>
              <div className="bp-list">
                {recent.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--fg-faint)", fontSize: 12.5 }}>
                    최근 알림이 없습니다
                  </div>
                ) : recent.map((n) => {
                  const cat = n.category === "채용" ? "recruit" :
                              n.category === "근태" ? "attend" :
                              n.category === "성과" ? "perf" :
                              n.category === "승인" ? "approve" : "system";
                  return (
                    <div
                      key={n.id}
                      className={`bp-row ${n.unread ? "unread" : ""}`}
                      onClick={() => { setBellOpen(false); setPage && setPage("alerts"); }}>
                      <span className="bp-dot" />
                      <div className="bp-body">
                        <div className="bp-top">
                          <span className={`bp-cat ${cat}`}>{n.category}</span>
                          <span className="bp-kind">{n.kind}</span>
                        </div>
                        <div className="bp-text">{n.text}</div>
                        <div className="bp-when">{n.date.replace(/-/g, ".").slice(5)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bp-foot">
                <button
                  className="btn sm btn-ghost"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => { setBellOpen(false); setPage && setPage("alerts"); }}>
                  전체 활동 피드 열기
                </button>
              </div>
            </div>
          )}
        </div>
        <Avatar initials="한" hue={268} size="sm"/>
      </div>
    </header>
  );
}

Object.assign(window, { Sidebar, Topbar });
