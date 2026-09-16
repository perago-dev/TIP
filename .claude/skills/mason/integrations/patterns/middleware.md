# Middleware Integration Patterns

Patterns for integrating NetSuite with middleware platforms (Celigo, Workato, Dell Boomi, MuleSoft, etc.).

## When to Use Middleware

### Use Middleware When:
- Multiple systems need to sync
- Complex transformation logic required
- Non-technical users need to manage integrations
- Built-in monitoring and alerting needed
- Two-way sync with conflict resolution
- High reliability requirements

### Build Custom When:
- Simple, single integration
- Full control needed
- Cost is a major factor
- Team has strong development skills
- Integration is stable/rarely changes

## Middleware Architecture

```
                    ┌──────────────────────────┐
                    │      MIDDLEWARE          │
                    │  (Celigo/Workato/etc.)   │
                    │                          │
External Systems    │  ┌──────────────────┐   │  NetSuite
  ┌───────┐        │  │  Transformation  │   │   ┌───────┐
  │Shopify│◄──────►│  │     Logic        │◄──►│   │ REST  │
  └───────┘        │  └──────────────────┘   │   │  API   │
  ┌───────┐        │  ┌──────────────────┐   │   └───────┘
  │ Amazon│◄──────►│  │   Error Queue    │   │
  └───────┘        │  └──────────────────┘   │
  ┌───────┐        │  ┌──────────────────┐   │
  │  ERP  │◄──────►│  │   Monitoring     │   │
  └───────┘        │  └──────────────────┘   │
                    └──────────────────────────┘
```

## NetSuite Configuration for Middleware

### Token-Based Authentication Setup

1. Create Integration Record
2. Generate Consumer Key/Secret
3. Create Token for Middleware User
4. Configure Roles and Permissions

```javascript
// Middleware needs these endpoints:
// - SuiteTalk SOAP: https://ACCOUNT.suitetalk.api.netsuite.com
// - REST: https://ACCOUNT.suitetalk.api.netsuite.com/services/rest
// - RESTlet: https://ACCOUNT.restlets.api.netsuite.com/app/site/hosting/restlet.nl
```

### RESTlet for Middleware

```javascript
/**
 * Generic CRUD RESTlet for middleware
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    function get(params) {
        if (params.id) {
            return getRecord(params.recordType, params.id);
        } else {
            return searchRecords(params);
        }
    }

    function post(body) {
        return createRecord(body.recordType, body.values);
    }

    function put(body) {
        return updateRecord(body.recordType, body.id, body.values);
    }

    function deleteFunc(params) {
        return deleteRecord(params.recordType, params.id);
    }

    // Implementation functions...

    return {
        get: get,
        post: post,
        put: put,
        'delete': deleteFunc
    };
});
```

## Common Integration Patterns

### Pattern: Order Sync (E-commerce)

```
Shopify Order Created
    ↓
Middleware Flow:
    1. Receive webhook
    2. Transform order data
    3. Find/create customer in NetSuite
    4. Map products to NetSuite items
    5. Create Sales Order in NetSuite
    6. Send order confirmation back to Shopify
    7. Log success/failure
```

**Field Mapping Example:**

| Shopify Field | Transform | NetSuite Field |
|---------------|-----------|----------------|
| order_number | As-is | otherrefnum |
| customer.email | Lookup | entity |
| line_items[].sku | Lookup | item (on line) |
| line_items[].quantity | As-is | quantity |
| line_items[].price | As-is | rate |
| shipping_address | Map | shipaddress |
| created_at | Format | trandate |

### Pattern: Inventory Sync

```
Scheduled (every 15 min):
    1. Query NetSuite inventory levels
    2. Transform to channel format
    3. Update Shopify inventory
    4. Update Amazon inventory
    5. Log sync status
```

**Middleware Logic:**

```javascript
// Pseudo-code for middleware flow
function syncInventory() {
    // Get inventory from NetSuite
    const inventory = netsuiteSearch({
        type: 'item',
        columns: ['itemid', 'locationquantityavailable'],
        filters: [['isinactive', 'is', 'F']]
    });

    // Transform and send to each channel
    inventory.forEach(item => {
        const sku = item.itemid;
        const qty = Math.max(0, item.locationquantityavailable - safetyStock);

        // Update Shopify
        shopifyUpdate({
            sku: sku,
            available: qty
        });

        // Update Amazon
        amazonUpdate({
            seller_sku: sku,
            quantity: qty
        });
    });
}
```

### Pattern: Customer Sync (CRM)

```
Bidirectional Sync:

NetSuite → CRM:
    1. NetSuite customer created/updated
    2. Middleware captures change
    3. Transform to CRM format
    4. Upsert in CRM

CRM → NetSuite:
    1. CRM contact updated
    2. Middleware captures change
    3. Find matching NetSuite customer
    4. Update NetSuite record
```

**Conflict Resolution:**

