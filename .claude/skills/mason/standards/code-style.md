# Code Style Guide

Formatting and style standards for SuiteScript development.

## JavaScript Style

### General Rules

```javascript
// Use 'use strict' (implicit in SuiteScript 2.x modules)
// 4 spaces for indentation (not tabs)
// Single quotes for strings
// Semicolons required
// Max line length: 120 characters
```

### Variable Declarations

```javascript
// GOOD: const for values that don't change
const MAX_RETRIES = 3;
const config = getConfig();

// GOOD: let for values that change
let counter = 0;
let currentStatus = 'pending';

// BAD: var (avoid in SuiteScript 2.x)
var oldStyle = true;  // Don't use

// GOOD: Declare at point of first use
function process() {
    const data = getData();
    // ... use data
}

// BAD: Declare all at top
function process() {
    const data;  // Unused until later
    // ... lots of code
    data = getData();
}
```

### Functions

```javascript
// GOOD: Named function expressions in define()
define(['N/record'], function(record) {

    function processRecord(id) {
        // Implementation
    }

    return {
        processRecord: processRecord
    };
});

// GOOD: Arrow functions for callbacks (SuiteScript 2.1)
results.forEach((result) => {
    processResult(result);
});

// GOOD: Short arrow functions
const ids = results.map(r => r.id);

// BAD: Arrow functions for methods with 'this'
const obj = {
    value: 42,
    getValue: () => this.value  // 'this' is wrong!
};
```

### Object and Array Formatting

```javascript
// GOOD: Objects on multiple lines if > 2 properties
const config = {
    url: 'https://api.example.com',
    timeout: 5000,
    retries: 3
};

// GOOD: Short objects on one line
const point = { x: 10, y: 20 };

// GOOD: Trailing comma for multi-line
const items = [
    'first',
    'second',
    'third',  // Trailing comma OK
];

// GOOD: Array destructuring
const [first, second] = getItems();

// GOOD: Object destructuring
const { name, email } = getCustomer();
```

### Control Flow

```javascript
// GOOD: Braces always, even for single statements
if (condition) {
    doSomething();
}

// BAD: No braces
if (condition)
    doSomething();

// GOOD: Early return for guard clauses
function processOrder(order) {
    if (!order) {
        return null;
    }

    if (order.status === 'cancelled') {
        return null;
    }

    // Main logic here
}

// GOOD: Switch with explicit breaks
switch (status) {
    case 'A':
        handlePending();
        break;
    case 'B':
        handleProcessing();
        break;
    default:
        handleUnknown();
}
```

### Error Handling

```javascript
// GOOD: Specific error messages
throw error.create({
    name: 'VALIDATION_ERROR',
    message: 'Customer ID is required for order creation'
});

// BAD: Generic error
throw new Error('Error');

// GOOD: Catch and log with context
try {
    processRecord(recordId);
} catch (e) {
    log.error({
        title: 'Process Failed',
        details: JSON.stringify({
            recordId: recordId,
            error: e.message
        })
    });
    throw e;
}
```

### Spacing

```javascript
// Operators with spaces
const total = price * quantity;
const isValid = count > 0 && count < 100;

// Function calls - no space before paren
doSomething();
Math.max(a, b);

// Control structures - space before paren
if (condition) { }
for (let i = 0; i < 10; i++) { }
while (condition) { }

// Object properties - no space before colon
const obj = { key: 'value' };

// Array brackets - no space inside
const arr = [1, 2, 3];

// Function params - no space inside parens
function process(param1, param2) { }
```

### Comments

```javascript
// GOOD: Explain WHY, not WHAT
// Use customer's preferred currency to avoid conversion fees
const currency = customer.preferredCurrency;

// BAD: Obvious comment
// Set the value to 10
const value = 10;

// GOOD: JSDoc for functions
/**
 * Calculate commission based on order total and rep tier
 * @param {number} total - Order total amount
 * @param {string} tier - Sales rep tier (junior|senior|manager)
 * @returns {number} Commission amount
 */
function calculateCommission(total, tier) {
    // Implementation
}

// GOOD: TODO with context
// TODO: Refactor to use batch processing for better governance (JIRA-123)
```

### Module Structure

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    // Constants at top
    const MAX_LINES = 100;
    const STATUS_ACTIVE = 'A';

    // Private functions
    function helperFunction() {
        // Implementation
    }

    // Entry points
    function beforeSubmit(context) {
        // Implementation
    }

    function afterSubmit(context) {
        // Implementation
    }

    // Return public interface
    return {
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});
```

## NetSuite-Specific Style

### Record Operations

```javascript
// GOOD: Chain-friendly field setting
rec.setValue('field1', value1);
rec.setValue('field2', value2);
rec.setValue('field3', value3);

// GOOD: Use object for submitFields
record.submitFields({
    type: 'customer',
    id: customerId,
    values: {
        custentity_status: 'ACTIVE',
        custentity_updated: new Date()
    }
});

// GOOD: Meaningful variable names
const salesOrder = record.load({
    type: record.Type.SALES_ORDER,
    id: salesOrderId
});

// BAD: Unclear abbreviations
const so = record.load({ type: 'salesorder', id: id });
```

### Search Operations

```javascript
// GOOD: Readable filter arrays
const filters = [
    ['status', 'anyof', 'SalesOrd:A', 'SalesOrd:B'],
    'AND',
    ['mainline', 'is', 'T'],
    'AND',
    ['trandate', 'within', 'thismonth']
];

// GOOD: Named columns for clarity
const columns = [
    search.createColumn({ name: 'tranid' }),
    search.createColumn({ name: 'entity' }),
    search.createColumn({ name: 'total', sort: search.Sort.DESC })
];
```

### Logging

```javascript
// GOOD: Structured logging
log.audit({
    title: 'Order Processed',
    details: JSON.stringify({
        orderId: orderId,
        status: 'success',
        duration: endTime - startTime
    })
});

// BAD: Unstructured string
log.audit('Order ' + orderId + ' processed');

// Use appropriate log levels
log.debug({ });     // Development debugging
log.audit({ });     // Business events, audit trail
log.error({ });     // Errors requiring attention
log.emergency({ }); // Critical failures
```

## Code Organization

### File Length

- Keep files under 500 lines
- Split large modules into multiple files
- One responsibility per file

### Function Length

- Keep functions under 50 lines
- Extract complex logic into helper functions
- Each function does one thing

### Nesting

```javascript
// GOOD: Max 3 levels of nesting
function process(items) {
    items.forEach(function(item) {
        if (item.active) {
            doSomething(item);
        }
    });
}

// BAD: Too deeply nested
function process(items) {
    items.forEach(function(item) {
        if (item.active) {
            if (item.type === 'A') {
                if (item.status === 'pending') {
                    if (item.amount > 100) {
                        // Too deep!
                    }
                }
            }
        }
    });
}

// GOOD: Early returns reduce nesting
function processItem(item) {
    if (!item.active) return;
    if (item.type !== 'A') return;
    if (item.status !== 'pending') return;
    if (item.amount <= 100) return;

    // Main logic here
}
```

## See Also

- `naming-conventions.md` - Naming standards
- `documentation.md` - Documentation requirements
- `../review/checklist.md` - Review criteria
