# Testing Standards

Testing requirements and practices for SuiteScript development.

## Testing Levels

```
1. UNIT TESTING
   └── Individual functions
       ├── Business logic
       ├── Transformations
       └── Validations

2. INTEGRATION TESTING
   └── Script + NetSuite
       ├── Record operations
       ├── Search queries
       └── External APIs

3. SYSTEM TESTING
   └── End-to-end flows
       ├── Business processes
       ├── User workflows
       └── Multi-script interactions

4. USER ACCEPTANCE TESTING
   └── Business validation
       ├── Requirement verification
       ├── Edge cases
       └── Sign-off
```

## Unit Testing

### Test File Structure

```
SuiteScripts/
├── [module]/
│   ├── script.js
│   └── test/
│       └── script.test.js
```

### Unit Test Pattern

```javascript
/**
 * Unit tests for commission calculation
 * Run with: node test/commission.test.js
 */

// Mock NetSuite modules
const mockRecord = {
    getValue: jest.fn(),
    setValue: jest.fn()
};

// Import module (adjust for your test framework)
const { calculateCommission } = require('../commission_helper');

describe('calculateCommission', () => {

    test('calculates junior tier correctly', () => {
        const result = calculateCommission(10000, 'junior');
        expect(result).toBe(500);  // 5% of 10000
    });

    test('calculates senior tier correctly', () => {
        const result = calculateCommission(10000, 'senior');
        expect(result).toBe(700);  // 7% of 10000
    });

    test('applies bonus multiplier', () => {
        const result = calculateCommission(10000, 'senior', { bonusMultiplier: 1.5 });
        expect(result).toBe(1050);  // 7% of 10000 * 1.5
    });

    test('throws on invalid tier', () => {
        expect(() => {
            calculateCommission(10000, 'invalid');
        }).toThrow('Invalid tier');
    });

    test('throws on negative amount', () => {
        expect(() => {
            calculateCommission(-100, 'junior');
        }).toThrow('Amount must be positive');
    });

    test('handles zero amount', () => {
        const result = calculateCommission(0, 'junior');
        expect(result).toBe(0);
    });
});
```

### Testable Code Pattern

```javascript
// BAD: Hard to test - depends on NetSuite modules
function processOrder(context) {
    const rec = context.newRecord;
    const total = rec.getValue('total');
    const tier = rec.getValue('custbody_tier');

    // Calculate commission
    let rate;
    switch (tier) {
        case 'junior': rate = 0.05; break;
        case 'senior': rate = 0.07; break;
        default: rate = 0.05;
    }

    const commission = total * rate;
    rec.setValue('custbody_commission', commission);
}

// GOOD: Separated testable logic
function calculateCommission(total, tier) {
    const rates = {
        'junior': 0.05,
        'senior': 0.07,
        'manager': 0.10
    };

    const rate = rates[tier] || rates['junior'];
    return total * rate;
}

function processOrder(context) {
    const rec = context.newRecord;
    const commission = calculateCommission(
        rec.getValue('total'),
        rec.getValue('custbody_tier')
    );
    rec.setValue('custbody_commission', commission);
}
```

## Integration Testing

### Sandbox Testing Checklist

Before testing in sandbox:
- [ ] Sandbox is up to date with production
- [ ] Test data exists (customers, items, etc.)
- [ ] Scripts deployed
- [ ] Workflows activated
- [ ] Permissions configured

### Test Scenarios

| Scenario | Type | Steps | Expected |
|----------|------|-------|----------|
| Happy path | Positive | Normal input | Success |
| Edge case | Boundary | Min/max values | Handles correctly |
| Error case | Negative | Invalid input | Error message |
| Permission | Security | Wrong role | Access denied |

### Example Test Cases

```markdown
## Test Cases: Sales Order Validation

### TC-001: Valid Order - Happy Path
**Preconditions:** Customer has credit limit > order total
**Steps:**
1. Create sales order for customer
2. Add line items
3. Submit order
**Expected:** Order saves successfully

### TC-002: Credit Limit Exceeded
**Preconditions:** Customer credit limit = $1,000
**Steps:**
1. Create sales order for $2,000
2. Submit order
**Expected:** Error "Order exceeds credit limit"

### TC-003: Missing Required Field
**Preconditions:** None
**Steps:**
1. Create sales order
2. Leave shipping address blank
3. Submit order
**Expected:** Error "Shipping address is required"

### TC-004: Concurrent Edit
**Preconditions:** Order exists
**Steps:**
1. User A opens order
2. User B opens same order
3. User A saves
4. User B saves
**Expected:** User B gets conflict message
```

## System Testing

### End-to-End Test Flows

```markdown
## E2E Flow: Order to Cash

1. **Order Entry**
   - Create sales order
   - Verify customer lookup
   - Verify pricing calculation
   - Verify tax calculation

2. **Order Approval**
   - Submit for approval
   - Manager receives notification
   - Manager approves
   - Verify status change

3. **Fulfillment**
   - Create fulfillment from order
   - Verify inventory reduction
   - Verify tracking update

4. **Invoicing**
   - Create invoice from order
   - Verify amounts match
   - Verify customer balance update

5. **Payment**
   - Apply payment
   - Verify invoice closed
   - Verify GL posting
```

## Testing Environment

### Sandbox Best Practices

1. **Keep sandbox current**
   - Refresh monthly (minimum)
   - Refresh before major releases

