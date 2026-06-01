/* global React, Icons, Card, CardHead, ToastContext, JobPostingWizard */
// CTR HR Hub — 채용 공고 / 신규 등록 / 비정기 조정

const { useState: useStateRC, useContext: useCtxRC } = React;

function JobsPage({ data }) {
  const toast = useCtxRC(ToastContext);
  const [mode, setMode] = useStateRC("list");
  const [tab, setTab] = useStateRC("jobs");
  const jobs = [
    { id: "JOB-001", title: "프론트엔드 엔지니어", team: "개발팀", location: "서울", salary: "6,000 ~ 9,000만원", applicants: 5, status: "진행중", funnel: { applied: 5, screen: 3, interview: 2, offer: 0 }, dDay: 14 },
    { id: "JOB-002", title: "백엔드 엔지니어",   team: "개발팀", location: "서울", salary: "6,000 ~ 9,000만원", applicants: 3, status: "진행중", funnel: { applied: 3, screen: 2, interview: 1, offer: 0 }, dDay: 21 },
    { id: "JOB-003", title: "품질관리 엔지니어", team: "품질관리팀", location: "수원", salary: "비공개", applicants: 4, status: "진행중", funnel: { applied: 4, screen: 4, interview: 2, offer: 1 }, dDay: 7 },
    { id: "JOB-004", title: "HR Business Partner", team: "인사팀", location: "서울", salary: "5,500 ~ 8,500만원", applicants: 2, status: "진행중", funnel: { applied: 2, screen: 1, interview: 0, offer: 0 }, dDay: 28 },
    { id: "JOB-005", title: "재무회계 대리",       team: "재무/회계팀", location: "서울", salary: "4,500 ~ 6,500만원", applicants: 8, status: "진행중", funnel: { applied: 8, screen: 5, interview: 3, offer: 1 }, dDay: 3 },
  ];

  const totalApplicants = jobs.reduce((a, j) => a + j.funnel.applied, 0);
  const totalInterview = jobs.reduce((a, j) => a + j.funnel.interview, 0);
  const totalOffer = jobs.reduce((a, j) => a + j.funnel.offer, 0);

  if (mode === "new") return <JobPostingWizard onCancel={() => setMode("list")} onComplete={() => { setMode("list"); toast("공고 등록 요청 완료"); }}/>;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>채용</h1>
          <div className="greet-sub">채용 공고와 파이프라인을 관리해요.</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Download size={13} sw={2}/> 내보내기</button>
          <button className="btn btn-primary" onClick={() => setMode("new")}>
            <Icons.Plus size={13} sw={2.2}/> 새 공고
          </button>
        </div>
      </div>

      <div className="wd-stat-strip">
        <div className="ss-card">
          <div className="ss-h"><span className="ico"><Icons.Briefcase size={13} sw={1.8}/></span> 진행 공고</div>
          <div className="ss-val">{jobs.length}<span className="u">건</span></div>
          <div className="ss-foot">마감 임박 1건</div>
        </div>
        <div className="ss-card ss-purple">
          <div className="ss-h"><span className="ico"><Icons.Users size={13} sw={1.8}/></span> 전체 지원자</div>
          <div className="ss-val">{totalApplicants}<span className="u">명</span></div>
          <div className="ss-foot">이번 주 신규 6명</div>
        </div>
        <div className="ss-card ss-amber">
          <div className="ss-h"><span className="ico"><Icons.Inbox size={13} sw={1.8}/></span> 인터뷰 예정</div>
          <div className="ss-val">{totalInterview}<span className="u">건</span></div>
          <div className="ss-foot">금주 일정 조정 필요</div>
        </div>
        <div className="ss-card ss-green">
          <div className="ss-h"><span className="ico"><Icons.Check size={13} sw={1.8}/></span> 오퍼 발송</div>
          <div className="ss-val">{totalOffer}<span className="u">건</span></div>
          <div className="ss-foot">이번 주 수락 2건</div>
        </div>
      </div>

      <div className="wd-tab-bar">
        <button aria-selected={tab === "jobs"} onClick={() => setTab("jobs")}>
          <Icons.Briefcase size={13} sw={1.8}/> 공고 명세 <span className="count">{jobs.length}</span>
        </button>
        <button aria-selected={tab === "pipeline"} onClick={() => setTab("pipeline")}>
          <Icons.Chart size={13} sw={1.8}/> 파이프라인
        </button>
        <button aria-selected={tab === "candidates"} onClick={() => setTab("candidates")}>
          <Icons.Users size={13} sw={1.8}/> 후보군
        </button>
      </div>

      {tab === "jobs" && (
        <div className="wd-job-grid">
          {jobs.map((j) => (
            <div key={j.id} className="wd-job-card" onClick={() => toast(`${j.title} 열기`)}>
              <div className="jc-h">
                <div className="body">
                  <div className="jc-title">{j.title}</div>
                  <div className="jc-meta">
                    <span><Icons.Building size={12} sw={1.8}/> {j.team}</span>
                    <span><Icons.Globe size={12} sw={1.8}/> {j.location}</span>
                    <span><Icons.Wallet size={12} sw={1.8}/> {j.salary}</span>
                  </div>
                  <div className="jc-id">{j.id}</div>
                </div>
                <span className={`chip ${j.dDay <= 7 ? "warning" : "info"}`} style={{ flexShrink: 0 }}>
                  D-{j.dDay} 진행중
                </span>
              </div>
              <div className="wd-funnel">
                <div className="fn-cell">
                  <div className="lbl">지원</div>
                  <div className="num">{j.funnel.applied}</div>
                </div>
                <div className={`fn-cell ${j.funnel.screen > 0 ? "active" : ""}`}>
                  <div className="lbl">서류</div>
                  <div className="num">{j.funnel.screen}</div>
                </div>
                <div className={`fn-cell ${j.funnel.interview > 0 ? "warn" : ""}`}>
                  <div className="lbl">면접</div>
                  <div className="num">{j.funnel.interview}</div>
                </div>
                <div className={`fn-cell ${j.funnel.offer > 0 ? "active" : ""}`}>
                  <div className="lbl">오퍼</div>
                  <div className="num">{j.funnel.offer}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "pipeline" && (
        <>
          <div className="grid-2" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-head">
                <span className="title">평균 채용 소요 시간</span>
                <span className="sub">단계별 / 일</span>
              </div>
              <div className="card-pad">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { stage: "공고 → 지원", days: 8, target: 7, n: 12 },
                    { stage: "지원 → 서류", days: 3, target: 3, n: 12 },
                    { stage: "서류 → 1차면접", days: 6, target: 5, n: 9 },
                    { stage: "1차 → 2차면접", days: 4, target: 4, n: 5 },
                    { stage: "면접 → 오퍼", days: 5, target: 3, n: 3 },
                    { stage: "오퍼 → 입사", days: 6, target: 5, n: 2 },
                  ].map((s) => {
                    const color = s.days > s.target * 1.3 ? "var(--danger)" : s.days > s.target ? "oklch(50% 0.16 60)" : "var(--accent)";
                    return (
                      <div key={s.stage} style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px", gap: 10, alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "var(--fg-muted)" }}>{s.stage}</span>
                        <div style={{ position: "relative", height: 10, background: "var(--bg-sunk)", borderRadius: 3 }}>
                          <div style={{ position: "absolute", left: `${(s.target / 10) * 100}%`, top: -2, bottom: -2, width: 1, background: "var(--fg-faint)" }} />
                          <div style={{ width: `${(s.days / 10) * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
                        </div>
                        <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color }}>{s.days}일 / {s.target}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  <b style={{ color: "var(--fg)" }}>인사이트</b> · 전체 평균 <b>32일</b>. 면접 → 오퍼 단계가 가장 지연 (목표 +67%). 채용 매니저 협의 단축 필요.
                </div>
              </div>
            </Card>

            <Card>
              <div className="card-head">
                <span className="title">채널별 효과성</span>
                <span className="sub">12개월 누계 · 67명 채용</span>
              </div>
              <div className="card-pad">
                <div className="tbl-wrap">
                  <table className="tbl" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>채널</th>
                        <th className="right">지원</th>
                        <th className="right">합격</th>
                        <th className="right">수락률</th>
                        <th className="right">1년 잔존</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { ch: "내부 추천",  apply: 38, hire: 18, accept: 78, retain: 100 },
                        { ch: "공개 채용",  apply: 142, hire: 32, accept: 62, retain: 85 },
                        { ch: "헤드헌터",   apply: 24, hire: 11, accept: 58, retain: 73 },
                        { ch: "사내 이동",  apply: 8,  hire: 6,  accept: 100, retain: 100 },
                      ].map((c) => {
                        const acc = c.accept >= 75 ? "var(--success)" : c.accept >= 60 ? "oklch(50% 0.16 60)" : "var(--danger)";
                        const ret = c.retain >= 90 ? "var(--success)" : c.retain >= 80 ? "oklch(50% 0.16 60)" : "var(--danger)";
                        return (
                          <tr key={c.ch}>
                            <td className="fw-6">{c.ch}</td>
                            <td className="right mono tnum">{c.apply}</td>
                            <td className="right mono tnum">{c.hire}</td>
                            <td className="right mono tnum"><span style={{ color: acc, fontWeight: 700 }}>{c.accept}%</span></td>
                            <td className="right mono tnum"><span style={{ color: ret, fontWeight: 700 }}>{c.retain}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, padding: "10px 14px", background: "oklch(95% 0.05 145)", borderRadius: 8, fontSize: 12, color: "oklch(40% 0.14 145)", lineHeight: 1.5, fontWeight: 500 }}>
                  ✓ <b>내부 추천 + 사내 이동</b>이 수락률·잔존율 모두 최고. 추천 보상 확대 권장.
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ marginBottom: "var(--space-4)" }}>
            <div className="card-head">
              <span className="title">월별 합격률 추이</span>
              <span className="sub">12개월</span>
            </div>
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4, alignItems: "flex-end", height: 140 }}>
                {[
                  { m: "6월", pct: 22 }, { m: "7월", pct: 25 }, { m: "8월", pct: 28 },
                  { m: "9월", pct: 24 }, { m: "10월", pct: 30 }, { m: "11월", pct: 32 },
                  { m: "12월", pct: 28 }, { m: "1월", pct: 26 }, { m: "2월", pct: 30 },
                  { m: "3월", pct: 35 }, { m: "4월", pct: 38 }, { m: "5월", pct: 36 },
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{b.pct}%</span>
                    <div style={{ width: "72%", height: `${(b.pct / 40) * 100}%`, background: "var(--accent)", borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                    <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>{b.m}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--fg-faint)" }}>
                ※ 합격률 = 면접 통과 / 지원 전체. 최근 6개월 추세 ↑ (브랜드 효과)
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <span className="title">직무별 채용 비교</span>
              <span className="sub">진행 중 공고 5건</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>직무</th>
                    <th className="right">소요 시간</th>
                    <th className="right">지원자</th>
                    <th className="right">합격률</th>
                    <th className="right">평균 면접 점수</th>
                    <th>인기도</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { job: "프론트엔드 엔지니어", days: 28, apply: 38, hire: 8.3, score: 4.2, hot: 90 },
                    { job: "백엔드 엔지니어", days: 32, apply: 42, hire: 7.1, score: 4.0, hot: 95 },
                    { job: "품질관리 엔지니어", days: 45, apply: 12, hire: 16.7, score: 3.8, hot: 35 },
                    { job: "HR Business Partner", days: 38, apply: 18, hire: 11.1, score: 4.1, hot: 55 },
                    { job: "재무회계 대리", days: 22, apply: 24, hire: 12.5, score: 4.3, hot: 70 },
                  ].map((j) => (
                    <tr key={j.job}>
                      <td className="fw-6">{j.job}</td>
                      <td className="right mono tnum">{j.days}일</td>
                      <td className="right mono tnum">{j.apply}명</td>
                      <td className="right mono tnum">{j.hire}%</td>
                      <td className="right mono tnum">{j.score}/5</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 80, height: 6, background: "var(--bg-sunk)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${j.hot}%`, height: "100%", background: j.hot >= 70 ? "var(--accent)" : j.hot >= 50 ? "oklch(50% 0.16 60)" : "var(--fg-faint)", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{j.hot}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {tab === "candidates" && (
        <Card>
          <div className="empty" style={{ padding: "var(--space-10)" }}>
            <Icons.Users size={28}/>
            <div className="em-title">후보군 관리는 다음 라운드에서 업데이트돼요</div>
            <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>임원 외 재지원 후보 대상자 풀</div>
          </div>
        </Card>
      )}
    </div>
  );
}

function JobNewForm({ onCancel, onSave }) {
  const [hidden, setHidden] = useStateRC(false);
  return (
    <div className="content">
      <div className="page-h">
        <div className="flex center gap-2 small">
          <button className="action" onClick={onCancel}><Icons.ChevL size={12}/> 채용 공고</button>
          <span className="faint">/</span>
          <span className="muted">신규</span>
        </div>
      </div>

      <h1 style={{ marginBottom: "var(--space-5)", fontSize: 24, fontWeight: 700 }}>새 공고 등록</h1>

      <div className="flex col gap-4">
        <Card>
          <CardHead title="기본 정보"/>
          <div className="card-pad flex col gap-4">
            <div className="field"><label>직무 제목 *</label><input className="input" placeholder="예: 시니어 프론트엔드 엔지니어"/></div>
            <div className="grid-2">
              <div className="field"><label>소속 팀 *</label><select className="select"><option>선택</option><option>개발팀</option><option>영업팀</option><option>인사팀</option></select></div>
              <div className="field"><label>고용 형태 *</label><select className="select"><option>정규직</option><option>계약직</option><option>인턴</option></select></div>
            </div>
            <div className="field"><label>근무지</label><input className="input" placeholder="예: 서울 강남구"/></div>
          </div>
        </Card>

        <Card>
          <CardHead title="자격 요건 / 우대 사항"/>
          <div className="card-pad flex col gap-4">
            <div className="field">
              <label>자격 요건</label>
              <textarea className="input" placeholder="필수 자격 요건을 입력하세요." style={{ minHeight: 130, fontFamily: "inherit", resize: "vertical" }}/>
            </div>
            <div className="field">
              <label>우대 사항</label>
              <textarea className="input" placeholder="우대 사항을 입력하세요." style={{ minHeight: 130, fontFamily: "inherit", resize: "vertical" }}/>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="급여"/>
          <div className="card-pad">
            <div className="grid-2">
              <div className="field">
                <label>급여 하한 (원)</label>
                <input className="input" type="number" defaultValue="0" disabled={hidden}/>
              </div>
              <div className="field">
                <label>급여 상한 (원)</label>
                <input className="input" type="number" defaultValue="0" disabled={hidden}/>
              </div>
            </div>
            <label className="flex center gap-2 small" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)}/>
              급여 비공개
            </label>
          </div>
        </Card>

        <Card>
          <CardHead title="채용정보"/>
          <div className="card-pad">
            <div className="grid-2">
              <div className="field"><label>마감일</label><input className="input" type="date"/></div>
              <div className="field"><label>채용담당자</label><select className="select"><option>선택 안함</option><option>한지영</option><option>유서아</option></select></div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>필요 역량 (쉼표 구분)</label>
              <input className="input" placeholder="예: 품질관리, IATF16949, 자동차부품, 영어"/>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex" style={{ justifyContent: "flex-end", gap: 8, marginTop: "var(--space-5)" }}>
        <button className="btn" onClick={onCancel}>취소</button>
        <button className="btn btn-primary" onClick={onSave}>
          <Icons.Sparkle size={14}/> 공고 등록
        </button>
      </div>
    </div>
  );
}

// ── 비정기 조정 (Off-cycle compensation) ─────────────────────────────
function OffCyclePage({ data }) {
  const [tab, setTab] = useStateRC("all");
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <div className="cap" style={{ marginBottom: 4 }}>보상 / Off-Cycle 조정</div>
          <h1>비정기 급여 조정</h1>
          <div className="greet-sub">정기 보상 외 개별 급여 조정 요청을 관리해요.</div>
        </div>
        <div className="right">
          <button className="btn btn-primary"><Icons.Plus size={14} sw={2.2}/> 새 요청</button>
        </div>
      </div>

      <div className="pill-tabs" style={{ marginBottom: "var(--space-4)" }}>
        {[["all", "전체"], ["draft", "초안"], ["wait", "승인 대기"], ["approve", "승인됨"], ["reject", "반려됨"]].map(([id, lbl]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="search-wrap grow"><Icons.Search/><input className="input search-input" placeholder="직원 이름 검색..."/></div>
        <select className="select"><option>전체 사유</option></select>
      </div>

      <Card>
        <div className="empty" style={{ padding: "var(--space-10)" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--bg-sunk)", color: "var(--fg-muted)", display: "grid", placeItems: "center" }}>
            <Icons.Inbox size={28}/>
          </div>
          <div className="em-title fw-7" style={{ fontSize: 14, color: "var(--fg)" }}>비정기 조정 요청이 없습니다</div>
          <div className="small faint">조건에 맞는 요청이 없어요. 필터를 변경하거나 새 요청을 생성하세요.</div>
          <button className="btn" style={{ marginTop: 8 }}>새 요청 생성</button>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { JobsPage, OffCyclePage });
