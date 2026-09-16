# SuiteScript Type Selection Guide

When to use which SuiteScript type. This is the decision tree for script type selection.

## Decision Tree

```
START
  │
  ├─► Does it need to run when a user interacts with a form?
  │     │
  │     └─► YES → CLIENT SCRIPT
  │           - Field validation
  │           - Field sourcing/defaulting
  │           - Page manipulation
  │           - User confirmations
  │
  ├─► Does it need to run before/after a record is saved?
  │     │
  │     └─► YES → USER EVENT
  │           - Data validation (server-side)
  │           - Related record updates
  │           - External system notifications
  │           - Audit logging
  │
  ├─► Does it need to process many records in batch?
  │     │
  │     ├─► < 1000 records → SCHEDULED SCRIPT
  │     │     - Nightly batch jobs
  │     │     - Report generation
  │     │     - Simple data cleanup
  │     │
  │     └─► > 1000 records → MAP/REDUCE
  │           - High-volume processing
  │           - Complex transformations
  │           - Parallel processing
  │
  ├─► Does it need to expose an API endpoint?
  │     │
  │     └─► YES → RESTLET
  │           - External system integrations
  │           - Mobile app backend
  │           - Third-party webhooks
  │
  ├─► Does it need a custom UI/page?
  │     │
  │     └─► YES → SUITELET
  │           - Custom dashboards
  │           - Configuration pages
  │           - Report interfaces
  │           - Wizards/workflows
  │
  └─► Does it need to run in a workflow?
        │
        └─► YES → WORKFLOW ACTION SCRIPT
              - Custom workflow conditions
              - Complex calculations
              - External API calls from workflow
```

## Quick Reference Table

| Script Type | Trigger | Governance | Use Case |
|-------------|---------|------------|----------|
| **Client Script** | User interaction | 1,000 units | Field validation, UI manipulation |
| **User Event** | Record save/load/delete | 1,000 units | Server-side validation, cascading updates |
| **Scheduled** | Time-based | 10,000 units | Nightly jobs, batch processing |
| **Map/Reduce** | On-demand/scheduled | Varies by stage (map: 1k, reduce: 5k, getInputData/summarize: 10k) | High-volume, parallel processing |
| **RESTlet** | HTTP request | 5,000 units | API endpoints, integrations |
| **Suitelet** | URL access | 1,000 units | Custom pages, dashboards |
| **Workflow Action** | Workflow transition | 1,000 units | Workflow-triggered logic |

## Entry Points by Script Type

### Client Script
```javascript
return {
    pageInit: pageInit,           // When page loads
    fieldChanged: fieldChanged,    // When field value changes
    postSourcing: postSourcing,   // After sourcing completes
    lineInit: lineInit,           // When sublist line selected
    validateField: validateField,  // Before field change commits
    validateLine: validateLine,    // Before line commits
    validateInsert: validateInsert, // Before line insert
    validateDelete: validateDelete, // Before line delete
    sublistChanged: sublistChanged, // After sublist modified
    saveRecord: saveRecord         // Before record saves
};
```

### User Event
```javascript
return {
    beforeLoad: beforeLoad,       // Before record loads
    beforeSubmit: beforeSubmit,   // Before record saves
    afterSubmit: afterSubmit      // After record saves
};
```

### Scheduled Script
```javascript
return {
    execute: execute              // Main entry point
};
```

### Map/Reduce
```javascript
return {
    getInputData: getInputData,   // Define data to process
    map: map,                     // First-stage processing
    reduce: reduce,               // Aggregation/grouping
    summarize: summarize          // Post-processing/logging
};
```

### RESTlet
```javascript
return {
    get: get,                     // HTTP GET
    post: post,                   // HTTP POST
    put: put,                     // HTTP PUT
    delete: deleteFunc            // HTTP DELETE ('delete' is reserved)
};
```

### Suitelet
```javascript
return {
    onRequest: onRequest          // Handle GET/POST
};
```

### Workflow Action Script
```javascript
return {
    onAction: onAction            // Workflow trigger
};
```

## Common Combinations

| Scenario | Script Types |
|----------|--------------|
| **Form validation + server processing** | Client Script + User Event |
| **External integration with batch sync** | RESTlet + Map/Reduce |
| **Custom page with saved search** | Suitelet + Scheduled (for caching) |
| **Real-time + batch processing** | User Event + Map/Reduce |
| **Workflow with external API** | Workflow Action Script |

## See Also

- `patterns/` - Detailed patterns for each script type
- `snippets/` - Reusable code snippets
- `gotchas.md` - Common mistakes and platform quirks
