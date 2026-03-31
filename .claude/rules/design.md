# Kinetic Atelier Design Token Rules

Full design system: see `DESIGN.md`. Below are mandatory checks when writing UI code.

## Color
- Pure black #000/#000000 forbidden → use on-surface (#2d2f2f)
- Primary: #4a40e0, Tertiary (Emerald): #006947
- Semantic: success=tertiary, error=#b41340, warning=#B45309, info=primary

## Typography
- font-display (Inter): English-only, text-4xl+ only. NEVER use for mixed Korean/English text
- font-mono: MUST accompany tabular-nums (never standalone)
- CJK: letter-spacing -0.02em, line-height 1.6+, base 14px

## Border & Elevation
- **No-Line Rule:** No 1px solid borders for section separation → use Tonal Layering
- Ghost Border: outline-variant (#acadad) at 15% opacity ONLY
- Shadow tokens: shadow-sm (card), shadow-md (dropdown), shadow-lg (modal)

## Border Radius (3 tiers only)
- Pill (rounded-full): CTA lg buttons, status badges, search bar
- Container (rounded-2xl): cards, modals, panels
- Element (rounded-lg): inputs, sm buttons

## Glassmorphism (2 locations only)
- TopBar: bg-white/80 backdrop-blur-md ✅
- Dialog/Sheet overlay: bg-white/70 backdrop-blur-[20px] ✅
- Everywhere else: ❌ FORBIDDEN

## Button
- lg: rounded-full + gradient (from-primary to-primary-dim) + shadow
- default: rounded-xl + bg-primary
- sm: rounded-lg + bg-primary (density protection)

## Spacing Density
- compact (p-4): payroll/attendance/audit tables
- comfortable (p-6, DEFAULT): employee list, leave, recruitment
- spacious (p-8): dashboard KPI, profile, onboarding

## Forbidden Patterns
- backdrop-blur outside TopBar/Dialog
- 1px solid borders for section separation
- Uniform border-radius (must use 3-tier system)
- Purple AI-slop gradients
