# Scheduled Script Patterns

Scheduled Scripts run at specific times or intervals for batch processing. They have higher governance limits (10,000 units) but must yield for long operations.

## Standard Template

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 *
 * [Description of what this script does]
 *
 * @module [ModuleName]
 */
define(['N/search', 'N/record', 'N/runtime', 'N/log'], function(search, record, runtime, log) {

    /**
     * Main execution function
     * @param {Object} context
     * @param {string} context.type - SCHEDULED, ON_DEMAND, USER_INTERFACE, ABORTED, SKIPPED
     */
    function execute(context) {
        try {
            log.audit({ title: 'Script Start', details: context.type });

            // Get script parameters
            const scriptObj = runtime.getCurrentScript();
            const param1 = scriptObj.getParameter({ name: 'custscript_param1' });

            // Main processing logic
            processRecords(param1);

            log.audit({
                title: 'Script Complete',
                details: 'Remaining governance: ' + scriptObj.getRemainingUsage()
            });

        } catch (e) {
            log.error({ title: 'Script Error', details: e.message });
            throw e;
        }
    }

    /**
     * Process records with governance checking
     */
    function processRecords(param) {
        const scriptObj = runtime.getCurrentScript();

        const searchResults = search.create({
            type: 'salesorder',
            filters: [['status', 'anyof', 'SalesOrd:A']],
            columns: ['internalid', 'entity', 'total']
        }).run();

        let processed = 0;

        searchResults.each(function(result) {
            // Check governance before each iteration
            if (scriptObj.getRemainingUsage() < 100) {
                log.audit({
                    title: 'Governance Limit',
                    details: 'Reschedule needed. Processed: ' + processed
                });
                rescheduleScript(param);
                return false;  // Stop iteration
            }

            // Process the record
            processRecord(result);
            processed++;

            return true;  // Continue iteration
        });

        log.audit({ title: 'Processing Complete', details: 'Total processed: ' + processed });
    }

    return {
        execute: execute
    };
});
```

## Pattern: Batch Processing with Checkpointing

```javascript
/**
 * Process records with checkpoint for resume
 */
