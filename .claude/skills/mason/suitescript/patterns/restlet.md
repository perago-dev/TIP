# RESTlet Patterns

RESTlets expose NetSuite data and functionality via HTTP endpoints. Use for external integrations, mobile apps, and third-party webhooks.

## Standard Template

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * [Description of what this RESTlet does]
 *
 * @module [ModuleName]
 */
define(['N/record', 'N/search', 'N/log', 'N/error'], function(record, search, log, error) {

    /**
     * Handle GET requests - Read operations
     * @param {Object} requestParams - URL parameters
     * @returns {Object} Response data
     */
    function get(requestParams) {
        try {
            log.audit({ title: 'GET Request', details: JSON.stringify(requestParams) });

            // Validate required parameters
            if (!requestParams.id) {
                return createErrorResponse(400, 'Missing required parameter: id');
            }

            // Process request
            const result = getRecord(requestParams.id);

            return createSuccessResponse(result);

        } catch (e) {
            log.error({ title: 'GET Error', details: e.message });
            return createErrorResponse(500, e.message);
        }
    }

    /**
     * Handle POST requests - Create operations
     * @param {Object} requestBody - Request body (JSON parsed)
     * @returns {Object} Response data
     */
    function post(requestBody) {
        try {
            log.audit({ title: 'POST Request', details: JSON.stringify(requestBody) });

            // Validate request
            const validation = validateRequest(requestBody);
            if (!validation.valid) {
                return createErrorResponse(400, validation.errors);
            }

            // Create record
            const recordId = createRecord(requestBody);

            return createSuccessResponse({
                id: recordId,
                message: 'Record created successfully'
            });

        } catch (e) {
            log.error({ title: 'POST Error', details: e.message });
            return createErrorResponse(500, e.message);
        }
    }

    /**
     * Handle PUT requests - Update operations
     * @param {Object} requestBody - Request body
     * @returns {Object} Response data
     */
    function put(requestBody) {
        try {
            log.audit({ title: 'PUT Request', details: JSON.stringify(requestBody) });

            if (!requestBody.id) {
                return createErrorResponse(400, 'Missing required field: id');
            }

            const recordId = updateRecord(requestBody);

            return createSuccessResponse({
                id: recordId,
                message: 'Record updated successfully'
            });

        } catch (e) {
            log.error({ title: 'PUT Error', details: e.message });
            return createErrorResponse(500, e.message);
        }
    }

    /**
     * Handle DELETE requests - Delete operations
     * @param {Object} requestParams - URL parameters
     * @returns {Object} Response data
     */
    function deleteRecord(requestParams) {
        try {
            log.audit({ title: 'DELETE Request', details: JSON.stringify(requestParams) });

            if (!requestParams.id) {
                return createErrorResponse(400, 'Missing required parameter: id');
            }

            record.delete({
                type: 'customrecord_entity',
                id: requestParams.id
            });

            return createSuccessResponse({ message: 'Record deleted successfully' });

        } catch (e) {
            log.error({ title: 'DELETE Error', details: e.message });
            return createErrorResponse(500, e.message);
        }
    }

    // Helper functions
    function createSuccessResponse(data) {
        return {
            success: true,
            data: data
        };
    }

    function createErrorResponse(code, message) {
        return {
            success: false,
            error: {
                code: code,
                message: message
            }
        };
    }

    return {
        get: get,
        post: post,
        put: put,
        'delete': deleteRecord  // 'delete' is reserved word
    };
});
```

## Pattern: CRUD Operations

```javascript
/**
 * Complete CRUD RESTlet for custom record
 */

