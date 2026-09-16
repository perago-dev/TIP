# SuiteScript Gotchas

Common mistakes and platform quirks that trip up developers.

## Record Loading/Saving

### Context vs Record

```javascript
// WRONG: Trying to save context.newRecord in afterSubmit
function afterSubmit(context) {
    const rec = context.newRecord;
    rec.setValue('custbody_field', 'value');
    rec.save();  // ERROR: Record is read-only in afterSubmit
}

// RIGHT: Load fresh record or use submitFields
function afterSubmit(context) {
    record.submitFields({
        type: context.newRecord.type,
        id: context.newRecord.id,
        values: { custbody_field: 'value' }
    });
}
```

### Dynamic vs Static Mode

```javascript
// WRONG: Using static mode methods in dynamic mode
const rec = record.load({
    type: 'salesorder',
    id: id,
    isDynamic: true
});
rec.setSublistValue({  // Static method on dynamic record
    sublistId: 'item',
    fieldId: 'quantity',
    line: 0,
    value: 10
});  // May fail or behave unexpectedly

// RIGHT: Use current sublist methods
rec.selectLine({ sublistId: 'item', line: 0 });
rec.setCurrentSublistValue({
    sublistId: 'item',
    fieldId: 'quantity',
    value: 10
});
rec.commitLine({ sublistId: 'item' });
```

### Record.type Returns String

```javascript
// WRONG: Comparing to record.Type enum
const rec = record.load({ type: 'salesorder', id: id });
if (rec.type === record.Type.SALES_ORDER) {  // FALSE!
    // This won't execute
}

// RIGHT: Compare to string
if (rec.type === 'salesorder') {
    // This works
}
```

## Searches

### Mainline Filter

```javascript
// WRONG: Getting duplicate results for each line item
const results = search.create({
    type: 'salesorder',
    filters: [['status', 'is', 'A']],
    columns: ['tranid', 'total']
}).run();  // Returns one result per line item!

// RIGHT: Add mainline filter
const results = search.create({
    type: 'salesorder',
    filters: [
        ['status', 'is', 'A'],
        'AND',
        ['mainline', 'is', 'T']  // One result per order
    ],
    columns: ['tranid', 'total']
}).run();
```

### Select Field Values

```javascript
// WRONG: Expecting text from getValue
const customerName = result.getValue('entity');
// Returns internal ID, not name!

// RIGHT: Use getText for display value
const customerName = result.getText('entity');
// Or use join column
const customerName = result.getValue({
    name: 'companyname',
    join: 'customer'
});
```

### Search Iteration Limit

```javascript
// WRONG: Assuming all results are returned
let count = 0;
search.create({ ... }).run().each(function(result) {
    count++;
    return true;
});
// count maxes at 4000!

// RIGHT: Use paged results for large datasets
const pagedResults = search.create({ ... }).runPaged({ pageSize: 1000 });
let count = 0;
pagedResults.pageRanges.forEach(function(pageRange) {
    count += pagedResults.fetch({ index: pageRange.index }).data.length;
});
```

## User Events

### Multiple Triggers

```javascript
// WRONG: Not checking context type
function afterSubmit(context) {
    sendNotification();  // Fires on create, edit, AND delete!
}

// RIGHT: Check the trigger type
function afterSubmit(context) {
    if (context.type === context.UserEventType.CREATE) {
        sendNotification();
    }
}
```

### Edit vs Xedit

```javascript
// xedit = inline edit (quick edit on lists)
// May have limited data

function beforeSubmit(context) {
    if (context.type === context.UserEventType.XEDIT) {
        // oldRecord might not have all fields
        // Only changed fields are reliable
    }
}
```

### Copy Creates Old Record Issues

```javascript
// When context.type === COPY, oldRecord is the source record
// newRecord has no ID yet

function beforeSubmit(context) {
    if (context.type === context.UserEventType.COPY) {
        // DON'T try to compare newRecord.id with oldRecord.id
        // newRecord.id is empty until save
    }
}
```

## Client Scripts

### Async Operations

```javascript
// WRONG: Expecting synchronous HTTP
function saveRecord(context) {
    const response = https.get({ url: 'https://api.com' });
    // ERROR: https not available in client scripts!
}

// RIGHT: Use dialog for async confirmations
function saveRecord(context) {
    // Can't make HTTP calls from client scripts
    // Use N/https/ClientResponse if available in newer versions
    // Or validate on server in beforeSubmit
    return true;
}
```

### validateField Return

```javascript
// WRONG: Not returning anything
function validateField(context) {
    if (badValue) {
        alert('Bad value');
    }
    // Missing return - undefined treated as true
}

// RIGHT: Explicit return
function validateField(context) {
    if (badValue) {
        alert('Bad value');
        return false;  // Reject the change
    }
    return true;  // Accept the change
}
```

### Field Display Changes

```javascript
// WRONG: Changing display in validateField
function validateField(context) {
    const field = rec.getField({ fieldId: 'other_field' });
    field.isDisplay = false;  // Won't work in validateField
    return true;
}

// RIGHT: Use fieldChanged for display changes
function fieldChanged(context) {
    const field = rec.getField({ fieldId: 'other_field' });
    field.isDisplay = false;  // Works in fieldChanged
}
```

