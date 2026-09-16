# User Event Script Patterns

User Events trigger before/after record load, save, or delete. Use for server-side validation, cascading updates, and external notifications.

## Standard Template

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * [Description of what this script does]
 *
 * @module [ModuleName]
 * @requires N/record
 * @requires N/search
 * @requires N/log
 */
define(['N/record', 'N/search', 'N/log'], function(record, search, log) {

    /**
     * beforeLoad - Manipulate form before user sees it
     * @param {Object} context
     * @param {Record} context.newRecord - Current record
     * @param {string} context.type - Trigger type (create|edit|view|copy|print|email)
     * @param {Form} context.form - The form object
     */
    function beforeLoad(context) {
        try {
            if (context.type !== context.UserEventType.VIEW) return;

            // Add fields, buttons, sublists here

        } catch (e) {
            log.error({ title: 'beforeLoad Error', details: e.message });
            throw e;
        }
    }

    /**
     * beforeSubmit - Validate/modify before save to database
     * @param {Object} context
     * @param {Record} context.newRecord - Record being saved
     * @param {Record} context.oldRecord - Previous record values (edit only)
     * @param {string} context.type - Trigger type (create|edit|delete|xedit)
     */
    function beforeSubmit(context) {
        try {
            if (context.type === context.UserEventType.DELETE) return;

            const rec = context.newRecord;
            // Validation and modification here

        } catch (e) {
            log.error({ title: 'beforeSubmit Error', details: e.message });
            throw e;
        }
    }

    /**
     * afterSubmit - Process after save completes
     * @param {Object} context
     * @param {Record} context.newRecord - Saved record (read-only)
     * @param {Record} context.oldRecord - Previous record values
     * @param {string} context.type - Trigger type
     */
    function afterSubmit(context) {
        try {
            if (context.type === context.UserEventType.DELETE) return;

            const rec = context.newRecord;
            const recordId = rec.id;
            // Post-save processing here

        } catch (e) {
            log.error({ title: 'afterSubmit Error', details: e.message });
            // Don't re-throw in afterSubmit - record already saved
        }
    }

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});
```

## Pattern: Data Validation

```javascript
function beforeSubmit(context) {
    const rec = context.newRecord;
    const errors = [];

    // Required field validation
    if (!rec.getValue('custbody_custom_field')) {
        errors.push('Custom Field is required');
    }

    // Cross-field validation
    const startDate = rec.getValue('startdate');
    const endDate = rec.getValue('enddate');
    if (startDate && endDate && startDate > endDate) {
        errors.push('Start Date must be before End Date');
    }

    // Throw combined errors
    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }
}
```

## Pattern: Cascading Updates

```javascript
function afterSubmit(context) {
    if (context.type !== context.UserEventType.EDIT) return;

    const rec = context.newRecord;
    const oldRec = context.oldRecord;

    // Check if relevant field changed
    const oldStatus = oldRec.getValue('status');
    const newStatus = rec.getValue('status');

    if (oldStatus === newStatus) return;

    // Update related records
    const relatedIds = getRelatedRecords(rec.id);
    relatedIds.forEach(function(id) {
        record.submitFields({
            type: 'customrecord_related',
            id: id,
            values: { custrecord_status: newStatus }
        });
    });
}
```

## Pattern: Auto-Numbering

```javascript
function beforeSubmit(context) {
    if (context.type !== context.UserEventType.CREATE) return;

    const rec = context.newRecord;

    // Get next sequence number
    const configRec = record.load({
        type: 'customrecord_config',
        id: 1
    });

    const nextNum = configRec.getValue('custrecord_next_number');
    const prefix = configRec.getValue('custrecord_prefix');

    // Set the number
    rec.setValue('custbody_doc_number', prefix + nextNum);

    // Increment counter
    record.submitFields({
        type: 'customrecord_config',
        id: 1,
        values: { custrecord_next_number: nextNum + 1 }
    });
}
```

## Pattern: External System Notification

```javascript
function afterSubmit(context) {
    if (context.type === context.UserEventType.DELETE) return;

    const rec = context.newRecord;

    // Only notify on specific conditions
    if (rec.getValue('status') !== 'APPROVED') return;

    // Queue notification (don't block save)
    try {
        https.post({
            url: 'https://external-system.com/webhook',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recordId: rec.id,
                recordType: rec.type,
                action: context.type
            })
        });
    } catch (e) {
        // Log but don't fail - record already saved
        log.error({
            title: 'External Notification Failed',
            details: e.message
        });
    }
}
```

## Pattern: Form Customization

```javascript
function beforeLoad(context) {
    if (context.type !== context.UserEventType.VIEW &&
        context.type !== context.UserEventType.EDIT) return;

    const form = context.form;
    const rec = context.newRecord;

    // Add custom button
    form.addButton({
        id: 'custpage_custom_action',
        label: 'Custom Action',
        functionName: 'customAction'
    });

    // Hide field based on condition
    if (rec.getValue('status') === 'CLOSED') {
        form.getField({ id: 'custbody_sensitive' }).updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN
        });
    }

    // Add client script
    form.clientScriptModulePath = './client_script.js';
}
```

## Context Type Reference

| Type | beforeLoad | beforeSubmit | afterSubmit |
|------|------------|--------------|-------------|
| `CREATE` | Yes | Yes | Yes |
| `EDIT` | Yes | Yes | Yes |
| `VIEW` | Yes | No | No |
| `COPY` | Yes | No | No |
| `DELETE` | No | Yes | Yes |
| `XEDIT` | No | Yes | Yes |
| `PRINT` | Yes | No | No |
| `EMAIL` | Yes | No | No |

## Best Practices

1. **Check context.type first** - Don't process unnecessary triggers
2. **Use oldRecord for change detection** - Compare values before processing
3. **Don't throw in afterSubmit** - Record is already saved
4. **Avoid heavy processing in beforeLoad** - Impacts page load time
5. **Use submitFields for simple updates** - Lower governance cost than record.load/save

## See Also

- `../snippets/record-operations.md` - Record manipulation patterns
- `../snippets/error-handling.md` - Error handling patterns
- `../gotchas.md` - Common User Event mistakes
- `../../standards/testing.md` - Unit testing User Event scripts
