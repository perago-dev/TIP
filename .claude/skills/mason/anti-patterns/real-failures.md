# Real Failures & Lessons Learned

Anonymized case studies from actual Softype project failures. These examples are derived from internal post-mortems and lessons learned sessions, sanitized for confidentiality.

## Case 1: The Governance Disaster

### What Happened

A scheduled script processed daily orders by loading each order, checking inventory, and updating status. It worked fine in testing with 50 orders. In production with 2,000+ orders, it consistently timed out.

### The Code

```javascript
// WHAT WAS WRITTEN
function execute(context) {
    const orders = getAllPendingOrders();  // Returns 2,000+ IDs

    orders.forEach(function(orderId) {
        const order = record.load({  // 10 units each
            type: 'salesorder',
            id: orderId
        });

        // Check each line item's inventory
        const lineCount = order.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < lineCount; i++) {
            const itemId = order.getSublistValue({ /* ... */ });
            const inventory = record.load({  // Another 10 units!
                type: 'inventoryitem',
                id: itemId
            });
            // Check availability...
        }

        order.setValue('status', 'CHECKED');
        order.save();  // 20 units
    });
}

// Cost: ~50 units per order minimum
// 2,000 orders × 50 units = 100,000 units (limit: 10,000)
```

### The Fix

```javascript
function execute(context) {
    const scriptObj = runtime.getCurrentScript();

    // Get all inventory data upfront with single search
    const inventoryMap = buildInventoryMap();

    // Use paged search with governance checking
    const orderSearch = search.create({
        type: 'salesorder',
        filters: [['status', 'is', 'PENDING']],
        columns: ['internalid']
    });

    orderSearch.run().each(function(result) {
        if (scriptObj.getRemainingUsage() < 200) {
            rescheduleWithCheckpoint(result.id);
            return false;
        }

        // Use submitFields instead of load/save
        record.submitFields({
            type: 'salesorder',
            id: result.id,
            values: { custbody_checked: true }
        });

        return true;
    });
}
```

### Lesson

> Always test with production-scale data. Governance issues only appear at volume.

---

## Case 2: The Missing Orders

### What Happened

An integration received orders from an e-commerce platform. Sometimes orders would "disappear" - the webhook was received, logged as successful, but no order was created in NetSuite.

### The Code

```javascript
// WHAT WAS WRITTEN
function post(requestBody) {
    try {
        const order = createSalesOrder(requestBody);
        return { success: true, orderId: order };
    } catch (e) {
        log.error({ title: 'Order Creation Failed', details: e.message });
        return { success: true };  // BUG: Returns success even on failure!
    }
}
```

### What Went Wrong

1. Error was caught and logged
2. But response said `success: true`
3. E-commerce platform thought order was created
4. No retry was triggered
5. Order was lost

### The Fix

```javascript
function post(requestBody) {
    try {
        const orderId = createSalesOrder(requestBody);

        // Verify the order actually exists
        const verification = search.lookupFields({
            type: 'salesorder',
            id: orderId,
            columns: ['internalid']
        });

        return {
            success: true,
            orderId: orderId
        };

    } catch (e) {
        log.error({
            title: 'Order Creation Failed',
            details: JSON.stringify({
                error: e.message,
                payload: requestBody
            })
        });

        return {
            success: false,  // Correctly report failure
            error: e.message
        };
    }
}
```

### Lesson

> Error responses must accurately reflect what happened. Silent failures lose data.

---

## Case 3: The Duplicate Invoice Nightmare

### What Happened

A script that created invoices from approved orders sometimes created duplicate invoices. The accounting team discovered $2M in duplicate invoices during month-end close.

### The Code

```javascript
// WHAT WAS WRITTEN
function afterSubmit(context) {
    if (context.type !== context.UserEventType.EDIT) return;

    const order = context.newRecord;
    if (order.getValue('custbody_approved') !== true) return;
    if (context.oldRecord.getValue('custbody_approved') === true) return;  // Already was approved

    // Create invoice
    const invoice = record.transform({
        fromType: 'salesorder',
        fromId: order.id,
        toType: 'invoice'
    });
    invoice.save();
}
```

### What Went Wrong

1. User approves order → Invoice created
2. User edits something else on approved order → Script runs again
3. `oldRecord.custbody_approved` is `true` (was just approved)
4. Check passes because comparing `true === true` returns `true`... wait, that should stop it
5. **Actual bug**: The check was `!== true` instead of `=== true`

```javascript
// The actual bug
if (context.oldRecord.getValue('custbody_approved') !== true) return;
// Should have been:
if (context.oldRecord.getValue('custbody_approved') === true) return;
```

### The Fix

