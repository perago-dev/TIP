# Maintainability Review Criteria

Maintainability-focused review criteria for SuiteScript code.

## Code Readability

### Naming Quality

```javascript
// BAD: Cryptic names
function p(d) {
    const x = d.a * d.b;
    return x > 100 ? true : false;
}

// GOOD: Descriptive names
function isLargeOrder(order) {
    const orderTotal = order.quantity * order.unitPrice;
    return orderTotal > 100;
}
```

### Function Length

```javascript
// BAD: Too long, too many responsibilities
function processOrder(orderId) {
    // 200 lines of code doing:
    // - validation
    // - pricing calculation
    // - inventory check
    // - customer update
    // - notification
    // - logging
}

// GOOD: Single responsibility, composed
function processOrder(orderId) {
    const order = loadOrder(orderId);

    validateOrder(order);
    calculatePricing(order);
    checkInventory(order);
    updateCustomerRecord(order);
    sendNotifications(order);
    logOrderProcessing(order);

    return order;
}
```

### Nesting Depth

```javascript
// BAD: Deep nesting (hard to follow)
function processItems(items) {
    items.forEach(function(item) {
        if (item.active) {
            if (item.type === 'inventory') {
                if (item.quantity > 0) {
                    if (item.price > 10) {
                        processHighValueItem(item);
                    } else {
                        processLowValueItem(item);
                    }
                }
            }
        }
    });
}

// GOOD: Early returns (flat structure)
function processItems(items) {
    items.forEach(processItem);
}

function processItem(item) {
    if (!item.active) return;
    if (item.type !== 'inventory') return;
    if (item.quantity <= 0) return;

    if (item.price > 10) {
        processHighValueItem(item);
    } else {
        processLowValueItem(item);
    }
}
```

## Code Organization

### Module Structure

```javascript
/**
 * Well-organized module structure
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    // 1. Constants at top
    const MAX_RETRIES = 3;
    const DEFAULT_STATUS = 'pending';

    // 2. Private helper functions
    function validateInput(data) {
        // ...
    }

    function formatOutput(result) {
        // ...
    }

    // 3. Main business logic functions
    function processOrder(orderId) {
        // ...
    }

    // 4. Entry point functions
    function beforeSubmit(context) {
        // ...
    }

    function afterSubmit(context) {
        // ...
    }

    // 5. Clear exports at end
    return {
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});
```

### Separation of Concerns

```javascript
// BAD: Mixed concerns
function afterSubmit(context) {
    const rec = context.newRecord;

    // Database operations
    const customer = record.load({
        type: 'customer',
        id: rec.getValue('entity')
    });

    // Business logic
    const creditUsed = calculateCreditUsed(rec);
    const newBalance = customer.getValue('balance') + creditUsed;

    // More database operations
    customer.setValue('balance', newBalance);
    customer.save();

    // Email composition
    const emailBody = 'Dear ' + customer.getValue('companyname') + '...';

    // Email sending
    email.send({
        author: -5,
        recipients: customer.getValue('email'),
        subject: 'Order Confirmation',
        body: emailBody
    });
}

// GOOD: Separated concerns
function afterSubmit(context) {
    const orderData = extractOrderData(context.newRecord);
    const creditUpdate = calculateCreditUpdate(orderData);

    updateCustomerCredit(orderData.customerId, creditUpdate);
    sendOrderConfirmation(orderData);
}

function extractOrderData(rec) {
    return {
        orderId: rec.id,
        customerId: rec.getValue('entity'),
        total: rec.getValue('total')
    };
}

function calculateCreditUpdate(orderData) {
    // Pure business logic - easy to test
    return orderData.total;
}

function updateCustomerCredit(customerId, amount) {
    // Database operation isolated
}

function sendOrderConfirmation(orderData) {
    // Email operation isolated
}
```

## Documentation Quality

### Self-Documenting Code

```javascript
// BAD: Needs comment to explain
// Check if customer is eligible for discount
if (c.t === 'P' && c.o > 10 && c.a) {
    applyDiscount();
}

// GOOD: Self-documenting
const isPremiumCustomer = customer.type === 'PREMIUM';
const hasMinimumOrders = customer.orderCount > 10;
const isAccountActive = customer.active;

if (isPremiumCustomer && hasMinimumOrders && isAccountActive) {
    applyDiscount();
}
```

