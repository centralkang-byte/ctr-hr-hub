/* global React */
// CTR HR Hub — UI 프리미티브 & 아이콘

const { useState, useEffect, useMemo, useRef, useContext, createContext } = React;

// ──────────────────────────────────────────────────────
// Icons
// ──────────────────────────────────────────────────────
const Ico = ({ size = 16, sw = 1.6, className, style, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
    {children}
  </svg>
);

const Icons = {
  // Sidebar (그룹 헤더)
  Grid:      (p) => <Ico {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></Ico>,
  Bell:      (p) => <Ico {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 8H4c0-2 2-3 2-8z"/><path d="M10 20a2 2 0 0 0 4 0"/></Ico>,
  User:      (p) => <Ico {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/></Ico>,
  Users:     (p) => <Ico {...p}><circle cx="9" cy="9" r="3.5"/><path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5"/><circle cx="17" cy="8" r="2.5"/><path d="M21 17c-.3-2-1.7-3.5-4-4"/></Ico>,
  Building:  (p) => <Ico {...p}><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3a2 2 0 0 1 4 0v3"/></Ico>,
  UserPlus:  (p) => <Ico {...p}><circle cx="10" cy="8" r="4"/><path d="M2 20c1-4 4-6 8-6s4 1 5 2"/><path d="M19 14v6M16 17h6"/></Ico>,
  Target:    (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></Ico>,
  Wallet:    (p) => <Ico {...p}><rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M16 13h2.5"/><path d="M3 10h18"/></Ico>,
  Chart:     (p) => <Ico {...p}><path d="M3 21V3M3 21h18M7 17V11M11 17V7M15 17V13M19 17V9"/></Ico>,
  Gear:      (p) => <Ico {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15A7 7 0 0 0 19.4 9l2-1.5-2-3.4L17 5a7 7 0 0 0-2-1.2L14.5 1h-4L10 3.8A7 7 0 0 0 8 5L5.6 4.1l-2 3.4L5.6 9A7 7 0 0 0 5.6 15l-2 1.5 2 3.4L8 19a7 7 0 0 0 2 1.2L10.5 23h4L15 20.2A7 7 0 0 0 17 19l2.4.9 2-3.4z"/></Ico>,
  // Sidebar items
  Inbox:     (p) => <Ico {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 13h5l1 2h6l1-2h5"/></Ico>,
  Clock:     (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Ico>,
  Calendar:  (p) => <Ico {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Ico>,
  Bed:       (p) => <Ico {...p}><path d="M3 18v-7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v4"/><path d="M3 22v-4h18v4M9 13a2 2 0 1 1 4 0"/></Ico>,
  Receipt:   (p) => <Ico {...p}><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3"/><path d="M8 8h8M8 12h8M8 16h5"/></Ico>,
  Gift:      (p) => <Ico {...p}><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9c-2 0-4-1-4-3s2-3 4-1c2-2 4-1 4 1s-2 3-4 3z"/></Ico>,
  Trophy:    (p) => <Ico {...p}><path d="M8 4h8v6a4 4 0 0 1-8 0V4z"/><path d="M16 6h2a2 2 0 0 1 0 4h-2M8 6H6a2 2 0 0 0 0 4h2M9 16h6v4H9z"/></Ico>,
  Hammer:    (p) => <Ico {...p}><path d="M15 3 8 10l3 3 7-7zM6 18l4-4M12 12l9 9"/></Ico>,
  Doc:       (p) => <Ico {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></Ico>,
  Book:      (p) => <Ico {...p}><path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2V5z"/><path d="M19 18H6a2 2 0 0 0-2 2"/></Ico>,
  Briefcase: (p) => <Ico {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></Ico>,
  Heart:     (p) => <Ico {...p}><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></Ico>,
  Org:       (p) => <Ico {...p}><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="9" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v3M12 11h-7v5M12 11h7v5M12 11v5"/></Ico>,
  // Topbar
  Search:    (p) => <Ico {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Ico>,
  Plus:      (p) => <Ico {...p}><path d="M12 5v14M5 12h14"/></Ico>,
  Globe:     (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18-3-4-3-14.5 0-18z"/></Ico>,
  // Actions
  Check:     (p) => <Ico {...p}><path d="m5 12 5 5L20 7"/></Ico>,
  Close:     (p) => <Ico {...p}><path d="M6 6l12 12M18 6 6 18"/></Ico>,
  ChevR:     (p) => <Ico {...p}><path d="m9 6 6 6-6 6"/></Ico>,
  ChevL:     (p) => <Ico {...p}><path d="m15 6-6 6 6 6"/></Ico>,
  ChevD:     (p) => <Ico {...p}><path d="m6 9 6 6 6-6"/></Ico>,
  ChevU:     (p) => <Ico {...p}><path d="m6 15 6-6 6 6"/></Ico>,
  ArrowR:    (p) => <Ico {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Ico>,
  ExtLink:   (p) => <Ico {...p}><path d="M14 4h6v6M10 14 20 4M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></Ico>,
  Filter:    (p) => <Ico {...p}><path d="M3 5h18l-7 9v5l-4 2v-7L3 5z"/></Ico>,
  Download:  (p) => <Ico {...p}><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></Ico>,
  Upload:    (p) => <Ico {...p}><path d="M12 20V8M7 13l5-5 5 5M4 4h16"/></Ico>,
  Logout:    (p) => <Ico {...p}><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/></Ico>,
  Mail:      (p) => <Ico {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Ico>,
  Pin:       (p) => <Ico {...p}><path d="M12 21v-7M8 4h8l-1 6a4 4 0 0 1-6 0L8 4z"/></Ico>,
  Sun:       (p) => <Ico {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Ico>,
  Moon:      (p) => <Ico {...p}><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></Ico>,
  Alert:     (p) => <Ico {...p}><path d="m12 3 10 18H2L12 3z"/><path d="M12 10v4M12 18v.5" stroke="currentColor" strokeWidth="2"/></Ico>,
  Sparkle:   (p) => <Ico {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></Ico>,
  EmptyBox:  (p) => <Ico {...p}><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/></Ico>,
  Phone:     (p) => <Ico {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></Ico>,
  Shield:    (p) => <Ico {...p}><path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6l-8-3z"/></Ico>,
  Eye:       (p) => <Ico {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Ico>,
};

// ──────────────────────────────────────────────────────
// Avatar — Korean-initial friendly
// ──────────────────────────────────────────────────────
function Avatar({ name, initials, hue = 268, size = "md" }) {
  const label = initials ?? (name ? name.charAt(0) : "?");
  const cls =
    size === "sm" ? "avatar sm" :
    size === "lg" ? "avatar lg" :
    size === "xl" ? "avatar xl" : "avatar";
  return <div className={cls} style={{ "--av-hue": hue }}>{label}</div>;
}

// ──────────────────────────────────────────────────────
// Card primitives
// ──────────────────────────────────────────────────────
function Card({ children, style, className = "" }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

function CardHead({ title, sub, action, onAction, right, icon }) {
  const Icon = icon && Icons[icon];
  return (
    <div className="card-head">
      {Icon && <Icon size={16}/>}
      <span className="title">{title}</span>
      {sub && <span className="sub">{sub}</span>}
      <div className="right">
        {right}
        {action && (
          <button className="action" onClick={onAction}>
            {action} <Icons.ChevR size={11} sw={2.4}/>
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Sparkline
// ──────────────────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 24 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, height - ((v - min) / range) * (height - 4) - 2]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg className="sparkline spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width={width} height={height}>
      <path d={d} style={{ stroke: color || "currentColor" }}/>
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" style={{ fill: color || "currentColor" }}/>
    </svg>
  );
}

// ──────────────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────────────
const ToastContext = createContext(() => {});

function ToastHost({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (msg) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icons.Check size={14} sw={2.4}/> {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ──────────────────────────────────────────────────────
// 날짜/포맷 헬퍼
// ──────────────────────────────────────────────────────
function fmtKDate(iso, opts = { year: "numeric", month: "2-digit", day: "2-digit" }) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("ko-KR", opts);
}
function fmtKDateShort(iso) { return fmtKDate(iso, { month: "long", day: "numeric" }); }
function fmtWon(n) { return n.toLocaleString("ko-KR") + "원"; }
function fmtWonShort(n) {
  if (n >= 10000) return (n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "만원";
  return n.toLocaleString("ko-KR") + "원";
}
function daysBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.round(ms / 86400000) + 1;
}
function tenureFromISO(iso) {
  const start = new Date(iso);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const y = Math.floor(months / 12), m = months % 12;
  if (y && m) return `${y}년 ${m}개월`;
  if (y) return `${y}년`;
  return `${m}개월`;
}
function dDayLabel(n) {
  if (n === 0) return "D-Day";
  if (n > 0)  return "D+" + n;
  return "D" + n; // n is already negative
}

// ──────────────────────────────────────────────────────
// useEscClose — 모달 스택: 가장 늦게 열린 것이 먼저 닫힘
//   const open = ...; useEscClose(open, onClose);
// ──────────────────────────────────────────────────────
const __escStack = [];
if (typeof window !== "undefined" && !window.__escStackInit) {
  window.__escStackInit = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || __escStack.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const top = __escStack[__escStack.length - 1];
    top && top();
  }, true);
}
function useEscClose(open, onClose) {
  React.useEffect(() => {
    if (!open) return;
    __escStack.push(onClose);
    return () => {
      const idx = __escStack.lastIndexOf(onClose);
      if (idx >= 0) __escStack.splice(idx, 1);
    };
  }, [open, onClose]);
}

// ──────────────────────────────────────────────────────
// EmptyState — 통일된 빈 상태 컴포넌트
//   <EmptyState title="결과가 없어요" />
//   <EmptyState icon={Icons.Heart} title="..." sub="..." />
//   <EmptyState size="lg" standalone title="..." />          ← 카드 밖 단독 사용 (배경 부여)
//   <EmptyState title="..." action={<button className="btn btn-primary">시작</button>} />
// ──────────────────────────────────────────────────────
function EmptyState({ icon: IconCmp = Icons.EmptyBox, title, sub, action, size = "md", standalone = false, style, className = "" }) {
  const iconSize = size === "sm" ? 22 : 28;
  const cls = `empty ${size !== "md" ? size : ""} ${standalone ? "standalone" : ""} ${className}`.trim();
  return (
    <div className={cls} style={style}>
      <IconCmp size={iconSize} />
      <div className="em-title">{title}</div>
      {sub && <div className="em-sub">{sub}</div>}
      {action && <div className="em-action">{action}</div>}
    </div>
  );
}

Object.assign(window, {
  Icons, Ico, Avatar, Card, CardHead, Sparkline, ToastHost, ToastContext, EmptyState, useEscClose,
  fmtKDate, fmtKDateShort, fmtWon, fmtWonShort, daysBetween, tenureFromISO, dDayLabel,
});
