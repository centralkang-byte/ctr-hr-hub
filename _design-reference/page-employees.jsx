/* global React, Icons, Avatar, Card, fmtKDate, tenureFromISO, HireWorkerWizard, EmployeeMiniCard, EmployeeInspector, BulkActionBar */
// CTR HR Hub — 직원 관리 (Workday "Find Workers" — 상단 드롭다운 필터 + 풀폭 테이블)

const { useState: useStateEM, useMemo: useMemoEM, useEffect: useEffectEM, useRef: useRefEM } = React;

// 필터 드롭다운 컴포넌트
function FilterDropdown({ label, values, selected, onToggle, counts }) {
  const [open, setOpen] = useStateEM(false);
  const ref = useRefEM(null);

  useEffectEM(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  const count = selected.size;
  const active = count > 0;
  return (
    <div className="wd-filter-dd" ref={ref}>
      <button
        className={`wd-filter-dd-btn ${active ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}>
        {label}
        {active && <span className="count">{count}</span>}
        <Icons.ChevD className="caret" />
      </button>
      {open && (
        <div className="wd-filter-dd-menu">
          {values.map((v) => (
            <label className="opt" key={v}>
              <input
                type="checkbox"
                checked={selected.has(v)}
                onChange={() => onToggle(v)}
              />
              <span className="lbl">{v}</span>
              <span className="n">{counts[v] || 0}</span>
            </label>
          ))}
          {active && (
            <div className="menu-foot">
              <button onClick={() => values.forEach((v) => selected.has(v) && onToggle(v))}>모두 해제</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmployeesPage({ data, openEmployee }) {
  const [q, setQ] = useStateEM("");
  const [dept, setDept] = useStateEM(new Set());
  const [emp, setEmp] = useStateEM(new Set());
  const [status, setStatus] = useStateEM(new Set());
  const [pageSize, setPageSize] = useStateEM(20);
  const [sortBy, setSortBy] = useStateEM("name");
  const [sortDir, setSortDir] = useStateEM("asc");
  const [hireOpen, setHireOpen] = useStateEM(false);
  const [selected, setSelected] = useStateEM(new Set());  // 선택된 사번 set
  const [inspectCode, setInspectCode] = useStateEM(null); // 인스펙터 표시 사번

  const counts = useMemoEM(() => {
    const dCounts = {}, eCounts = {}, sCounts = {};
    data.directory.forEach((e) => {
      dCounts[e.dept] = (dCounts[e.dept] || 0) + 1;
      eCounts[e.employment] = (eCounts[e.employment] || 0) + 1;
      sCounts[e.status] = (sCounts[e.status] || 0) + 1;
    });
    return { dept: dCounts, emp: eCounts, status: sCounts };
  }, [data.directory]);

  const filtered = useMemoEM(() => {
    let list = data.directory.filter((e) => {
      if (dept.size > 0 && !dept.has(e.dept)) return false;
      if (emp.size > 0 && !emp.has(e.employment)) return false;
      if (status.size > 0 && !status.has(e.status)) return false;
      if (q) {
        const ql = q.toLowerCase();
        return (
          e.name.toLowerCase().includes(ql) ||
          e.nameEn.toLowerCase().includes(ql) ||
          e.code.toLowerCase().includes(ql) ||
          e.dept.toLowerCase().includes(ql)
        );
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const av = a[sortBy] ?? "", bv = b[sortBy] ?? "";
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [data.directory, q, dept, emp, status, sortBy, sortDir]);

  const toggleSet = (setter, val) => {
    setter((s) => {
      const next = new Set(s);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const clearAll = () => { setDept(new Set()); setEmp(new Set()); setStatus(new Set()); setQ(""); };
  const totalActive = dept.size + emp.size + status.size;

  if (hireOpen) {
    return <HireWorkerWizard onCancel={() => setHireOpen(false)} onComplete={() => setHireOpen(false)} />;
  }

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>직원 관리</h1>
          <div className="greet-sub">전체 구성원 정보를 조회하고 관리해요 · 총 {data.directory.length}명</div>
        </div>
        <div className="right">
          <button className="btn"><Icons.Upload size={14} /> 일괄 발령</button>
          <button className="btn"><Icons.Download size={14} /> 엑셀</button>
          <button className="btn btn-primary" onClick={() => setHireOpen(true)}><Icons.Plus size={14} sw={2.2} /> 직원 등록</button>
        </div>
      </div>

      {/* 상단 필터 바 */}
      <div className="wd-filter-bar">
        <div className="search-wrap">
          <Icons.Search />
          <input
            className="input"
            placeholder="이름·사번·부서로 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <FilterDropdown
          label="부서"
          values={data.departments.filter((d) => d !== "전체 부서")}
          selected={dept}
          onToggle={(v) => toggleSet(setDept, v)}
          counts={counts.dept}
        />
        <FilterDropdown
          label="고용 형태"
          values={data.employmentTypes.filter((d) => d !== "전체 고용형태")}
          selected={emp}
          onToggle={(v) => toggleSet(setEmp, v)}
          counts={counts.emp}
        />
        <FilterDropdown
          label="재직 상태"
          values={data.statuses.filter((d) => d !== "전체 상태")}
          selected={status}
          onToggle={(v) => toggleSet(setStatus, v)}
          counts={counts.status}
        />

        {totalActive > 0 && (
          <button className="btn sm btn-ghost" onClick={clearAll} style={{ color: "var(--fg-muted)" }}>
            <Icons.Close size={11} sw={2} /> 모두 지우기
          </button>
        )}

        <div className="right">
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            <b style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{filtered.length}</b>
            <span style={{ color: "var(--fg-muted)" }}>명</span>
          </span>
          <select className="select" value={pageSize} onChange={(e) => setPageSize(+e.target.value)} style={{ padding: "7px 10px", fontSize: 12 }}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* 활성 필터 칩 */}
      {totalActive > 0 && (
        <div className="wd-active-filters" style={{ marginBottom: 12 }}>
          {[...dept].map((v) => (
            <span className="ch" key={`d-${v}`}>
              부서: {v}
              <button onClick={() => toggleSet(setDept, v)}><Icons.Close size={10} sw={2.2} /></button>
            </span>
          ))}
          {[...emp].map((v) => (
            <span className="ch" key={`e-${v}`}>
              고용: {v}
              <button onClick={() => toggleSet(setEmp, v)}><Icons.Close size={10} sw={2.2} /></button>
            </span>
          ))}
          {[...status].map((v) => (
            <span className="ch" key={`s-${v}`}>
              상태: {v}
              <button onClick={() => toggleSet(setStatus, v)}><Icons.Close size={10} sw={2.2} /></button>
            </span>
          ))}
        </div>
      )}

      {/* 풀폭 테이블 */}
      <Card style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="wd-emp-table tbl-as-cards">
            <thead>
              <tr>
                <th className="bulk-col">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.slice(0, pageSize).every((e) => selected.has(e.code))}
                    onChange={(ev) => {
                      const next = new Set(selected);
                      const visible = filtered.slice(0, pageSize);
                      if (ev.target.checked) visible.forEach((e) => next.add(e.code));
                      else visible.forEach((e) => next.delete(e.code));
                      setSelected(next);
                    }}
                  />
                </th>
                <th style={{ width: 80 }}>사번</th>
                <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>
                  이름 {sortBy === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => toggleSort("dept")} style={{ cursor: "pointer" }}>
                  부서 {sortBy === "dept" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th>직급</th>
                <th>직군</th>
                <th onClick={() => toggleSort("joinDate")} style={{ cursor: "pointer" }}>
                  입사일 {sortBy === "joinDate" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th>근속</th>
                <th>고용 형태</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, pageSize).map((e) => (
                <tr
                  key={e.code}
                  className={selected.has(e.code) ? "selected" : ""}
                  onClick={(ev) => {
                    // 체크박스 클릭은 행 아닌 체크박스 자체에서 처리
                    if (ev.target.tagName === "INPUT") return;
                    setInspectCode(e.code);
                  }}
                >
                  <td className="bulk-col" onClick={(ev) => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(e.code)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(e.code)) next.delete(e.code); else next.add(e.code);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="mono" data-label="사번" style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{e.code}</td>
                  <td data-label="이름" className="full">
                    <div className="person">
                      <Avatar name={e.name} hue={e.hue} />
                      <EmployeeMiniCard employee={e} onOpenDetail={openEmployee}>
                        <div>
                          <div className="nm">{e.name}</div>
                          <div className="en">{e.nameEn}</div>
                        </div>
                      </EmployeeMiniCard>
                    </div>
                  </td>
                  <td data-label="부서">{e.dept}</td>
                  <td data-label="직급">{e.rank}</td>
                  <td data-label="직군">{e.team}</td>
                  <td data-label="입사일" className="mono" style={{ fontSize: 12 }}>{fmtKDate(e.joinDate)}</td>
                  <td data-label="근속" style={{ color: "var(--fg-muted)", fontSize: 12 }}>{tenureFromISO(e.joinDate)}</td>
                  <td data-label="고용 형태">{e.employment}</td>
                  <td data-label="상태">
                    <EmployeeStatusChip status={e.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10}>
                  <div className="empty" style={{ padding: "var(--space-10)" }}>
                    <Icons.EmptyBox size={28} />
                    <div className="em-title">검색 결과가 없습니다</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 인스펙터 패널 */}
      <EmployeeInspector
        open={inspectCode !== null}
        employee={inspectCode ? data.directory.find((e) => e.code === inspectCode) : null}
        onClose={() => setInspectCode(null)}
        onOpenDetail={(code) => { setInspectCode(null); openEmployee(code); }}
      />

      {/* 벌크 액션 바 */}
      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          { label: "메시지 보내기", icon: Icons.Mail,     onClick: () => alert(`${selected.size}명에게 메시지 보냄`) },
          { label: "엑셀 내보내기",  icon: Icons.Download, onClick: () => alert(`${selected.size}명 엑셀 내보냄`) },
          { label: "일괄 발령",      icon: Icons.Upload,   onClick: () => alert(`${selected.size}명 일괄 발령`), primary: true },
        ]}
      />
    </div>
  );
}

Object.assign(window, { EmployeesPage });
