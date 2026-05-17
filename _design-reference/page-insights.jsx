/* global React, Icons, Avatar, Card, CardHead */
// CTR HR Hub — 인사이트 (Executive Summary + 팀 헬스 + 근태 분석)

const { useState: useStateIN } = React;

// ── Line chart (simple, SVG) ─────────────────────────
function LineChart({ data, height = 220, color = "var(--accent)", labelKey = "m", valueKey = "v", yMax }) {
  if (!data || !data.length) return null;
  const max = yMax || Math.max(...data.map((d) => d[valueKey])) * 1.15 || 1;
  const padL = 36, padR = 16, padT = 16, padB = 28;
  const W = 600, H = height;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const stepX = innerW / (data.length - 1);
  const points = data.map((d, i) => [padL + i * stepX, padT + (1 - d[valueKey] / max) * innerH]);
  const d = points.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round(max * (yTicks - i) / yTicks));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ height }}>
      {/* y grid */}
      {ticks.map((t, i) => {
        const y = padT + (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--border)" strokeDasharray={i === yTicks ? "0" : "2 4"}/>
            <text x={padL - 6} y={y + 3} fontSize="10" textAnchor="end" fill="var(--fg-faint)">{t}</text>
          </g>
        );
      })}
      {/* line */}
      <path d={d} fill="none" stroke={color} strokeWidth="2"/>
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--bg-elev)" stroke={color} strokeWidth="1.5"/>
      ))}
      {/* x labels */}
      {data.map((d, i) => (
        <text key={i} x={padL + i * stepX} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--fg-faint)">{d[labelKey]}</text>
      ))}
    </svg>
  );
}

