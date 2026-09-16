# Error Handling Patterns

Consistent error handling for SuiteScript development.

## Standard Pattern

```javascript
try {
    // Main logic
    performOperation();

} catch (e) {
    // Log error details
    log.error({
        title: 'Operation Failed',
        details: JSON.stringify({
            message: e.message,
            name: e.name,
            stack: e.stack,
            recordId: recordId  // Include context
        })
    });

    // Re-throw to fail the operation
    throw e;
}
```

## Script Type Specific Patterns

### User Event - beforeSubmit

```javascript
function beforeSubmit(context) {
    try {
        validateRecord(context.newRecord);
    } catch (e) {
        log.error({ title: 'Validation Error', details: e.message });
        // Throw user-friendly error
        throw error.create({
            name: 'VALIDATION_ERROR',
            message: e.message,
            notifyOff: false
        });
    }
}
```

### User Event - afterSubmit

```javascript
function afterSubmit(context) {
    try {
        processAfterSave(context.newRecord);
    } catch (e) {
        // Log but don't re-throw - record is already saved
        log.error({
            title: 'Post-Save Error',
            details: 'Record ' + context.newRecord.id + ': ' + e.message
        });
        // Optionally notify admins
        notifyAdmins(e);
    }
}
```

### RESTlet

```javascript
function post(requestBody) {
    try {
        const result = processRequest(requestBody);
        return { success: true, data: result };

    } catch (e) {
        log.error({ title: 'RESTlet Error', details: e.message });

        // Return structured error (don't expose internals)
        return {
            success: false,
            error: {
                code: e.name || 'UNKNOWN_ERROR',
                message: sanitizeErrorMessage(e.message)
            }
        };
    }
}

function sanitizeErrorMessage(message) {
    // Remove stack traces, internal paths, etc.
    if (message.includes('SSS_')) {
        return 'An internal error occurred. Please contact support.';
    }
    return message;
}
```

### Scheduled Script

```javascript
function execute(context) {
    const results = { success: 0, failed: 0, errors: [] };

    searchResults.each(function(result) {
        try {
            processRecord(result.id);
            results.success++;
        } catch (e) {
            results.failed++;
            results.errors.push({
                id: result.id,
                error: e.message
            });
            log.error({
                title: 'Record Processing Error',
                details: 'ID: ' + result.id + ', Error: ' + e.message
            });
        }
        return true;  // Continue processing other records
    });

    log.audit({
        title: 'Batch Complete',
        details: JSON.stringify(results)
    });

    if (results.failed > 0) {
        notifyAdmins(results);
    }
}
```

### Map/Reduce

```javascript
function map(context) {
    try {
        const data = JSON.parse(context.value);
        processData(data);
        context.write({ key: data.id, value: 'success' });
    } catch (e) {
        log.error({
            title: 'Map Error',
            details: 'Key: ' + context.key + ', Error: ' + e.message
        });
        // Write error for summarize
        context.write({ key: context.key, value: JSON.stringify({ error: e.message }) });
    }
}

function summarize(summary) {
    // Collect and report errors
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
        log.error({ title: 'Processing Errors', details: JSON.stringify(errors) });
        sendErrorReport(errors);
    }
}
```

## Creating Custom Errors

```javascript
// Using N/error module
const error = require('N/error');

// Create error
throw error.create({
    name: 'INVALID_INPUT',
    message: 'Customer ID is required',
    notifyOff: false  // true to suppress email notification
});

// With cause (error chaining)
try {
    apiCall();
} catch (e) {
    throw error.create({
        name: 'API_ERROR',
        message: 'External API call failed',
        cause: e
    });
}
```

## Error Categories

### User Errors (Show to User)

```javascript
// Validation errors - show friendly message
throw error.create({
    name: 'VALIDATION_ERROR',
    message: 'Please enter a valid email address'
});
```

### System Errors (Log Only)

```javascript
// Internal errors - log details, show generic message
try {
    callExternalApi();
} catch (e) {
    log.error({
        title: 'API Integration Error',
        details: JSON.stringify({
            endpoint: apiUrl,
            response: e.message,
            timestamp: new Date().toISOString()
        })
    });

    throw error.create({
        name: 'SYSTEM_ERROR',
        message: 'Unable to connect to external service. Please try again later.'
    });
}
```

### Recoverable Errors

```javascript
// Retry logic for transient failures
function callWithRetry(fn, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return fn();
        } catch (e) {
            lastError = e;
            log.debug({
                title: 'Retry ' + (i + 1),
                details: e.message
            });

            // Wait before retry (exponential backoff)
            if (i < maxRetries - 1) {
                waitMs(Math.pow(2, i) * 1000);
            }
        }
    }

    throw lastError;
}
```

## Logging Patterns

### Structured Logging

```javascript
function logError(context, error, additionalData) {
    log.error({
        title: context,
        details: JSON.stringify({
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            timestamp: new Date().toISOString(),
            user: runtime.getCurrentUser().id,
            script: runtime.getCurrentScript().id,
            ...additionalData
        })
    });
}

// Usage
logError('Record Save Failed', e, { recordId: rec.id, recordType: rec.type });
```

### Log Levels

```javascript
log.debug({ title: 'Debug', details: 'Detailed info for debugging' });
log.audit({ title: 'Audit', details: 'Important business events' });
log.error({ title: 'Error', details: 'Error conditions' });
log.emergency({ title: 'Emergency', details: 'Critical failures' });
```

## Notification Patterns

### Email on Error

```javascript
function notifyOnError(error, context) {
    const scriptObj = runtime.getCurrentScript();

    email.send({
        author: -5,  // System user
        recipients: ['admin@company.com'],
        subject: 'Script Error: ' + scriptObj.id,
        body: [
            'Script: ' + scriptObj.id,
            'Deployment: ' + scriptObj.deploymentId,
            'Error: ' + error.message,
            'Context: ' + JSON.stringify(context),
            'Time: ' + new Date().toISOString()
        ].join('\n')
    });
}
```

### Error Queue

```javascript
// Queue errors for batch processing/alerting
function queueError(error, context) {
    record.create({
        type: 'customrecord_error_log',
        values: {
            custrecord_error_name: error.name,
            custrecord_error_message: error.message,
            custrecord_error_context: JSON.stringify(context),
            custrecord_error_time: new Date(),
            custrecord_error_resolved: false
        }
    }).save();
}
```

## Common NetSuite Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `SSS_MISSING_REQD_ARGUMENT` | Required parameter missing | Check function arguments |
| `INSUFFICIENT_PERMISSION` | User lacks permission | Check role permissions |
| `RCRD_DSNT_EXIST` | Record not found | Verify record ID |
| `INVALID_KEY_OR_REF` | Invalid reference | Check foreign key values |
| `EXCEEDED_MAX_USAGE_LIMIT` | Governance exhausted | Add yielding/reschedule |
| `UNEXPECTED_ERROR` | Various causes | Check script logs |
| `MISSING_REQD_FIELD` | Mandatory field empty | Set required fields |

## Best Practices

1. **Always catch and log** - Never let errors disappear
2. **Include context** - Record IDs, user, timestamp
3. **Sanitize for users** - Don't expose internal details
4. **Continue when possible** - Don't fail batch for one record
5. **Notify appropriately** - Critical errors need alerts
6. **Use error codes** - Consistent, parseable names

## See Also

- `governance.md` - Handling governance errors
- `../patterns/scheduled.md` - Batch error handling
- `../patterns/map-reduce.md` - Map/Reduce error handling
