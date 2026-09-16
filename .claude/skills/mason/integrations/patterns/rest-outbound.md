# REST Outbound Patterns

Patterns for NetSuite calling external APIs.

## Architecture Overview

```
NetSuite Script → N/https Module → External API
                      │
                      ├── Request Building
                      ├── Authentication
                      ├── Error Handling
                      └── Response Parsing
```

## Basic HTTP Calls

### GET Request

```javascript
const https = require('N/https');

function getExternalData(endpoint, params) {
    try {
        // Build URL with query params
        const queryString = Object.keys(params || {})
            .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
            .join('&');

        const url = endpoint + (queryString ? '?' + queryString : '');

        const response = https.get({
            url: url,
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + getApiToken()
            }
        });

        if (response.code === 200) {
            return JSON.parse(response.body);
        } else {
            throw new Error('API returned ' + response.code + ': ' + response.body);
        }

    } catch (e) {
        log.error({ title: 'GET Request Failed', details: e.message });
        throw e;
    }
}
```

### POST Request

```javascript
function postToExternalApi(endpoint, data) {
    try {
        const response = https.post({
            url: endpoint,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + getApiToken()
            },
            body: JSON.stringify(data)
        });

        if (response.code >= 200 && response.code < 300) {
            return JSON.parse(response.body);
        } else {
            throw new Error('API returned ' + response.code + ': ' + response.body);
        }

    } catch (e) {
        log.error({
            title: 'POST Request Failed',
            details: JSON.stringify({
                endpoint: endpoint,
                error: e.message
            })
        });
        throw e;
    }
}
```

### PUT Request

```javascript
function putToExternalApi(endpoint, data) {
    const response = https.put({
        url: endpoint,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getApiToken()
        },
        body: JSON.stringify(data)
    });

    return handleResponse(response);
}
```

### DELETE Request

```javascript
function deleteFromExternalApi(endpoint) {
    const response = https.delete({
        url: endpoint,
        headers: {
            'Authorization': 'Bearer ' + getApiToken()
        }
    });

    return handleResponse(response);
}
```

## Pattern: Webhook Notification (User Event)

```javascript
/**
 * Send webhook when order is created
 */
function afterSubmit(context) {
    if (context.type !== context.UserEventType.CREATE) return;

    const rec = context.newRecord;

    // Build payload
    const payload = {
        event: 'order.created',
        timestamp: new Date().toISOString(),
        data: {
            orderId: rec.id,
            orderNumber: rec.getValue('tranid'),
            customer: rec.getText('entity'),
            total: rec.getValue('total'),
            items: getLineItems(rec)
        }
    };

    // Send webhook (don't block on failure)
    try {
        const response = https.post({
            url: getWebhookUrl(),
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': generateSignature(payload)
            },
            body: JSON.stringify(payload)
        });

        log.audit({
            title: 'Webhook Sent',
            details: 'Order: ' + rec.id + ', Response: ' + response.code
        });

    } catch (e) {
        // Log but don't fail - record is already saved
        log.error({
            title: 'Webhook Failed',
            details: 'Order: ' + rec.id + ', Error: ' + e.message
        });

        // Queue for retry
        queueFailedWebhook(rec.id, payload);
    }
}

function generateSignature(payload) {
    const encode = require('N/encode');
    const crypto = require('N/crypto');

    const secretKey = crypto.createSecretKey({
        secret: getWebhookSecret(),
        encoding: encode.Encoding.UTF_8
    });

    const hmac = crypto.createHmac({
        algorithm: crypto.HashAlg.SHA256,
        key: secretKey
    });

    hmac.update({ input: JSON.stringify(payload) });

    return hmac.digest({ outputEncoding: encode.Encoding.HEX });
}
```

## Pattern: Retry with Exponential Backoff

```javascript
function callWithRetry(fn, maxRetries, initialDelay) {
    maxRetries = maxRetries || 3;
    initialDelay = initialDelay || 1000;

    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return fn();
        } catch (e) {
            lastError = e;

            // Don't retry on client errors (4xx)
            if (e.code && e.code >= 400 && e.code < 500) {
                throw e;
            }

            log.debug({
                title: 'Retry attempt ' + (attempt + 1),
                details: e.message
            });

            if (attempt < maxRetries - 1) {
                // Exponential backoff
                const delay = initialDelay * Math.pow(2, attempt);
                sleep(delay);
            }
        }
    }

    throw lastError;
}

function sleep(ms) {
    // NetSuite doesn't have native sleep, so we busy-wait
    // This is generally not recommended - consider async patterns
    const start = Date.now();
    while (Date.now() - start < ms) {
        // Wait
    }
}

// Usage
const result = callWithRetry(function() {
    return https.post({
        url: endpoint,
        body: JSON.stringify(data)
    });
}, 3, 1000);
```

## Pattern: OAuth 2.0 Authentication

```javascript
/**
 * OAuth 2.0 client credentials flow
 */
function getOAuthToken() {
    const tokenUrl = 'https://auth.example.com/oauth/token';

    // Build form body using URLSearchParams pattern
    const clientId = getClientId();
    const clientSecretVal = getClientSecret();

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecretVal);
    params.append('scope', 'read write');

    const formBody = params.toString();

    const response = https.post({
        url: tokenUrl,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody
    });

    if (response.code !== 200) {
        throw new Error('OAuth token request failed: ' + response.body);
    }

    const tokenData = JSON.parse(response.body);

    // Cache token
    cacheToken(tokenData.access_token, tokenData.expires_in);

    return tokenData.access_token;
}

function getCachedOrNewToken() {
    const cached = getCachedToken();
    if (cached) {
        return cached;
    }
    return getOAuthToken();
}
```

