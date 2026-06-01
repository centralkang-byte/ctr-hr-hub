/* global React, ReactDOM,
   Sidebar, Topbar, Dashboard, DashboardConsole, DashboardReports, DashboardWorkday,
   MyTasksPage, EmployeesPage, EmployeeDetailPage,
   AttendancePage, LeavePage, OnboardingPage, PlaceholderPage,
   PayrollMgmtPage, CompMgmtPage, RecruitDashPage, ComplianceMgmtPage,
   KanbanBoardPage, CalibrationPage, TalentPoolPage,
   YearEndPage, GlobalPayrollPage,
   InternalRecruitPage, BenefitsAdminPage, ManualAdjustPage,
   MyGoalsPage, QuarterlyReviewPage, MyOnboardingPage, DisciplinePage,
   LeaveAbsenceWrapper, PerfGrowthWrapper,
   AlertsPage, MyProfilePage, TeamHubPage, PerfCyclePage,
   InsightsPage, SettingsPage, PayrollSimPage, LeaveRequestModal,
   AttendanceMyPage, LeaveReqPage, LoaReqPage, PayslipMyPage, BenefitsMyPage,
   SkillsAssessPage, EduMyPage, KudosMyPage, DocsMyPage,
   TeamAttnPage, TeamGoalsPage, Team1on1Page, TeamDelegPage,
   OrgPage, JobsPage, OffCyclePage,
   ToastHost, ToastContext, useTweaks, TweaksPanel, TweakSection,
   TweakRadio */
// CTR HR Hub — 앱 루트

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "tone": "friendly",
  "style": "workday",
  "sidebarStyle": "modern",
  "density": "normal",
  "rowDensity": "normal",
  "sidebar": "expanded"
}/*EDITMODE-END*/;

