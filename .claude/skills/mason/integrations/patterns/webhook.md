# Webhook Patterns

Patterns for event-driven integrations using webhooks.

## Outbound Webhooks (NetSuite → External)

### User Event Trigger

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * Send webhook notification on record changes
 */
define(['N/https', 'N/record', 'N/log', 'N/runtime', 'N/encode', 'N/crypto'],
function(https, record, log, runtime, encode, crypto) {

    function afterSubmit(context) {
        // Determine event type
        const eventType = mapContextType(context.type);
        if (!eventType) return;

        const rec = context.newRecord;

        // Build webhook payload
        const payload = {
            event: 'salesorder.' + eventType,
            timestamp: new Date().toISOString(),
            data: {
                id: rec.id,
                recordType: rec.type,
                tranid: rec.getValue('tranid'),
                entity: rec.getValue('entity'),
                total: rec.getValue('total'),
                status: rec.getText('status')
            }
        };

        // Include changed fields for updates
        if (context.type === context.UserEventType.EDIT) {
            payload.changes = getChangedFields(context.oldRecord, context.newRecord);
        }

        // Send asynchronously (don't block)
        sendWebhookAsync(payload);
    }

    function mapContextType(type) {
        const mapping = {
            'create': 'created',
            'edit': 'updated',
            'delete': 'deleted'
        };
        return mapping[type];
    }

    function sendWebhookAsync(payload) {
        try {
            const webhookUrl = runtime.getCurrentScript()
                .getParameter({ name: 'custscript_webhook_url' });

            // Sign payload
            const signature = signPayload(payload);

            const response = https.post({
                url: webhookUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                    'X-Webhook-Timestamp': payload.timestamp
                },
                body: JSON.stringify(payload)
            });

            log.audit({
                title: 'Webhook Sent',
                details: 'Event: ' + payload.event + ', Response: ' + response.code
            });

        } catch (e) {
            log.error({
                title: 'Webhook Failed',
                details: e.message
            });

            // Queue for retry
            queueWebhook(payload);
        }
    }

    function signPayload(payload) {
        const secret = getWebhookSecret();
        const message = JSON.stringify(payload);

        const secretKey = crypto.createSecretKey({
            secret: secret,
            encoding: encode.Encoding.UTF_8
        });

        const hmac = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secretKey
        });

        hmac.update({ input: message });

        return hmac.digest({ outputEncoding: encode.Encoding.HEX });
    }

    return {
        afterSubmit: afterSubmit
    };
});
```

### Webhook Queue for Reliability

```javascript
/**
 * Queue failed webhooks for retry
 */
function queueWebhook(payload) {
    record.create({
        type: 'customrecord_webhook_queue',
        values: {
            custrecord_webhook_payload: JSON.stringify(payload),
            custrecord_webhook_attempts: 0,
            custrecord_webhook_status: 'pending',
            custrecord_webhook_next_attempt: new Date()
        }
    }).save();
}

/**
 * Scheduled script to process webhook queue
 */
function processWebhookQueue(context) {
    const scriptObj = runtime.getCurrentScript();

    search.create({
        type: 'customrecord_webhook_queue',
        filters: [
            ['custrecord_webhook_status', 'is', 'pending'],
            'AND',
            ['custrecord_webhook_next_attempt', 'onorbefore', 'now'],
            'AND',
            ['custrecord_webhook_attempts', 'lessthan', 5]
        ]
    }).run().each(function(result) {
        if (scriptObj.getRemainingUsage() < 500) return false;

        const queueId = result.id;
        const payload = JSON.parse(result.getValue('custrecord_webhook_payload'));
        const attempts = parseInt(result.getValue('custrecord_webhook_attempts')) || 0;

        try {
            sendWebhook(payload);

            // Mark as sent
            record.submitFields({
                type: 'customrecord_webhook_queue',
                id: queueId,
                values: {
                    custrecord_webhook_status: 'sent',
                    custrecord_webhook_sent_at: new Date()
                }
            });

        } catch (e) {
            // Increment attempts and schedule retry
            const nextAttempt = new Date();
            nextAttempt.setMinutes(nextAttempt.getMinutes() + Math.pow(2, attempts));

            record.submitFields({
                type: 'customrecord_webhook_queue',
                id: queueId,
                values: {
                    custrecord_webhook_attempts: attempts + 1,
                    custrecord_webhook_next_attempt: nextAttempt,
                    custrecord_webhook_last_error: e.message,
                    custrecord_webhook_status: attempts >= 4 ? 'failed' : 'pending'
                }
            });
        }

        return true;
    });
}
```

## Inbound Webhooks (External → NetSuite)

### RESTlet Webhook Receiver

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 *
 * Receive and process webhooks
 */
define(['N/record', 'N/log', 'N/crypto', 'N/encode', 'N/error'],
function(record, log, crypto, encode, error) {

    function post(requestBody) {
        try {
            // Verify signature
            const signature = requestBody._signature;
            delete requestBody._signature;

            if (!verifySignature(requestBody, signature)) {
                return {
                    success: false,
                    error: 'Invalid signature'
                };
            }

            // Route by event type
            const handler = getEventHandler(requestBody.event);
            if (!handler) {
                log.audit({
                    title: 'Unknown Event',
                    details: requestBody.event
                });
                return { success: true, message: 'Event type not handled' };
            }

            // Process event
            const result = handler(requestBody.data);

            return {
                success: true,
                result: result
            };

        } catch (e) {
            log.error({ title: 'Webhook Error', details: e.message });
            return {
                success: false,
                error: e.message
            };
        }
    }

    function verifySignature(payload, signature) {
        const secret = getWebhookSecret();
        const message = JSON.stringify(payload);

        const secretKey = crypto.createSecretKey({
            secret: secret,
            encoding: encode.Encoding.UTF_8
        });

        const hmac = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secretKey
        });

        hmac.update({ input: message });
        const expectedSignature = hmac.digest({ outputEncoding: encode.Encoding.HEX });

        return signature === expectedSignature;
    }

    function getEventHandler(eventType) {
        const handlers = {
            'order.created': handleOrderCreated,
            'order.updated': handleOrderUpdated,
            'customer.created': handleCustomerCreated,
            'payment.completed': handlePaymentCompleted
        };
        return handlers[eventType];
    }

    function handleOrderCreated(data) {
        // Create sales order from webhook data
        const so = record.create({
            type: record.Type.SALES_ORDER,
            isDynamic: true
        });

        so.setValue('entity', findCustomer(data.customerId));
        so.setValue('otherrefnum', data.externalOrderId);

        data.items.forEach(function(item) {
            so.selectNewLine({ sublistId: 'item' });
            so.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: findItem(item.sku)
            });
            so.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: item.quantity
            });
            so.commitLine({ sublistId: 'item' });
        });

        const soId = so.save();
        return { netsuiteId: soId };
    }

    return {
        post: post
    };
});
```

