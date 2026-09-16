# Data Integrity Anti-Patterns

Patterns that corrupt, lose, or inconsistently handle data.

## Critical Data Integrity Issues

### 1. Race Conditions

**Problem**: Multiple processes modifying same record simultaneously.

```javascript
// DANGEROUS: Classic read-modify-write race condition
function incrementCounter(recordId) {
    const rec = record.load({ type: 'customrecord_counter', id: recordId });
    const current = rec.getValue('custrecord_count');
    rec.setValue('custrecord_count', current + 1);  // May overwrite another process's update
    rec.save();
}

// SAFER: Use NetSuite's built-in record locking
function incrementCounter(recordId) {
    try {
        const rec = record.load({
            type: 'customrecord_counter',
            id: recordId,
            isDynamic: true
        });
        const current = rec.getValue('custrecord_count');
        rec.setValue('custrecord_count', current + 1);
        rec.save();
    } catch (e) {
        if (e.name === 'RCRD_LOCKED_BY_WF' || e.message.includes('locked')) {
            // Record locked by another process - retry or queue
            queueForRetry(recordId);
        } else {
            throw e;
        }
    }
}

// BEST: Atomic operation where possible
function incrementCounter(recordId) {
    // Use SQL formula in saved search for true atomicity
    // Or use external queue system with single consumer
}
```

### 2. Partial Updates

**Problem**: Multi-record updates fail partway through.

```javascript
// DANGEROUS: If update fails midway, data is inconsistent
function updateRelatedRecords(masterId, data) {
    // Update master
    record.submitFields({
        type: 'customrecord_master',
        id: masterId,
        values: { custrecord_status: 'UPDATED' }
    });

    // Update children - may fail here!
    data.children.forEach(function(child) {
        record.submitFields({
            type: 'customrecord_child',
            id: child.id,
            values: { custrecord_master_status: 'UPDATED' }
        });
    });
}

// SAFER: Track what succeeded for recovery
function updateRelatedRecords(masterId, data) {
    const updated = { master: false, children: [] };

    try {
        record.submitFields({
            type: 'customrecord_master',
            id: masterId,
            values: { custrecord_status: 'UPDATING' }  // Intermediate state
        });
        updated.master = true;

        data.children.forEach(function(child) {
            record.submitFields({
                type: 'customrecord_child',
                id: child.id,
                values: { custrecord_master_status: 'UPDATED' }
            });
            updated.children.push(child.id);
        });

        // Final status after all children updated
        record.submitFields({
            type: 'customrecord_master',
            id: masterId,
            values: { custrecord_status: 'UPDATED' }
        });

    } catch (e) {
        // Log what was updated for manual recovery
        log.error({
            title: 'Partial Update Failure',
            details: JSON.stringify({ masterId, updated, error: e.message })
        });
        throw e;
    }
}
```

### 3. Orphaned Records

**Problem**: Child records left without parent.

```javascript
// DANGEROUS: Delete parent, orphan children
function deleteProject(projectId) {
    record.delete({
        type: 'customrecord_project',
        id: projectId
    });
    // Tasks referencing this project are now orphaned!
}

// SAFER: Delete or reassign children first
function deleteProject(projectId) {
    // Delete or archive child records first
    search.create({
        type: 'customrecord_task',
        filters: [['custrecord_task_project', 'is', projectId]]
    }).run().each(function(result) {
        record.delete({
            type: 'customrecord_task',
            id: result.id
        });
        return true;
    });

    // Then delete parent
    record.delete({
        type: 'customrecord_project',
        id: projectId
    });
}
```

### 4. Duplicate Creation

**Problem**: Creating duplicate records due to retry logic.

```javascript
// DANGEROUS: Retry may create duplicates
function createOrder(data) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const order = record.create({ type: 'salesorder' });
            order.setValue('entity', data.customerId);
            // ... set other fields
            return order.save();  // May timeout but still succeed
        } catch (e) {
            if (attempt === 2) throw e;
            // Retry creates another order!
        }
    }
}

// SAFER: Use idempotency key
function createOrder(data) {
    const idempotencyKey = data.externalOrderId;

    // Check if already created
    const existing = search.create({
        type: 'salesorder',
        filters: [['otherrefnum', 'is', idempotencyKey]]
    }).run().getRange({ start: 0, end: 1 });

    if (existing.length > 0) {
        return existing[0].id;  // Return existing instead of creating duplicate
    }

    // Create new
    const order = record.create({ type: 'salesorder' });
    order.setValue('entity', data.customerId);
    order.setValue('otherrefnum', idempotencyKey);  // Store idempotency key
    return order.save();
}
```

