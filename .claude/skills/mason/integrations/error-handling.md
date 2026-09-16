# Integration Error Handling

Patterns for handling errors in integrations.

## Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| **Validation** | Missing field, invalid format | Reject immediately |
| **Lookup** | Entity not found | Create or reject |
| **Business Logic** | Inventory insufficient | Queue for retry or alert |
| **System** | API timeout, network error | Retry with backoff |
| **Rate Limit** | Too many requests | Backoff and retry |
| **Authentication** | Token expired | Refresh and retry |

## Standard Error Response Format

```javascript
// Error response structure
{
    success: false,
    error: {
        code: 'VALIDATION_ERROR',    // Machine-readable code
        message: 'Customer email is required',  // Human-readable
        field: 'customer.email',     // Optional: specific field
        details: []                  // Optional: additional context
    },
    requestId: 'abc123',            // For tracking
    timestamp: '2024-01-15T10:30:00Z'
}

// Batch error response
{
    success: false,
    results: [
        { index: 0, success: true, data: { id: 123 } },
        { index: 1, success: false, error: { code: 'ITEM_NOT_FOUND', message: '...' } },
        { index: 2, success: true, data: { id: 125 } }
    ],
    summary: {
        total: 3,
        succeeded: 2,
        failed: 1
    }
}
```

## Error Codes

### Standard Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `MISSING_FIELD` | 400 | Required field not provided |
| `INVALID_FORMAT` | 400 | Field format incorrect |
| `NOT_FOUND` | 404 | Record not found |
| `DUPLICATE` | 409 | Record already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `AUTH_FAILED` | 401 | Authentication failed |
| `FORBIDDEN` | 403 | Permission denied |
| `INTERNAL_ERROR` | 500 | Unexpected error |
| `SERVICE_UNAVAILABLE` | 503 | External service down |

### NetSuite-Specific Codes

| Code | Description |
|------|-------------|
| `NS_RECORD_LOCKED` | Record being edited |
| `NS_GOVERNANCE_LIMIT` | Script usage exhausted |
| `NS_PERMISSION_DENIED` | Role lacks permission |
| `NS_INVALID_REFERENCE` | Foreign key invalid |
| `NS_MANDATORY_FIELD` | Required field missing |

## Retry Strategies

### Exponential Backoff

```javascript
/**
 * Retry with exponential backoff
 */
function retryWithBackoff(fn, maxRetries, initialDelayMs) {
    maxRetries = maxRetries || 3;
    initialDelayMs = initialDelayMs || 1000;

    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return fn();
        } catch (e) {
            lastError = e;

            // Don't retry client errors (4xx)
            if (isClientError(e)) {
                throw e;
            }

            if (attempt < maxRetries - 1) {
                const delay = initialDelayMs * Math.pow(2, attempt);
                log.debug({
                    title: 'Retry',
                    details: 'Attempt ' + (attempt + 1) + ', waiting ' + delay + 'ms'
                });
                sleep(delay);
            }
        }
    }

    throw lastError;
}

function isClientError(error) {
    const clientErrorCodes = [
        'VALIDATION_ERROR',
        'MISSING_FIELD',
        'INVALID_FORMAT',
        'NOT_FOUND',
        'DUPLICATE'
    ];
    return clientErrorCodes.indexOf(error.code) !== -1;
}
```

### Retry Based on Error Type

```javascript
function shouldRetry(error) {
    // Retry on transient errors
    const retryableCodes = [
        'RATE_LIMITED',
        'SERVICE_UNAVAILABLE',
        'INTERNAL_ERROR',
        'NS_RECORD_LOCKED',
        'NS_GOVERNANCE_LIMIT'
    ];

    // Retry on network errors
    const retryableMessages = [
        'timeout',
        'ECONNRESET',
        'ECONNREFUSED',
        'socket hang up'
    ];

    if (retryableCodes.indexOf(error.code) !== -1) {
        return true;
    }

    for (let i = 0; i < retryableMessages.length; i++) {
        if (error.message && error.message.indexOf(retryableMessages[i]) !== -1) {
            return true;
        }
    }

    return false;
}
```

## Dead Letter Queue

```javascript
/**
 * Queue failed records for manual review
 */
function queueForReview(operation, data, error) {
    record.create({
        type: 'customrecord_integration_dlq',
        values: {
            custrecord_dlq_operation: operation,
            custrecord_dlq_payload: JSON.stringify(data),
            custrecord_dlq_error_code: error.code,
            custrecord_dlq_error_message: error.message,
            custrecord_dlq_attempts: 1,
            custrecord_dlq_status: 'pending',
            custrecord_dlq_source: 'integration_name'
        }
    }).save();
}

/**
 * Process dead letter queue
 */
function processDlq(context) {
    const scriptObj = runtime.getCurrentScript();

    search.create({
        type: 'customrecord_integration_dlq',
        filters: [
            ['custrecord_dlq_status', 'is', 'pending'],
            'AND',
            ['custrecord_dlq_attempts', 'lessthan', 5]
        ]
    }).run().each(function(result) {
        if (scriptObj.getRemainingUsage() < 500) return false;

        const dlqId = result.id;
        const operation = result.getValue('custrecord_dlq_operation');
        const payload = JSON.parse(result.getValue('custrecord_dlq_payload'));
        const attempts = parseInt(result.getValue('custrecord_dlq_attempts'));

        try {
            // Retry the operation
            processOperation(operation, payload);

            // Mark as resolved
            record.submitFields({
                type: 'customrecord_integration_dlq',
                id: dlqId,
                values: {
                    custrecord_dlq_status: 'resolved',
                    custrecord_dlq_resolved_at: new Date()
                }
            });

        } catch (e) {
            // Update attempt count
            record.submitFields({
                type: 'customrecord_integration_dlq',
                id: dlqId,
                values: {
                    custrecord_dlq_attempts: attempts + 1,
                    custrecord_dlq_last_error: e.message,
                    custrecord_dlq_status: attempts >= 4 ? 'failed' : 'pending'
                }
            });
        }

        return true;
    });
}
```

