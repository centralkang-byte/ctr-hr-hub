/* global React, Icons, Avatar, Card, CardHead, Sparkline, ToastContext, fmtKDate, dDayLabel */
// CTR HR Hub — 대시보드 (HR_ADMIN) · 액션-퍼스트 재설계

const { useContext: useCtxDash } = React;

function greetingKR(tone) {
  const h = new Date().getHours();
  if (tone === "friendly") {
    if (h < 5) return "아직 안 주무셨군요";
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "오후도 화이팅이에요";
    return "오늘 하루도 수고 많으셨어요";
  }
  if (h < 5) return "늦은 시간이네요";
  if (h < 12) return "좋은 아침입니다";
  if (h < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

// 친근 톤 인사 옆 작은 SVG 글리프 (해 / 달 / 컵 — 시간대별)
function FriendlyGlyph() {
  const h = new Date().getHours();
  if (h < 5 || h >= 20) {
    return (
      <span className="friendly-glyph" style={{ background: "oklch(88% 0.08 270)", color: "oklch(40% 0.14 270)" }}>
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" /><circle cx="15" cy="9" r="6" fill="oklch(88% 0.08 270)" /></svg>
      </span>);

  }
  if (h < 12) {
    return (
      <span className="friendly-glyph">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>);

  }
  // 오후 — 커피컵
  return (
    <span className="friendly-glyph" style={{ background: "oklch(92% 0.06 40)", color: "oklch(45% 0.12 35)" }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z" fill="currentColor" opacity="0.2" />
        <path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z" />
        <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
        <path d="M8 3c0 1.5 1 2 1 3.5M12 3c0 1.5 1 2 1 3.5" />
      </svg>
    </span>);

}

// ── 시그니처 영역 채움 스파크라인 ───────────────────────
function SparkAreaInline({ data, color = "var(--accent)", width = 50, height = 16 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data),max = Math.max(...data);
  const range = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, height - (v - min) / range * (height - 2) - 1]);
  const linePath = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const areaPath = linePath + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg className="sparkline-area k-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width={width} height={height}>
      <path className="area" d={areaPath} style={{ fill: color }} />
      <path className="line" d={linePath} style={{ stroke: color }} />
    </svg>);

}