### 5. Silent Data Loss

**Problem**: Errors swallowed, data not saved.

```javascript
// DANGEROUS: Data loss hidden
function saveCustomerPreferences(customerId, preferences) {
    try {
        record.submitFields({
            type: 'customer',
            id: customerId,
            values: { custentity_preferences: JSON.stringify(preferences) }
        });
    } catch (e) {
        // Swallowed! User thinks preferences saved but they weren't
    }
}

// SAFER: Inform caller of failure
function saveCustomerPreferences(customerId, preferences) {
    try {
        record.submitFields({
            type: 'customer',
            id: customerId,
            values: { custentity_preferences: JSON.stringify(preferences) }
        });
        return { success: true };
    } catch (e) {
        log.error({
            title: 'Preference Save Failed',
            details: JSON.stringify({ customerId, error: e.message })
        });
        return { success: false, error: 'Failed to save preferences' };
    }
}
```

### 6. Incorrect Line Item Manipulation

**Problem**: Sublist operations corrupt line data.

```javascript
// DANGEROUS: Removing lines while iterating forward
function removeZeroQuantityLines(rec) {
    const lineCount = rec.getLineCount({ sublistId: 'item' });
    for (let i = 0; i < lineCount; i++) {
        const qty = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: i
        });
        if (qty === 0) {
            rec.removeLine({ sublistId: 'item', line: i });
            // After removal, line i is now what was line i+1
            // But we increment i, so we skip checking that line!
        }
    }
}

// SAFER: Remove from end
function removeZeroQuantityLines(rec) {
    const lineCount = rec.getLineCount({ sublistId: 'item' });
    for (let i = lineCount - 1; i >= 0; i--) {
        const qty = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: i
        });
        if (qty === 0) {
            rec.removeLine({ sublistId: 'item', line: i });
            // Removing from end doesn't affect indices of remaining lines
        }
    }
}
```

### 7. Floating Point Currency

**Problem**: JavaScript floating point errors in financial calculations.

```javascript
// DANGEROUS: Floating point precision loss
const price = 19.99;
const quantity = 3;
const total = price * quantity;  // 59.97000000000001, not 59.97

// SAFER: Use integers or proper rounding
const priceInCents = 1999;
const quantity = 3;
const totalInCents = priceInCents * quantity;  // 5997 (exact)
const total = totalInCents / 100;  // 59.97

// Or round at the end
const total = Math.round(price * quantity * 100) / 100;

// BEST: Use NetSuite's currency handling
// Currency fields automatically handle precision
```

### 8. Timezone Data Loss

**Problem**: Date/time stored without timezone context.

```javascript
// DANGEROUS: Timezone confusion
const eventDate = new Date(rec.getValue('custrecord_event_time'));
// What timezone is this? User's? Server's? Account's?

// SAFER: Always work in consistent timezone
const format = require('N/format');

// Parse with explicit format
const eventDate = format.parse({
    value: rec.getValue('custrecord_event_time'),
    type: format.Type.DATETIME,
    timezone: format.Timezone.AMERICA_LOS_ANGELES
});

// Store with explicit timezone notation
rec.setValue('custrecord_event_notes',
    'Event scheduled for ' + eventDate.toISOString());  // UTC string
```

## Prevention Checklist

### Before Modifying Data

- [ ] What happens if operation fails midway?
- [ ] Could another process modify this data simultaneously?
- [ ] Is there a unique constraint to prevent duplicates?
- [ ] What happens to related records?

### During Implementation

- [ ] Use transactions/batching where possible
- [ ] Log operations for recovery
- [ ] Use idempotency keys for creates
- [ ] Handle floating point properly
- [ ] Be explicit about timezones

### After Implementation

- [ ] Test concurrent access scenarios
- [ ] Verify no orphaned records
- [ ] Check for duplicates
- [ ] Validate financial calculations

## See Also

- `governance-killers.md` - Governance anti-patterns
- `real-failures.md` - Real-world failure examples
- `../suitescript/gotchas.md` - Platform-specific issues
