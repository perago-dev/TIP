# Client Script Patterns

Client Scripts run in the browser for real-time field validation, UI manipulation, and user interaction. They have limited governance (1,000 units).

## Standard Template

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * [Description of what this script does]
 *
 * @module [ModuleName]
 */
define(['N/currentRecord', 'N/dialog', 'N/log'], function(currentRecord, dialog, log) {

    /**
     * pageInit - Runs when page loads
     * @param {Object} context
     * @param {Record} context.currentRecord
     * @param {string} context.mode - edit|create|copy
     */
    function pageInit(context) {
        try {
            const rec = context.currentRecord;
            // Initialization logic here

        } catch (e) {
            console.error('pageInit Error:', e.message);
        }
    }

    /**
     * fieldChanged - Runs when field value changes
     * @param {Object} context
     * @param {Record} context.currentRecord
     * @param {string} context.fieldId
     * @param {string} context.sublistId (if on sublist)
     * @param {number} context.line (if on sublist)
     */
    function fieldChanged(context) {
        try {
            const rec = context.currentRecord;
            const fieldId = context.fieldId;

            // Handle field changes

        } catch (e) {
            console.error('fieldChanged Error:', e.message);
        }
    }

    /**
     * saveRecord - Runs before save, return false to block
     * @param {Object} context
     * @param {Record} context.currentRecord
     * @returns {boolean} true to allow save, false to block
     */
    function saveRecord(context) {
        try {
            const rec = context.currentRecord;

            // Validation logic
            if (!rec.getValue('custbody_required_field')) {
                dialog.alert({
                    title: 'Validation Error',
                    message: 'Required Field is mandatory'
                });
                return false;
            }

            return true;

        } catch (e) {
            console.error('saveRecord Error:', e.message);
            return false;
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };
});
```

## Pattern: Field Validation

```javascript
function validateField(context) {
    const rec = context.currentRecord;
    const fieldId = context.fieldId;

    if (fieldId === 'custbody_percentage') {
        const value = rec.getValue(fieldId);
        if (value < 0 || value > 100) {
            dialog.alert({
                title: 'Invalid Value',
                message: 'Percentage must be between 0 and 100'
            });
            return false;  // Reject the change
        }
    }

    return true;  // Accept the change
}
```

## Pattern: Field Sourcing/Cascading

```javascript
function fieldChanged(context) {
    const rec = context.currentRecord;
    const fieldId = context.fieldId;

    // When customer changes, update related fields
    if (fieldId === 'entity') {
        const customerId = rec.getValue('entity');
        if (!customerId) return;

        // Look up customer data
        const customerData = search.lookupFields({
            type: 'customer',
            id: customerId,
            columns: ['salesrep', 'terms', 'custentity_credit_limit']
        });

        // Set values on current record
        rec.setValue('salesrep', customerData.salesrep[0]?.value || '');
        rec.setValue('terms', customerData.terms[0]?.value || '');
    }
}
```

## Pattern: Conditional Field Display

```javascript
function fieldChanged(context) {
    const rec = context.currentRecord;
    const fieldId = context.fieldId;

    if (fieldId === 'custbody_transaction_type') {
        const transType = rec.getValue('custbody_transaction_type');

        // Get field reference
        const specialField = rec.getField({ fieldId: 'custbody_special_field' });

        // Show/hide based on selection
        if (transType === 'SPECIAL') {
            specialField.isDisplay = true;
            specialField.isMandatory = true;
        } else {
            specialField.isDisplay = false;
            specialField.isMandatory = false;
            rec.setValue('custbody_special_field', '');
        }
    }
}
```

## Pattern: Line-Level Validation

```javascript
function validateLine(context) {
    const rec = context.currentRecord;
    const sublistId = context.sublistId;

    if (sublistId !== 'item') return true;

    const quantity = rec.getCurrentSublistValue({
        sublistId: sublistId,
        fieldId: 'quantity'
    });

    const rate = rec.getCurrentSublistValue({
        sublistId: sublistId,
        fieldId: 'rate'
    });

    if (quantity <= 0) {
        dialog.alert({
            title: 'Invalid Quantity',
            message: 'Quantity must be greater than 0'
        });
        return false;
    }

    if (rate < 0) {
        dialog.alert({
            title: 'Invalid Rate',
            message: 'Rate cannot be negative'
        });
        return false;
    }

    return true;
}
```

## Pattern: Calculated Fields

```javascript
function fieldChanged(context) {
    const rec = context.currentRecord;
    const fieldId = context.fieldId;

    // Recalculate when inputs change
    if (fieldId === 'custbody_quantity' || fieldId === 'custbody_unit_price') {
        const qty = rec.getValue('custbody_quantity') || 0;
        const price = rec.getValue('custbody_unit_price') || 0;
        const discount = rec.getValue('custbody_discount_pct') || 0;

        const subtotal = qty * price;
        const discountAmt = subtotal * (discount / 100);
        const total = subtotal - discountAmt;

        rec.setValue('custbody_subtotal', subtotal);
        rec.setValue('custbody_discount_amt', discountAmt);
        rec.setValue('custbody_total', total);
    }
}
```

## Pattern: Confirmation Dialog

```javascript
function saveRecord(context) {
    const rec = context.currentRecord;

    // Check for condition requiring confirmation
    const amount = rec.getValue('total');
    if (amount > 10000) {
        // Use synchronous confirm for save blocking
        const proceed = confirm(
            'This transaction exceeds $10,000. Are you sure you want to proceed?'
        );
        if (!proceed) {
            return false;
        }
    }

    return true;
}

// For async dialogs (non-blocking)
function customAction() {
    dialog.confirm({
        title: 'Confirm Action',
        message: 'Are you sure you want to perform this action?'
    }).then(function(result) {
        if (result) {
            // User clicked Yes
            performAction();
        }
    });
}
```

## Pattern: Custom Button Handler

```javascript
// Called from button added in User Event
function customButtonHandler() {
    const rec = currentRecord.get();
    const recordId = rec.id;

    // Open Suitelet in new window
    const suiteletUrl = url.resolveScript({
        scriptId: 'customscript_custom_suitelet',
        deploymentId: 'customdeploy_custom_suitelet',
        params: { recordId: recordId }
    });

    window.open(suiteletUrl, '_blank');
}

// Make function globally accessible
window.customButtonHandler = customButtonHandler;
```

## Entry Point Reference

| Entry Point | When It Fires | Return Value |
|-------------|---------------|--------------|
| `pageInit` | Page loads | void |
| `fieldChanged` | Field value changes | void |
| `postSourcing` | After sourcing completes | void |
| `lineInit` | Sublist line selected | void |
| `validateField` | Before field change commits | boolean |
| `validateLine` | Before line commits | boolean |
| `validateInsert` | Before new line insert | boolean |
| `validateDelete` | Before line delete | boolean |
| `sublistChanged` | After sublist modified | void |
| `saveRecord` | Before record saves | boolean |

## Best Practices

1. **Use dialog.alert() for errors** - Better UX than native alert()
2. **Return false to block** - validateField, validateLine, saveRecord
3. **Don't make synchronous HTTP calls** - Use Promise patterns (see below)
4. **Cache field lookups** - Avoid repeated getField() calls
5. **Use currentRecord module** - For accessing record outside entry points
6. **Check sublistId** - fieldChanged fires for all sublists

## Pattern: Async/Promise HTTP Calls

Client scripts should never block the UI. Use Promise-based HTTP calls:

```javascript
/**
 * Async HTTP call with Promise
 * Use https.get.promise() or https.post.promise()
 */
define(['N/https', 'N/url', 'N/currentRecord'], function(https, url, currentRecord) {

    function checkPermission() {
        const rec = currentRecord.get();
        const recordId = rec.id;

        const suiteletUrl = url.resolveScript({
            scriptId: 'customscript_sl_check_permission',
            deploymentId: 'customdeploy_sl_check_permission',
            params: { recordId: recordId }
        });

        // Use .promise() for non-blocking call
        https.get.promise({
            url: suiteletUrl
        }).then(function(response) {
            const result = JSON.parse(response.body);

            if (result.hasPermission) {
                enableActions();
            } else {
                disableActions(result.reason);
            }

        }).catch(function(error) {
            console.error('Permission check failed:', error);
            showError('Unable to verify permissions');
        });
    }

    return {
        pageInit: checkPermission
    };
});
```

### Promise Chaining

```javascript
function fetchAndProcess() {
    fetchData()
        .then(function(data) {
            return validateData(data);
        })
        .then(function(validData) {
            return processData(validData);
        })
        .then(function(result) {
            dialog.alert({
                title: 'Success',
                message: 'Processed ' + result.count + ' records'
            });
        })
        .catch(function(error) {
            console.error('Processing failed:', error);
            dialog.alert({
                title: 'Error',
                message: error.message
            });
        });
}
```

### When to Use Promises vs Callbacks

| Use Promises | Use Callbacks |
|--------------|---------------|
| HTTP calls (https.get.promise()) | Dialog confirmations |
| Multiple sequential async ops | Simple one-off operations |
| Need error propagation | Native JS methods (forEach, etc.) |
| Modern SuiteScript 2.1 code | Legacy 2.0 compatibility |

## Pattern: Client Script ↔ Suitelet Communication

Call a Suitelet from a Client Script for permission checks, data lookups, or actions:

```javascript
/**
 * Call Suitelet and handle response
 */
define(['N/https', 'N/url', 'N/currentRecord', 'N/dialog'],
function(https, url, currentRecord, dialog) {

    function validateWithServer() {
        const rec = currentRecord.get();

        const suiteletUrl = url.resolveScript({
            scriptId: 'customscript_sl_validator',
            deploymentId: 'customdeploy_sl_validator',
            params: {
                recordId: rec.id,
                recordType: rec.type,
                action: 'validate'
            }
        });

        return https.get.promise({ url: suiteletUrl })
            .then(function(response) {
                const result = JSON.parse(response.body);

                if (!result.valid) {
                    dialog.alert({
                        title: 'Validation Failed',
                        message: result.message
                    });
                }

                return result.valid;
            })
            .catch(function(error) {
                console.error('Validation error:', error);
                return false;
            });
    }

    // Called from custom button
    function performAction() {
        validateWithServer().then(function(isValid) {
            if (isValid) {
                // Proceed with action
                executeAction();
            }
        });
    }

    return {
        performAction: performAction
    };
});
```

## Common Mistakes

```javascript
// WRONG: Trying to modify display in validateField
function validateField(context) {
    const field = rec.getField({ fieldId: 'someField' });
    field.isDisplay = false;  // Won't work here
    return true;
}

// RIGHT: Modify display in fieldChanged
function fieldChanged(context) {
    const field = rec.getField({ fieldId: 'someField' });
    field.isDisplay = false;  // Works here
}
```

## See Also

- `../snippets/sublist-handling.md` - Sublist manipulation patterns
- `../gotchas.md` - Client script pitfalls
- `user-event.md` - Server-side companion patterns
