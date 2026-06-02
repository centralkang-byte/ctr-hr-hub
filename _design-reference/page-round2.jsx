/* global React, Icons, Avatar, Card, ToastContext, fmtKDate */
// CTR HR Hub — Round 2: 연말정산 + 글로벌 급여

const { useState: useStateR2, useContext: useCtxR2, useMemo: useMemoR2 } = React;

// ═══════════════════════════════════════════════════════════
// 1. 연말정산 (Year-End Settlement)
// ═══════════════════════════════════════════════════════════

const YE_STEPS = [
  { id: 1, label: "자료 수집",   sub: "직원 자료 업로드" },
  { id: 2, label: "검토",       sub: "공제 항목 확인" },
  { id: 3, label: "산정",       sub: "환급/추가징수 계산" },
  { id: 4, label: "결재",       sub: "관리자 승인" },
  { id: 5, label: "신고",       sub: "국세청 제출" },
];

const YE_EMPLOYEES = [
  { name: "한지영", dept: "인사팀",     step: 5, refund: +458000, status: "신고 완료" },
  { name: "박지훈", dept: "생산기술팀",  step: 4, refund: -120000, status: "결재 대기" },
  { name: "최서연", dept: "개발팀",     step: 3, refund: +680000, status: "산정 중" },
  { name: "정유진", dept: "재무/회계팀", step: 5, refund: +210000, status: "신고 완료" },
  { name: "이상민", dept: "영업팀",     step: 2, refund: null,    status: "자료 검토" },
  { name: "권하은", dept: "생산/제조팀", step: 1, refund: null,    status: "자료 누락" },
  { name: "김민지", dept: "인사팀",     step: 5, refund: +325000, status: "신고 완료" },
  { name: "윤도현", dept: "영업팀",     step: 3, refund: +120000, status: "산정 중" },
];

