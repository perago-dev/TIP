# Documentation Standards

What to document and where.

## Script Documentation

### File Header (Required)

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * @description Validates sales orders and updates related customer records
 *              when orders are approved.
 *
 * @module softype/orders/userevent_salesorder_validation
 * @author John Developer
 * @date 2024-01-15
 * @version 1.0.0
 *
 * @changelog
 *   1.0.0 (2024-01-15) - Initial version
 *   1.1.0 (2024-02-01) - Added credit limit validation
 *
 * @requires N/record
 * @requires N/search
 * @requires N/email
 *
 * @deployments
 *   - customdeploy_st_so_validation (Sales Order)
 *
 * @dependencies
 *   - Customer must have custentity_credit_limit set
 *   - Custom list customlist_st_approval_status must exist
 */
```

### Function Documentation

```javascript
/**
 * Calculate commission based on order total and sales rep tier
 *
 * Commission rates by tier:
 * - Junior: 5%
 * - Senior: 7%
 * - Manager: 10%
 *
 * @param {number} orderTotal - Order total amount (must be positive)
 * @param {string} salesRepTier - Sales rep tier ('junior'|'senior'|'manager')
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.bonusMultiplier=1] - Multiplier for bonus periods
 * @param {boolean} [options.includeExisting=false] - Include existing commission
 *
 * @returns {number} Calculated commission amount
 *
 * @throws {Error} If orderTotal is negative
 * @throws {Error} If salesRepTier is invalid
 *
 * @example
 * const commission = calculateCommission(10000, 'senior');
 * // Returns: 700
 *
 * @example
 * const commission = calculateCommission(10000, 'senior', { bonusMultiplier: 1.5 });
 * // Returns: 1050
 */
function calculateCommission(orderTotal, salesRepTier, options) {
    // Implementation
}
```

### Inline Comments

```javascript
// GOOD: Explain complex business logic
// Credit limit check: subtract pending orders from available credit
// because they haven't been billed yet but will impact credit
const availableCredit = creditLimit - (currentBalance + pendingOrdersTotal);

// GOOD: Explain non-obvious code
// Sort by date descending, but put null dates at the end
results.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date - a.date;
});

// GOOD: Reference external documentation
// Tax calculation follows California BOE guidelines
// See: https://www.cdtfa.ca.gov/taxes-and-fees/tax-rates.htm

// BAD: Obvious comments
// Increment counter
counter++;

// BAD: Outdated comments
// Loop through customers
orders.forEach(order => { });  // Actually loops through orders!
```

## NetSuite Record Documentation

### Script Record

Include in script description:
- Purpose
- Trigger conditions
- Dependencies
- Related scripts

```
Description:
Validates sales orders on submission. Checks credit limits,
validates shipping addresses, and sends notification emails
for large orders (>$10,000).

Dependencies:
- Customer field: custentity_credit_limit
- Custom list: customlist_st_order_priority

Related Scripts:
- customscript_st_so_client (client-side validation)
- customscript_st_so_notifications (scheduled notifications)
```

### Custom Field

```
Label: Credit Limit
ID: custentity_st_credit_limit
Type: Currency

Description:
Maximum credit extended to this customer. Used by:
- customscript_st_so_validation (order validation)
- customsearch_st_credit_risk (credit risk report)

Default: 0 (no credit)
Set by: Finance team via custom role
```

### Custom Record

```
Label: Integration Log
ID: customrecord_st_integration_log

Description:
Logs all integration activities for audit and troubleshooting.
Auto-created by integration scripts.

Fields:
- custrecord_log_timestamp: When the event occurred
- custrecord_log_direction: Inbound/Outbound
- custrecord_log_status: Success/Failed
- custrecord_log_message: Details/error message
- custrecord_log_payload: Request/response data (truncated)

Related Scripts:
- customscript_st_api_inbound
- customscript_st_api_outbound
- customscript_st_log_cleanup (purges logs > 90 days)

Permissions:
- View: All employees
- Edit: Integration Admin role only
```

## Technical Design Document

### Template

```markdown
# Technical Design: [Feature Name]

## Overview
Brief description of the feature and its business purpose.

## Requirements
| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Description | Must have |

## Solution Design

### Architecture
Diagram or description of components and their interactions.

### Scripts
| Script | Type | Purpose |
|--------|------|---------|
| customscript_st_feature | User Event | Main logic |

### Custom Fields
| Field | Type | Location | Purpose |
|-------|------|----------|---------|
| custbody_st_field | Select | Sales Order | Stores selection |

### Workflows
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| customworkflow_st_approval | Status change | Approval routing |

## Data Model
Entity relationship diagram or description.

## Integration Points
External systems and how they connect.

## Error Handling
How errors are handled and reported.

## Testing Plan
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Happy path | ... | ... |

## Deployment Checklist
- [ ] Create custom fields
- [ ] Create custom records
- [ ] Deploy scripts
- [ ] Configure workflows
- [ ] Set permissions

## Rollback Plan
Steps to undo if deployment fails.
```

## README Files

### Script Folder README

```markdown
# [Module Name]

## Overview
Brief description of the module's purpose.

## Scripts
- `userevent_record_function.js` - Description
- `scheduled_process.js` - Description

## Dependencies
- Custom fields: custbody_st_*, custentity_st_*
- Custom records: customrecord_st_*
- Saved searches: customsearch_st_*

## Configuration
Script parameters and how to set them.

## Testing
How to test in sandbox.

## Deployment
Steps to deploy to production.

## Troubleshooting
Common issues and solutions.

## Change History
| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | JD | Initial release |
```

## Documentation Checklist

### Before Code Review

- [ ] File header complete
- [ ] Public functions documented
- [ ] Complex logic explained
- [ ] TODO items have JIRA references
- [ ] No commented-out code
- [ ] Error messages are clear

### Before Deployment

- [ ] Technical design document approved
- [ ] Script records have descriptions
- [ ] Custom fields have help text
- [ ] README updated
- [ ] Runbook/troubleshooting guide created

## See Also

- `naming-conventions.md` - Naming standards
- `code-style.md` - Code formatting
- `../review/checklist.md` - Review requirements
