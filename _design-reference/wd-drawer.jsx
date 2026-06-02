/* global React, Icons, useEscClose */
// CTR HR Hub — Workday Drawer (공용 우측 슬라이드 입력 폼)

// 표준 드로어 컴포넌트 — 모든 입력 모달은 이것을 사용
function WdDrawer({ open, onClose, title, eyebrow, children, primary, secondary, footLeft, width }) {
  useEscClose(open, onClose);

  if (!open) return null;
  return (
    <>
      <div className="wd-drawer-scrim" onClick={onClose} />
      <aside className="wd-drawer" role="dialog" aria-label={title} style={width ? { width } : undefined}>
        <div className="wdr-h">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <div className="right">
            <button className="close" onClick={onClose} aria-label="닫기">
              <Icons.Close size={14} sw={2} />
            </button>
          </div>
        </div>
        <div className="wdr-body">{children}</div>
        {(primary || secondary || footLeft) && (
          <div className="wdr-foot">
            {footLeft && <div className="left">{footLeft}</div>}
            {secondary && <button className="btn" onClick={secondary.onClick}>{secondary.label}</button>}
            {primary && (
              <button className="btn btn-primary" onClick={primary.onClick} disabled={primary.disabled}>
                {primary.icon}{primary.label}
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

// 필드 헬퍼 컴포넌트
function WdField({ label, required, hint, help, children }) {
  return (
    <div className="wdr-field">
      <label>
        {label}
        {required && <span className="req">*</span>}
        {hint && <span className="hint">{hint}</span>}
      </label>
      {children}
      {help && <div className="help">{help}</div>}
    </div>
  );
}

function WdRow({ children }) { return <div className="wdr-row">{children}</div>; }
function WdSectionH({ children }) { return <div className="wdr-section-h">{children}</div>; }
function WdNote({ children }) { return <div className="wdr-note">{children}</div>; }

Object.assign(window, { WdDrawer, WdField, WdRow, WdSectionH, WdNote });
