# Pre-Release Checklist

Use this checklist before marking any script as **Released** in production. This is distinct from the code review checklist — it's the final gate before go-live.

## Code Quality

- [ ] All unused module imports removed from `define([])`
- [ ] All commented-out code removed (use SDF/Git for history)
- [ ] All unused variables and methods removed
- [ ] No unreachable code (statements after `return`/`throw`/`break`, always-false branches, never-called private functions)
- [ ] No duplicated logic — a ≥10-line block repeated 3+ times is extracted to a shared function
- [ ] No empty exported functions (empty `beforeSubmit`, `afterSubmit` stubs)
- [ ] `const`/`let` used exclusively — no `var`
- [ ] File name follows `Softype_<ScriptType>_<Record>_<Purpose>.js` pattern
- [ ] Script ID (`customscript_...`) mirrors the filename in snake_case
- [ ] Deployment ID (`customdeploy_...`) follows the naming convention

## Constants & Configuration

- [ ] No hardcoded field IDs, script IDs, template IDs, or magic numbers in script logic
- [ ] All static constants defined in `[client]_constants.js`
- [ ] Deployment-specific or admin-tunable values use Script Parameters
- [ ] Environment-specific values (API URLs, credentials, env IDs) use custom config records
- [ ] `N/url` used for URL generation — no hardcoded URLs
- [ ] No credentials or tokens stored in Script Parameters — use custom record with restricted access

## Performance

- [ ] No `record.load()` inside loops
- [ ] No `search.create()` or search calls inside loops
- [ ] `search.lookupFields()` used instead of `record.load()` where only reading fields
- [ ] No duplicate `search.lookupFields()` calls for the same record in the same scope
- [ ] N×M loop anti-patterns replaced with Map-based lookups
- [ ] Null check present after every `record.load()` call

## Error Handling & Logging

- [ ] All entry points wrapped in `try/catch`
- [ ] Error logs include record type and internal ID context
- [ ] Structured error format used: `{ code, message, meta }`
- [ ] `console.error()` used in catch blocks (Client Scripts)
- [ ] All `log.debug()` statements removed or reduced to essential diagnostics
- [ ] No `log.debug` with `JSON.stringify` inside loops
- [ ] `[client]_logger.js` used for all logging

## Documentation (Header)

- [ ] `@NApiVersion`, `@NScriptType`, `@NModuleScope` declared
- [ ] `@Author`, `@Dated`, `@Version`, `@DeployedOn`, `@Description` present in file header
- [ ] `@DeployedOn` lists all record types / transactions the script is deployed on
- [ ] All entry point functions have JSDoc with `@param` and `@return` tags
- [ ] Deployment priority documented in script notes

## Deployment

- [ ] Execution context filter applied — only necessary contexts enabled
- [ ] Script Parameters used instead of hardcoded config values
- [ ] SDF object script IDs validated for correct naming convention (underscores between all segments)
- [ ] `suitecloud account:validate` run before deploying SDF projects

## Script-Type-Specific

- [ ] No `search.lookupFields` or `record.load` inside `fieldChanged` handlers (Client Script)
- [ ] `currentRecord.getValue()` used in Client Scripts — no `record.load()` on current record
- [ ] `beforeLoad` checks `context.type` before heavy data fetching (User Event)
- [ ] `afterSubmit` used for downstream record creation, not `beforeSubmit` (User Event)
- [ ] Map/Reduce dry run mode implemented via Script Parameter
- [ ] Map/Reduce `summarize` stage sends completion email or logs counts (processed / skipped / errored)

## Multi-Subsidiary (OneWorld accounts only)

- [ ] All searches filtered by subsidiary
- [ ] No hardcoded subsidiary IDs — Script Parameters used

## Testing & Security

- [ ] Tested in Sandbox — not developed directly in Production
- [ ] Test scenarios documented alongside the script
- [ ] Suitelet audience/role access verified before releasing

## Code Review

- [ ] Script peer-reviewed by a second developer before marking Released
- [ ] Author is NOT the sole reviewer of their own work

## See Also

- `checklist.md` - Code review checklist (pre-review, not pre-release)
- `../standards/script-header.md` - Header template
- `../standards/naming-conventions.md` - File naming standard
- `../standards/constants.md` - Three-tier constants rule