## Notification Patterns

### Alert on Critical Errors

```javascript
/**
 * Send alert for critical errors
 */
function alertOnCritical(error, context) {
    const criticalCodes = [
        'AUTH_FAILED',
        'FORBIDDEN',
        'SERVICE_UNAVAILABLE'
    ];

    if (criticalCodes.indexOf(error.code) === -1) {
        return;  // Not critical
    }

    email.send({
        author: -5,  // System
        recipients: getAlertRecipients(),
        subject: 'CRITICAL: Integration Error - ' + error.code,
        body: [
            'Integration: ' + context.integrationName,
            'Error Code: ' + error.code,
            'Message: ' + error.message,
            'Time: ' + new Date().toISOString(),
            '',
            'Context:',
            JSON.stringify(context, null, 2)
        ].join('\n')
    });
}
```

### Error Summary Report

```javascript
/**
 * Send daily error summary
 */
function sendErrorSummary(context) {
    // Get errors from last 24 hours
    const errors = search.create({
        type: 'customrecord_integration_errors',
        filters: [
            ['created', 'within', 'yesterday']
        ],
        columns: [
            search.createColumn({ name: 'custrecord_error_code', summary: search.Summary.GROUP }),
            search.createColumn({ name: 'internalid', summary: search.Summary.COUNT })
        ]
    }).run().getRange({ start: 0, end: 100 });

    if (errors.length === 0) {
        return;  // No errors
    }

    // Build summary
    const summary = errors.map(function(result) {
        return result.getValue({
            name: 'custrecord_error_code',
            summary: search.Summary.GROUP
        }) + ': ' + result.getValue({
            name: 'internalid',
            summary: search.Summary.COUNT
        });
    });

    email.send({
        author: -5,
        recipients: getReportRecipients(),
        subject: 'Integration Error Summary - ' + new Date().toLocaleDateString(),
        body: 'Error counts by type:\n\n' + summary.join('\n')
    });
}
```

## Error Logging

### Structured Error Logging

```javascript
/**
 * Log error with context
 */
function logError(error, context) {
    // Create error record for tracking
    const errorRecId = record.create({
        type: 'customrecord_integration_errors',
        values: {
            custrecord_error_code: error.code,
            custrecord_error_message: truncate(error.message, 300),
            custrecord_error_source: context.source,
            custrecord_error_operation: context.operation,
            custrecord_error_payload: JSON.stringify(context.payload).substring(0, 4000),
            custrecord_error_stack: error.stack ? error.stack.substring(0, 4000) : ''
        }
    }).save();

    // Also log to script execution log
    log.error({
        title: error.code + ' - ' + context.operation,
        details: JSON.stringify({
            errorRecordId: errorRecId,
            message: error.message,
            context: context
        })
    });

    return errorRecId;
}
```

### Error Metrics

```javascript
/**
 * Track error metrics
 */
function trackError(error, context) {
    // Increment error counter
    const today = new Date().toISOString().split('T')[0];
    const metricKey = context.integration + '_' + error.code + '_' + today;

    // Upsert metric record
    const existing = findMetricRecord(metricKey);

    if (existing) {
        record.submitFields({
            type: 'customrecord_integration_metrics',
            id: existing.id,
            values: {
                custrecord_metric_count: existing.count + 1,
                custrecord_metric_last_error: new Date()
            }
        });
    } else {
        record.create({
            type: 'customrecord_integration_metrics',
            values: {
                custrecord_metric_key: metricKey,
                custrecord_metric_integration: context.integration,
                custrecord_metric_error_code: error.code,
                custrecord_metric_date: new Date(),
                custrecord_metric_count: 1
            }
        }).save();
    }
}
```

## Graceful Degradation

```javascript
/**
 * Handle external service failures gracefully
 */
function callExternalServiceWithFallback(data) {
    try {
        // Try primary service
        return callPrimaryService(data);
    } catch (e) {
        log.warning({
            title: 'Primary Service Failed',
            details: e.message
        });

        // Try fallback
        try {
            return callFallbackService(data);
        } catch (e2) {
            log.error({
                title: 'All Services Failed',
                details: e2.message
            });

            // Queue for later
            queueForRetry(data);

            // Return partial result
            return {
                status: 'queued',
                message: 'Request queued for processing'
            };
        }
    }
}
```

## Best Practices

1. **Categorize errors** - Different handling for different types
2. **Use meaningful codes** - Machine-readable error identification
3. **Include context** - Enough info to debug
4. **Implement retries** - For transient failures
5. **Use dead letter queues** - For permanent failures
6. **Alert on critical** - Don't let issues go unnoticed
7. **Track metrics** - Know your error rates
8. **Log everything** - But don't expose sensitive data

## See Also

- `patterns/rest-inbound.md` - RESTlet error handling
- `patterns/rest-outbound.md` - Outbound API error handling
- `../suitescript/snippets/error-handling.md` - Script error handling
