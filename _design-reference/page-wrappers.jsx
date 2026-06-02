/* global React, Icons, LeaveReqPage, LoaReqPage, MyGoalsPage, QuarterlyReviewPage, SkillsAssessPage, LoaRequestDrawer, ToastContext */
// CTR HR Hub — 통합 페이지 래퍼 (사이드바 통합에 맞춰 콘텐츠도 탭으로 통합)

const { useState: useStateMW, useContext: useCtxMW } = React;

// 휴가/휴직 통합 (휴가 신청 + 휴직 신청)
function LeaveAbsenceWrapper({ data, onOpenModal }) {
  const [tab, setTab] = useStateMW("leave");
  const [loaOpen, setLoaOpen] = useStateMW(false);
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>휴가/휴직</h1>
          <div className="greet-sub">연차·반차 신청과 출산·육아·병가 휴직을 통합 관리해요.</div>
          <div className="wd-status-chips" style={{ marginTop: 10 }}>
            <span className="sc success"><b>12.5</b>일 잔여 연차</span>
            <span className="sc"><b>2</b>건 진행 중 신청</span>
            <span className="sc zero"><b>0</b>건 휴직 이력</span>
          </div>
        </div>
        <div className="right">
          {tab === "leave" && (
            <>
              <button className="btn"><Icons.Download size={13} sw={2} /> 이력 다운로드</button>
              <button className="btn btn-primary" onClick={onOpenModal}>
                <Icons.Plus size={13} sw={2.2} /> 휴가 신청
              </button>
            </>
          )}
          {tab === "loa" && (
            <button className="btn btn-primary" onClick={() => setLoaOpen(true)}>
              <Icons.Plus size={13} sw={2.2} /> 휴직 신청
            </button>
          )}
        </div>
      </div>
      <div className="wd-tab-bar">
        <button aria-selected={tab === "leave"} onClick={() => setTab("leave")}>
          <Icons.Calendar size={13} sw={1.8} /> 휴가 신청
        </button>
        <button aria-selected={tab === "loa"} onClick={() => setTab("loa")}>
          <Icons.Bed size={13} sw={1.8} /> 휴직 신청
        </button>
      </div>
      {tab === "leave" && <InlineNoPageH><LeaveReqPage data={data} onOpenModal={onOpenModal} /></InlineNoPageH>}
      {tab === "loa" && <InlineNoPageH><LoaReqPage data={data} /></InlineNoPageH>}
      <LoaRequestDrawer open={loaOpen} onClose={() => setLoaOpen(false)} defaultType="" />
    </div>
  );
}

// 평가/성장 통합 (목표 + 분기 리뷰 + 역량 자기평가)
function PerfGrowthWrapper({ data }) {
  const toast = useCtxMW(ToastContext);
  const [tab, setTab] = useStateMW("goals");
  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>평가 / 성장</h1>
          <div className="greet-sub">목표 관리·분기 리뷰·역량 자기평가를 한 곳에서 진행해요.</div>
          <div className="wd-status-chips" style={{ marginTop: 10 }}>
            <span className="sc accent"><b>2026 Q2</b> 분기 리뷰</span>
            <span className="sc"><b>4</b>개 목표 진행 중</span>
            <span className="sc warn">자기평가 <b>D-7</b></span>
          </div>
        </div>
        <div className="right">
          {tab === "goals" && (
            <>
              <button className="btn"><Icons.Doc size={13} sw={2} /> 평가 가이드</button>
              <button className="btn btn-primary" onClick={() => toast("새 목표 추가")}>
                <Icons.Plus size={13} sw={2.2} /> 새 목표
              </button>
            </>
          )}
          {tab === "review" && (
            <button className="btn btn-primary" onClick={() => toast("분기 리뷰 작성 시작")}>
              <Icons.Doc size={13} sw={2} /> 리뷰 작성
            </button>
          )}
          {tab === "skills" && (
            <button className="btn btn-primary" onClick={() => toast("역량 자기평가 시작")}>
              <Icons.Sparkle size={13} sw={2} /> 자기평가 시작
            </button>
          )}
        </div>
      </div>
      <div className="wd-tab-bar">
        <button aria-selected={tab === "goals"} onClick={() => setTab("goals")}>
          <Icons.Target size={13} sw={1.8} /> 목표
        </button>
        <button aria-selected={tab === "review"} onClick={() => setTab("review")}>
          <Icons.Doc size={13} sw={1.8} /> 분기 리뷰
        </button>
        <button aria-selected={tab === "skills"} onClick={() => setTab("skills")}>
          <Icons.Sparkle size={13} sw={1.8} /> 자기평가
        </button>
      </div>
      {tab === "goals"  && <InlineNoPageH><MyGoalsPage data={data} /></InlineNoPageH>}
      {tab === "review" && <InlineNoPageH><QuarterlyReviewPage data={data} /></InlineNoPageH>}
      {tab === "skills" && <InlineNoPageH><SkillsAssessPage data={data} /></InlineNoPageH>}
    </div>
  );
}

// 자식 페이지의 .content 래퍼·.page-h, 그리고 자체 KPI 스트립을 흡수해
// 부모 wrapper 의 헤더/탭과 시각적으로 단절되지 않도록 한다.
function InlineNoPageH({ children }) {
  return (
    <div className="wrap-inline-page">
      <style>{`
        .wrap-inline-page > .content {
          padding: 0;
          max-width: none;
        }
        /* 자식 페이지의 자체 헤더 제거 — wrapper 가 이미 표시 */
        .wrap-inline-page > .content > .page-h {
          display: none;
        }
        /* 자식 페이지의 첫 KPI 스트립도 제거 (시각적 단절 방지)
           — 필요한 KPI 는 wrapper 가 통합해 노출 */
        .wrap-inline-page > .content > .page-h + .wd-stat-strip,
        .wrap-inline-page > .content > .wd-stat-strip:first-child {
          display: none;
        }
        /* 위쪽 여백 살짝 압축 — wrapper 탭 바로 아래 카드 첫 줄이 붙도록 */
        .wrap-inline-page > .content > .grid-2:first-child,
        .wrap-inline-page > .content > .grid-3:first-child,
        .wrap-inline-page > .content > .wd-result-toolbar:first-child {
          margin-top: 0;
        }
      `}</style>
      {children}
    </div>
  );
}

Object.assign(window, { LeaveAbsenceWrapper, PerfGrowthWrapper });
