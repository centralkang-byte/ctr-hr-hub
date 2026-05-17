/* global React, Icons, Card, ToastContext */
// CTR HR Hub — 설정 페이지 (Workday Settings Hub: 6 카테고리 × 49 탭)

const { useState: useStateST, useContext: useCtxST, useMemo: useMemoST } = React;

// ─── 카테고리 + 탭 구성 (실제 프로젝트 기반) ────────────────────
const SETTINGS_CATS = [
  {
    key: "organization", label: "조직/인사", labelEn: "Organization", icon: "Building", color: 230,
    tabs: [
      { slug: "company-info",  label: "법인 기본정보", desc: "법인명, 주소, 사업자번호, 대표자" },
      { slug: "departments",   label: "부서 구조",    desc: "부서 트리, 코드 체계" },
      { slug: "positions",     label: "직위 관리",    desc: "법인별 직위 및 보고 체계" },
      { slug: "grade-title-mappings", label: "직급-호칭 매핑", desc: "L/E/S 체계 매핑" },
      { slug: "job-families",  label: "직종/직무",    desc: "Job Family, Job Profile" },
      { slug: "assignment-rules", label: "발령 규칙", desc: "발령 유형, 승인 절차", global: true },
      { slug: "probation",     label: "수습 기간",    desc: "기간, 평가 기준, 자동 전환", global: true },
      { slug: "custom-fields", label: "커스텀 필드",   desc: "사용자 정의 필드 관리" },
      { slug: "code-management", label: "코드 관리",  desc: "시스템 코드/열거형" },
      { slug: "locations",     label: "근무지 관리",  desc: "공장/사무소 등 근무지 목록" },
    ],
  },
  {
    key: "attendance", label: "근태/휴가", labelEn: "Attendance & Leave", icon: "Clock", color: 145,
    tabs: [
      { slug: "work-schedules", label: "근무 스케줄",  desc: "기본 근무시간, 점심, 유연근무" },
      { slug: "weekly-hours",   label: "주간 한도",   desc: "52h/44h/48h/40h (법인별 필수)" },
      { slug: "shift-patterns", label: "교대근무",    desc: "교대 패턴, 수당 배율" },
      { slug: "leave-types",    label: "휴가 유형",   desc: "연차/병가/경조사 등" },
      { slug: "leave-accrual",  label: "휴가 부여",   desc: "입사일 vs 회계연도, 비례" },
      { slug: "leave-promotion", label: "연차 촉진",  desc: "알림 시점, 미사용 소멸" },
      { slug: "designated-leave", label: "지정 연차", desc: "법인별 지정 연차 사용일" },
      { slug: "holidays",       label: "법정 공휴일", desc: "나라별 공휴일 캘린더" },
      { slug: "overtime",       label: "초과근무",    desc: "사전승인 여부, 수당 배율", global: true },
      { slug: "loa-types",      label: "휴직 유형",   desc: "육아/질병/가족돌봄" },
    ],
  },
  {
    key: "payroll", label: "급여/보상", labelEn: "Payroll & Comp", icon: "Wallet", color: 290,
    tabs: [
      { slug: "earnings",      label: "급여 항목",   desc: "기본급, 식대, 교통비" },
      { slug: "deductions",    label: "공제 항목",   desc: "4대보험, 소득세, 주민세" },
      { slug: "tax-free",      label: "비과세 한도", desc: "식대 20만원, 교통비 등" },
      { slug: "salary-bands",  label: "연봉 밴드",   desc: "직급별 최소/중간/최대" },
      { slug: "merit-matrix",  label: "인상률 매트릭스", desc: "등급×밴드위치 매트릭스" },
      { slug: "bonus-rules",   label: "성과급 규칙",  desc: "등급별 배율" },
      { slug: "pay-schedule",  label: "급여일",      desc: "매월 N일 (법인별)" },
      { slug: "currency",      label: "통화/환율",   desc: "법인별 통화 + 환율" },
    ],
  },
  {
    key: "performance", label: "성과/평가", labelEn: "Performance", icon: "Target", color: 60,
    tabs: [
      { slug: "cycle",        label: "평가 주기",   desc: "반기/연간/분기" },
      { slug: "methodology",  label: "평가 방법론", desc: "MBO:BEI 비중", global: true },
      { slug: "grade-scale",  label: "등급 체계",   desc: "O/E/M/S" },
      { slug: "distribution", label: "배분 가이드", desc: "10/30/50/10 권장 비율", global: true },
      { slug: "calibration",  label: "캘리브레이션", desc: "필수 여부, 참여 범위", global: true },
      { slug: "cfr",          label: "CFR 설정",   desc: "1:1 빈도, 익명 피드백", global: true },
      { slug: "competency",   label: "역량 라이브러리", desc: "핵심가치 13개", globalOnly: true },
    ],
  },
  {
    key: "recruitment", label: "채용/온보딩", labelEn: "Recruitment", icon: "UserPlus", color: 35,
    tabs: [
      { slug: "pipeline",         label: "채용 파이프라인", desc: "단계 수, 단계명", global: true },
      { slug: "interview-form",   label: "면접 평가항목",  desc: "평가표 기본 항목", global: true },
      { slug: "ai-screening",     label: "AI 스크리닝",    desc: "사용 여부, 기준 점수", globalOnly: true },
      { slug: "onboarding-templates", label: "온보딩 템플릿", desc: "체크리스트 기본" },
      { slug: "offboarding-checklist", label: "오프보딩 체크리스트", desc: "장비 회수, IT 비활성화" },
      { slug: "probation-eval",   label: "수습 평가",      desc: "30/60/90일", global: true },
    ],
  },
  {
    key: "system", label: "시스템", labelEn: "System", icon: "Gear", color: 200,
    tabs: [
      { slug: "notification-channels", label: "알림 채널",   desc: "이메일/Teams/앱 푸시", global: true },
      { slug: "notification-rules",    label: "알림 규칙",   desc: "이벤트별 알림 대상" },
      { slug: "locale",                label: "언어/타임존", desc: "법인별 언어 + 타임존", global: true },
      { slug: "roles",                 label: "역할/권한",   desc: "RBAC 역할 정의", globalOnly: true },
      { slug: "approval-flows",        label: "결재 플로우", desc: "모듈별 전결 규정" },
      { slug: "audit",                 label: "감사 로그",   desc: "보존 기간, 조회 범위" },
      { slug: "data-retention",        label: "데이터 보존", desc: "GDPR 삭제, PII 마스킹", global: true },
      { slug: "integrations",          label: "연동",       desc: "Teams, SSO, ERP, API" },
    ],
  },
];

