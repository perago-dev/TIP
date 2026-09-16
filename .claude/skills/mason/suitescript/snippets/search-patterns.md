# Search Patterns

Common patterns for searching records in NetSuite.

## Basic Search

### Create and Run

```javascript
const searchResults = search.create({
    type: 'salesorder',
    filters: [
        ['status', 'anyof', 'SalesOrd:A', 'SalesOrd:B'],
        'AND',
        ['mainline', 'is', 'T']
    ],
    columns: [
        'tranid',
        'entity',
        'total',
        'trandate'
    ]
}).run();

// Process results
searchResults.each(function(result) {
    const orderId = result.id;
    const orderNum = result.getValue('tranid');
    const customer = result.getText('entity');  // Text for select fields
    const total = result.getValue('total');

    log.debug({ title: 'Order', details: orderNum + ': ' + total });

    return true;  // Continue iteration
});
```

### Get All Results (up to 4000)

```javascript
const allResults = search.create({
    type: 'customer',
    filters: [['isinactive', 'is', 'F']]
}).run().getRange({ start: 0, end: 1000 });

// allResults is an array
allResults.forEach(function(result) {
    // Process each result
});
```

## Filter Patterns

### Basic Operators

```javascript
// Equals
['status', 'is', 'A']

// Not equals
['status', 'isnot', 'A']

// Any of (OR within field)
['status', 'anyof', 'A', 'B', 'C']

// None of
['status', 'noneof', 'A', 'B']

// Contains
['memo', 'contains', 'urgent']

// Does not contain
['memo', 'doesnotcontain', 'test']

// Starts with
['tranid', 'startswith', 'SO']

// Is empty
['custbody_field', 'isempty', '']

// Is not empty
['custbody_field', 'isnotempty', '']
```

### Numeric Operators

```javascript
// Greater than
['amount', 'greaterthan', 1000]

// Greater than or equal
['amount', 'greaterthanorequalto', 1000]

// Less than
['amount', 'lessthan', 5000]

// Between
['amount', 'between', 1000, 5000]

// Not between
['amount', 'notbetween', 100, 200]
```

### Date Operators

```javascript
// Specific date
['trandate', 'on', '1/15/2024']

// Before/after
['trandate', 'before', '1/1/2024']
['trandate', 'after', '12/31/2023']

// Within date range
['trandate', 'within', '1/1/2024', '1/31/2024']

// Relative dates
['trandate', 'within', 'today']
['trandate', 'within', 'yesterday']
['trandate', 'within', 'thisweek']
['trandate', 'within', 'lastweek']
['trandate', 'within', 'thismonth']
['trandate', 'within', 'lastmonth']
['trandate', 'within', 'thisquarter']
['trandate', 'within', 'lastquarter']
['trandate', 'within', 'thisyear']
['trandate', 'within', 'lastyear']

// Not within
['trandate', 'notwithin', 'thismonth']

// On or before/after
['trandate', 'onorbefore', '1/31/2024']
['trandate', 'onorafter', '1/1/2024']
```

### Compound Filters

```javascript
// AND (default between arrays)
[
    ['status', 'is', 'A'],
    'AND',
    ['total', 'greaterthan', 1000]
]

// OR
[
    ['status', 'is', 'A'],
    'OR',
    ['status', 'is', 'B']
]

// Complex grouping with formula
[
    ['mainline', 'is', 'T'],
    'AND',
    [
        ['status', 'anyof', 'SalesOrd:A'],
        'OR',
        ['total', 'greaterthan', 10000]
    ]
]
```

### Join Filters

```javascript
// Filter on related record (customer on sales order)
['customer.salesrep', 'is', salesRepId]

// Filter on parent record
['parent.internalid', 'is', parentId]

// Filter on transaction line
['item.type', 'is', 'InvtPart']
```

## Column Patterns

### Basic Columns

```javascript
columns: [
    'internalid',
    'tranid',
    'entity',
    'total',
    'trandate'
]
```

### Columns with Options

```javascript
columns: [
    search.createColumn({ name: 'trandate', sort: search.Sort.DESC }),
    search.createColumn({ name: 'total', summary: search.Summary.SUM }),
    search.createColumn({ name: 'internalid', summary: search.Summary.COUNT, label: 'Order Count' })
]
```

### Join Columns

```javascript
columns: [
    search.createColumn({ name: 'internalid' }),
    search.createColumn({ name: 'tranid' }),
    search.createColumn({ name: 'companyname', join: 'customer' }),
    search.createColumn({ name: 'email', join: 'customer' }),
    search.createColumn({ name: 'salesrep', join: 'customer' })
]
```

