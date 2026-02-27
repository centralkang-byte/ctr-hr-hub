// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Core Value Icons (SVG)
// 도전(Challenge), 신뢰(Trust), 책임(Responsibility), 존중(Respect)
// ═══════════════════════════════════════════════════════════

interface IconProps {
  size?: number
  color?: string
  className?: string
}

// ─── 도전 (Challenge) — Rocket icon ─────────────────────────

export function ChallengeIcon({
  size = 24,
  color = '#E30613',
  className,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="도전"
    >
      <path
        d="M12 2C12 2 7 7 7 12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12C17 7 12 2 12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 17V22"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 20H16"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 8L13.5 10.5L12 13L10.5 10.5L12 8Z"
        fill={color}
        opacity="0.6"
      />
    </svg>
  )
}

// ─── 신뢰 (Trust) — Shield icon ─────────────────────────────

export function TrustIcon({
  size = 24,
  color = '#003087',
  className,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="신뢰"
    >
      <path
        d="M12 3L4 7V12C4 16.42 7.56 20.5 12 21.5C16.44 20.5 20 16.42 20 12V7L12 3Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── 책임 (Responsibility) — Target icon ────────────────────

export function ResponsibilityIcon({
  size = 24,
  color = '#00A651',
  className,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="책임"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth="1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="5.5"
        stroke={color}
        strokeWidth="1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="2"
        fill={color}
      />
    </svg>
  )
}

// ─── 존중 (Respect) — Heart-handshake icon ──────────────────

export function RespectIcon({
  size = 24,
  color = '#F5A623',
  className,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="존중"
    >
      <path
        d="M12 21C12 21 3 13.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 12 5C12.09 3.81 13.76 3 15.5 3C18.58 3 21 5.42 21 8.5C21 13.5 12 21 12 21Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8 13L10.5 11L12 13L13.5 11L16 13"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Aliases with Ctr prefix (STEP3 spec)
export const CtrChallengeIcon = ChallengeIcon
export const CtrTrustIcon = TrustIcon
export const CtrResponsibilityIcon = ResponsibilityIcon
export const CtrRespectIcon = RespectIcon
