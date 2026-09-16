# Mason HTML Report Style Guide

This file is the single source of truth for Mason's client-facing HTML report. Use it when the user asks for a Mason report in HTML format, or when completing a commercial-mode audit.

## Design Principles

- **Dark, polished, Softype-branded** — `st-dark st-polished` on `<html>`, tangerine accent
- **Completion-focused** — the report proves work done, not a list of problems to solve
- **Plain English first** — every finding leads with a layperson headline and two plain-English sentences; the code is the proof, not the story
- **Before → After** — dimension scores are always shown as pairs; the delta is the value proposition
- **Self-contained** — the generated HTML embeds all CSS; no external dependencies except Google Fonts and Highlight.js CDN

## Report Structure

```
Nav (sticky): Executive Summary | Security | Governance | Documentation | Maintainability | Functionality | Fixes Applied | Deploy
Hero:         Company name · date · stats pill row
Tab content:  [Executive Summary]  [5 × dimension]  [Fixes Applied]  [Deploy]
Footer:       Softype branding
```

### Tab: Executive Summary
- 5 dimension score cards in a grid — each shows before level → after level
- Stats row: Files Audited · Issues Found · Issues Fixed · Tests Added
- Critical findings banner (if any MUST findings existed — shown even though fixed)

### Tab: Each Dimension (5 tabs)
- Dimension name + score transformation: "Governance: Critical → Strong"
- Two score rings side by side (before, after)
- Finding cards below — ordered MUST first, then SHOULD, then CONSIDER
- Each card: ID badge + severity badge + headline + plain English + before/after code

### Tab: Fixes Applied
- Complete flat list of every finding across all dimensions
- Finding ID, dimension chip, severity badge, headline, file, status ✓ Fixed
- No code here — link text only; full detail is in the dimension tabs

### Tab: Deploy
- "The code is fixed and tested. One step remaining."
- Branch name, files changed, tests added
- Deployment risk level + estimated hours
- CTA: contact info

---

## Complete HTML Template

Fill in all `[PLACEHOLDER]` values and repeat section patterns for each dimension and finding.