```javascript
// Middleware conflict handling
function resolveConflict(netsuiteRecord, crmRecord) {
    // Option 1: Last write wins
    if (netsuiteRecord.lastModified > crmRecord.lastModified) {
        return netsuiteRecord;
    }
    return crmRecord;

    // Option 2: Source system wins
    // return sourceIsNetSuite ? netsuiteRecord : crmRecord;

    // Option 3: Manual review
    // createConflictTicket(netsuiteRecord, crmRecord);
}
```

## Error Handling in Middleware

### Error Queue Pattern

```
Flow Execution:
    ↓
Success? → Yes → Complete
    ↓
    No
    ↓
Retry (with backoff)?
    ↓
Max retries exceeded?
    ↓
    Yes → Send to Error Queue
           ↓
         Notify Admin
           ↓
         Manual Review/Fix
           ↓
         Reprocess
```

### Dead Letter Queue

Records that fail after all retries go to a dead letter queue for:
- Manual review
- Root cause analysis
- Bulk reprocessing after fix

## NetSuite RESTlet for Middleware Operations

```javascript
/**
 * Comprehensive RESTlet for middleware platforms
 */
define(['N/record', 'N/search', 'N/log', 'N/error'], function(record, search, log, error) {

    const SUPPORTED_OPERATIONS = ['get', 'create', 'update', 'delete', 'search'];

    function post(requestBody) {
        const operation = requestBody.operation;

        if (SUPPORTED_OPERATIONS.indexOf(operation) === -1) {
            return errorResponse('INVALID_OPERATION', 'Unsupported operation: ' + operation);
        }

        try {
            switch (operation) {
                case 'get':
                    return successResponse(getRecord(requestBody));
                case 'create':
                    return successResponse(createRecord(requestBody));
                case 'update':
                    return successResponse(updateRecord(requestBody));
                case 'delete':
                    return successResponse(deleteRecord(requestBody));
                case 'search':
                    return successResponse(searchRecords(requestBody));
            }
        } catch (e) {
            log.error({ title: 'Middleware Error', details: e.message });
            return errorResponse(e.name, e.message);
        }
    }

    function getRecord(params) {
        const rec = record.load({
            type: params.recordType,
            id: params.id
        });

        return extractFields(rec, params.fields);
    }

    function createRecord(params) {
        const rec = record.create({
            type: params.recordType,
            isDynamic: true
        });

        setFields(rec, params.values);
        setSublistLines(rec, params.lines);

        const id = rec.save();
        return { id: id, recordType: params.recordType };
    }

    function updateRecord(params) {
        const rec = record.load({
            type: params.recordType,
            id: params.id,
            isDynamic: true
        });

        setFields(rec, params.values);

        if (params.lines) {
            // Clear and reset sublists if specified
            setSublistLines(rec, params.lines);
        }

        rec.save();
        return { id: params.id, recordType: params.recordType };
    }

    function deleteRecord(params) {
        record.delete({
            type: params.recordType,
            id: params.id
        });
        return { deleted: true, id: params.id };
    }

    function searchRecords(params) {
        const searchObj = search.create({
            type: params.recordType,
            filters: params.filters || [],
            columns: params.columns || ['internalid']
        });

        const results = [];
        const maxResults = params.maxResults || 1000;

        searchObj.run().each(function(result) {
            const row = { id: result.id };
            (params.columns || []).forEach(function(col) {
                const colName = typeof col === 'string' ? col : col.name;
                row[colName] = result.getValue(col);
                if (result.getText(col)) {
                    row[colName + '_text'] = result.getText(col);
                }
            });
            results.push(row);
            return results.length < maxResults;
        });

        return { results: results, count: results.length };
    }

    function successResponse(data) {
        return { success: true, data: data };
    }

    function errorResponse(code, message) {
        return { success: false, error: { code: code, message: message } };
    }

    return { post: post };
});
```

## Middleware Platform Comparison

| Feature | Celigo | Workato | Dell Boomi | MuleSoft |
|---------|--------|---------|------------|----------|
| NetSuite Connector | Native | Native | Native | Native |
| Complexity | Medium | Low-Med | High | High |
| Cost | $$ | $$ | $$$ | $$$$ |
| Learning Curve | Medium | Low | High | High |
| Best For | E-commerce | Cross-app | Enterprise | Enterprise |

## Best Practices

1. **Design for failure** - Every integration will fail eventually
2. **Use idempotent operations** - Safe to retry
3. **Log everything** - You'll need it for debugging
4. **Monitor actively** - Don't wait for users to report issues
5. **Test thoroughly** - Sandbox first, always
6. **Document mappings** - Future you will thank present you
7. **Version your integrations** - Track changes over time

## See Also

- `rest-inbound.md` - RESTlet patterns
- `rest-outbound.md` - Outbound API patterns
- `../field-mapping/template.md` - Field mapping documentation