function App() {
  const data = window.HR_DATA;
  const [page, setPageRaw] = useState("dashboard");
  const [employeeCode, setEmployeeCode] = useState(null);
  const [showLeave, setShowLeave] = useState(false);
  const [showCmdK, setShowCmdK] = useState(false);

  // ⌘K / Ctrl+K 글로벌 단축키
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setShowCmdK((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--density",
      tweaks.density === "compact" ? 0.86 :
      tweaks.density === "spacious" ? 1.14 : 1);
    r.style.setProperty("--row-pad",
      tweaks.rowDensity === "compact" ? 0.7 :
      tweaks.rowDensity === "spacious" ? 1.35 : 1);
    r.setAttribute("data-theme", tweaks.theme);
    r.setAttribute("data-tone", tweaks.tone || "pro");
    r.setAttribute("data-style", tweaks.style || "default");
    r.setAttribute("data-sidebar", tweaks.sidebarStyle || "classic");
  }, [tweaks]);

  const setPage = (p) => {
    setEmployeeCode(null);
    setPageRaw(p);
  };
  const openEmployee = (code) => {
    setEmployeeCode(code);
    setPageRaw("employee-detail");
  };

  const DashboardComponent =
    tweaks.style === "console" ? DashboardConsole :
    tweaks.style === "reports" ? DashboardReports :
    tweaks.style === "workday" ? DashboardWorkday :
    Dashboard;

  const pages = {
    dashboard:        <DashboardComponent data={data} setPage={setPage} openEmployee={openEmployee} tone={tweaks.tone}/>,
    alerts:           <AlertsPage        data={data}/>,
    "my-tasks":       <MyTasksPage       data={data}/>,
    "my-profile":     <MyProfilePage     data={data}/>,
    "team-hub":       <TeamHubPage       data={data}/>,
    "perf-cycle":     <PerfCyclePage     data={data}/>,
    "payroll-sim":    <PayrollSimPage    data={data}/>,
    "i-exec":         <InsightsPage      data={data} sub="exec"/>,
    "i-attn":         <InsightsPage      data={data} sub="attn"/>,
    "i-health":       <InsightsPage      data={data} sub="health"/>,
    "i-people":       <InsightsPage      data={data} sub="people"/>,
    "i-pay":          <InsightsPage      data={data} sub="pay"/>,
    "i-perf":         <InsightsPage      data={data} sub="perf"/>,
    "i-churn":        <InsightsPage      data={data} sub="churn"/>,
    "i-ai":           <InsightsPage      data={data} sub="ai"/>,
    settings:         <SettingsPage      data={data}/>,
    employees:        <EmployeesPage     data={data} openEmployee={openEmployee}/>,
    "employee-detail":<EmployeeDetailPage data={data} code={employeeCode} onBack={() => setPage("employees")}/>,
    attendance:       <AttendancePage    data={data}/>,
    leave:            <LeavePage         data={data}/>,
    onboarding:       <OnboardingPage    data={data}/>,
    // 나의 공간
    "attendance-my":  <AttendanceMyPage  data={data}/>,
    "leave-req":      <LeaveAbsenceWrapper data={data} onOpenModal={() => setShowLeave(true)}/>,
    "loa-req":        <LoaReqPage        data={data}/>,
    "payslip-my":     <PayslipMyPage     data={data}/>,
    "benefits-my":    <BenefitsMyPage    data={data}/>,
    "skills-my":      <SkillsAssessPage  data={data}/>,
    "edu-my":         <EduMyPage         data={data}/>,
    "kudos-my":       <KudosMyPage       data={data}/>,
    "docs-my":        <DocsMyPage        data={data}/>,
    // 팀 관리
    "team-attn":      <TeamAttnPage      data={data}/>,
    "team-goals":     <TeamGoalsPage     data={data}/>,
    "team-1on1":      <Team1on1Page      data={data}/>,
    "team-deleg":     <TeamDelegPage     data={data}/>,
    // 기타
    org:              <OrgPage           data={data}/>,
    jobs:             <JobsPage          data={data}/>,
    offcycle:         <OffCyclePage      data={data}/>,
    payroll:          <PayrollMgmtPage   data={data}/>,
    comp:             <CompMgmtPage      data={data}/>,
    "recruit-dash":   <RecruitDashPage   data={data}/>,
    compliance:       <ComplianceMgmtPage data={data}/>,
    // 남은 placeholders
    "goals-my":       <PerfGrowthWrapper   data={data}/>,
    "qrev-my":        <QuarterlyReviewPage data={data}/>,
    "my-onboard":     <MyOnboardingPage    data={data}/>,
    discipline:       <DisciplinePage      data={data}/>,
    kanban:           <KanbanBoardPage   data={data}/>,
    "talent-pool":    <TalentPoolPage    data={data}/>,
    internal:         <InternalRecruitPage data={data}/>,
    calibration:      <CalibrationPage   data={data}/>,
    benefits:         <BenefitsAdminPage data={data}/>,
    "manual-adj":     <ManualAdjustPage  data={data}/>,
    "global-pay":     <GlobalPayrollPage data={data}/>,
    transfers:        <PlaceholderPage   title="이체 관리"       sub="급여 이체 처리"               icon="Wallet"/>,
    yearend:          <YearEndPage       data={data}/>,
  };

  return (
    <ToastHost>
      <div className="app" data-sb={tweaks.sidebar === "collapsed" ? "collapsed" : "expanded"} data-screen-label={`CTR HR Hub · ${page}`}>
        <Sidebar
          page={page} setPage={setPage} me={data.me}
          collapsed={tweaks.sidebar === "collapsed"}
          onToggleCollapse={() => setTweak("sidebar", tweaks.sidebar === "collapsed" ? "expanded" : "collapsed")}
          style={tweaks.sidebarStyle}
        />
        <div className="main">
          <Topbar page={page} data={data} setPage={setPage} onSearch={() => setShowCmdK(true)} onOpenLeave={() => setShowLeave(true)}/>
          {pages[page] || pages.dashboard}
        </div>
      </div>

      {showLeave && <LeaveRequestModal onClose={() => setShowLeave(false)}/>}

      <CommandPalette
        open={showCmdK}
        onClose={() => setShowCmdK(false)}
        data={data}
        setPage={setPage}
        onOpenLeave={() => setShowLeave(true)}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="디자인 방향">
          <TweakRadio
            label="스타일"
            value={tweaks.style || "default"}
            options={[
              { value: "default", label: "기존" },
              { value: "console", label: "Console" },
              { value: "reports", label: "Reports" },
              { value: "workday", label: "Workday" },
            ]}
            onChange={(v) => setTweak("style", v)}
          />
          <TweakRadio
            label="사이드바"
            value={tweaks.sidebarStyle || "classic"}
            options={[
              { value: "classic", label: "Classic" },
              { value: "modern",  label: "Modern"  },
            ]}
            onChange={(v) => setTweak("sidebarStyle", v)}
          />
        </TweakSection>
        <TweakSection label="테마">
          <TweakRadio
            label="테마"
            value={tweaks.theme}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
            onChange={(v) => setTweak("theme", v)}
          />
          <TweakRadio
            label="톤"
            value={tweaks.tone || "pro"}
            options={[{ value: "pro", label: "표준" }, { value: "friendly", label: "친근" }]}
            onChange={(v) => setTweak("tone", v)}
          />
        </TweakSection>
        <TweakSection label="레이아웃">
          <TweakRadio
            label="전체 밀도"
            value={tweaks.density}
            options={[
              { value: "compact",  label: "Compact"  },
              { value: "normal",   label: "Normal"   },
              { value: "spacious", label: "Spacious" },
            ]}
            onChange={(v) => setTweak("density", v)}
          />
          <TweakRadio
            label="테이블 줄"
            value={tweaks.rowDensity}
            options={[
              { value: "compact",  label: "Compact"  },
              { value: "normal",   label: "Normal"   },
              { value: "spacious", label: "Spacious" },
            ]}
            onChange={(v) => setTweak("rowDensity", v)}
          />
          <TweakRadio
            label="사이드바"
            value={tweaks.sidebar}
            options={[
              { value: "expanded",  label: "펼침" },
              { value: "collapsed", label: "접힘" },
            ]}
            onChange={(v) => setTweak("sidebar", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </ToastHost>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