const COMPANIES = [
  { code: "global",  label: "🌐 글로벌 (기본값)" },
  { code: "ctr-kr",  label: "CTR (주) — 한국" },
  { code: "ctr-cn",  label: "CTR China — 중국" },
  { code: "ctr-vn",  label: "CTR Vietnam — 베트남" },
  { code: "ctr-es",  label: "CTR Spain — 스페인" },
  { code: "ctr-ru",  label: "CTR Russia — 러시아" },
  { code: "ctr-jp",  label: "CTR Japan — 일본" },
];

// ─── Hub (entrance) ────────────────────────────────────────
function SettingsHub({ onSelect }) {
  const [search, setSearch] = useStateST("");
  const results = useMemoST(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const r = [];
    SETTINGS_CATS.forEach((c) => {
      c.tabs.forEach((t) => {
        if (t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)) {
          r.push({ cat: c, tab: t });
        }
      });
    });
    return r;
  }, [search]);

  const totalItems = SETTINGS_CATS.reduce((s, c) => s + c.tabs.length, 0);

  const recentChanges = [
    { who: "한지영", what: "알림 채널 · 슬랙 채널 활성화", when: "3일 전", cat: "시스템", color: 200 },
    { who: "한지영", what: "휴가 정책 · 연차 이월 한도 5일 → 7일", when: "1주 전", cat: "근태/휴가", color: 145 },
    { who: "유서아", what: "결재 플로우 · 휴직 신청 결재선 변경", when: "2주 전", cat: "시스템", color: 200 },
  ];

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>설정</h1>
          <div className="greet-sub">6개 카테고리 · {totalItems}개 설정 항목 · 글로벌/법인별 오버라이드 지원</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Doc size={13} sw={2} /> 변경 이력</button>
          <button className="btn"><Icons.Download size={13} sw={2} /> 설정 백업</button>
        </div>
      </div>

      {/* 검색 */}
      <div className="search-wrap" style={{ maxWidth: 480, marginBottom: "var(--space-4)" }}>
        <Icons.Search />
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="설정 검색 (예: 휴가, 급여, 등급, 알림)"
          style={{ width: "100%", padding: "10px 14px 10px 36px" }}
        />
      </div>

      {/* 검색 결과 또는 카테고리 카드 */}
      {search.trim() ? (
        results.length > 0 ? (
          <Card>
            <div className="list">
              {results.map((r) => {
                const Icon = Icons[r.cat.icon];
                return (
                  <div key={`${r.cat.key}-${r.tab.slug}`} className="item" style={{ cursor: "pointer" }}
                    onClick={() => onSelect(r.cat.key, r.tab.slug)}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `oklch(95% 0.04 ${r.cat.color})`, color: `oklch(45% 0.14 ${r.cat.color})`, display: "grid", placeItems: "center" }}>
                      <Icon size={14} sw={1.8} />
                    </div>
                    <div className="grow">
                      <div className="title">{r.tab.label}</div>
                      <div className="meta">{r.tab.desc}</div>
                    </div>
                    <span className="chip" style={{ background: `oklch(95% 0.04 ${r.cat.color})`, color: `oklch(45% 0.14 ${r.cat.color})` }}>{r.cat.label}</span>
                    <Icons.ChevR size={12} sw={2} style={{ color: "var(--fg-faint)" }} />
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card><div className="empty" style={{ padding: "var(--space-10)" }}><Icons.EmptyBox size={28} /><div className="em-title">검색 결과가 없습니다</div></div></Card>
        )
      ) : (
        <>
          <div className="grid-3" style={{ gap: 14, marginBottom: "var(--space-5)" }}>
            {SETTINGS_CATS.map((c) => {
              const Icon = Icons[c.icon];
              return (
                <button key={c.key} onClick={() => onSelect(c.key)} className="wd-setting-card">
                  <div className="sc-h">
                    <div className="sc-ico" style={{ background: `oklch(95% 0.04 ${c.color})`, color: `oklch(45% 0.14 ${c.color})` }}>
                      <Icon size={18} sw={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sc-title">{c.label}</div>
                      <div className="sc-en">{c.labelEn}</div>
                    </div>
                    <span className="sc-count">{c.tabs.length}</span>
                  </div>
                  <div className="sc-items">
                    {c.tabs.map((t) => (
                      <span key={t.slug} className="item" title={t.desc}>{t.label}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 최근 변경 */}
          <div className="wd-section-h"><h3>최근 변경</h3><span className="sub">감사 로그 미리보기</span></div>
          <Card>
            <div className="list">
              {recentChanges.map((c, i) => (
                <div key={i} className="item">
                  <span className="chip" style={{ background: `oklch(96% 0.04 ${c.color})`, color: `oklch(45% 0.14 ${c.color})`, fontWeight: 600 }}>{c.cat}</span>
                  <div className="grow">
                    <div className="title">{c.what}</div>
                    <div className="meta"><b>{c.who}</b> · {c.when}</div>
                  </div>
                  <button className="btn sm btn-ghost"><Icons.Eye size={11} /></button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Category Page (탭 좌측 네비 + 우측 컨텐츠) ──────────────────────
function SettingsCategory({ category, initialTab, onBack }) {
  const cat = SETTINGS_CATS.find((c) => c.key === category);
  const [tab, setTab] = useStateST(initialTab || cat.tabs[0].slug);
  const [scope, setScope] = useStateST("global");
  const tabDef = cat.tabs.find((t) => t.slug === tab);
  const Icon = Icons[cat.icon];

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <div style={{ fontSize: 12, color: "var(--fg-faint)", marginBottom: 6 }}>
            <button onClick={onBack} style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
              <Icons.ChevL size={11} sw={2} /> 설정
            </button>
            <span style={{ margin: "0 6px", opacity: 0.5 }}>/</span>
            <span>{cat.label}</span>
          </div>
          <h1>{cat.label}</h1>
          <div className="greet-sub">{cat.labelEn} · {cat.tabs.length}개 설정 항목</div>
        </div>
        <div className="right">
          {!tabDef?.globalOnly && (
            <select className="select" value={scope} onChange={(e) => setScope(e.target.value)} style={{ minWidth: 240 }}>
              {COMPANIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          )}
          {tabDef?.globalOnly && (
            <span className="chip" style={{ background: "var(--bg-sunk)" }}>🔒 글로벌 전용 (오버라이드 불가)</span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "var(--space-4)" }}>
        {/* 좌측 탭 네비 */}
        <div className="wd-filter-panel">
          <div className="fp-h">
            <Icon size={13} sw={2} /> <span>{cat.label}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {cat.tabs.map((t) => (
              <button key={t.slug} onClick={() => setTab(t.slug)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 6,
                background: tab === t.slug ? "var(--accent-soft)" : "transparent",
                color: tab === t.slug ? "var(--accent-ink)" : "var(--fg-muted)",
                fontWeight: tab === t.slug ? 600 : 500,
                fontSize: 12.5, width: "100%", textAlign: "left", cursor: "pointer",
              }}>
                <span style={{ flex: 1 }}>{t.label}</span>
                {t.globalOnly && <Icons.Shield size={10} sw={2} style={{ opacity: 0.7 }} />}
                {t.global && !t.globalOnly && <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>GLOBAL</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 우측 컨텐츠 */}
        <div style={{ minWidth: 0 }}>
          {scope === "global" && !tabDef?.globalOnly && (
            <div style={{
              padding: "12px 16px", background: "var(--accent-soft)",
              borderLeft: "3px solid var(--accent)", borderRadius: 6,
              marginBottom: 14,
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 12.5, color: "var(--accent-ink)",
            }}>
              <Icons.Globe size={14} />
              <span><b>글로벌 (기본) 설정 보기 중</b> · 법인별 오버라이드를 보려면 우측 상단에서 법인을 선택하세요.</span>
            </div>
          )}

          {category === "system" && tab === "notification-channels" && <NotificationChannels />}
          {category === "system" && tab === "roles" && <RolesPermissions />}
          {category === "system" && tab === "approval-flows" && <ApprovalFlows />}
          {category === "system" && tab === "integrations" && <Integrations />}
          {category === "system" && tab === "audit" && <AuditLog />}
          {(category !== "system" || !["notification-channels", "roles", "approval-flows", "integrations", "audit"].includes(tab)) && (
            <SettingPlaceholder tabDef={tabDef} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder for tabs not fully implemented ──────────
function SettingPlaceholder({ tabDef }) {
  return (
    <Card>
      <div className="card-head">
        <span className="title">{tabDef.label}</span>
        <span className="sub">{tabDef.desc}</span>
      </div>
      <div className="empty" style={{ padding: "var(--space-10)" }}>
        <Icons.Gear size={28} />
        <div className="em-title">{tabDef.label} 설정 페이지</div>
        <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 6, maxWidth: 360, textAlign: "center" }}>
          {tabDef.desc} — 시스템 카테고리의 알림 채널 / 역할 권한 / 결재 플로우 / 연동 / 감사 로그가 풀 구현됐어요. 나머지 탭은 동일한 패턴으로 구현 예정이에요.
        </div>
      </div>
    </Card>
  );
}

// ─── 시스템 → 알림 채널 ────────────────────────────────────────
function NotificationChannels() {
  const toast = useCtxST(ToastContext);
  const [channels, setChannels] = useStateST([
    { id: "email", label: "이메일",         icon: "Mail",  on: true,  desc: "company-wide email broadcast" },
    { id: "push",  label: "앱 푸시",        icon: "Bell",  on: true,  desc: "iOS/Android native push" },
    { id: "teams", label: "Microsoft Teams", icon: "Inbox", on: false, desc: "Teams bot integration" },
    { id: "slack", label: "Slack",          icon: "Inbox", on: false, desc: "Slack workspace webhook" },
  ]);
  const toggle = (id) => setChannels((arr) => arr.map((c) => c.id === id ? { ...c, on: !c.on } : c));

  return (
    <Card>
      <div className="card-head">
        <span className="title">알림 채널</span>
        <span className="sub">활성화된 채널로만 알림이 발송돼요</span>
      </div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {channels.map((ch) => {
          const Ic = Icons[ch.icon];
          return (
            <div key={ch.id} style={{
              padding: "14px 18px", border: "1px solid var(--border)", borderRadius: 10,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: ch.on ? "var(--accent-soft)" : "var(--bg-sunk)", color: ch.on ? "var(--accent-ink)" : "var(--fg-muted)", display: "grid", placeItems: "center" }}>
                <Ic size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ch.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>{ch.desc}</div>
              </div>
              <button onClick={() => { toggle(ch.id); toast(`${ch.label} ${ch.on ? "비활성화" : "활성화"}`); }} style={{
                position: "relative", width: 40, height: 22, borderRadius: 12,
                background: ch.on ? "var(--accent)" : "var(--bg-sunk)",
                border: "1px solid var(--border)",
              }}>
                <span style={{
                  position: "absolute", top: 2, left: ch.on ? 19 : 2,
                  width: 16, height: 16, borderRadius: "50%", background: "white",
                  transition: "left 120ms",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                }} />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", background: "var(--bg-sunk)" }}>
        <button className="btn">되돌리기</button>
        <button className="btn btn-primary"><Icons.Check size={13} sw={2.2} /> 저장</button>
      </div>
    </Card>
  );
}

// ─── 시스템 → 역할/권한 ────────────────────────────────────────
function RolesPermissions() {
  const roles = [
    { name: "HR Admin",     code: "HR_ADMIN",     people: 4, scope: "전체",     desc: "전사 HR 운영 권한" },
    { name: "HR Business Partner", code: "HRBP", people: 8, scope: "법인",     desc: "법인 단위 HR 운영" },
    { name: "Manager",      code: "MANAGER",      people: 24, scope: "팀",      desc: "팀 결재·1:1·평가" },
    { name: "Employee",     code: "EMPLOYEE",     people: 1180, scope: "본인",  desc: "자가 서비스" },
    { name: "Payroll Admin", code: "PAYROLL_ADMIN", people: 3, scope: "전체",   desc: "급여 산정·승인" },
    { name: "Recruiter",    code: "RECRUITER",    people: 5, scope: "채용",     desc: "채용 공고·후보자 관리" },
  ];
  return (
    <Card>
      <div className="card-head">
        <span className="title">역할/권한 (RBAC)</span>
        <span className="sub">6개 역할 정의</span>
        <div className="right"><button className="btn sm"><Icons.Plus size={11} sw={2.2} /> 새 역할</button></div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>역할</th><th>코드</th><th>범위</th><th>설명</th><th className="right">인원</th><th></th></tr></thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.code}>
                <td className="fw-7">{r.name}</td>
                <td className="mono small">{r.code}</td>
                <td><span className="chip">{r.scope}</span></td>
                <td className="small muted">{r.desc}</td>
                <td className="right mono tnum">{r.people}</td>
                <td><button className="btn sm btn-ghost"><Icons.Eye size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", background: "var(--bg-sunk)", fontSize: 11.5, color: "var(--fg-muted)" }}>
        🔒 RBAC 역할은 글로벌 전용이에요. 법인별 오버라이드가 불가해요.
      </div>
    </Card>
  );
}

// ─── 시스템 → 결재 플로우 ────────────────────────────────────
function ApprovalFlows() {
  const flows = [
    { module: "휴가 신청",   line: ["직속 상사", "팀장"],     amount: "—" },
    { module: "휴직 신청",   line: ["직속 상사", "팀장", "인사팀"], amount: "—" },
    { module: "복리후생 신청", line: ["인사팀"],                amount: "100만원 미만" },
    { module: "복리후생 신청", line: ["인사팀", "본부장"],       amount: "100만원 이상" },
    { module: "출장 신청",   line: ["직속 상사", "팀장"],     amount: "—" },
    { module: "보상 조정",   line: ["인사팀", "본부장", "대표이사"], amount: "—" },
    { module: "신규 채용",   line: ["팀장", "본부장", "인사팀"], amount: "—" },
  ];
  return (
    <Card>
      <div className="card-head"><span className="title">결재 플로우</span><span className="sub">{flows.length}개 규칙</span><div className="right"><button className="btn sm"><Icons.Plus size={11} sw={2.2} /> 규칙 추가</button></div></div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>모듈</th><th>금액 조건</th><th>결재선</th><th></th></tr></thead>
          <tbody>
            {flows.map((f, i) => (
              <tr key={i}>
                <td className="fw-6">{f.module}</td>
                <td className="small muted">{f.amount}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {f.line.map((step, j) => (
                      <React.Fragment key={j}>
                        <span className="chip accent">{step}</span>
                        {j < f.line.length - 1 && <Icons.ArrowR size={11} sw={2} style={{ color: "var(--fg-faint)" }} />}
                      </React.Fragment>
                    ))}
                  </div>
                </td>
                <td><button className="btn sm btn-ghost"><Icons.Sparkle size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── 시스템 → 연동 ────────────────────────────────────────
function Integrations() {
  const integrations = [
    { name: "Microsoft Teams",   logo: "💼", status: "활성",  type: "알림·봇", desc: "Teams 채널 알림 + 결재 봇" },
    { name: "Azure AD (Entra ID)", logo: "🔐", status: "활성", type: "SSO/SAML", desc: "Microsoft 계정 SSO" },
    { name: "Slack",              logo: "💬", status: "비활성", type: "알림",    desc: "Slack 워크스페이스 웹훅" },
    { name: "Anthropic Claude",   logo: "🤖", status: "활성",  type: "AI",      desc: "AI 평가 초안·번아웃 감지" },
    { name: "AWS SES",            logo: "📧", status: "활성",  type: "이메일",   desc: "이메일 발송" },
    { name: "AWS S3",             logo: "💾", status: "활성",  type: "스토리지", desc: "급여명세서·증명서 보관" },
    { name: "Sentry",             logo: "🐞", status: "활성",  type: "모니터링", desc: "에러 추적" },
  ];
  return (
    <Card>
      <div className="card-head"><span className="title">외부 연동</span><span className="sub">{integrations.length}개 서비스</span></div>
      <div className="card-pad">
        <div className="grid-2" style={{ gap: 10 }}>
          {integrations.map((it, i) => (
            <div key={i} style={{
              background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 10,
              padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ fontSize: 24 }}>{it.logo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>{it.type} · {it.desc}</div>
              </div>
              {it.status === "활성" ? <span className="chip success">활성</span> : <span className="chip">비활성</span>}
              <button className="btn sm btn-ghost"><Icons.Gear size={11} /></button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── 시스템 → 감사 로그 ────────────────────────────────────
function AuditLog() {
  const logs = [
    { time: "오늘 14:32", who: "한지영", action: "알림 채널 변경",       target: "Slack 활성화",        ip: "192.168.0.15" },
    { time: "오늘 09:15", who: "이정환", action: "결재 플로우 수정",     target: "휴직 신청 결재선",      ip: "192.168.0.21" },
    { time: "어제 18:04", who: "강하준", action: "역할 부여",           target: "박서연 → HRBP",       ip: "192.168.0.32" },
    { time: "2일 전",    who: "system", action: "PII 자동 삭제",       target: "퇴직자 9명",         ip: "system" },
    { time: "3일 전",    who: "한지영", action: "데이터 보존 정책 변경", target: "지원자 6개월 → 12개월",  ip: "192.168.0.15" },
  ];
  return (
    <Card>
      <div className="card-head">
        <span className="title">감사 로그</span>
        <span className="sub">최근 5건 · 90일 보관</span>
        <div className="right"><button className="btn sm"><Icons.Download size={11} sw={2} /> CSV</button></div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>시각</th><th>사용자</th><th>액션</th><th>대상</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td className="mono small">{l.time}</td>
                <td className="fw-6">{l.who}</td>
                <td>{l.action}</td>
                <td className="small muted">{l.target}</td>
                <td className="mono small">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── 메인 진입점 ────────────────────────────────────────
function SettingsPage({ data }) {
  const [active, setActive] = useStateST(null);
  const [initialTab, setInitialTab] = useStateST(null);

  const handleSelect = (categoryKey, tabSlug) => {
    setActive(categoryKey);
    setInitialTab(tabSlug || null);
  };

  if (active === null) return <SettingsHub onSelect={handleSelect} />;
  return <SettingsCategory category={active} initialTab={initialTab} onBack={() => { setActive(null); setInitialTab(null); }} />;
}

Object.assign(window, { SettingsPage });
