# Workflow Action Script Patterns

Workflow Action Scripts execute custom logic during workflow transitions. Use for complex calculations, external API calls, or operations not possible with native workflow actions.

## Standard Template

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 * @NModuleScope SameAccount
 *
 * [Description of what this script does]
 *
 * @module [ModuleName]
 */
define(['N/record', 'N/search', 'N/log', 'N/runtime'], function(record, search, log, runtime) {

    /**
     * Entry point for workflow action
     * @param {Object} context
     * @param {Record} context.newRecord - The triggering record
     * @param {Record} context.oldRecord - Previous values (if available)
     * @param {number} context.workflowId - Workflow internal ID
     * @param {string} context.type - Action type
     * @returns {*} Return value for workflow field
     */
    function onAction(context) {
        try {
            log.audit({
                title: 'Workflow Action Start',
                details: 'Record: ' + context.newRecord.id + ', Workflow: ' + context.workflowId
            });

            const rec = context.newRecord;

            // Perform action
            const result = performAction(rec);

            log.audit({
                title: 'Workflow Action Complete',
                details: 'Result: ' + result
            });

            // Return value to workflow (optional)
            return result;

        } catch (e) {
            log.error({
                title: 'Workflow Action Error',
                details: e.message
            });
            throw e;  // Re-throw to fail workflow transition
        }
    }

    function performAction(rec) {
        // Custom logic here
        return 'success';
    }

    return {
        onAction: onAction
    };
});
```

## Pattern: Complex Calculation

```javascript
/**
 * Calculate commission based on complex rules
 */
function onAction(context) {
    const rec = context.newRecord;

    // Get order details
    const total = rec.getValue('total');
    const salesRep = rec.getValue('salesrep');
    const customerType = rec.getValue('custbody_customer_type');

    // Get sales rep commission rate
    const commissionRate = getCommissionRate(salesRep, customerType);

    // Calculate commission tiers
    let commission = 0;

    if (total <= 10000) {
        commission = total * commissionRate.tier1;
    } else if (total <= 50000) {
        commission = (10000 * commissionRate.tier1) +
                     ((total - 10000) * commissionRate.tier2);
    } else {
        commission = (10000 * commissionRate.tier1) +
                     (40000 * commissionRate.tier2) +
                     ((total - 50000) * commissionRate.tier3);
    }

    // Apply bonuses
    if (customerType === 'NEW') {
        commission *= 1.1;  // 10% bonus for new customers
    }

    // Update record
    record.submitFields({
        type: rec.type,
        id: rec.id,
        values: {
            custbody_commission_amount: commission,
            custbody_commission_rate: commissionRate.tier1
        }
    });

    return commission;
}

function getCommissionRate(salesRepId, customerType) {
    const salesRep = search.lookupFields({
        type: 'employee',
        id: salesRepId,
        columns: ['custentity_comm_tier1', 'custentity_comm_tier2', 'custentity_comm_tier3']
    });

    return {
        tier1: parseFloat(salesRep.custentity_comm_tier1) || 0.05,
        tier2: parseFloat(salesRep.custentity_comm_tier2) || 0.07,
        tier3: parseFloat(salesRep.custentity_comm_tier3) || 0.10
    };
}
```

## Pattern: External API Call

```javascript
/**
 * Notify external system during workflow
 */
define(['N/record', 'N/https', 'N/log', 'N/runtime'], function(record, https, log, runtime) {

    function onAction(context) {
        const rec = context.newRecord;

        // Build payload
        const payload = {
            orderId: rec.id,
            orderNumber: rec.getValue('tranid'),
            customer: rec.getText('entity'),
            amount: rec.getValue('total'),
            status: rec.getText('status'),
            timestamp: new Date().toISOString()
        };

        // Send to external system
        try {
            const response = https.post({
                url: runtime.getCurrentScript().getParameter({ name: 'custscript_webhook_url' }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getApiToken()
                },
                body: JSON.stringify(payload)
            });

            if (response.code === 200 || response.code === 201) {
                // Mark as synced
                record.submitFields({
                    type: rec.type,
                    id: rec.id,
                    values: {
                        custbody_external_sync: true,
                        custbody_sync_timestamp: new Date()
                    }
                });

                return 'SYNCED';
            } else {
                log.error({
                    title: 'API Error',
                    details: 'Code: ' + response.code + ', Body: ' + response.body
                });
                return 'FAILED';
            }

        } catch (e) {
            log.error({
                title: 'API Call Failed',
                details: e.message
            });

            // Queue for retry
            queueForRetry(rec.id, payload);

            return 'QUEUED';
        }
    }

    function getApiToken() {
        // Retrieve from secure storage
        return runtime.getCurrentScript().getParameter({ name: 'custscript_api_token' });
    }

    function queueForRetry(recordId, payload) {
        record.create({
            type: 'customrecord_sync_queue',
            values: {
                custrecord_record_id: recordId,
                custrecord_payload: JSON.stringify(payload),
                custrecord_retry_count: 0
            }
        }).save();
    }

    return { onAction: onAction };
});
```

## Pattern: Approval Routing

```javascript
/**
 * Determine approval chain based on amount and department
 */