```html
<!DOCTYPE html>
<html lang="en" class="st-dark st-polished">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mason Code Review — [CLIENT_NAME]</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>
    /* ── Softype tokens ──────────────────────────────────────────────────── */
    :root {
      --st-tangerine: #e46b1f;
      --st-tangerine-dim: rgba(228,107,31,0.15);
      --st-tangerine-glow: rgba(228,107,31,0.35);
      --st-success: #34c759;
      --st-warning: #f59e0b;
      --st-danger: #ef4444;
      --st-font: 'Manrope', Arial, sans-serif;
      --st-font-display: 'Familjen Grotesk', 'Manrope', Arial, sans-serif;
      --st-font-mono: 'JetBrains Mono', Consolas, monospace;
      --st-space-2: 8px; --st-space-3: 12px; --st-space-4: 16px;
      --st-space-6: 24px; --st-space-8: 32px; --st-space-12: 48px;
      --st-radius: 8px; --st-radius-lg: 12px; --st-radius-full: 9999px;
      /* Dark theme */
      --bg: #0a0a0f; --surface: #1a1a24; --surface-raised: #222230;
      --border: rgba(255,255,255,0.08); --border-subtle: rgba(255,255,255,0.04);
      --text: #f5f5f7; --text-2: #a1a1a6; --text-muted: #6e6e73;
      /* Level colors — monotone Critical→Exemplary ramp */
      --color-critical:   #ef4444;
      --color-weak:       #f97316;
      --color-acceptable: #f59e0b;
      --color-strong:     #84cc16;
      --color-exemplary:  #34c759;
    }

    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; font-family: var(--st-font); background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
    h1,h2,h3,h4 { font-family: var(--st-font-display); margin: 0 0 var(--st-space-4); line-height: 1.2; }
    p { color: var(--text-2); margin: 0 0 var(--st-space-4); }
    code { font-family: var(--st-font-mono); font-size: 0.85em; }

    /* ── Nav ─────────────────────────────────────────────────────────────── */
    .nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(10,10,15,0.95); backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      display: flex; overflow-x: auto; padding: 0 var(--st-space-8);
      scrollbar-width: none;
    }
    .nav::-webkit-scrollbar { display: none; }
    .nav-btn {
      flex-shrink: 0; padding: 16px 20px;
      background: none; border: none; border-bottom: 2px solid transparent;
      color: var(--text-muted); font-family: var(--st-font); font-size: 0.8125rem;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
      cursor: pointer; white-space: nowrap;
      transition: color 150ms, border-color 150ms;
    }
    .nav-btn:hover { color: var(--text-2); }
    .nav-btn.active { color: var(--st-tangerine); border-bottom-color: var(--st-tangerine); }

    /* ── Layout ──────────────────────────────────────────────────────────── */
    .wrap { max-width: 1100px; margin: 0 auto; padding: 0 var(--st-space-8) var(--st-space-12); }
    .tab-panel { display: none; padding-top: var(--st-space-12); }
    .tab-panel.active { display: block; animation: fadeUp 0.3s ease; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    /* ── Hero ────────────────────────────────────────────────────────────── */
    .hero {
      text-align: center; padding: var(--st-space-12) var(--st-space-8) var(--st-space-8);
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(228,107,31,0.08), transparent);
      border-bottom: 1px solid var(--border);
    }
    .hero-eyebrow {
      display: inline-block; padding: 4px 14px; border-radius: var(--st-radius-full);
      background: var(--st-tangerine-dim); color: var(--st-tangerine);
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: var(--st-space-4);
    }
    .hero h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: var(--st-space-2); }
    .hero-sub { color: var(--text-muted); font-size: 0.9375rem; margin-bottom: var(--st-space-8); }
    .hero-stats {
      display: inline-flex; gap: 0; border: 1px solid var(--border);
      border-radius: var(--st-radius-lg); overflow: hidden;
    }
    .hero-stat {
      padding: var(--st-space-3) var(--st-space-6);
      border-right: 1px solid var(--border); text-align: center;
    }
    .hero-stat:last-child { border-right: none; }
    .hero-stat .val { font-family: var(--st-font-display); font-size: 1.5rem; font-weight: 700; color: var(--st-tangerine); }
    .hero-stat .lbl { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-top: 2px; }

    /* ── Dimension overview cards ─────────────────────────────────────────── */
    .dim-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--st-space-4); margin: var(--st-space-8) 0; }
    .dim-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--st-radius-lg); padding: var(--st-space-4);
      text-align: center;
      transition: transform 150ms, box-shadow 150ms;
    }
    .dim-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .dim-card .dim-name { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: var(--st-space-4); }
    .dim-transform { display: flex; align-items: center; justify-content: center; gap: var(--st-space-3); margin-bottom: var(--st-space-3); }
    .dim-score { display: flex; flex-direction: column; align-items: center; }
    .dim-num { font-family: var(--st-font-display); font-size: 1.75rem; font-weight: 700; line-height: 1; }
    .dim-level { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
    .dim-arrow { color: var(--text-muted); font-size: 1.1rem; }
    .dim-delta {
      display: inline-block; padding: 2px 8px; border-radius: var(--st-radius-full);
      font-size: 0.7rem; font-weight: 700; background: rgba(52,199,89,0.15); color: var(--st-success);
    }

    /* Level color helpers */
    .lvl-1 { color: #ef4444; }
    .lvl-2 { color: #f97316; }
    .lvl-3 { color: #f59e0b; }
    .lvl-4 { color: #e46b1f; }
    .lvl-5 { color: #34c759; }

    /* ── Score rings (dimension tabs) ────────────────────────────────────── */
    .rings-row { display: flex; align-items: center; gap: var(--st-space-8); margin: var(--st-space-8) 0; }
    .ring-block { text-align: center; }
    .ring-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: var(--st-space-3); }
    .ring-svg { position: relative; display: inline-block; }
    .ring-svg svg { transform: rotate(-90deg); display: block; }
    .ring-svg circle { fill: none; stroke-width: 10; }
    .ring-svg .ring-bg { stroke: var(--border); }
    .ring-val {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      text-align: center; pointer-events: none;
    }
    .ring-val .num { font-family: var(--st-font-display); font-size: 2rem; font-weight: 700; line-height: 1; }
    .ring-val .sub { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-top: 2px; }
    .ring-name { font-size: 0.875rem; font-weight: 600; margin-top: var(--st-space-3); }
    .rings-arrow { font-size: 2rem; color: var(--text-muted); }
    .rings-summary { flex: 1; }
    .rings-summary h3 { font-size: 1.5rem; margin-bottom: var(--st-space-3); }

    /* Ring stroke-dasharray = circumference of r=54 = 339 */
    /* stroke-dashoffset = 339 * (1 - level/5) */
    /* Level 1: 271 | Level 2: 203 | Level 3: 136 | Level 4: 68 | Level 5: 0 */

    /* ── Finding cards ───────────────────────────────────────────────────── */
    .findings-section { margin-top: var(--st-space-12); }
    .findings-section h3 { font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: var(--st-space-6); padding-bottom: var(--st-space-3); border-bottom: 1px solid var(--border); }

    .finding-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--st-radius-lg); margin-bottom: var(--st-space-6);
      overflow: hidden;
    }
    .finding-card.sev-must { border-left: 3px solid #ef4444; }
    .finding-card.sev-should { border-left: 3px solid #f59e0b; }
    .finding-card.sev-consider { border-left: 3px solid #3b82f6; }

    .finding-head {
      padding: var(--st-space-4) var(--st-space-6);
      border-bottom: 1px solid var(--border-subtle);
      display: flex; align-items: flex-start; gap: var(--st-space-3); flex-wrap: wrap;
    }
    .finding-head h4 { flex: 1; min-width: 0; font-size: 1rem; font-weight: 600; margin: 0; color: var(--text); }

    .finding-body { padding: var(--st-space-6); }
    .finding-plain { margin-bottom: var(--st-space-6); }
    .finding-plain .prob-label, .finding-plain .fix-label {
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      margin-bottom: var(--st-space-2);
    }
    .finding-plain .prob-label { color: #ef4444; }
    .finding-plain .fix-label { color: var(--st-success); margin-top: var(--st-space-4); }
    .finding-plain p { font-size: 0.9375rem; line-height: 1.6; color: var(--text); margin: 0; }

    /* ── Before / After code comparison ──────────────────────────────────── */
    .code-compare {
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--st-space-4); margin-top: var(--st-space-6);
    }
    @media (max-width: 700px) { .code-compare { grid-template-columns: 1fr; } }

    .code-panel { border-radius: var(--st-radius); overflow: hidden; }
    .code-panel-before { border: 1px solid rgba(239,68,68,0.25); }
    .code-panel-after  { border: 1px solid rgba(52,199,89,0.25); }

    .code-panel-label {
      padding: var(--st-space-2) var(--st-space-4);
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      display: flex; align-items: center; gap: var(--st-space-2);
    }
    .code-panel-before .code-panel-label { background: rgba(239,68,68,0.12); color: #ef4444; }
    .code-panel-after  .code-panel-label { background: rgba(52,199,89,0.12); color: var(--st-success); }

    .code-plain {
      padding: var(--st-space-3) var(--st-space-4);
      font-size: 0.875rem; line-height: 1.55; color: var(--text-2);
    }
    .code-panel-before .code-plain { background: rgba(239,68,68,0.05); }
    .code-panel-after  .code-plain { background: rgba(52,199,89,0.05); }

    .code-panel pre { margin: 0; font-size: 0.8125rem; }
    .code-panel pre code { border-radius: 0; }

    .tests-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: var(--st-radius-full);
      background: rgba(52,199,89,0.15); color: var(--st-success);
      font-size: 0.75rem; font-weight: 600; margin-top: var(--st-space-4);
    }

    /* ── Badges ──────────────────────────────────────────────────────────── */
    .badge {
      display: inline-flex; align-items: center; padding: 2px 10px;
      font-size: 0.7rem; font-weight: 700; border-radius: var(--st-radius-full);
      text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;
    }
    .badge-must     { background: rgba(239,68,68,0.15);  color: #ef4444; }
    .badge-should   { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge-consider { background: rgba(59,130,246,0.15); color: #3b82f6; }
    .badge-fixed    { background: rgba(52,199,89,0.15);  color: var(--st-success); }
    .badge-dim      { background: var(--surface-raised); color: var(--text-2); }

    /* ── Fixes tab ───────────────────────────────────────────────────────── */
    .fix-row {
      display: flex; align-items: center; gap: var(--st-space-4); flex-wrap: wrap;
      padding: var(--st-space-4) var(--st-space-6);
      border-bottom: 1px solid var(--border-subtle);
    }
    .fix-row:last-child { border-bottom: none; }
    .fix-id { font-family: var(--st-font-mono); font-size: 0.8125rem; color: var(--text-muted); min-width: 56px; }
    .fix-headline { flex: 1; min-width: 0; font-size: 0.9rem; color: var(--text); }
    .fix-file { font-family: var(--st-font-mono); font-size: 0.75rem; color: var(--text-muted); }

    /* ── Deploy tab ──────────────────────────────────────────────────────── */
    .deploy-hero {
      text-align: center; padding: var(--st-space-12) var(--st-space-8);
      background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(52,199,89,0.08), transparent);
      border-radius: var(--st-radius-lg); margin-bottom: var(--st-space-8);
    }
    .deploy-hero .tick { font-size: 3rem; margin-bottom: var(--st-space-4); }
    .deploy-hero h2 { font-size: 1.875rem; margin-bottom: var(--st-space-3); }
    .deploy-hero p { font-size: 1rem; max-width: 540px; margin: 0 auto; }

    .deploy-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--st-space-4); margin: var(--st-space-8) 0; }
    .deploy-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--st-radius-lg); padding: var(--st-space-6); }
    .deploy-card .dc-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: var(--st-space-2); }
    .deploy-card .dc-val { font-family: var(--st-font-display); font-size: 1.5rem; font-weight: 700; color: var(--text); }
    .deploy-card .dc-sub { font-size: 0.8125rem; color: var(--text-muted); margin-top: 4px; }

    .deploy-cta { text-align: center; margin-top: var(--st-space-12); }
    .deploy-cta h3 { margin-bottom: var(--st-space-3); }
    .deploy-cta p { margin-bottom: var(--st-space-6); }
    .cta-btn {
      display: inline-flex; align-items: center; gap: var(--st-space-2);
      padding: var(--st-space-4) var(--st-space-8);
      background: var(--st-tangerine); color: white;
      border: none; border-radius: var(--st-radius-full);
      font-family: var(--st-font); font-size: 1rem; font-weight: 700; cursor: pointer;
      transition: box-shadow 150ms, transform 150ms;
    }
    .cta-btn:hover { box-shadow: 0 4px 16px var(--st-tangerine-glow); transform: translateY(-1px); }

    /* ── Footer ──────────────────────────────────────────────────────────── */
    .footer {
      margin-top: var(--st-space-12); padding: var(--st-space-8);
      border-top: 1px solid var(--border); text-align: center;
    }
    .footer p { font-size: 0.8125rem; color: var(--text-muted); margin: 0; line-height: 2; }

    /* ── Print ───────────────────────────────────────────────────────────── */
    @media print {
      .nav { display: none; }
      .tab-panel { display: block !important; page-break-before: always; break-before: page; }
      .tab-panel:first-of-type { page-break-before: auto; }
      .hero { background: none; }
      .dim-card, .finding-card, .deploy-card { box-shadow: none; border: 1pt solid #e5e5e4; }
      .code-compare { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <!-- ── Nav ──────────────────────────────────────────────────────────────── -->
  <nav class="nav">
    <button class="nav-btn active" onclick="showTab('exec', this)">Executive Summary</button>
    <button class="nav-btn" onclick="showTab('security', this)">Security</button>
    <button class="nav-btn" onclick="showTab('governance', this)">Governance</button>
    <button class="nav-btn" onclick="showTab('documentation', this)">Documentation</button>
    <button class="nav-btn" onclick="showTab('maintainability', this)">Maintainability</button>
    <button class="nav-btn" onclick="showTab('functionality', this)">Functionality</button>
    <button class="nav-btn" onclick="showTab('fixes', this)">Fixes Applied</button>
    <button class="nav-btn" onclick="showTab('deploy', this)">Deploy</button>
  </nav>

  <!-- ── Hero ─────────────────────────────────────────────────────────────── -->
  <header class="hero">
    <div class="hero-eyebrow">Softype · Mason Code Review</div>
    <h1>[CLIENT_NAME]</h1>
    <p class="hero-sub">SuiteScript Audit · [DATE]</p>
    <div class="hero-stats">
      <div class="hero-stat">
        <div class="val">[FILES_AUDITED]</div>
        <div class="lbl">Files Audited</div>
      </div>
      <div class="hero-stat">
        <div class="val">[TOTAL_FINDINGS]</div>
        <div class="lbl">Issues Found</div>
      </div>
      <div class="hero-stat">
        <div class="val">[FINDINGS_FIXED]</div>
        <div class="lbl">Issues Fixed</div>
      </div>
      <div class="hero-stat">
        <div class="val">[TESTS_ADDED]</div>
        <div class="lbl">Tests Added</div>
      </div>
    </div>
  </header>

  <div class="wrap">

    <!-- ══════════════════════════════════════════════════════════════════════
         TAB: EXECUTIVE SUMMARY
    ══════════════════════════════════════════════════════════════════════════ -->
    <section id="tab-exec" class="tab-panel active">
      <h2>Code Health — Before &amp; After</h2>
      <p style="max-width:620px">Every issue found has been fixed and tested. The scores below show the state of the codebase when Softype received it (left) and the state it is in now (right). The fixes are on a branch, ready to deploy.</p>

      <div class="dim-grid">
        <!-- Repeat this block for each dimension -->
        <div class="dim-card">
          <div class="dim-name">Security</div>
          <div class="dim-transform">
            <div class="dim-score">
              <div class="dim-num lvl-[BEFORE_LEVEL_NUM]">[BEFORE_NUM]</div>
              <div class="dim-level lvl-[BEFORE_LEVEL_NUM]">[BEFORE_LEVEL_NAME]</div>
            </div>
            <div class="dim-arrow">→</div>
            <div class="dim-score">
              <div class="dim-num lvl-[AFTER_LEVEL_NUM]">[AFTER_NUM]</div>
              <div class="dim-level lvl-[AFTER_LEVEL_NUM]">[AFTER_LEVEL_NAME]</div>
            </div>
          </div>
          <div class="dim-delta">+[DELTA]</div>
        </div>
        <!-- ... repeat for Governance, Documentation, Maintainability, Functionality ... -->
      </div>

      <!-- Critical findings banner — show even if fixed, to tell the story -->
      <!-- Only include this block if MUST findings existed -->
      <div class="finding-card sev-must" style="margin-top: var(--st-space-8)">
        <div class="finding-head">
          <span class="badge badge-must">Critical · Fixed</span>
          <h4>[WORST_FINDING_HEADLINE]</h4>
        </div>
        <div class="finding-body">
          <p>[1-2 sentences on why this was the most important finding and what was done about it. Written for an executive, not a developer.]</p>
        </div>
      </div>
    </section>


    <!-- ══════════════════════════════════════════════════════════════════════
         TAB: DIMENSION (repeat for all 5)
         Example shows Governance — replicate structure for each dimension.
    ══════════════════════════════════════════════════════════════════════════ -->
    <section id="tab-governance" class="tab-panel">

      <div class="rings-row">
        <!-- Before ring -->
        <div class="ring-block">
          <div class="ring-label">Before</div>
          <div class="ring-svg">
            <!-- r=54, circumference=339. dashoffset = 339*(1-level/5) -->
            <!-- Level 1:271 | Level 2:203 | Level 3:136 | Level 4:68 | Level 5:0 -->
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle class="ring-bg" cx="65" cy="65" r="54"/>
              <circle class="ring-progress" cx="65" cy="65" r="54"
                stroke="[BEFORE_LEVEL_COLOR]"
                stroke-dasharray="339"
                stroke-dashoffset="[BEFORE_OFFSET]"
                stroke-linecap="round"/>
            </svg>
            <div class="ring-val">
              <div class="num lvl-[BEFORE_N]">[BEFORE_N]</div>
              <div class="sub">/ 5</div>
            </div>
          </div>
          <div class="ring-name lvl-[BEFORE_N]">[BEFORE_LEVEL_NAME]</div>
        </div>

        <div class="rings-arrow">→</div>

        <!-- After ring -->
        <div class="ring-block">
          <div class="ring-label">After</div>
          <div class="ring-svg">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle class="ring-bg" cx="65" cy="65" r="54"/>
              <circle class="ring-progress" cx="65" cy="65" r="54"
                stroke="[AFTER_LEVEL_COLOR]"
                stroke-dasharray="339"
                stroke-dashoffset="[AFTER_OFFSET]"
                stroke-linecap="round"/>
            </svg>
            <div class="ring-val">
              <div class="num lvl-[AFTER_N]">[AFTER_N]</div>
              <div class="sub">/ 5</div>
            </div>
          </div>
          <div class="ring-name lvl-[AFTER_N]">[AFTER_LEVEL_NAME]</div>
        </div>

        <div class="rings-summary">
          <h3>Governance: [BEFORE_LEVEL_NAME] → [AFTER_LEVEL_NAME]</h3>
          <p>[2 sentences: what the before state was like and what the main improvement was. Plain English. No jargon.]</p>
        </div>
      </div>

      <!-- Findings for this dimension — MUST first, then SHOULD, then CONSIDER -->
      <div class="findings-section">
        <h3>[MUST_COUNT] Critical · [SHOULD_COUNT] Should Fix · [CONSIDER_COUNT] Consider</h3>

        <!-- Finding card — repeat for each finding in this dimension -->
        <div class="finding-card sev-must">
          <div class="finding-head">
            <span class="badge badge-dim">M-001</span>
            <span class="badge badge-must">Must Fix · Fixed ✓</span>
            <h4>[FINDING_HEADLINE]</h4>
          </div>
          <div class="finding-body">
            <div class="finding-plain">
              <div class="prob-label">⚠ What was wrong</div>
              <p>[1-2 sentences. Explain the business impact, not the technical detail. Example: "This script loaded a full database record for each inventory item in sequence. On any receipt with more than 50 lines, it would exhaust NetSuite's processing limit and stop mid-run, leaving the transaction in an incomplete state."]</p>
              <div class="fix-label">✓ What we did</div>
              <p>[1-2 sentences. Explain the fix in plain terms. Example: "We rewrote the lookup to fetch all required data in a single query. The script now processes any volume without hitting system limits, and we added three test cases to confirm it handles large orders correctly."]</p>
            </div>

            <div class="code-compare">
              <div class="code-panel code-panel-before">
                <div class="code-panel-label">⚠ Before</div>
                <div class="code-plain">[BRIEF_PLAIN_CONTEXT — optional, omit if headline is sufficient]</div>
                <pre><code class="language-javascript">[BEFORE_CODE_SNIPPET]</code></pre>
              </div>
              <div class="code-panel code-panel-after">
                <div class="code-panel-label">✓ After</div>
                <div class="code-plain">[BRIEF_PLAIN_CONTEXT — optional]</div>
                <pre><code class="language-javascript">[AFTER_CODE_SNIPPET]</code></pre>
              </div>
            </div>

            <div class="tests-badge">✓ [N] test case[s] added</div>
          </div>
        </div>
        <!-- end finding card -->

      </div>
    </section>
    <!-- end dimension tab — replicate for Security, Documentation, Maintainability, Functionality -->


    <!-- ══════════════════════════════════════════════════════════════════════
         TAB: FIXES APPLIED
    ══════════════════════════════════════════════════════════════════════════ -->
    <section id="tab-fixes" class="tab-panel">
      <h2>All Fixes — [TOTAL_FINDINGS] Issues Resolved</h2>
      <p>[CLIENT_NAME]'s SuiteScript layer had [TOTAL_FINDINGS] issues across [FILES_CHANGED] files. Every issue has been fixed. The branch is ready to deploy.</p>

      <div class="finding-card" style="margin-top: var(--st-space-8)">
        <!-- One row per finding, all dimensions mixed, ordered by severity -->
        <div class="fix-row">
          <div class="fix-id">M-001</div>
          <span class="badge badge-must">Must</span>
          <span class="badge badge-dim">Governance</span>
          <div class="fix-headline">[FINDING_HEADLINE]</div>
          <div class="fix-file">[FILENAME]</div>
          <span class="badge badge-fixed">Fixed ✓</span>
        </div>
        <!-- repeat for each finding -->
      </div>
    </section>


    <!-- ══════════════════════════════════════════════════════════════════════
         TAB: DEPLOY
    ══════════════════════════════════════════════════════════════════════════ -->
    <section id="tab-deploy" class="tab-panel">

      <div class="deploy-hero">
        <div class="tick">✓</div>
        <h2>The code is fixed and tested.</h2>
        <p>Every issue has been resolved. [TESTS_ADDED] test cases confirm the fixes hold. The branch is sitting ready — deploying it is the only step remaining.</p>
      </div>

      <div class="deploy-grid">
        <div class="deploy-card">
          <div class="dc-label">Branch</div>
          <div class="dc-val" style="font-family: var(--st-font-mono); font-size: 1rem">[BRANCH_NAME]</div>
          <div class="dc-sub">[FILES_CHANGED] files · [TESTS_ADDED] tests</div>
        </div>
        <div class="deploy-card">
          <div class="dc-label">Deployment Estimate</div>
          <div class="dc-val">[DEPLOY_HOURS] hrs</div>
          <div class="dc-sub">Risk: [RISK_LEVEL]</div>
        </div>
        <div class="deploy-card">
          <div class="dc-label">Audit Fee</div>
          <div class="dc-val">$2,000</div>
          <div class="dc-sub">Credited if you sign the deployment</div>
        </div>
      </div>

      <!-- Deploy notes if any -->
      <!-- <div class="finding-card" style="margin-bottom: var(--st-space-6)">
        <div class="finding-head"><h4>Deployment Notes</h4></div>
        <div class="finding-body"><p>[Any sequencing, sandbox testing, or rollout notes for the deployment team.]</p></div>
      </div> -->

      <div class="deploy-cta">
        <h3>Ready to ship</h3>
        <p>Sign the deployment engagement and Softype will schedule, test, and deploy these fixes to your production instance.</p>
        <a class="cta-btn" href="mailto:info@softype.com">Contact Softype to Deploy →</a>
      </div>

    </section>

  </div><!-- /wrap -->

  <footer class="footer">
    <p>Mason Code Review · Softype, Inc. · Confidential</p>
    <p>info@softype.com · www.softype.com</p>
    <p style="margin-top: var(--st-space-4)">San Francisco · Cebu · Mumbai · Nairobi</p>
  </footer>

  <script>
    function showTab(id, btn) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + id).classList.add('active');
      btn.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    document.addEventListener('DOMContentLoaded', () => hljs.highlightAll());
  </script>

</body>
</html>
```

