/* global React, Icons, Avatar, Card, fmtKDate, fmtWon, fmtWonShort, tenureFromISO, ToastContext */
// CTR HR Hub — 내 프로필 (Workday Self-Service Worker Profile)

const { useState: useStateMP, useContext: useCtxMP } = React;

function MyProfilePage({ data }) {
  const toast = useCtxMP(ToastContext);
  const me = data.me;
  const [tab, setTab] = useStateMP("summary");

  return (
    <div className="content" style={{ padding: "var(--space-5) var(--space-6) var(--space-10)", maxWidth: 1440, margin: "0 auto" }}>
      {/* ── Worker Banner ─────────────────────── */}
      <div className="wd-worker-banner">
        <div className="wb-pattern" />
        <div className="wb-top">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            <Icons.User size={12} sw={2} /> 내 프로필
          </div>
          <div className="wb-actions">
            <button className="btn"><Icons.Sparkle size={13} /> 사진 변경</button>
            <button className="btn"><Icons.Mail size={13} /> 명함 다운로드</button>
            <button className="btn btn-primary"><Icons.Doc size={13} /> 정보 수정 요청</button>
          </div>
        </div>

        <div className="wb-body">
          <div className="wb-avatar-slot">
            <div className="wb-avatar" style={{ "--av-hue": me.avatarHue }}>
              {me.avatar || me.name.charAt(0)}
            </div>
          </div>
          <div className="wb-id">
            <h1 className="wb-name">{me.name}</h1>
            <div className="wb-name-en">{me.nameEn} · {me.code}</div>
            <div className="wb-meta">
              <span><b>{me.title}</b></span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{me.team}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{me.dept}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span className="wb-status">
                <span className="d" style={{ background: "oklch(76% 0.16 145)" }} />
                재직 중
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar (identical to Employee Detail) ─────────────────── */}
      <div className="wd-tab-bar">
        {[
          ["summary",    "요약",       Icons.User],
          ["job",        "직무 이력",  Icons.Briefcase],
          ["payroll",    "급여",       Icons.Wallet],
          ["attendance", "근태",       Icons.Clock],
          ["leave",      "휴가/휴직",  Icons.Calendar],
          ["perf",       "성과 평가",  Icons.Trophy],
          ["career",     "경력 이력",  Icons.ArrowR],
        ].map(([id, label, Icon]) => (
          <button key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
            <Icon size={14} sw={1.8} /> {label}
          </button>
        ))}
      </div>

      {/* ── Summary ──────────────────────────── */}
      {tab === "summary" && (
        <>
          <Card className="wd-section">
            <div className="card-head">
              <span className="title">인사 정보</span>
              <div className="right">
                <button className="btn sm"><Icons.Sparkle size={12} /> 수정 요청</button>
              </div>
            </div>
            <div className="card-pad">
              <div className="wd-kv-grid">
                <div className="wd-kv"><div className="k">사원번호</div><div className="v" style={{ fontFamily: "var(--font-mono)" }}>{me.code}</div></div>
                <div className="wd-kv"><div className="k">입사일</div><div className="v" style={{ fontFamily: "var(--font-mono)" }}>{fmtKDate(me.startDate)}</div></div>
                <div className="wd-kv"><div className="k">직위</div><div className="v">{me.title}</div></div>
                <div className="wd-kv"><div className="k">직급</div><div className="v">{me.rank}</div></div>
                <div className="wd-kv"><div className="k">부서</div><div className="v">{me.dept}</div></div>
                <div className="wd-kv"><div className="k">팀</div><div className="v">{me.team}</div></div>
                <div className="wd-kv"><div className="k">이메일</div><div className="v" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{me.email}</div></div>
                <div className="wd-kv"><div className="k">근속</div><div className="v">{tenureFromISO(me.startDate)}</div></div>
                <div className="wd-kv"><div className="k">생년월일</div><div className="v empty">—</div></div>
                <div className="wd-kv"><div className="k">성별</div><div className="v empty">—</div></div>
                <div className="wd-kv"><div className="k">국적</div><div className="v empty">—</div></div>
                <div className="wd-kv"><div className="k">연락처</div><div className="v empty">—</div></div>
              </div>
            </div>
          </Card>

          <div className="grid-21">
            <Card className="wd-section">
              <div className="card-head">
                <span className="title">자기소개</span>
                <div className="right">
                  <button className="btn sm"><Icons.Sparkle size={12} /> 수정</button>
                </div>
              </div>
              <div className="card-pad">
                <div style={{ padding: "16px 0", color: "var(--fg-faint)", fontSize: 13, lineHeight: 1.6 }}>
                  아직 작성된 자기소개가 없어요. <span style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 500 }}>지금 작성하기 →</span>
                </div>
              </div>
            </Card>

            <Card className="wd-section">
              <div className="card-head">
                <span className="title">수정 요청 내역</span>
                <span className="sub">{me.pendingRequests.length}건</span>
              </div>
              <div className="list">
                {me.pendingRequests.map((r, i) => (
                  <div key={i} className="item" style={{ alignItems: "flex-start", padding: "12px var(--space-6)" }}>
                    <div className="grow">
                      <div className="title">{r.kind}</div>
                      <div className="meta">
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>→ {r.to}</span>
                        <span className="sep">·</span>
                        <span>{fmtKDate(r.date)}</span>
                      </div>
                    </div>
                    <span className="chip warning">{r.status}</span>
                  </div>
                ))}
                {me.pendingRequests.length === 0 && (
                  <div style={{ padding: "20px 24px", color: "var(--fg-faint)", textAlign: "center", fontSize: 12.5 }}>
                    진행 중인 수정 요청이 없습니다
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card className="wd-section">
            <div className="card-head">
              <span className="title">비상연락처</span>
              <div className="right">
                <button className="btn sm"><Icons.Plus size={12} sw={2.2} /> 추가</button>
              </div>
            </div>
            <div className="empty" style={{ padding: "var(--space-8)" }}>
              <Icons.Alert size={28} />
              <div className="em-title">등록된 비상연락처가 없습니다</div>
              <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 6 }}>가족·지인 연락처를 등록하면 응급 상황 시 빠르게 연락드릴 수 있어요.</div>
            </div>
          </Card>
        </>
      )}

      {/* ── Job History ──────────────────────────── */}
      {tab === "job" && (
        <Card className="wd-section">
          <div className="card-head"><span className="title">직무 발령 이력</span></div>
          <div style={{ padding: "var(--space-5) var(--space-6)" }}>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, background: "var(--border)" }} />
              {[
                { type: "신규 입사", date: me.startDate, from: null, to: me.dept, reason: "신규 채용" },
                { type: "부서 이동", date: "2023-06-01", from: "기획팀", to: "인사팀", reason: "조직 개편" },
                { type: "승진", date: "2024-01-01", from: "주임", to: me.rank, reason: "정기 승진" },
              ].map((a, i, arr) => (
                <div key={i} style={{ position: "relative", paddingBottom: i === arr.length - 1 ? 0 : 24 }}>
                  <div style={{ position: "absolute", left: -23, top: 4, width: 16, height: 16, borderRadius: "50%", background: "var(--accent)", border: "3px solid var(--bg-elev)" }} />
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.type}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{fmtKDate(a.date)}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    {a.from && <><span style={{ color: "var(--fg-faint)" }}>{a.from}</span> <span style={{ color: "var(--fg-muted)" }}>→</span> </>}
                    <span style={{ fontWeight: 600 }}>{a.to}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-faint)", marginTop: 2 }}>사유: {a.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Payroll ──────────────────────────── */}
      {tab === "payroll" && (
        <>
          <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>연봉</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>₩72.0M</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>밴드: L3 · 과장</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>월 급여 (총)</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>₩6.0M</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>12개월 분할</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>최근 실수령</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>₩4.38M</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>2026.04.25 지급</div>
              </div>
            </Card>
          </div>
          <Card className="wd-section">
            <div className="card-head">
              <span className="title">최근 급여 명세</span>
              <span className="sub">5개월</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>지급일</th><th className="right">총지급액</th><th className="right">공제</th><th className="right">실지급</th><th></th></tr></thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map((i) => {
                    const m = 4 - i;
                    const date = `2026-${String(m === 0 ? 12 : m).padStart(2, "0")}-25`;
                    return (
                      <tr key={i}>
                        <td className="mono">{fmtKDate(date)}</td>
                        <td className="right mono tnum">5,200,000</td>
                        <td className="right mono tnum">820,500</td>
                        <td className="right mono tnum fw-7">4,379,500</td>
                        <td><button className="btn sm" onClick={() => toast("PDF 다운로드")}><Icons.Download size={12} /> PDF</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Attendance ──────────────────────────── */}
      {tab === "attendance" && (
        <>
          <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>근무일수 (30일)</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>21<span style={{ fontSize: 13, marginLeft: 4 }}>일</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>정상 출근</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>지각</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)", color: "oklch(50% 0.16 60)" }}>0<span style={{ fontSize: 13, marginLeft: 4 }}>회</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>이번 달</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>평균 근무시간</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>8.4<span style={{ fontSize: 13, marginLeft: 4 }}>h</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>일 평균</div>
              </div>
            </Card>
          </div>
          <Card className="wd-section">
            <div className="card-head"><span className="title">최근 30일 근태</span></div>
            <div className="card-pad">
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
                  {Array.from({ length: 30 }, (_, i) => {
                    const r = (i * 31) % 100;
                    const kind = r < 5 ? "absent" : r < 12 ? "late" : r < 18 ? "leave" : "present";
                    const colors = { present: "var(--success)", late: "var(--warning)", absent: "var(--danger)", leave: "var(--info)" };
                    return <div key={i} title={`${i + 1}일`} style={{ aspectRatio: "1", borderRadius: 6, background: colors[kind], opacity: 0.78 }} />;
                  })}
                </div>
                <div className="flex gap-4 small faint" style={{ marginTop: 16 }}>
                  {[["present", "정상", "var(--success)"], ["late", "지각", "var(--warning)"], ["absent", "결근", "var(--danger)"], ["leave", "휴가", "var(--info)"]].map(([k, l, c]) => (
                    <div key={k} className="flex center gap-2">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.78 }} />
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ── Leave ──────────────────────────── */}
      {tab === "leave" && (
        <>
          <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>잔여 연차</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>12.5<span style={{ fontSize: 13, marginLeft: 4 }}>일</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>총 15일 중 2.5일 사용</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>올해 사용률</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>17<span style={{ fontSize: 13, marginLeft: 4 }}>%</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>전사 평균 48.3%</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>휴직 이력</div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>0<span style={{ fontSize: 13, marginLeft: 4 }}>건</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>전체 기간</div>
              </div>
            </Card>
          </div>
          <Card className="wd-section">
            <div className="card-head">
              <span className="title">사용 이력</span>
              <span className="sub">올해 누적</span>
            </div>
            <div className="empty" style={{ padding: "var(--space-8)" }}>
              <Icons.EmptyBox size={24} />
              <div className="em-title">최근 휴직 이력이 없습니다</div>
            </div>
          </Card>
        </>
      )}

      {/* ── Performance ──────────────────────────── */}
      {tab === "perf" && (
        <>
          <div className="grid-3" style={{ marginBottom: "var(--space-4)" }}>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>최근 등급</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: "oklch(45% 0.16 290)", letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>E</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>Excellent · 2025 H2</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>MBO 평균 달성</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: "var(--success)", letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>108<span style={{ fontSize: 14, marginLeft: 2 }}>%</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>4개 사이클 평균</div>
              </div>
            </Card>
            <Card>
              <div className="card-pad">
                <div style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>받은 칭찬</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: "oklch(50% 0.18 25)", letterSpacing: "-0.02em", marginTop: 4, fontFamily: "var(--font-mono)" }}>12<span style={{ fontSize: 14, marginLeft: 2 }}>건</span></div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>12개월 누적</div>
              </div>
            </Card>
          </div>

          <Card className="wd-section">
            <div className="card-head"><span className="title">평가 이력</span></div>
            <div className="list">
              {[
                { period: "2025 H2", score: "E", manager: "이정환", comment: "탁월한 리더십과 결과 도출" },
                { period: "2025 H1", score: "E", manager: "이정환", comment: "팀 프로세스 개선 주도" },
                { period: "2024 H2", score: "M", manager: "박서연", comment: "안정적 성과 유지" },
              ].map((e, i) => (
                <div key={i} className="item">
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 }}>
                    {e.score}
                  </div>
                  <div className="grow">
                    <div className="title">{e.period}</div>
                    <div className="meta">
                      <span>평가자 {e.manager}</span>
                      <span className="sep">·</span>
                      <span>"{e.comment}"</span>
                    </div>
                  </div>
                  <button className="btn sm"><Icons.Eye size={12} /> 상세</button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">MBO 달성 이력</span><span className="sub">최근 4개 사이클</span></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>사이클</th><th>목표 수</th><th className="right">달성률</th><th>주요 목표</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="fw-6">2025 H2</td>
                    <td className="mono">4개</td>
                    <td className="right mono tnum"><span style={{ color: "var(--success)", fontWeight: 700 }}>115%</span></td>
                    <td className="small muted">팀 운영 효율화 · 신규 입사자 멘토링</td>
                  </tr>
                  <tr>
                    <td className="fw-6">2025 H1</td>
                    <td className="mono">3개</td>
                    <td className="right mono tnum"><span style={{ color: "var(--success)", fontWeight: 700 }}>108%</span></td>
                    <td className="small muted">HR 시스템 도입 + 정착</td>
                  </tr>
                  <tr>
                    <td className="fw-6">2024 H2</td>
                    <td className="mono">4개</td>
                    <td className="right mono tnum">102%</td>
                    <td className="small muted">평가 사이클 운영 안정화</td>
                  </tr>
                  <tr>
                    <td className="fw-6">2024 H1</td>
                    <td className="mono">3개</td>
                    <td className="right mono tnum">106%</td>
                    <td className="small muted">신규 채용 프로세스 개선</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">받은 칭찬</span><span className="sub">최근 6건</span></div>
            <div className="list">
              {[
                { from: "이정환", value: "리더십", reason: "어려운 결재 흐름 빠르게 정리해주심", date: "어제" },
                { from: "박서연", value: "협업",   reason: "타팀 협의 잘 이끌어주심", date: "1주 전" },
                { from: "최서연", value: "친절함", reason: "온보딩 도움이 정말 컸어요", date: "2주 전" },
                { from: "홍채원", value: "전문성", reason: "데이터 기반 의사결정 인상적", date: "1개월 전" },
                { from: "권하은", value: "주도성", reason: "1:1 미팅을 먼저 챙겨주심", date: "2개월 전" },
                { from: "정유진", value: "친절함", reason: "급여 관련 문의에 친절하게 답변", date: "3개월 전" },
              ].map((k, i) => (
                <div key={i} className="item">
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "oklch(95% 0.05 25)", color: "oklch(50% 0.18 25)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icons.Heart size={16} sw={1.8} />
                  </div>
                  <div className="grow">
                    <div className="title">{k.from} 님이 칭찬했어요</div>
                    <div className="meta"><span style={{ fontStyle: "italic" }}>"{k.reason}"</span></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span className="chip accent" style={{ fontSize: 10.5 }}>{k.value}</span>
                    <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>{k.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ── Career ──────────────────────────── */}
      {tab === "career" && (
        <>
          <Card className="wd-section">
            <div className="card-head"><span className="title">학력</span></div>
            <div className="list">
              {[
                { school: "서울대학교 대학원", major: "산업공학 석사", period: "2018.03 — 2020.02", status: "졸업" },
                { school: "한양대학교",       major: "산업공학 학사", period: "2014.03 — 2018.02", status: "졸업" },
                { school: "서울고등학교",     major: "이공계열",     period: "2011.03 — 2014.02", status: "졸업" },
              ].map((s, i) => (
                <div key={i} className="item">
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icons.Book size={16} sw={1.8} />
                  </div>
                  <div className="grow">
                    <div className="title">{s.school}</div>
                    <div className="meta">
                      <span>{s.major}</span>
                      <span className="sep">·</span>
                      <span className="mono small">{s.period}</span>
                    </div>
                  </div>
                  <span className="chip success">{s.status}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">자격증 / 인증</span><span className="sub">{me.certCount}건</span></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>자격증</th><th>발급기관</th><th className="right">취득일</th><th className="right">상태</th></tr></thead>
                <tbody>
                  <tr><td className="fw-6">PHR (HR Professional)</td><td className="small muted">HRCI</td><td className="right mono">2023.06</td><td className="right"><span className="chip success">유효</span></td></tr>
                  <tr><td className="fw-6">컴퓨터활용능력 1급</td><td className="small muted">대한상공회의소</td><td className="right mono">2019.05</td><td className="right"><span className="chip success">유효</span></td></tr>
                  <tr><td className="fw-6">TOEIC 925</td><td className="small muted">ETS</td><td className="right mono">2022.11</td><td className="right"><span className="chip warning">갱신 임박</span></td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">보유 스킬</span><span className="sub">{me.skills.length}개</span></div>
            <div className="card-pad">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {me.skills.map((s, i) => (
                  <span key={i} className="chip accent" style={{ padding: "6px 12px", fontSize: 13 }}>{s}</span>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: 14, background: "var(--bg-sunk)", borderRadius: 10, fontSize: 12.5, color: "var(--fg-muted)" }}>
                <Icons.Sparkle size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: "var(--accent)" }} />
                스킬 자기평가는 <span style={{ fontWeight: 600, color: "var(--accent)" }}>역량 자기평가</span> 페이지에서 갱신할 수 있어요.
              </div>
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">교육 이수 이력</span><span className="sub">12개월</span></div>
            <div className="list">
              {[
                { course: "리더십 부트캠프 Lv.2", hours: 24, type: "내부", date: "2025.11", status: "수료" },
                { course: "HR 애널리틱스",        hours: 16, type: "외부", date: "2025.09", status: "수료" },
                { course: "직장 내 괴롭힘 예방 (법정)", hours: 1, type: "법정", date: "2025.06", status: "수료" },
                { course: "정보보안 기초 (법정)",    hours: 2, type: "법정", date: "2025.03", status: "수료" },
                { course: "Workday 관리자 교육",   hours: 6, type: "내부", date: "2025.02", status: "수료" },
              ].map((c, i) => (
                <div key={i} className="item">
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "oklch(94% 0.04 230)", color: "oklch(45% 0.13 230)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icons.Book size={16} sw={1.8} />
                  </div>
                  <div className="grow">
                    <div className="title">{c.course}</div>
                    <div className="meta">
                      <span>{c.type}</span>
                      <span className="sep">·</span>
                      <span>{c.hours}시간</span>
                      <span className="sep">·</span>
                      <span className="mono">{c.date}</span>
                    </div>
                  </div>
                  <span className="chip success">{c.status}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">사내 활동</span></div>
            <div className="card-pad">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["HR 워킹그룹 리드", "사내 봉사단", "여성 리더 네트워크", "신입 멘토", "OKR 워킹그룹"].map((a) => (
                  <span key={a} className="chip accent" style={{ padding: "5px 12px", fontSize: 12 }}>{a}</span>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

Object.assign(window, { MyProfilePage });