function get(requestParams) {
    const { id, type, filters } = requestParams;

    if (id) {
        // Get single record
        const rec = record.load({
            type: type || 'customrecord_entity',
            id: id
        });

        return {
            id: rec.id,
            name: rec.getValue('name'),
            status: rec.getValue('custrecord_status'),
            // ... other fields
        };
    } else {
        // Search records
        const searchFilters = filters ? JSON.parse(filters) : [];

        const results = [];
        search.create({
            type: type || 'customrecord_entity',
            filters: searchFilters,
            columns: ['name', 'custrecord_status']
        }).run().each(function(result) {
            results.push({
                id: result.id,
                name: result.getValue('name'),
                status: result.getValue('custrecord_status')
            });
            return results.length < 100;  // Limit results
        });

        return { count: results.length, results: results };
    }
}

function post(requestBody) {
    const rec = record.create({
        type: requestBody.recordType || 'customrecord_entity'
    });

    // Set field values
    Object.keys(requestBody.values || {}).forEach(function(fieldId) {
        rec.setValue(fieldId, requestBody.values[fieldId]);
    });

    const recordId = rec.save();
    return { id: recordId };
}

function put(requestBody) {
    const rec = record.load({
        type: requestBody.recordType || 'customrecord_entity',
        id: requestBody.id
    });

    // Update field values
    Object.keys(requestBody.values || {}).forEach(function(fieldId) {
        rec.setValue(fieldId, requestBody.values[fieldId]);
    });

    rec.save();
    return { id: requestBody.id };
}
```

## Pattern: Webhook Handler

```javascript
/**
 * Handle webhooks from external services
 */
function post(requestBody) {
    // Verify webhook signature (if applicable)
    const signature = requestBody.signature;
    if (!verifySignature(requestBody, signature)) {
        return createErrorResponse(401, 'Invalid signature');
    }

    // Route based on event type
    const eventType = requestBody.event || requestBody.type;

    switch (eventType) {
        case 'order.created':
            return handleOrderCreated(requestBody.data);
        case 'order.updated':
            return handleOrderUpdated(requestBody.data);
        case 'customer.created':
            return handleCustomerCreated(requestBody.data);
        default:
            log.audit({ title: 'Unknown Event', details: eventType });
            return createSuccessResponse({ message: 'Event type not handled' });
    }
}

function handleOrderCreated(data) {
    // Create Sales Order from external order
    const soRec = record.create({ type: record.Type.SALES_ORDER });

    // Map external fields to NetSuite fields
    soRec.setValue('entity', findCustomer(data.customer_id));
    soRec.setValue('otherrefnum', data.external_order_id);
    soRec.setValue('custbody_external_source', 'WEBHOOK');

    // Add line items
    data.line_items.forEach(function(item, index) {
        soRec.insertLine({ sublistId: 'item', line: index });
        soRec.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: findItem(item.sku)
        });
        soRec.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: item.quantity
        });
        soRec.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            value: item.price
        });
        soRec.commitLine({ sublistId: 'item' });
    });

    const soId = soRec.save();

    return createSuccessResponse({
        netsuiteId: soId,
        externalId: data.external_order_id
    });
}
```

## Pattern: Search API

```javascript
/**
 * Flexible search endpoint
 */
function post(requestBody) {
    const {
        recordType,
        filters = [],
        columns = ['internalid'],
        limit = 100,
        offset = 0
    } = requestBody;

    if (!recordType) {
        return createErrorResponse(400, 'recordType is required');
    }

    // Build search columns
    const searchColumns = columns.map(function(col) {
        if (typeof col === 'string') {
            return search.createColumn({ name: col });
        }
        return search.createColumn(col);  // Handle complex columns
    });

    // Run search
    const searchObj = search.create({
        type: recordType,
        filters: filters,
        columns: searchColumns
    });

    const results = [];
    let count = 0;

    searchObj.run().each(function(result) {
        count++;

        // Skip until offset
        if (count <= offset) return true;

        // Build result object
        const row = { id: result.id };
        columns.forEach(function(col) {
            const colName = typeof col === 'string' ? col : col.name;
            row[colName] = result.getValue(colName);

            // Include text for select fields
            const text = result.getText(colName);
            if (text) row[colName + '_text'] = text;
        });

        results.push(row);

        return results.length < limit;
    });

    return createSuccessResponse({
        results: results,
        count: results.length,
        hasMore: results.length === limit
    });
}
```

## Pattern: Batch Operations

```javascript
/**
 * Handle multiple operations in single request
 */
