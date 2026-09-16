# CLAUDE.md

This is a NetSuite SuiteScript support repo managed by Softype.

## Standards

All code in this repo must follow the **Mason technical standards** from the Softype Scout platform:

- **Script type selection**: Use the decision tree in Mason's `suitescript/INDEX.md`
- **Governance**: Check `runtime.getCurrentScript().getRemainingUsage()` before loops that load/save records
- **Error handling**: Structured try/catch, never return raw `e.message` in HTTP responses
- **Logging**: Use `log.debug/audit/error` — never `console.log` in server-side scripts
- **Searches**: Always set a result limit or paginate; always add `mainline: true` filter for transaction searches
- **Naming**: Field IDs as constants, never hardcoded numeric values

## Key rules (things that have burned us before)

- `record.load` or `record.save` inside a loop = governance failure under load. Always batch.
- Unbounded `search.run()` with no limit = will silently truncate at 1000 results. Use `getRange()` with pagination.
- Duplicate script files across folders (Production/, Sandbox/, developer folders) = drift. Run `npm run duplicates` to surface them.
- `ignoreMandatoryFields: true` = do not use. Fix the validation, don't bypass it.
- Commented-out validation = never ship. If it's breaking something, understand why.

## CI

```bash
npm run duplicates   # find same filename in multiple folders
npm run lint         # ESLint with SuiteScript rules
npm run typecheck    # type check against NetSuite API types
npm test             # Jest with N/* stubs
```

All four run on every PR via GitHub Actions.

## Mason skill

The Mason skill is installed at `.claude/skills/mason/`. It is available in every Claude Code session in this repo — locally and in CI.

Use `/mason` for:
- Script type selection and entry point patterns
- Governance snippets (checkpointing, reschedule logic)
- Error handling patterns
- Search patterns with correct pagination
- Code review checklist