2. **Test data management**
   - Create dedicated test accounts
   - Use naming prefix: `TEST_*`
   - Don't use production data directly

3. **Script deployment**
   - Always test in sandbox first
   - Never skip sandbox testing

### Test Data Setup

```javascript
/**
 * Create test data for order validation testing
 */
function setupTestData() {
    // Create test customer
    const customer = record.create({ type: 'customer' });
    customer.setValue('companyname', 'TEST_Customer_001');
    customer.setValue('email', 'test@example.com');
    customer.setValue('custentity_credit_limit', 10000);
    const customerId = customer.save();

    // Create test item
    const item = record.create({ type: 'inventoryitem' });
    item.setValue('itemid', 'TEST_ITEM_001');
    item.setValue('displayname', 'Test Widget');
    item.setValue('baseprice', 100);
    const itemId = item.save();

    return { customerId, itemId };
}

/**
 * Cleanup test data after testing
 */
function cleanupTestData() {
    // Delete records with TEST_ prefix
    search.create({
        type: 'customer',
        filters: [['companyname', 'startswith', 'TEST_']]
    }).run().each(function(result) {
        record.delete({ type: 'customer', id: result.id });
        return true;
    });
}
```

## Regression Testing

### Regression Test Suite

| Area | Test | Frequency |
|------|------|-----------|
| Order entry | Create order with all scenarios | Every release |
| Integrations | API endpoint tests | Every release |
| Reports | Verify report accuracy | Monthly |
| Workflows | All approval paths | Every release |

### Automated Regression

```javascript
/**
 * Automated regression test runner
 */
function runRegressionTests() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    // Test 1: Customer creation
    try {
        testCustomerCreation();
        results.passed++;
        results.tests.push({ name: 'Customer creation', status: 'passed' });
    } catch (e) {
        results.failed++;
        results.tests.push({ name: 'Customer creation', status: 'failed', error: e.message });
    }

    // Test 2: Order validation
    try {
        testOrderValidation();
        results.passed++;
        results.tests.push({ name: 'Order validation', status: 'passed' });
    } catch (e) {
        results.failed++;
        results.tests.push({ name: 'Order validation', status: 'failed', error: e.message });
    }

    // ... more tests

    return results;
}
```

## Documentation

### Test Documentation

```markdown
## Test Summary Report

**Project:** Order Management Enhancement
**Date:** 2024-01-15
**Tester:** John QA

### Summary
- Total tests: 25
- Passed: 23
- Failed: 2
- Blocked: 0

### Failed Tests
| ID | Test | Reason | Priority |
|----|------|--------|----------|
| TC-015 | Large order | Timeout | High |
| TC-022 | Multi-currency | Conversion error | Medium |

### Recommendations
1. Fix timeout issue before release
2. Currency conversion can be post-release fix
```

## Best Practices

1. **Test early and often** - Don't wait until the end
2. **Test in sandbox** - Never skip this step
3. **Document test cases** - For repeatability
4. **Automate where possible** - Reduce manual effort
5. **Include edge cases** - Think about boundaries
6. **Test permissions** - Verify role restrictions
7. **Test integrations** - External systems too
8. **Clean up test data** - Don't leave garbage

## CI Toolchain (Support Repos)

All Softype support repos use a standardized CI template. The template lives in the Scout repo at `ci-templates/netsuite-suitescript/` and is copied into each repo.

### Stack

| Tool | Package | Purpose |
|---|---|---|
| **ESLint** | `eslint-plugin-suitescript` | SuiteScript structural rules + Softype governance rules |
| **Type check** | `@hitc/netsuite-types` + `tsc --noEmit` | NetSuite API type signatures against JS files |
| **Jest** | `@oracle/suitecloud-unit-testing` | AMD→CommonJS transform, N/* stubs, offline test runner |
| **Duplicates** | custom script | Surfaces same filename in multiple folders |

### Key facts

- `@oracle/suitecloud-unit-testing` handles the AMD `define()` → CommonJS transform automatically via `babel-plugin-transform-amd-to-commonjs`. You do not need to configure Babel yourself.
- `@hitc/netsuite-types` gives VSCode IntelliSense and `tsc` type checking for all `N/*` modules without TypeScript compilation.
- All CI steps run with `continue-on-error: true` — warn, don't block — until the team trusts the results.
- A sample test (`__tests__/sample.test.js`) keeps CI green on repos with zero real tests.

### Writing tests for support fixes

When fixing a bug, add a test that would have caught it:

```javascript
// __tests__/billing_schedule.test.js
const record = require('N/record');
jest.mock('N/record');

describe('createBillingSchedule', () => {
  it('throws when no billing schedules exist', () => {
    // This would have caught FIC-type bugs where length < 0 check was impossible
    const mockRec = { getLineCount: jest.fn().mockReturnValue(0) };
    expect(() => createBillingSchedule(mockRec)).toThrow();
  });
});
```

### ESLint rules enforced

Beyond `plugin:suitescript/recommended`, the Softype config adds:
- `record.load` / `record.save` inside loops → warn (N+1 governance violation)
- `console.log` → warn (use `log.debug` in server-side scripts)
- `==` instead of `===` → warn
- Unused variables → warn

## See Also

- `code-style.md` - Code standards
- `deployment.md` - Deployment process
- `../review/checklist.md` - Review requirements
- `ci-templates/netsuite-suitescript/` in Scout repo - Drop-in CI setup
