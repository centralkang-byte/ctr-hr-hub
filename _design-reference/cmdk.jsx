/* global React, Icons, Avatar, useEscClose */
// CTR HR Hub — ⌘K 글로벌 검색 (Workday/Linear style command palette)

const { useState: useStateCK, useEffect: useEffectCK, useMemo: useMemoCK, useRef: useRefCK } = React;

// 페이지 메타데이터 — id, label, breadcrumb, keywords, icon
const PAGES_INDEX = [
  // 홈
  { id: "dashboard",       label: "대시보드",       crumb: "홈",        icon: "Grid",     kw: "dashboard 홈 메인" },
  { id: "alerts",          label: "활동 피드",      crumb: "홈",        icon: "Bell",     kw: "알림 notifications" },
  { id: "my-tasks",        label: "나의 업무",      crumb: "my",        icon: "Inbox",    kw: "tasks 결재 할일 todo" },
  // my
  { id: "my-profile",      label: "내 프로필",      crumb: "my",        icon: "User",     kw: "profile self" },
  { id: "attendance-my",   label: "출퇴근",         crumb: "my",        icon: "Clock",    kw: "check-in checkout 근태" },
  { id: "leave-req",       label: "휴가 신청",      crumb: "my",        icon: "Calendar", kw: "leave 연차 vacation" },
  { id: "loa-req",         label: "휴직 신청",      crumb: "my",        icon: "Bed",      kw: "loa 휴직 sabbatical" },
  { id: "payslip-my",      label: "급여명세서",     crumb: "my",        icon: "Wallet",   kw: "payslip salary 급여" },
  { id: "benefits-my",     label: "나의 복리후생",  crumb: "my",        icon: "Gift",     kw: "benefits 복지" },
  { id: "goals-my",        label: "목표 / 평가",    crumb: "my",        icon: "Target",   kw: "goals mbo 목표 평가" },
  { id: "qrev-my",         label: "분기 리뷰",      crumb: "my",        icon: "Doc",      kw: "review checkin 분기" },
  { id: "skills-my",       label: "역량 자기평가",  crumb: "my",        icon: "Sparkle",  kw: "skills 역량 self-assess" },
  { id: "edu-my",          label: "내 교육",        crumb: "my",        icon: "Book",     kw: "education learning 교육" },
  { id: "kudos-my",        label: "칭찬/인정",      crumb: "my",        icon: "Heart",    kw: "kudos recognition 칭찬" },
  { id: "docs-my",         label: "문서/증명서",    crumb: "my",        icon: "Doc",      kw: "documents cert 증명서" },
  { id: "my-onboard",      label: "나의 온보딩",    crumb: "my",        icon: "Sparkle",  kw: "onboarding 온보딩" },
  // 팀
  { id: "team-hub",        label: "팀 현황",        crumb: "팀",        icon: "Users",    kw: "team hub manager" },
  { id: "team-attn",       label: "팀 근태/휴가",   crumb: "팀",        icon: "Clock",    kw: "team attendance 근태" },
  { id: "team-goals",      label: "팀 목표/성과",   crumb: "팀",        icon: "Target",   kw: "team goals" },
  { id: "team-1on1",       label: "1:1 미팅",       crumb: "팀",        icon: "Users",    kw: "1on1 미팅" },
  { id: "team-deleg",      label: "업무 위임",      crumb: "팀",        icon: "Shield",   kw: "delegation 위임" },
  // HR
  { id: "employees",       label: "직원 관리",      crumb: "직원",      icon: "Users",    kw: "find workers employees 직원" },
  { id: "org",             label: "조직 관리",      crumb: "조직",      icon: "Building", kw: "org chart 조직도" },
  { id: "attendance",      label: "근태 관리",      crumb: "근태",      icon: "Clock",    kw: "attendance 출퇴근 52h" },
  { id: "leave",           label: "휴가 관리",      crumb: "휴가",      icon: "Calendar", kw: "leave 연차" },
  { id: "onboarding",      label: "온보딩/오프보딩", crumb: "온보딩",   icon: "UserPlus", kw: "onboarding offboarding 입퇴사" },
  { id: "discipline",      label: "징계/포상",      crumb: "징계",      icon: "Shield",   kw: "discipline award 징계 포상" },
  // 채용
  { id: "jobs",            label: "채용 공고",      crumb: "채용",      icon: "Briefcase",kw: "jobs 공고 posting" },
  { id: "recruit-dash",    label: "채용 대시보드",  crumb: "채용",      icon: "Chart",    kw: "recruit dashboard pipeline" },
  { id: "kanban",          label: "칸반 보드",      crumb: "채용",      icon: "Grid",     kw: "kanban candidate" },
  { id: "talent-pool",     label: "인재 풀",        crumb: "채용",      icon: "Users",    kw: "talent pool 인재" },
  { id: "internal",        label: "사내 채용",      crumb: "채용",      icon: "ArrowR",   kw: "internal job 사내" },
  // 성과/보상
  { id: "perf-cycle",      label: "성과 관리",      crumb: "성과",      icon: "Trophy",   kw: "performance cycle 평가" },
  { id: "calibration",     label: "캘리브레이션",   crumb: "성과",      icon: "Grid",     kw: "calibration 9-box" },
  { id: "comp",            label: "보상 관리",      crumb: "보상",      icon: "Wallet",   kw: "compensation 연봉 인상" },
  { id: "offcycle",        label: "비정기 조정",    crumb: "보상",      icon: "Wallet",   kw: "off-cycle 비정기" },
  { id: "benefits",        label: "복리후생 관리",  crumb: "보상",      icon: "Gift",     kw: "benefits 복지" },
  // 급여
  { id: "payroll",         label: "급여 관리",      crumb: "급여",      icon: "Wallet",   kw: "payroll 급여" },
  { id: "manual-adj",      label: "수동 조정",      crumb: "급여",      icon: "Wallet",   kw: "manual adjust 가산 차감" },
  { id: "global-pay",      label: "글로벌 급여",    crumb: "급여",      icon: "Globe",    kw: "global payroll 다국가" },
  { id: "payroll-sim",     label: "급여 시뮬레이션",crumb: "급여",      icon: "Chart",    kw: "simulation 시뮬" },
  { id: "yearend",         label: "연말정산",       crumb: "급여",      icon: "Doc",      kw: "yearend tax 연말정산" },
  // 인사이트
  { id: "i-exec",          label: "Executive Summary", crumb: "인사이트", icon: "Chart", kw: "executive 인사이트 summary" },
  { id: "i-people",        label: "인력 분석",      crumb: "인사이트",  icon: "Users",    kw: "people analytics 인력" },
  { id: "i-pay",           label: "급여 분석",      crumb: "인사이트",  icon: "Wallet",   kw: "pay analytics" },
  { id: "i-perf",          label: "성과 분석",      crumb: "인사이트",  icon: "Trophy",   kw: "perf analytics" },
  { id: "i-attn",          label: "근태 분석",      crumb: "인사이트",  icon: "Clock",    kw: "attendance analytics" },
  { id: "i-churn",         label: "이직 예측",      crumb: "인사이트",  icon: "Alert",    kw: "churn 이직 예측" },
  { id: "i-health",        label: "팀 헬스",        crumb: "인사이트",  icon: "Heart",    kw: "team health" },
  { id: "i-ai",            label: "AI 리포트",      crumb: "인사이트",  icon: "Sparkle",  kw: "ai report" },
  // 설정
  { id: "settings",        label: "설정",           crumb: "설정",      icon: "Gear",     kw: "settings preferences" },
  { id: "compliance",      label: "컴플라이언스",   crumb: "설정",      icon: "Shield",   kw: "compliance gdpr pii 법규" },
];