### When to Comment

```javascript
// GOOD: Explain WHY, not WHAT
// Use setTimeout to allow NetSuite's async field sourcing to complete
// before we access the calculated value
setTimeout(function() {
    const calculatedTotal = rec.getValue('total');
}, 100);

// GOOD: Document external dependencies
// Requires custom field custentity_credit_limit to be set on customer
// See: https://wiki.company.com/credit-system
const creditLimit = customer.getValue('custentity_credit_limit');

// GOOD: Explain business rules
// Commission tiers based on Q3 2023 sales incentive program
// Approved by VP Sales on 2023-07-15
const COMMISSION_RATES = {
    'junior': 0.05,
    'senior': 0.07,
    'manager': 0.10
};
```

## Error Handling

### Consistent Error Pattern

```javascript
// Consistent error handling throughout codebase
function processRecord(recordId) {
    try {
        const result = doProcessing(recordId);
        return { success: true, data: result };
    } catch (e) {
        logError('processRecord', e, { recordId: recordId });
        return { success: false, error: e.message };
    }
}

// Centralized error logging
function logError(context, error, metadata) {
    log.error({
        title: context + ' Error',
        details: JSON.stringify({
            message: error.message,
            name: error.name,
            stack: error.stack,
            ...metadata,
            timestamp: new Date().toISOString()
        })
    });
}
```

### Graceful Degradation

```javascript
// GOOD: Don't fail entirely for non-critical issues
function enrichOrderData(order) {
    // Critical: must succeed
    order.customer = getCustomer(order.customerId);

    // Non-critical: log and continue if fails
    try {
        order.customerHistory = getCustomerHistory(order.customerId);
    } catch (e) {
        log.warning({
            title: 'Could not load customer history',
            details: e.message
        });
        order.customerHistory = [];
    }

    // Non-critical
    try {
        order.recommendations = getRecommendations(order);
    } catch (e) {
        log.warning({
            title: 'Could not load recommendations',
            details: e.message
        });
        order.recommendations = [];
    }

    return order;
}
```

## Maintainability Checklist

### Code Clarity

- [ ] **Meaningful names** - Variables, functions, constants
- [ ] **Small functions** - Each does one thing (< 50 lines)
- [ ] **Low nesting** - Max 3 levels deep
- [ ] **No magic numbers** - Use named constants
- [ ] **Consistent style** - Follows team standards

### Organization

- [ ] **Logical structure** - Constants, helpers, main, exports
- [ ] **Separation of concerns** - UI, business, data isolated
- [ ] **DRY** - No logical block of ≥10 lines duplicated 3+ times (extract to a shared function)
- [ ] **Single responsibility** - Each module has one job

### Documentation

- [ ] **File header** - Description, author, date, version
- [ ] **Function docs** - JSDoc for public functions
- [ ] **Complex logic explained** - Comments for WHY
- [ ] **No commented-out code** - Remove or document why kept
- [ ] **No unreachable code** - No statements after `return`/`throw`/`break`, no always-false branches, no never-called private functions
- [ ] **TODO items** - Have JIRA references

### Error Handling

- [ ] **Consistent pattern** - Same approach throughout
- [ ] **Meaningful messages** - User can understand
- [ ] **Logged with context** - Debuggable
- [ ] **No silent failures** - Always log or throw

### Testability

- [ ] **Pure functions** - Where possible
- [ ] **Dependencies injectable** - Can mock for tests
- [ ] **Side effects isolated** - Easy to test core logic

## Code Smells to Flag

| Smell | Indicator | Fix |
|-------|-----------|-----|
| Long function | > 50 lines | Extract helper functions |
| Deep nesting | > 3 levels | Early returns, extract functions |
| Magic numbers | Unexplained literals | Named constants |
| Duplicate code | A logical block of ≥10 lines appears 3+ times | Extract shared function |
| Commented-out code | Dead blocks left in `//` or `/* */` | Remove (git preserves history) |
| Unreachable code | Statements after `return`/`throw`/`break`; always-false branches; uncalled private functions | Remove the dead path |
| God object | Object does everything | Split by responsibility |
| Shotgun surgery | Change requires many files | Better abstraction |

## See Also

- `checklist.md` - Full review checklist
- `security.md` - Security review
- `performance.md` - Performance review
- `../standards/code-style.md` - Style guide
