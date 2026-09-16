# Record Operations Snippets

Common patterns for creating, loading, updating, and transforming records.

## Loading Records

### Standard Load

```javascript
const rec = record.load({
    type: record.Type.SALES_ORDER,  // Or 'salesorder'
    id: recordId,
    isDynamic: false  // Static mode (default)
});
```

### Dynamic Load (for UI-like behavior)

```javascript
const rec = record.load({
    type: 'salesorder',
    id: recordId,
    isDynamic: true  // Required for some operations
});
```

### Load with Specific Fields Only

```javascript
// More efficient than full load
const values = search.lookupFields({
    type: 'customer',
    id: customerId,
    columns: ['companyname', 'email', 'phone', 'salesrep']
});

// Access values
const name = values.companyname;
const salesRep = values.salesrep[0]?.value;  // Select field returns array
```

## Creating Records

### Basic Create

```javascript
const rec = record.create({
    type: record.Type.SALES_ORDER,
    isDynamic: true
});

// Set header fields
rec.setValue('entity', customerId);
rec.setValue('trandate', new Date());
rec.setValue('memo', 'Created via script');

// Add line items (dynamic mode)
rec.selectNewLine({ sublistId: 'item' });
rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 10 });
rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: 100 });
rec.commitLine({ sublistId: 'item' });

// Save
const recordId = rec.save({
    enableSourcing: true,
    ignoreMandatoryFields: false
});
```

### Create with Initial Values

```javascript
const rec = record.create({
    type: 'customrecord_entity',
    defaultValues: {
        custrecord_parent: parentId,
        custrecord_status: 'NEW'
    }
});
```

## Updating Records

### Full Update (Load and Save)

```javascript
const rec = record.load({
    type: 'salesorder',
    id: recordId
});

rec.setValue('memo', 'Updated');
rec.setValue('custbody_custom_field', 'new value');

rec.save();
```

### Efficient Update (submitFields)

```javascript
// Best for updating a few fields - lower governance cost
record.submitFields({
    type: 'salesorder',
    id: recordId,
    values: {
        memo: 'Updated via submitFields',
        custbody_custom_field: 'new value'
    },
    options: {
        enableSourcing: false,
        ignoreMandatoryFields: false
    }
});
```

### Bulk Update Pattern

```javascript
// For multiple records
const updates = [
    { id: 1, values: { custbody_status: 'PROCESSED' } },
    { id: 2, values: { custbody_status: 'PROCESSED' } },
    { id: 3, values: { custbody_status: 'PROCESSED' } }
];

updates.forEach(function(update) {
    record.submitFields({
        type: 'customrecord_entity',
        id: update.id,
        values: update.values
    });
});
```

## Transforming Records

### Basic Transform

```javascript
// Sales Order → Item Fulfillment
const ifRec = record.transform({
    fromType: record.Type.SALES_ORDER,
    fromId: salesOrderId,
    toType: record.Type.ITEM_FULFILLMENT,
    isDynamic: true
});

// Modify if needed
ifRec.setValue('shipstatus', 'C');  // Shipped

const fulfillmentId = ifRec.save();
```

### Transform with Defaults

```javascript
// Invoice from Sales Order with custom date
const invRec = record.transform({
    fromType: record.Type.SALES_ORDER,
    fromId: salesOrderId,
    toType: record.Type.INVOICE,
    defaultValues: {
        trandate: new Date()
    }
});
```

### Common Transformations

| From | To | Notes |
|------|-----|-------|
| Sales Order | Item Fulfillment | Creates shipment |
| Sales Order | Invoice | Partial billing supported |
| Purchase Order | Item Receipt | Creates receipt |
| Purchase Order | Vendor Bill | Creates bill |
| Opportunity | Estimate | Convert to quote |
| Estimate | Sales Order | Convert quote to order |
| Invoice | Customer Payment | Apply payment |

## Copying Records

```javascript
const copiedRec = record.copy({
    type: 'salesorder',
    id: originalId,
    isDynamic: true
});

// Modify the copy
copiedRec.setValue('memo', 'Copy of ' + originalId);

const newId = copiedRec.save();
```

## Deleting Records

```javascript
// Simple delete
record.delete({
    type: 'customrecord_entity',
    id: recordId
});

// Delete with search (batch)
search.create({
    type: 'customrecord_temp',
    filters: [['created', 'before', 'lastmonth']]
}).run().each(function(result) {
    record.delete({
        type: 'customrecord_temp',
        id: result.id
    });
    return true;  // Continue iteration
});
```

## Field Operations

### Get Value

```javascript
// Simple field
const value = rec.getValue('custbody_field');

// Select field - get ID
const selectId = rec.getValue('status');

// Select field - get text
const selectText = rec.getText('status');

// Date field
const dateValue = rec.getValue('trandate');  // Returns Date object

// Check if field is empty
const isEmpty = !rec.getValue('custbody_optional');
```

### Set Value

```javascript
// Simple field
rec.setValue('memo', 'New memo');

// Select field - by value
rec.setValue('status', 'A');

// Select field - by text
rec.setText('status', 'Pending');

// Date field
rec.setValue('trandate', new Date());
rec.setValue('trandate', new Date('2024-01-15'));

// Checkbox
rec.setValue('custbody_active', true);

// Multi-select
rec.setValue('custbody_categories', [1, 2, 3]);
```

### Field Metadata

```javascript
// Get field object
const field = rec.getField({ fieldId: 'custbody_field' });

// Check if mandatory
const isMandatory = field.isMandatory;

// Check if disabled
const isDisabled = field.isDisabled;

// Get select options
const options = field.getSelectOptions();
options.forEach(function(opt) {
    log.debug({ title: 'Option', details: opt.value + ': ' + opt.text });
});
```

## Sublist Operations

See `sublist-handling.md` for detailed sublist patterns.

### Quick Reference

```javascript
// Get line count
const lineCount = rec.getLineCount({ sublistId: 'item' });

// Get sublist value (static mode)
const itemId = rec.getSublistValue({
    sublistId: 'item',
    fieldId: 'item',
    line: 0
});

// Set sublist value (static mode)
rec.setSublistValue({
    sublistId: 'item',
    fieldId: 'quantity',
    line: 0,
    value: 10
});

// Insert line
rec.insertLine({
    sublistId: 'item',
    line: 0  // Insert at beginning
});

// Remove line
rec.removeLine({
    sublistId: 'item',
    line: 0
});
```

## Governance Costs

| Operation | Typical Cost |
|-----------|--------------|
| record.load | 10 units |
| record.save | 20 units |
| record.create + save | 20 units |
| record.submitFields | 10 units |
| record.transform | 10 units |
| record.delete | 20 units |
| search.lookupFields | 1 unit |

## Best Practices

1. **Use submitFields for simple updates** - Lower governance cost
2. **Use lookupFields for reads** - Lower governance than load
3. **Batch operations** - Group multiple updates
4. **Check governance** - Before heavy operations
5. **Use dynamic mode** - When order of field setting matters
6. **Handle errors** - Wrap in try/catch

## See Also

- `sublist-handling.md` - Line-level operations
- `search-patterns.md` - Finding records to update
- `governance.md` - Managing governance limits
