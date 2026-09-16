# REST Inbound Patterns

Patterns for external systems calling into NetSuite via RESTlets.

## Architecture Overview

```
External System → HTTPS Request → NetSuite RESTlet → Record Operations
                     │
                     ├── Authentication (TBA/OAuth)
                     ├── Request Validation
                     ├── Business Logic
                     └── Response
```

## Standard RESTlet Structure

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/record', 'N/search', 'N/log', 'N/error'], function(record, search, log, error) {

    const API_VERSION = '1.0';

    function get(requestParams) {
        try {
            validateRequest(requestParams);
            const data = processGet(requestParams);
            return success(data);
        } catch (e) {
            return handleError(e);
        }
    }

    function post(requestBody) {
        try {
            validateRequest(requestBody);
            const result = processPost(requestBody);
            return success(result);
        } catch (e) {
            return handleError(e);
        }
    }

    function put(requestBody) {
        try {
            validateRequest(requestBody);
            const result = processPut(requestBody);
            return success(result);
        } catch (e) {
            return handleError(e);
        }
    }

    function deleteRecord(requestParams) {
        try {
            validateRequest(requestParams);
            const result = processDelete(requestParams);
            return success(result);
        } catch (e) {
            return handleError(e);
        }
    }

    // Response helpers
    function success(data) {
        return {
            success: true,
            apiVersion: API_VERSION,
            data: data
        };
    }

    function handleError(e) {
        log.error({ title: 'API Error', details: e.message });
        return {
            success: false,
            apiVersion: API_VERSION,
            error: {
                code: e.name || 'UNKNOWN_ERROR',
                message: e.message
            }
        };
    }

    return {
        get: get,
        post: post,
        put: put,
        'delete': deleteRecord
    };
});
```

## Pattern: Order Import

```javascript
/**
 * Import orders from external e-commerce system
 */
function post(requestBody) {
    const orders = requestBody.orders || [requestBody];
    const results = [];

    orders.forEach(function(orderData, index) {
        try {
            const nsOrderId = createSalesOrder(orderData);
            results.push({
                externalId: orderData.externalId,
                netsuiteId: nsOrderId,
                status: 'created'
            });
        } catch (e) {
            results.push({
                externalId: orderData.externalId,
                status: 'failed',
                error: e.message
            });
        }
    });

    return {
        success: results.every(r => r.status === 'created'),
        results: results
    };
}

function createSalesOrder(orderData) {
    // Find or create customer
    const customerId = findOrCreateCustomer(orderData.customer);

    // Create sales order
    const so = record.create({
        type: record.Type.SALES_ORDER,
        isDynamic: true
    });

    // Header fields
    so.setValue('entity', customerId);
    so.setValue('otherrefnum', orderData.externalId);
    so.setValue('custbody_external_source', orderData.source);
    so.setValue('memo', 'Imported from ' + orderData.source);

    if (orderData.shippingAddress) {
        setShippingAddress(so, orderData.shippingAddress);
    }

    // Line items
    orderData.items.forEach(function(item) {
        so.selectNewLine({ sublistId: 'item' });

        // Find item by SKU
        const itemId = findItemBySku(item.sku);
        if (!itemId) {
            throw error.create({
                name: 'ITEM_NOT_FOUND',
                message: 'Item not found: ' + item.sku
            });
        }

        so.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: itemId
        });
        so.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: item.quantity
        });
        so.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            value: item.price
        });

        so.commitLine({ sublistId: 'item' });
    });

    return so.save();
}

function findItemBySku(sku) {
    const results = search.create({
        type: 'item',
        filters: [['itemid', 'is', sku]],
        columns: ['internalid']
    }).run().getRange({ start: 0, end: 1 });

    return results.length > 0 ? results[0].id : null;
}
```

## Pattern: Inventory Lookup

```javascript
/**
 * Check inventory availability
 */
function get(requestParams) {
    const skus = requestParams.skus ? requestParams.skus.split(',') : [];
    const location = requestParams.location;

    if (skus.length === 0) {
        throw error.create({
            name: 'INVALID_REQUEST',
            message: 'skus parameter is required'
        });
    }

    const inventory = [];

    skus.forEach(function(sku) {
        const item = findItemBySku(sku.trim());
        if (item) {
            const availability = getItemAvailability(item.id, location);
            inventory.push({
                sku: sku,
                itemId: item.id,
                available: availability.available,
                onHand: availability.onHand,
                committed: availability.committed,
                onOrder: availability.onOrder
            });
        } else {
            inventory.push({
                sku: sku,
                error: 'Item not found'
            });
        }
    });

    return { inventory: inventory };
}

function getItemAvailability(itemId, locationId) {
    const filters = [['internalid', 'is', itemId]];
    if (locationId) {
        filters.push('AND', ['inventorylocation', 'is', locationId]);
    }

    const results = search.create({
        type: 'item',
        filters: filters,
        columns: [
            'locationquantityavailable',
            'locationquantityonhand',
            'locationquantitycommitted',
            'locationquantityonorder'
        ]
    }).run().getRange({ start: 0, end: 1 });

    if (results.length === 0) {
        return { available: 0, onHand: 0, committed: 0, onOrder: 0 };
    }

    return {
        available: parseFloat(results[0].getValue('locationquantityavailable')) || 0,
        onHand: parseFloat(results[0].getValue('locationquantityonhand')) || 0,
        committed: parseFloat(results[0].getValue('locationquantitycommitted')) || 0,
        onOrder: parseFloat(results[0].getValue('locationquantityonorder')) || 0
    };
}
```

## Pattern: Customer Sync

```javascript
/**
 * Create or update customer from CRM
 */
