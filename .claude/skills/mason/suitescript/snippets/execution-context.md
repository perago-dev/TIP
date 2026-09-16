# Execution Context Filtering

Always gate scripts with execution context checks to avoid running in unintended scenarios.

## Why This Matters

User Event Scripts fire in many contexts beyond the browser UI: CSV imports, web services calls, workflow transitions, Map/Reduce scripts, SuiteFlow, and more. Without context guards, a script written for interactive use can:

- Double-process records during bulk imports
- Cause infinite loops when workflows trigger scripts that trigger workflows
- Generate spurious notifications during automated processes
- Consume unnecessary governance during batch operations

## The Pattern

```javascript
define(['N/runtime'], function(runtime) {

    function beforeSubmit(context) {
        // Only run during interactive UI saves
        if (runtime.executionContext !== runtime.ContextType.USER_INTERFACE) {
            return;
        }

        // Your logic here
    }

    return { beforeSubmit: beforeSubmit };
});
```

## Context Types

```javascript
runtime.ContextType.USER_INTERFACE    // Browser — user interacting with a form
runtime.ContextType.WEBSERVICES       // SuiteTalk SOAP web services
runtime.ContextType.RESTLETS          // RESTlet calls
runtime.ContextType.SCHEDULED         // Scheduled script execution
runtime.ContextType.WORKFLOW          // Workflow action trigger
runtime.ContextType.CSVIMPORT         // CSV Import tool
runtime.ContextType.USEREVENT         // Triggered by another User Event
runtime.ContextType.MAPREDUCE         // Map/Reduce script
runtime.ContextType.MASSUPDATE        // Mass Update tool
runtime.ContextType.PORTLET           // Dashboard portlet
```

## Common Patterns

### UI-only (most common guard)

```javascript
function afterSubmit(context) {
    if (runtime.executionContext !== runtime.ContextType.USER_INTERFACE) {
        return;  // Skip CSV imports, web services, scheduled scripts
    }
    sendNotificationEmail(context.newRecord);
}
```

### Allow UI and web services, block scheduled/import

```javascript
function beforeSubmit(context) {
    const allowedContexts = [
        runtime.ContextType.USER_INTERFACE,
        runtime.ContextType.WEBSERVICES,
        runtime.ContextType.RESTLETS
    ];

    if (allowedContexts.indexOf(runtime.executionContext) === -1) {
        return;
    }

    validateRecord(context.newRecord);
}
```

### Block only CSV import (allow everything else)

```javascript
function afterSubmit(context) {
    if (runtime.executionContext === runtime.ContextType.CSVIMPORT) {
        return;  // CSV imports handle their own downstream logic
    }
    triggerDownstreamProcess(context.newRecord.id);
}
```

## Deployment Configuration vs. Code Guards

You can also restrict execution contexts at the deployment level in NetSuite Setup (via the "Execute As Role" and context checkboxes on the Script Deployment record). However:

- Code guards are more explicit and visible to the next developer
- Code guards survive deployment record changes
- Use both for critical scripts: deployment config as the outer gate, code guard as defence-in-depth

## Review Checklist

When reviewing high-traffic User Event scripts (SO, PO, Invoice, Customer, Item):

- [ ] Is there a context guard? If not, is it intentional?
- [ ] Would this script cause problems if triggered during a CSV import of 10,000 records?
- [ ] Would this script create an infinite loop if a downstream process also saves the same record?

## See Also

- `../patterns/user-event.md` - User Event patterns
- `../../standards/deployment.md` - Deployment density rules
- `governance.md` - Governance limits and yielding