### Formula Columns

```javascript
columns: [
    search.createColumn({
        name: 'formulanumeric',
        formula: '{quantity} * {rate}'
    }),
    search.createColumn({
        name: 'formulatext',
        formula: "CONCAT({firstname}, ' ', {lastname})"
    }),
    search.createColumn({
        name: 'formuladate',
        formula: "ADD_MONTHS({trandate}, 1)"
    }),
    search.createColumn({
        name: 'formulacurrency',
        formula: '{amount} * 1.1'  // 10% markup
    })
]
```

## Aggregation Patterns

### Group By with Summary

```javascript
const salesByCustomer = search.create({
    type: 'salesorder',
    filters: [
        ['mainline', 'is', 'T'],
        'AND',
        ['trandate', 'within', 'thismonth']
    ],
    columns: [
        search.createColumn({
            name: 'entity',
            summary: search.Summary.GROUP
        }),
        search.createColumn({
            name: 'total',
            summary: search.Summary.SUM
        }),
        search.createColumn({
            name: 'internalid',
            summary: search.Summary.COUNT
        })
    ]
});
```

### Summary Types

```javascript
search.Summary.GROUP      // Group by this column
search.Summary.SUM        // Sum of values
search.Summary.AVG        // Average
search.Summary.MIN        // Minimum value
search.Summary.MAX        // Maximum value
search.Summary.COUNT      // Count of records
```

## Lookup Fields (Single Record)

```javascript
// More efficient than search for single record
const fieldValues = search.lookupFields({
    type: 'customer',
    id: customerId,
    columns: ['companyname', 'email', 'phone', 'salesrep', 'custentity_custom']
});

// Access values
const companyName = fieldValues.companyname;
const email = fieldValues.email;

// Select fields return array
const salesRepId = fieldValues.salesrep[0]?.value;
const salesRepName = fieldValues.salesrep[0]?.text;
```

## Load Saved Search

```javascript
// Load by ID
const savedSearch = search.load({
    id: 'customsearch_my_search'
});

// Add runtime filters
savedSearch.filters.push(
    search.createFilter({
        name: 'trandate',
        operator: search.Operator.WITHIN,
        values: ['thismonth']
    })
);

// Run
savedSearch.run().each(function(result) {
    // Process
    return true;
});
```

## Pagination Pattern

```javascript
function getAllResults(searchObj) {
    const results = [];
    let start = 0;
    const pageSize = 1000;

    do {
        const pagedResults = searchObj.run().getRange({
            start: start,
            end: start + pageSize
        });

        results.push(...pagedResults);
        start += pageSize;

    } while (pagedResults && pagedResults.length === pageSize);

    return results;
}
```

## Efficient Search Pattern

```javascript
function processLargeSearch(searchObj, callback) {
    const pagedData = searchObj.runPaged({ pageSize: 1000 });

    pagedData.pageRanges.forEach(function(pageRange) {
        const page = pagedData.fetch({ index: pageRange.index });

        page.data.forEach(function(result) {
            callback(result);
        });
    });
}

// Usage
processLargeSearch(mySearch, function(result) {
    log.debug({ title: 'Processing', details: result.id });
});
```

## Common Search Types

| Type | Record |
|------|--------|
| `transaction` | All transaction types |
| `salesorder` | Sales Orders |
| `invoice` | Invoices |
| `purchaseorder` | Purchase Orders |
| `customer` | Customers |
| `vendor` | Vendors |
| `employee` | Employees |
| `item` | All item types |
| `inventoryitem` | Inventory Items |
| `customrecord_x` | Custom Records |

## Best Practices

1. **Use lookupFields for single records** - 1 unit vs 10 for search
2. **Add mainline filter** - For transaction searches
3. **Limit columns** - Only request needed fields
4. **Use pagination** - For large result sets
5. **Index custom fields** - If frequently searched
6. **Avoid formula filters** - They're slow

## Common Mistakes

```javascript
// WRONG: Loading record to get one field
const rec = record.load({ type: 'customer', id: id });
const email = rec.getValue('email');

// RIGHT: Use lookupFields
const fields = search.lookupFields({
    type: 'customer',
    id: id,
    columns: ['email']
});
const email = fields.email;
```

## See Also

- `record-operations.md` - Working with search results
- `governance.md` - Search governance costs
- `../gotchas.md` - Search pitfalls