## Pattern: Batch Sync (Scheduled Script)

```javascript
/**
 * Sync orders to external system in batch
 */
function execute(context) {
    const scriptObj = runtime.getCurrentScript();

    // Get orders to sync
    const ordersToSync = search.create({
        type: 'salesorder',
        filters: [
            ['custbody_sync_needed', 'is', 'T'],
            'AND',
            ['status', 'anyof', 'SalesOrd:B']  // Pending Fulfillment
        ],
        columns: ['internalid', 'tranid', 'entity', 'total']
    }).run();

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    ordersToSync.each(function(order) {
        // Check governance
        if (scriptObj.getRemainingUsage() < 500) {
            log.audit({ title: 'Governance Limit', details: JSON.stringify(results) });
            return false;  // Stop and reschedule
        }

        try {
            // Build payload
            const payload = buildOrderPayload(order.id);

            // Send to external system
            const response = callWithRetry(function() {
                return https.post({
                    url: getExternalApiUrl() + '/orders',
                    headers: getApiHeaders(),
                    body: JSON.stringify(payload)
                });
            });

            if (response.code === 200 || response.code === 201) {
                // Mark as synced
                record.submitFields({
                    type: 'salesorder',
                    id: order.id,
                    values: {
                        custbody_sync_needed: false,
                        custbody_last_sync: new Date(),
                        custbody_external_id: JSON.parse(response.body).id
                    }
                });
                results.success++;
            } else {
                throw new Error('API returned ' + response.code);
            }

        } catch (e) {
            results.failed++;
            results.errors.push({
                orderId: order.id,
                error: e.message
            });
            log.error({
                title: 'Sync Failed',
                details: 'Order ' + order.id + ': ' + e.message
            });
        }

        return true;  // Continue to next order
    });

    log.audit({ title: 'Batch Sync Complete', details: JSON.stringify(results) });

    // Alert if failures
    if (results.failed > 0) {
        sendAlertEmail(results);
    }
}
```

## Pattern: Response Handling

```javascript
function handleResponse(response) {
    const code = response.code;
    const body = response.body;

    // Log response
    log.debug({
        title: 'API Response',
        details: 'Code: ' + code + ', Body: ' + body.substring(0, 500)
    });

    // Success (2xx)
    if (code >= 200 && code < 300) {
        try {
            return JSON.parse(body);
        } catch (e) {
            return body;  // Not JSON
        }
    }

    // Client errors (4xx)
    if (code >= 400 && code < 500) {
        let errorMessage = 'Client error: ' + code;
        try {
            const errorBody = JSON.parse(body);
            errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch (e) {
            errorMessage = body || errorMessage;
        }
        throw new Error(errorMessage);
    }

    // Server errors (5xx)
    if (code >= 500) {
        throw new Error('Server error: ' + code + ' - ' + body);
    }

    // Other
    throw new Error('Unexpected response: ' + code);
}
```

## Pattern: Circuit Breaker

```javascript
/**
 * Prevent cascading failures
 */
const CircuitBreaker = {
    state: 'CLOSED',
    failures: 0,
    lastFailure: null,
    threshold: 5,
    resetTimeout: 60000,  // 1 minute

    call: function(fn) {
        // Check if we should try
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailure > this.resetTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = fn();
            this.onSuccess();
            return result;
        } catch (e) {
            this.onFailure();
            throw e;
        }
    },

    onSuccess: function() {
        this.failures = 0;
        this.state = 'CLOSED';
    },

    onFailure: function() {
        this.failures++;
        this.lastFailure = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            log.error({
                title: 'Circuit Breaker Opened',
                details: 'Failures: ' + this.failures
            });
        }
    }
};

// Usage
try {
    const result = CircuitBreaker.call(function() {
        return https.post({ url: endpoint, body: data });
    });
} catch (e) {
    // Handle circuit breaker open or API failure
}
```

## HTTPS Module Reference

| Method | Use For |
|--------|---------|
| `https.get(options)` | GET requests |
| `https.post(options)` | POST requests |
| `https.put(options)` | PUT requests |
| `https.delete(options)` | DELETE requests |
| `https.request(options)` | Custom method |

### Options Object

```javascript
{
    url: 'https://api.example.com/endpoint',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
    },
    body: 'string or JSON.stringify(data)',
    method: 'GET|POST|PUT|DELETE|PATCH'  // For request()
}
```

## Best Practices

1. **Always handle errors** - APIs can fail
2. **Use timeouts** - NetSuite has default timeout
3. **Log requests and responses** - For debugging
4. **Implement retries** - For transient failures
5. **Use circuit breakers** - Prevent cascading failures
6. **Cache tokens** - Don't re-authenticate every call
7. **Don't block UI** - For User Event scripts

## See Also

- `../error-handling.md` - Error handling patterns
- `../suitescript/patterns/user-event.md` - User Event patterns
- `../suitescript/snippets/governance.md` - Governance for HTTP calls
