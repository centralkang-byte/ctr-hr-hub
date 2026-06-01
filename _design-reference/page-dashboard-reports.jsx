/* global React, Icons, Avatar, Card, CardHead, ToastContext, fmtKDate */
// CTR HR Hub — Dashboard "Reports" 버전 (Stripe — analytical workflow + tabs)

const { useState: useStateRP, useContext: useCtxRP, useMemo: useMemoRP } = React;

// Real line/area chart with gridlines and dots
function LineChart({ data, width = 600, height = 140, color = "var(--accent)", colorSoft = "var(--accent-soft)", showDots = true, labels }) {
  if (!data || data.length < 2) return null;
  const padL = 32, padR = 12, padT = 12, padB = 22;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const dx = w / (data.length - 1);
  const pts = data.map((v, i) => [padL + i * dx, padT + h - ((v - min) / range) * h]);
  const linePath = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const areaPath = linePath + ` L ${padL + w} ${padT + h} L ${padL} ${padT + h} Z`;
  const gridLines = 4;

  return (
    <svg className="rp-line" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* gridlines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padT + (h / gridLines) * i;
        const v = max - (range / gridLines) * i;
        return (
          <g key={i}>
            <line className="grid" x1={padL} x2={padL + w} y1={y} y2={y} />
            <text className="label" x={padL - 6} y={y + 3} textAnchor="end">{Math.round(v)}</text>
          </g>
        );
      })}
      {/* x labels */}
      {labels && labels.map((lab, i) => (
        <text key={i} className="axis-x" x={padL + i * dx} y={height - 6} textAnchor="middle">{lab}</text>
      ))}
      <path className="area" d={areaPath} style={{ fill: colorSoft }} />
      <path className="line" d={linePath} style={{ stroke: color }} />
      {showDots && pts.map((p, i) => (
        <circle key={i} className="dot" cx={p[0]} cy={p[1]} r="3" style={{ fill: color }} />
      ))}
    </svg>
  );
}

