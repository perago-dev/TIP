# Script Header Standard

Every SuiteScript file at Softype must begin with a standardised header block. This ensures consistency across all client engagements, makes scripts auditable, and provides version history directly in the file.

## Required Header Tags

- `@NApiVersion` — always `2.1` for new scripts
- `@NScriptType` — the NetSuite script type (`UserEventScript`, `Suitelet`, `ScheduledScript`, `MapReduceScript`, `ClientScript`, `RESTlet`, etc.)
- `@NModuleScope` — always `SameAccount` unless cross-account sharing is explicitly required
- `@Author` — full name of the developer who created the script
- `@Dated` — creation date (e.g., `24th March 2026`)
- `@Version` — current version number in format X.Y (e.g., `1.0`, `1.10`)
- `@DeployedOn` — the NetSuite record type(s) or transaction(s) this script is deployed on (e.g., `Sales Order, Purchase Order`). For Suitelets with no record deployment, note `Standalone Suitelet page`. Makes it immediately clear where the script is active without opening the deployment record.
- `@Description` — concise plain-English description including: record types involved, key filters, data sources, and any known TODOs
- `@Updates` — chronological change log. Every version increment must include an entry describing what changed and why. Replaces scattered inline comments as the authoritative change history.

## Header Template

Copy and populate at the top of every new script file:

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType <ScriptType>
 * @NModuleScope SameAccount
 */
/*************************************************************
 ** Copyright (c) 1998-2025 Softype, Inc.
 ** 619/620, 6th Floor, Rajhans Helix 3, LBS Marg,
 ** Ghatkopar West, Mumbai, Maharashtra 400086.
 ** All Rights Reserved.
 **
 **@Author      :  <Full Name>
 **@Dated       :  <DD Month YYYY>
 **@Version     :  1.0
 **@DeployedOn  :  <Record Type(s) — e.g., Sales Order, Purchase Order>
 **@Description :  <Record type(s) affected>.
 **                <Brief description of what the script does.>
 **                Filters: <key filters if applicable>
 **                Data sources: <key data sources if applicable>
 **                Pending items (TODO): <open items or N/A>
 **
 **@Updates     :  v1.0 - Initial version.
 *************************************************************/
```

## Version & Updates Log Rules

- Start every new script at `v1.0`
- Increment the **minor** version (e.g., `1.0 → 1.1`) for bug fixes, logic corrections, or small enhancements
- Increment the **major** version (e.g., `1.x → 2.0`) for significant rewrites or major feature additions
- Each `@Updates` entry must include: version number, function(s) changed, what was changed, and why (e.g., root cause of a bug fix, business requirement driving a change)
- **Never delete old `@Updates` entries** — the full history must be preserved in the file header
- Remove diagnostic/temporary log statements added during debugging before committing — note their removal in the `@Updates` log

## Real-World Example

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
/*************************************************************
 **@Author      :  Jignesh S
 **@Dated       :  24th March 2026
 **@Version     :  1.10
 **@DeployedOn  :  Suitelet (standalone page — no record deployment)
 **@Description :  Program Profitability — Revenue & GP Charts.
 **                Renders a Suitelet with 3 chart views:
 **                  (1) Revenue  (2) Gross Profit  (3) Rev & GP
 **                Filters: Date Level, Date Range, Subsidiary,
 **                Program, + 4 checkboxes (Shipping, RMAs,
 **                VRAs, Repairs). All default to true.
 **                Pending items (TODO): VRA transaction type.
 **
 **@Updates     :  v1.0  - Initial version.
 **                v1.1  - fetchForecastRevenue: switched to
 **                        unfulfilled qty × rate; date bucketing
 **                        moved to t.trandate.
 **                v1.10 - Replaced unbounded unit-cost formula
 **                        with coverage-capped blended rate.
 **                        Removed all DIAG log statements.
 *************************************************************/
```

## Why This Matters

A well-maintained `@Updates` log eliminates the need to dig through Git history or ask colleagues about past changes. It is the first place a reviewer or future developer looks when a script behaves unexpectedly.

The `@DeployedOn` tag is particularly valuable — it makes it immediately clear where a script is active without opening the deployment record in NetSuite Setup > Scripting.

## See Also

- `naming-conventions.md` - File naming and script ID standards
- `documentation.md` - Full JSDoc standards for functions
- `../review/pre-release-checklist.md` - Header completeness checklist items