function onAction(context) {
    const rec = context.newRecord;

    const amount = rec.getValue('total');
    const department = rec.getValue('department');
    const subsidiary = rec.getValue('subsidiary');

    // Get approval matrix
    const approvers = [];

    // Level 1: Department manager
    if (amount > 0) {
        const deptManager = getDepartmentManager(department);
        if (deptManager) {
            approvers.push({
                level: 1,
                approver: deptManager,
                threshold: 5000
            });
        }
    }

    // Level 2: Director
    if (amount > 5000) {
        const director = getDirector(department);
        if (director) {
            approvers.push({
                level: 2,
                approver: director,
                threshold: 25000
            });
        }
    }

    // Level 3: VP
    if (amount > 25000) {
        const vp = getVP(subsidiary);
        if (vp) {
            approvers.push({
                level: 3,
                approver: vp,
                threshold: 100000
            });
        }
    }

    // Level 4: CFO
    if (amount > 100000) {
        approvers.push({
            level: 4,
            approver: getCFO(),
            threshold: null  // No limit
        });
    }

    // Store approval chain
    record.submitFields({
        type: rec.type,
        id: rec.id,
        values: {
            custbody_approval_chain: JSON.stringify(approvers),
            custbody_current_approver: approvers[0]?.approver,
            custbody_approval_level: 1
        }
    });

    // Return next approver for workflow
    return approvers[0]?.approver;
}

function getDepartmentManager(deptId) {
    const dept = search.lookupFields({
        type: 'department',
        id: deptId,
        columns: ['custrecord_manager']
    });
    return dept.custrecord_manager?.[0]?.value;
}
```

## Pattern: Dynamic Field Update

```javascript
/**
 * Update multiple fields based on workflow state
 */
function onAction(context) {
    const rec = context.newRecord;
    const workflowState = context.type;  // e.g., 'APPROVE', 'REJECT'

    const updates = {};

    switch (workflowState) {
        case 'APPROVE':
            updates.custbody_approved_date = new Date();
            updates.custbody_approved_by = runtime.getCurrentUser().id;
            updates.custbody_status = 'APPROVED';

            // If final approval, set ready to fulfill
            if (rec.getValue('custbody_approval_level') === rec.getValue('custbody_max_approval_level')) {
                updates.custbody_ready_to_process = true;
            }
            break;

        case 'REJECT':
            updates.custbody_rejected_date = new Date();
            updates.custbody_rejected_by = runtime.getCurrentUser().id;
            updates.custbody_status = 'REJECTED';
            updates.custbody_ready_to_process = false;
            break;

        case 'RETURN':
            updates.custbody_returned_date = new Date();
            updates.custbody_returned_by = runtime.getCurrentUser().id;
            updates.custbody_status = 'RETURNED';
            // Reset to first approver
            updates.custbody_approval_level = 1;
            break;
    }

    // Apply updates
    record.submitFields({
        type: rec.type,
        id: rec.id,
        values: updates
    });

    // Send notification
    sendNotification(rec.id, workflowState);

    return workflowState;
}
```

## Pattern: Conditional Workflow Routing

```javascript
/**
 * Return value determines workflow path
 */
function onAction(context) {
    const rec = context.newRecord;

    // Evaluate conditions
    const amount = rec.getValue('total');
    const customerType = rec.getValue('custbody_customer_type');
    const hasCredit = rec.getValue('custbody_credit_approved');

    // Determine routing
    if (amount > 50000 && !hasCredit) {
        // Large order without credit approval
        return 'CREDIT_REVIEW';
    }

    if (customerType === 'NEW' && amount > 10000) {
        // New customer large order
        return 'MANAGER_REVIEW';
    }

    if (rec.getValue('custbody_expedite')) {
        // Rush order
        return 'EXPEDITE';
    }

    // Standard processing
    return 'STANDARD';
}
```

## Context Properties

| Property | Description |
|----------|-------------|
| `context.newRecord` | The record triggering the workflow |
| `context.oldRecord` | Previous record values (may be null) |
| `context.workflowId` | Internal ID of the workflow |
| `context.type` | Action type from workflow |

## Return Values

Workflow Action Scripts can return values that are used by the workflow:

```javascript
// Return to field (workflow captures in custom field)
return 12345;

// Return for condition routing
return 'PATH_A';  // Workflow condition checks this value

// Return boolean for yes/no paths
return true;

// Return nothing (void)
// Just perform action, no return needed
```

## Governance

- **1,000 units per execution** (same as User Event)
- Keep operations lightweight
- Avoid heavy searches in workflows with many records

## Best Practices

1. **Return meaningful values** - Use for workflow routing
2. **Log workflow context** - Include workflowId for debugging
3. **Handle errors carefully** - Throwing stops the workflow
4. **Keep it fast** - Workflows block user interaction
5. **Use script parameters** - For configurable values
6. **Test thoroughly** - Workflow errors are hard to debug

## Common Mistakes

```javascript
// WRONG: Heavy processing in workflow
function onAction(context) {
    // Running 1000 record updates in workflow
    for (let i = 0; i < 1000; i++) {
        record.load(...).save();  // This will timeout
    }
}

// RIGHT: Queue for background processing
function onAction(context) {
    // Create queue record for Map/Reduce
    record.create({
        type: 'customrecord_process_queue',
        values: { custrecord_trigger_id: context.newRecord.id }
    }).save();

    return 'QUEUED';
}
```

## See Also

- `user-event.md` - Similar trigger patterns
- `../snippets/record-operations.md` - Record manipulation
- `../snippets/error-handling.md` - Error handling patterns