function post(requestBody) {
    const { operations } = requestBody;

    if (!Array.isArray(operations)) {
        return createErrorResponse(400, 'operations must be an array');
    }

    const results = [];

    operations.forEach(function(op, index) {
        try {
            let result;

            switch (op.action) {
                case 'create':
                    result = createRecord(op);
                    break;
                case 'update':
                    result = updateRecord(op);
                    break;
                case 'delete':
                    result = deleteRecord(op);
                    break;
                default:
                    throw new Error('Unknown action: ' + op.action);
            }

            results.push({
                index: index,
                success: true,
                data: result
            });

        } catch (e) {
            results.push({
                index: index,
                success: false,
                error: e.message
            });
        }
    });

    const hasErrors = results.some(function(r) { return !r.success; });

    return {
        success: !hasErrors,
        results: results,
        summary: {
            total: operations.length,
            succeeded: results.filter(function(r) { return r.success; }).length,
            failed: results.filter(function(r) { return !r.success; }).length
        }
    };
}
```

## Authentication

```javascript
/**
 * RESTlets support multiple authentication methods:
 *
 * 1. Token-Based Authentication (TBA) - Recommended
 *    - OAuth 1.0
 *    - Consumer key/secret + Token key/secret
 *
 * 2. User Credentials
 *    - Account ID + Email + Password
 *    - NLAuth header
 *
 * Example NLAuth header:
 * NLAuth nlauth_account=123456,nlauth_email=user@domain.com,nlauth_signature=password,nlauth_role=3
 *
 * Example OAuth header:
 * OAuth oauth_consumer_key="xxx",oauth_token="xxx",oauth_signature_method="HMAC-SHA256",
 *       oauth_timestamp="xxx",oauth_nonce="xxx",oauth_version="1.0",oauth_signature="xxx"
 */

// Validate API key (custom implementation)
function validateApiKey(requestBody) {
    const providedKey = requestBody.apiKey;
    const storedKey = getStoredApiKey();

    if (providedKey !== storedKey) {
        throw error.create({
            name: 'INVALID_API_KEY',
            message: 'API key validation failed'
        });
    }
}
```

## Response Formats

```javascript
// Standard success response
{
    "success": true,
    "data": {
        "id": 12345,
        "name": "Example Record"
    }
}

// Standard error response
{
    "success": false,
    "error": {
        "code": 400,
        "message": "Missing required field: name",
        "details": ["name is required", "status is required"]
    }
}

// List response with pagination
{
    "success": true,
    "data": {
        "results": [...],
        "count": 50,
        "total": 500,
        "hasMore": true,
        "nextOffset": 50
    }
}
```

## Governance Considerations

| Operation | Typical Cost |
|-----------|--------------|
| Record load | 10 units |
| Record save | 20 units |
| Search | 10 units |
| HTTP call | 10 units |
| **Total limit** | **5,000 units** |

## Best Practices

1. **Validate input early** - Return 400 for bad requests
2. **Use consistent response format** - success/error structure
3. **Log all requests** - Audit trail for debugging
4. **Handle errors gracefully** - Never expose stack traces
5. **Implement pagination** - Limit result sets
6. **Use TBA authentication** - More secure than credentials
7. **Version your API** - Include version in URL or header

## Common Mistakes

```javascript
// WRONG: Exposing internal errors
function get(params) {
    try {
        // ...
    } catch (e) {
        throw e;  // Exposes stack trace
    }
}

// RIGHT: Return safe error response
function get(params) {
    try {
        // ...
    } catch (e) {
        log.error({ title: 'Error', details: e.message });
        return createErrorResponse(500, 'Internal server error');
    }
}
```

## See Also

- `../integrations/patterns/rest-inbound.md` - Inbound integration patterns
- `../snippets/error-handling.md` - Error handling patterns
- `suitelet.md` - For custom UI needs
