/* global React, Icons, ToastContext, WdDrawer, WdField, WdRow, WdSectionH, WdNote */
// CTR HR Hub — 공용 입력 드로어 모음

const { useState: useStateDR, useContext: useCtxDR } = React;

// ── 1:1 미팅 예약 ───────────────────────────────────
function OneOnOneDrawer({ open, onClose, onSubmit }) {
  const toast = useCtxDR(ToastContext);
  const [member, setMember] = useStateDR("");
  const [type, setType] = useStateDR("정기");
  const [when, setWhen] = useStateDR("");
  const [duration, setDuration] = useStateDR("30");
  const [agenda, setAgenda] = useStateDR("");

  const submit = () => {
    onSubmit && onSubmit({ member, type, when, duration, agenda });
    toast(`${member || "팀원"} 1:1 예약 완료`);
    onClose();
  };
  const valid = member && when;

  const types = [
    { id: "정기",      sub: "주/월간 정기 면담" },
    { id: "수시",      sub: "특정 이슈/주제" },
    { id: "목표 점검",  sub: "MBO·OKR 진행 점검" },
    { id: "역량 개발",  sub: "성장·커리어 대화" },
  ];

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      eyebrow="팀 관리"
      title="새 1:1 예약"
      primary={{ label: "예약 생성", onClick: submit, disabled: !valid, icon: <Icons.Check size={13} sw={2.2} /> }}
      secondary={{ label: "취소", onClick: onClose }}>

      <WdField label="팀원" required>
        <select value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">선택하세요</option>
          <option>강성민</option><option>강하준</option><option>최서연</option>
          <option>박서연</option><option>이상민</option><option>권하은</option>
        </select>
      </WdField>

      <WdField label="유형" required>
        <div className="wdr-type-grid">
          {types.map((t) => (
            <button key={t.id} className={`wdr-type-card ${type === t.id ? "selected" : ""}`} onClick={() => setType(t.id)}>
              <div className="ttl">{t.id}</div>
              <div className="sub">{t.sub}</div>
            </button>
          ))}
        </div>
      </WdField>

      <WdRow>
        <WdField label="일시" required>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </WdField>
        <WdField label="시간">
          <select value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="15">15분</option>
            <option value="30">30분</option>
            <option value="45">45분</option>
            <option value="60">60분</option>
          </select>
        </WdField>
      </WdRow>

      <WdField label="안건 (선택)" help="미팅 전에 팀원에게 공유돼요">
        <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="이번 1:1에서 이야기할 주제들..." />
      </WdField>
    </WdDrawer>
  );
}

// ── 휴직 신청 ───────────────────────────────────
function LoaRequestDrawer({ open, onClose, defaultType }) {
  const toast = useCtxDR(ToastContext);
  const [type, setType] = useStateDR(defaultType || "");
  const [from, setFrom] = useStateDR("");
  const [to, setTo] = useStateDR("");
  const [reason, setReason] = useStateDR("");
  const [paid, setPaid] = useStateDR("paid");

  React.useEffect(() => { if (defaultType) setType(defaultType); }, [defaultType]);

  const submit = () => {
    toast("휴직 신청이 제출되었습니다");
    onClose();
  };
  const valid = type && from && to && reason.trim();

  const types = [
    { id: "출산", sub: "출산 전후 90일 (다태아 120일)" },
    { id: "육아", sub: "만 8세 이하 자녀" },
    { id: "병가", sub: "장기 치료 필요" },
    { id: "개인", sub: "기타 개인 사유" },
  ];

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      eyebrow="자가 서비스"
      title="휴직 신청"
      primary={{ label: "신청", onClick: submit, disabled: !valid, icon: <Icons.Check size={13} sw={2.2} /> }}
      secondary={{ label: "취소", onClick: onClose }}>

      <WdNote>
        승인자는 <b>직속 상사 → 인사팀장</b> 순서로 결재돼요. 출산·육아 휴직은 법정 휴직으로 자동 승인돼요.
      </WdNote>

      <WdField label="휴직 유형" required>
        <div className="wdr-type-grid">
          {types.map((t) => (
            <button key={t.id} className={`wdr-type-card ${type === t.id ? "selected" : ""}`} onClick={() => setType(t.id)}>
              <div className="ttl">{t.id} 휴직</div>
              <div className="sub">{t.sub}</div>
            </button>
          ))}
        </div>
      </WdField>

      <WdRow>
        <WdField label="시작일" required>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </WdField>
        <WdField label="복직 예정일" required>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </WdField>
      </WdRow>

      <WdField label="구분">
        <select value={paid} onChange={(e) => setPaid(e.target.value)}>
          <option value="paid">유급</option>
          <option value="unpaid">무급</option>
          <option value="legal">법정 (자동 결정)</option>
        </select>
      </WdField>

      <WdField label="사유" required>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="휴직 신청 사유를 자세히 입력해주세요" />
      </WdField>

      <WdField label="첨부 (선택)" help="진단서·증명서 등을 첨부할 수 있어요">
        <button className="btn sm" style={{ width: "fit-content" }}>
          <Icons.Upload size={12} sw={2} /> 파일 업로드
        </button>
      </WdField>
    </WdDrawer>
  );
}