// 빠른 액션
const ACTIONS_INDEX = [
  { id: "act-leave",  label: "휴가 신청",        sub: "오늘부터 휴가 신청서 작성",        icon: "Plus", kw: "휴가 신청 leave new", target: "leave-req" },
  { id: "act-hire",   label: "직원 등록",        sub: "새 구성원 신규 등록 위저드",        icon: "UserPlus", kw: "hire 직원 등록 신규", target: "employees" },
  { id: "act-job",    label: "새 공고 작성",     sub: "채용 공고 등록",                 icon: "Briefcase", kw: "job 공고 new", target: "jobs" },
  { id: "act-cert",   label: "증명서 신청",      sub: "재직·경력·소득 증명서",          icon: "Doc", kw: "cert 증명서 재직", target: "docs-my" },
  { id: "act-1on1",   label: "1:1 미팅 예약",    sub: "팀원과 1:1 일정 잡기",          icon: "Calendar", kw: "1on1 미팅 schedule", target: "team-1on1" },
  { id: "act-cycle",  label: "새 성과 사이클",   sub: "평가 사이클 위저드",              icon: "Trophy", kw: "performance cycle 새", target: "perf-cycle" },
  { id: "act-kudos",  label: "칭찬 보내기",      sub: "동료에게 가치 칭찬 전달",         icon: "Heart", kw: "kudos 칭찬 send", target: "kudos-my" },
];

