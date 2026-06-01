/* global React, Icons, Avatar, Card, ToastContext, fmtKDate, fmtWon, fmtWonShort */
// CTR HR Hub — 보상/급여/채용대시보드/컴플라이언스 (실제 구조 기반)

const { useState: useStatePH, useContext: useCtxPH } = React;

// ═══════════════════════════════════════════════════════════
// 1. 급여 관리 (Payroll Dashboard)
// ═══════════════════════════════════════════════════════════

const PAYROLL_STEPS = [
  { id: 1, label: "근태 마감",   sub: "근태 데이터 확정" },
  { id: 2, label: "급여 산정",   sub: "세금·공제 계산" },
  { id: 3, label: "이상 검토",   sub: "anomaly 자동 감지" },
  { id: 4, label: "결재",        sub: "관리자 승인" },
  { id: 5, label: "지급",        sub: "은행 이체" },
  { id: 6, label: "명세서 발행", sub: "PDF 생성·배포" },
];

function PayrollMgmtPage({ data }) {
  const toast = useCtxPH(ToastContext);
  const [year, setYear] = useStatePH(2026);
  const [month, setMonth] = useStatePH(5);

  // 6개 법인 파이프라인 (mock)
  const pipelines = [
    { code: "CTR-KR",   name: "CTR (주)",           step: 4, status: "결재 진행 중", alert: "amber",  closing: "5/22", pay: "5/25", dDayPay: 8 },
    { code: "CTR-CN",   name: "CTR China",          step: 5, status: "지급 진행",     alert: "normal", closing: "5/20", pay: "5/24", dDayPay: 7 },
    { code: "CTR-RU",   name: "CTR Russia",         step: 3, status: "이상 검토",     alert: "red",    closing: "5/18", pay: "5/25", dDayPay: 8 },
    { code: "CTR-VN",   name: "CTR Vietnam",        step: 6, status: "완료",          alert: "normal", closing: "5/15", pay: "5/20", dDayPay: 3 },
    { code: "CTR-ES",   name: "CTR Spain",          step: 2, status: "급여 산정 중",   alert: "amber",  closing: "5/24", pay: "5/27", dDayPay: 10 },
    { code: "CTR-JP",   name: "CTR Japan",          step: 6, status: "완료",          alert: "normal", closing: "5/15", pay: "5/20", dDayPay: 3 },
  ];

  const totalNet = 1240000000; // 1.24억 (예시)
  const momChange = 2.3;
  const completed = pipelines.filter((p) => p.step === 6).length;
  const anomalies = 4;
  const pendingApprovals = 2;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>급여 관리</h1>
          <div className="greet-sub">전사 6개 법인의 급여 사이클을 한눈에 확인하고 실행해요.</div>
        </div>
        <div className="right">
          <div className="seg">
            <button onClick={() => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); }}>
              <Icons.ChevL size={11} sw={2} />
            </button>
            <button aria-pressed style={{ minWidth: 100 }}>{year}년 {month}월</button>
            <button onClick={() => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); }}>
              <Icons.ChevR size={11} sw={2} />
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => toast("새 사이클 시작")}>
            <Icons.Plus size={13} sw={2.2} /> 새 사이클
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Wallet size={13} sw={1.8} /></span> 총 실수령액</div>
          <div className="ss-val">₩12.4<span className="u">억</span></div>
          <div className="ss-foot"><span className="delta-up">+{momChange}%</span> 전월</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 완료 법인</div>
          <div className="ss-val">{completed}<span className="u">/{pipelines.length}</span></div>
          <div className="ss-foot">지급 완료</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 이상 항목</div>
          <div className="ss-val">{anomalies}<span className="u">건</span></div>
          <div className="ss-foot">검토 필요</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 결재 대기</div>
          <div className="ss-val">{pendingApprovals}<span className="u">건</span></div>
          <div className="ss-foot">즉시 처리 필요</div>
        </div>
      </div>

      {/* 6단계 파이프라인 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">파이프라인 현황</span>
          <span className="sub">법인별 6단계 진행</span>
        </div>
        <div className="card-pad" style={{ overflowX: "auto" }}>
          {/* 단계 헤더 */}
          <div style={{ display: "grid", gridTemplateColumns: `160px repeat(6, 1fr) 80px`, gap: 6, marginBottom: 10 }}>
            <div></div>
            {PAYROLL_STEPS.map((s, i) => (
              <div key={s.id} style={{ textAlign: "center", fontSize: 11, color: "var(--fg-muted)", fontWeight: 600 }}>
                <div style={{ background: "var(--bg-sunk)", borderRadius: 6, padding: "6px 4px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>STEP {i + 1}</span>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
            <div style={{ textAlign: "right", fontSize: 11, color: "var(--fg-faint)", paddingRight: 4 }}>지급일</div>
          </div>

          {/* 법인별 행 */}
          {pipelines.map((p) => (
            <div key={p.code} style={{ display: "grid", gridTemplateColumns: `160px repeat(6, 1fr) 80px`, gap: 6, alignItems: "center", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>{p.code}</div>
              </div>
              {PAYROLL_STEPS.map((s, i) => {
                const done = p.step > i + 1;
                const current = p.step === i + 1;
                const alertColor = p.alert === "red" ? "var(--danger)" :
                                   p.alert === "amber" ? "oklch(50% 0.16 60)" :
                                   "var(--accent)";
                return (
                  <div key={s.id} style={{
                    height: 32,
                    background: done ? "oklch(95% 0.05 145)" : current ? `oklch(from ${alertColor} 96% 0.05 h)` : "var(--bg-sunk)",
                    borderRadius: 6,
                    border: current ? `1.5px solid ${alertColor}` : "1px solid var(--border)",
                    display: "grid", placeItems: "center",
                    cursor: "pointer",
                  }}>
                    {done ? <Icons.Check size={14} sw={2.4} style={{ color: "var(--success)" }} /> :
                     current ? <Icons.Clock size={13} sw={2} style={{ color: alertColor }} /> :
                     <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--fg-faint)" }} />}
                  </div>
                );
              })}
              <div style={{ textAlign: "right", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                <div style={{ fontWeight: 600 }}>{p.pay}</div>
                <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>D-{p.dDayPay}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 22px", background: "var(--bg-sunk)", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--fg-muted)", display: "flex", gap: 14 }}>
          <span className="flex center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "oklch(95% 0.05 145)", border: "1px solid var(--success)" }} /> 완료</span>
          <span className="flex center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent-soft)", border: "1px solid var(--accent)" }} /> 진행 중</span>
          <span className="flex center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--wd-orange-soft)", border: "1px solid oklch(50% 0.16 60)" }} /> 주의</span>
          <span className="flex center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "oklch(96% 0.05 25)", border: "1px solid var(--danger)" }} /> 이상</span>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="wd-section-h"><h3>빠른 실행</h3></div>
      <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
        {[
          { label: "근태 마감",      sub: "STEP 1 → 2", icon: "Calendar", color: 230, page: "" },
          { label: "이상 검토",      sub: "STEP 3 · 4건", icon: "Alert",    color: 25,  page: "" },
          { label: "결재 대기",      sub: "STEP 4 · 2건", icon: "Inbox",    color: 60,  page: "my-tasks" },
          { label: "수동 조정",      sub: "STEP 2.5",     icon: "Sparkle",  color: 145, page: "" },
          { label: "은행 이체",      sub: "STEP 5",      icon: "Wallet",   color: 290, page: "" },
          { label: "명세서 배포",    sub: "STEP 6",      icon: "Doc",      color: 200, page: "" },
        ].map((a) => {
          const Icon = Icons[a.icon];
          return (
            <button key={a.label} onClick={() => toast(a.label)} style={{
              background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "14px 16px", textAlign: "left", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `oklch(95% 0.05 ${a.color})`, color: `oklch(45% 0.16 ${a.color})`, display: "grid", placeItems: "center" }}>
                <Icon size={16} sw={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{a.sub}</div>
              </div>
              <Icons.ArrowR size={12} sw={2} style={{ color: "var(--fg-faint)" }} />
            </button>
          );
        })}
      </div>

      {/* 캘린더 (간소화) */}
      <Card>
        <div className="card-head">
          <span className="title">{year}년 {month}월 일정</span>
          <span className="sub">법인별 마감/지급일</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>법인</th><th>근태 마감</th><th>지급일</th><th>현재 단계</th><th>상태</th><th className="right">D-day</th></tr></thead>
            <tbody>
              {pipelines.map((p) => (
                <tr key={p.code}>
                  <td className="fw-6">{p.name}</td>
                  <td className="mono">5/{p.closing.split("/")[1]}</td>
                  <td className="mono fw-6">5/{p.pay.split("/")[1]}</td>
                  <td className="small">{PAYROLL_STEPS[p.step - 1]?.label}</td>
                  <td>
                    {p.alert === "red"    && <span className="chip danger">{p.status}</span>}
                    {p.alert === "amber"  && <span className="chip warning">{p.status}</span>}
                    {p.alert === "normal" && p.step === 6 && <span className="chip success">{p.status}</span>}
                    {p.alert === "normal" && p.step !== 6 && <span className="chip info">{p.status}</span>}
                  </td>
                  <td className="right mono tnum">D-{p.dDayPay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. 보상 관리 (Compensation)
// ═══════════════════════════════════════════════════════════

function CompMgmtPage({ data }) {
  const toast = useCtxPH(ToastContext);
  const [tab, setTab] = useStatePH("simulation");
  const [cycle, setCycle] = useStatePH("2026 상반기");

  // mock 보상 사이클 데이터
  const sims = {
    totalCost: 1248000000,
    avgRaise: 5.2,
    affected: 67,
    bandViolations: 2,
  };

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>보상 관리</h1>
          <div className="greet-sub">평가 결과를 기반으로 연봉 조정·보너스를 책정하고 통보해요.</div>
        </div>
        <div className="right">
          <select className="select" value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option>2026 상반기</option>
            <option>2025 하반기</option>
            <option>2025 상반기</option>
          </select>
        </div>
      </div>

      <div className="wd-tab-bar">
        <button aria-selected={tab === "simulation"} onClick={() => setTab("simulation")}>
          <Icons.Sparkle size={13} sw={1.8} /> 시뮬레이션
        </button>
        <button aria-selected={tab === "confirm"} onClick={() => setTab("confirm")}>
          <Icons.Check size={13} sw={1.8} /> 확정
        </button>
        <button aria-selected={tab === "history"} onClick={() => setTab("history")}>
          <Icons.Chart size={13} sw={1.8} /> 이력 분석
        </button>
        <button aria-selected={tab === "letter"} onClick={() => setTab("letter")}>
          <Icons.Doc size={13} sw={1.8} /> 통보 레터
        </button>
      </div>

      {tab === "simulation" && (
        <>
          {/* 시뮬레이션 결과 KPI */}
          <div className="wd-stat-strip">
            <div className="ss-card">
              <div className="ss-h"><span className="ico"><Icons.Wallet size={13} sw={1.8} /></span> 총 인건비 영향</div>
              <div className="ss-val">₩{(sims.totalCost / 100000000).toFixed(2)}<span className="u">억</span></div>
              <div className="ss-foot">연간 환산 · <span className="delta-up">+₩6,500만</span></div>
            </div>
            <div className="ss-card ss-purple">
              <div className="ss-h"><span className="ico"><Icons.Chart size={13} sw={1.8} /></span> 평균 인상률</div>
              <div className="ss-val">{sims.avgRaise}<span className="u">%</span></div>
              <div className="ss-foot">시장 평균 5.0%</div>
            </div>
            <div className="ss-card ss-green">
              <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 대상자</div>
              <div className="ss-val">{sims.affected}<span className="u">명</span></div>
              <div className="ss-foot">전사 인원 전체</div>
            </div>
            <div className="ss-card ss-amber">
              <div className="ss-h"><span className="ico"><Icons.Alert size={13} sw={1.8} /></span> 밴드 위반</div>
              <div className="ss-val">{sims.bandViolations}<span className="u">건</span></div>
              <div className="ss-foot">상한·하한 초과</div>
            </div>
          </div>

          {/* 등급별 권장 인상률 */}
          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head">
              <span className="title">등급별 권장 인상률 매트릭스</span>
              <span className="sub">평가 등급 × 시장 분위</span>
            </div>
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "100px repeat(4, 1fr)", gap: 6 }}>
                <div></div>
                {["P25 미만", "P25-P50", "P50-P75", "P75 이상"].map((p) => (
                  <div key={p} style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "center", padding: "8px 0", fontWeight: 600 }}>{p}</div>
                ))}
                {[
                  { g: "O", rates: [10, 8, 7, 5], color: 290 },
                  { g: "E", rates: [7, 6, 5, 4],  color: 230 },
                  { g: "M", rates: [5, 4, 3, 2],  color: 145 },
                  { g: "S", rates: [2, 1, 0, 0],  color: 25  },
                ].map((row) => (
                  <React.Fragment key={row.g}>
                    <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "var(--font-mono)", color: `oklch(45% 0.16 ${row.color})`, display: "grid", placeItems: "center" }}>{row.g}</div>
                    {row.rates.map((r, i) => (
                      <div key={i} style={{
                        background: r >= 7 ? `oklch(95% 0.07 ${row.color})` : r >= 4 ? "var(--bg-sunk)" : r === 0 ? "oklch(96% 0.04 25)" : "var(--bg-elev)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "12px 0",
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        color: r === 0 ? "var(--danger)" : "var(--fg)",
                      }}>
                        {r}%
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                <b style={{ color: "var(--fg)" }}>읽기</b> · O 등급(Outstanding)이며 시장 P25 미만인 직원은 +10% 권장. S 등급(Below)은 동결 또는 +1~2%.
              </div>
            </div>
          </Card>

          {/* 시뮬레이션 액션 */}
          <Card>
            <div className="card-head"><span className="title">시뮬레이션 실행</span></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn"><Icons.Doc size={12} /> 평가 사이클 가져오기</button>
                <button className="btn"><Icons.Sparkle size={12} /> AI 권장값 적용</button>
                <button className="btn">밴드 검증</button>
                <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => { setTab("confirm"); toast("확정 단계로 이동"); }}>
                  확정으로 보내기 <Icons.ArrowR size={12} sw={2} />
                </button>
              </div>
              <div className="empty" style={{ padding: "var(--space-8)" }}>
                <Icons.Sparkle size={28} />
                <div className="em-title">시뮬레이션 대상자를 평가 사이클에서 불러오세요</div>
                <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>{cycle} 평가 결과 기반으로 권장 인상률이 자동 계산돼요.</div>
              </div>
            </div>
          </Card>
        </>
      )}

      {tab === "confirm" && (
        <Card>
          <div className="card-head"><span className="title">확정 대상자</span><span className="sub">시뮬레이션에서 가져옴</span></div>
          <div className="empty" style={{ padding: "var(--space-10)" }}>
            <Icons.Check size={28} />
            <div className="em-title">시뮬레이션 탭에서 대상자를 확정하면 여기에 표시돼요</div>
          </div>
        </Card>
      )}

      {tab === "history" && (
        <Card>
          <div className="card-head"><span className="title">최근 3년 인상률 추이</span></div>
          <div className="card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, alignItems: "flex-end", height: 180 }}>
              {[
                { p: "23 상", v: 3.2 }, { p: "23 하", v: 2.8 },
                { p: "24 상", v: 4.5 }, { p: "24 하", v: 3.8 },
                { p: "25 상", v: 5.2 }, { p: "25 하", v: 5.0 },
              ].map((b, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.v}%</span>
                  <div style={{ width: "72%", height: `${(b.v / 6) * 100}%`, background: "var(--accent)", borderRadius: "3px 3px 0 0" }} />
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{b.p}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {tab === "letter" && (
        <Card>
          <div className="card-head">
            <span className="title">연봉 통보 레터</span>
            <div className="right">
              <button className="btn"><Icons.Doc size={12} /> 템플릿 편집</button>
              <button className="btn btn-primary"><Icons.Mail size={12} /> 일괄 발송</button>
            </div>
          </div>
          <div className="empty" style={{ padding: "var(--space-10)" }}>
            <Icons.Doc size={28} />
            <div className="em-title">확정된 보상 결과를 기반으로 레터를 자동 생성해요</div>
            <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>확정 단계 완료 후 활성화돼요.</div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. 채용 대시보드 (Recruitment Dashboard)
// ═══════════════════════════════════════════════════════════

function RecruitDashPage({ data }) {
  const toast = useCtxPH(ToastContext);

  // 채용 펀넬 (10단계)
  const funnel = [
    { stage: "지원",       en: "APPLIED",        count: 142, color: "oklch(60% 0.02 270)" },
    { stage: "서류 검토",  en: "SCREENING",      count: 86,  color: "oklch(60% 0.14 230)" },
    { stage: "1차 면접",   en: "INTERVIEW_1",    count: 52,  color: "oklch(60% 0.14 230)" },
    { stage: "2차 면접",   en: "INTERVIEW_2",    count: 28,  color: "oklch(60% 0.14 230)" },
    { stage: "최종 면접",  en: "FINAL",          count: 14,  color: "oklch(60% 0.16 60)" },
    { stage: "오퍼",       en: "OFFER",          count: 8,   color: "oklch(55% 0.18 290)" },
    { stage: "오퍼 수락",  en: "OFFER_ACCEPTED", count: 6,   color: "oklch(55% 0.14 145)" },
    { stage: "입사",       en: "HIRED",          count: 5,   color: "oklch(55% 0.18 290)" },
  ];
  const maxFunnel = funnel[0].count;

  // 공석 현황 (법인별)
  const vacancies = {
    total: 12, active: 8, noPosting: 4, recentlyFilled: 6, avgFillDays: 32,
    byCompany: [
      { name: "CTR (주)",     total: 5, active: 4, noPosting: 1 },
      { name: "CTR China",    total: 3, active: 2, noPosting: 1 },
      { name: "CTR Vietnam",  total: 2, active: 1, noPosting: 1 },
      { name: "CTR Spain",    total: 2, active: 1, noPosting: 1 },
    ],
  };

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>채용 대시보드</h1>
          <div className="greet-sub">활성 공고·지원자 현황·채용 퍼널을 분석해요.</div>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Briefcase size={13} sw={1.8} /></span> 활성 공고</div>
          <div className="ss-val">8<span className="u">건</span></div>
          <div className="ss-foot">진행 중</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8} /></span> 전체 지원자</div>
          <div className="ss-val">142<span className="u">명</span></div>
          <div className="ss-foot">이번 분기 누계</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 평균 채용 소요</div>
          <div className="ss-val">32<span className="u">일</span></div>
          <div className="ss-foot">공고 → 입사 평균</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Target size={13} sw={1.8} /></span> 합격률</div>
          <div className="ss-val">3.5<span className="u">%</span></div>
          <div className="ss-foot">지원 대비 입사</div>
        </div>
      </div>

      {/* 채용 퍼널 */}
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head">
          <span className="title">채용 퍼널</span>
          <span className="sub">전체 활성 공고 합산</span>
        </div>
        <div className="card-pad">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {funnel.map((s, i) => {
              const pct = (s.count / maxFunnel) * 100;
              const conv = i > 0 ? Math.round((s.count / funnel[i - 1].count) * 100) : 100;
              return (
                <div key={s.en} style={{ display: "grid", gridTemplateColumns: "110px 1fr 80px 50px", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.stage}</span>
                  <div style={{ position: "relative", height: 28, background: "var(--bg-sunk)", borderRadius: 4 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: s.color, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 10 }}>
                      <span style={{ color: "white", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.count}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", textAlign: "right" }}>{i === 0 ? "—" : `${conv}%`}</span>
                  <span style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>{s.en.split("_")[0]}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            <b style={{ color: "var(--fg)" }}>인사이트</b> · 지원→서류 검토 전환 60%, 서류→1차면접 60%로 양호. 1차→2차 면접 단계에서 가장 큰 탈락 (54%) — 면접관 캘리브레이션 검토 권장.
          </div>
        </div>
      </Card>

      {/* 공석 현황 */}
      <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head">
            <span className="title">공석 현황 요약</span>
            <span className="sub">전사 {vacancies.total}건</span>
          </div>
          <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { lbl: "전체 공석",     v: vacancies.total,         color: "var(--fg)",      bg: "var(--bg-sunk)" },
              { lbl: "공고 진행 중",  v: vacancies.active,        color: "var(--accent-ink)", bg: "var(--accent-soft)" },
              { lbl: "공고 미게시",   v: vacancies.noPosting,     color: "oklch(48% 0.18 60)", bg: "var(--wd-orange-soft)" },
              { lbl: "최근 충원",     v: vacancies.recentlyFilled, color: "var(--success)", bg: "oklch(95% 0.05 145)" },
              { lbl: "평균 충원 일수", v: `${vacancies.avgFillDays}일`, color: "var(--accent)", bg: "var(--accent-soft)", colSpan: 2 },
            ].map((x, i) => (
              <div key={i} style={{
                gridColumn: x.colSpan === 2 ? "1 / -1" : undefined,
                background: x.bg, borderRadius: 8, padding: "12px 14px",
              }}>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{x.lbl}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: x.color, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", marginTop: 4 }}>{x.v}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head"><span className="title">법인별 공석</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>법인</th><th className="right">전체</th><th className="right">공고 중</th><th className="right">미게시</th></tr></thead>
              <tbody>
                {vacancies.byCompany.map((c) => (
                  <tr key={c.name}>
                    <td className="fw-6">{c.name}</td>
                    <td className="right mono tnum">{c.total}</td>
                    <td className="right mono tnum"><span style={{ color: "var(--accent)" }}>{c.active}</span></td>
                    <td className="right mono tnum"><span style={{ color: "oklch(50% 0.16 60)" }}>{c.noPosting}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 최근 공고 */}
      <Card>
        <div className="card-head">
          <span className="title">최근 공고</span>
          <div className="right"><button className="btn sm" onClick={() => toast("채용 공고 보기")}>전체 보기 →</button></div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>공고</th><th className="right">지원자</th><th className="right">단계</th><th className="right">게시일</th></tr></thead>
            <tbody>
              {[
                { title: "프론트엔드 엔지니어 (시니어)", applicants: 38, stage: "INTERVIEW_2", date: "2026-05-08" },
                { title: "백엔드 엔지니어",            applicants: 42, stage: "INTERVIEW_1", date: "2026-05-05" },
                { title: "재무회계 대리",              applicants: 24, stage: "FINAL",       date: "2026-05-01" },
                { title: "HR Business Partner",       applicants: 18, stage: "SCREENING",   date: "2026-04-28" },
                { title: "품질관리 엔지니어",          applicants: 12, stage: "OFFER",       date: "2026-04-22" },
              ].map((p, i) => (
                <tr key={i} className="clickable">
                  <td className="fw-6">{p.title}</td>
                  <td className="right"><span className="chip accent" style={{ fontFamily: "var(--font-mono)" }}>{p.applicants}명</span></td>
                  <td className="right"><span className="chip">{p.stage}</span></td>
                  <td className="right mono small">{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. 컴플라이언스 (Compliance)
// ═══════════════════════════════════════════════════════════

function ComplianceMgmtPage({ data }) {
  const toast = useCtxPH(ToastContext);
  const [tab, setTab] = useStatePH("overview");

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>컴플라이언스</h1>
          <div className="greet-sub">개인정보 보호·국가별 법규 준수·감사 이력을 관리해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 감사 리포트</button>
        </div>
      </div>

      <div className="wd-tab-bar">
        <button aria-selected={tab === "overview"} onClick={() => setTab("overview")}>
          <Icons.Grid size={13} sw={1.8} /> 개요
        </button>
        <button aria-selected={tab === "data"} onClick={() => setTab("data")}>
          <Icons.Shield size={13} sw={1.8} /> 데이터 보호
        </button>
        <button aria-selected={tab === "pii"} onClick={() => setTab("pii")}>
          <Icons.Eye size={13} sw={1.8} /> PII 감사
        </button>
        <button aria-selected={tab === "country"} onClick={() => setTab("country")}>
          <Icons.Globe size={13} sw={1.8} /> 국가별
        </button>
      </div>

      {tab === "overview" && (
        <>
          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ flex: "0 0 auto", width: 96, height: 96, borderRadius: 16, background: "oklch(95% 0.05 145)", color: "oklch(45% 0.14 145)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>94</div>
                  <div style={{ fontSize: 11, textAlign: "center", marginTop: 4, opacity: 0.7 }}>/ 100</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>컴플라이언스 점수</span>
                  <span className="chip success" style={{ fontSize: 10.5 }}>A 등급 · 양호</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.55, marginBottom: 10 }}>
                  PII·개인정보보호법·근로기준법 준수 상태 양호. 보존기간 만료 임박 3건은 30일 내 자동 삭제 예정이에요.
                </div>
                <div className="wd-status-chips">
                  <span className="sc accent">DPIA <b>12/14</b> 완료 · 고위험 완료</span>
                  <span className="sc warn">보존 만료 임박 <b>3</b>건</span>
                  <span className="sc">PII 접근 로그 <b>1,248</b>건 / 30일</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head"><span className="title">법규 준수 상태</span></div>
              <div className="list">
                {[
                  { name: "GDPR (EU)",          score: 95, status: "준수" },
                  { name: "KEDO (한국)",        score: 98, status: "준수" },
                  { name: "사회보험 (중국)",     score: 92, status: "준수" },
                  { name: "노동법 (러시아)",     score: 88, status: "주의" },
                  { name: "Labor Code (베트남)", score: 90, status: "준수" },
                ].map((l) => {
                  const color = l.score >= 95 ? "var(--success)" : l.score >= 85 ? "oklch(50% 0.16 60)" : "var(--danger)";
                  return (
                    <div key={l.name} className="item">
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `oklch(from ${color} 96% 0.05 h)`, color, display: "grid", placeItems: "center" }}>
                        <Icons.Shield size={16} />
                      </div>
                      <div className="grow">
                        <div className="title">{l.name}</div>
                        <div className="meta">
                          <div style={{ width: 100, height: 4, background: "var(--bg-sunk)", borderRadius: 2 }}>
                            <div style={{ width: `${l.score}%`, height: "100%", background: color, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color }}>{l.score}점</span>
                        </div>
                      </div>
                      {l.status === "준수" ? <span className="chip success">{l.status}</span> : <span className="chip warning">{l.status}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="card-head"><span className="title">최근 알림</span><span className="sub">조치 필요</span></div>
              <div className="list">
                {[
                  { icon: "Alert",   text: "퇴직자 9명의 PII 데이터 자동 삭제 예정", when: "3일 후",   color: "oklch(50% 0.16 60)" },
                  { icon: "Shield",  text: "RU 노동법 개정 — 7월 시행, 검토 필요", when: "2주 전",   color: "var(--danger)" },
                  { icon: "Eye",     text: "비정상 PII 접근 — 김민지 (해결됨)",     when: "1주 전",   color: "var(--success)" },
                  { icon: "Check",   text: "GDPR 분기 감사 통과",                  when: "이번 달",  color: "var(--success)" },
                ].map((a, i) => {
                  const Icon = Icons[a.icon];
                  return (
                    <div key={i} className="item">
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `oklch(from ${a.color} 96% 0.05 h)`, color: a.color, display: "grid", placeItems: "center" }}>
                        <Icon size={14} />
                      </div>
                      <div className="grow">
                        <div className="title" style={{ fontSize: 12.5 }}>{a.text}</div>
                        <div className="meta">{a.when}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === "data" && (
        <>
          <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
            {[
              { title: "GDPR",         sub: "EU 개인정보 보호 규정",     icon: "Shield", color: 230, items: ["동의 관리", "정보 권한", "데이터 이전"] },
              { title: "DPIA",         sub: "데이터 보호 영향평가",      icon: "Doc",    color: 290, items: ["12/14 완료", "고위험 100%", "최근 갱신 3일 전"] },
              { title: "데이터 보존",   sub: "보존 기간·자동 삭제",       icon: "Clock",  color: 60,  items: ["퇴직자 3년", "지원자 6개월", "급여 5년"] },
            ].map((t) => {
              const Icon = Icons[t.icon];
              return (
                <button key={t.title} className="card" style={{
                  padding: "18px 20px", textAlign: "left", cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `oklch(95% 0.05 ${t.color})`, color: `oklch(45% 0.16 ${t.color})`, display: "grid", placeItems: "center" }}>
                    <Icon size={18} sw={1.8} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{t.sub}</div>
                  <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    {t.items.map((it) => (
                      <div key={it} style={{ fontSize: 11.5, color: "var(--fg-muted)", padding: "2px 0", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--fg-faint)" }} />
                        {it}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <Card>
            <div className="card-head"><span className="title">최근 데이터 보호 활동</span></div>
            <div className="empty" style={{ padding: "var(--space-10)" }}>
              <Icons.Shield size={28} />
              <div className="em-title">서브 카드를 클릭하면 상세 활동 이력이 표시돼요</div>
            </div>
          </Card>
        </>
      )}

      {tab === "pii" && (
        <Card>
          <div className="card-head">
            <span className="title">PII 접근 감사 로그</span>
            <span className="sub">최근 30일 · 1,248건</span>
            <div className="right"><button className="btn sm"><Icons.Download size={11} /> CSV</button></div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>시각</th><th>접근자</th><th>대상자</th><th>유형</th><th>목적</th><th className="right">결과</th></tr></thead>
              <tbody>
                {[
                  { time: "오늘 14:32", who: "한지영", target: "박지훈", type: "급여명세서",   purpose: "본인 요청 응대",  ok: true },
                  { time: "오늘 11:08", who: "이정환", target: "최서연", type: "평가 결과",    purpose: "1:1 면담 준비",  ok: true },
                  { time: "오늘 09:24", who: "강하준", target: "정유진", type: "주민등록번호", purpose: "연말정산 처리",   ok: true },
                  { time: "어제 16:45", who: "김민지", target: "전체",   type: "전사 이메일",  purpose: "수상자 공지",     ok: true },
                  { time: "어제 11:02", who: "system", target: "퇴직자", type: "PII 자동 삭제", purpose: "보존 기간 만료",  ok: true },
                ].map((r, i) => (
                  <tr key={i}>
                    <td className="mono small">{r.time}</td>
                    <td className="fw-6">{r.who}</td>
                    <td>{r.target}</td>
                    <td><span className="chip" style={{ fontSize: 10.5 }}>{r.type}</span></td>
                    <td className="small muted">{r.purpose}</td>
                    <td className="right">{r.ok ? <span className="chip success">정상</span> : <span className="chip danger">차단</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "country" && (
        <div className="grid-3">
          {[
            { code: "KR", name: "대한민국", flag: "🇰🇷", laws: ["근로기준법", "개인정보보호법", "산업안전보건법"], score: 98 },
            { code: "CN", name: "중국",     flag: "🇨🇳", laws: ["사회보험법", "노동계약법", "개인정보보호법"], score: 92 },
            { code: "RU", name: "러시아",   flag: "🇷🇺", laws: ["노동법", "개인정보보호법", "사회보험법"], score: 88 },
            { code: "VN", name: "베트남",   flag: "🇻🇳", laws: ["Labor Code", "Social Insurance Law"], score: 90 },
            { code: "ES", name: "스페인",   flag: "🇪🇸", laws: ["Estatuto Trabajadores", "LOPD", "GDPR"], score: 94 },
            { code: "JP", name: "일본",     flag: "🇯🇵", laws: ["労働基準法", "個人情報保護法"], score: 96 },
          ].map((c) => {
            const color = c.score >= 95 ? "var(--success)" : c.score >= 85 ? "oklch(50% 0.16 60)" : "var(--danger)";
            return (
              <button key={c.code} className="card" style={{ padding: "16px 18px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 28 }}>{c.flag}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>{c.code}</div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)", color }}>{c.score}</span>
                </div>
                <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  {c.laws.map((l) => (
                    <div key={l} style={{ fontSize: 11.5, color: "var(--fg-muted)", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
                      <Icons.Doc size={11} style={{ color: "var(--fg-faint)" }} />
                      {l}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  PayrollMgmtPage, CompMgmtPage, RecruitDashPage, ComplianceMgmtPage,
});