function post(requestBody) {
    const externalId = requestBody.externalId;

    // Check if customer exists
    const existingId = findCustomerByExternalId(externalId);

    if (existingId) {
        return updateCustomer(existingId, requestBody);
    } else {
        return createCustomer(requestBody);
    }
}

function findCustomerByExternalId(externalId) {
    const results = search.create({
        type: 'customer',
        filters: [['custentity_external_id', 'is', externalId]],
        columns: ['internalid']
    }).run().getRange({ start: 0, end: 1 });

    return results.length > 0 ? results[0].id : null;
}

function createCustomer(data) {
    const customer = record.create({
        type: record.Type.CUSTOMER
    });

    setCustomerFields(customer, data);

    const customerId = customer.save();

    return {
        action: 'created',
        netsuiteId: customerId,
        externalId: data.externalId
    };
}

function updateCustomer(customerId, data) {
    const customer = record.load({
        type: record.Type.CUSTOMER,
        id: customerId
    });

    setCustomerFields(customer, data);
    customer.save();

    return {
        action: 'updated',
        netsuiteId: customerId,
        externalId: data.externalId
    };
}

function setCustomerFields(customer, data) {
    customer.setValue('companyname', data.companyName);
    customer.setValue('email', data.email);
    customer.setValue('phone', data.phone);
    customer.setValue('custentity_external_id', data.externalId);

    if (data.address) {
        // Handle address sublist
        customer.selectNewLine({ sublistId: 'addressbook' });
        const addressSubrecord = customer.getCurrentSublistSubrecord({
            sublistId: 'addressbook',
            fieldId: 'addressbookaddress'
        });
        addressSubrecord.setValue('addr1', data.address.line1);
        addressSubrecord.setValue('addr2', data.address.line2);
        addressSubrecord.setValue('city', data.address.city);
        addressSubrecord.setValue('state', data.address.state);
        addressSubrecord.setValue('zip', data.address.zip);
        addressSubrecord.setValue('country', data.address.country);
        customer.commitLine({ sublistId: 'addressbook' });
    }
}
```

## Pattern: Idempotent Operations

```javascript
/**
 * Ensure operations can be safely retried
 */
function post(requestBody) {
    const idempotencyKey = requestBody.idempotencyKey;

    if (!idempotencyKey) {
        throw error.create({
            name: 'MISSING_IDEMPOTENCY_KEY',
            message: 'idempotencyKey is required'
        });
    }

    // Check if already processed
    const existing = findByIdempotencyKey(idempotencyKey);
    if (existing) {
        return {
            success: true,
            data: existing,
            cached: true  // Indicate this is a cached response
        };
    }

    // Process the request
    const result = processNewRequest(requestBody);

    // Store the result with idempotency key
    storeIdempotencyResult(idempotencyKey, result);

    return {
        success: true,
        data: result,
        cached: false
    };
}

function findByIdempotencyKey(key) {
    const results = search.create({
        type: 'customrecord_api_responses',
        filters: [
            ['custrecord_idempotency_key', 'is', key],
            'AND',
            ['created', 'after', 'hoursago24']  // Expire after 24 hours
        ]
    }).run().getRange({ start: 0, end: 1 });

    if (results.length > 0) {
        return JSON.parse(results[0].getValue('custrecord_response_data'));
    }
    return null;
}
```

## Request Validation

```javascript
/**
 * Comprehensive request validation
 */
function validateRequest(request, schema) {
    const errors = [];

    // Required fields
    schema.required.forEach(function(field) {
        if (!request[field]) {
            errors.push('Missing required field: ' + field);
        }
    });

    // Type validation
    Object.keys(schema.types || {}).forEach(function(field) {
        if (request[field] && typeof request[field] !== schema.types[field]) {
            errors.push(field + ' must be of type ' + schema.types[field]);
        }
    });

    // Custom validators
    Object.keys(schema.validators || {}).forEach(function(field) {
        if (request[field] && !schema.validators[field](request[field])) {
            errors.push('Invalid value for ' + field);
        }
    });

    if (errors.length > 0) {
        throw error.create({
            name: 'VALIDATION_ERROR',
            message: errors.join('; ')
        });
    }
}

// Usage
const orderSchema = {
    required: ['externalId', 'items', 'customer'],
    types: {
        externalId: 'string',
        items: 'object'  // array
    },
    validators: {
        items: function(items) {
            return Array.isArray(items) && items.length > 0;
        }
    }
};

validateRequest(requestBody, orderSchema);
```

## Rate Limiting

```javascript
/**
 * Simple rate limiting
 */
function checkRateLimit(clientId) {
    const LIMIT = 100;  // requests per minute
    const WINDOW = 60000;  // 1 minute in ms

    const cacheKey = 'ratelimit_' + clientId;
    const now = Date.now();

    // Get current count (would use cache in production)
    let rateData = getRateLimitData(clientId);

    // Reset if window expired
    if (now - rateData.windowStart > WINDOW) {
        rateData = { windowStart: now, count: 0 };
    }

    // Check limit
    if (rateData.count >= LIMIT) {
        throw error.create({
            name: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Limit: ' + LIMIT + ' per minute'
        });
    }

    // Increment
    rateData.count++;
    setRateLimitData(clientId, rateData);
}
```

## Best Practices

1. **Version your API** - Include version in response
2. **Validate early** - Catch errors before processing
3. **Use idempotency keys** - For safe retries
4. **Log everything** - Request, response, errors
5. **Return consistent structure** - Always success/error format
6. **Handle partial failures** - In batch operations
7. **Document your API** - For external consumers

## See Also

- `../suitescript/patterns/restlet.md` - RESTlet script patterns
- `../error-handling.md` - Error handling strategies
- `field-mapping/template.md` - Field mapping documentation