// 간단 fuzzy 매칭 — 모든 키워드가 포함되는지
function matchScore(text, query) {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  // 정확히 시작
  if (t.startsWith(q)) return 100;
  // 부분 일치
  if (t.includes(q)) return 50;
  // 토큰 분리 후 모든 토큰 포함
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((tk) => t.includes(tk))) return 30;
  return 0;
}

function CommandPalette({ open, onClose, data, setPage, onOpenLeave }) {
  const [q, setQ] = useStateCK("");
  const [sel, setSel] = useStateCK(0);
  const inputRef = useRefCK(null);
  const listRef = useRefCK(null);

  useEscClose(open, onClose);

  // 열릴 때 초기화 + 포커스
  useEffectCK(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    }
  }, [open]);

  // 검색 결과 계산
  const results = useMemoCK(() => {
    const employees = (data.directory || []).map((e) => {
      const text = `${e.name} ${e.nameEn || ""} ${e.code} ${e.dept || ""} ${e.title || ""}`;
      const score = matchScore(text, q);
      return score > 0 ? { kind: "employee", item: e, score } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 6);

    const pages = PAGES_INDEX.map((p) => {
      const text = `${p.label} ${p.crumb} ${p.kw}`;
      const score = matchScore(text, q);
      return score > 0 ? { kind: "page", item: p, score } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 8);

    const actions = ACTIONS_INDEX.map((a) => {
      const text = `${a.label} ${a.sub} ${a.kw}`;
      const score = matchScore(text, q);
      return score > 0 ? { kind: "action", item: a, score } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 5);

    return { employees, pages, actions };
  }, [q, data]);

  // 평면 리스트로 합쳐서 키보드 네비
  const flat = useMemoCK(() => {
    const out = [];
    if (results.employees.length) {
      out.push({ section: "직원", items: results.employees });
    }
    if (results.pages.length) {
      out.push({ section: "페이지", items: results.pages });
    }
    if (results.actions.length) {
      out.push({ section: "액션", items: results.actions });
    }
    return out;
  }, [results]);

  const allItems = useMemoCK(() => flat.flatMap((s) => s.items), [flat]);

  // sel 범위 보정
  useEffectCK(() => {
    if (sel >= allItems.length) setSel(0);
  }, [allItems.length, sel]);

  // 활성 항목 스크롤
  useEffectCK(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]');
    if (el && el.scrollIntoView) {
      const rect = el.getBoundingClientRect();
      const parentRect = listRef.current.getBoundingClientRect();
      if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [sel, open]);

  const activate = (entry) => {
    if (!entry) return;
    if (entry.kind === "employee") {
      // 직원 클릭 — 직원 상세로 (전역 페이지에 상태 보내려면 별도 시스템 필요, 일단 직원 관리 페이지로)
      setPage("employees");
    } else if (entry.kind === "page") {
      setPage(entry.item.id);
    } else if (entry.kind === "action") {
      if (entry.item.id === "act-leave" && onOpenLeave) onOpenLeave();
      else setPage(entry.item.target);
    }
    onClose();
  };

  const onKeyDown = (e) => {
    if (allItems.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % allItems.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + allItems.length) % allItems.length); }
    else if (e.key === "Enter") { e.preventDefault(); activate(allItems[sel]); }
  };

  if (!open) return null;

  // 인덱스 매핑 — 절대 인덱스 계산
  let absIdx = 0;
  const isEmpty = allItems.length === 0;

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="cmdk-search">
          <Icons.Search size={16} sw={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="직원·페이지·액션 검색 ··· (↑↓ 이동, Enter 선택, Esc 닫기)"
          />
          <kbd className="cmdk-kbd">Esc</kbd>
        </div>

        <div className="cmdk-list" ref={listRef}>
          {!q && (
            <div className="cmdk-hint">
              <div className="cmdk-section-h">빠른 액션</div>
              {ACTIONS_INDEX.slice(0, 5).map((a, i) => {
                const Ic = Icons[a.icon] || Icons.Sparkle;
                const selected = i === sel;
                return (
                  <div
                    key={a.id}
                    className="cmdk-row"
                    data-selected={selected}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => activate({ kind: "action", item: a })}>
                    <div className="cmdk-row-ico"><Ic size={14} sw={1.8} /></div>
                    <div className="cmdk-row-main">
                      <div className="cmdk-row-title">{a.label}</div>
                      <div className="cmdk-row-sub">{a.sub}</div>
                    </div>
                    <span className="cmdk-row-tag">액션</span>
                  </div>
                );
              })}
              <div className="cmdk-tip">
                <span>💡</span>
                <div>이름·사번·페이지명·키워드 등을 입력해보세요.</div>
              </div>
            </div>
          )}

          {q && isEmpty && (
            <div className="cmdk-empty">
              <Icons.Search size={24} />
              <div className="em-title">검색 결과가 없어요</div>
              <div className="cmdk-empty-sub">다른 키워드로 시도해보세요</div>
            </div>
          )}

          {q && !isEmpty && flat.map((section) => (
            <div key={section.section}>
              <div className="cmdk-section-h">{section.section}</div>
              {section.items.map((entry) => {
                const myIdx = absIdx++;
                const selected = myIdx === sel;
                if (entry.kind === "employee") {
                  const e = entry.item;
                  return (
                    <div
                      key={`${entry.kind}-${e.code}`}
                      className="cmdk-row"
                      data-selected={selected}
                      onMouseEnter={() => setSel(myIdx)}
                      onClick={() => activate(entry)}>
                      <Avatar name={e.name} hue={e.hue} size="sm" />
                      <div className="cmdk-row-main">
                        <div className="cmdk-row-title">
                          {e.name} <span className="cmdk-row-en">{e.nameEn}</span>
                        </div>
                        <div className="cmdk-row-sub">
                          {e.title || e.rank} · {e.dept} · <span className="mono">{e.code}</span>
                        </div>
                      </div>
                      <span className="cmdk-row-tag">직원</span>
                    </div>
                  );
                }
                if (entry.kind === "page") {
                  const p = entry.item;
                  const Ic = Icons[p.icon] || Icons.Grid;
                  return (
                    <div
                      key={`${entry.kind}-${p.id}`}
                      className="cmdk-row"
                      data-selected={selected}
                      onMouseEnter={() => setSel(myIdx)}
                      onClick={() => activate(entry)}>
                      <div className="cmdk-row-ico"><Ic size={14} sw={1.8} /></div>
                      <div className="cmdk-row-main">
                        <div className="cmdk-row-title">{p.label}</div>
                        <div className="cmdk-row-sub">{p.crumb}</div>
                      </div>
                      <span className="cmdk-row-tag">페이지</span>
                    </div>
                  );
                }
                // action
                const a = entry.item;
                const AIc = Icons[a.icon] || Icons.Sparkle;
                return (
                  <div
                    key={`${entry.kind}-${a.id}`}
                    className="cmdk-row"
                    data-selected={selected}
                    onMouseEnter={() => setSel(myIdx)}
                    onClick={() => activate(entry)}>
                    <div className="cmdk-row-ico"><AIc size={14} sw={1.8} /></div>
                    <div className="cmdk-row-main">
                      <div className="cmdk-row-title">{a.label}</div>
                      <div className="cmdk-row-sub">{a.sub}</div>
                    </div>
                    <span className="cmdk-row-tag">액션</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="cmdk-foot">
          <div className="cmdk-foot-keys">
            <span><kbd>↑↓</kbd> 이동</span>
            <span><kbd>Enter</kbd> 선택</span>
            <span><kbd>Esc</kbd> 닫기</span>
          </div>
          <div className="cmdk-foot-brand">⌘K · CTR HR Hub</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette });
