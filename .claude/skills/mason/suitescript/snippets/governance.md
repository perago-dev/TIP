# Governance Patterns

Managing SuiteScript governance units to prevent execution failures.

## Governance Limits by Script Type

| Script Type | Limit | Notes |
|-------------|-------|-------|
| Client Script | 1,000 | Browser-side |
| User Event | 1,000 | Per trigger (beforeLoad, etc.) |
| Scheduled Script | 10,000 | Can reschedule |
| Map/Reduce (getInputData) | 10,000 per invocation | Hard limit |
| Map/Reduce (map) | 1,000 per invocation | Hard limit |
| Map/Reduce (reduce) | 5,000 per invocation | Hard limit |
| Map/Reduce (summarize) | 10,000 per invocation | Hard limit |
| RESTlet | 5,000 | Per request |
| Suitelet | 1,000 | Per request |
| Workflow Action | 1,000 | Per action |
| Portlet | 1,000 | Per render |

## Checking Remaining Usage

```javascript
const runtime = require('N/runtime');

function checkGovernance(requiredUnits) {
    const scriptObj = runtime.getCurrentScript();
    const remaining = scriptObj.getRemainingUsage();

    log.debug({
        title: 'Governance Check',
        details: 'Remaining: ' + remaining + ', Required: ' + requiredUnits
    });

    return remaining >= requiredUnits;
}

// Usage
if (!checkGovernance(100)) {
    // Handle low governance
    rescheduleScript();
}
```

## Common Operation Costs

| Operation | Units |
|-----------|-------|
| record.load | 10 |
| record.save | 20 |
| record.create (unsaved) | 0 |
| record.create + save | 20 |
| record.submitFields | 10 |
| record.copy | 10 |
| record.transform | 10 |
| record.delete | 20 |
| search.create + run | 10 |
| search.lookupFields | 1 |
| search.global | 10 |
| https.get/post | 10 |
| email.send | 20 |
| file.load | 10 |
| file.save | 10 |
| task.create + submit | 20 |

## Scheduled Script Yielding

```javascript
function execute(context) {
    const scriptObj = runtime.getCurrentScript();

    const results = search.create({
        type: 'salesorder',
        filters: [['status', 'anyof', 'SalesOrd:A']]
    }).run();

    let processed = 0;

    results.each(function(result) {
        // Check governance before each expensive operation
        if (scriptObj.getRemainingUsage() < 200) {
            log.audit({
                title: 'Yielding',
                details: 'Processed: ' + processed + ', Remaining: ' + scriptObj.getRemainingUsage()
            });

            // Reschedule to continue
            rescheduleScript({ lastProcessedId: result.id });
            return false;  // Stop iteration
        }

        // Process record (expensive operation)
        processRecord(result.id);
        processed++;

        return true;  // Continue
    });

    log.audit({ title: 'Complete', details: 'Total processed: ' + processed });
}

function rescheduleScript(params) {
    const task = require('N/task');

    const scheduledTask = task.create({
        taskType: task.TaskType.SCHEDULED_SCRIPT,
        scriptId: runtime.getCurrentScript().id,
        deploymentId: runtime.getCurrentScript().deploymentId,
        params: params
    });

    scheduledTask.submit();

    log.audit({ title: 'Rescheduled', details: JSON.stringify(params) });
}
```

## Checkpointing Pattern

```javascript
function execute(context) {
    const scriptObj = runtime.getCurrentScript();

    // Get checkpoint from previous run
    const lastId = scriptObj.getParameter({ name: 'custscript_last_id' }) || 0;

    const searchObj = search.create({
        type: 'customrecord_queue',
        filters: [
            ['internalid', 'greaterthan', lastId],
            'AND',
            ['custrecord_processed', 'is', 'F']
        ],
        columns: [
            search.createColumn({ name: 'internalid', sort: search.Sort.ASC })
        ]
    });

    let currentId = lastId;
    let processed = 0;

    searchObj.run().each(function(result) {
        if (scriptObj.getRemainingUsage() < 300) {
            // Save checkpoint and reschedule
            rescheduleWithCheckpoint(currentId);
            return false;
        }

        currentId = result.id;
        processQueueItem(currentId);
        processed++;

        return true;
    });

    log.audit({
        title: 'Batch Complete',
        details: 'Processed ' + processed + ' records starting from ' + lastId
    });
}

function rescheduleWithCheckpoint(checkpoint) {
    task.create({
        taskType: task.TaskType.SCHEDULED_SCRIPT,
        scriptId: runtime.getCurrentScript().id,
        deploymentId: runtime.getCurrentScript().deploymentId,
        params: { custscript_last_id: checkpoint }
    }).submit();
}
```

## Batch Processing Pattern