// ── 증명서 신청 ───────────────────────────────────
function CertRequestDrawer({ open, onClose, defaultType }) {
  const toast = useCtxDR(ToastContext);
  const [type, setType] = useStateDR(defaultType || "");
  const [purpose, setPurpose] = useStateDR("");
  const [count, setCount] = useStateDR(1);
  const [lang, setLang] = useStateDR("ko");
  const [delivery, setDelivery] = useStateDR("download");

  React.useEffect(() => { if (defaultType) setType(defaultType); }, [defaultType]);

  const submit = () => { toast("증명서 신청 완료"); onClose(); };
  const valid = type && purpose.trim();

  const types = [
    { id: "재직증명서",     sub: "현재 재직 상태",      time: "즉시" },
    { id: "경력증명서",     sub: "근속 + 직책 이력",    time: "1영업일" },
    { id: "소득금액증명원", sub: "연간 소득 증빙",       time: "즉시" },
    { id: "퇴직증명서",     sub: "퇴직자 전용",         time: "1영업일" },
  ];

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      eyebrow="자가 서비스"
      title="증명서 신청"
      primary={{ label: "신청", onClick: submit, disabled: !valid, icon: <Icons.Check size={13} sw={2.2} /> }}
      secondary={{ label: "취소", onClick: onClose }}>

      <WdNote>
        발급 완료된 증명서는 <b>PDF로 다운로드</b>할 수 있어요. 영문 발급은 1~2영업일 소요.
      </WdNote>

      <WdField label="증명서 종류" required>
        <div className="wdr-type-grid">
          {types.map((t) => (
            <button key={t.id} className={`wdr-type-card ${type === t.id ? "selected" : ""}`} onClick={() => setType(t.id)}>
              <div className="ttl">{t.id}</div>
              <div className="sub">{t.sub} · <b style={{ color: "var(--accent-ink)" }}>{t.time}</b></div>
            </button>
          ))}
        </div>
      </WdField>

      <WdField label="발급 용도" required help="제출처·용도를 입력해주세요 (예: 은행 대출, 비자 신청)">
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="예: 은행 대출 신청" />
      </WdField>

      <WdRow>
        <WdField label="언어">
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ko">한국어</option>
            <option value="en">영문</option>
            <option value="both">한·영문 모두</option>
          </select>
        </WdField>
        <WdField label="발급 부수">
          <input type="number" min="1" max="10" value={count} onChange={(e) => setCount(+e.target.value)} />
        </WdField>
      </WdRow>

      <WdField label="수령 방법">
        <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
          <option value="download">PDF 다운로드</option>
          <option value="email">이메일 발송</option>
          <option value="pickup">사내 수령</option>
        </select>
      </WdField>
    </WdDrawer>
  );
}

