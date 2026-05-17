/* global React, Icons, Card, CardHead, ToastContext */
// CTR HR Hub — 급여 시뮬레이션

const { useState: useStatePS, useContext: useCtxPS } = React;

function PayrollSimPage({ data }) {
  const toast = useCtxPS(ToastContext);
  const [tab, setTab] = useStatePS("bulk");
  const [scope, setScope] = useStatePS("all");
  const [raise, setRaise] = useStatePS(data.payrollSim.baseRaise);
  const [bonus, setBonus] = useStatePS(data.payrollSim.bonusMonths);
  const [result, setResult] = useStatePS(null);

  const compute = () => {
    // simple synthetic calc
    const before = 308900000;
    const after  = Math.round(before * (1 + raise / 100) + before * (bonus / 12));
    const diff = after - before;
    setResult({ before, after, diff, headcount: 67 });
    toast("시뮬레이션 완료");
  };

  return (
    <div className="content">
      <div className="page-h">
        <div className="flex center gap-3">
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center" }}>
            <Icons.Chart size={26}/>
          </div>
          <div>
            <h1>급여 시뮬레이션</h1>
            <div className="greet-sub">급여 인상·수당 변경의 영향을 사전에 분석해요</div>
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Clock size={14}/> 시나리오</button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: "var(--space-5)" }}>
        {[
          ["personal", "개인 시뮬레이션"],
          ["bulk",     "일괄 시뮬레이션"],
          ["diff",     "차등 인상"],
          ["dist",     "보상 분포"],
          ["hire",     "채용 시뮬레이션"],
          ["fx",       "환율 시뮬레이션"],
        ].map(([id, label]) => (
          <button key={id} aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "bulk" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-4)" }}>
          <div className="flex col gap-3">
            <Card>
              <div className="card-pad">
                <div className="fw-7" style={{ marginBottom: 12 }}>대상 선택</div>
                <div className="flex col gap-2">
                  <label className="flex center gap-2 small" style={{ cursor: "pointer" }}>
                    <input type="radio" name="scope" checked={scope === "all"} onChange={() => setScope("all")}/>
                    <span>법인 전체</span>
                  </label>
                  {scope === "all" && (
                    <select className="select" defaultValue="ctr" style={{ marginLeft: 24 }}>
                      <option value="ctr">CTR (CTR (주))</option>
                      <option value="ctr-china">CTR China</option>
                    </select>
                  )}
                  <label className="flex center gap-2 small" style={{ cursor: "pointer" }}>
                    <input type="radio" name="scope" checked={scope === "dept"} onChange={() => setScope("dept")}/>
                    <span>부서 단위</span>
                  </label>
                  <label className="flex center gap-2 small" style={{ cursor: "pointer" }}>
                    <input type="radio" name="scope" checked={scope === "person"} onChange={() => setScope("person")}/>
                    <span>직원 선택</span>
                  </label>
                </div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div className="fw-7" style={{ marginBottom: 12 }}>인상 조건</div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>기본급 인상률</label>
                  <div className="flex center gap-2">
                    <input className="input grow" type="number" value={raise} step="0.5" onChange={(e) => setRaise(+e.target.value)}/>
                    <span className="muted">%</span>
                  </div>
                </div>
                <div className="field">
                  <label>상여금 (월수)</label>
                  <div className="flex center gap-2">
                    <input className="input grow" type="number" value={bonus} onChange={(e) => setBonus(+e.target.value)}/>
                    <span className="muted">월</span>
                  </div>
                </div>
              </div>
            </Card>
            <button className="btn btn-primary lg" style={{ width: "100%", justifyContent: "center" }} onClick={compute}>
              <Icons.Chart size={14}/> 시뮬레이션 계산
            </button>
          </div>

          <Card>
            {result == null ? (
              <div className="empty" style={{ padding: "var(--space-10)" }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg-sunk)", color: "var(--fg-muted)", display: "grid", placeItems: "center" }}>
                  <Icons.Chart size={28}/>
                </div>
                <div className="em-title">좌측에서 조건을 설정하고 계산 버튼을 클릭하세요</div>
              </div>
            ) : (
              <>
                <CardHead title="시뮬레이션 결과" sub={`${result.headcount}명 대상`}/>
                <div className="card-pad">
                  <div className="kpi-grid cols-3">
                    <div className="kpi">
                      <div className="label">현재 인건비 (월)</div>
                      <div className="val tnum">₩{(result.before / 1000000).toFixed(1)}M</div>
                    </div>
                    <div className="kpi">
                      <div className="label">예상 인건비 (월)</div>
                      <div className="val tnum" style={{ color: "var(--accent)" }}>₩{(result.after / 1000000).toFixed(1)}M</div>
                    </div>
                    <div className="kpi">
                      <div className="label">증감</div>
                      <div className="val tnum" style={{ color: "var(--danger)" }}>+₩{(result.diff / 1000000).toFixed(1)}M</div>
                      <div className="delta up">+{((result.diff / result.before) * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="divider" style={{ margin: "var(--space-5) 0" }}/>
                  <div className="cap" style={{ marginBottom: 10 }}>월별 인건비 추이 (예상)</div>
                  <div className="vbar" style={{ height: 140 }}>
                    {[0.93, 0.95, 0.97, 1.00, 1.02, 1.05, 1.08, 1.10, 1.12, 1.13, 1.14, 1.15].map((f, i) => (
                      <div key={i} className="col">
                        <div className="bar accent" style={{ height: `${f * 60}%`, opacity: i >= 4 ? 1 : 0.6 }}/>
                        <div className="bar-lbl">{i + 1}월</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {tab !== "bulk" && (
        <Card>
          <div className="empty" style={{ padding: "var(--space-10)" }}>
            <Icons.Sparkle size={28}/>
            <div className="em-title">{tab === "personal" ? "개인 시뮬레이션" : tab === "diff" ? "차등 인상" : tab === "dist" ? "보상 분포" : tab === "hire" ? "채용 시뮬레이션" : "환율 시뮬레이션"} 데모 준비 중</div>
          </div>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { PayrollSimPage });