// Real grouped bar chart (vs. previous period)
function BarsChart({ data, labels, width = 600, height = 160 }) {
  const padL = 32, padR = 12, padT = 12, padB = 24;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const max = Math.max(...data.flatMap((d) => [d.curr, d.prev])) * 1.15;
  const dx = w / data.length;
  const barW = dx * 0.32;

  return (
    <svg className="rp-line" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }}>
      {[0, 1, 2, 3].map((i) => {
        const y = padT + (h / 3) * i;
        const v = max - (max / 3) * i;
        return (
          <g key={i}>
            <line className="grid" x1={padL} x2={padL + w} y1={y} y2={y} />
            <text className="label" x={padL - 6} y={y + 3} textAnchor="end">{Math.round(v)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = padL + i * dx + dx / 2;
        const currH = (d.curr / max) * h;
        const prevH = (d.prev / max) * h;
        return (
          <g key={i}>
            <rect x={cx - barW - 1} y={padT + h - prevH} width={barW} height={prevH}
              fill="var(--bg-sunk)" stroke="var(--border-strong)" strokeWidth="1" rx="2" />
            <rect x={cx + 1} y={padT + h - currH} width={barW} height={currH}
              fill="var(--accent)" rx="2" />
            <text className="axis-x" x={cx} y={height - 8} textAnchor="middle">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut for headcount composition
function Donut({ segments, size = 120 }) {
  const total = segments.reduce((s, x) => s + x.v, 0);
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-sunk)" strokeWidth="14" />
      {segments.map((s, i) => {
        const frac = s.v / total;
        const len = frac * C;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth="14"
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        );
        offset += len;
        return el;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="20" fontWeight="700"
        fill="var(--fg)" fontFamily="var(--font-mono)" letterSpacing="-0.02em">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9.5"
        fill="var(--fg-faint)" letterSpacing="0.06em" style={{ textTransform: "uppercase" }}>총원</text>
    </svg>
  );
}

function DashboardReports({ data, setPage, openEmployee }) {
  const toast = useCtxRP(ToastContext);
  const k = data.kpis;
  const [tab, setTab] = useStateRP("overview");

  const overdue = data.approvalQueue.filter((a) => a.urgency === "overdue").length;
  const today = data.approvalQueue.filter((a) => a.urgency === "today").length;
  const delayedOnboarding = data.onboarding.filter((p) => p.status === "delay").length;
  const queue = data.approvalQueue;

  return (
    <div className="content">
      {/* Page header with date range + actions */}
      <div className="page-h" style={{ marginBottom: 12 }}>
        <div>
          <h1>HR Operations</h1>
          <div className="greet-sub">2026년 5월 17일 · 실시간</div>
        </div>
        <div className="right">
          <div className="seg">
            <button aria-pressed="true">7D</button>
            <button>30D</button>
            <button>90D</button>
            <button>YTD</button>
          </div>
          <button className="btn"><Icons.Download size={12} sw={2} /> Export</button>
          <button className="btn btn-primary"><Icons.Sparkle size={12} /> AI 요약</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rp-tabs">
        <button aria-selected={tab === "overview"} onClick={() => setTab("overview")}>
          개요
        </button>
        <button aria-selected={tab === "approvals"} onClick={() => setTab("approvals")}>
          결재 <span className="count">{queue.length}</span>
        </button>
        <button aria-selected={tab === "onboarding"} onClick={() => setTab("onboarding")}>
          온보딩 <span className="count">{delayedOnboarding}</span>
        </button>
        <button aria-selected={tab === "insights"} onClick={() => setTab("insights")}>
          인사이트 <span className="count">5</span>
        </button>
      </div>

      {tab === "overview" && <OverviewTab data={data} k={k} setPage={setPage} />}
      {tab === "approvals" && <ApprovalsTab data={data} toast={toast} />}
      {tab === "onboarding" && <OnboardingTab data={data} setPage={setPage} />}
      {tab === "insights" && <InsightsTab setPage={setPage} />}
    </div>
  );
}

function OverviewTab({ data, k, setPage }) {
  const labels7 = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <>
      {/* Hero: 2 large analytical cards */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <div className="rp-chart-card">
          <div className="h">
            <div>
              <div className="title">결재 대기 (7일)</div>
              <div className="sub">단위: 건</div>
            </div>
            <div className="right">
              <span className="chip danger">3 overdue</span>
            </div>
          </div>
          <div className="big">
            {k.pendingApprovals.value}<span className="u">건</span>
            <span className="delta up">+12 (250%)</span>
          </div>
          <LineChart
            data={k.pendingApprovals.series}
            color="var(--danger)"
            colorSoft="var(--danger-soft)"
            labels={labels7}
            width={600}
            height={140}
          />
        </div>

        <div className="rp-chart-card">
          <div className="h">
            <div>
              <div className="title">전사 인원 (30일)</div>
              <div className="sub">±변동</div>
            </div>
            <div className="right">
              <span className="chip success">stable</span>
            </div>
          </div>
          <div className="big">
            {k.headcount.value}<span className="u">명</span>
            <span className="delta" style={{ background: "var(--bg-sunk)", color: "var(--fg-muted)" }}>±0</span>
          </div>
          <LineChart
            data={k.headcount.series}
            color="var(--accent)"
            colorSoft="var(--accent-soft-2)"
            labels={["W-4", "W-3", "W-2", "W-1", "W0", "W+1", "현재"]}
            width={600}
            height={140}
          />
        </div>
      </div>

      {/* Sub KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi">
          <span className="label">이직률 (30일)</span>
          <span className="val">{k.turnoverRate.value.toFixed(1)}<span className="unit">%</span></span>
          <span className="delta flat">변동 없음</span>
        </div>
        <div className="kpi">
          <span className="label">채용 진행</span>
          <span className="val">{k.openRoles.value}<span className="unit">개</span></span>
          <span className="delta down">−1 / 7일</span>
        </div>
        <div className="kpi">
          <span className="label">연차 사용률</span>
          <span className="val">{data.leaveSummary.companyUsage}<span className="unit">%</span></span>
          <span className="delta down">−2.3%p</span>
        </div>
        <div className="kpi">
          <span className="label">평균 초과근무</span>
          <span className="val warning">1.6<span className="unit">h</span></span>
          <span className="delta up">+0.2h</span>
        </div>
      </div>

      {/* Second row: composition donut + attendance bars */}
      <div className="grid-21" style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="rp-chart-card">
          <div className="h">
            <div>
              <div className="title">출근 vs. 전 주</div>
              <div className="sub">7일 / 명</div>
            </div>
            <div className="right" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10 }}>
                <span style={{ width: 10, height: 10, background: "var(--accent)", borderRadius: 2, display: "inline-block" }} /> 이번 주
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, background: "var(--bg-sunk)", border: "1px solid var(--border-strong)", borderRadius: 2, display: "inline-block" }} /> 전 주
              </span>
            </div>
          </div>
          <BarsChart
            data={data.attendanceWeek.map((d) => ({ curr: d.present, prev: d.present - 2 - Math.floor(Math.random() * 5) }))}
            labels={data.attendanceWeek.map((d) => d.dayKr)}
            width={620}
            height={170}
          />
        </div>

        <div className="rp-chart-card">
          <div className="h">
            <div>
              <div className="title">조직 구성</div>
              <div className="sub">부서별 / 명</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Donut
              size={130}
              segments={[
                { v: 22, color: "var(--accent)" },
                { v: 14, color: "oklch(60% 0.14 200)" },
                { v: 12, color: "oklch(62% 0.15 140)" },
                { v: 10, color: "oklch(70% 0.14 75)" },
                { v: 8,  color: "oklch(60% 0.13 25)" },
                { v: 6,  color: "var(--fg-faint)" },
              ]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, flex: 1 }}>
              {[
                { lbl: "Engineering", v: 22, c: "var(--accent)" },
                { lbl: "Operations",  v: 14, c: "oklch(60% 0.14 200)" },
                { lbl: "Sales",       v: 12, c: "oklch(62% 0.15 140)" },
                { lbl: "Product",     v: 10, c: "oklch(70% 0.14 75)" },
                { lbl: "Finance",     v: 8,  c: "oklch(60% 0.13 25)" },
                { lbl: "Other",       v: 6,  c: "var(--fg-faint)" },
              ].map((d) => (
                <div key={d.lbl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, background: d.c, borderRadius: 2 }} />
                  <span style={{ flex: 1 }}>{d.lbl}</span>
                  <span className="mono" style={{ color: "var(--fg-muted)" }}>{d.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity table */}
      <Card>
        <CardHead
          icon="Inbox"
          title="최근 활동"
          sub="지난 24시간"
          action="활동 로그"
          onAction={() => setPage("alerts")}
        />
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 90 }}>시각</th>
                <th>이벤트</th>
                <th>대상</th>
                <th>처리자</th>
                <th className="right">상태</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="code">09:14</td><td>휴가 신청 제출</td><td>박지훈</td><td className="muted">시스템</td><td className="right"><span className="chip">대기</span></td></tr>
              <tr><td className="code">08:42</td><td>온보딩 체크리스트 1건 완료</td><td>이민준</td><td>김민지</td><td className="right"><span className="chip success">완료</span></td></tr>
              <tr><td className="code">08:30</td><td>출근 기록</td><td>전체 64명</td><td className="muted">자동</td><td className="right"><span className="chip success">정상</span></td></tr>
              <tr><td className="code">어제 18:22</td><td>MBO 목표 등록</td><td>정유진</td><td>본인</td><td className="right"><span className="chip info">제출</span></td></tr>
              <tr><td className="code">어제 17:05</td><td>1:1 미팅 기록</td><td>최서연 ↔ 김민지</td><td>김민지</td><td className="right"><span className="chip success">완료</span></td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function ApprovalsTab({ data, toast }) {
  const queue = data.approvalQueue;
  return (
    <>
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi">
          <span className="label">전체 대기</span>
          <span className="val">{queue.length}<span className="unit">건</span></span>
          <span className="delta up">+12 / 7일</span>
        </div>
        <div className="kpi">
          <span className="label">연체</span>
          <span className="val danger">{queue.filter((a) => a.urgency === "overdue").length}<span className="unit">건</span></span>
          <span className="delta up">+3 / 7일</span>
        </div>
        <div className="kpi">
          <span className="label">평균 처리 시간</span>
          <span className="val">2.4<span className="unit">일</span></span>
          <span className="delta up">+0.8d</span>
        </div>
        <div className="kpi">
          <span className="label">7일 승인률</span>
          <span className="val">92<span className="unit">%</span></span>
          <span className="delta down">−3pp</span>
        </div>
      </div>

      <Card>
        <CardHead icon="Inbox" title="결재 대기 큐" sub={`${queue.length}건 · 우선순위 자동 정렬`} />
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 90 }}>ID</th>
                <th>신청자 / 내용</th>
                <th>유형</th>
                <th style={{ width: 110 }}>제출일</th>
                <th style={{ width: 90 }}>경과</th>
                <th style={{ width: 100 }}>상태</th>
                <th className="right" style={{ width: 160 }}>처리</th>
              </tr>
            </thead>
            <tbody>
              {queue.slice(0, 8).map((a) => (
                <tr key={a.id} className="clickable">
                  <td className="code">{a.id}</td>
                  <td>
                    <div className="person">
                      <Avatar name={a.who} hue={(a.who.charCodeAt(0) * 31) % 360} size="sm" />
                      <div>
                        <div className="nm">{a.who} · {a.what}</div>
                        <div className="en">{a.team}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="chip accent">{a.type}</span></td>
                  <td className="code">{a.submitted}</td>
                  <td className="code" style={{ color: a.urgency === "overdue" ? "var(--danger)" : "var(--fg-muted)" }}>
                    {Math.floor((Date.now() - new Date(a.submitted).getTime()) / 86400000)}d
                  </td>
                  <td>
                    {a.urgency === "overdue" && <span className="chip danger">연체</span>}
                    {a.urgency === "today" && <span className="chip warning">오늘</span>}
                    {a.urgency !== "overdue" && a.urgency !== "today" && <span className="chip">대기</span>}
                  </td>
                  <td className="right">
                    <button className="btn sm" onClick={() => toast(`${a.who} · 반려`)}>반려</button>{" "}
                    <button className="btn sm btn-primary" onClick={() => toast(`${a.who} · 승인`)}>승인</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function OnboardingTab({ data, setPage }) {
  return (
    <Card>
      <CardHead icon="UserPlus" title="온보딩 진행" sub={`${data.onboarding.length}명`} action="전체 보기" onAction={() => setPage("onboarding")} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>입사자</th>
              <th>입사일</th>
              <th>진행률</th>
              <th style={{ width: 240 }}>Progress</th>
              <th>D-day</th>
              <th className="right">상태</th>
            </tr>
          </thead>
          <tbody>
            {data.onboarding.map((p) => (
              <tr key={p.name}>
                <td>
                  <div className="person">
                    <Avatar name={p.name} hue={p.hue} size="sm" />
                    <div className="nm">{p.name}</div>
                  </div>
                </td>
                <td className="code">{p.joinDate}</td>
                <td className="code">{Math.round((p.progress / p.total) * 100)}%</td>
                <td>
                  <div className={`progress ${p.status === "delay" ? "danger" : p.status === "done" ? "success" : ""}`}>
                    <i style={{ width: `${(p.progress / p.total) * 100}%` }} />
                  </div>
                </td>
                <td className="code">D{p.dDay >= 0 ? "+" : ""}{p.dDay}</td>
                <td className="right">
                  {p.status === "delay" && <span className="chip danger">지연</span>}
                  {p.status === "done" && <span className="chip success">완료</span>}
                  {p.status === "progress" && <span className="chip info">진행중</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InsightsTab({ setPage }) {
  return (
    <Card>
      <div className="insight-card" style={{ border: 0 }}>
        <div className="insight-narrative">
          지난주 대비 결재 적체가 <span className="hl-danger">+12건 (250%)</span> 증가했어요.
          가장 큰 원인은 <b>박지훈님의 휴가 신청</b>이 5일째 미처리된 점이에요.
          반면 온보딩은 <span className="num-up">▲ 2건</span> 완료됐고, 이직률은 <b>0.0%</b>로 안정적이에요.
        </div>
        <div className="insight-numbered danger" onClick={() => setPage("my-tasks")}>
          <div className="idx">1</div>
          <div className="body">
            <div className="lead">결재 적체가 작년 동기 대비 <b style={{ color: "var(--danger)" }}>250% 증가</b>했어요</div>
            <div className="sub">박지훈 · 정유진 · 권하은 등 <b>3명의 휴가 신청</b>이 5일 이상 미처리.</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
        <div className="insight-numbered warning" onClick={() => setPage("onboarding")}>
          <div className="idx">2</div>
          <div className="body">
            <div className="lead">신규 입사자 <b>5명의 온보딩이 평균 80일 지연</b>됐어요</div>
            <div className="sub">이민준 (D-12), 오승현 (D-74), 윤지호 (D-102).</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
        <div className="insight-numbered accent" onClick={() => setPage("leave")}>
          <div className="idx">3</div>
          <div className="body">
            <div className="lead">연말 연차 미소진 예상이 <b>86.9%</b>에 달해요</div>
            <div className="sub">전사 평균 잔여 10.3일. 강제 소진 캠페인 검토 필요.</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, { DashboardReports });