function YearEndPage({ data }) {
  const toast = useCtxR2(ToastContext);
  const [year, setYear] = useStateR2(2025);
  const [tab, setTab] = useStateR2("overview");

  const totalRefund = YE_EMPLOYEES.filter((e) => e.refund && e.refund > 0).reduce((s, e) => s + e.refund, 0);
  const totalCharge = YE_EMPLOYEES.filter((e) => e.refund && e.refund < 0).reduce((s, e) => s + Math.abs(e.refund), 0);
  const completed = YE_EMPLOYEES.filter((e) => e.step === 5).length;
  const missing = YE_EMPLOYEES.filter((e) => e.status === "자료 누락").length;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>연말정산</h1>
          <div className="greet-sub">{year}년 귀속분 연말정산 진행 상황을 관리해요.</div>
        </div>
        <div className="right">
          <select className="select" value={year} onChange={(e) => setYear(+e.target.value)}>
            <option value={2025}>2025년 귀속분</option>
            <option value={2024}>2024년 귀속분</option>
          </select>
          <button className="btn"><Icons.Download size={13} sw={2} /> 일괄 다운로드</button>
          <button className="btn btn-primary"><Icons.Mail size={13} sw={2} /> 자료 안내 발송</button>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 환급 대상</div>
          <div className="ss-val">{YE_EMPLOYEES.filter((e) => e.refund && e.refund > 0).length}<span className="u">명</span></div>
          <div className="ss-foot">총 ₩{(totalRefund / 10000).toFixed(0)}만</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 추가 징수</div>
          <div className="ss-val">{YE_EMPLOYEES.filter((e) => e.refund && e.refund < 0).length}<span className="u">명</span></div>
          <div className="ss-foot">총 ₩{(totalCharge / 10000).toFixed(0)}만</div>
        </div>
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Doc size={13} sw={1.8} /></span> 진행 중</div>
          <div className="ss-val">{YE_EMPLOYEES.length - completed}<span className="u">명</span></div>
          <div className="ss-foot">단계별 처리 필요</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 자료 누락</div>
          <div className="ss-val">{missing}<span className="u">명</span></div>
          <div className="ss-foot">개별 안내 필요</div>
        </div>
      </div>

      <div className="wd-tab-bar">
        <button aria-selected={tab === "overview"} onClick={() => setTab("overview")}>
          <Icons.Grid size={13} sw={1.8} /> 진행 현황
        </button>
        <button aria-selected={tab === "employee"} onClick={() => setTab("employee")}>
          <Icons.Users size={13} sw={1.8} /> 직원 명단
        </button>
        <button aria-selected={tab === "deduction"} onClick={() => setTab("deduction")}>
          <Icons.Doc size={13} sw={1.8} /> 공제 항목
        </button>
      </div>

      {tab === "overview" && (
        <>
          {/* 5단계 진행 시각화 */}
          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head"><span className="title">5단계 진행 현황</span><span className="sub">전체 {YE_EMPLOYEES.length}명</span></div>
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {YE_STEPS.map((s, i) => {
                  const count = YE_EMPLOYEES.filter((e) => e.step === s.id).length;
                  const cumulative = YE_EMPLOYEES.filter((e) => e.step >= s.id).length;
                  return (
                    <div key={s.id} style={{ padding: "14px 16px", background: i < 4 ? "var(--bg-sunk)" : "oklch(95% 0.05 145)", borderRadius: 10, position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: count > 0 ? "var(--accent)" : "var(--bg-elev)",
                          color: count > 0 ? "white" : "var(--fg-muted)",
                          border: "2px solid " + (count > 0 ? "var(--accent)" : "var(--border)"),
                          display: "grid", placeItems: "center",
                          fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                        }}>{s.id}</div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                        {count}<span style={{ fontSize: 11, color: "var(--fg-faint)", marginLeft: 3, fontWeight: 500 }}>명 진행</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>{s.sub}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
                        도달: {cumulative}명
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* 주요 일정 */}
          <div className="grid-21">
            <Card>
              <div className="card-head"><span className="title">주요 일정</span></div>
              <div className="list">
                {[
                  { ttl: "자료 수집 마감",     date: "2026.02.15", icon: "Calendar", color: "var(--success)", status: "완료" },
                  { ttl: "공제 항목 검토",     date: "2026.02.20", icon: "Doc",      color: "var(--success)", status: "완료" },
                  { ttl: "환급/추가징수 산정", date: "2026.02.25", icon: "Wallet",   color: "var(--accent)",  status: "진행 중" },
                  { ttl: "관리자 결재",        date: "2026.02.28", icon: "Check",    color: "oklch(50% 0.16 60)", status: "대기" },
                  { ttl: "국세청 신고 마감",   date: "2026.03.10", icon: "Doc",      color: "var(--danger)",  status: "예정" },
                ].map((s, i) => (
                  <div key={i} className="item">
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `oklch(from ${s.color} 96% 0.05 h)`, color: s.color, display: "grid", placeItems: "center" }}>
                      {(() => { const Ic = Icons[s.icon]; return <Ic size={14} sw={1.8} />; })()}
                    </div>
                    <div className="grow">
                      <div className="title">{s.ttl}</div>
                      <div className="meta"><span className="mono">{s.date}</span></div>
                    </div>
                    <span className="chip" style={{ background: `oklch(from ${s.color} 96% 0.05 h)`, color: s.color, fontWeight: 600 }}>{s.status}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="card-head"><span className="title">자료 누락 직원</span><span className="sub">{missing}명</span></div>
              <div className="list">
                {YE_EMPLOYEES.filter((e) => e.status === "자료 누락").map((e, i) => (
                  <div key={i} className="item">
                    <Avatar name={e.name} hue={(e.name.charCodeAt(0) * 47) % 360} size="sm" />
                    <div className="grow">
                      <div className="title">{e.name}</div>
                      <div className="meta">{e.dept}</div>
                    </div>
                    <button className="btn sm" onClick={() => toast(`${e.name} 안내`)}><Icons.Mail size={11} /> 안내</button>
                  </div>
                ))}
                {missing === 0 && <div className="empty" style={{ padding: "var(--space-6)" }}><Icons.Check size={24} /><div className="em-title">모든 자료가 제출됐어요</div></div>}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === "employee" && (
        <Card>
          <div className="card-head"><span className="title">직원별 진행</span><span className="sub">{YE_EMPLOYEES.length}명</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>직원</th><th>부서</th><th>단계</th><th>상태</th><th className="right">예상 환급/추가</th><th></th></tr></thead>
              <tbody>
                {YE_EMPLOYEES.map((e, i) => {
                  const isRefund = e.refund && e.refund > 0;
                  const isCharge = e.refund && e.refund < 0;
                  return (
                    <tr key={i}>
                      <td>
                        <div className="person">
                          <Avatar name={e.name} hue={(e.name.charCodeAt(0) * 47) % 360} size="sm" />
                          <span className="fw-6">{e.name}</span>
                        </div>
                      </td>
                      <td>{e.dept}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13 }}>{e.step}/5</span>
                          <div style={{ width: 80, height: 5, background: "var(--bg-sunk)", borderRadius: 3 }}>
                            <div style={{ width: `${(e.step / 5) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 3 }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        {e.status === "신고 완료" && <span className="chip success">{e.status}</span>}
                        {e.status === "결재 대기" && <span className="chip warning">{e.status}</span>}
                        {e.status === "산정 중" && <span className="chip info">{e.status}</span>}
                        {e.status === "자료 검토" && <span className="chip">{e.status}</span>}
                        {e.status === "자료 누락" && <span className="chip danger">{e.status}</span>}
                      </td>
                      <td className="right mono tnum">
                        {isRefund && <span style={{ color: "var(--success)", fontWeight: 700 }}>+₩{e.refund.toLocaleString()}</span>}
                        {isCharge && <span style={{ color: "var(--danger)", fontWeight: 700 }}>−₩{Math.abs(e.refund).toLocaleString()}</span>}
                        {!e.refund && <span style={{ color: "var(--fg-faint)" }}>—</span>}
                      </td>
                      <td><button className="btn sm btn-ghost"><Icons.Eye size={11} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "deduction" && (
        <Card>
          <div className="card-head"><span className="title">주요 공제 항목 분포</span></div>
          <div className="card-pad">
            {[
              { name: "신용카드 사용액",  used: 58, total: YE_EMPLOYEES.length, color: 230 },
              { name: "의료비 (실손)",   used: 32, total: YE_EMPLOYEES.length, color: 290 },
              { name: "교육비 (자녀)",   used: 18, total: YE_EMPLOYEES.length, color: 145 },
              { name: "주택자금 (전월세)",used: 24, total: YE_EMPLOYEES.length, color: 35 },
              { name: "기부금",          used: 12, total: YE_EMPLOYEES.length, color: 75 },
              { name: "연금저축",        used: 41, total: YE_EMPLOYEES.length, color: 200 },
            ].map((d) => (
              <div key={d.name} style={{ display: "grid", gridTemplateColumns: "150px 1fr 80px", gap: 12, alignItems: "center", marginBottom: 10, fontSize: 12 }}>
                <span>{d.name}</span>
                <div style={{ height: 10, background: "var(--bg-sunk)", borderRadius: 3 }}>
                  <div style={{ width: `${(d.used / d.total) * 100}%`, height: "100%", background: `oklch(60% 0.14 ${d.color})`, borderRadius: 3 }} />
                </div>
                <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{d.used} / {d.total}명</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. 글로벌 급여 (Global Payroll)
// ═══════════════════════════════════════════════════════════

const GLOBAL_CORPS = [
  { code: "CTR-KR", name: "CTR (주)",     country: "한국",     flag: "🇰🇷", ccy: "KRW", people: 67,  monthly: 392000000, fxRate: 1,         change: 0,    status: "지급 완료" },
  { code: "CTR-CN", name: "CTR China",    country: "중국",     flag: "🇨🇳", ccy: "CNY", people: 240, monthly: 4800000,   fxRate: 188.6,     change: +1.2, status: "지급 완료" },
  { code: "CTR-RU", name: "CTR Russia",   country: "러시아",   flag: "🇷🇺", ccy: "RUB", people: 180, monthly: 28000000,  fxRate: 15.2,      change: -3.4, status: "이상 검토" },
  { code: "CTR-VN", name: "CTR Vietnam",  country: "베트남",   flag: "🇻🇳", ccy: "VND", people: 380, monthly: 8400000000, fxRate: 0.054,    change: +0.5, status: "지급 완료" },
  { code: "CTR-ES", name: "CTR Spain",    country: "스페인",   flag: "🇪🇸", ccy: "EUR", people: 95,  monthly: 410000,    fxRate: 1480,      change: +2.1, status: "결재 진행" },
  { code: "CTR-JP", name: "CTR Japan",    country: "일본",     flag: "🇯🇵", ccy: "JPY", people: 64,  monthly: 56000000,  fxRate: 9.2,       change: +0.8, status: "지급 완료" },
];

function GlobalPayrollPage({ data }) {
  const toast = useCtxR2(ToastContext);
  const [base] = useStateR2("KRW");

  const totalKRW = GLOBAL_CORPS.reduce((s, c) => s + c.monthly * c.fxRate, 0);
  const totalPeople = GLOBAL_CORPS.reduce((s, c) => s + c.people, 0);
  const completed = GLOBAL_CORPS.filter((c) => c.status === "지급 완료").length;
  const issues = GLOBAL_CORPS.filter((c) => c.status === "이상 검토").length;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>글로벌 급여</h1>
          <div className="greet-sub">6개 법인의 다국가 급여 사이클과 환율 영향을 한눈에 확인해요.</div>
        </div>
        <div className="right">
          <select className="select" defaultValue="2026-05" style={{ padding: "7px 12px" }}>
            <option>2026-05</option><option>2026-04</option>
          </select>
          <button className="btn"><Icons.Download size={13} sw={2} /> 통합 리포트</button>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Wallet size={13} sw={1.8} /></span> 총 인건비</div>
          <div className="ss-val">₩{(totalKRW / 100000000).toFixed(1)}<span className="u">억</span></div>
          <div className="ss-foot">{base} 환산 · {GLOBAL_CORPS.length}개 법인 합산</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 글로벌 인원</div>
          <div className="ss-val">{totalPeople.toLocaleString()}<span className="u">명</span></div>
          <div className="ss-foot">6개국 · 5개 통화</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 지급 완료</div>
          <div className="ss-val">{completed}<span className="u">/{GLOBAL_CORPS.length}</span></div>
          <div className="ss-foot">법인 완료율 {Math.round((completed/GLOBAL_CORPS.length)*100)}%</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 이상 검토</div>
          <div className="ss-val">{issues}<span className="u">건</span></div>
          <div className="ss-foot">FX 변동 영향</div>
        </div>
      </div>

      {/* 법인별 카드 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head"><span className="title">법인별 급여 현황</span><span className="sub">2026년 5월</span></div>
        <div className="card-pad">
          <div className="grid-3" style={{ gap: 12 }}>
            {GLOBAL_CORPS.map((c) => {
              const krwAmount = c.monthly * c.fxRate;
              const statusColor = c.status === "지급 완료" ? "var(--success)" : c.status === "이상 검토" ? "var(--danger)" : "oklch(50% 0.16 60)";
              return (
                <div key={c.code} style={{
                  background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: "16px 18px", cursor: "pointer",
                }} onClick={() => toast(`${c.name} 상세`)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 24 }}>{c.flag}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>{c.code} · {c.country}</div>
                    </div>
                    <span className="chip" style={{ background: `oklch(from ${statusColor} 96% 0.05 h)`, color: statusColor, fontWeight: 600 }}>{c.status}</span>
                  </div>

                  <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>
                      <span>현지 통화</span><span>{c.ccy}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>
                      {c.ccy === "VND" ? (c.monthly / 1000000).toFixed(0) + "M" : c.monthly.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>
                      <span>KRW 환산</span>
                      <span style={{ color: c.change > 0 ? "var(--success)" : c.change < 0 ? "var(--danger)" : "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                        {c.change > 0 ? "+" : ""}{c.change}% FX
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--accent-ink)" }}>
                      ₩{(krwAmount / 100000000).toFixed(2)}억
                    </div>
                  </div>

                  <div style={{ marginTop: 12, padding: "6px 10px", background: "var(--bg-sunk)", borderRadius: 6, fontSize: 11, color: "var(--fg-muted)", display: "flex", justifyContent: "space-between" }}>
                    <span>{c.people}명</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>1 {c.ccy} = ₩{c.fxRate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* FX 영향 분석 */}
      <Card>
        <div className="card-head"><span className="title">FX 환율 영향</span><span className="sub">전월 대비 변동</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>법인</th>
                <th>통화</th>
                <th className="right">전월 환율</th>
                <th className="right">현재 환율</th>
                <th className="right">변동</th>
                <th className="right">KRW 영향</th>
              </tr>
            </thead>
            <tbody>
              {GLOBAL_CORPS.filter((c) => c.ccy !== "KRW").map((c) => {
                const prev = c.fxRate / (1 + c.change / 100);
                const krwImpact = c.monthly * (c.fxRate - prev);
                return (
                  <tr key={c.code}>
                    <td className="fw-6"><span style={{ marginRight: 6 }}>{c.flag}</span>{c.name}</td>
                    <td className="mono">{c.ccy}</td>
                    <td className="right mono tnum">{prev.toFixed(2)}</td>
                    <td className="right mono tnum">{c.fxRate.toFixed(2)}</td>
                    <td className="right mono tnum">
                      <span style={{ color: c.change > 0 ? "var(--success)" : c.change < 0 ? "var(--danger)" : "var(--fg-faint)", fontWeight: 700 }}>
                        {c.change > 0 ? "+" : ""}{c.change}%
                      </span>
                    </td>
                    <td className="right mono tnum">
                      <span style={{ color: krwImpact > 0 ? "var(--success)" : krwImpact < 0 ? "var(--danger)" : "var(--fg-faint)", fontWeight: 600 }}>
                        {krwImpact > 0 ? "+" : ""}₩{(Math.abs(krwImpact) / 1000000).toFixed(0)}M
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px var(--space-6)", background: "var(--bg-sunk)", fontSize: 12, color: "var(--fg-muted)", borderTop: "1px solid var(--border)", lineHeight: 1.5 }}>
          <b style={{ color: "var(--fg)" }}>인사이트</b> · 러시아 루블 −3.4% 변동으로 KRW 환산 인건비 약 ₩1.4M 감소.
          유로 +2.1% 강세로 스페인 법인 인건비 ₩1.3M 증가. 헷지 검토 권장.
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { YearEndPage, GlobalPayrollPage });
