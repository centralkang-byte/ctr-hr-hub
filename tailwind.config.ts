// ═══════════════════════════════════════════════════════════════
// CTR HR Hub Design System — DESIGN.md 기준
// Last updated: 2026-04-10 (Phase 4 Batch 1: Violet palette + Outfit font)
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
				'surface-container-low': 'hsl(var(--surface-container-low))',
				'surface-container-high': 'hsl(var(--surface-container-high))',
				'surface-container': 'hsl(var(--surface-container))',

				// CTR 호환 토큰 (직접 hex — 레거시 페이지 호환용)
				'ctr-primary': '#6366f1',
				'ctr-primary-dark': '#4f46e5',
				'ctr-primary-light': '#a5b4fc',
				'ctr-secondary': '#64748b',
				// Semantic
				'ctr-success': '#16a34a',
				'ctr-warning': '#B45309',
				'ctr-error': '#e11d48',
				'ctr-info': '#6366f1',
				// Semantic backgrounds
				'ctr-success-bg': '#86efac',
				'ctr-warning-bg': '#FEF3C7',
				'ctr-error-bg': '#fb7185',
				'ctr-info-bg': '#a5b4fc',
				// Surface scale (Stitch Tonal Layering)
				'ctr-surface': {
					DEFAULT: '#f6f6f6',
					low: '#f0f1f1',
					high: '#e1e3e3',
					container: '#e7e8e8',
					dim: '#d2d5d5',
					lowest: '#ffffff',
				},
				// Text colors
				'ctr-on-surface': '#2d2f2f',
				'ctr-on-surface-variant': '#5a5c5c',
				'ctr-outline': '#757777',
				'ctr-outline-variant': '#acadad',
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
				display: [
					'var(--font-outfit)', 'Outfit',
					'Pretendard Variable', 'Pretendard',
					'-apple-system', 'BlinkMacSystemFont', 'system-ui',
					'sans-serif',
				],
			},
			fontSize: {
				'2xs': ['0.6875rem', { lineHeight: '1.4' }],  // 11px — table headers
				'display-lg': ['3.5rem', { lineHeight: '1.1', fontWeight: '900' }],  // 56px — Hero KPI
				'display-sm': ['2rem', { lineHeight: '1.2', fontWeight: '800' }],    // 32px — Card KPI
			},
			letterSpacing: {
				'ctr': '-0.02em',
			},
			borderRadius: {
				'2xl': '1rem',           // Container (카드, 모달)
				xl: '0.75rem',
				lg: 'var(--radius)',      // 0.5rem (8px) Element
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			boxShadow: {
				'sm': '0 1px 2px rgba(15,23,42,0.06)',
				'md': '0 4px 12px rgba(15,23,42,0.08)',
				'lg': '0 12px 32px rgba(15,23,42,0.12)',
				'primary-tinted': '0 20px 40px -5px rgba(99,102,241,0.06)',
				'primary-glow': '0 8px 24px rgba(99,102,241,0.20)',
			},
		}
	},
	plugins: [tailwindcssAnimate],
};
export default config;
