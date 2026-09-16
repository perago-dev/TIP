# Performance Review Criteria

Performance-focused review criteria for SuiteScript code.

## Governance Analysis

### Governance Costs

| Operation | Cost | Notes |
|-----------|------|-------|
| record.load | 10 | Full record load |
| record.save | 20 | Create or update |
| record.submitFields | 10 | Partial update |
| record.delete | 20 | |
| record.copy | 10 | |
| record.transform | 10 | |
| search.create + run | 10 | Per search |
| search.lookupFields | 1 | Single record |
| https.get/post | 10 | Per request |
| email.send | 20 | Per email |
| file.load | 10 | |
| file.save | 10 | |

### Script Type Limits

| Script Type | Limit |
|-------------|-------|
| Client Script | 1,000 |
| User Event | 1,000 |
| Scheduled | 10,000 |
| Map/Reduce | 10,000 per stage |
| RESTlet | 5,000 |
| Suitelet | 10,000 |
| Workflow Action | 1,000 |

## Critical Performance Issues

### 1. Record Load in Loops

```javascript
// BAD: O(n) governance cost
items.forEach(function(item) {
    const itemRec = record.load({  // 10 units each!
        type: 'inventoryitem',
        id: item.id
    });
    prices.push(itemRec.getValue('baseprice'));
});

// GOOD: O(1) governance cost
const itemIds = items.map(i => i.id);
const priceResults = search.create({
    type: 'inventoryitem',
    filters: [['internalid', 'anyof', itemIds]],
    columns: ['baseprice']
}).run().getRange({ start: 0, end: itemIds.length });

priceResults.forEach(function(result) {
    prices.push(result.getValue('baseprice'));
});
```

### 2. Missing Mainline Filter

```javascript
// BAD: Returns one row per line item
const orders = search.create({
    type: 'salesorder',
    filters: [['status', 'anyof', 'SalesOrd:A']],
    columns: ['tranid', 'total']
}).run();
// 100 orders with 10 lines each = 1000 rows!

// GOOD: Returns one row per order
const orders = search.create({
    type: 'salesorder',
    filters: [
        ['status', 'anyof', 'SalesOrd:A'],
        'AND',
        ['mainline', 'is', 'T']  // Critical!
    ],
    columns: ['tranid', 'total']
}).run();
// 100 orders = 100 rows
```

### 3. No Governance Check

```javascript
// BAD: Will fail on large datasets
function processAll() {
    search.create({
        type: 'salesorder',
        filters: [['status', 'is', 'A']]
    }).run().each(function(result) {
        processOrder(result.id);  // May exhaust governance
        return true;
    });
}

// GOOD: Governance-aware processing
function processAll() {
    const scriptObj = runtime.getCurrentScript();

    search.create({
        type: 'salesorder',
        filters: [['status', 'is', 'A']]
    }).run().each(function(result) {
        // Check BEFORE expensive operation
        if (scriptObj.getRemainingUsage() < 200) {
            rescheduleScript({ lastId: result.id });
            return false;  // Stop processing
        }

        processOrder(result.id);
        return true;
    });
}
```

### 4. Inefficient Field Access

```javascript
// BAD: Load full record to get one field
function getCustomerEmail(customerId) {
    const rec = record.load({  // 10 units
        type: 'customer',
        id: customerId
    });
    return rec.getValue('email');
}

// GOOD: Use lookupFields
function getCustomerEmail(customerId) {
    const fields = search.lookupFields({  // 1 unit
        type: 'customer',
        id: customerId,
        columns: ['email']
    });
    return fields.email;
}
```

### 5. submitFields vs Load/Save

```javascript
// BAD: Full record load/save for simple update
function updateStatus(recordId, newStatus) {
    const rec = record.load({  // 10 units
        type: 'salesorder',
        id: recordId
    });
    rec.setValue('status', newStatus);
    rec.save();  // 20 units
    // Total: 30 units
}

// GOOD: submitFields for simple updates
function updateStatus(recordId, newStatus) {
    record.submitFields({  // 10 units
        type: 'salesorder',
        id: recordId,
        values: { status: newStatus }
    });
    // Total: 10 units
}
```

## Performance Review Checklist

### Governance

- [ ] **getRemainingUsage() called** before expensive operations
- [ ] **Loop processing guarded** with governance checks
- [ ] **Reschedule logic** for batch operations
- [ ] **Cheapest operation used** for the task

### Search Optimization

- [ ] **Mainline filter** for transaction searches
- [ ] **lookupFields** for single record lookups
- [ ] **Limited columns** - only request needed fields
- [ ] **Indexed fields** - filters use indexed columns
- [ ] **Result pagination** - don't load unlimited results

### Record Operations

- [ ] **submitFields preferred** over load/save
- [ ] **Batch loading** - single search vs multiple loads
- [ ] **Caching** - repeated lookups cached
- [ ] **Dynamic vs Static** - appropriate mode chosen

### API/Integration

- [ ] **Connection reuse** where possible
- [ ] **Batch requests** - combine multiple calls
- [ ] **Timeout handling** - don't hang forever
- [ ] **Async where appropriate** - don't block UI

### Client Scripts

- [ ] **Minimal page init** - fast page load
- [ ] **Lazy loading** - defer expensive operations
- [ ] **No synchronous HTTP** - use callbacks
- [ ] **DOM manipulation efficient** - batch changes

## Performance Metrics

### Acceptable Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| User Event duration | < 5s | 5-15s | > 15s |
| Client page load | < 3s | 3-8s | > 8s |
| Scheduled per record | < 50 units | 50-100 | > 100 |
| API response time | < 2s | 2-5s | > 5s |

### Governance Budget

```
Scheduled Script (10,000 units):
├── Setup/teardown: 100 units (1%)
├── Search operations: 1,000 units (10%)
├── Per-record processing: 8,000 units (80%)
└── Buffer for errors: 900 units (9%)

For 100 records: 80 units each budget
For 500 records: 16 units each budget
```

## Performance Testing

### Load Testing Checklist

- [ ] Test with production-like data volumes
- [ ] Test with maximum expected concurrent users
- [ ] Monitor governance consumption
- [ ] Measure response times
- [ ] Check for memory issues

### Profiling Approach

```javascript
// Add timing instrumentation
function processWithTiming(fn, label) {
    const start = Date.now();
    const result = fn();
    const duration = Date.now() - start;

    log.audit({
        title: 'Performance: ' + label,
        details: duration + 'ms'
    });

    return result;
}

// Usage
processWithTiming(function() {
    return runComplexSearch();
}, 'Complex Search');
```

## See Also

- `checklist.md` - Full review checklist
- `security.md` - Security review
- `../suitescript/snippets/governance.md` - Governance patterns
