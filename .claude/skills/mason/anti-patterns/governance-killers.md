# Governance Killers

Patterns that exhaust governance units quickly.

## The Worst Offenders

### 1. Record Load in Loop

**Impact**: 10 units per iteration

```javascript
// KILLER: 1,000 items = 10,000 units (exceeds scheduled script limit)
items.forEach(function(item) {
    const itemRec = record.load({
        type: 'inventoryitem',
        id: item.id
    });
    const price = itemRec.getValue('baseprice');
});

// FIX: Single search = ~10 units total
const itemIds = items.map(i => i.id);
const priceMap = {};

search.create({
    type: 'inventoryitem',
    filters: [['internalid', 'anyof', itemIds]],
    columns: ['internalid', 'baseprice']
}).run().each(function(result) {
    priceMap[result.id] = result.getValue('baseprice');
    return true;
});
```

### 2. Load/Save Instead of submitFields

**Impact**: 30 units vs 10 units per update

```javascript
// KILLER: 100 records = 3,000 units
recordIds.forEach(function(id) {
    const rec = record.load({    // 10 units
        type: 'salesorder',
        id: id
    });
    rec.setValue('custbody_processed', true);
    rec.save();                   // 20 units
});

// FIX: 100 records = 1,000 units
recordIds.forEach(function(id) {
    record.submitFields({         // 10 units
        type: 'salesorder',
        id: id,
        values: { custbody_processed: true }
    });
});
```

### 3. Multiple Searches for Same Data

**Impact**: 10 units per duplicate search

```javascript
// KILLER: Repeated searches
function getCustomerData(customerId) {
    const name = search.lookupFields({...});      // Called many times
    const email = search.lookupFields({...});     // Same customer!
    const phone = search.lookupFields({...});     // Same customer!
}

// FIX: Single lookup
function getCustomerData(customerId) {
    const fields = search.lookupFields({
        type: 'customer',
        id: customerId,
        columns: ['companyname', 'email', 'phone']  // All at once
    });
    return fields;
}
```

### 4. Unfiltered Large Searches

**Impact**: Processing unnecessary records

```javascript
// KILLER: Gets all orders, filters in code
const allOrders = [];
search.create({
    type: 'salesorder'
    // No filters!
}).run().each(function(result) {
    allOrders.push(result);
    return true;
});

// Then filter in JavaScript
const pendingOrders = allOrders.filter(o => o.getValue('status') === 'A');

// FIX: Filter in search
search.create({
    type: 'salesorder',
    filters: [
        ['status', 'anyof', 'SalesOrd:A'],  // Filter at source
        'AND',
        ['mainline', 'is', 'T']
    ]
}).run().each(/* ... */);
```

### 5. Email Per Record

**Impact**: 20 units per email

```javascript
// KILLER: 50 orders = 1,000 units just for emails
newOrders.forEach(function(order) {
    email.send({
        author: -5,
        recipients: order.customerEmail,
        subject: 'Order Confirmation',
        body: '...'
    });
});

// FIX: Batch notifications
const emailBatches = groupBy(newOrders, 'customerEmail');
Object.keys(emailBatches).forEach(function(customerEmail) {
    const orders = emailBatches[customerEmail];
    email.send({
        author: -5,
        recipients: customerEmail,
        subject: 'Order Confirmations',
        body: buildBatchEmailBody(orders)  // All orders in one email
    });
});
```

### 6. Transform in Loop

**Impact**: 10 units per transform + 20 units per save

```javascript
// KILLER: Transform and save each
salesOrders.forEach(function(so) {
    const invoice = record.transform({  // 10 units
        fromType: 'salesorder',
        fromId: so.id,
        toType: 'invoice'
    });
    invoice.save();  // 20 units
});

// FIX: For high volume, use Map/Reduce
// getInputData returns search of orders to invoice
// map transforms each (automatic governance per invocation)
```

### 7. HTTP Call Per Record

**Impact**: 10 units per HTTP call

```javascript
// KILLER: API call for each item
items.forEach(function(item) {
    https.post({
        url: 'https://api.example.com/update',
        body: JSON.stringify({ sku: item.sku, qty: item.qty })
    });
});

// FIX: Batch API calls
const payload = items.map(item => ({ sku: item.sku, qty: item.qty }));
https.post({
    url: 'https://api.example.com/batch-update',
    body: JSON.stringify({ items: payload })
});
```

## Governance Budget Planning

### User Event (1,000 units)

```
Budget breakdown:
├── Record operations: 200 units (20%)
├── Searches: 100 units (10%)
├── External calls: 100 units (10%)
├── Processing: 400 units (40%)
└── Buffer: 200 units (20%)

Max operations:
- 10 record loads OR
- 5 load/saves OR
- 100 lookupFields OR
- 10 HTTP calls
```

### Scheduled Script (10,000 units)

```
Budget for 100 records:
├── Per record: 80 units
│   ├── Load: 10 units
│   ├── Processing: 40 units
│   ├── Save: 20 units
│   └── Buffer: 10 units
├── Setup: 500 units
└── Cleanup: 500 units

Max records with load/save: ~300
Max records with submitFields: ~900
```

### Map/Reduce

```
getInputData: 10,000 units
├── Return search object (let NS handle iteration)
└── Don't load records here

map: 1,000 units per invocation
├── Keep lightweight
├── Do lookups, not loads
└── Write minimal data to reduce

reduce: 5,000 units per invocation
├── Do heavier processing here
├── Batch operations
└── Handle errors gracefully
```

## Detection Checklist

When reviewing code, check for:

- [ ] `record.load` inside any loop
- [ ] `record.save` after `record.load` for simple field updates
- [ ] `search.lookupFields` called multiple times for same record
- [ ] `search.create` without filters
- [ ] `email.send` inside loops
- [ ] `https.get/post` inside loops
- [ ] `record.transform` inside loops
- [ ] No `getRemainingUsage()` checks in scheduled scripts

## Quick Reference

| Operation | Units | Alternative | Savings |
|-----------|-------|-------------|---------|
| record.load | 10 | search.lookupFields | 9 |
| record.load + save | 30 | submitFields | 20 |
| Multiple lookupFields | 1 each | Single lookup, all fields | N-1 |
| HTTP per record | 10 each | Batch API | 90%+ |
| Email per record | 20 each | Batch email | 90%+ |

## See Also

- `../suitescript/snippets/governance.md` - Governance management
- `../review/performance.md` - Performance review
- `INDEX.md` - All anti-patterns