## Dates and Times

### Date Parsing

```javascript
// WRONG: Using JavaScript Date parsing
const date = new Date(rec.getValue('trandate'));
// May get wrong date due to timezone issues!

// RIGHT: Use format module
const format = require('N/format');
const dateValue = rec.getValue('trandate');  // Already a Date object
const dateString = format.format({
    value: dateValue,
    type: format.Type.DATE
});
```

### Date Filters in Search

```javascript
// WRONG: JavaScript Date in filter
filters: [['trandate', 'on', new Date()]]  // May not work

// RIGHT: Use date string
filters: [['trandate', 'on', '1/15/2024']]

// Or relative date
filters: [['trandate', 'within', 'today']]
```

## Numbers and Currency

### Float Precision

```javascript
// WRONG: Using JavaScript numbers for money
const total = 19.99 + 10.01;
// total === 30.000000000000004 (floating point error!)

// RIGHT: Use integers or string math
const totalCents = 1999 + 1001;
const total = totalCents / 100;  // 30.00

// Or use NetSuite's built-in handling
// (currency fields handle this automatically)
```

### Percentage Fields

```javascript
// WRONG: Setting percent as decimal
rec.setValue('custbody_discount_pct', 0.15);  // Shows as 0.15%

// RIGHT: Set as whole number
rec.setValue('custbody_discount_pct', 15);  // Shows as 15%
```

## Sublists

### Removing Lines

```javascript
// WRONG: Removing lines from start
for (let i = 0; i < lineCount; i++) {
    rec.removeLine({ sublistId: 'item', line: i });
    // Indices shift after each removal!
}

// RIGHT: Remove from end
for (let i = lineCount - 1; i >= 0; i--) {
    rec.removeLine({ sublistId: 'item', line: i });
}
```

### Matrix Sublists

```javascript
// Matrix items have a different structure
// Each option combination is a separate line
// Use the matrixSublistId parameter
```

## Governance

### Scheduled Script Re-entrance

```javascript
// WRONG: Assuming script won't run again
let processedCount = 0;  // Module-level variable

function execute(context) {
    processedCount = 0;  // Reset each run, but...
    // If script is running when rescheduled, variable persists!
}

// RIGHT: Use script parameters for state
function execute(context) {
    const scriptObj = runtime.getCurrentScript();
    const lastId = scriptObj.getParameter({ name: 'custscript_last_id' });
}
```

### Map/Reduce getInputData

```javascript
// WRONG: Heavy operations in getInputData
function getInputData() {
    const results = [];
    search.create({ ... }).run().each(function(result) {
        // Loading full records here burns governance fast
        const fullRecord = record.load({ type: result.type, id: result.id });
        results.push(fullRecord);
        return true;
    });
    return results;
}

// RIGHT: Return search object, process in map
function getInputData() {
    return search.create({ ... });  // NetSuite handles iteration
}

function map(context) {
    // Do heavy work here where governance is per-item
    const rec = record.load({ ... });
}
```

## Permissions

### Script Execution Context

```javascript
// User Events run as the user who triggered them
// Scheduled scripts run as a specified role
// RESTlets run as the authenticated user

// WRONG: Assuming admin access
function execute(context) {
    const sensitiveData = record.load({
        type: 'customrecord_confidential',
        id: 1
    });  // May fail if role lacks permission!
}
```

### Employee Restrictions

```javascript
// Some operations require specific permissions:
// - Accessing certain record types
// - Modifying certain fields
// - Creating certain transactions

// Check permissions programmatically if needed
const hasAccess = runtime.getCurrentUser().hasPermission({
    name: 'LIST_CUSTJOB',  // Customer permission
    level: 'VIEW'
});
```

## Module Issues

### Reserved Words

```javascript
// WRONG: Using 'delete' as function name
function delete(id) { ... }  // Syntax error!

return {
    delete: delete  // Also an error
};

// RIGHT: Use alternative name
function deleteRecord(id) { ... }

return {
    'delete': deleteRecord  // String key works
};
```

### Circular Dependencies

```javascript
// Module A requires Module B
// Module B requires Module A
// This can cause undefined behavior

// RIGHT: Restructure to avoid cycles
// Or use require() inside functions (lazy loading)
function someFunction() {
    const moduleB = require('./moduleB');  // Load when needed
}
```

## Best Practices Summary

1. **Always check context type** in User Events
2. **Use mainline filter** for transaction searches
3. **Use getText() for display values** from searches
4. **Remove sublist lines from end** to preserve indices
5. **Return explicit boolean** from validation functions
6. **Handle timezone issues** with dates
7. **Use submitFields** when possible (lower governance)
8. **Check permissions** for sensitive operations
9. **Return search objects** from Map/Reduce getInputData
10. **Test with different user roles** to catch permission issues

## See Also

- `snippets/error-handling.md` - Handling errors gracefully
- `snippets/governance.md` - Governance management
- `patterns/` - Correct patterns by script type
