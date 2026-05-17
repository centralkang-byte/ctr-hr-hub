/* global React, Icons, ToastContext, WdDrawer, WdField, WdRow, WdSectionH, WdNote */
// CTR HR Hub — 휴가 신청 드로어

const { useState: useStateLR, useContext: useCtxLR } = React;

function LeaveRequestModal({ onClose, onSubmit }) {
  const toast = useCtxLR(ToastContext);
  const [policy, setPolicy] = useStateLR("");
  const [from, setFrom] = useStateLR("");
  const [to, setTo] = useStateLR("");
  const [days, setDays] = useStateLR(1);
  const [reason, setReason] = useStateLR("");
  const [substitute, setSubstitute] = useStateLR("");

  const submit = () => {
    onSubmit && onSubmit({ policy, from, to, days, reason });
    toast("휴가 신청이 제출되었습니다");
    onClose();
  };

  const valid = policy && from && to && reason.trim().length > 0;

  return (
    <WdDrawer
      open={true}
      onClose={onClose}
      eyebrow="자가 서비스"
      title="휴가 신청"
      primary={{ label: "신청", onClick: submit, disabled: !valid, icon: <Icons.Check size={13} sw={2.2} /> }}
      secondary={{ label: "취소", onClick: onClose }}>
      <WdNote>
        잔여 연차 <b>12.5일</b> · 병가 <b>7일</b> 사용 가능. 승인자: 이정환 (인사팀장)
      </WdNote>

      <WdSectionH>휴가 정보</WdSectionH>

      <WdField label="휴가 정책" required>
        <select value={policy} onChange={(e) => setPolicy(e.target.value)}>
          <option value="">선택해주세요...</option>
          <option value="annual">연차유급휴가</option>
          <option value="half">반차</option>
          <option value="sick">병가</option>
          <option value="special">경조사</option>
          <option value="family">가족 돌봄</option>
        </select>
      </WdField>

      <WdRow>
        <WdField label="시작일" required>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </WdField>
        <WdField label="종료일" required>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </WdField>
      </WdRow>

      <WdField label="일수" hint="반차 가능" help="0.5일 단위로 입력">
        <input type="number" value={days} min="0.5" step="0.5" onChange={(e) => setDays(+e.target.value)} />
      </WdField>

      <WdSectionH>업무 인수인계</WdSectionH>

      <WdField label="대체자 (선택)" help="휴가 기간 중 긴급 업무를 처리할 동료를 지정해요">
        <input value={substitute} onChange={(e) => setSubstitute(e.target.value)} placeholder="이름 또는 사번 검색" />
      </WdField>

      <WdField label="사유" required>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="휴가 사유를 입력해주세요"
        />
      </WdField>
    </WdDrawer>
  );
}

Object.assign(window, { LeaveRequestModal });