function Dashboard({ data, setPage, openEmployee, tone = "pro" }) {
  const toast = useCtxDash(ToastContext);
  const k = data.kpis;
  const today = new Date();
  const todayStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const isFriendly = tone === "friendly";

  const overdueApprovals = data.approvalQueue.filter((a) => a.urgency === "overdue").length;
  const todayApprovals = data.approvalQueue.filter((a) => a.urgency === "today").length;
  const totalApprovals = data.approvalQueue.length;
  const delayedOnboarding = data.onboarding.filter((p) => p.status === "delay").length;

  return (
    <div className="content" style={{ color: "rgb(0, 0, 0)" }}>
      {/* ── 액션 히어로 + 컨텍스트 ─────────────── */}
      <div className="action-hero">
        <div className="greet-card">
          <div className="when">{todayStr}</div>
          <h1>
            {isFriendly && <FriendlyGlyph />}
            {greetingKR(tone)}, <span style={{ color: isFriendly ? "var(--warm-ink)" : "var(--accent-ink)" }}>{data.me.name}</span>님
          </h1>
          <div className="lead">
            {isFriendly ?
            <>
                오늘은 처리하실 일이 <b className="num">{totalApprovals + delayedOnboarding}건</b> 있어요.<br />
                그중 <b style={{ color: "var(--danger)" }}>{overdueApprovals}건은 시작일이 지났으니</b> 먼저 살펴봐 주세요 🙏
              </> :

            <>
                오늘 처리할 일이 <b className="num">{totalApprovals + delayedOnboarding}건</b> 있어요.<br />
                그중 <b style={{ color: "var(--danger)" }}>{overdueApprovals}건은 연체</b>됐어요. 먼저 처리해 주세요.
              </>
            }
          </div>

          <div className="priority-strip">
            <button className="priority-cell danger" onClick={() => setPage("my-tasks")}>
              <div>
                <div className="pi-num">{overdueApprovals}</div>
                <div className="pi-lbl">결재 <b>연체</b></div>
              </div>
              <Icons.ArrowR size={14} className="pi-arrow" />
            </button>
            <button className="priority-cell warning" onClick={() => setPage("my-tasks")}>
              <div>
                <div className="pi-num">{todayApprovals}</div>
                <div className="pi-lbl">오늘 처리</div>
              </div>
              <Icons.ArrowR size={14} className="pi-arrow" />
            </button>
            <button className="priority-cell accent" onClick={() => setPage("onboarding")}>
              <div>
                <div className="pi-num">{delayedOnboarding}</div>
                <div className="pi-lbl">온보딩 지연</div>
              </div>
              <Icons.ArrowR size={14} className="pi-arrow" />
            </button>
          </div>
        </div>

        {/* Right context card */}
        <div className="context-card">
          <div className="week-lbl">이번 주 한눈에</div>

          <div className="micro">
            <div className="ico" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
              <Icons.Users size={14} />
            </div>
            <div className="lbl">전사 인원</div>
            <div className="val">{k.headcount.value}</div>
            <span className="delta">변동 없음</span>
          </div>
          <div className="micro">
            <div className="ico" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
              <Icons.UserPlus size={14} />
            </div>
            <div className="lbl">신규 입사</div>
            <div className="val">2</div>
            <span className="delta">이번 주</span>
          </div>
          <div className="micro">
            <div className="ico" style={{ background: "var(--warning-soft)", color: "oklch(50% 0.15 40)" }}>
              <Icons.Calendar size={14} />
            </div>
            <div className="lbl">연차 신청</div>
            <div className="val up">+{data.leaveSummary.pending}</div>
            <span className="delta">대기 중</span>
          </div>
          <div className="micro">
            <div className="ico" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              <Icons.Alert size={14} />
            </div>
            <div className="lbl">번아웃 위험</div>
            <div className="val down">5</div>
            <span className="delta">감지됨</span>
          </div>
          <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={() => setPage("i-exec")}>
            전체 인사이트 <Icons.ArrowR size={12} sw={2.2} />
          </button>
        </div>
      </div>

      {/* ── 핵심 KPI strip (compact, signature spark) ─────────────── */}
      <div className="kpi-strip">
        <div className="cell">
          <div className="k-lbl"><Icons.Users size={11} /> 전사 인원</div>
          <div className="k-val">{k.headcount.value}<span className="unit">명</span></div>
          <span className="k-delta flat">±0 / 30일</span>
          <SparkAreaInline data={k.headcount.series} />
        </div>
        <div className="cell">
          <div className="k-lbl"><Icons.Inbox size={11} /> 결재 대기</div>
          <div className="k-val" style={{ color: "var(--danger)" }}>{k.pendingApprovals.value}<span className="unit">건</span></div>
          <span className="k-delta up">+12 / 1주</span>
          <SparkAreaInline data={k.pendingApprovals.series} color="var(--danger)" />
        </div>
        <div className="cell">
          <div className="k-lbl"><Icons.Logout size={11} /> 이직률 (30일)</div>
          <div className="k-val">{k.turnoverRate.value.toFixed(1)}<span className="unit">%</span></div>
          <span className="k-delta flat">변동 없음</span>
          <SparkAreaInline data={k.turnoverRate.series} color="var(--success)" />
        </div>
        <div className="cell">
          <div className="k-lbl"><Icons.UserPlus size={11} /> 채용 중</div>
          <div className="k-val">{k.openRoles.value}<span className="unit">개</span></div>
          <span className="k-delta down">−1 / 1주</span>
          <SparkAreaInline data={k.openRoles.series} />
        </div>
        <div className="cell">
          <div className="k-lbl"><Icons.Calendar size={11} /> 연차 사용률</div>
          <div className="k-val">{data.leaveSummary.companyUsage}<span className="unit">%</span></div>
          <span className="k-delta down">−2.3%p</span>
          <SparkAreaInline data={[45, 46, 47, 48, 48, 48, 48.3]} />
        </div>
        <div className="cell">
          <div className="k-lbl"><Icons.Clock size={11} /> 평균 초과근무</div>
          <div className="k-val">1.6<span className="unit">h</span></div>
          <span className="k-delta up">+0.2h</span>
          <SparkAreaInline data={[1.2, 1.3, 1.3, 1.4, 1.5, 1.5, 1.6]} color="oklch(60% 0.14 75)" />
        </div>
      </div>

      {/* ── 이번 주 인사이트 (storytelling) ─────────────── */}
      <div className="sec-h">
        <h2>이번 주 알아야 할 5가지</h2>
        <span className="sub">자동 생성 · 매주 월요일 09:00</span>
        <span className="right chip accent"><Icons.Sparkle size={11} /> AI 요약</span>
      </div>
      <div className="insight-card" style={{ marginBottom: "var(--space-5)" }}>
        <div className="insight-narrative">
          지난주 대비 결재 적체가 <span className="hl-danger">+12건 (250%)</span> 증가했어요.
          가장 큰 원인은 <b>박지훈님의 휴가 신청</b>이 5일째 미처리된 점이에요.
          반면 온보딩은 <span className="num-up">▲ 2건</span> 완료됐고, 이직률은 <b>0.0%</b>로 안정적이에요.
        </div>

        <div className="insight-numbered danger" onClick={() => setPage("my-tasks")}>
          <div className="idx">1</div>
          <div className="body">
            <div className="lead">결재 적체가 작년 동기 대비 <b style={{ color: "var(--danger)" }}>250% 증가</b>했어요</div>
            <div className="sub">박지훈 · 정유진 · 권하은 등 <b>3명의 휴가 신청</b>이 5일 이상 미처리. 결재함 비우기 권장.</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
        <div className="insight-numbered warning" onClick={() => setPage("onboarding")}>
          <div className="idx">2</div>
          <div className="body">
            <div className="lead">신규 입사자 <b>5명의 온보딩이 평균 80일 지연</b>됐어요</div>
            <div className="sub">이민준 (D-12), 오승현 (D-74), 윤지호 (D-102) — 버디 매칭과 강제 완료 검토 필요.</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
        <div className="insight-numbered accent" onClick={() => setPage("leave")}>
          <div className="idx">3</div>
          <div className="body">
            <div className="lead">연말 연차 미소진 예상이 <b>86.9%</b>에 달해요</div>
            <div className="sub">전사 평균 잔여 10.3일. 분기별 강제 소진 캠페인을 검토하세요. 미소진 직원 70명에게 알림 발송 가능.</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
        <div className="insight-numbered danger" onClick={() => setPage("i-health")}>
          <div className="idx">4</div>
          <div className="body">
            <div className="lead"><b>5명에게서 번아웃 위험 신호</b>가 감지됐어요</div>
            <div className="sub">박지훈님은 8주 연속 주 52시간 한도 근접 + 연차 사용률 20% 미만. 1:1 미팅 권장.</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
        <div className="insight-numbered success" onClick={() => setPage("perf-cycle")}>
          <div className="idx">5</div>
          <div className="body">
            <div className="lead">2026 상반기 MBO 목표 등록 마감이 <b>16일 남았어요</b></div>
            <div className="sub">현재 47% 제출 완료 (31/66명). 미제출자 35명에게 리마인더 발송 권장.</div>
          </div>
          <Icons.ArrowR size={14} className="arrow" />
        </div>
      </div>

      {/* ── 결재 대기 큐 + 위험 신호 ─────────────── */}
      <div className="sec-h">
        <h2>결재 대기 큐</h2>
        <span className="sub">{data.approvalQueue.length}건 · 우선순위 자동 정렬</span>
        <span className="right">
          <button className="action small" onClick={() => setPage("my-tasks")} style={{ color: "var(--accent-ink)" }}>
            전체 결재함 <Icons.ChevR size={11} sw={2.2} />
          </button>
        </span>
      </div>
      <Card style={{ marginBottom: "var(--space-5)" }}>
        <div className="list">
          {data.approvalQueue.slice(0, 5).map((a) => {
            const urgencyChip =
            a.urgency === "overdue" ? <span className="chip danger">연체</span> :
            a.urgency === "today" ? <span className="chip warning">오늘 처리</span> :
            <span className="chip">대기</span>;
            return (
              <div key={a.id} className="appr-row">
                <Avatar name={a.who} hue={a.who.charCodeAt(0) * 31 % 360} />
                <div className="grow">
                  <div className="title fw-7">{a.who} · {a.what}</div>
                  <div className="meta">
                    <span className="chip accent">{a.type}</span>
                    <span>{a.team}</span>
                    <span className="sep">·</span>
                    <span>{fmtKDate(a.submitted)} 제출</span>
                    {a.note && <><span className="sep">·</span><span style={{ fontStyle: "italic" }}>"{a.note}"</span></>}
                  </div>
                </div>
                {urgencyChip}
                <button className="btn sm" onClick={() => toast(`${a.who} - 반려됨`)}>반려</button>
                <button className="btn sm btn-primary" onClick={() => toast(`${a.who} - 승인됨`)}>승인</button>
              </div>);

          })}
        </div>
      </Card>

      {/* ── 온보딩 + 근태 (2-col) ─────────────── */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <CardHead
            icon="UserPlus"
            title="온보딩 진행"
            sub={`${data.onboarding.length}명`}
            action="전체 보기"
            onAction={() => setPage("onboarding")} />
          
          <div className="list">
            {data.onboarding.slice(0, 5).map((p) =>
            <div key={p.name} className="item">
                <Avatar name={p.name} hue={p.hue} />
                <div className="grow">
                  <div className="title">{p.name}</div>
                  <div className="meta">
                    <span>입사 {fmtKDate(p.joinDate)}</span>
                    <span className="sep">·</span>
                    <span className="mono">{Math.round(p.progress / p.total * 100)}%</span>
                    <span className="sep">·</span>
                    <span>{dDayLabel(p.dDay)}</span>
                  </div>
                </div>
                <div style={{ width: 80 }}>
                  <div className={`progress ${p.status === "delay" ? "danger" : p.status === "done" ? "success" : ""}`}>
                    <i style={{ width: `${p.progress / p.total * 100}%` }} />
                  </div>
                </div>
                {p.status === "delay" && <span className="chip danger">지연</span>}
                {p.status === "done" && <span className="chip success">완료</span>}
                {p.status === "progress" && <span className="chip info">진행중</span>}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHead
            icon="Clock"
            title="오늘 근태"
            sub={today.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            action="근태 관리"
            onAction={() => setPage("attendance")} />
          
          <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, paddingTop: "var(--space-5)" }}>
            <div>
              <div className="cap">출근</div>
              <div className="val tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>
                64<span style={{ fontSize: 13, color: "var(--fg-faint)", fontWeight: 500 }}>/72</span>
              </div>
            </div>
            <div>
              <div className="cap">지각</div>
              <div className="val tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--warning)" }}>3</div>
            </div>
            <div>
              <div className="cap">결근</div>
              <div className="val tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>2</div>
            </div>
            <div>
              <div className="cap">휴가</div>
              <div className="val tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--info)" }}>3</div>
            </div>
          </div>
          <div style={{ padding: "0 var(--space-6) var(--space-5)" }}>
            <div className="cap" style={{ marginBottom: 10, marginTop: 8 }}>최근 7일 출근율</div>
            <div className="vbar" style={{ height: 100, padding: 0 }}>
              {data.attendanceWeek.map((d, i) => {
                const rate = d.present / 72 * 100;
                return (
                  <div key={i} className="col">
                    <div className="bar accent" style={{ height: `${Math.max(2, rate)}%` }} />
                    <div className="bar-lbl">{d.dayKr}</div>
                  </div>);

              })}
            </div>
          </div>
        </Card>
      </div>
    </div>);

}

Object.assign(window, { Dashboard });