---

## Ring Dashoffset Reference

Score rings use `r=54`, circumference ≈ 339. `stroke-dashoffset = 339 × (1 − level/5)`.

| Level | Name | Offset | Color |
|-------|------|--------|-------|
| 1 | Critical | 271 | `#ef4444` |
| 2 | Weak | 203 | `#f97316` |
| 3 | Acceptable | 136 | `#f59e0b` |
| 4 | Strong | 68 | `#e46b1f` |
| 5 | Exemplary | 0 | `#34c759` |

---

## Code Snippet Guidelines

Before/after code snippets should be:
- **Short** — 5–15 lines maximum. Show the problem, not the whole file.
- **Self-contained** — readable without context. Add a comment line if needed.
- **Contrasting** — the difference between before and after should be obvious at a glance.

The plain English explanation does the explaining. The code is the proof.

### Example: Good contrast

```javascript
// Before — record.load inside a loop
items.forEach(function(itemId) {
    var rec = record.load({ type: 'inventoryitem', id: itemId });
    total += rec.getValue('cost');
});

// After — single search fetches all at once
var costs = search.create({ type: 'inventoryitem',
    filters: [['internalid', 'anyof', itemIds]],
    columns: ['cost']
}).run().getRange({ start: 0, end: itemIds.length });
```

The before/after contrast is immediately obvious. A non-developer can see that "fewer lines = simpler" even without understanding the code.

---

## Filename Convention

```
[ClientName]_Mason_CodeReview_[YYYY-MM-DD].html
```

Example: `Fictiv_Mason_CodeReview_2026-05-25.html`
