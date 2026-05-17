/* global React, Icons, Avatar, Card, ToastContext, fmtKDate */
// CTR HR Hub — Round 3: 사내 채용 + 복리후생 관리 + 수동 조정

const { useState: useStateR3, useContext: useCtxR3 } = React;

// ═══════════════════════════════════════════════════════════
// 1. 사내 채용 (Internal Recruitment)
// ═══════════════════════════════════════════════════════════

const INTERNAL_JOBS = [
  { id: "ij1", title: "데이터 분석 리드", dept: "개발팀",     posted: "2026-05-10", deadline: "2026-05-31", applicants: 8, level: "L4-L5", manager: "한지영", status: "진행" },
  { id: "ij2", title: "HR Business Partner", dept: "인사팀", posted: "2026-05-05", deadline: "2026-05-25", applicants: 5, level: "L3-L4", manager: "이정환", status: "진행" },
  { id: "ij3", title: "프로덕트 매니저", dept: "기획팀",     posted: "2026-04-28", deadline: "2026-05-20", applicants: 12, level: "L4",   manager: "박서연", status: "면접" },
  { id: "ij4", title: "QA 리드", dept: "품질관리팀",         posted: "2026-04-15", deadline: "2026-05-05", applicants: 4,  level: "L4-L5", manager: "홍채원", status: "마감" },
];

const INTERNAL_APPLICANTS = [
  { name: "최서연", currentDept: "개발팀",    currentRank: "대리", targetJob: "데이터 분석 리드", tenure: "3.2년", recent: "E", manager: "한지영", status: "1차 면접" },
  { name: "박지훈", currentDept: "생산기술팀", currentRank: "주임", targetJob: "데이터 분석 리드", tenure: "1.8년", recent: "M", manager: "홍채원", status: "서류" },
  { name: "정유진", currentDept: "재무/회계팀", currentRank: "과장", targetJob: "HR Business Partner", tenure: "5.4년", recent: "E", manager: "이정환", status: "최종" },
  { name: "이상민", currentDept: "영업팀",    currentRank: "주임", targetJob: "프로덕트 매니저",  tenure: "4.5년", recent: "M", manager: "박서연", status: "1차 면접" },
];

