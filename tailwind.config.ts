// ═══════════════════════════════════════════════════════════════
// CTR HR Hub Design System — DESIGN.md 기준
// Last updated: 2026-05-18 (HR Hub 마이그레이션 Phase 1: Workday Navy 토큰 — Violet 대체)
// ═══════════════════════════════════════════════════════════════
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
	darkMode: ["class"],
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/lib/styles/**/*.{js,ts}",
	],
	theme: {
		extend: {
			colors: {
				// shadcn/ui semantic tokens (CSS variable 기반)
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					dim: 'hsl(var(--primary-dim))',
					container: 'hsl(var(--primary-container))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				'border-strong': 'hsl(var(--border-strong))', // Wave 0: proto --border-strong (btn/input 보더)
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))',
					'6': 'hsl(var(--chart-6))',
				},
				// Workday worklet palette (wt) — 도메인색 SSOT (P2a, 라이트만)
				wt: {
					'1': 'hsl(var(--wt-1))',
					'2': 'hsl(var(--wt-2))',
					'3': 'hsl(var(--wt-3))',
					'4': 'hsl(var(--wt-4))',
					'5': 'hsl(var(--wt-5))',
					'6': 'hsl(var(--wt-6))',
					'7': 'hsl(var(--wt-7))',
					'8': 'hsl(var(--wt-8))',
				},

				// V3 Dashboard 확장 토큰 (CSS variable 기반)
				tertiary: {
					DEFAULT: 'hsl(var(--tertiary))',
					container: 'hsl(var(--tertiary-container))',
				},
				'on-tertiary-container': 'hsl(var(--on-tertiary-container))',
				// Phase 4 Batch 7 — 목업 색감 충실도 (D17/D18)
				// warning-bright: BG/icon/progress bar only (text는 ctr-warning #B45309 사용)
				// alert-red: 동적 alert, urgent pill, border-left semantic only
				'warning-bright': 'hsl(var(--warning-bright))',
				'alert-red': 'hsl(var(--alert-red))',
				'badge-accent': 'hsl(var(--badge-accent))',
				// Phase 1 — Workday 시그니처 오렌지 (배지·태그용, 사용처는 Phase 2/3)
				'wd-orange': {
					DEFAULT: 'hsl(var(--wd-orange))',
					soft: 'hsl(var(--wd-orange-soft))',
					ink: 'hsl(var(--wd-orange-ink))',
				},
				// 주 액션 버튼 fill 전용 (proto friendly --warm, CEO 2026-06-11) — 장식 재사용 금지
				warm: 'hsl(var(--warm) / <alpha-value>)',
				// PR-5A: sky blue (HR Admin worklet ID 8 analytics) — light only, dark known-deferred
				info: 'hsl(var(--info))',
				'surface-container-low': 'hsl(var(--surface-container-low))',
				'surface-container-high': 'hsl(var(--surface-container-high))',
				'surface-container': 'hsl(var(--surface-container))',

				// CTR 호환 토큰 (직접 hex — 레거시 페이지 호환용)
				// Wave 0: 중립·시맨틱을 프로토 cool-gray/시맨틱 패밀리로 정렬 (CSS var 자동 전파 안 됨 → 직접 교체)
				'ctr-primary': '#004964',
				'ctr-primary-dark': '#003953',
				'ctr-primary-light': '#bedded',
				'ctr-secondary': '#64748b',
				// Semantic — proto :root 패밀리 (success oklch(56% .14 155) 등)
				'ctr-success': '#008b4e',
				'ctr-warning': '#B45309',  // 유지 — proto #d0901e는 텍스트 AA 미달 (D17 bg/text 분리)
				'ctr-error': '#d73337',
				'ctr-info': '#0091b9',
				// Semantic backgrounds — proto -soft (warning-bg는 AA 4.51:1 위해 house 유지)
				'ctr-success-bg': '#d8f8e2',
				'ctr-warning-bg': '#FEF3C7',
				'ctr-error-bg': '#ffe6e1',
				'ctr-info-bg': '#bedded',  // Workday accent-soft-2 — oklch(88% 0.04 230)
				// Surface scale — Wave 0: proto cool-gray (hue 245)
				'ctr-surface': {
					DEFAULT: '#f1f4f7',
					low: '#eaeff4',
					high: '#dbe2e9',
					container: '#e3e9ee',
					dim: '#cdd6de',
					lowest: '#ffffff',
				},
				// Text colors — proto fg 계열
				'ctr-on-surface': '#182029',
				'ctr-on-surface-variant': '#515962',
				'ctr-outline': '#80878f',
				'ctr-outline-variant': '#d8dfe6',
			},
			fontFamily: {
				sans: [
					'Pretendard Variable', 'Pretendard',
					'-apple-system', 'BlinkMacSystemFont', 'system-ui',
					'Roboto', 'Helvetica Neue', 'Segoe UI',
					'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic',
					'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
					'sans-serif',
				],
				// Wave 0: Outfit 제거 — 프로토는 Pretendard + Geist Mono만 로드
				display: [
					'Pretendard Variable', 'Pretendard',
					'-apple-system', 'BlinkMacSystemFont', 'system-ui',
					'sans-serif',
				],
			},
			fontSize: {
				'2xs': ['0.6875rem', { lineHeight: '1.4' }],  // 11px — table headers
				'display-lg': ['3.5rem', { lineHeight: '1.1', fontWeight: '900' }],  // 56px — Hero KPI
				'display-sm': ['2rem', { lineHeight: '1.2', fontWeight: '500' }],    // 32px — Card KPI (Wave 0: proto .ss-val 32px/500, was 800)
			},
			letterSpacing: {
				'ctr': '-0.005em',  // Wave 0: proto body -0.005em (was -0.02em)
			},
			borderRadius: {
				'2xl': '0.875rem',       // Container (카드, 모달) — Wave 0: proto workday .card 14px (styles.css:1139)
				xl: '0.75rem',
				lg: 'var(--radius)',      // 0.5rem (8px) Element — HR Hub radius-sm 8px와 일치
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			boxShadow: {
				// Wave 0: proto shadow-card/pop — navy-tinted #1e2f41 (oklch 30% .04 250), 크기 등급은 기존과 동급
				'sm': '0 1px 2px rgba(30,47,65,0.04), 0 1px 0 rgba(30,47,65,0.02)',
				'md': '0 4px 12px rgba(30,47,65,0.08)',
				'lg': '0 4px 12px rgba(30,47,65,0.08), 0 20px 48px rgba(30,47,65,0.12)',
				// Phase 1 — Workday navy-tinted (was violet rgba(99,102,241) = #6366f1; now #004964)
				'primary-tinted': '0 20px 40px -5px rgba(0,73,100,0.06)',
				'primary-glow': '0 8px 24px rgba(0,73,100,0.20)',
			},
		}
	},
	plugins: [tailwindcssAnimate],
};
export default config;