// ── Bar chart ────────────────────────────────────────
function BarChart({ data, height = 220, color = "var(--danger)", labelKey = "m", valueKey = "v", yMax }) {
  if (!data || !data.length) return null;
  const max = yMax || Math.max(...data.map((d) => d[valueKey])) * 1.15 || 1;
  const padL = 36, padR = 16, padT = 16, padB = 28;
  const W = 600, H = height;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const bw = innerW / data.length - 6;
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round(max * (yTicks - i) / yTicks));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ height }}>
      {ticks.map((t, i) => {
        const y = padT + (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--border)" strokeDasharray={i === yTicks ? "0" : "2 4"}/>
            <text x={padL - 6} y={y + 3} fontSize="10" textAnchor="end" fill="var(--fg-faint)">{t}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + i * (innerW / data.length) + 3;
        const h = (d[valueKey] / max) * innerH;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(0, h)} rx="2" fill={color}/>
            <text x={x + bw / 2} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--fg-faint)">{d[labelKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Funnel ───────────────────────────────────────────
function Funnel({ stages }) {
  const total = stages[0].value || 1;
  return (
    <div style={{ padding: "var(--space-4) 0" }}>
      <svg viewBox="0 0 400 100" width="100%" preserveAspectRatio="none" style={{ height: 100 }}>
        {stages.map((s, i) => {
          const startW = (stages[i].value / total) * 360;
          const endW   = (stages[i + 1] ? stages[i + 1].value / total : 0) * 360;
          const xL = (400 - startW) / 2;
          const xR = xL + startW;
          const x2L = (400 - endW) / 2;
          const x2R = x2L + endW;
          const y1 = (i / stages.length) * 100;
          const y2 = ((i + 1) / stages.length) * 100;
          const opacity = 1 - i * 0.12;
          return (
            <polygon key={i} points={`${xL},${y1} ${xR},${y1} ${x2R},${y2} ${x2L},${y2}`}
              fill="var(--accent)" opacity={opacity}/>
          );
        })}
      </svg>
      <div className="flex center" style={{ justifyContent: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {stages.map((s, i) => (
          <div key={i} className="flex center gap-1 small">
            <span className="dot" style={{ background: `oklch(60% 0.20 263 / ${1 - i * 0.12})` }}/>
            <span className="fw-6">{s.name}</span>
            <span className="mono tnum">{s.value}명</span>
            {i === 1 && <span className="faint">(0%)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gauge ────────────────────────────────────────────
function Gauge({ value, max = 100, label = "" }) {
  const pct = Math.min(1, Math.max(0, value / max));
  const radius = 90;
  const circ = Math.PI * radius;
  const offset = circ * (1 - pct);
  const color = value >= 80 ? "var(--success)" : value >= 60 ? "var(--warning)" : "var(--danger)";
  return (
    <div style={{ position: "relative", width: 240, height: 140, margin: "0 auto" }}>
      <svg viewBox="0 0 240 140" width="240" height="140">
        <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="var(--bg-sunk)" strokeWidth="14" strokeLinecap="round"/>
        <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}/>
        <text x="120" y="100" textAnchor="middle" fontSize="40" fontWeight="700" fill="var(--fg)" style={{ letterSpacing: "-0.04em" }}>{value}</text>
        <text x="120" y="125" textAnchor="middle" fontSize="12" fill={color} fontWeight="600">{label}</text>
      </svg>
    </div>
  );
}

// ── Executive Summary ────────────────────────────────
function ExecutiveSummary({ data }) {
  const o = data.insights.overview;
  const pipelineStages = Object.entries(o.pipeline).map(([name, value]) => ({ name, value }));

  // 12개월 인원 추이 (mock)
  const headcountTrend = [
    { m: "6월", v: 62 }, { m: "7월", v: 63 }, { m: "8월", v: 64 }, { m: "9월", v: 65 },
    { m: "10월", v: 66 }, { m: "11월", v: 66 }, { m: "12월", v: 65 }, { m: "1월", v: 66 },
    { m: "2월", v: 66 }, { m: "3월", v: 67 }, { m: "4월", v: 67 }, { m: "5월", v: 67 },
  ];

  // 월별 인건비 (mock)
  const costTrend = [
    { m: "6월", v: 290 }, { m: "7월", v: 295 }, { m: "8월", v: 300 }, { m: "9월", v: 305 },
    { m: "10월", v: 310 }, { m: "11월", v: 308 }, { m: "12월", v: 312 }, { m: "1월", v: 315 },
    { m: "2월", v: 318 }, { m: "3월", v: 320 }, { m: "4월", v: 322 }, { m: "5월", v: 324 },
  ];

  // 부서별 인원 분포 (mock)
  const deptDist = [
    { name: "개발팀", v: 24, color: 230 },
    { name: "영업팀", v: 12, color: 35 },
    { name: "생산/제조팀", v: 11, color: 145 },
    { name: "품질관리팀", v: 8, color: 75 },
    { name: "재무/회계팀", v: 6, color: 290 },
    { name: "인사팀", v: 4, color: 200 },
    { name: "기타", v: 2, color: 50 },
  ];

  return (
    <>
      {/* AI 요약 카드 */}
      <div style={{
        background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-elev) 60%)",
        border: "1px solid var(--accent-soft-2)",
        borderRadius: 14,
        padding: "18px 22px",
        marginBottom: "var(--space-4)",
        display: "flex", gap: 14, alignItems: "flex-start",
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent)", color: "white", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icons.Sparkle size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, marginBottom: 4 }}>
            이번 분기 한 줄 요약 · AI 생성
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: "var(--fg)", letterSpacing: "-0.005em" }}>
            전사 인원 <b>{o.headcount}명</b>으로 안정적이지만, <b style={{ color: "var(--danger)" }}>52h 위반이 작년 동기 대비 +18%</b> 증가하고
            <b style={{ color: "oklch(50% 0.16 60)" }}> 번아웃 위험 신호 5명</b>이 감지됐어요.
            <b> 채용 5건은 평균 14일째 진행 중</b>이며, 다음 분기 인건비는 약 ₩3.5M 증가 예상.
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button className="btn sm"><Icons.Doc size={11} /> 상세 리포트</button>
            <button className="btn sm">근거 보기</button>
          </div>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 전사 인원</div>
          <div className="ss-val">{o.headcount}<span className="u">명</span></div>
          <div className="ss-foot">전월 +0 · 안정</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.UserPlus size={13} sw={1.8} /></span> 활성 채용</div>
          <div className="ss-val">{pipelineStages[0]?.value || 5}<span className="u">건</span></div>
          <div className="ss-foot">평균 D+14 진행</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Wallet size={13} sw={1.8} /></span> 월 인건비</div>
          <div className="ss-val">₩324<span className="u">M</span></div>
          <div className="ss-foot"><span className="delta-up">+0.6%</span> 전월</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 위험 신호</div>
          <div className="ss-val">{o.riskSignals.reduce((a, r) => a + r.count, 0)}<span className="u">건</span></div>
          <div className="ss-foot">번아웃 · 52h · 미소진</div>
        </div>
      </div>

      {/* 인원 추이 + 인건비 추이 */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">전사 인원 추이</span>
            <span className="sub">최근 12개월</span>
            <div className="right">
              <span className="chip success">+5 / 12개월</span>
            </div>
          </div>
          <div className="card-pad">
            <LineChart data={headcountTrend} color="var(--accent)" yMax={75} height={200} />
          </div>
        </Card>
        <Card>
          <div className="card-head">
            <span className="title">월별 인건비</span>
            <span className="sub">단위: 백만원</span>
            <div className="right">
              <span className="chip warning">+11.7% YoY</span>
            </div>
          </div>
          <div className="card-pad">
            <LineChart data={costTrend} color="oklch(55% 0.16 290)" yMax={350} height={200} />
          </div>
        </Card>
      </div>

      {/* 부서별 인원 + 채용 funnel */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">부서별 인원 분포</span>
            <span className="sub">{o.headcount}명 · 7개 부서</span>
          </div>
          <div className="card-pad">
            <div className="bar-chart">
              {deptDist.map((d) => (
                <div key={d.name} className="bar-row">
                  <span className="lbl">{d.name}</span>
                  <div className="track">
                    <i style={{ width: `${(d.v / o.headcount) * 100}%`, "--bar-hue": d.color }} />
                  </div>
                  <span className="pct">{d.v}명</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="card-head">
            <span className="title">채용 파이프라인</span>
            <span className="sub">현재 진행</span>
          </div>
          <div className="card-pad">
            <Funnel stages={pipelineStages} />
          </div>
        </Card>
      </div>

      {/* 위험 신호 모음 */}
      <div className="wd-section-h">
        <h3>위험 신호</h3>
        <span className="sub">자동 감지 · 액션 필요</span>
        <span className="right chip danger">{o.riskSignals.reduce((a, r) => a + r.count, 0)}건 감지</span>
      </div>
      <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
        {[
          { title: "번아웃 위험", n: 5, sub: "주 52h 한도 근접 + 연차 사용 <20%", color: "var(--danger)", bg: "oklch(96% 0.05 25)", page: "i-health" },
          { title: "52h 위반", n: 12, sub: "최근 4주 기준 누적", color: "oklch(50% 0.16 60)", bg: "var(--wd-orange-soft)", page: "i-attn" },
          { title: "연말 미소진", n: 70, sub: "예상 86.9% · 잔여 평균 10.3일", color: "oklch(45% 0.16 290)", bg: "oklch(94% 0.05 290)", page: "leave" },
        ].map((r) => (
          <div key={r.title} style={{
            background: r.bg,
            borderRadius: 12,
            padding: "16px 18px",
            display: "flex", gap: 12, alignItems: "center",
            cursor: "pointer",
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-elev)", color: r.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icons.Alert size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: r.color }}>{r.title} · {r.n}명</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 2 }}>{r.sub}</div>
            </div>
            <Icons.ArrowR size={14} sw={2} style={{ color: r.color }} />
          </div>
        ))}
      </div>

      {/* 법인 비교 */}
      <div className="wd-section-h">
        <h3>법인 비교</h3>
        <span className="sub">{o.corps.length}개 법인</span>
      </div>
      <Card>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>법인</th>
                <th className="right">인원</th>
                <th className="right">이직위험</th>
                <th className="right">평균 근속</th>
                <th className="right">인건비</th>
                <th className="right">유의도</th>
              </tr>
            </thead>
            <tbody>
              {o.corps.map((c, i) => (
                <tr key={c.name} className="clickable">
                  <td className="fw-6">{c.name}</td>
                  <td className="right mono tnum">{c.people}명</td>
                  <td className="right mono tnum">
                    <span className={`chip ${c.risk >= 5 ? "danger" : c.risk >= 3 ? "warning" : "success"}`} style={{ fontFamily: "var(--font-mono)" }}>
                      {c.risk}%
                    </span>
                  </td>
                  <td className="right mono tnum">{c.tenure}년</td>
                  <td className="right mono tnum">{c.cost}</td>
                  <td className="right">
                    {i === 0 && <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600 }}>안정</span>}
                    {i === 1 && <span style={{ fontSize: 11, color: "oklch(50% 0.16 60)", fontWeight: 600 }}>주의</span>}
                    {i === 2 && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>위험</span>}
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

// ── Attendance analytics ─────────────────────────────
function AttendanceAnalytics({ data }) {
  const a = data.insights.attendance;

  // 출근 시간 히트맵 데이터 (요일 × 시간대)
  const dayLabels = ["월", "화", "수", "목", "금"];
  const hourLabels = ["8시", "9시", "10시", "11시", "12시"];
  const heatmap = [
    [60, 25, 8,  3, 0],   // 월 (지각 많음)
    [70, 22, 5,  2, 1],   // 화
    [75, 18, 4,  2, 1],   // 수
    [72, 19, 6,  2, 1],   // 목
    [55, 28, 9,  5, 3],   // 금 (지각 많음)
  ];
  const maxHeat = Math.max(...heatmap.flat());

  // 부서별 근태 비교 (mock)
  const deptAttn = [
    { dept: "개발팀",    rate: 96, ot: 8.4, color: 230 },
    { dept: "영업팀",    rate: 88, ot: 12.2, color: 35 },
    { dept: "생산/제조팀", rate: 94, ot: 6.5, color: 145 },
    { dept: "품질관리팀", rate: 97, ot: 3.2, color: 75 },
    { dept: "재무/회계팀", rate: 99, ot: 1.8, color: 290 },
    { dept: "인사팀",    rate: 100, ot: 2.4, color: 200 },
  ];

  // 장기 연차 미사용자 (60일+ 연차 미사용)
  const longNonTakers = [
    { name: "박지훈", dept: "생산기술팀", days: 142, used: 0.5, total: 15, lastUsed: "2025-12-23" },
    { name: "이상민", dept: "영업팀",     days: 98,  used: 2.0, total: 15, lastUsed: "2026-02-08" },
    { name: "정유진", dept: "재무/회계팀", days: 87,  used: 1.5, total: 15, lastUsed: "2026-02-20" },
    { name: "최서연", dept: "개발팀",     days: 76,  used: 2.5, total: 15, lastUsed: "2026-03-02" },
    { name: "권하은", dept: "생산/제조팀", days: 64,  used: 3.0, total: 15, lastUsed: "2026-03-14" },
  ];

  return (
    <>
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Calendar size={13} sw={1.8} /></span> 연차 사용률</div>
          <div className="ss-val">{a.leaveUsageRate}<span className="u">%</span></div>
          <div className="ss-foot"><span className="delta-down">−2.3%p</span> 전월</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 52h 위반</div>
          <div className="ss-val">{a.h52Violations}<span className="u">건</span></div>
          <div className="ss-foot"><span className="delta-up">+18%</span> YoY</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 평균 초과근무</div>
          <div className="ss-val">{a.overtimeAvg}<span className="u">h</span></div>
          <div className="ss-foot">주당 / 대상자</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 장기 연차 미사용</div>
          <div className="ss-val">8<span className="u">명</span></div>
          <div className="ss-foot">60일+ 미사용 · 강제 사용 권장</div>
        </div>
      </div>

      {/* 패턴 알림 */}
      <div style={{
        background: "var(--wd-orange-soft)",
        border: "1px solid oklch(85% 0.08 60)",
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: "var(--space-4)",
        display: "flex", gap: 12, alignItems: "center",
      }}>
        <Icons.Sparkle size={18} style={{ color: "var(--wd-orange-ink)" }} />
        <div style={{ flex: 1, fontSize: 13, color: "var(--fg)" }}>
          <b>패턴 감지</b> · <b>월요일·금요일 9시 이후 출근</b>이 평일 대비 1.8배 많아요. 유연근무제 검토 권장.
        </div>
        <button className="btn sm">자세히</button>
      </div>

      {/* 차트 영역 */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">월별 초과근무 추이</span>
            <span className="sub">총합 / 시간</span>
          </div>
          <div className="card-pad">
            <LineChart data={a.monthlyOvertime} color="var(--accent)" yMax={120} height={200} />
          </div>
        </Card>
        <Card>
          <div className="card-head">
            <span className="title">52h 위반 추이</span>
            <span className="sub">월별 건수</span>
          </div>
          <div className="card-pad">
            <BarChart data={a.h52Trend} color="var(--danger)" yMax={600} height={200} />
          </div>
        </Card>
      </div>

      {/* 출근 시간 히트맵 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">요일·시간대 출근 패턴</span>
          <span className="sub">최근 30일 누적</span>
          <div className="right" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--fg-faint)" }}>
            적음
            <div style={{ display: "flex", gap: 2 }}>
              {[0.15, 0.3, 0.5, 0.75, 1].map((o, i) => (
                <span key={i} style={{ width: 14, height: 12, background: `oklch(60% 0.18 230 / ${o})`, borderRadius: 2 }} />
              ))}
            </div>
            많음
          </div>
        </div>
        <div className="card-pad">
          <div style={{ display: "grid", gridTemplateColumns: "40px repeat(5, 1fr)", gap: 4 }}>
            <div />
            {hourLabels.map((h) => (
              <div key={h} style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "center", paddingBottom: 4 }}>{h}</div>
            ))}
            {dayLabels.map((day, di) => (
              <React.Fragment key={day}>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", alignItems: "center", fontWeight: 600 }}>{day}</div>
                {heatmap[di].map((v, hi) => {
                  const intensity = v / maxHeat;
                  return (
                    <div key={hi} style={{
                      height: 38,
                      background: `oklch(60% 0.18 230 / ${Math.max(0.06, intensity)})`,
                      borderRadius: 4,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: intensity > 0.5 ? "white" : "var(--fg-muted)",
                      cursor: "pointer",
                    }} title={`${day} ${hourLabels[hi]} · ${v}명`}>
                      {v > 0 ? v : ""}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--fg-faint)" }}>
            ※ 정시 출근(9시 이전) 비율이 높은 시간대일수록 진하게 표시돼요. 9시 이후는 지각 누적.
          </div>
        </div>
      </Card>

      {/* 부서별 근태 비교 + 마이너스 연차 */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">부서별 근태 비교</span>
            <span className="sub">출근율 · 초과근무 (h/주)</span>
          </div>
          <div className="card-pad">
            <div className="bar-chart">
              {deptAttn.map((d) => (
                <div key={d.dept} className="bar-row">
                  <span className="lbl">{d.dept}</span>
                  <div className="track">
                    <i style={{ width: `${d.rate}%`, "--bar-hue": d.color }} />
                  </div>
                  <span className="pct">{d.rate}% · {d.ot}h</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">장기 연차 미사용자</span>
            <span className="sub">60일 이상 미사용</span>
            <div className="right">
              <button className="btn sm"><Icons.Mail size={11} sw={2} /> 일괄 알림</button>
            </div>
          </div>
          <div className="list">
            {longNonTakers.map((p, i) => (
              <div key={i} className="item" style={{ padding: "10px var(--space-6)" }}>
                <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 47) % 360} size="sm" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title">{p.name} <span style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 400 }}>· {p.dept}</span></div>
                  <div className="meta" style={{ fontSize: 11.5 }}>
                    잔여 <b style={{ color: "var(--fg)", fontWeight: 600 }}>{(p.total - p.used).toFixed(1)}일</b>
                    <span className="sep">·</span>
                    마지막 사용 {p.lastUsed.replace(/-/g, ".").slice(2)}
                  </div>
                </div>
                <span className="mono tnum" style={{
                  color: p.days > 100 ? "var(--danger)" : "oklch(50% 0.16 60)",
                  fontWeight: 700,
                  fontSize: 14,
                }}>
                  D+{p.days}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 부서별 연차 사용률 + 휴가 유형별 월별 추이 */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">부서별 연차 사용률</span>
            <span className="sub">2026년 누적 · 회계연도 기준</span>
            <div className="right">
              <button className="btn sm"><Icons.Mail size={11} sw={2} /> 저소진 부서 알림</button>
            </div>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { dept: "재무/회계팀", rate: 38, target: 60 },
                { dept: "영업팀",      rate: 42, target: 60 },
                { dept: "생산기술팀",  rate: 45, target: 60 },
                { dept: "개발팀",      rate: 53, target: 60 },
                { dept: "품질관리팀",  rate: 61, target: 60 },
                { dept: "인사팀",      rate: 68, target: 60 },
                { dept: "구매/조달팀", rate: 72, target: 60 },
                { dept: "마케팅팀",    rate: 78, target: 60 },
              ].map((d) => {
                const ok = d.rate >= d.target;
                const color = ok ? "oklch(55% 0.14 145)" : d.rate >= 50 ? "oklch(50% 0.16 60)" : "var(--danger)";
                return (
                  <div key={d.dept} style={{ display: "grid", gridTemplateColumns: "100px 1fr 52px", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{d.dept}</span>
                    <div style={{ position: "relative", height: 10, background: "var(--bg-sunk)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: `${d.target}%`, width: 1, height: "100%", background: "var(--fg-faint)", zIndex: 2 }} />
                      <div style={{ width: `${d.rate}%`, height: "100%", background: color, borderRadius: 5 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color, textAlign: "right" }}>{d.rate}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              회색 라인은 목표 사용률(60%). 3개 부서가 미달 — 강제 소진 캠페인 권장이에요.
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">휴가 유형별 월별 추이</span>
            <span className="sub">최근 6개월 · 사용일수</span>
          </div>
          <div className="card-pad">
            {(() => {
              const stack = [
                { m: "12월", 연차: 28, 병가: 6, 공가: 3, 경조사: 2 },
                { m: "1월",  연차: 36, 병가: 8, 공가: 2, 경조사: 1 },
                { m: "2월",  연차: 42, 병가: 12, 공가: 4, 경조사: 3 },
                { m: "3월",  연차: 31, 병가: 9, 공가: 3, 경조사: 2 },
                { m: "4월",  연차: 38, 병가: 7, 공가: 5, 경조사: 1 },
                { m: "5월",  연차: 45, 병가: 5, 공가: 8, 경조사: 2 },
              ];
              const types = [
                { k: "연차",   color: "oklch(60% 0.14 230)" },
                { k: "병가",   color: "oklch(60% 0.18 25)" },
                { k: "공가",   color: "oklch(60% 0.14 145)" },
                { k: "경조사", color: "oklch(60% 0.14 290)" },
              ];
              const maxV = Math.max(...stack.map((s) => types.reduce((a, t) => a + s[t.k], 0)));
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, alignItems: "flex-end", height: 200 }}>
                    {stack.map((s) => {
                      const total = types.reduce((a, t) => a + s[t.k], 0);
                      const h = (total / maxV) * 170;
                      return (
                        <div key={s.m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{total}</span>
                          <div style={{ width: "72%", height: h, display: "flex", flexDirection: "column-reverse", borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                            {types.map((t) => {
                              const segH = (s[t.k] / total) * h;
                              return <div key={t.k} style={{ height: segH, background: t.color }} title={`${t.k} ${s[t.k]}일`} />;
                            })}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{s.m}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
                    {types.map((t) => (
                      <div key={t.k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--fg-muted)" }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: t.color }} />
                        {t.k}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </Card>
      </div>
    </>
  );
}

// ── Team Health ──────────────────────────────────────
function TeamHealth({ data }) {
  const h = data.insights.teamHealth;

  // 부서별 헬스 비교 (mock)
  const deptHealth = [
    { dept: "재무/회계팀", score: 92, label: "건강" },
    { dept: "인사팀",      score: 88, label: "건강" },
    { dept: "품질관리팀",   score: 84, label: "건강" },
    { dept: "구매/조달팀", score: 78, label: "보통" },
    { dept: "연구개발팀",  score: 72, label: "보통" },
    { dept: "개발팀",      score: 64, label: "주의" },
    { dept: "영업팀",      score: 58, label: "주의" },
    { dept: "생산기술팀",   score: 48, label: "위험" },
  ];

  const riskTeams = deptHealth.filter((d) => d.score < 65).slice(0, 3);

  const recommendations = [
    {
      title: "생산기술팀 1:1 면담 우선 실시",
      sub: "헬스 점수 48점 · 박지훈 외 2명 번아웃 위험. 매니저-팀원 1:1을 2주 내 완료 권장",
      impact: "이직 위험 -40% 예상",
      color: "var(--danger)",
      bg: "oklch(96% 0.05 25)",
    },
    {
      title: "영업팀 강제 연차 캠페인",
      sub: "월 평균 OT 12.2h · 연차 사용률 38%. 2분기 내 5일 사용 권장 알림 발송",
      impact: "OT 22% 감소 예상",
      color: "oklch(50% 0.16 60)",
      bg: "var(--wd-orange-soft)",
    },
    {
      title: "개발팀 칭찬·인정 캠페인",
      sub: "성과 분포 양호하나 Engagement 점수 낮음. 분기 칭찬 카드 발송 활성화",
      impact: "Engagement +15점 예상",
      color: "var(--accent-ink)",
      bg: "var(--accent-soft)",
    },
  ];

  return (
    <>
      {/* 종합 헬스 카드 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ padding: "var(--space-6)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
          <div>
            <Gauge value={h.score} label={h.label} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 8 }}>
              전사 평균 팀 헬스 점수
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>
              전반적으로 양호하나 <span style={{ color: "var(--danger)" }}>2개 팀 위험 신호</span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6 }}>
              {h.subs.length}개 지표 기준 평균 {h.score}점. 워라밸·연차 사용은 양호하나 일부 부서에서 초과근무·번아웃 위험이 누적되고 있어요.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn sm btn-primary">위험 부서 1:1 일괄 예약</button>
              <button className="btn sm"><Icons.Doc size={11} sw={2} /> 상세 리포트</button>
            </div>
          </div>
        </div>

        {/* 5축 지표 */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "var(--space-5) var(--space-6)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {h.subs.map((s) => {
              const color = s.v >= 80 ? "var(--success)" : s.v >= 60 ? "oklch(50% 0.16 60)" : "var(--danger)";
              const bg = s.v >= 80 ? "oklch(95% 0.05 145)" : s.v >= 60 ? "var(--wd-orange-soft)" : "oklch(96% 0.05 25)";
              const icon = s.key === "초과근무" ? "Clock" : s.key === "연차 사용" ? "Calendar" : s.key === "성과 분포" ? "Target" : s.key === "이직 위험" ? "Alert" : "Heart";
              const Icon = Icons[icon];
              return (
                <div key={s.key} style={{
                  background: bg,
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--fg-muted)" }}>
                    <Icon size={13} style={{ color }} />
                    {s.key}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>{s.v}</div>
                  <div style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>/ 100점</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 위험 부서 + 부서별 비교 */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">부서별 헬스 점수</span>
            <span className="sub">{deptHealth.length}개 부서</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {deptHealth.map((d) => {
                const color = d.score >= 80 ? "oklch(55% 0.14 145)" :
                              d.score >= 65 ? "oklch(50% 0.16 60)" :
                              d.score >= 50 ? "oklch(58% 0.17 25)" : "var(--danger)";
                return (
                  <div key={d.dept} style={{ display: "grid", gridTemplateColumns: "110px 1fr 60px 60px", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{d.dept}</span>
                    <div style={{ height: 8, background: "var(--bg-sunk)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${d.score}%`, height: "100%", background: color, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color, textAlign: "right" }}>{d.score}</span>
                    <span className="chip" style={{
                      background: d.score >= 80 ? "oklch(95% 0.05 145)" : d.score >= 65 ? "var(--wd-orange-soft)" : "oklch(96% 0.05 25)",
                      color,
                      fontSize: 10,
                      fontWeight: 600,
                      justifySelf: "end",
                    }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">위험 부서 Top 3</span>
            <span className="sub">우선 대응 필요</span>
          </div>
          <div style={{ padding: "var(--space-4) var(--space-5)", display: "flex", flexDirection: "column", gap: 10 }}>
            {riskTeams.map((t, i) => (
              <div key={t.dept} style={{
                padding: "12px 14px",
                background: t.score < 50 ? "oklch(96% 0.05 25)" : "var(--wd-orange-soft)",
                borderLeft: `3px solid ${t.score < 50 ? "var(--danger)" : "oklch(50% 0.16 60)"}`,
                borderRadius: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: t.score < 50 ? "var(--danger)" : "oklch(50% 0.16 60)",
                    color: "white",
                    display: "grid", placeItems: "center",
                    fontSize: 11, fontWeight: 700,
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t.dept}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: t.score < 50 ? "var(--danger)" : "oklch(50% 0.16 60)" }}>{t.score}점</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4, marginLeft: 30 }}>
                  {i === 0 && "주 평균 OT 14h · 번아웃 위험 3명 · 1:1 미실시 60%"}
                  {i === 1 && "연차 사용률 38% · 야근 누적 · Engagement 점수 낮음"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 추천 액션 */}
      <div className="wd-section-h">
        <h3>추천 액션</h3>
        <span className="sub">AI 우선순위 정렬</span>
        <span className="right chip accent"><Icons.Sparkle size={11} /> AI 생성</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recommendations.map((r, i) => (
          <div key={i} style={{
            background: r.bg,
            borderRadius: 12,
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto auto",
            gap: 14,
            alignItems: "center",
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-elev)", color: r.color, display: "grid", placeItems: "center" }}>
              <Icons.Sparkle size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: r.color, marginBottom: 3 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>{r.sub}</div>
            </div>
            <span className="chip" style={{
              background: "var(--bg-elev)",
              color: r.color,
              fontSize: 11,
              fontWeight: 600,
              border: `1px solid ${r.color}`,
            }}>{r.impact}</span>
            <button className="btn sm" style={{ background: "var(--bg-elev)" }}>실행</button>
          </div>
        ))}
      </div>

      {/* 12개월 헬스 점수 추이 + eNPS */}
      <div className="grid-21" style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">12개월 팀 헬스 추이</span>
            <span className="sub">전사 평균 · 위험 부서 분리</span>
            <div className="right" style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--fg-muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 2, background: "var(--accent)" }} /> 전사 평균
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 2, background: "var(--danger)" }} /> 위험 부서
              </span>
            </div>
          </div>
          <div className="card-pad">
            {(() => {
              const months = ["6월","7월","8월","9월","10월","11월","12월","1월","2월","3월","4월","5월"];
              const company = [78, 76, 75, 77, 76, 74, 73, 71, 70, 72, 74, 75];
              const risk =    [62, 60, 58, 56, 55, 53, 50, 48, 46, 47, 48, 48];
              const w = 100, h = 180, pad = 10;
              const points = (arr) => arr.map((v, i) => {
                const x = pad + (i / (arr.length - 1)) * (w - pad * 2);
                const y = h - pad - ((v - 30) / 70) * (h - pad * 2);
                return [x, y];
              });
              const path = (arr) => points(arr).map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
              return (
                <div>
                  <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
                    {[0.25, 0.5, 0.75].map((r, i) => (
                      <line key={i} x1={pad} x2={w - pad} y1={pad + r * (h - pad * 2)} y2={pad + r * (h - pad * 2)} stroke="var(--border)" strokeDasharray="2,3" />
                    ))}
                    <path d={path(company)} stroke="var(--accent)" strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
                    <path d={path(risk)}    stroke="var(--danger)" strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
                    {points(company).map((p, i) => <circle key={`c${i}`} cx={p[0]} cy={p[1]} r="1.5" fill="var(--accent)" />)}
                    {points(risk).map((p, i) => <circle key={`r${i}`} cx={p[0]} cy={p[1]} r="1.5" fill="var(--danger)" />)}
                  </svg>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${months.length}, 1fr)`, marginTop: 6 }}>
                    {months.map((m, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: "var(--fg-faint)", textAlign: "center" }}>{m}</div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    <b style={{ color: "var(--danger)" }}>2월</b> 위험 부서 헬스 최저점 (46) — 1:1 면담 캠페인 이후 회복 추세. 전사 평균은 75점 안정.
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">eNPS</span>
            <span className="sub">분기 설문 · 응답 89%</span>
          </div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>2026 Q1</div>
              <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.025em", color: "oklch(50% 0.16 60)", fontFamily: "var(--font-mono)", lineHeight: 1.1, marginTop: 4 }}>+24</div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>전기 +18 · <span className="delta-up">+6</span> </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
              {[
                { k: "Promoter", v: 48, color: "oklch(55% 0.14 145)" },
                { k: "Passive",  v: 28, color: "oklch(70% 0.04 250)" },
                { k: "Detractor", v: 24, color: "var(--danger)" },
              ].map((c) => (
                <div key={c.k} style={{ background: "var(--bg-sunk)", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: c.color, fontFamily: "var(--font-mono)" }}>{c.v}%</div>
                  <div style={{ fontSize: 10.5, color: "var(--fg-muted)", marginTop: 2 }}>{c.k}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 12px", background: "var(--accent-soft)", borderRadius: 8, fontSize: 11.5, color: "var(--accent-ink)", lineHeight: 1.5 }}>
              <b>Top 추천 사유</b> · 워라밸·동료·성장 기회 (전체 응답 72%)
            </div>
          </div>
        </Card>
      </div>

      {/* 1:1 미팅 빈도 vs 이직 위험 상관 */}
      <Card>
        <div className="card-head">
          <span className="title">1:1 미팅 빈도 vs 이직 위험</span>
          <span className="sub">매니저별 · 최근 6개월</span>
        </div>
        <div className="card-pad">
          {(() => {
            // mock 매니저 데이터: [1:1 빈도(월/팀원), 이직 위험(%), 팀명, 팀원수]
            const managers = [
              { x: 0.4, y: 28, name: "박지훈팀", size: 8, color: "var(--danger)" },
              { x: 0.6, y: 22, name: "이상민팀", size: 6, color: "oklch(50% 0.16 60)" },
              { x: 0.8, y: 18, name: "정유진팀", size: 5, color: "oklch(50% 0.16 60)" },
              { x: 1.1, y: 12, name: "최서연팀", size: 7, color: "var(--accent)" },
              { x: 1.4, y: 9,  name: "권하은팀", size: 9, color: "var(--accent)" },
              { x: 1.6, y: 6,  name: "강하준팀", size: 6, color: "var(--success)" },
              { x: 1.9, y: 4,  name: "오민서팀", size: 8, color: "var(--success)" },
              { x: 2.1, y: 3,  name: "한지원팀", size: 5, color: "var(--success)" },
            ];
            const w = 600, h = 220, padL = 40, padB = 36, padT = 10, padR = 14;
            const xMax = 2.5, yMax = 32;
            const px = (v) => padL + (v / xMax) * (w - padL - padR);
            const py = (v) => h - padB - (v / yMax) * (h - padT - padB);
            return (
              <>
                <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
                  {/* 격자 */}
                  {[8, 16, 24, 32].map((v) => (
                    <g key={v}>
                      <line x1={padL} x2={w - padR} y1={py(v)} y2={py(v)} stroke="var(--border)" strokeDasharray="2,3" />
                      <text x={padL - 6} y={py(v) + 4} fontSize="10" fill="var(--fg-faint)" textAnchor="end">{v}%</text>
                    </g>
                  ))}
                  {[0.5, 1, 1.5, 2].map((v) => (
                    <g key={v}>
                      <line x1={px(v)} x2={px(v)} y1={padT} y2={h - padB} stroke="var(--border)" strokeDasharray="2,3" />
                      <text x={px(v)} y={h - padB + 14} fontSize="10" fill="var(--fg-faint)" textAnchor="middle">{v}회</text>
                    </g>
                  ))}
                  {/* 축 레이블 */}
                  <text x={padL - 30} y={padT + 6} fontSize="10" fill="var(--fg-muted)" transform={`rotate(-90 ${padL - 30} ${padT + 6})`}>이직 위험</text>
                  <text x={w / 2} y={h - 4} fontSize="10" fill="var(--fg-muted)" textAnchor="middle">월 1:1 빈도 (팀원당)</text>
                  {/* 트렌드 라인 (역상관) */}
                  <line x1={px(0.2)} y1={py(28)} x2={px(2.2)} y2={py(4)} stroke="var(--fg-faint)" strokeDasharray="3,4" strokeWidth="1" />
                  {/* 산점 */}
                  {managers.map((m, i) => (
                    <g key={i}>
                      <circle cx={px(m.x)} cy={py(m.y)} r={m.size * 1.6} fill={m.color} fillOpacity="0.25" />
                      <circle cx={px(m.x)} cy={py(m.y)} r="4" fill={m.color} />
                      <text x={px(m.x) + 8} y={py(m.y) + 4} fontSize="10" fill="var(--fg-muted)">{m.name}</text>
                    </g>
                  ))}
                </svg>
                <div style={{ marginTop: 8, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  <Icons.Sparkle size={12} style={{ display: "inline", verticalAlign: "middle", color: "var(--accent)", marginRight: 4 }} />
                  <b>강한 역상관</b> · 1:1 빈도가 월 1회 이상인 팀은 이직 위험 평균 <b>9%</b>, 0.5회 미만 팀은 <b>25%</b>. 매니저 코칭 우선순위 명확.
                </div>
              </>
            );
          })()}
        </div>
      </Card>
    </>
  );
}

// ── People Analytics (인력 분석) ──────────────────────
function PeopleAnalytics({ data }) {
  // 직급 × 성별 피라미드 (mock)
  const pyramid = [
    { rank: "임원",   male: 3,  female: 1 },
    { rank: "부장",   male: 5,  female: 2 },
    { rank: "차장",   male: 6,  female: 3 },
    { rank: "과장",   male: 8,  female: 5 },
    { rank: "대리",   male: 10, female: 7 },
    { rank: "주임",   male: 6,  female: 5 },
    { rank: "사원",   male: 4,  female: 4 },
  ];
  const maxRank = Math.max(...pyramid.map((p) => Math.max(p.male, p.female)));

  // 월별 입사/퇴직 (mock)
  const flow = [
    { m: "12월", in: 1, out: 1 },
    { m: "1월",  in: 2, out: 0 },
    { m: "2월",  in: 0, out: 1 },
    { m: "3월",  in: 3, out: 0 },
    { m: "4월",  in: 1, out: 2 },
    { m: "5월",  in: 2, out: 0 },
  ];

  // 부서별 인원 + 변화율 (mock)
  const deptGrowth = [
    { dept: "개발팀",      now: 24, change: +3 },
    { dept: "영업팀",      now: 12, change: 0 },
    { dept: "생산/제조팀",  now: 11, change: -1 },
    { dept: "품질관리팀",   now: 8,  change: +1 },
    { dept: "재무/회계팀",  now: 6,  change: 0 },
    { dept: "인사팀",      now: 4,  change: 0 },
    { dept: "구매/조달팀",  now: 2,  change: -1 },
  ];

  // 입사 채널
  const channels = [
    { ch: "공개 채용",  v: 32, color: 230 },
    { ch: "내부 추천",  v: 18, color: 145 },
    { ch: "헤드헌터",   v: 11, color: 35 },
    { ch: "사내 이동",  v: 6,  color: 290 },
  ];
  const totalCh = channels.reduce((s, c) => s + c.v, 0);

  return (
    <>
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 전사 인원</div>
          <div className="ss-val">67<span className="u">명</span></div>
          <div className="ss-foot"><span className="delta-up">+5</span> 12개월</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Calendar size={13} sw={1.8} /></span> 평균 근속</div>
          <div className="ss-val">4.2<span className="u">년</span></div>
          <div className="ss-foot">중앙값 3.5년</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.UserPlus size={13} sw={1.8} /></span> 신규 입사</div>
          <div className="ss-val">9<span className="u">명</span></div>
          <div className="ss-foot">최근 6개월</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Logout size={13} sw={1.8} /></span> 퇴직</div>
          <div className="ss-val">4<span className="u">명</span></div>
          <div className="ss-foot">최근 6개월 · 이직률 6.0%</div>
        </div>
      </div>

      {/* 직급×성별 피라미드 + 입사 채널 */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">직급 × 성별 분포</span>
            <span className="sub">전체 67명 (남 42 / 여 25)</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", fontSize: 11, color: "var(--fg-faint)", textAlign: "center", marginBottom: 8 }}>
                <div style={{ textAlign: "right", paddingRight: 12 }}>남자</div>
                <div></div>
                <div style={{ textAlign: "left", paddingLeft: 12 }}>여자</div>
              </div>
              {pyramid.map((p) => (
                <div key={p.rank} style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{p.male}</span>
                    <div style={{ height: 16, width: `${(p.male / maxRank) * 100}%`, background: "oklch(60% 0.14 230)", borderRadius: "3px 0 0 3px" }} />
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: "center" }}>{p.rank}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 16, width: `${(p.female / maxRank) * 100}%`, background: "oklch(65% 0.14 25)", borderRadius: "0 3px 3px 0" }} />
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{p.female}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">입사 채널</span>
            <span className="sub">최근 12개월 누계</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
              {channels.map((c) => (
                <div key={c.ch} title={`${c.ch}: ${c.v}명`} style={{
                  flex: c.v,
                  background: `oklch(60% 0.14 ${c.color})`,
                }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {channels.map((c) => (
                <div key={c.ch} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: `oklch(60% 0.14 ${c.color})` }} />
                  <span style={{ flex: 1 }}>{c.ch}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{c.v}명</span>
                  <span style={{ color: "var(--fg-faint)", minWidth: 38, textAlign: "right" }}>{Math.round((c.v / totalCh) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 월별 입사 vs 퇴직 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">월별 입사 vs 퇴직</span>
          <span className="sub">최근 6개월</span>
          <div className="right" style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--fg-muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, background: "var(--success)", borderRadius: 2 }} /> 입사
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, background: "var(--danger)", borderRadius: 2 }} /> 퇴직
            </span>
          </div>
        </div>
        <div className="card-pad">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${flow.length}, 1fr)`, gap: 12, alignItems: "flex-end", height: 160 }}>
            {flow.map((f) => {
              const max = 4;
              return (
                <div key={f.m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
                    <div style={{
                      width: 20,
                      height: `${(f.in / max) * 100}%`,
                      background: "var(--success)",
                      borderRadius: "3px 3px 0 0",
                      minHeight: f.in === 0 ? 2 : 0,
                      opacity: f.in === 0 ? 0.2 : 1,
                    }} title={`입사 ${f.in}`} />
                    <div style={{
                      width: 20,
                      height: `${(f.out / max) * 100}%`,
                      background: "var(--danger)",
                      borderRadius: "3px 3px 0 0",
                      minHeight: f.out === 0 ? 2 : 0,
                      opacity: f.out === 0 ? 0.2 : 1,
                    }} title={`퇴직 ${f.out}`} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{f.m}</div>
                  <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
                    +{f.in} / −{f.out}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 부서별 인원 + 변화율 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">부서별 인원 변화</span>
          <span className="sub">12개월 변화율</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>부서</th>
                <th className="right">현재 인원</th>
                <th className="right">12개월 변화</th>
                <th className="right">변화율</th>
              </tr>
            </thead>
            <tbody>
              {deptGrowth.map((d) => {
                const pct = d.change === 0 ? 0 : Math.round((d.change / (d.now - d.change)) * 100);
                return (
                  <tr key={d.dept}>
                    <td className="fw-6">{d.dept}</td>
                    <td className="right mono tnum">{d.now}명</td>
                    <td className="right mono tnum">
                      <span style={{ color: d.change > 0 ? "var(--success)" : d.change < 0 ? "var(--danger)" : "var(--fg-faint)", fontWeight: 600 }}>
                        {d.change > 0 ? "+" : ""}{d.change}명
                      </span>
                    </td>
                    <td className="right mono tnum">
                      {d.change === 0 ? <span style={{ color: "var(--fg-faint)" }}>±0%</span> :
                        <span style={{ color: d.change > 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                          {d.change > 0 ? "+" : ""}{pct}%
                        </span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 근속 분포 + 연령대 + 고용형태 */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">근속 분포</span>
            <span className="sub">전체 67명 · 평균 4.2년</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, height: 180, alignItems: "flex-end" }}>
              {[
                { range: "0-1년", n: 8, label: "신입" },
                { range: "1-3년", n: 18, label: "" },
                { range: "3-5년", n: 22, label: "중간" },
                { range: "5-10년", n: 14, label: "" },
                { range: "10년+", n: 5, label: "베테랑" },
              ].map((b, i) => {
                const max = 22;
                const pct = (b.n / max) * 100;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--fg)" }}>{b.n}</span>
                    <div style={{
                      width: "70%",
                      height: `${pct}%`,
                      background: `oklch(60% 0.14 ${230 - i * 10})`,
                      borderRadius: "4px 4px 0 0",
                      minHeight: 4,
                    }} />
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "center" }}>{b.range}</div>
                    {b.label && <div style={{ fontSize: 9.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{b.label}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--fg-faint)" }}>
              ※ 3-5년 구간이 가장 두꺼움 (코어 인력 33%). 10년+ 베테랑 7%로 안정적.
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card>
            <div className="card-head" style={{ padding: "10px var(--space-5)" }}>
              <span className="title" style={{ fontSize: 13 }}>연령대 분포</span>
            </div>
            <div className="card-pad" style={{ padding: "14px var(--space-5)" }}>
              {[
                { age: "20대", n: 14, pct: 21 },
                { age: "30대", n: 28, pct: 42 },
                { age: "40대", n: 18, pct: 27 },
                { age: "50대+", n: 7,  pct: 10 },
              ].map((a) => (
                <div key={a.age} style={{ display: "grid", gridTemplateColumns: "44px 1fr 40px", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--fg-muted)" }}>{a.age}</span>
                  <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${a.pct}%`, height: "100%", background: "var(--accent)", borderRadius: 3 }} />
                  </div>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{a.n}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--fg-faint)" }}>평균 연령 <b>34.6세</b></div>
            </div>
          </Card>

          <Card>
            <div className="card-head" style={{ padding: "10px var(--space-5)" }}>
              <span className="title" style={{ fontSize: 13 }}>고용 형태</span>
            </div>
            <div className="card-pad" style={{ padding: "14px var(--space-5)" }}>
              {[
                { type: "정규직", n: 58, color: "var(--success)" },
                { type: "계약직", n: 6,  color: "oklch(50% 0.16 60)" },
                { type: "인턴",   n: 2,  color: "oklch(55% 0.16 290)" },
                { type: "파견",   n: 1,  color: "var(--fg-faint)" },
              ].map((t) => (
                <div key={t.type} style={{ display: "grid", gridTemplateColumns: "44px 1fr 40px", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--fg-muted)" }}>{t.type}</span>
                  <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(t.n / 67) * 100}%`, height: "100%", background: t.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{t.n}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--fg-faint)" }}>정규직 비율 <b>86.6%</b></div>
            </div>
          </Card>
        </div>
      </div>

      {/* 신규 입사자 잔존율 (코호트) + 채용/관리 지표 */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">신규 입사자 잔존율</span>
            <span className="sub">최근 5개 분기 코호트</span>
          </div>
          <div className="card-pad">
            <div className="tbl-wrap">
              <table className="tbl" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>입사 코호트</th>
                    <th className="right">입사</th>
                    <th className="right">3개월</th>
                    <th className="right">6개월</th>
                    <th className="right">12개월</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { q: "2025 Q1", joined: 4, m3: 100, m6: 100, m12: 75 },
                    { q: "2025 Q2", joined: 3, m3: 100, m6: 100, m12: 100 },
                    { q: "2025 Q3", joined: 5, m3: 100, m6: 80,  m12: 80 },
                    { q: "2025 Q4", joined: 2, m3: 100, m6: 100, m12: null },
                    { q: "2026 Q1", joined: 4, m3: 100, m6: null, m12: null },
                  ].map((c) => {
                    const cell = (v) => {
                      if (v == null) return <span style={{ color: "var(--fg-faint)" }}>—</span>;
                      const color = v >= 90 ? "var(--success)" : v >= 75 ? "oklch(50% 0.16 60)" : "var(--danger)";
                      return <span style={{ color, fontWeight: 600 }}>{v}%</span>;
                    };
                    return (
                      <tr key={c.q}>
                        <td className="fw-6">{c.q}</td>
                        <td className="right mono tnum">{c.joined}명</td>
                        <td className="right mono tnum">{cell(c.m3)}</td>
                        <td className="right mono tnum">{cell(c.m6)}</td>
                        <td className="right mono tnum">{cell(c.m12)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--fg-faint)" }}>
              ※ 2025 Q3 코호트 6개월 잔존율 80%로 평소보다 낮음. 온보딩 점검 권장.
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">채용 · 관리 지표</span>
          </div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                포지션 충원 시간
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFeatureSettings: '"tnum"' }}>
                32<span style={{ fontSize: 13, color: "var(--fg-faint)", marginLeft: 4 }}>일</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4 }}>
                평균 (공고 → 입사) · <span style={{ color: "var(--success)", fontWeight: 600 }}>−5일</span> 단축
              </div>
            </div>
            <div style={{ padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                관리 폭 (Span)
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFeatureSettings: '"tnum"' }}>
                6.2<span style={{ fontSize: 13, color: "var(--fg-faint)", marginLeft: 4 }}>명</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4 }}>
                매니저당 직속 부하 · 권장 5~8명
              </div>
            </div>
            <div style={{ padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                사내 이동률
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFeatureSettings: '"tnum"' }}>
                14<span style={{ fontSize: 13, color: "var(--fg-faint)", marginLeft: 4 }}>%</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4 }}>
                전체 채용 중 내부 이동 비중 · 업계 평균 12%
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

// ── Pay Analytics (급여 분석) ─────────────────────────
function PayAnalytics({ data }) {
  const costTrend = [
    { m: "6월", v: 290 }, { m: "7월", v: 295 }, { m: "8월", v: 300 }, { m: "9월", v: 305 },
    { m: "10월", v: 310 }, { m: "11월", v: 308 }, { m: "12월", v: 312 }, { m: "1월", v: 315 },
    { m: "2월", v: 318 }, { m: "3월", v: 320 }, { m: "4월", v: 322 }, { m: "5월", v: 324 },
  ];
  const ranks = [
    { rank: "임원", p25: 130, p50: 150, p75: 180, n: 4, band: "M1-M2" },
    { rank: "부장", p25: 95, p50: 110, p75: 125, n: 7, band: "L5-L6" },
    { rank: "차장", p25: 78, p50: 88, p75: 98, n: 9, band: "L4" },
    { rank: "과장", p25: 65, p50: 72, p75: 80, n: 13, band: "L3" },
    { rank: "대리", p25: 52, p50: 58, p75: 64, n: 17, band: "L2" },
    { rank: "주임", p25: 42, p50: 46, p75: 50, n: 11, band: "L1" },
    { rank: "사원", p25: 35, p50: 38, p75: 42, n: 8, band: "L0" },
  ];
  const deptPay = [
    { dept: "재무/회계팀", avg: 78, color: 290 },
    { dept: "개발팀", avg: 72, color: 230 },
    { dept: "영업팀", avg: 68, color: 35 },
    { dept: "품질관리팀", avg: 64, color: 75 },
    { dept: "인사팀", avg: 62, color: 145 },
    { dept: "생산/제조팀", avg: 58, color: 200 },
    { dept: "구매/조달팀", avg: 56, color: 50 },
  ];
  const benchmark = [
    { rank: "임원", ours: 153, market: 168, gap: -8.9 },
    { rank: "부장", ours: 110, market: 115, gap: -4.3 },
    { rank: "과장", ours: 72, market: 70, gap: +2.9 },
    { rank: "대리", ours: 58, market: 56, gap: +3.6 },
    { rank: "사원", ours: 38, market: 36, gap: +5.6 },
  ];
  const histogram = [
    { range: "~40", n: 8 }, { range: "40-50", n: 14 }, { range: "50-60", n: 16 },
    { range: "60-70", n: 12 }, { range: "70-80", n: 8 }, { range: "80-100", n: 6 }, { range: "100+", n: 5 },
  ];
  const maxHist = Math.max(...histogram.map((h) => h.n));
  const maxBox = Math.max(...ranks.map((r) => r.p75));

  return (
    <>
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Wallet size={13} sw={1.8} /></span> 월 인건비</div>
          <div className="ss-val">₩324<span className="u">M</span></div>
          <div className="ss-foot"><span className="delta-up">+0.6%</span> 전월</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Chart size={13} sw={1.8} /></span> 평균 연봉</div>
          <div className="ss-val">₩62.4<span className="u">M</span></div>
          <div className="ss-foot">전사 67명 기준</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Target size={13} sw={1.8} /></span> 중앙값 (P50)</div>
          <div className="ss-val">₩58<span className="u">M</span></div>
          <div className="ss-foot">시장 +3.6%</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 인건비 비율</div>
          <div className="ss-val">42<span className="u">%</span></div>
          <div className="ss-foot">매출 대비 · 업계 38%</div>
        </div>
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">12개월 인건비 추이</span>
          <span className="sub">단위: 백만원</span>
          <div className="right"><span className="chip warning">+11.7% YoY</span></div>
        </div>
        <div className="card-pad">
          <LineChart data={costTrend} color="oklch(55% 0.16 290)" yMax={350} height={200} />
          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            <b style={{ color: "var(--fg)" }}>인사이트</b> · 12개월간 ₩290M → ₩324M (11.7%↑). 인원 증가(+5명)와 정기 인상(평균 5.2%)이 주 원인.
            다음 분기 채용 5건 진행 시 ₩3.5M 추가 증가 예상.
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">직급별 연봉 분포</span>
          <span className="sub">P25 / 중앙값 / P75</span>
          <div className="right" style={{ fontSize: 11, color: "var(--fg-muted)" }}>단위: 백만원/년</div>
        </div>
        <div className="card-pad">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ranks.map((r) => {
              const start = (r.p25 / maxBox) * 100;
              const mid = (r.p50 / maxBox) * 100;
              const end = (r.p75 / maxBox) * 100;
              return (
                <div key={r.rank} style={{ display: "grid", gridTemplateColumns: "60px 80px 1fr 130px", gap: 10, alignItems: "center", fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{r.rank}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontSize: 10.5 }}>{r.band} · {r.n}명</span>
                  <div style={{ position: "relative", height: 24, background: "var(--bg-sunk)", borderRadius: 4 }}>
                    <div style={{ position: "absolute", left: `${start}%`, width: `${end - start}%`, top: 4, bottom: 4, background: "oklch(80% 0.08 230)", borderRadius: 3 }} />
                    <div style={{ position: "absolute", left: `${mid}%`, top: 0, bottom: 0, width: 2, background: "var(--accent)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
                    <span>{r.p25}</span>
                    <span style={{ color: "var(--accent)", fontWeight: 700 }}>{r.p50}</span>
                    <span>{r.p75}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head"><span className="title">부서별 평균 연봉</span><span className="sub">단위: 백만원/년</span></div>
          <div className="card-pad">
            <div className="bar-chart">
              {deptPay.map((d) => (
                <div key={d.dept} className="bar-row">
                  <span className="lbl">{d.dept}</span>
                  <div className="track"><i style={{ width: `${(d.avg / 80) * 100}%`, "--bar-hue": d.color }} /></div>
                  <span className="pct">₩{d.avg}M</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="card-head"><span className="title">연봉 분포 히스토그램</span><span className="sub">전체 67명</span></div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${histogram.length}, 1fr)`, gap: 4, alignItems: "flex-end", height: 160 }}>
              {histogram.map((h, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{h.n}</span>
                  <div style={{ width: "70%", height: `${(h.n / maxHist) * 100}%`, background: `oklch(60% 0.14 ${230 + i * 8})`, borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                  <div style={{ fontSize: 10, color: "var(--fg-faint)", textAlign: "center" }}>{h.range}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--fg-faint)", textAlign: "center" }}>연봉 구간 (백만원)</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <span className="title">시장 벤치마크 비교</span>
          <span className="sub">중앙값 기준 · 유사 업종 외부 데이터</span>
          <div className="right"><span className="chip" style={{ fontSize: 10.5 }}>출처: Mercer 2025</span></div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>직급</th><th className="right">우리 (중앙값)</th><th className="right">시장 (중앙값)</th><th className="right">격차</th></tr>
            </thead>
            <tbody>
              {benchmark.map((b) => {
                const color = b.gap >= 0 ? "var(--success)" : b.gap >= -5 ? "oklch(50% 0.16 60)" : "var(--danger)";
                return (
                  <tr key={b.rank}>
                    <td className="fw-6">{b.rank}</td>
                    <td className="right mono tnum">₩{b.ours}M</td>
                    <td className="right mono tnum" style={{ color: "var(--fg-muted)" }}>₩{b.market}M</td>
                    <td className="right mono tnum"><span style={{ color, fontWeight: 700 }}>{b.gap > 0 ? "+" : ""}{b.gap}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "14px var(--space-6)", background: "var(--bg-sunk)", fontSize: 12.5, color: "var(--fg-muted)", borderTop: "1px solid var(--border)", lineHeight: 1.6 }}>
          <b style={{ color: "var(--fg)" }}>인사이트</b> · 임원·부장급은 시장 대비 4~9% 낮음 (이탈 위험), 사원·대리급은 +3~6% 경쟁력 양호.
          상위 직급 보상 정책 재검토 권장.
        </div>
      </Card>
    </>
  );
}

// ── Performance Analytics (성과 분석) ────────────────
function PerfAnalytics({ data }) {
  // 평가 등급 분포 (O/E/M/S)
  const grades = [
    { g: "O", label: "Outstanding", n: 4,  color: 290 },
    { g: "E", label: "Excellent",   n: 14, color: 230 },
    { g: "M", label: "Meets",       n: 40, color: 145 },
    { g: "S", label: "Below",       n: 9,  color: 25 },
  ];
  const totalGrade = grades.reduce((s, g) => s + g.n, 0);

  // 4×4 캘리브레이션 그리드 (성과 S→M→E→O / 잠재력 S→M→E→O)
  // 행: 잔재력 위에서 아래 (O→S)
  // 열: 성과 좌에서 우 (S→O)
  const grid4x4 = [
    [0, 1, 2, 2],  // 잔재력 O
    [1, 4, 8, 3],  // 잔재력 E
    [3, 10, 20, 2], // 잔재력 M
    [5, 5, 1, 0],  // 잔재력 S
  ];
  const gridLabels = [
    ["Risk",      "Hidden Gem",  "Rising Star", "Star ⭐"],
    ["Develop",   "Solid ⬢",     "High Pro",    "Future Leader"],
    ["Coach",     "Effective",   "Core",        "Trusted Pro"],
    ["PIP",       "Inconsistent","Workhorse",   "Specialist"],
  ];
  const axisPot = ["O", "E", "M", "S"];  // 위 → 아래
  const axisPerf = ["S", "M", "E", "O"]; // 좌 → 우

  // 셀 색: 주대각선 상 극대각선 → 극 좌하/우상이 이상치
  // 고성과+고잠재 (우상) Star → green/purple, 저성과+저잠재 (좌하) Risk → red, 대각선 = blue
  const cellTone = (ri, ci) => {
    const score = (3 - ri) + ci; // 0 ~ 6
    if (score >= 5) return { color: "oklch(55% 0.18 290)", bg: "oklch(96% 0.05 290)" }; // top performers
    if (score >= 4) return { color: "oklch(55% 0.14 145)", bg: "oklch(96% 0.04 145)" }; // strong
    if (score >= 2) return { color: "oklch(45% 0.10 230)", bg: "oklch(96% 0.03 230)" }; // core
    if (score >= 1) return { color: "oklch(55% 0.16 60)",  bg: "var(--wd-orange-soft)" }; // dev
    return { color: "oklch(58% 0.18 25)", bg: "oklch(96% 0.05 25)" }; // risk
  };

  // 부서별 평가 분포
  const deptPerf = [
    { dept: "재무/회계팀", O: 1, E: 2, M: 3, S: 0 },
    { dept: "개발팀",     O: 2, E: 6, M: 14, S: 2 },
    { dept: "영업팀",     O: 0, E: 2, M: 8, S: 2 },
    { dept: "품질관리팀", O: 1, E: 2, M: 4, S: 1 },
    { dept: "인사팀",     O: 0, E: 1, M: 3, S: 0 },
    { dept: "생산/제조팀", O: 0, E: 1, M: 6, S: 4 },
  ];

  // MBO 달성률 분포 히스토그램
  const mboBuckets = [
    { range: "<60%", n: 2 }, { range: "60-80%", n: 8 }, { range: "80-100%", n: 22 },
    { range: "100-120%", n: 25 }, { range: "120-140%", n: 8 }, { range: "140%+", n: 2 },
  ];
  const maxMbo = Math.max(...mboBuckets.map((b) => b.n));

  return (
    <>
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 평가 완료율</div>
          <div className="ss-val">87<span className="u">%</span></div>
          <div className="ss-foot">58 / 67명</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Target size={13} sw={1.8} /></span> 중앙값 등급</div>
          <div className="ss-val" style={{ fontSize: 26 }}>M</div>
          <div className="ss-foot">Meets 기준 충족</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Trophy size={13} sw={1.8} /></span> High Performer</div>
          <div className="ss-val">27<span className="u">%</span></div>
          <div className="ss-foot">O+E 등급 18명</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> Below Expectation</div>
          <div className="ss-val">13<span className="u">%</span></div>
          <div className="ss-foot">S 등급 · 코칭 권장</div>
        </div>
      </div>

      {/* 등급 분포 + MBO 분포 */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">평가 등급 분포</span>
            <span className="sub">전사 {totalGrade}명</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
              {grades.map((g) => (
                <div key={g.g} title={`${g.g} (${g.label}): ${g.n}명`} style={{ flex: g.n, background: `oklch(60% 0.14 ${g.color})`, position: "relative", display: "grid", placeItems: "center" }}>
                  <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>{g.g}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {grades.map((g) => (
                <div key={g.g} style={{ textAlign: "center", padding: "10px 6px", background: "var(--bg-sunk)", borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: `oklch(45% 0.16 ${g.color})`, fontFamily: "var(--font-mono)" }}>{g.n}</div>
                  <div style={{ fontSize: 10.5, color: "var(--fg)", marginTop: 2, fontWeight: 600 }}>{g.g} · {g.label}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 1 }}>{Math.round((g.n / totalGrade) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">MBO 달성률 분포</span>
            <span className="sub">목표 대비 실적</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${mboBuckets.length}, 1fr)`, gap: 4, alignItems: "flex-end", height: 160 }}>
              {mboBuckets.map((b, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.n}</span>
                  <div style={{
                    width: "72%",
                    height: `${(b.n / maxMbo) * 100}%`,
                    background: i < 2 ? "var(--danger)" : i < 3 ? "oklch(50% 0.16 60)" : "var(--success)",
                    borderRadius: "3px 3px 0 0",
                    minHeight: 4,
                  }} />
                  <div style={{ fontSize: 9.5, color: "var(--fg-faint)", textAlign: "center" }}>{b.range}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--fg-faint)" }}>
              ※ 100% 이상 달성 <b>52%</b> · 80% 미만 <b>15%</b> (코칭 권장)
            </div>
          </div>
        </Card>
      </div>

      {/* 4×4 Calibration Grid */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">캘리브레이션 그리드</span>
          <span className="sub">성과 × 잠재력 (O/E/M/S)</span>
          <div className="right"><button className="btn sm"><Icons.Sparkle size={11} /> 캘리브레이션 회의</button></div>
        </div>
        <div className="card-pad">
          <div style={{ display: "grid", gridTemplateColumns: "24px 36px 1fr", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              잠재력 ↑
            </div>
            <div style={{ display: "grid", gridTemplateRows: "repeat(4, 1fr)", gap: 6, alignItems: "stretch" }}>
              {axisPot.map((a) => (
                <div key={a} style={{ display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--fg-muted)" }}>{a}</div>
              ))}
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: 6 }}>
                {grid4x4.map((row, ri) =>
                  row.map((val, ci) => {
                    const tone = cellTone(ri, ci);
                    return (
                      <div key={`${ri}-${ci}`} style={{
                        background: tone.bg,
                        border: `1.5px solid ${tone.color}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        minHeight: 84,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        cursor: val > 0 ? "pointer" : "default",
                        opacity: val === 0 ? 0.55 : 1,
                      }}>
                        <div style={{ fontSize: 9.5, fontWeight: 600, color: tone.color, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2 }}>
                          {gridLabels[ri][ci]}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 600, color: tone.color, letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"', lineHeight: 1 }}>
                          {val}<span style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 500, marginLeft: 3 }}>명</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8, fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--fg-muted)", textAlign: "center" }}>
                {axisPerf.map((a) => <span key={a}>{a}</span>)}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg-faint)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>성과 →</div>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.6 }}>
            <b style={{ color: "var(--fg)" }}>인사이트</b> · Star (우상단) 2명, Future Leader 3명 식별. Risk/PIP 구간 5명은 코칭 또는 관리 계획 권장.
            Core (중앙) 20명이 조직의 중추.
          </div>
        </div>
      </Card>

      {/* 부서별 평가 분포 */}
      <Card>
        <div className="card-head">
          <span className="title">부서별 평가 분포</span>
          <span className="sub">상대 평가 강제 비율 비교</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>부서</th>
                <th className="right">O</th>
                <th className="right">E</th>
                <th className="right">M</th>
                <th className="right">S</th>
                <th style={{ width: 200 }}>분포</th>
              </tr>
            </thead>
            <tbody>
              {deptPerf.map((d) => {
                const total = d.O + d.E + d.M + d.S;
                return (
                  <tr key={d.dept}>
                    <td className="fw-6">{d.dept}</td>
                    <td className="right mono tnum">{d.O}</td>
                    <td className="right mono tnum">{d.E}</td>
                    <td className="right mono tnum">{d.M}</td>
                    <td className="right mono tnum">{d.S}</td>
                    <td>
                      <div style={{ display: "flex", height: 12, borderRadius: 3, overflow: "hidden" }}>
                        {["O", "E", "M", "S"].map((g, gi) => {
                          const hue = [290, 230, 145, 25][gi];
                          return (
                            <div key={g} style={{ flex: d[g] || 0.001, background: `oklch(60% 0.14 ${hue})` }} title={`${g}: ${d[g]}명`} />
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "14px var(--space-6)", background: "var(--bg-sunk)", fontSize: 12.5, color: "var(--fg-muted)", borderTop: "1px solid var(--border)", lineHeight: 1.6 }}>
          <b style={{ color: "var(--fg)" }}>인사이트</b> · 생산/제조팀·영업팀에 S 등급 집중. 매니저 평가 일관성 검증 + 캘리브레이션 회의 권장.
        </div>
      </Card>
    </>
  );
}

// ── Churn Prediction (이직 예측) ──────────────────────
function ChurnAnalytics({ data }) {
  // 위험군 분포
  const riskGroups = [
    { level: "HIGH",   n: 5,  color: "var(--danger)",      pct: 7.5 },
    { level: "MEDIUM", n: 12, color: "oklch(50% 0.16 60)", pct: 17.9 },
    { level: "LOW",    n: 50, color: "var(--success)",     pct: 74.6 },
  ];

  // 위험 요인 분석
  const factors = [
    { name: "워라밸 (OT/연차)",    weight: 28, color: 60 },
    { name: "보상 경쟁력",        weight: 24, color: 290 },
    { name: "성과·평가 결과",      weight: 18, color: 145 },
    { name: "매니저 관계",         weight: 15, color: 230 },
    { name: "근속 (1-3년 위험)",    weight: 9,  color: 35 },
    { name: "기타",               weight: 6,  color: 200 },
  ];

  // 위험 명단 Top 10
  const watchlist = [
    { name: "박지훈", dept: "생산기술팀", score: 87, tenure: 1.8, grade: "S", signals: ["주 52h 한도", "연차 사용 8%", "보상 불만 표명"] },
    { name: "정유진", dept: "재무/회계팀", score: 81, tenure: 2.1, grade: "M", signals: ["1:1 미팅 회피", "외부 면접 추정"] },
    { name: "이상민", dept: "영업팀",     score: 78, tenure: 4.5, grade: "M", signals: ["OT 14h+ 누적", "팀장 관계 악화"] },
    { name: "권하은", dept: "생산/제조팀", score: 74, tenure: 1.2, grade: "M", signals: ["보상 시장 −9%", "성과 정체"] },
    { name: "최서연", dept: "개발팀",     score: 71, tenure: 2.3, grade: "E", signals: ["고성과 + 보상 격차", "스카웃 가능성"] },
    { name: "김민지", dept: "영업팀",     score: 68, tenure: 3.0, grade: "M", signals: ["연차 0일 사용", "Engagement 점수 낮음"] },
    { name: "오승현", dept: "구매/조달팀", score: 64, tenure: 1.5, grade: "S", signals: ["코칭 진행 중", "잔존 의사 불명확"] },
    { name: "윤지호", dept: "개발팀",     score: 61, tenure: 5.2, grade: "M", signals: ["승진 지연", "팀 변경 희망"] },
  ];

  // 부서별 이직률
  const deptChurn = [
    { dept: "개발팀",      rate: 8.3, target: 6 },
    { dept: "영업팀",      rate: 16.7, target: 10 },
    { dept: "생산기술팀",   rate: 14.3, target: 8 },
    { dept: "생산/제조팀",  rate: 9.1, target: 8 },
    { dept: "품질관리팀",   rate: 0.0, target: 6 },
    { dept: "재무/회계팀",  rate: 16.7, target: 6 },
    { dept: "인사팀",      rate: 0.0, target: 6 },
  ];

  // 이직률 추이 + 예측
  const trend = [
    { m: "6월", v: 4.5 }, { m: "7월", v: 4.8 }, { m: "8월", v: 5.0 }, { m: "9월", v: 5.3 },
    { m: "10월", v: 5.5 }, { m: "11월", v: 5.7 }, { m: "12월", v: 5.9 }, { m: "1월", v: 6.0 },
    { m: "2월", v: 6.0 }, { m: "3월", v: 6.0 }, { m: "4월", v: 6.0 }, { m: "5월", v: 6.0 },
    { m: "6월 (예측)", v: 6.5 }, { m: "7월 (예측)", v: 7.2 }, { m: "8월 (예측)", v: 7.8 },
  ];

  return (
    <>
      <div className="wd-stat-strip">
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 고위험</div>
          <div className="ss-val">5<span className="u">명</span></div>
          <div className="ss-foot">3개월 내 이직 가능성 ↑</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 중위험</div>
          <div className="ss-val">12<span className="u">명</span></div>
          <div className="ss-foot">관찰·대응 필요</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 저위험</div>
          <div className="ss-val">50<span className="u">명</span></div>
          <div className="ss-foot">전사 75%</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Chart size={13} sw={1.8} /></span> 예측 이직률</div>
          <div className="ss-val">7.8<span className="u">%</span></div>
          <div className="ss-foot"><span className="delta-up">+1.8%p</span> 3개월 후</div>
        </div>
      </div>

      {/* 위험 요인 분석 + 위험군 분포 */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">이직 위험 요인 분석</span>
            <span className="sub">기여도 (%)</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {factors.map((f) => (
                <div key={f.name} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 40px", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                  <span>{f.name}</span>
                  <div style={{ height: 8, background: "var(--bg-sunk)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${f.weight * 3}%`, height: "100%", background: `oklch(60% 0.14 ${f.color})`, borderRadius: 4 }} />
                  </div>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{f.weight}%</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--fg)" }}>인사이트</b> · 워라밸·보상이 전체 위험의 52% 차지. 정기 1:1 면담 + 시장 벤치마크 반영 권장.
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">위험군 분포</span>
            <span className="sub">전사 67명 기준</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
              {riskGroups.map((r) => (
                <div key={r.level} title={`${r.level}: ${r.n}명`} style={{ flex: r.n, background: r.color, display: "grid", placeItems: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
                  {r.level}
                </div>
              ))}
            </div>
            {riskGroups.map((r) => (
              <div key={r.level} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: 10, alignItems: "center", marginBottom: 10, fontSize: 12.5 }}>
                <span style={{
                  background: `oklch(from ${r.color} 96% 0.05 h)`,
                  color: r.color,
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 4,
                  textAlign: "center",
                }}>{r.level}</span>
                <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r.pct}%`, height: "100%", background: r.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, minWidth: 60, textAlign: "right" }}>{r.n}명 · {r.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 위험 명단 Top */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">위험 명단 Top {watchlist.length}</span>
          <span className="sub">우선 대응 권장</span>
          <div className="right">
            <button className="btn sm"><Icons.Mail size={11} sw={2} /> 1:1 일괄 예약</button>
            <button className="btn sm"><Icons.Download size={11} sw={2} /> 엑셀</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>직원</th>
                <th>부서</th>
                <th className="right">위험 점수</th>
                <th className="right">근속</th>
                <th>등급</th>
                <th>주요 신호</th>
                <th className="right">액션</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((p) => {
                const color = p.score >= 80 ? "var(--danger)" : p.score >= 70 ? "oklch(50% 0.16 60)" : "oklch(55% 0.16 60)";
                return (
                  <tr key={p.name}>
                    <td>
                      <div className="person">
                        <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 47) % 360} size="sm" />
                        <span className="fw-6">{p.name}</span>
                      </div>
                    </td>
                    <td>{p.dept}</td>
                    <td className="right">
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        fontSize: 14,
                        color,
                        background: `oklch(from ${color} 96% 0.05 h)`,
                        padding: "2px 10px",
                        borderRadius: 999,
                      }}>{p.score}</span>
                    </td>
                    <td className="right mono tnum">{p.tenure}년</td>
                    <td className="mono fw-6">{p.grade}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.signals.map((s, i) => (
                          <span key={i} className="chip" style={{ fontSize: 10.5, padding: "2px 7px" }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="right">
                      <button className="btn sm btn-primary"><Icons.Mail size={11} /> 1:1</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 부서별 이직률 + 추이 */}
      <div className="grid-2">
        <Card>
          <div className="card-head">
            <span className="title">부서별 이직률</span>
            <span className="sub">목표 대비</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {deptChurn.map((d) => {
                const over = d.rate > d.target;
                const color = over ? "var(--danger)" : d.rate === 0 ? "var(--success)" : "var(--accent)";
                return (
                  <div key={d.dept} style={{ display: "grid", gridTemplateColumns: "110px 1fr 80px", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                    <span style={{ color: "var(--fg-muted)" }}>{d.dept}</span>
                    <div style={{ position: "relative", height: 10, background: "var(--bg-sunk)", borderRadius: 3 }}>
                      <div style={{ position: "absolute", left: `${(d.target / 20) * 100}%`, top: -2, bottom: -2, width: 1, background: "var(--fg-faint)" }} title={`목표 ${d.target}%`} />
                      <div style={{ width: `${(d.rate / 20) * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
                    </div>
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color }}>{d.rate.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--fg-faint)" }}>
              ※ 회색 선 = 부서별 목표 이직률
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">이직률 추이 + 예측</span>
            <span className="sub">12개월 + 3개월 예측</span>
          </div>
          <div className="card-pad">
            <LineChart data={trend} color="var(--danger)" yMax={10} height={200} />
            <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--wd-orange-soft)", borderRadius: 8, fontSize: 12, color: "var(--wd-orange-ink)", lineHeight: 1.5, fontWeight: 500 }}>
              ⚠️ 3개월 내 이직률 <b>7.8%</b>까지 상승 예상. 고위험군 5명 즉시 대응 시 6.5%로 완화 가능.
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

// ── AI Report (AI 리포트) ─────────────────────────────
function AIReport({ data }) {
  const findings = [
    {
      icon: "Alert",
      title: "결재 적체가 작년 동기 대비 +250% 증가",
      sub: "박지훈·정유진·권하은 등 3명의 휴가 신청이 5일 이상 미처리",
      severity: "high",
      color: "var(--danger)",
      bg: "oklch(96% 0.05 25)",
      confidence: 95,
    },
    {
      icon: "Alert",
      title: "5명에게서 번아웃 위험 신호 감지",
      sub: "박지훈 8주 연속 주 52시간 한도 근접 + 연차 사용률 20% 미만",
      severity: "high",
      color: "var(--danger)",
      bg: "oklch(96% 0.05 25)",
      confidence: 88,
    },
    {
      icon: "Calendar",
      title: "연말 연차 미소진 86.9% 예상",
      sub: "전사 평균 잔여 10.3일 · 분기별 강제 소진 캠페인 검토 필요",
      severity: "medium",
      color: "oklch(50% 0.16 60)",
      bg: "var(--wd-orange-soft)",
      confidence: 82,
    },
    {
      icon: "Trophy",
      title: "Star Performer 2명 식별 (Future Leader 후보)",
      sub: "최서연·윤지호 — 4×4 캘리브레이션 우상단 위치, 승계 계획 수립 권장",
      severity: "info",
      color: "oklch(45% 0.16 290)",
      bg: "oklch(94% 0.05 290)",
      confidence: 91,
    },
    {
      icon: "UserPlus",
      title: "2025 Q3 코호트 잔존율 80% (평소 95%)",
      sub: "온보딩 품질 점검 + 버디 매칭 강화 권장",
      severity: "medium",
      color: "oklch(50% 0.16 60)",
      bg: "var(--wd-orange-soft)",
      confidence: 79,
    },
  ];

  const actions = [
    { title: "고위험군 5명 1:1 면담 일괄 예약", impact: "이직 위험 −40%", urgency: "이번 주", color: "var(--danger)" },
    { title: "결재 적체 직접 해결 (3건 5일+)", impact: "처리 시간 −60%", urgency: "오늘", color: "var(--danger)" },
    { title: "MBO 미제출자 35명에게 리마인더 발송", impact: "제출률 +30%", urgency: "이번 주", color: "oklch(50% 0.16 60)" },
    { title: "임원·부장급 보상 정책 재검토 회의 소집", impact: "상위 이직 −25%", urgency: "이번 달", color: "oklch(50% 0.16 60)" },
    { title: "분기별 강제 연차 소진 캠페인 발송", impact: "미소진 −20%p", urgency: "이번 주", color: "var(--accent-ink)" },
  ];

  const accuracy = [
    { metric: "이직 예측", actual: "예측 6명 → 실제 5명", score: 89 },
    { metric: "번아웃 감지", actual: "예측 8명 → 실제 7명", score: 87 },
    { metric: "성과 분포", actual: "MAE 0.4 등급", score: 92 },
    { metric: "연차 미소진 예상", actual: "예측 88% → 실제 86.9%", score: 95 },
  ];

  const sources = [
    { src: "Workday HRIS", category: "직원·근태·휴가·급여", freshness: "실시간" },
    { src: "Slack Engagement", category: "Engagement 점수", freshness: "주간" },
    { src: "Mercer Comp 2025", category: "시장 보상 벤치마크", freshness: "분기" },
    { src: "Performance Reviews", category: "평가·MBO", freshness: "분기" },
    { src: "1:1 메모", category: "매니저 관계·정성 신호", freshness: "주간" },
  ];

  return (
    <>
      {/* AI Hero */}
      <div style={{
        background: "linear-gradient(135deg, oklch(38% 0.10 260) 0%, oklch(28% 0.12 290) 100%)",
        borderRadius: 16,
        padding: "24px 28px",
        marginBottom: "var(--space-4)",
        position: "relative",
        overflow: "hidden",
        color: "white",
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "22px 22px", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center" }}>
            <Icons.Sparkle size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              AI 인사 리포트 · 2026년 5월 17일
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", marginTop: 4 }}>
              이번 주 핵심 발견 5가지 + 권장 액션 5가지
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              매주 월요일 09:00 자동 생성 · Mock-AI v2.4 · 학습 데이터 18개월
            </div>
          </div>
          <button className="btn" style={{ background: "white", color: "oklch(28% 0.10 260)", borderColor: "white", fontWeight: 600 }}>
            <Icons.Download size={13} /> PDF
          </button>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 긴급 발견</div>
          <div className="ss-val">{findings.filter((f) => f.severity === "high").length}<span className="u">건</span></div>
          <div className="ss-foot">즉시 대응 권장</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 주의 발견</div>
          <div className="ss-val">{findings.filter((f) => f.severity === "medium").length}<span className="u">건</span></div>
          <div className="ss-foot">이번 주 검토</div>
        </div>
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Sparkle size={13} sw={1.8} /></span> 권장 액션</div>
          <div className="ss-val">{actions.length}<span className="u">건</span></div>
          <div className="ss-foot">바로 실행 가능</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Target size={13} sw={1.8} /></span> 평균 정확도</div>
          <div className="ss-val">{Math.round(accuracy.reduce((s, a) => s + a.score, 0) / accuracy.length)}<span className="u">%</span></div>
          <div className="ss-foot">최근 3개월 트랙</div>
        </div>
      </div>

      {/* 핵심 발견 */}
      <div className="wd-section-h">
        <h3>이번 주 핵심 발견</h3>
        <span className="sub">우선순위 정렬 · 신뢰도 표기</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "var(--space-5)" }}>
        {findings.map((f, i) => {
          const I = Icons[f.icon];
          return (
            <div key={i} style={{
              background: f.bg,
              borderRadius: 12,
              padding: "14px 18px",
              borderLeft: `3px solid ${f.color}`,
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto",
              gap: 14,
              alignItems: "center",
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-elev)", color: f.color, display: "grid", placeItems: "center" }}>
                <I size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: f.color, marginBottom: 3 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, marginRight: 8, opacity: 0.7 }}>#{i + 1}</span>
                  {f.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>{f.sub}</div>
              </div>
              <span className="chip" style={{
                background: "var(--bg-elev)",
                color: "var(--fg-muted)",
                fontSize: 11,
                border: "1px solid var(--border)",
              }}>
                신뢰도 {f.confidence}%
              </span>
              <button className="btn sm" style={{ background: "var(--bg-elev)" }}>자세히</button>
            </div>
          );
        })}
      </div>

      {/* 권장 액션 + 모델 정확도 */}
      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">권장 액션</span>
            <span className="sub">{actions.length}건 · 영향도 정렬</span>
          </div>
          <div className="list">
            {actions.map((a, i) => (
              <div key={i} className="item" style={{ padding: "12px var(--space-6)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `oklch(from ${a.color} 96% 0.05 h)`, color: a.color, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  {i + 1}
                </div>
                <div className="grow">
                  <div className="title">{a.title}</div>
                  <div className="meta">
                    <span style={{ color: a.color, fontWeight: 600 }}>{a.impact}</span>
                    <span className="sep">·</span>
                    <span>마감 {a.urgency}</span>
                  </div>
                </div>
                <button className="btn sm btn-primary">실행</button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">모델 정확도</span>
            <span className="sub">최근 3개월</span>
          </div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {accuracy.map((a) => {
              const color = a.score >= 90 ? "var(--success)" : a.score >= 80 ? "oklch(50% 0.16 60)" : "var(--danger)";
              return (
                <div key={a.metric} style={{ padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{a.metric}</span>
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color }}>{a.score}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 3 }}>{a.actual}</div>
                  <div style={{ height: 4, background: "var(--bg-elev)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: `${a.score}%`, height: "100%", background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 데이터 출처 + 질문 입력창 */}
      <div className="grid-2">
        <Card>
          <div className="card-head">
            <span className="title">데이터 출처</span>
            <span className="sub">{sources.length}개 소스</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>출처</th><th>데이터</th><th className="right">갱신</th></tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.src}>
                    <td className="fw-6">{s.src}</td>
                    <td style={{ fontSize: 12 }}>{s.category}</td>
                    <td className="right"><span className="chip" style={{ fontSize: 10.5 }}>{s.freshness}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">AI에게 물어보기</span>
            <span className="sub">자연어 질의</span>
          </div>
          <div className="card-pad">
            <div style={{ position: "relative" }}>
              <textarea
                className="input"
                placeholder="예: 영업팀의 이직 위험은? / 개발팀 보상 경쟁력은 어떤가요?"
                style={{ width: "100%", minHeight: 80, padding: "12px 14px", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                "이번 분기 가장 큰 위험은?",
                "고위험 직원 명단 보여줘",
                "예산 대비 인건비 추이",
                "온보딩 지연 원인",
              ].map((q) => (
                <button key={q} className="chip" style={{ cursor: "pointer", background: "var(--bg-sunk)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}>
                  {q}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>
              <Icons.Sparkle size={13} /> AI 분석 요청
            </button>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--fg-faint)", textAlign: "center" }}>
              질의 응답은 학습 데이터 18개월 + 실시간 HRIS 기반 · 답변 5-10초 소요
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function InsightsPage({ data, sub = "exec" }) {
  const titleMap = {
    exec: ["Executive Summary", "전사 핵심 지표를 한눈에 확인해요."],
    attn: ["근태 분석", "근태 패턴과 이상치를 확인해요"],
    health: ["팀 헬스", "팀 건강도와 리스크 지표를 확인해요"],
    people: ["인력 분석", "조직 구조와 인력 변동을 분석해요."],
    pay:   ["급여 분석", "급여 비용과 분포를 분석해요."],
    perf:  ["성과 분석", "성과 분포와 추세를 분석해요."],
    churn: ["이직 예측", "이직 위험군을 사전에 식별해요."],
    ai:    ["AI 리포트", "AI가 생성한 인사 리포트를 확인해요."],
  };
  const [title, sub2] = titleMap[sub] || titleMap.exec;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>{title}</h1>
          <div className="greet-sub">{sub2}</div>
        </div>
        {sub === "attn" && (
          <div className="right">
            <select className="select" defaultValue="group">
              <option value="group">그룹 합산</option>
            </select>
            <select className="select" defaultValue="all-hq"><option>전체 본부</option></select>
            <select className="select" defaultValue="all-team"><option>전체 팀</option></select>
            <select className="select" defaultValue="12m"><option>최근 12개월</option></select>
          </div>
        )}
      </div>

      {sub === "exec"   && <ExecutiveSummary  data={data}/>}
      {sub === "attn"   && <AttendanceAnalytics data={data}/>}
      {sub === "health" && <TeamHealth        data={data}/>}
      {sub === "people" && <PeopleAnalytics data={data}/>}
      {sub === "pay" && <PayAnalytics data={data}/>}
      {sub === "perf" && <PerfAnalytics data={data}/>}
      {sub === "churn" && <ChurnAnalytics data={data}/>}
      {sub === "ai" && <AIReport data={data}/>}
    </div>
  );
}

Object.assign(window, { InsightsPage, LineChart, BarChart, Funnel, Gauge, PeopleAnalytics, PayAnalytics, PerfAnalytics, ChurnAnalytics, AIReport });