function InternalRecruitPage({ data }) {
  const toast = useCtxR3(ToastContext);

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>사내 채용</h1>
          <div className="greet-sub">내부 이동 공고를 게시하고 직원의 사내 지원을 관리해요.</div>
          <div className="wd-status-chips">
            <span className="sc accent"><span className="dot" />진행 공고 <b>{INTERNAL_JOBS.filter((j) => j.status !== "마감").length}건</b></span>
            <span className="sc"><span className="dot" />사내 지원자 <b>{INTERNAL_APPLICANTS.length}명</b></span>
            <span className="sc success"><span className="dot" />이번 분기 이동 <b>4명</b></span>
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 이동 이력</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 새 공고</button>
        </div>
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-head"><span className="title">사내 공고</span><span className="sub">{INTERNAL_JOBS.length}건</span></div>
        <div className="card-pad">
          <div className="grid-2" style={{ gap: 12 }}>
            {INTERNAL_JOBS.map((j) => {
              const isClosed = j.status === "마감";
              return (
                <div key={j.id} style={{
                  background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: "14px 16px", opacity: isClosed ? 0.6 : 1,
                  cursor: "pointer",
                }} onClick={() => toast(`${j.title} 상세`)}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{j.title}</div>
                      <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 11.5, color: "var(--fg-muted)" }}>
                        <span>{j.dept}</span>
                        <span>·</span>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{j.level}</span>
                      </div>
                    </div>
                    {j.status === "진행" && <span className="chip success">{j.status}</span>}
                    {j.status === "면접" && <span className="chip info">{j.status}</span>}
                    {j.status === "마감" && <span className="chip">{j.status}</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 11 }}>
                    <div>
                      <div style={{ color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>지원자</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, fontFamily: "var(--font-mono)" }}>{j.applicants}명</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>마감일</div>
                      <div style={{ fontSize: 13, marginTop: 2, fontFamily: "var(--font-mono)" }}>{j.deadline.slice(5)}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>채용 매니저</div>
                      <div style={{ fontSize: 13, marginTop: 2 }}>{j.manager}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-head"><span className="title">사내 지원자</span><span className="sub">{INTERNAL_APPLICANTS.length}명 진행 중</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>지원자</th><th>현재 소속</th><th>근속</th><th>최근 평가</th><th>지원 직무</th><th>단계</th><th className="right"></th></tr></thead>
            <tbody>
              {INTERNAL_APPLICANTS.map((a, i) => (
                <tr key={i}>
                  <td><div className="person"><Avatar name={a.name} hue={(a.name.charCodeAt(0) * 47) % 360} size="sm" /><span className="fw-6">{a.name}</span></div></td>
                  <td className="small">{a.currentDept} · {a.currentRank}</td>
                  <td className="mono small">{a.tenure}</td>
                  <td className="mono fw-7">{a.recent}</td>
                  <td>{a.targetJob}</td>
                  <td>
                    {a.status === "서류"     && <span className="chip">{a.status}</span>}
                    {a.status === "1차 면접" && <span className="chip info">{a.status}</span>}
                    {a.status === "최종"     && <span className="chip warning">{a.status}</span>}
                  </td>
                  <td className="right"><button className="btn sm btn-ghost"><Icons.Eye size={11} /></button></td>
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
// 2. 복리후생 관리 (Benefits Admin)
// ═══════════════════════════════════════════════════════════

const BENEFITS_POLICIES = [
  { name: "대학학자금",     limit: 2000000, used: 38, requests: 42, budget: 76000000, color: 230 },
  { name: "자기개발비",     limit: 1000000, used: 56, requests: 52, budget: 56000000, color: 145 },
  { name: "종합건강검진",   limit: 500000,  used: 47, requests: 47, budget: 23500000, color: 290 },
  { name: "안경/렌즈 지원", limit: 200000,  used: 22, requests: 21, budget: 4400000,  color: 35  },
  { name: "사내동호회",     limit: 50000,   used: 12, requests: 12, budget: 600000,   color: 75  },
];

const BENEFIT_PENDING = [
  { name: "박지훈", dept: "생산기술팀", item: "자기개발비", amount: 480000, requestedAt: "2026-05-15" },
  { name: "최서연", dept: "개발팀",     item: "대학학자금", amount: 1800000, requestedAt: "2026-05-14" },
  { name: "정유진", dept: "재무/회계팀", item: "종합건강검진", amount: 350000, requestedAt: "2026-05-13" },
];

function BenefitsAdminPage({ data }) {
  const toast = useCtxR3(ToastContext);
  const totalBudget = BENEFITS_POLICIES.reduce((s, p) => s + p.budget, 0);
  const totalUsed = BENEFITS_POLICIES.reduce((s, p) => s + p.used, 0);

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>복리후생 관리</h1>
          <div className="greet-sub">복리후생 정책·예산·신청 큐를 관리해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 정산 리포트</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 새 정책</button>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Wallet size={13} sw={1.8} /></span> 연간 예산</div>
          <div className="ss-val">₩{(totalBudget / 100000000).toFixed(1)}<span className="u">억</span></div>
          <div className="ss-foot">5개 정책 합산</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Chart size={13} sw={1.8} /></span> 사용 인원</div>
          <div className="ss-val">{totalUsed}<span className="u">건</span></div>
          <div className="ss-foot">올해 누계</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 승인 대기</div>
          <div className="ss-val">{BENEFIT_PENDING.length}<span className="u">건</span></div>
          <div className="ss-foot">평균 처리 2.4일</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 평균 만족도</div>
          <div className="ss-val">4.6<span className="u">/5</span></div>
          <div className="ss-foot">설문 기반</div>
        </div>
      </div>

      <div className="grid-21" style={{ marginBottom: "var(--space-4)" }}>
        <Card>
          <div className="card-head"><span className="title">정책별 사용 현황</span><span className="sub">2026년</span></div>
          <div className="card-pad">
            {BENEFITS_POLICIES.map((p) => {
              const pct = (p.used / 67) * 100; // assume 67 employees
              return (
                <div key={p.name} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--fg-muted)" }}>
                      한도 ₩{p.limit.toLocaleString()} · <b style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{p.used}명</b> 사용
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `oklch(60% 0.14 ${p.color})`, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                    예산 ₩{(p.budget / 10000).toLocaleString()}만 · {p.requests}건 신청
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <span className="title">승인 대기</span>
            <span className="sub">{BENEFIT_PENDING.length}건</span>
            <div className="right"><button className="btn sm">일괄 승인</button></div>
          </div>
          <div className="list">
            {BENEFIT_PENDING.map((p, i) => (
              <div key={i} className="item">
                <Avatar name={p.name} hue={(p.name.charCodeAt(0) * 47) % 360} size="sm" />
                <div className="grow">
                  <div className="title">{p.name} · {p.item}</div>
                  <div className="meta">
                    <span className="mono">₩{p.amount.toLocaleString()}</span>
                    <span className="sep">·</span>
                    <span>{p.requestedAt.slice(5)} 신청</span>
                  </div>
                </div>
                <button className="btn sm" onClick={() => toast("반려")}>반려</button>
                <button className="btn sm btn-primary" onClick={() => toast("승인")}>승인</button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. 수동 조정 (Manual Payroll Adjustment)
// ═══════════════════════════════════════════════════════════

const MANUAL_ADJUSTMENTS = [
  { id: "MA-2026-014", name: "박지훈", dept: "생산기술팀", item: "야간수당",   amount: +180000, reason: "5월 3일 야간 근무 미반영", status: "결재 대기", requestedBy: "홍채원", date: "2026-05-15" },
  { id: "MA-2026-013", name: "정유진", dept: "재무/회계팀", item: "기타공제",  amount: -50000,  reason: "사내 동호회 회비",        status: "결재 대기", requestedBy: "이정환", date: "2026-05-15" },
  { id: "MA-2026-012", name: "최서연", dept: "개발팀",     item: "성과보너스", amount: +500000, reason: "긴급 릴리즈 기여",       status: "승인",     requestedBy: "한지영", date: "2026-05-14" },
  { id: "MA-2026-011", name: "이상민", dept: "영업팀",     item: "출장경비",  amount: +320000, reason: "5월 중국 출장 일비",      status: "승인",     requestedBy: "박서연", date: "2026-05-12" },
  { id: "MA-2026-010", name: "권하은", dept: "생산/제조팀", item: "교통비",   amount: +80000,  reason: "통근버스 운행 중단",     status: "반려",     requestedBy: "홍채원", date: "2026-05-10" },
];

function ManualAdjustPage({ data }) {
  const toast = useCtxR3(ToastContext);
  const pending = MANUAL_ADJUSTMENTS.filter((a) => a.status === "결재 대기").length;
  const approved = MANUAL_ADJUSTMENTS.filter((a) => a.status === "승인").length;
  const totalPositive = MANUAL_ADJUSTMENTS.filter((a) => a.amount > 0 && a.status === "승인").reduce((s, a) => s + a.amount, 0);
  const totalNegative = MANUAL_ADJUSTMENTS.filter((a) => a.amount < 0 && a.status === "승인").reduce((s, a) => s + Math.abs(a.amount), 0);

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>수동 조정</h1>
          <div className="greet-sub">개별 직원의 급여 항목을 수동으로 조정하고 결재해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2} /> 이력 내보내기</button>
          <button className="btn btn-primary"><Icons.Plus size={13} sw={2.2} /> 새 조정</button>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Clock size={13} sw={1.8} /></span> 결재 대기</div>
          <div className="ss-val">{pending}<span className="u">건</span></div>
          <div className="ss-foot">즉시 처리 필요</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8} /></span> 5월 승인</div>
          <div className="ss-val">{approved}<span className="u">건</span></div>
          <div className="ss-foot">급여 반영 예정</div>
        </div>
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.ArrowR size={13} sw={1.8} /></span> 가산 합계</div>
          <div className="ss-val">+₩{(totalPositive / 10000).toFixed(0)}<span className="u">만</span></div>
          <div className="ss-foot">5월 수동 가산</div>
        </div>
        <div className="ss-card ss-red">
          <div className="ss-h"><span className="ico"><Icons.ArrowR size={13} sw={1.8} /></span> 차감 합계</div>
          <div className="ss-val">−₩{(totalNegative / 10000).toFixed(0)}<span className="u">만</span></div>
          <div className="ss-foot">5월 수동 차감</div>
        </div>
      </div>

      <Card>
        <div className="card-head">
          <span className="title">수동 조정 이력</span>
          <span className="sub">최근 5월</span>
          <div className="right">
            <select className="select" style={{ padding: "5px 10px", fontSize: 12 }}>
              <option>전체 상태</option><option>결재 대기</option><option>승인</option><option>반려</option>
            </select>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th style={{ width: 130 }}>ID</th><th>직원</th><th>항목</th><th className="right">금액</th><th>사유</th><th>요청자</th><th>상태</th><th className="right"></th></tr>
            </thead>
            <tbody>
              {MANUAL_ADJUSTMENTS.map((a) => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.id}</td>
                  <td>
                    <div className="person">
                      <Avatar name={a.name} hue={(a.name.charCodeAt(0) * 47) % 360} size="sm" />
                      <div>
                        <div className="fw-6">{a.name}</div>
                        <div className="en">{a.dept}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="chip">{a.item}</span></td>
                  <td className="right mono tnum">
                    <span style={{ color: a.amount > 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                      {a.amount > 0 ? "+" : "−"}₩{Math.abs(a.amount).toLocaleString()}
                    </span>
                  </td>
                  <td className="small muted" style={{ maxWidth: 220 }}>{a.reason}</td>
                  <td className="small">{a.requestedBy}</td>
                  <td>
                    {a.status === "결재 대기" && <span className="chip warning">{a.status}</span>}
                    {a.status === "승인"     && <span className="chip success">{a.status}</span>}
                    {a.status === "반려"     && <span className="chip danger">{a.status}</span>}
                  </td>
                  <td className="right">
                    {a.status === "결재 대기" && (
                      <>
                        <button className="btn sm" onClick={() => toast(`${a.id} 반려`)}>반려</button>{" "}
                        <button className="btn sm btn-primary" onClick={() => toast(`${a.id} 승인`)}>승인</button>
                      </>
                    )}
                    {a.status !== "결재 대기" && <button className="btn sm btn-ghost"><Icons.Eye size={11} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px var(--space-6)", background: "var(--bg-sunk)", fontSize: 11.5, color: "var(--fg-muted)", borderTop: "1px solid var(--border)", lineHeight: 1.5 }}>
          <Icons.Alert size={11} sw={2} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          수동 조정 항목은 모두 <b style={{ color: "var(--fg)" }}>감사 로그</b>에 기록되며, 다음 급여 사이클에 자동 반영돼요.
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { InternalRecruitPage, BenefitsAdminPage, ManualAdjustPage });
