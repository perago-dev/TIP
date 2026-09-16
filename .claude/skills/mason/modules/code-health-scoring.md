# Mason Code Health Scoring

**CRITICAL:** Every commercial-mode report MUST score all five dimensions before AND after fixes. These are required fields in the handoff schema and the HTML report.

---

## The Five Dimensions

| Dimension | What It Measures |
|-----------|-----------------|
| **Security** | Injection vulnerabilities, credential handling, input validation, permission checks |
| **Governance** | Unit consumption patterns, search efficiency, record operation batching |
| **Documentation** | Script headers, @Updates log accuracy, JSDoc coverage, deployment metadata |
| **Maintainability** | Error handling, naming conventions, code structure, absence of anti-patterns |
| **Functionality** | Logic correctness, edge case handling, execution context filtering, event handling |

Dimensions are independent. A codebase can score 5 on Security and 1 on Documentation. The per-dimension view is the story — do not average them into a single number.

---

## Score Levels (1–5)

| Level | Name | Meaning |
|-------|------|---------|
| 1 | **Critical** | Active risk. Issues that will cause failures, data loss, or security exposure under real conditions. Not safe to run as-is. |
| 2 | **Weak** | Below standard. Problems that will surface under load, during upgrades, or when the team changes. |
| 3 | **Acceptable** | Meets minimum standards. No immediate risk, but identifiable gaps. |
| 4 | **Strong** | Above standard. Well-maintained with only minor improvements available. |
| 5 | **Exemplary** | Best practice. Serves as a reference. Nothing actionable. |

---

## Scoring Methodology

Score each dimension by assessing the ratio and severity of findings against total files audited.

### Step 1: Tally findings per dimension

From the review, count MUST/SHOULD/CONSIDER findings in each dimension:

```
Security:        MUST: __, SHOULD: __, CONSIDER: __
Governance:      MUST: __, SHOULD: __, CONSIDER: __
Documentation:   MUST: __, SHOULD: __, CONSIDER: __
Maintainability: MUST: __, SHOULD: __, CONSIDER: __
Functionality:   MUST: __, SHOULD: __, CONSIDER: __
```

### Step 2: Calculate weighted finding rate

For each dimension:

```
Weighted score = (MUST × 3) + (SHOULD × 1.5) + (CONSIDER × 0.5)
Rate = Weighted score ÷ Files audited
```

### Step 3: Map rate to level

| Rate     | Level           |
|----------|-----------------|
| > 3.0    | 1 — Critical    |
| ≥ 1.5    | 2 — Weak        |
| ≥ 0.75   | 3 — Acceptable  |
| ≥ 0.25   | 4 — Strong      |
| < 0.25   | 5 — Exemplary   |

_Read top-to-bottom: the first row that matches the rate wins._

### Step 4: Validate against characteristics

The calculated level must match the observed reality. Override the calculation if:
- A single MUST finding would cause production data loss or a security breach → floor at 1, regardless of rate
- Every file in a dimension has zero findings → set to 5

**Rule:** If a level cannot be determined (e.g., insufficient files to score), set to `null` and note the reason.

---

## Before and After Scoring

Score each dimension **twice**:

1. **Before** — at intake, before any fixes. This is the honest state of the codebase when Softype received it.
2. **After** — after all fixes are applied and tests written. This is the delivered state.

The before score is the problem statement. The after score is the proof of delivery. The delta is the value proposition.

**Rule:** The after score for any dimension where MUSTs existed must be at least 3 (Acceptable). If fixes don't bring the dimension to Acceptable or above, the engagement is not ready to deliver.

### Assessment Template

Include this in the handoff schema for every commercial engagement:

```
## Code Health Scores — [Client Name] — [Date]

| Dimension       | Before        | After         | Delta |
|-----------------|---------------|---------------|-------|
| Security        | __/5 [Level]  | __/5 [Level]  | +__   |
| Governance      | __/5 [Level]  | __/5 [Level]  | +__   |
| Documentation   | __/5 [Level]  | __/5 [Level]  | +__   |
| Maintainability | __/5 [Level]  | __/5 [Level]  | +__   |
| Functionality   | __/5 [Level]  | __/5 [Level]  | +__   |

Files audited: __
Total findings: __ MUST / __ SHOULD / __ CONSIDER
Findings fixed: __ / __ (all MUSTs and SHOULDs should be 100%)
Tests added: __

Assessment basis:
[2-3 sentences on the overall state before fixes — what was the dominant pattern of issues?]

Improvement summary:
[2-3 sentences on what was done — which dimensions improved most and why?]
```

---

## Dimension Scoring Reference

### Security (1–5)

| Level | Indicators |
|-------|-----------|
| 1 — Critical | Hardcoded credentials in code; `eval()` usage; unvalidated user input directly in searches; no permission checks on sensitive operations |
| 2 — Weak | Input validation present but incomplete; some sensitive data exposed in logs; credential access exists but is not hardcoded |
| 3 — Acceptable | All inputs validated; no hardcoded credentials; basic permission checks in place |
| 4 — Strong | Consistent validation; audit logging on sensitive operations; CSRF protection on Suitelets |
| 5 — Exemplary | Defense-in-depth; parameterized queries everywhere; security-first patterns throughout |

### Governance (1–5)

| Level | Indicators |
|-------|-----------|
| 1 — Critical | `record.load` or `record.save` inside loops; unbounded `search.run()` with no pagination; scripts that will hit governance limits on any real-world dataset |
| 2 — Weak | Some batching but inconsistent; governance checks missing before expensive operations; risk of failure under load |
| 3 — Acceptable | Governance checked before loops; search results limited or paginated |
| 4 — Strong | Proactive governance management; `getRemainingUsage()` patterns; efficient `submitFields` usage |
| 5 — Exemplary | Optimal unit consumption; `runPaged()` for large datasets; checkpointing in scheduled scripts |

### Documentation (1–5)

| Level | Indicators |
|-------|-----------|
| 1 — Critical | No script headers; no ownership information; `@Updates` log missing or inaccurate to the point of being misleading |
| 2 — Weak | Headers present but missing required fields (`@Author`, `@Dated`, `@DeployedOn`); `@Updates` inconsistent |
| 3 — Acceptable | Standard Softype header format; all required fields present |
| 4 — Strong | Complete headers; accurate `@Updates` log; complex logic commented |
| 5 — Exemplary | Exemplary update logs; clear history from v1.0; headers serve as living documentation |

### Maintainability (1–5)

| Level | Indicators |
|-------|-----------|
| 1 — Critical | Unhandled exceptions; `console.log` in server-side scripts; magic numbers; no error handling on external calls |
| 2 — Weak | Inconsistent error handling; some hardcoded values; mixed naming conventions; pervasive copy-paste (≥10-line blocks repeated 3+ times) or unreachable code throughout |
| 3 — Acceptable | Structured try/catch on risky operations; named constants; consistent style; only isolated duplication or commented-out/dead code |
| 4 — Strong | Comprehensive error handling; self-documenting code; modular structure; DRY with shared helpers |
| 5 — Exemplary | Every error logged with context; clean separation of concerns; easy for new developers to follow; no duplication or dead paths anywhere |

### Functionality (1–5)

| Level | Indicators |
|-------|-----------|
| 1 — Critical | Logic defects that will cause incorrect results; missing execution context filters causing scripts to run when they shouldn't; wrong event entry points |
| 2 — Weak | Edge cases unhandled (null/empty values); context filtering present but incomplete |
| 3 — Acceptable | Core logic correct; main edge cases handled; appropriate entry points |
| 4 — Strong | Thorough edge case coverage; accurate context filtering; defensive null handling |
| 5 — Exemplary | All paths tested; behavior matches specification exactly; no silent failure modes |