```javascript
function afterSubmit(context) {
    if (context.type !== context.UserEventType.EDIT) return;

    const order = context.newRecord;
    const wasApproved = context.oldRecord.getValue('custbody_approved') === true;
    const isApproved = order.getValue('custbody_approved') === true;

    // Only create invoice when status CHANGES to approved
    if (isApproved && !wasApproved) {
        // Check if invoice already exists
        const existingInvoice = search.create({
            type: 'invoice',
            filters: [['createdfrom', 'is', order.id]]
        }).run().getRange({ start: 0, end: 1 });

        if (existingInvoice.length > 0) {
            log.warning({
                title: 'Invoice Already Exists',
                details: 'Order ' + order.id + ' already has invoice ' + existingInvoice[0].id
            });
            return;
        }

        // Create invoice
        const invoice = record.transform({
            fromType: 'salesorder',
            fromId: order.id,
            toType: 'invoice'
        });
        invoice.save();
    }
}
```

### Lesson

> Always check if the operation was already done. Use idempotency patterns for create operations.

---

## Case 4: The Integration Timeout

### What Happened

An integration with a slow external API caused user event scripts to timeout. Users couldn't save orders because the script was waiting for an API response.

### The Code

```javascript
// WHAT WAS WRITTEN
function afterSubmit(context) {
    if (context.type === context.UserEventType.CREATE) {
        // Sync to external system
        const response = https.post({
            url: 'https://slow-api.example.com/orders',
            body: JSON.stringify(buildPayload(context.newRecord))
        });
        // No timeout handling
        // External API sometimes takes 30+ seconds
    }
}
```

### What Went Wrong

1. External API was slow (3rd party, not under our control)
2. User saves order, script calls API
3. API takes 30 seconds to respond
4. NetSuite user event times out
5. User gets error, thinks order didn't save
6. User tries again, creates duplicate

### The Fix

```javascript
function afterSubmit(context) {
    if (context.type === context.UserEventType.CREATE) {
        // Queue for async processing instead of blocking
        record.create({
            type: 'customrecord_sync_queue',
            values: {
                custrecord_queue_record_id: context.newRecord.id,
                custrecord_queue_record_type: context.newRecord.type,
                custrecord_queue_status: 'PENDING',
                custrecord_queue_created: new Date()
            }
        }).save();

        // Scheduled script processes queue with retries
    }
}

// Separate scheduled script
function execute(context) {
    // Process queue items with timeout handling and retries
    processQueueWithRetry();
}
```

### Lesson

> Never make slow external calls in user events. Queue for async processing.

---

## Case 5: The Bulk Delete Mistake

### What Happened

A cleanup script was supposed to delete test records. It deleted production data instead.

### The Code

```javascript
// WHAT WAS WRITTEN
function execute(context) {
    const scriptObj = runtime.getCurrentScript();
    const recordType = scriptObj.getParameter({ name: 'custscript_record_type' });

    // Delete all records of this type
    search.create({
        type: recordType,
        filters: []  // NO FILTERS!
    }).run().each(function(result) {
        record.delete({ type: recordType, id: result.id });
        return true;
    });
}
```

### What Went Wrong

1. Script was supposed to have a filter for test records
2. Filter was removed "for testing"
3. Script was deployed to production
4. Parameter was set to 'customrecord_orders'
5. All 50,000 order records were deleted

### The Fix

```javascript
function execute(context) {
    const scriptObj = runtime.getCurrentScript();
    const recordType = scriptObj.getParameter({ name: 'custscript_record_type' });
    const testPrefix = scriptObj.getParameter({ name: 'custscript_test_prefix' });

    // REQUIRE the test prefix parameter
    if (!testPrefix || !testPrefix.startsWith('TEST_')) {
        throw new Error('Test prefix parameter required and must start with TEST_');
    }

    // Limit to test records only
    search.create({
        type: recordType,
        filters: [['name', 'startswith', testPrefix]]  // REQUIRED filter
    }).run().each(function(result) {
        // Log before deleting
        log.audit({
            title: 'Deleting Record',
            details: recordType + ' ID: ' + result.id
        });

        record.delete({ type: recordType, id: result.id });
        return true;
    });
}
```

### Lesson

> Destructive operations need safeguards. Required parameters, confirmation, and logging.

---

## Summary: Common Failure Patterns

| Pattern | Frequency | Impact |
|---------|-----------|--------|
| Governance exhaustion | Very common | Script failure |
| Silent error handling | Common | Data loss |
| Missing idempotency | Common | Duplicates |
| Sync external calls | Common | Timeouts |
| Unfiltered bulk operations | Rare | Catastrophic |

## Prevention Checklist

- [ ] Test with production-scale data volumes
- [ ] Error responses match actual outcomes
- [ ] Idempotency checks for create operations
- [ ] Async processing for external APIs
- [ ] Required safeguards for destructive operations
- [ ] Comprehensive logging for audit trail

## See Also

- `governance-killers.md` - Governance anti-patterns
- `data-integrity.md` - Data integrity issues
- `../review/checklist.md` - Code review checklist
