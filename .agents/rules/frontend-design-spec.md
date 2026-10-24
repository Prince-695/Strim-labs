# STRIM Labs Frontend Design & Architectural Specification

## 1. Brand Identity & Visual Aesthetic
- **Visual Direction**: Minimal, polished, developer-first engineering instrument inspired by the restrained clarity of HackerRank and Wispr Flow. Calm, precise, modern, trustworthy, and fast.
- **Tone**: Professional, evidence-based, transparent. Avoid overproduced cyberpunk, neon overload, ubiquitous glassmorphism, decorative noise, or unmotivated animation.
- **Operational Honesty**: Distinguish observed symptoms (e.g. *HTTP 429 response surge at 850 RPS*) from qualified hypotheses (*Consistent with gateway rate limiting*). Never declare database pool exhaustion or root causes from latency alone without corresponding evidence.

## 2. Dual Light & Dark Theme System
All components MUST use semantic CSS variables, never hard-coded hex colors. The application supports System, Light, and Dark modes via `next-themes` with zero FOUC.

### Light Theme Tokens
- `--background`: `#F7F9F8` (quiet canvas)
- `--foreground`: `#101713` (deep readable text)
- `--surface`: `#FFFFFF` (cards, dialogs)
- `--surface-muted`: `#F0F4F1` (headers, secondary panels)
- `--border`: `#DDE5DF` (clean hairlines)
- `--brand`: `#00C968` (primary emerald accent)
- `--brand-strong`: `#008F4A` (hover / accessible text)
- `--brand-subtle`: `#E3F8EC` (selection highlights)
- `--ink`: `#0D141E` (deep contrast elements)
- `--text-muted`: `#647169`
- Semantic Status: `--success: #16834A`, `--warning: #A96500`, `--danger: #C9363E`, `--info: #2563A6`

### Curated Dark Theme Tokens
- `--background`: `#0B1015` (deep midnight slate)
- `--foreground`: `#E6ECE8` (clean, high-contrast light slate)
- `--surface`: `#121820` (elevated card surface)
- `--surface-muted`: `#18222D` (quiet table headers & panels)
- `--border`: `#202D3A` (restrained dark border)
- `--brand`: `#00E575` (high-visibility glowing emerald)
- `--brand-strong`: `#00C968`
- `--brand-subtle`: `#0A2818` (emerald glow tint)
- `--ink`: `#060A0E`
- `--text-muted`: `#88978E`
- Semantic Status: `--success: #22C55E`, `--warning: #F59E0B`, `--danger: #EF4444`, `--info: #38BDF8`

## 3. Product Principles & Evidence Over Theatre
- **Evidence Over Theatre**: NEVER display fabricated metrics, simulated curves, or placeholder numbers as real results. If a test has insufficient data, explicitly report *"Insufficient evidence to determine breaking point"*.
- **Tabular Numerals**: Always apply tabular numbers (`font-mono` or `font-feature-settings: 'tnum'`) on real-time metrics so dashboards never jump or jitter.

## 4. Testing Presets & Flow
Standardize on the 4 canonical starting presets with progressive disclosure:
1. **Smoke Probe**: 10 VUs · 10s · Sustained (basic sanity check)
2. **Capacity Ramp**: 50 VUs · 30s · Ramp-Up (identify latency knee)
3. **Spike Surge**: 150 VUs · 15s · Spike (burst absorption)
4. **Breaking Point Hunt**: 300 VUs · 45s · Ramp-Up (stress to saturation)
- Provide a built-in "Local Strim Health API (Safe Probe)" demo target so developers can test-drive the runner in 5 seconds.

## 5. Visual Capacity & Diagnosis
- **3-Zone Visual Capacity Spectrum Gauge**: Optimal Band (Green) → Saturation Knee (Amber) → Breaking Cliff (Red) with exact RPS markers.
- **Evidence-Based Diagnosis Card**: Clearly separate **Observed Facts** from **Qualified Hypotheses** and **Next Actionable Checks**.
- **In-Studio Regression Gate**: Default to ≤10% latency and ≤0.5% error tolerance with collapsible slider adjustment.

## 6. Route Architecture
- Public marketing and interactive guides live at `/` and `/how-it-works`.
- Documentation center lives at `/docs`.
- Authenticated console lives under `/app` (`/app`, `/app/runner`, `/app/tests/[id]`, `/app/compare`, `/app/settings`).
- Direct aliases/redirects from `/runner`, `/tests/[id]`, `/compare` to `/app/*`.
