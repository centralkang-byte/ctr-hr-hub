/* global React, Icons, ToastContext */
// CTR HR Hub — 풀페이지 위저드 모음

const { useState: useStateWZ, useContext: useCtxWZ } = React;

// ── 공용 위저드 셸 ────────────────────────────────────
function WizardShell({ title, sub, steps, currentStep, onBack, onCancel, children, footer }) {
  return (
    <div className="wd-wizard">
      <div className="wz-h">
        <button className="wz-back" onClick={onCancel}>
          <Icons.ChevL size={14} sw={2} />
        </button>
        <div>
          <h1>{title}</h1>
          {sub && <div className="wz-sub">{sub}</div>}
        </div>
        <div className="wz-actions">
          <button className="btn"><Icons.Doc size={12} /> 임시 저장</button>
          <button className="btn btn-ghost" onClick={onCancel}>취소</button>
        </div>
      </div>

      <div className="wz-stepper">
        <div className="wz-track">
          {steps.map((s, i) => {
            const state = i < currentStep ? "done" : i === currentStep ? "current" : "upcoming";
            return (
              <React.Fragment key={i}>
                <div className={`wz-step ${state}`}>
                  <div className="dot">
                    {state === "done" ? <Icons.Check size={14} sw={2.4} /> : i + 1}
                  </div>
                  <div className="lbl">{s}</div>
                </div>
                {i < steps.length - 1 && <div className={`wz-connector ${i < currentStep ? "done" : ""}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="wz-body">{children}</div>
      <div className="wz-foot">{footer}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 1. 신규 직원 등록 (Hire Worker Wizard)
// ═══════════════════════════════════════════════════════════

const HIRE_STEPS = ["기본 정보", "고용 정보", "직무·소속", "보상", "온보딩", "검토"];

function HireWorkerWizard({ onCancel, onComplete }) {
  const toast = useCtxWZ(ToastContext);
  const [step, setStep] = useStateWZ(0);
  const [f, setF] = useStateWZ({
    nameKo: "", nameEn: "", birth: "", gender: "", nationality: "한국",
    email: "", phone: "",
    company: "CTR (주)", dept: "", team: "", title: "", rank: "사원", manager: "",
    joinDate: "", employment: "정규직", contract: "무기한",
    salary: "", band: "L1", bonus: "",
    template: "신규입사 온보딩", buddy: "",
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const next = () => setStep((s) => Math.min(HIRE_STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const submit = () => { toast(`${f.nameKo} 신규 등록 완료`); onComplete && onComplete(); };

  const stepValid = () => {
    if (step === 0) return f.nameKo && f.email;
    if (step === 1) return f.joinDate && f.employment;
    if (step === 2) return f.dept && f.title;
    return true;
  };

  return (
    <WizardShell
      title="직원 등록"
      sub="새로운 구성원의 인사 정보를 단계별로 입력하세요."
      steps={HIRE_STEPS}
      currentStep={step}
      onCancel={onCancel}
      footer={(
        <>
          <span className="progress-text">{step + 1} / {HIRE_STEPS.length} 단계</span>
          <div className="right">
            {step > 0 && <button className="btn" onClick={prev}><Icons.ChevL size={11} /> 이전</button>}
            {step < HIRE_STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={next} disabled={!stepValid()}>
                다음 <Icons.ChevR size={11} sw={2} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={submit}>
                <Icons.Check size={13} sw={2.2} /> 등록 완료
              </button>
            )}
          </div>
        </>
      )}>
      {step === 0 && (
        <div className="wz-section">
          <h3>인적 사항</h3>
          <div className="wz-row">
            <div className="wz-field"><label>한국어 이름 <span className="req">*</span></label>
              <input value={f.nameKo} onChange={(e) => set("nameKo", e.target.value)} placeholder="홍길동" />
            </div>
            <div className="wz-field"><label>영문 이름</label>
              <input value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="Hong Gildong" />
            </div>
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>생년월일</label>
              <input type="date" value={f.birth} onChange={(e) => set("birth", e.target.value)} />
            </div>
            <div className="wz-field"><label>성별</label>
              <select value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">선택</option><option>남</option><option>여</option>
              </select>
            </div>
          </div>
          <div className="wz-field"><label>국적</label>
            <select value={f.nationality} onChange={(e) => set("nationality", e.target.value)}>
              <option>한국</option><option>중국</option><option>일본</option><option>미국</option><option>기타</option>
            </select>
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>회사 이메일 <span className="req">*</span></label>
              <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@ctr.co.kr" />
            </div>
            <div className="wz-field"><label>연락처</label>
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-1234-5678" />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wz-section">
          <h3>고용 정보</h3>
          <div className="wz-field"><label>입사일 <span className="req">*</span></label>
            <input type="date" value={f.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>고용 형태 <span className="req">*</span></label>
              <select value={f.employment} onChange={(e) => set("employment", e.target.value)}>
                <option>정규직</option><option>계약직</option><option>인턴</option><option>파견</option>
              </select>
            </div>
            <div className="wz-field"><label>계약 기간</label>
              <select value={f.contract} onChange={(e) => set("contract", e.target.value)}>
                <option>무기한</option><option>1년</option><option>2년</option><option>프로젝트</option>
              </select>
            </div>
          </div>
          <div className="wz-field"><label>법인</label>
            <select value={f.company} onChange={(e) => set("company", e.target.value)}>
              <option>CTR (주)</option><option>CTR China</option><option>CTR Vietnam</option><option>CTR Spain</option><option>CTR Russia</option><option>CTR Japan</option>
            </select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wz-section">
          <h3>직무 · 소속</h3>
          <div className="wz-row">
            <div className="wz-field"><label>부서 <span className="req">*</span></label>
              <select value={f.dept} onChange={(e) => set("dept", e.target.value)}>
                <option value="">선택</option>
                {data.departments.filter((d) => d !== "전체 부서").map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="wz-field"><label>직군</label>
              <input value={f.team} onChange={(e) => set("team", e.target.value)} placeholder="예: 백엔드" />
            </div>
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>직위 <span className="req">*</span></label>
              <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 시니어 엔지니어" />
            </div>
            <div className="wz-field"><label>직급</label>
              <select value={f.rank} onChange={(e) => set("rank", e.target.value)}>
                {data.ranks.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="wz-field"><label>직속 상사</label>
            <input value={f.manager} onChange={(e) => set("manager", e.target.value)} placeholder="이름 또는 사번 검색" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wz-section">
          <h3>보상</h3>
          <div className="wz-row">
            <div className="wz-field"><label>연봉 (만원)</label>
              <input type="number" value={f.salary} onChange={(e) => set("salary", e.target.value)} placeholder="6000" />
            </div>
            <div className="wz-field"><label>연봉 밴드</label>
              <select value={f.band} onChange={(e) => set("band", e.target.value)}>
                {data.salaryBands.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="wz-field"><label>입사 보너스 (선택)</label>
            <input type="number" value={f.bonus} onChange={(e) => set("bonus", e.target.value)} placeholder="0" />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="wz-section">
          <h3>온보딩</h3>
          <div className="wz-field"><label>온보딩 템플릿</label>
            <select value={f.template} onChange={(e) => set("template", e.target.value)}>
              {data.onboardingTemplates.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="wz-field"><label>버디 (선택)</label>
            <input value={f.buddy} onChange={(e) => set("buddy", e.target.value)} placeholder="이름 또는 사번 검색" />
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="wz-section">
          <h3>검토 및 확인</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
            {[
              ["이름", `${f.nameKo} (${f.nameEn || "-"})`],
              ["이메일", f.email],
              ["입사일", f.joinDate || "—"],
              ["법인", f.company],
              ["부서·직위", `${f.dept || "—"} · ${f.title || "—"}`],
              ["직급", f.rank],
              ["고용 형태", f.employment],
              ["연봉", f.salary ? `${f.salary}만원 (${f.band})` : "—"],
              ["온보딩", f.template],
              ["버디", f.buddy || "미배정"],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, padding: 12, background: "var(--accent-soft)", borderRadius: 8, fontSize: 12, color: "var(--accent-ink)", lineHeight: 1.5 }}>
            등록 완료 시 입사자에게 자동 안내 이메일이 발송되고, 온보딩 체크리스트가 생성돼요.
          </div>
        </div>
      )}
    </WizardShell>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. 새 채용 공고 (Job Posting Wizard)
// ═══════════════════════════════════════════════════════════

const JOB_STEPS = ["기본 정보", "자격 요건", "보상·일정", "결재선", "검토"];

function JobPostingWizard({ onCancel, onComplete }) {
  const toast = useCtxWZ(ToastContext);
  const [step, setStep] = useStateWZ(0);
  const [f, setF] = useStateWZ({
    title: "", team: "", location: "서울", employment: "정규직", level: "시니어",
    description: "", required: "", preferred: "",
    salaryMin: "", salaryMax: "", salaryHidden: false,
    deadline: "", openings: 1, recruiter: "",
    approvers: ["인사팀장", "본부장"],
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const next = () => setStep((s) => Math.min(JOB_STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const submit = () => { toast(`${f.title} 공고 등록`); onComplete && onComplete(); };

  const valid = () => {
    if (step === 0) return f.title && f.team;
    if (step === 1) return f.required.trim();
    if (step === 2) return f.deadline;
    return true;
  };

  return (
    <WizardShell
      title="새 채용 공고"
      sub="채용 공고를 단계별로 작성하고 결재선을 지정하세요."
      steps={JOB_STEPS}
      currentStep={step}
      onCancel={onCancel}
      footer={(
        <>
          <span className="progress-text">{step + 1} / {JOB_STEPS.length} 단계</span>
          <div className="right">
            {step > 0 && <button className="btn" onClick={prev}><Icons.ChevL size={11} /> 이전</button>}
            {step < JOB_STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={next} disabled={!valid()}>다음 <Icons.ChevR size={11} sw={2} /></button>
            ) : (
              <button className="btn btn-primary" onClick={submit}><Icons.Check size={13} sw={2.2} /> 결재 요청</button>
            )}
          </div>
        </>
      )}>
      {step === 0 && (
        <div className="wz-section">
          <h3>기본 정보</h3>
          <div className="wz-field"><label>공고 제목 <span className="req">*</span></label>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 시니어 프론트엔드 엔지니어" />
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>소속 팀 <span className="req">*</span></label>
              <select value={f.team} onChange={(e) => set("team", e.target.value)}>
                <option value="">선택</option><option>개발팀</option><option>영업팀</option><option>인사팀</option><option>품질관리팀</option>
              </select>
            </div>
            <div className="wz-field"><label>레벨</label>
              <select value={f.level} onChange={(e) => set("level", e.target.value)}>
                <option>주니어</option><option>미들</option><option>시니어</option><option>리드</option>
              </select>
            </div>
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>근무지</label>
              <input value={f.location} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div className="wz-field"><label>고용 형태</label>
              <select value={f.employment} onChange={(e) => set("employment", e.target.value)}>
                <option>정규직</option><option>계약직</option><option>인턴</option>
              </select>
            </div>
          </div>
          <div className="wz-field"><label>직무 설명</label>
            <textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="이 포지션의 책임과 주요 업무를 입력하세요" style={{ minHeight: 100 }} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wz-section">
          <h3>자격 요건</h3>
          <div className="wz-field"><label>필수 요건 <span className="req">*</span></label>
            <textarea value={f.required} onChange={(e) => set("required", e.target.value)} placeholder="• 학력&#10;• 경력&#10;• 필수 기술 스택" style={{ minHeight: 120 }} />
          </div>
          <div className="wz-field"><label>우대 사항</label>
            <textarea value={f.preferred} onChange={(e) => set("preferred", e.target.value)} placeholder="• 우대 경험&#10;• 우대 기술" style={{ minHeight: 100 }} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wz-section">
          <h3>보상 · 일정</h3>
          <div className="wz-row">
            <div className="wz-field"><label>급여 하한 (만원)</label>
              <input type="number" value={f.salaryMin} onChange={(e) => set("salaryMin", e.target.value)} disabled={f.salaryHidden} />
            </div>
            <div className="wz-field"><label>급여 상한 (만원)</label>
              <input type="number" value={f.salaryMax} onChange={(e) => set("salaryMax", e.target.value)} disabled={f.salaryHidden} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 14 }}>
            <input type="checkbox" checked={f.salaryHidden} onChange={(e) => set("salaryHidden", e.target.checked)} />
            급여 비공개 ("협의 후 결정"으로 표시)
          </label>
          <div className="wz-row">
            <div className="wz-field"><label>마감일 <span className="req">*</span></label>
              <input type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
            </div>
            <div className="wz-field"><label>채용 인원</label>
              <input type="number" min="1" value={f.openings} onChange={(e) => set("openings", +e.target.value)} />
            </div>
          </div>
          <div className="wz-field"><label>채용 담당자</label>
            <input value={f.recruiter} onChange={(e) => set("recruiter", e.target.value)} placeholder="이름 또는 사번" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wz-section">
          <h3>결재선</h3>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 14, padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8 }}>
            공고는 다음 결재선을 거쳐 게시돼요. 결재자는 추가/변경할 수 있어요.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {f.approvers.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "white", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</div>
                <span style={{ flex: 1, fontWeight: 500 }}>{a}</span>
                <button className="btn sm btn-ghost"><Icons.Close size={11} sw={2} /></button>
              </div>
            ))}
            <button className="btn sm" style={{ marginTop: 8, width: "fit-content" }}>
              <Icons.Plus size={11} sw={2.2} /> 결재자 추가
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="wz-section">
          <h3>검토 및 결재 요청</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
            {[
              ["제목", f.title],
              ["팀 / 레벨", `${f.team} · ${f.level}`],
              ["근무지", f.location],
              ["고용 형태", f.employment],
              ["급여", f.salaryHidden ? "협의 후 결정" : `${f.salaryMin || "—"} ~ ${f.salaryMax || "—"} 만원`],
              ["마감일", f.deadline || "—"],
              ["인원", `${f.openings}명`],
              ["결재선", f.approvers.join(" → ")],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WizardShell>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. 새 성과 사이클 (Performance Cycle Wizard)
// ═══════════════════════════════════════════════════════════

const CYCLE_STEPS = ["기본 정보", "일정", "평가 방법", "대상자", "검토"];

function PerfCycleWizard({ onCancel, onComplete }) {
  const toast = useCtxWZ(ToastContext);
  const [step, setStep] = useStateWZ(0);
  const [f, setF] = useStateWZ({
    name: "", period: "반기", year: 2026, half: "H2",
    goalOpen: "", goalClose: "", checkin: "", review: "", announce: "",
    method: "MBO + CFR", scale: "O/E/M/S", peer: true, selfEval: true, calibration: true,
    scope: "전사", excludeNew: true,
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const next = () => setStep((s) => Math.min(CYCLE_STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const submit = () => { toast(`${f.name} 사이클 생성`); onComplete && onComplete(); };

  return (
    <WizardShell
      title="새 성과 사이클"
      sub="평가 사이클의 일정과 방법론을 설정해요."
      steps={CYCLE_STEPS}
      currentStep={step}
      onCancel={onCancel}
      footer={(
        <>
          <span className="progress-text">{step + 1} / {CYCLE_STEPS.length} 단계</span>
          <div className="right">
            {step > 0 && <button className="btn" onClick={prev}><Icons.ChevL size={11} /> 이전</button>}
            {step < CYCLE_STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={next} disabled={step === 0 && !f.name}>
                다음 <Icons.ChevR size={11} sw={2} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={submit}><Icons.Check size={13} sw={2.2} /> 사이클 생성</button>
            )}
          </div>
        </>
      )}>
      {step === 0 && (
        <div className="wz-section">
          <h3>기본 정보</h3>
          <div className="wz-field"><label>사이클 이름 <span className="req">*</span></label>
            <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 2026 H2 성과 평가" />
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>주기</label>
              <select value={f.period} onChange={(e) => set("period", e.target.value)}>
                <option>반기</option><option>분기</option><option>연간</option>
              </select>
            </div>
            <div className="wz-field"><label>연도 · 반기</label>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={f.year} onChange={(e) => set("year", +e.target.value)} style={{ flex: 1 }}>
                  <option>2026</option><option>2027</option>
                </select>
                <select value={f.half} onChange={(e) => set("half", e.target.value)} style={{ flex: 1 }}>
                  <option>H1</option><option>H2</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wz-section">
          <h3>주요 일정</h3>
          <div className="wz-row">
            <div className="wz-field"><label>목표 등록 시작</label>
              <input type="date" value={f.goalOpen} onChange={(e) => set("goalOpen", e.target.value)} />
            </div>
            <div className="wz-field"><label>목표 등록 마감</label>
              <input type="date" value={f.goalClose} onChange={(e) => set("goalClose", e.target.value)} />
            </div>
          </div>
          <div className="wz-field"><label>중간 점검 (Check-in)</label>
            <input type="date" value={f.checkin} onChange={(e) => set("checkin", e.target.value)} />
          </div>
          <div className="wz-row">
            <div className="wz-field"><label>평가 기간</label>
              <input type="date" value={f.review} onChange={(e) => set("review", e.target.value)} />
            </div>
            <div className="wz-field"><label>결과 통보</label>
              <input type="date" value={f.announce} onChange={(e) => set("announce", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wz-section">
          <h3>평가 방법</h3>
          <div className="wz-field"><label>방법론</label>
            <select value={f.method} onChange={(e) => set("method", e.target.value)}>
              <option>MBO + CFR</option>
              <option>OKR</option>
              <option>MBO 단독</option>
              <option>360도 평가</option>
            </select>
          </div>
          <div className="wz-field"><label>등급 체계</label>
            <select value={f.scale} onChange={(e) => set("scale", e.target.value)}>
              <option>O/E/M/S (4단계)</option>
              <option>S/A/B/C/D (5단계)</option>
              <option>1-5점 (수치)</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {[
              ["selfEval", "자기 평가 포함", "직원이 본인 성과를 먼저 평가"],
              ["peer", "동료 평가 포함", "3-5명의 동료가 익명으로 평가"],
              ["calibration", "캘리브레이션 회의", "매니저 평가 일관성 검증"],
            ].map(([k, ttl, sub]) => (
              <label key={k} style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ttl}</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{sub}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wz-section">
          <h3>평가 대상자</h3>
          <div className="wz-field"><label>범위</label>
            <select value={f.scope} onChange={(e) => set("scope", e.target.value)}>
              <option>전사</option>
              <option>특정 법인</option>
              <option>특정 부서</option>
              <option>특정 직급 이상</option>
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-muted)", marginTop: 12 }}>
            <input type="checkbox" checked={f.excludeNew} onChange={(e) => set("excludeNew", e.target.checked)} />
            입사 3개월 미만 신규 입사자 제외
          </label>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--accent-soft)", borderRadius: 8, fontSize: 12, color: "var(--accent-ink)" }}>
            현재 설정 기준 대상자: <b>예상 64명</b>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="wz-section">
          <h3>검토</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
            {[
              ["사이클 이름", f.name],
              ["주기", `${f.year} ${f.half} · ${f.period}`],
              ["방법론", f.method],
              ["등급 체계", f.scale],
              ["자기 평가", f.selfEval ? "포함" : "제외"],
              ["동료 평가", f.peer ? "포함" : "제외"],
              ["캘리브레이션", f.calibration ? "실시" : "제외"],
              ["대상", f.scope + (f.excludeNew ? " (신규 제외)" : "")],
              ["목표 등록", `${f.goalOpen || "—"} ~ ${f.goalClose || "—"}`],
              ["중간 점검", f.checkin || "—"],
              ["평가 기간", f.review || "—"],
              ["결과 통보", f.announce || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WizardShell>
  );
}

Object.assign(window, { HireWorkerWizard, JobPostingWizard, PerfCycleWizard, OrgRestructureWizard });

// ═══════════════════════════════════════════════════════════
// 4. 조직 개편 (Org Restructure Wizard)
// ═══════════════════════════════════════════════════════════

const ORG_STEPS = ["변경 유형", "변경 내용", "영향 분석", "발효일·승인", "검토"];

function OrgRestructureWizard({ onCancel, onComplete }) {
  const toast = useCtxWZ(ToastContext);
  const [step, setStep] = useStateWZ(0);
  const [f, setF] = useStateWZ({
    changeType: "",
    sourceDept: "", targetDept: "", newName: "", newParent: "",
    affectedCount: 0,
    effectiveDate: "", reason: "",
    approvers: ["인사팀장", "대표이사"],
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const next = () => setStep((s) => Math.min(ORG_STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const submit = () => { toast("조직 개편 결재 요청 완료"); onComplete && onComplete(); };

  const types = [
    { id: "merge", title: "부서 통합",   sub: "두 부서를 하나로 합침", icon: "Users" },
    { id: "split", title: "부서 분리",   sub: "한 부서를 둘로 나눔",   icon: "Org" },
    { id: "new",   title: "부서 신설",   sub: "새 부서 생성",          icon: "Plus" },
    { id: "move",  title: "부서 이동",   sub: "상위 부서 변경",         icon: "ArrowR" },
    { id: "close", title: "부서 폐지",   sub: "부서 해체 + 인원 재배치", icon: "Close" },
    { id: "rename",title: "부서 명칭 변경", sub: "이름만 변경",         icon: "Sparkle" },
  ];

  const valid = () => {
    if (step === 0) return f.changeType;
    if (step === 1) {
      if (f.changeType === "new") return f.newName && f.newParent;
      if (f.changeType === "rename") return f.sourceDept && f.newName;
      return f.sourceDept;
    }
    if (step === 3) return f.effectiveDate && f.reason.trim();
    return true;
  };

  return (
    <WizardShell
      title="조직 개편"
      sub="부서 구조 변경을 단계별로 정의하고 결재선을 지정해요."
      steps={ORG_STEPS}
      currentStep={step}
      onCancel={onCancel}
      footer={(
        <>
          <span className="progress-text">{step + 1} / {ORG_STEPS.length} 단계</span>
          <div className="right">
            {step > 0 && <button className="btn" onClick={prev}><Icons.ChevL size={11} /> 이전</button>}
            {step < ORG_STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={next} disabled={!valid()}>다음 <Icons.ChevR size={11} sw={2} /></button>
            ) : (
              <button className="btn btn-primary" onClick={submit}><Icons.Check size={13} sw={2.2} /> 결재 요청</button>
            )}
          </div>
        </>
      )}>
      {step === 0 && (
        <div className="wz-section">
          <h3>변경 유형 선택</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {types.map((t) => {
              const Icon = Icons[t.icon];
              return (
                <button key={t.id} onClick={() => set("changeType", t.id)} style={{
                  padding: "14px 16px",
                  background: f.changeType === t.id ? "var(--accent-soft)" : "var(--bg-elev)",
                  border: f.changeType === t.id ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                  borderRadius: 10,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-sunk)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
                    <Icon size={16} sw={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>{t.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wz-section">
          <h3>변경 내용</h3>
          {f.changeType === "new" && (
            <>
              <div className="wz-field"><label>새 부서명 <span className="req">*</span></label>
                <input value={f.newName} onChange={(e) => set("newName", e.target.value)} placeholder="예: 데이터팀" />
              </div>
              <div className="wz-field"><label>상위 부서 <span className="req">*</span></label>
                <select value={f.newParent} onChange={(e) => set("newParent", e.target.value)}>
                  <option value="">선택</option>
                  <option>경영지원본부</option><option>기술본부</option><option>영업본부</option>
                </select>
              </div>
            </>
          )}
          {f.changeType === "merge" && (
            <div className="wz-row">
              <div className="wz-field"><label>통합할 부서 A <span className="req">*</span></label>
                <select value={f.sourceDept} onChange={(e) => set("sourceDept", e.target.value)}>
                  <option value="">선택</option><option>개발팀</option><option>QA팀</option><option>인프라팀</option>
                </select>
              </div>
              <div className="wz-field"><label>통합할 부서 B</label>
                <select value={f.targetDept} onChange={(e) => set("targetDept", e.target.value)}>
                  <option value="">선택</option><option>개발팀</option><option>QA팀</option><option>인프라팀</option>
                </select>
              </div>
            </div>
          )}
          {(f.changeType === "split" || f.changeType === "move" || f.changeType === "close" || f.changeType === "rename") && (
            <>
              <div className="wz-field"><label>대상 부서 <span className="req">*</span></label>
                <select value={f.sourceDept} onChange={(e) => set("sourceDept", e.target.value)}>
                  <option value="">선택</option>
                  <option>개발팀</option><option>영업팀</option><option>품질관리팀</option>
                </select>
              </div>
              {f.changeType === "rename" && (
                <div className="wz-field"><label>새 이름 <span className="req">*</span></label>
                  <input value={f.newName} onChange={(e) => set("newName", e.target.value)} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="wz-section">
          <h3>영향 분석</h3>
          <div style={{ padding: "14px 16px", background: "var(--wd-orange-soft)", borderLeft: "3px solid var(--wd-orange-ink)", borderRadius: 8, marginBottom: 16, fontSize: 12.5, color: "var(--wd-orange-ink)" }}>
            이 변경은 <b>약 18명</b>의 소속·리포팅 라인에 영향을 줍니다.
          </div>
          {[
            ["영향 인원",      "18명",      "재배치 대상"],
            ["발령서 생성",    "18건",       "자동 생성"],
            ["하위 직책 변경", "3건",        "팀장 직책"],
            ["보고선 변경",    "21건",       "직속 상사"],
            ["급여 영향",      "없음",       "기존 보상 유지"],
          ].map(([k, v, sub]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 100px 1fr", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--fg-muted)" }}>{k}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>{sub}</span>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="wz-section">
          <h3>발효일 · 결재선</h3>
          <div className="wz-row">
            <div className="wz-field"><label>발효일 <span className="req">*</span></label>
              <input type="date" value={f.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
            </div>
            <div className="wz-field"><label>공지 방식</label>
              <select><option>전사 이메일</option><option>인트라넷 공지</option><option>모두</option></select>
            </div>
          </div>
          <div className="wz-field"><label>변경 사유 <span className="req">*</span></label>
            <textarea value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder="조직 개편 배경과 목적을 입력하세요" style={{ minHeight: 100 }} />
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>결재선</div>
            {f.approvers.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "white", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</div>
                <span style={{ flex: 1, fontWeight: 500 }}>{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="wz-section">
          <h3>검토</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
            {[
              ["변경 유형",  types.find((t) => t.id === f.changeType)?.title || "—"],
              ["대상 부서",  f.sourceDept || f.newName || "—"],
              ["발효일",     f.effectiveDate || "—"],
              ["영향 인원",  "약 18명"],
              ["결재선",     f.approvers.join(" → ")],
              ["사유",       f.reason || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WizardShell>
  );
}
