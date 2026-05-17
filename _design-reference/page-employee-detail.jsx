/* global React, Icons, Avatar, Card, fmtKDate, fmtWon, fmtWonShort, tenureFromISO */
// CTR HR Hub — 직원 프로필 상세 (Workday Worker Profile)

const { useState: useStateED } = React;

const KV = ({ k, v, empty }) => (
  <div className="wd-kv">
    <div className="k">{k}</div>
    <div className={`v ${empty ? "empty" : ""}`}>{empty ? "—" : v}</div>
  </div>
);

function EmployeeDetailPage({ data, code, onBack }) {
  const employee = data.directory.find((e) => e.code === code) || data.directory[0];
  const detail = data.employeeDetail;
  const [tab, setTab] = useStateED("summary");

  return (
    <div className="content" style={{ padding: "var(--space-5) var(--space-6) var(--space-10)", maxWidth: 1440, margin: "0 auto" }}>
      {/* ── Worker Banner ─────────────────────── */}
      <div className="wd-worker-banner">
        <div className="wb-pattern" />
        <div className="wb-top">
          <button className="wb-back" onClick={onBack}>
            <Icons.ChevL size={12} sw={2} /> 직원 관리
          </button>
          <div className="wb-actions">
            <button className="btn"><Icons.Mail size={13} /> 메시지</button>
            <button className="btn"><Icons.Doc size={13} /> 발령서</button>
            <button className="btn btn-primary"><Icons.Sparkle size={13} /> 정보 편집</button>
          </div>
        </div>

        <div className="wb-body">
          <div className="wb-avatar-slot">
            <div className="wb-avatar" style={{ "--av-hue": employee.hue }}>
              {employee.name.charAt(0)}
            </div>
          </div>
          <div className="wb-id">
            <h1 className="wb-name">{employee.name}</h1>
            <div className="wb-name-en">{employee.nameEn} · {employee.code}</div>
            <div className="wb-meta">
              <span><b>{employee.title || employee.rank}</b></span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{employee.dept}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{data.company.name}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span className="wb-status">
                <span className="d" style={{
                  background: employee.status === "재직" ? "oklch(76% 0.16 145)" :
                             employee.status === "휴직" ? "oklch(76% 0.16 75)" :
                             "oklch(70% 0.18 25)"
                }} />
                {employee.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────── */}
      <div className="wd-tab-bar">
        {[
          ["summary",    "요약",       Icons.User],
          ["job",        "직무 정보",  Icons.Briefcase],
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

      {/* ── Tab Content ──────────────────────────── */}
      {tab === "summary" && (
        <>
          <Card className="wd-section">
            <div className="card-head">
              <span className="title">인적 사항</span>
              <div className="right">
                <button className="btn sm"><Icons.Sparkle size={12} /> 편집</button>
              </div>
            </div>
            <div className="card-pad">
              <div className="wd-kv-grid">
                <KV k="한국어 이름" v={employee.name} />
                <KV k="영문 이름"   v={<span className="mono">{employee.nameEn}</span>} />
                <KV k="사번"        v={<span className="mono">{employee.code}</span>} />
                <KV k="생년월일"     empty />
                <KV k="성별"        empty />
                <KV k="국적"        empty />
                <KV k="이메일"      v={<span className="mono">{employee.email || `kr${employee.code.slice(-4)}@ctr.co.kr`}</span>} />
                <KV k="연락처"      empty />
                <KV k="비상 연락처" empty />
              </div>
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head">
              <span className="title">고용 정보</span>
              <div className="right">
                <button className="btn sm"><Icons.Sparkle size={12} /> 편집</button>
              </div>
            </div>
            <div className="card-pad">
              <div className="wd-kv-grid">
                <KV k="법인"      v={data.company.name} />
                <KV k="부서"      v={employee.dept} />
                <KV k="직위"      v={employee.title} />
                <KV k="직급"      v={employee.rank} />
                <KV k="직군"      v={employee.team} />
                <KV k="입사일"    v={<span className="mono">{fmtKDate(employee.joinDate)}</span>} />
                <KV k="고용 형태" v={employee.employment} />
                <KV k="근속"      v={tenureFromISO(employee.joinDate)} />
                <KV k="상태"      v={employee.status} />
              </div>
            </div>
          </Card>
        </>
      )}

      {tab === "job" && (
        <Card className="wd-section">
          <div className="card-head"><span className="title">발령 이력</span></div>
          <div style={{ padding: "var(--space-5) var(--space-6)" }}>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, background: "var(--border)" }} />
              {detail.appointments.map((a, i) => (
                <div key={i} style={{ position: "relative", paddingBottom: i === detail.appointments.length - 1 ? 0 : 24 }}>
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

      {tab === "payroll" && (
        <>
          <div className="kpi-grid cols-3" style={{ marginBottom: "var(--space-4)" }}>
            <div className="kpi">
              <div className="label">연봉</div>
              <div className="val tnum">{fmtWonShort(detail.payroll.annual)}</div>
              <div className="foot">밴드: {detail.payroll.band}</div>
            </div>
            <div className="kpi">
              <div className="label">월 급여 (총)</div>
              <div className="val tnum">{fmtWonShort(detail.payroll.monthlyGross)}</div>
              <div className="foot">12개월 분할</div>
            </div>
            <div className="kpi">
              <div className="label">최근 실수령</div>
              <div className="val tnum">{fmtWonShort(detail.payroll.lastPaid.net)}</div>
              <div className="foot">{fmtKDate(detail.payroll.lastPaid.date)} 지급</div>
            </div>
          </div>
          <Card>
            <div className="card-head"><span className="title">최근 급여 명세</span></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>지급일</th><th className="right">총지급액</th><th className="right">공제</th><th className="right">실지급</th><th></th></tr></thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map((i) => {
                    const m = 4 - i;
                    const date = `2026-${String(m === 0 ? 12 : m).padStart(2, "0")}-25`;
                    const gross = detail.payroll.monthlyGross;
                    const net = detail.payroll.lastPaid.net;
                    return (
                      <tr key={i}>
                        <td className="mono">{fmtKDate(date)}</td>
                        <td className="right mono tnum">{fmtWon(gross)}</td>
                        <td className="right mono tnum">{fmtWon(gross - net)}</td>
                        <td className="right mono tnum fw-7">{fmtWon(net)}</td>
                        <td><button className="btn sm"><Icons.Download size={12} /> PDF</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "attendance" && (
        <>
          <div className="kpi-grid" style={{ marginBottom: "var(--space-4)" }}>
            <div className="kpi"><div className="label">근무일수</div><div className="val tnum">{detail.attendance30.workDays}<span className="unit">일</span></div></div>
            <div className="kpi"><div className="label">지각</div><div className="val tnum">{detail.attendance30.late}<span className="unit">회</span></div></div>
            <div className="kpi"><div className="label">결근</div><div className="val tnum">{detail.attendance30.absent}<span className="unit">회</span></div></div>
            <div className="kpi"><div className="label">평균 근무시간</div><div className="val tnum">{detail.attendance30.avgWork}</div></div>
          </div>
          <Card>
            <div className="card-head"><span className="title">최근 30일 근태</span></div>
            <div className="card-pad"><AttendanceMiniCalendar /></div>
          </Card>
        </>
      )}

      {tab === "leave" && (
        <Card>
          <div className="card-head"><span className="title">연차 / 휴직</span></div>
          <div className="card-pad">
            <div className="kpi-grid cols-3" style={{ marginBottom: "var(--space-4)" }}>
              <div className="kpi"><div className="label">잔여 연차</div><div className="val tnum">{detail.leaveBalance.remaining}<span className="unit">일</span></div><div className="foot">총 {detail.leaveBalance.total}일 중 {detail.leaveBalance.used}일 사용</div></div>
              <div className="kpi"><div className="label">올해 사용률</div><div className="val tnum">{Math.round(detail.leaveBalance.used / detail.leaveBalance.total * 100)}<span className="unit">%</span></div></div>
              <div className="kpi"><div className="label">휴직 이력</div><div className="val tnum">0<span className="unit">건</span></div><div className="foot">전체 기간</div></div>
            </div>
            <div className="empty">
              <Icons.EmptyBox size={24} />
              <div className="em-title">최근 휴직 이력이 없습니다</div>
            </div>
          </div>
        </Card>
      )}

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
              {detail.evaluation.map((e, i) => (
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
                    <td className="small muted">매출 목표 초과 · 신규 클라이언트 3건 영입</td>
                  </tr>
                  <tr>
                    <td className="fw-6">2025 H1</td>
                    <td className="mono">3개</td>
                    <td className="right mono tnum"><span style={{ color: "var(--success)", fontWeight: 700 }}>108%</span></td>
                    <td className="small muted">팀 프로세스 개선 · 신규 입사자 멘토링 완료</td>
                  </tr>
                  <tr>
                    <td className="fw-6">2024 H2</td>
                    <td className="mono">4개</td>
                    <td className="right mono tnum">102%</td>
                    <td className="small muted">시스템 마이그레이션 주도</td>
                  </tr>
                  <tr>
                    <td className="fw-6">2024 H1</td>
                    <td className="mono">3개</td>
                    <td className="right mono tnum">106%</td>
                    <td className="small muted">신규 기능 출시 + 안정화</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">받은 칭찬</span><span className="sub">최근 6건</span></div>
            <div className="list">
              {[
                { from: "한지영", value: "리더십",  reason: "릴리즈 일정 지키며 품질 유지", date: "어제" },
                { from: "홍채원", value: "주도성",  reason: "긴급 장비 트러블 신속 해결", date: "1주 전" },
                { from: "이정환", value: "전문성",  reason: "월말 결산 빠른 마감", date: "2주 전" },
                { from: "박서연", value: "협업",    reason: "타팀 협의 잘 이끌어줌", date: "1개월 전" },
                { from: "한지영", value: "성과",    reason: "신규 클라이언트 성공적 영입", date: "2개월 전" },
                { from: "정유진", value: "친절함",  reason: "온보딩 도움이 됐어요", date: "3개월 전" },
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
            <div className="card-head"><span className="title">자격증 / 인증</span><span className="sub">5건</span></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>자격증</th><th>발급기관</th><th className="right">취득일</th><th className="right">상태</th></tr></thead>
                <tbody>
                  <tr><td className="fw-6">PMP</td><td className="small muted">PMI</td><td className="right mono">2023.06</td><td className="right"><span className="chip success">유효</span></td></tr>
                  <tr><td className="fw-6">정보처리기사</td><td className="small muted">한국산업인력공단</td><td className="right mono">2019.05</td><td className="right"><span className="chip success">유효</span></td></tr>
                  <tr><td className="fw-6">TOEIC 950</td><td className="small muted">ETS</td><td className="right mono">2022.11</td><td className="right"><span className="chip warning">갱신 임박</span></td></tr>
                  <tr><td className="fw-6">AWS Solutions Architect</td><td className="small muted">Amazon</td><td className="right mono">2024.03</td><td className="right"><span className="chip success">유효</span></td></tr>
                  <tr><td className="fw-6">Six Sigma Green Belt</td><td className="small muted">사내</td><td className="right mono">2024.09</td><td className="right"><span className="chip success">유효</span></td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="wd-section">
            <div className="card-head"><span className="title">교육 이수 이력</span><span className="sub">12개월</span></div>
            <div className="list">
              {[
                { course: "리더십 부트캠프 Lv.2", hours: 24, type: "내부", date: "2025.11", status: "수료" },
                { course: "데이터 분석 입문",      hours: 16, type: "외부", date: "2025.09", status: "수료" },
                { course: "직장 내 괴롭힘 예방 (법정)", hours: 1, type: "법정", date: "2025.06", status: "수료" },
                { course: "정보보안 기초 (법정)",    hours: 2, type: "법정", date: "2025.03", status: "수료" },
                { course: "Workday 사용자 교육",   hours: 4, type: "내부", date: "2025.02", status: "수료" },
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
                {["사내 봉사단", "독서 동아리 회장", "OKR 워킹그룹", "사내 발표 (2025 H1)", "신입 멘토"].map((a) => (
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

function AttendanceMiniCalendar() {
  const days = Array.from({ length: 30 }, (_, i) => {
    const r = (i * 31) % 100;
    let kind = "present";
    if (r < 5) kind = "absent";
    else if (r < 12) kind = "late";
    else if (r < 18) kind = "leave";
    return kind;
  });
  const colorOf = (k) => ({ present: "var(--success)", late: "var(--warning)", absent: "var(--danger)", leave: "var(--info)" })[k];
  const labelOf = (k) => ({ present: "정상", late: "지각", absent: "결근", leave: "휴가" })[k];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
        {days.map((k, i) => (
          <div key={i} title={`${i + 1}일: ${labelOf(k)}`} style={{ aspectRatio: "1", borderRadius: 6, background: colorOf(k), opacity: 0.78 }} />
        ))}
      </div>
      <div className="flex gap-4 small faint" style={{ marginTop: 16 }}>
        {[["present", "정상"], ["late", "지각"], ["absent", "결근"], ["leave", "휴가"]].map(([k, l]) => (
          <div key={k} className="flex center gap-2">
            <span className="dot" style={{ background: colorOf(k), opacity: 0.78 }} />
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { EmployeeDetailPage });