// ── 복리후생 신청 ───────────────────────────────────
function BenefitRequestDrawer({ open, onClose }) {
  const toast = useCtxDR(ToastContext);
  const [item, setItem] = useStateDR("");
  const [amount, setAmount] = useStateDR("");
  const [date, setDate] = useStateDR("");
  const [memo, setMemo] = useStateDR("");

  const submit = () => { toast("복리후생 신청 완료"); onClose(); };
  const valid = item && amount && date;

  const items = [
    { id: "대학학자금",     limit: 2000000, used: 0 },
    { id: "자기개발비",     limit: 1000000, used: 0 },
    { id: "종합건강검진",   limit: 500000,  used: 0 },
    { id: "안경/렌즈",      limit: 200000,  used: 0 },
    { id: "사내동호회",     limit: 50000,   used: 0 },
  ];

  const selectedItem = items.find((x) => x.id === item);

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      eyebrow="자가 서비스"
      title="복리후생 신청"
      primary={{ label: "신청", onClick: submit, disabled: !valid, icon: <Icons.Check size={13} sw={2.2} /> }}
      secondary={{ label: "취소", onClick: onClose }}>

      <WdField label="복리후생 항목" required>
        <select value={item} onChange={(e) => setItem(e.target.value)}>
          <option value="">항목을 선택해주세요</option>
          {items.map((x) => (
            <option key={x.id} value={x.id}>{x.id} (잔여 ₩{(x.limit - x.used).toLocaleString()})</option>
          ))}
        </select>
      </WdField>

      {selectedItem && (
        <WdNote>
          <b>{selectedItem.id}</b> 한도 ₩{selectedItem.limit.toLocaleString()} · 사용 ₩{selectedItem.used.toLocaleString()} ·
          잔여 <b>₩{(selectedItem.limit - selectedItem.used).toLocaleString()}</b>
        </WdNote>
      )}

      <WdRow>
        <WdField label="금액" required>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </WdField>
        <WdField label="사용일자" required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </WdField>
      </WdRow>

      <WdField label="영수증 첨부" help="영수증 PDF 또는 이미지 (필수)">
        <button className="btn sm" style={{ width: "fit-content" }}>
          <Icons.Upload size={12} sw={2} /> 영수증 업로드
        </button>
      </WdField>

      <WdField label="메모 (선택)">
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="사용 내역에 대한 추가 설명" />
      </WdField>
    </WdDrawer>
  );
}

// ── 새 업무 ───────────────────────────────────
function NewTaskDrawer({ open, onClose }) {
  const toast = useCtxDR(ToastContext);
  const [title, setTitle] = useStateDR("");
  const [type, setType] = useStateDR("개인");
  const [priority, setPriority] = useStateDR("normal");
  const [due, setDue] = useStateDR("");
  const [assignee, setAssignee] = useStateDR("self");
  const [memo, setMemo] = useStateDR("");

  const submit = () => { toast("새 업무가 추가되었습니다"); onClose(); };
  const valid = title.trim();

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      eyebrow="나의 업무"
      title="새 업무 추가"
      primary={{ label: "추가", onClick: submit, disabled: !valid, icon: <Icons.Plus size={13} sw={2.2} /> }}
      secondary={{ label: "취소", onClick: onClose }}>

      <WdField label="제목" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="업무 제목을 입력하세요" />
      </WdField>

      <WdRow>
        <WdField label="유형">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>개인</option>
            <option>휴가</option>
            <option>급여</option>
            <option>온보딩</option>
            <option>오프보딩</option>
            <option>성과</option>
          </select>
        </WdField>
        <WdField label="우선순위">
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="urgent">긴급</option>
            <option value="high">높음</option>
            <option value="normal">보통</option>
            <option value="low">낮음</option>
          </select>
        </WdField>
      </WdRow>

      <WdRow>
        <WdField label="마감일">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </WdField>
        <WdField label="담당">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="self">본인</option>
            <option value="team">팀에 위임</option>
          </select>
        </WdField>
      </WdRow>

      <WdField label="설명 (선택)">
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="업무에 대한 상세 설명" />
      </WdField>
    </WdDrawer>
  );
}

Object.assign(window, {
  OneOnOneDrawer, LoaRequestDrawer, CertRequestDrawer, BenefitRequestDrawer, NewTaskDrawer,
});