function execute(context) {
    const scriptObj = runtime.getCurrentScript();

    // Get checkpoint from parameters
    let lastProcessedId = scriptObj.getParameter({ name: 'custscript_last_id' }) || 0;

    const searchObj = search.create({
        type: 'customrecord_queue',
        filters: [
            ['internalid', 'greaterthan', lastProcessedId],
            'AND',
            ['custrecord_processed', 'is', 'F']
        ],
        columns: [
            search.createColumn({ name: 'internalid', sort: search.Sort.ASC })
        ]
    });

    let processed = 0;
    let currentId = lastProcessedId;

    searchObj.run().each(function(result) {
        if (scriptObj.getRemainingUsage() < 200) {
            // Reschedule with checkpoint
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
        details: 'Processed ' + processed + ' records from ID ' + lastProcessedId
    });
}

function rescheduleWithCheckpoint(lastId) {
    task.create({
        taskType: task.TaskType.SCHEDULED_SCRIPT,
        scriptId: 'customscript_batch_processor',
        deploymentId: 'customdeploy_batch_processor',
        params: { custscript_last_id: lastId }
    }).submit();
}
```

## Pattern: Nightly Report Generation

```javascript
/**
 * Generate and email nightly report
 */
function execute(context) {
    try {
        // Gather data
        const reportData = gatherReportData();

        // Generate report content
        const reportHtml = generateReportHtml(reportData);

        // Create file
        const reportFile = file.create({
            name: 'DailyReport_' + formatDate(new Date()) + '.html',
            fileType: file.Type.HTMLDOC,
            contents: reportHtml,
            folder: REPORTS_FOLDER_ID
        });
        const fileId = reportFile.save();

        // Send email with attachment
        email.send({
            author: SENDER_ID,
            recipients: getReportRecipients(),
            subject: 'Daily Report - ' + formatDate(new Date()),
            body: 'Please find attached the daily report.',
            attachments: [file.load({ id: fileId })]
        });

        log.audit({ title: 'Report Sent', details: 'File ID: ' + fileId });

    } catch (e) {
        log.error({ title: 'Report Generation Failed', details: e.message });
        notifyAdmins('Report generation failed: ' + e.message);
        throw e;
    }
}
```

## Pattern: Data Cleanup/Archival

```javascript
/**
 * Archive old records
 */
function execute(context) {
    const scriptObj = runtime.getCurrentScript();
    const cutoffDate = getCutoffDate(90);  // 90 days ago

    const searchObj = search.create({
        type: 'customrecord_temp_data',
        filters: [
            ['created', 'before', cutoffDate],
            'AND',
            ['custrecord_archived', 'is', 'F']
        ]
    });

    let archived = 0;
    let deleted = 0;

    searchObj.run().each(function(result) {
        if (scriptObj.getRemainingUsage() < 100) {
            log.audit({
                title: 'Governance Limit',
                details: 'Archived: ' + archived + ', Deleted: ' + deleted
            });
            return false;
        }

        // Archive to external system or different record
        archiveRecord(result.id);
        archived++;

        // Delete original
        record.delete({
            type: 'customrecord_temp_data',
            id: result.id
        });
        deleted++;

        return true;
    });

    log.audit({
        title: 'Cleanup Complete',
        details: 'Archived: ' + archived + ', Deleted: ' + deleted
    });
}
```

## Pattern: Integration Sync

```javascript
/**
 * Sync data with external system
 */
function execute(context) {
    const scriptObj = runtime.getCurrentScript();
    const lastSyncTime = scriptObj.getParameter({ name: 'custscript_last_sync' });
    const currentTime = new Date();

    // Get records modified since last sync
    const modifiedRecords = getModifiedRecords(lastSyncTime);

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    modifiedRecords.forEach(function(rec) {
        if (scriptObj.getRemainingUsage() < 500) {
            log.audit({ title: 'Governance Limit', details: JSON.stringify(results) });
            return;
        }

        try {
            syncToExternalSystem(rec);
            results.success++;
        } catch (e) {
            results.failed++;
            results.errors.push({ id: rec.id, error: e.message });
            log.error({
                title: 'Sync Failed',
                details: 'Record ' + rec.id + ': ' + e.message
            });
        }
    });

    // Update last sync time
    updateSyncTimestamp(currentTime);

    // Log summary
    log.audit({ title: 'Sync Complete', details: JSON.stringify(results) });

    // Alert on failures
    if (results.failed > 0) {
        notifyAdmins('Sync completed with ' + results.failed + ' failures');
    }
}
```

## Pattern: Parallel Processing Setup

```javascript
/**
 * Create multiple scheduled script instances for parallel processing
 */
function execute(context) {
    const scriptObj = runtime.getCurrentScript();
    const batchSize = scriptObj.getParameter({ name: 'custscript_batch_size' }) || 1000;

    // Get total count
    const totalCount = getTotalRecordCount();
    const numBatches = Math.ceil(totalCount / batchSize);

    log.audit({
        title: 'Starting Parallel Processing',
        details: totalCount + ' records in ' + numBatches + ' batches'
    });

    // Create batch tasks
    for (let i = 0; i < numBatches; i++) {
        const startId = i * batchSize;
        const endId = startId + batchSize;

        task.create({
            taskType: task.TaskType.SCHEDULED_SCRIPT,
            scriptId: 'customscript_batch_worker',
            deploymentId: 'customdeploy_batch_worker_' + (i + 1),
            params: {
                custscript_start_id: startId,
                custscript_end_id: endId,
                custscript_batch_num: i + 1
            }
        }).submit();
    }
}
```

## Governance Management

```javascript
/**
 * Check and handle governance limits
 */
function checkGovernance(minUnits, callback) {
    const scriptObj = runtime.getCurrentScript();
    const remaining = scriptObj.getRemainingUsage();

    if (remaining < minUnits) {
        log.audit({
            title: 'Governance Threshold',
            details: 'Remaining: ' + remaining + ', Required: ' + minUnits
        });

        if (typeof callback === 'function') {
            callback();
        }

        return false;
    }

    return true;
}

// Usage
searchResults.each(function(result) {
    if (!checkGovernance(100, function() {
        rescheduleScript();
    })) {
        return false;
    }

    processRecord(result);
    return true;
});
```

## Schedule Configuration

| Schedule Type | Use Case |
|---------------|----------|
| **Daily** | Reports, cleanup, sync |
| **Hourly** | Queue processing, status checks |
| **Weekly** | Large batch jobs, archival |
| **Monthly** | Period-end processing |
| **On Demand** | Manual triggers, testing |

## Best Practices

1. **Always check governance** - Before each expensive operation
2. **Implement checkpointing** - For resumable processing
3. **Log progress** - Audit logs for monitoring
4. **Handle errors gracefully** - Log and continue or reschedule
5. **Use script parameters** - For configuration and state
6. **Consider Map/Reduce** - For >1000 records

## Common Mistakes

```javascript
// WRONG: No governance checking
searchResults.each(function(result) {
    processRecord(result);  // Will fail on large datasets
    return true;
});

// RIGHT: Check before each operation
searchResults.each(function(result) {
    if (scriptObj.getRemainingUsage() < 100) {
        rescheduleScript();
        return false;
    }
    processRecord(result);
    return true;
});
```

## See Also

- `map-reduce.md` - For high-volume processing
- `../snippets/governance.md` - Governance patterns
- `../snippets/search-patterns.md` - Search optimization
