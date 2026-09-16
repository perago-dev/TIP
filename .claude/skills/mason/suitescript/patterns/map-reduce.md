# Map/Reduce Script Patterns

Map/Reduce scripts are designed for high-volume processing (>1000 records). They automatically handle governance, parallel processing, and failure recovery.

## Standard Template

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * [Description of what this script does]
 *
 * @module [ModuleName]
 */
define(['N/search', 'N/record', 'N/runtime', 'N/log'], function(search, record, runtime, log) {

    /**
     * getInputData - Define data to process
     * @returns {Array|Object|Search} Data to process
     */
    function getInputData() {
        log.audit({ title: 'getInputData', details: 'Starting' });

        // Option 1: Return search object (recommended for large datasets)
        return search.create({
            type: 'salesorder',
            filters: [['status', 'anyof', 'SalesOrd:A']],
            columns: ['internalid', 'entity', 'total']
        });

        // Option 2: Return array
        // return [{ id: 1, value: 'a' }, { id: 2, value: 'b' }];

        // Option 3: Return object (key-value pairs)
        // return { key1: 'value1', key2: 'value2' };
    }

    /**
     * map - First stage processing (one-to-many)
     * @param {Object} context
     * @param {string} context.key - Key from input
     * @param {string} context.value - Value from input (JSON string)
     */
    function map(context) {
        try {
            const data = JSON.parse(context.value);

            // Process and emit to reduce
            context.write({
                key: data.values.entity.value,  // Group by customer
                value: {
                    orderId: data.id,
                    total: data.values.total
                }
            });

        } catch (e) {
            log.error({
                title: 'map Error',
                details: 'Key: ' + context.key + ', Error: ' + e.message
            });
        }
    }

    /**
     * reduce - Aggregation stage (many-to-one per key)
     * @param {Object} context
     * @param {string} context.key - Key from map
     * @param {Array} context.values - Array of values for this key
     */
    function reduce(context) {
        try {
            const customerId = context.key;
            let totalAmount = 0;
            const orderIds = [];

            // Aggregate values for this key
            context.values.forEach(function(value) {
                const data = JSON.parse(value);
                totalAmount += parseFloat(data.total) || 0;
                orderIds.push(data.orderId);
            });

            // Process aggregated data
            updateCustomerRecord(customerId, totalAmount, orderIds);

            // Write for summarize
            context.write({
                key: customerId,
                value: { total: totalAmount, count: orderIds.length }
            });

        } catch (e) {
            log.error({
                title: 'reduce Error',
                details: 'Key: ' + context.key + ', Error: ' + e.message
            });
        }
    }

    /**
     * summarize - Final stage for logging and cleanup
     * @param {Object} summary
     * @param {Object} summary.inputSummary - Input stage stats
     * @param {Object} summary.mapSummary - Map stage stats
     * @param {Object} summary.reduceSummary - Reduce stage stats
     */
    function summarize(summary) {
        // Log input errors
        if (summary.inputSummary.error) {
            log.error({ title: 'Input Error', details: summary.inputSummary.error });
        }

        // Log map errors
        summary.mapSummary.errors.iterator().each(function(key, error) {
            log.error({ title: 'Map Error', details: 'Key: ' + key + ', Error: ' + error });
            return true;
        });

        // Log reduce errors
        summary.reduceSummary.errors.iterator().each(function(key, error) {
            log.error({ title: 'Reduce Error', details: 'Key: ' + key + ', Error: ' + error });
            return true;
        });

        // Calculate statistics
        let totalProcessed = 0;
        let totalAmount = 0;

        summary.output.iterator().each(function(key, value) {
            const data = JSON.parse(value);
            totalProcessed += data.count;
            totalAmount += data.total;
            return true;
        });

        log.audit({
            title: 'Map/Reduce Complete',
            details: JSON.stringify({
                recordsProcessed: totalProcessed,
                totalAmount: totalAmount,
                mapErrors: summary.mapSummary.errors.length,
                reduceErrors: summary.reduceSummary.errors.length,
                dateRun: new Date().toISOString()
            })
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
```

## Pattern: Record Transformation

```javascript
/**
 * Transform records from one type to another
 */
function getInputData() {
    return search.create({
        type: 'salesorder',
        filters: [
            ['status', 'anyof', 'SalesOrd:B'],  // Pending Fulfillment
            'AND',
            ['custbody_ready_to_fulfill', 'is', 'T']
        ],
        columns: ['internalid']
    });
}

function map(context) {
    const data = JSON.parse(context.value);
    const soId = data.id;

    try {
        // Transform Sales Order to Item Fulfillment
        const ifRec = record.transform({
            fromType: record.Type.SALES_ORDER,
            fromId: soId,
            toType: record.Type.ITEM_FULFILLMENT
        });

        const ifId = ifRec.save();

        context.write({
            key: soId,
            value: { fulfillmentId: ifId, status: 'success' }
        });

    } catch (e) {
        context.write({
            key: soId,
            value: { status: 'error', message: e.message }
        });
    }
}

function summarize(summary) {
    let success = 0;
    let failed = 0;

    summary.output.iterator().each(function(key, value) {
        const data = JSON.parse(value);
        if (data.status === 'success') {
            success++;
        } else {
            failed++;
            log.error({ title: 'Transform Failed', details: 'SO: ' + key + ', Error: ' + data.message });
        }
        return true;
    });

    log.audit({
        title: 'Transform Complete',
        details: 'Success: ' + success + ', Failed: ' + failed
    });
}
```

## Pattern: Data Aggregation

```javascript
/**
 * Aggregate sales data by region
 */
function getInputData() {
    return search.create({
        type: 'salesorder',
        filters: [
            ['trandate', 'within', 'lastmonth'],
            'AND',
            ['mainline', 'is', 'T']
        ],
        columns: ['subsidiary', 'total', 'entity']
    });
}

function map(context) {
    const data = JSON.parse(context.value);

    // Emit by subsidiary (region)
    context.write({
        key: data.values.subsidiary.value,
        value: {
            orderId: data.id,
            amount: parseFloat(data.values.total),
            customer: data.values.entity.value
        }
    });
}

function reduce(context) {
    const subsidiaryId = context.key;
    let totalSales = 0;
    let orderCount = 0;
    const customers = new Set();

    context.values.forEach(function(value) {
        const data = JSON.parse(value);
        totalSales += data.amount;
        orderCount++;
        customers.add(data.customer);
    });

    // Create or update summary record
    record.create({
        type: 'customrecord_sales_summary',
        values: {
            custrecord_period: 'lastmonth',
            custrecord_subsidiary: subsidiaryId,
            custrecord_total_sales: totalSales,
            custrecord_order_count: orderCount,
            custrecord_unique_customers: customers.size
        }
    }).save();

    context.write({
        key: subsidiaryId,
        value: { total: totalSales, orders: orderCount }
    });
}
```

## Pattern: External API Integration

```javascript
/**
 * Sync records to external system in parallel
 */
function getInputData() {
    return search.create({
        type: 'customer',
        filters: [
            ['custentity_sync_needed', 'is', 'T'],
            'AND',
            ['isinactive', 'is', 'F']
        ],
        columns: ['entityid', 'email', 'companyname', 'phone']
    });
}

function map(context) {
    const data = JSON.parse(context.value);

    try {
        // Call external API
        const response = https.post({
            url: 'https://external-api.com/customers',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getApiToken()
            },
            body: JSON.stringify({
                netsuiteId: data.id,
                name: data.values.companyname,
                email: data.values.email,
                phone: data.values.phone
            })
        });

        if (response.code === 200 || response.code === 201) {
            // Mark as synced
            record.submitFields({
                type: 'customer',
                id: data.id,
                values: {
                    custentity_sync_needed: false,
                    custentity_last_sync: new Date()
                }
            });

            context.write({
                key: data.id,
                value: { status: 'success' }
            });
        } else {
            throw new Error('API returned ' + response.code);
        }

    } catch (e) {
        context.write({
            key: data.id,
            value: { status: 'error', message: e.message }
        });
    }
}
```

## Pattern: Skip Reduce Stage

```javascript
/**
 * Use map-only when no aggregation needed
 */
function getInputData() {
    return search.create({
        type: 'customrecord_queue',
        filters: [['custrecord_processed', 'is', 'F']]
    });
}

function map(context) {
    const data = JSON.parse(context.value);

    // Process each record independently
    processQueueItem(data.id);

    // Mark processed
    record.submitFields({
        type: 'customrecord_queue',
        id: data.id,
        values: { custrecord_processed: true }
    });

    // Still write for summarize tracking
    context.write({
        key: data.id,
        value: 'processed'
    });
}

// reduce function omitted - not needed

function summarize(summary) {
    let count = 0;
    summary.output.iterator().each(function() {
        count++;
        return true;
    });
    log.audit({ title: 'Complete', details: 'Processed: ' + count });
}
```

## Governance Per Stage

| Stage | Governance | Parallelism |
|-------|------------|-------------|
| getInputData | 10,000 units | Single thread |
| map | 1,000 units per invocation | 50 parallel |
| reduce | 5,000 units per invocation | 50 parallel |
| summarize | 10,000 units | Single thread |

## Error Handling

```javascript
function map(context) {
    try {
        // Processing logic
    } catch (e) {
        // Log error but don't rethrow - let other items continue
        log.error({ title: 'Map Error', details: e.message });

        // Write error status for summarize
        context.write({
            key: context.key,
            value: JSON.stringify({ error: true, message: e.message })
        });
    }
}

function summarize(summary) {
    // Check for input errors
    if (summary.inputSummary.error) {
        handleInputError(summary.inputSummary.error);
        return;
    }

    // Collect all errors for notification
    const errors = [];

    summary.mapSummary.errors.iterator().each(function(key, error) {
        errors.push({ stage: 'map', key: key, error: error });
        return true;
    });

    summary.reduceSummary.errors.iterator().each(function(key, error) {
        errors.push({ stage: 'reduce', key: key, error: error });
        return true;
    });

    if (errors.length > 0) {
        notifyAdmins(errors);
    }
}
```

## Best Practices

1. **Return search in getInputData** - Most efficient for large datasets
2. **Keep map functions lightweight** - Heavy processing in reduce
3. **Use meaningful keys** - Key determines reduce grouping
4. **Handle errors in each stage** - Don't let one failure stop all processing
5. **Track progress in summarize** - Log statistics and errors
6. **Consider governance per stage** - map has only 1,000 units

## When to Use Map/Reduce vs Scheduled

| Use Map/Reduce | Use Scheduled |
|----------------|---------------|
| > 1000 records | < 1000 records |
| Parallel processing beneficial | Sequential order matters |
| Complex aggregation | Simple batch operations |
| Error isolation needed | All-or-nothing processing |

## See Also

- `scheduled.md` - For simpler batch jobs
- `../snippets/search-patterns.md` - Efficient search patterns
- `../snippets/governance.md` - Governance management
- `../../standards/testing.md` - Testing Map/Reduce with mock data
- `../../anti-patterns/governance-killers.md` - What to avoid at scale
