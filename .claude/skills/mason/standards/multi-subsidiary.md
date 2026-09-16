# Multi-Subsidiary & OneWorld

Standards for scripts deployed in NetSuite OneWorld accounts.

## The Core Rule

Always filter searches by subsidiary when operating in a OneWorld account. Failing to do so returns or processes records across subsidiaries unintentionally — a data leak that is often silent and hard to diagnose.

## Search Filtering

```javascript
// BAD — returns records from all subsidiaries
search.create({
    type: 'salesorder',
    filters: [
        ['status', 'anyof', 'SalesOrd:A'],
        'AND',
        ['mainline', 'is', 'T']
    ]
});

// GOOD — scoped to current user's subsidiary
const currentUser = runtime.getCurrentUser();
search.create({
    type: 'salesorder',
    filters: [
        ['status', 'anyof', 'SalesOrd:A'],
        'AND',
        ['mainline', 'is', 'T'],
        'AND',
        ['subsidiary', 'anyof', currentUser.subsidiary]
    ]
});
```

## Getting Subsidiary Context

```javascript
// Current user's subsidiary
const subsidiaryId = runtime.getCurrentUser().subsidiary;

// From script parameter (for scripts that should scope to a specific subsidiary)
const subsidiaryId = runtime.getCurrentScript().getParameter({
    name: 'custscript_subsidiary_id'
});

// From the record being processed
const subsidiaryId = rec.getValue('subsidiary');
```

**Never hardcode subsidiary IDs** — they differ between accounts (sandbox vs. production) and between clients. Always use `runtime.getCurrentUser().subsidiary` or a Script Parameter.

## Deployment Scoping

Use Audience restrictions on Script Deployments to prevent cross-subsidiary access for sensitive Suitelets:

- Set **Subsidiary** restrictions on the deployment record
- Combine with `runtime.getCurrentUser().subsidiary` checks in code for defence-in-depth
- Verify Suitelet audience/role access before releasing — unauthenticated or over-permissioned Suitelets are a real security risk

## Pre-Release Checklist (OneWorld)

- [ ] All searches filtered by subsidiary
- [ ] No hardcoded subsidiary IDs — Script Parameters used
- [ ] Deployment audience restrictions configured for sensitive Suitelets

## See Also

- `constants.md` - Using Script Parameters for environment-specific values
- `../suitescript/snippets/execution-context.md` - Context filtering
- `../review/pre-release-checklist.md` - Full checklist including multi-subsidiary items
