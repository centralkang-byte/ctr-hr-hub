/* global React, Icons, Avatar, fmtKDate, tenureFromISO, fmtWonShort, useEscClose */
// CTR HR Hub — Inspector + Mini Card (P3 #12, #14)

const { useState: useStateIN, useRef: useRefIN, useEffect: useEffectIN } = React;

// ─────────────────────────────────────────────────────────
// EmployeeMiniCard — 이름·아바타 hover 시 작은 프로필 카드
// 사용: <EmployeeMiniCard employee={e}><span>{e.name}</span></EmployeeMiniCard>
// ─────────────────────────────────────────────────────────
function EmployeeMiniCard({ employee, children, onOpenDetail }) {
  const [open, setOpen] = useStateIN(false);
  const [pos, setPos] = useStateIN({ top: 0, left: 0 });
  const triggerRef = useRefIN(null);
  const timerRef = useRefIN(null);

  const show = () => {
    clearTimeout(timerRef.current);
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    // 위로 띄움 (트리거 위쪽 공간 확보)
    const top = r.top - 8;
    const left = r.left;
    setPos({ top, left });
    setOpen(true);
  };
  const hide = () => {
    timerRef.current = setTimeout(() => setOpen(false), 160);
  };
  const keep = () => clearTimeout(timerRef.current);

  if (!employee) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ display: "inline-flex", cursor: "default" }}
      >
        {children}
      </span>
      {open && (
        <div
          className="emp-mini-card"
          onMouseEnter={keep}
          onMouseLeave={hide}
          style={{ top: pos.top, left: pos.left, transform: "translateY(-100%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="emc-h">
            <Avatar name={employee.name} hue={employee.hue} size="md" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="emc-name">{employee.name}</div>
              <div className="emc-en">{employee.nameEn} · <span className="mono">{employee.code}</span></div>
            </div>
            <EmployeeStatusChip status={employee.status} size="sm" />
          </div>
          <div className="emc-meta">
            <div><span className="k">부서</span><span className="v">{employee.dept}</span></div>
            <div><span className="k">직위</span><span className="v">{employee.title || employee.rank}</span></div>
            <div><span className="k">팀/직군</span><span className="v">{employee.team}</span></div>
            <div><span className="k">근속</span><span className="v">{tenureFromISO(employee.joinDate)}</span></div>
            {employee.email && (
              <div style={{ gridColumn: "1/-1" }}><span className="k">이메일</span><span className="v mono" style={{ fontSize: 11 }}>{employee.email}</span></div>
            )}
          </div>
          <div className="emc-actions">
            <button className="btn sm" onClick={() => { setOpen(false); onOpenDetail && onOpenDetail(employee.code); }}>
              <Icons.Eye size={11} /> 상세
            </button>
            <button className="btn sm"><Icons.Mail size={11} /> 메시지</button>
            <button className="btn sm"><Icons.Calendar size={11} /> 1:1</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// EmployeeInspector — 우측 슬라이드 패널 (테이블 행 클릭 → 빠른 미리보기)
// ─────────────────────────────────────────────────────────
function EmployeeInspector({ open, employee, onClose, onOpenDetail }) {
  useEscClose(open, onClose);

  if (!open || !employee) return null;

  // N+19: 직원별 SSOT lookup (EM-007 quickStats + EM-008 recentActivity 해소)
  const stats = (data.directoryStats && data.directoryStats[employee.code]) || {};
  const qs = stats.quickStats || { leaveRemaining: "—", avgOt: "—", recentGrade: "—" };
  const recentActivity = stats.recentActivity || [];

  const sections = [
    { k: "사번",       v: <span className="mono">{employee.code}</span> },
    { k: "한국어 이름", v: employee.name },
    { k: "영문 이름",  v: <span className="mono">{employee.nameEn}</span> },
    { k: "부서",       v: employee.dept },
    { k: "직위",       v: employee.title || employee.rank },
    { k: "직급",       v: employee.rank },
    { k: "직군",       v: employee.team },
    { k: "고용 형태",  v: employee.employment },
    { k: "입사일",     v: <span className="mono">{fmtKDate(employee.joinDate)}</span> },
    { k: "근속",       v: tenureFromISO(employee.joinDate) },
    { k: "이메일",     v: <span className="mono" style={{ fontSize: 11.5 }}>{employee.email || `kr${employee.code.slice(-4)}@ctr.co.kr`}</span> },
    { k: "상태",       v: <EmployeeStatusChip status={employee.status} /> },
  ];

  return (
    <div className="emp-inspector-backdrop" onClick={onClose}>
      <div className="emp-inspector" onClick={(e) => e.stopPropagation()}>
        <div className="ei-h">
          <button className="ei-close" onClick={onClose}><Icons.Close size={14} sw={2} /></button>
          <div className="ei-h-meta">인스펙터 · 빠른 미리보기</div>
          <button className="btn sm" onClick={() => onOpenDetail(employee.code)}>
            전체 보기 <Icons.ArrowR size={11} sw={2} />
          </button>
        </div>

        <div className="ei-banner">
          <Avatar name={employee.name} hue={employee.hue} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ei-name">{employee.name}</div>
            <div className="ei-en">{employee.nameEn} · <span className="mono">{employee.code}</span></div>
            <div className="ei-tags">
              <span className="chip accent" style={{ fontSize: 10.5 }}>{employee.title || employee.rank}</span>
              <span className="chip" style={{ fontSize: 10.5 }}>{employee.dept}</span>
            </div>
          </div>
        </div>

        <div className="ei-quick">
          <button className="btn sm"><Icons.Mail size={11} /> 메시지</button>
          <button className="btn sm"><Icons.Doc size={11} /> 발령서</button>
          <button className="btn sm"><Icons.Calendar size={11} /> 1:1 예약</button>
        </div>

        <div className="ei-body">
          <div className="ei-section-h">기본 정보</div>
          <div className="ei-kv">
            {sections.map((s, i) => (
              <div key={i} className="row">
                <span className="k">{s.k}</span>
                <span className="v">{s.v}</span>
              </div>
            ))}
          </div>

          <div className="ei-section-h">빠른 통계</div>
          <div className="ei-quick-stats">
            <div className="card">
              <div className="lbl">잔여 연차</div>
              <div className="val">{qs.leaveRemaining}<span className="u">일</span></div>
            </div>
            <div className="card">
              <div className="lbl">평균 OT</div>
              <div className="val">{qs.avgOt}<span className="u">h</span></div>
            </div>
            <div className="card">
              <div className="lbl">최근 등급</div>
              <div className="val" style={{ color: "oklch(45% 0.16 290)" }}>{qs.recentGrade}</div>
            </div>
          </div>

          <div className="ei-section-h">최근 활동</div>
          <div className="ei-activity">
            {recentActivity.map((a, i) => {
              const Ic = Icons[a.icon];
              return (
                <div key={i} className="act">
                  <div className="ico" style={{ color: a.color }}><Ic size={12} sw={1.8} /></div>
                  <div className="grow">
                    <div className="title">{a.action}</div>
                    <div className="meta">{a.date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BulkActionBar — sticky 하단 다중 선택 액션 바
// ─────────────────────────────────────────────────────────
function BulkActionBar({ count, onClear, actions = [] }) {
  if (count === 0) return null;
  return (
    <div className="wd-bulk-bar">
      <div className="wd-bulk-count">
        <span className="dot" />
        <b>{count}</b>명 선택됨
      </div>
      <div className="wd-bulk-actions">
        {actions.map((a, i) => (
          <button key={i} className={`btn sm ${a.primary ? "btn-primary" : ""}`} onClick={a.onClick}>
            {a.icon && <a.icon size={11} sw={2} />} {a.label}
          </button>
        ))}
      </div>
      <button className="wd-bulk-close" onClick={onClear} title="선택 해제">
        <Icons.Close size={13} sw={2} />
      </button>
    </div>
  );
}

Object.assign(window, { EmployeeMiniCard, EmployeeInspector, BulkActionBar });