```javascript
function execute(context) {
    const BATCH_SIZE = 50;  // Process in batches
    const scriptObj = runtime.getCurrentScript();

    const allIds = getAllRecordIds();  // Get IDs only (cheap)
    let processed = 0;

    // Process in batches
    while (processed < allIds.length) {
        // Check if we have enough for a batch
        if (scriptObj.getRemainingUsage() < BATCH_SIZE * 30) {
            rescheduleScript({
                custscript_offset: processed
            });
            return;
        }

        // Process batch
        const batch = allIds.slice(processed, processed + BATCH_SIZE);
        batch.forEach(function(id) {
            processRecord(id);
        });

        processed += batch.length;

        log.audit({
            title: 'Batch Processed',
            details: processed + '/' + allIds.length + ', Remaining: ' + scriptObj.getRemainingUsage()
        });
    }

    log.audit({ title: 'All Complete', details: 'Total: ' + processed });
}
```

## Optimizing Governance

### Use submitFields Instead of Load/Save

```javascript
// BAD: 30 units (load + save)
const rec = record.load({ type: 'customer', id: id });
rec.setValue('custentity_status', 'ACTIVE');
rec.save();

// GOOD: 10 units
record.submitFields({
    type: 'customer',
    id: id,
    values: { custentity_status: 'ACTIVE' }
});
```

### Use lookupFields Instead of Load

```javascript
// BAD: 10 units
const rec = record.load({ type: 'customer', id: id });
const email = rec.getValue('email');

// GOOD: 1 unit
const fields = search.lookupFields({
    type: 'customer',
    id: id,
    columns: ['email']
});
const email = fields.email;
```

### Batch Search Results

```javascript
// BAD: Search inside loop
items.forEach(function(item) {
    const price = search.lookupFields({  // 1 unit each
        type: 'item',
        id: item.id,
        columns: ['baseprice']
    }).baseprice;
});

// GOOD: Single search with all IDs
const itemIds = items.map(function(i) { return i.id; });
const searchResults = search.create({
    type: 'item',
    filters: [['internalid', 'anyof', itemIds]],
    columns: ['baseprice']
}).run().getRange({ start: 0, end: itemIds.length });  // 10 units total
```

### Cache Repeated Lookups

```javascript
// Create cache for session
const CACHE = {};

function getCachedValue(type, id, field) {
    const cacheKey = type + '_' + id + '_' + field;

    if (!CACHE[cacheKey]) {
        const values = search.lookupFields({
            type: type,
            id: id,
            columns: [field]
        });
        CACHE[cacheKey] = values[field];
    }

    return CACHE[cacheKey];
}
```

## Map/Reduce Governance

Map/Reduce handles governance automatically, but stages have different limits:

```javascript
// getInputData: 10,000 units
function getInputData() {
    // Can do heavy operations here
    return search.create({ ... });
}

// map: 1,000 units per invocation
function map(context) {
    // Keep lightweight - avoid record.load if possible
    context.write({ key: key, value: transformedData });
}

// reduce: 5,000 units per invocation
function reduce(context) {
    // Can do more work here
    context.values.forEach(function(value) {
        // Process aggregated data
    });
}
```

## Governance Monitoring

```javascript
function logGovernance(label) {
    const scriptObj = runtime.getCurrentScript();
    log.audit({
        title: 'Governance: ' + label,
        details: JSON.stringify({
            remaining: scriptObj.getRemainingUsage(),
            script: scriptObj.id,
            deployment: scriptObj.deploymentId,
            timestamp: new Date().toISOString()
        })
    });
}

// Usage
logGovernance('Start');
heavyOperation();
logGovernance('After Heavy Operation');
```

## Emergency Governance Check

```javascript
function ensureGovernance(required, callback) {
    const remaining = runtime.getCurrentScript().getRemainingUsage();

    if (remaining < required) {
        log.error({
            title: 'Governance Exhausted',
            details: 'Required: ' + required + ', Remaining: ' + remaining
        });

        if (typeof callback === 'function') {
            callback(remaining);
        }

        throw error.create({
            name: 'GOVERNANCE_LIMIT',
            message: 'Insufficient governance units'
        });
    }

    return remaining;
}
```

## Best Practices

1. **Check before expensive operations** - Not after
2. **Use the cheapest operation** - submitFields > load/save
3. **Batch where possible** - One search vs many lookups
4. **Cache repeated lookups** - Don't query same data twice
5. **Reschedule, don't fail** - Continue work in next execution
6. **Log governance usage** - Track where units go
7. **Consider Map/Reduce** - For high-volume processing

## See Also

- `../patterns/scheduled.md` - Scheduled script patterns
- `../patterns/map-reduce.md` - Map/Reduce patterns
- `search-patterns.md` - Efficient searching