### Idempotent Webhook Processing

```javascript
/**
 * Ensure webhooks are processed exactly once
 */
function post(requestBody) {
    const eventId = requestBody.eventId;

    // Check if already processed
    const existing = findProcessedEvent(eventId);
    if (existing) {
        log.audit({
            title: 'Duplicate Webhook',
            details: 'Event ' + eventId + ' already processed'
        });
        return {
            success: true,
            message: 'Already processed',
            cached: true
        };
    }

    // Mark as processing (prevent concurrent processing)
    const eventRecordId = createEventRecord(eventId, 'processing');

    try {
        // Process the webhook
        const result = processWebhook(requestBody);

        // Mark as completed
        updateEventRecord(eventRecordId, 'completed', result);

        return {
            success: true,
            result: result
        };

    } catch (e) {
        // Mark as failed
        updateEventRecord(eventRecordId, 'failed', e.message);
        throw e;
    }
}

function findProcessedEvent(eventId) {
    const results = search.create({
        type: 'customrecord_webhook_events',
        filters: [
            ['custrecord_event_id', 'is', eventId],
            'AND',
            ['custrecord_event_status', 'anyof', ['completed', 'processing']]
        ]
    }).run().getRange({ start: 0, end: 1 });

    return results.length > 0 ? results[0] : null;
}
```

## Webhook Event Types

### Standard Events to Emit

```javascript
const WEBHOOK_EVENTS = {
    // Orders
    'salesorder.created': { trigger: 'afterSubmit', context: 'create' },
    'salesorder.updated': { trigger: 'afterSubmit', context: 'edit' },
    'salesorder.approved': { trigger: 'workflow' },
    'salesorder.fulfilled': { trigger: 'afterSubmit', related: 'itemfulfillment' },

    // Customers
    'customer.created': { trigger: 'afterSubmit', context: 'create' },
    'customer.updated': { trigger: 'afterSubmit', context: 'edit' },

    // Inventory
    'inventory.adjusted': { trigger: 'afterSubmit', recordType: 'inventoryadjustment' },
    'inventory.low': { trigger: 'scheduled', condition: 'quantity < reorder_point' },

    // Payments
    'payment.received': { trigger: 'afterSubmit', recordType: 'customerpayment' },
    'invoice.paid': { trigger: 'afterSubmit', context: 'edit', condition: 'status = paidInFull' }
};
```

### Payload Standards

```javascript
// Standard webhook payload structure
const payload = {
    // Metadata
    id: generateEventId(),           // Unique event ID
    event: 'salesorder.created',     // Event type
    timestamp: new Date().toISOString(),
    source: 'netsuite',
    environment: getEnvironment(),   // 'production' or 'sandbox'

    // Data
    data: {
        recordType: 'salesorder',
        recordId: rec.id,
        // ... record-specific fields
    },

    // For updates
    changes: {
        // Old and new values for changed fields
    }
};
```

## Webhook Security

### Signature Verification

```javascript
// Signing (sender)
function signPayload(payload, secret) {
    const hmac = crypto.createHmac({
        algorithm: crypto.HashAlg.SHA256,
        key: crypto.createSecretKey({
            secret: secret,
            encoding: encode.Encoding.UTF_8
        })
    });
    hmac.update({ input: JSON.stringify(payload) });
    return hmac.digest({ outputEncoding: encode.Encoding.HEX });
}

// Verification (receiver)
function verifyPayload(payload, signature, secret) {
    const expectedSignature = signPayload(payload, secret);
    return crypto.checkSecureCompare({
        a: signature,
        b: expectedSignature
    });
}
```

### Timestamp Validation

```javascript
// Prevent replay attacks
function validateTimestamp(timestamp) {
    const MAX_AGE_MS = 5 * 60 * 1000;  // 5 minutes

    const eventTime = new Date(timestamp).getTime();
    const now = Date.now();

    if (Math.abs(now - eventTime) > MAX_AGE_MS) {
        throw error.create({
            name: 'INVALID_TIMESTAMP',
            message: 'Webhook timestamp too old'
        });
    }
}
```

## Best Practices

1. **Sign all webhooks** - HMAC-SHA256 minimum
2. **Use idempotency keys** - Handle duplicates gracefully
3. **Implement retry logic** - With exponential backoff
4. **Queue for reliability** - Don't lose events
5. **Validate timestamps** - Prevent replay attacks
6. **Log everything** - For debugging and audit
7. **Handle partial failures** - Don't fail batch for one item

## See Also

- `rest-inbound.md` - RESTlet patterns
- `rest-outbound.md` - Outbound HTTP patterns
- `../error-handling.md` - Error handling
