# Anti-Patterns Index

Common mistakes to avoid in NetSuite development.

## Categories

| Category | Description |
|----------|-------------|
| **Governance Killers** | Code that exhausts governance quickly |
| **Data Integrity** | Patterns that corrupt or lose data |
| **Real Failures** | Lessons from actual project failures |

## Quick Reference: Top 10 Anti-Patterns

### 1. Record Load in Loop

```javascript
// WRONG
items.forEach(item => {
    const rec = record.load({ type: 'item', id: item.id });  // 10 units each
});

// RIGHT
const itemIds = items.map(i => i.id);
search.create({
    type: 'item',
    filters: [['internalid', 'anyof', itemIds]],
    columns: ['baseprice']
}).run().each(result => { /* ... */ });
```

### 2. Missing Mainline Filter

```javascript
// WRONG - Returns one row per line item
search.create({
    type: 'salesorder',
    filters: [['status', 'is', 'A']]
});

// RIGHT - Returns one row per order
search.create({
    type: 'salesorder',
    filters: [['status', 'is', 'A'], 'AND', ['mainline', 'is', 'T']]
});
```

### 3. No Governance Check

```javascript
// WRONG
results.each(result => {
    processRecord(result.id);  // May exhaust governance
    return true;
});

// RIGHT
results.each(result => {
    if (scriptObj.getRemainingUsage() < 200) {
        rescheduleScript();
        return false;
    }
    processRecord(result.id);
    return true;
});
```

### 4. Throwing in afterSubmit

```javascript
// WRONG - Record already saved
function afterSubmit(context) {
    throw new Error('Validation failed');  // Too late!
}

// RIGHT - Validate in beforeSubmit
function beforeSubmit(context) {
    if (!isValid()) {
        throw new Error('Validation failed');
    }
}
```

### 5. Load Instead of lookupFields

```javascript
// WRONG - 10 units
const rec = record.load({ type: 'customer', id: id });
const email = rec.getValue('email');

// RIGHT - 1 unit
const fields = search.lookupFields({
    type: 'customer',
    id: id,
    columns: ['email']
});
const email = fields.email;
```

### 6. Full Save Instead of submitFields

```javascript
// WRONG - 30 units (load + save)
const rec = record.load({ type: 'salesorder', id: id });
rec.setValue('memo', 'Updated');
rec.save();

// RIGHT - 10 units
record.submitFields({
    type: 'salesorder',
    id: id,
    values: { memo: 'Updated' }
});
```

### 7. Hardcoded Credentials

```javascript
// WRONG
const API_KEY = 'sk_live_abc123';  // Security risk!

// RIGHT
const API_KEY = runtime.getCurrentScript()
    .getParameter({ name: 'custscript_api_key' });
```

### 8. Ignoring Context Type

```javascript
// WRONG - Runs on every trigger
function afterSubmit(context) {
    sendNotification();  // Fires on create, edit, AND delete!
}

// RIGHT
function afterSubmit(context) {
    if (context.type === context.UserEventType.CREATE) {
        sendNotification();
    }
}
```

### 9. Removing Lines Forward

```javascript
// WRONG - Indices shift
for (let i = 0; i < lineCount; i++) {
    rec.removeLine({ sublistId: 'item', line: i });  // Skips lines!
}

// RIGHT - Remove from end
for (let i = lineCount - 1; i >= 0; i--) {
    rec.removeLine({ sublistId: 'item', line: i });
}
```

### 10. Silent Error Swallowing

```javascript
// WRONG
try {
    processRecord();
} catch (e) {
    // Silently fails - no logging, no notification
}

// RIGHT
try {
    processRecord();
} catch (e) {
    log.error({ title: 'Process Error', details: e.message });
    throw e;  // Or handle appropriately
}
```

## Impact Matrix

| Anti-Pattern | Governance | Data | Security | Performance |
|--------------|------------|------|----------|-------------|
| Record Load in Loop | HIGH | - | - | HIGH |
| Missing Mainline | MEDIUM | - | - | HIGH |
| No Governance Check | HIGH | - | - | - |
| Throwing in afterSubmit | - | MEDIUM | - | - |
| Load vs lookupFields | MEDIUM | - | - | MEDIUM |
| Save vs submitFields | MEDIUM | - | - | MEDIUM |
| Hardcoded Credentials | - | - | HIGH | - |
| Ignoring Context Type | MEDIUM | LOW | - | MEDIUM |
| Removing Lines Forward | - | HIGH | - | - |
| Silent Error Swallowing | - | MEDIUM | LOW | - |

## See Also

- `governance-killers.md` - Governance anti-patterns in detail
- `data-integrity.md` - Data corruption anti-patterns
- `real-failures.md` - Lessons from actual failures
