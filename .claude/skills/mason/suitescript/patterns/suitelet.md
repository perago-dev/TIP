# Suitelet Patterns

Suitelets create custom pages and UIs in NetSuite. Use for dashboards, configuration screens, wizards, and custom reports.

## Standard Template

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * [Description of what this Suitelet does]
 *
 * @module [ModuleName]
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/log', 'N/redirect'],
function(serverWidget, search, record, log, redirect) {

    /**
     * Handle Suitelet requests
     * @param {Object} context
     * @param {ServerRequest} context.request
     * @param {ServerResponse} context.response
     */
    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                handleGet(context);
            } else {
                handlePost(context);
            }
        } catch (e) {
            log.error({ title: 'Suitelet Error', details: e.message });
            context.response.write('Error: ' + e.message);
        }
    }

    /**
     * Handle GET - Display form
     */
    function handleGet(context) {
        const form = serverWidget.createForm({
            title: 'Custom Page Title'
        });

        // Add form fields
        form.addField({
            id: 'custpage_customer',
            type: serverWidget.FieldType.SELECT,
            label: 'Customer',
            source: 'customer'
        });

        form.addField({
            id: 'custpage_date',
            type: serverWidget.FieldType.DATE,
            label: 'Date'
        });

        // Add submit button
        form.addSubmitButton({
            label: 'Process'
        });

        context.response.writePage(form);
    }

    /**
     * Handle POST - Process form submission
     */
    function handlePost(context) {
        const request = context.request;

        // Get submitted values
        const customerId = request.parameters.custpage_customer;
        const date = request.parameters.custpage_date;

        // Process the data
        const result = processData(customerId, date);

        // Redirect or show results
        if (result.success) {
            redirect.toRecord({
                type: record.Type.CUSTOMER,
                id: customerId
            });
        } else {
            showError(context, result.message);
        }
    }

    return {
        onRequest: onRequest
    };
});
```

## Pattern: Action Suitelet (No UI)

Action Suitelets perform an operation and redirect back. No form UI needed:

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * Action Suitelet - performs action and redirects back
 */
define(['N/record', 'N/redirect', 'N/log', 'N/runtime'],
function(record, redirect, log, runtime) {

    function onRequest(context) {
        try {
            // Validate required parameters
            const recordId = context.request.parameters.recordId;
            const recordType = context.request.parameters.recordType;
            const action = context.request.parameters.action;

            if (!recordId || !recordType) {
                throw new Error('Missing required parameters: recordId, recordType');
            }

            // Perform the action
            let result;
            switch (action) {
                case 'approve':
                    result = approveRecord(recordType, recordId);
                    break;
                case 'reject':
                    result = rejectRecord(recordType, recordId);
                    break;
                case 'revise':
                    result = reviseRecord(recordType, recordId);
                    break;
                default:
                    throw new Error('Unknown action: ' + action);
            }

            log.audit({
                title: 'Action Completed',
                details: JSON.stringify({
                    action: action,
                    recordType: recordType,
                    recordId: recordId,
                    result: result
                })
            });

            // Redirect back to the record
            redirect.toRecord({
                type: recordType,
                id: recordId,
                parameters: { actionResult: 'success' }
            });

        } catch (e) {
            log.error({ title: 'Action Suitelet Error', details: e.message });

            // Show error and redirect
            const recordId = context.request.parameters.recordId;
            const recordType = context.request.parameters.recordType;

            if (recordId && recordType) {
                redirect.toRecord({
                    type: recordType,
                    id: recordId,
                    parameters: { actionError: encodeURIComponent(e.message) }
                });
            } else {
                // Fallback: write error as raw HTML with JS redirect
                context.response.write(
                    '<html><body>' +
                    '<p>Error: ' + e.message + '</p>' +
                    '<script>setTimeout(function() { history.back(); }, 3000);</script>' +
                    '</body></html>'
                );
            }
        }
    }

    function approveRecord(recordType, recordId) {
        record.submitFields({
            type: recordType,
            id: recordId,
            values: {
                custbody_approval_status: 'APPROVED',
                custbody_approved_date: new Date(),
                custbody_approved_by: runtime.getCurrentUser().id
            }
        });
        return { status: 'approved' };
    }

    function rejectRecord(recordType, recordId) {
        record.submitFields({
            type: recordType,
            id: recordId,
            values: {
                custbody_approval_status: 'REJECTED'
            }
        });
        return { status: 'rejected' };
    }

    function reviseRecord(recordType, recordId) {
        // Create a revision/copy
        const newRec = record.copy({
            type: recordType,
            id: recordId
        });
        newRec.setValue('custbody_revision_of', recordId);
        const newId = newRec.save();
        return { status: 'revised', newId: newId };
    }

    return { onRequest: onRequest };
});
```

### Adding Action Button in User Event

```javascript
/**
 * User Event to add action button
 */
function beforeLoad(context) {
    if (context.type !== context.UserEventType.VIEW) return;

    const form = context.form;
    const rec = context.newRecord;

    // Only show if pending approval
    if (rec.getValue('custbody_approval_status') !== 'PENDING') return;

    const suiteletUrl = url.resolveScript({
        scriptId: 'customscript_sl_action',
        deploymentId: 'customdeploy_sl_action',
        params: {
            recordId: rec.id,
            recordType: rec.type,
            action: 'approve'
        }
    });

    form.addButton({
        id: 'custpage_approve',
        label: 'Approve',
        functionName: 'window.location="' + suiteletUrl + '"'
    });
}
```

---

## Pattern: Dashboard with Portlets

```javascript
/**
 * Custom dashboard with multiple data sections
 */
function handleGet(context) {
    const form = serverWidget.createForm({
        title: 'Sales Dashboard'
    });

    // Add filter group
    const filterGroup = form.addFieldGroup({
        id: 'custpage_filters',
        label: 'Filters'
    });

    const periodField = form.addField({
        id: 'custpage_period',
        type: serverWidget.FieldType.SELECT,
        label: 'Period',
        container: 'custpage_filters'
    });
    periodField.addSelectOption({ value: 'thismonth', text: 'This Month' });
    periodField.addSelectOption({ value: 'lastmonth', text: 'Last Month' });
    periodField.addSelectOption({ value: 'thisquarter', text: 'This Quarter' });

    // Add summary statistics
    const statsGroup = form.addFieldGroup({
        id: 'custpage_stats',
        label: 'Summary Statistics'
    });

    const stats = getSummaryStats();

    form.addField({
        id: 'custpage_total_sales',
        type: serverWidget.FieldType.CURRENCY,
        label: 'Total Sales',
        container: 'custpage_stats'
    }).updateDisplayType({
        displayType: serverWidget.FieldDisplayType.INLINE
    }).defaultValue = stats.totalSales;

    form.addField({
        id: 'custpage_order_count',
        type: serverWidget.FieldType.INTEGER,
        label: 'Order Count',
        container: 'custpage_stats'
    }).updateDisplayType({
        displayType: serverWidget.FieldDisplayType.INLINE
    }).defaultValue = stats.orderCount;

    // Add data sublist
    const sublist = form.addSublist({
        id: 'custpage_orders',
        type: serverWidget.SublistType.LIST,
        label: 'Recent Orders'
    });

    sublist.addField({ id: 'custpage_order_id', type: serverWidget.FieldType.TEXT, label: 'Order #' });
    sublist.addField({ id: 'custpage_customer', type: serverWidget.FieldType.TEXT, label: 'Customer' });
    sublist.addField({ id: 'custpage_amount', type: serverWidget.FieldType.CURRENCY, label: 'Amount' });
    sublist.addField({ id: 'custpage_date', type: serverWidget.FieldType.DATE, label: 'Date' });

    // Populate sublist
    const orders = getRecentOrders();
    orders.forEach(function(order, index) {
        sublist.setSublistValue({ id: 'custpage_order_id', line: index, value: order.id });
        sublist.setSublistValue({ id: 'custpage_customer', line: index, value: order.customer });
        sublist.setSublistValue({ id: 'custpage_amount', line: index, value: order.amount });
        sublist.setSublistValue({ id: 'custpage_date', line: index, value: order.date });
    });

    context.response.writePage(form);
}
```

## Pattern: Configuration Page

```javascript
/**
 * Settings configuration page
 */
function handleGet(context) {
    const form = serverWidget.createForm({
        title: 'Integration Settings'
    });

    // Load current settings
    const settings = loadSettings();

    // API Configuration
    form.addFieldGroup({ id: 'api_config', label: 'API Configuration' });

    const apiUrl = form.addField({
        id: 'custpage_api_url',
        type: serverWidget.FieldType.URL,
        label: 'API Endpoint',
        container: 'api_config'
    });
    apiUrl.defaultValue = settings.apiUrl;
    apiUrl.isMandatory = true;

    const apiKey = form.addField({
        id: 'custpage_api_key',
        type: serverWidget.FieldType.PASSWORD,
        label: 'API Key',
        container: 'api_config'
    });
    apiKey.defaultValue = settings.apiKey;
    apiKey.isMandatory = true;

    // Sync Settings
    form.addFieldGroup({ id: 'sync_config', label: 'Sync Settings' });

    const syncEnabled = form.addField({
        id: 'custpage_sync_enabled',
        type: serverWidget.FieldType.CHECKBOX,
        label: 'Enable Auto-Sync',
        container: 'sync_config'
    });
    syncEnabled.defaultValue = settings.syncEnabled ? 'T' : 'F';

    const syncInterval = form.addField({
        id: 'custpage_sync_interval',
        type: serverWidget.FieldType.SELECT,
        label: 'Sync Interval',
        container: 'sync_config'
    });
    syncInterval.addSelectOption({ value: '15', text: 'Every 15 minutes' });
    syncInterval.addSelectOption({ value: '30', text: 'Every 30 minutes' });
    syncInterval.addSelectOption({ value: '60', text: 'Every hour' });
    syncInterval.defaultValue = settings.syncInterval;

    form.addSubmitButton({ label: 'Save Settings' });
    form.addButton({
        id: 'custpage_test',
        label: 'Test Connection',
        functionName: 'testConnection'
    });

    // Add client script for button
    form.clientScriptModulePath = './config_client.js';

    context.response.writePage(form);
}

function handlePost(context) {
    const request = context.request;

    // Save settings to custom record
    const settingsRec = record.load({
        type: 'customrecord_integration_settings',
        id: 1
    });

    settingsRec.setValue('custrecord_api_url', request.parameters.custpage_api_url);
    settingsRec.setValue('custrecord_api_key', request.parameters.custpage_api_key);
    settingsRec.setValue('custrecord_sync_enabled', request.parameters.custpage_sync_enabled === 'T');
    settingsRec.setValue('custrecord_sync_interval', request.parameters.custpage_sync_interval);

    settingsRec.save();

    // Redirect back with success message
    redirect.toSuitelet({
        scriptId: runtime.getCurrentScript().id,
        deploymentId: runtime.getCurrentScript().deploymentId,
        parameters: { saved: 'T' }
    });
}
```

## Pattern: Wizard/Multi-Step Form

```javascript
/**
 * Multi-step wizard
 */
function onRequest(context) {
    const step = parseInt(context.request.parameters.step) || 1;

    if (context.request.method === 'GET') {
        showStep(context, step);
    } else {
        processStep(context, step);
    }
}

function showStep(context, step) {
    const form = serverWidget.createForm({
        title: 'Import Wizard - Step ' + step + ' of 3'
    });

    // Hidden field for step tracking
    form.addField({
        id: 'custpage_step',
        type: serverWidget.FieldType.INTEGER,
        label: 'Step'
    }).updateDisplayType({
        displayType: serverWidget.FieldDisplayType.HIDDEN
    }).defaultValue = step;

    switch (step) {
        case 1:
            buildStep1(form);
            break;
        case 2:
            buildStep2(form, context.request.parameters);
            break;
        case 3:
            buildStep3(form, context.request.parameters);
            break;
    }

    // Navigation buttons
    if (step > 1) {
        form.addButton({
            id: 'custpage_back',
            label: 'Back',
            functionName: 'goBack'
        });
    }

    if (step < 3) {
        form.addSubmitButton({ label: 'Next' });
    } else {
        form.addSubmitButton({ label: 'Finish' });
    }

    form.clientScriptModulePath = './wizard_client.js';

    context.response.writePage(form);
}

function buildStep1(form) {
    // File upload step
    form.addField({
        id: 'custpage_file',
        type: serverWidget.FieldType.FILE,
        label: 'Select CSV File'
    }).isMandatory = true;
}

function buildStep2(form, params) {
    // Column mapping step
    const columns = parseFileColumns(params.custpage_file);

    columns.forEach(function(col, index) {
        const field = form.addField({
            id: 'custpage_map_' + index,
            type: serverWidget.FieldType.SELECT,
            label: 'Map "' + col + '" to:'
        });

        getTargetFields().forEach(function(target) {
            field.addSelectOption({ value: target.id, text: target.label });
        });
    });
}

function buildStep3(form, params) {
    // Preview/confirmation step
    const preview = generatePreview(params);

    form.addField({
        id: 'custpage_preview',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Preview'
    }).defaultValue = preview;
}

function processStep(context, step) {
    if (step < 3) {
        // Pass parameters to next step
        redirect.toSuitelet({
            scriptId: runtime.getCurrentScript().id,
            deploymentId: runtime.getCurrentScript().deploymentId,
            parameters: {
                step: step + 1,
                ...context.request.parameters
            }
        });
    } else {
        // Final processing
        const result = executeImport(context.request.parameters);

        redirect.toSuitelet({
            scriptId: runtime.getCurrentScript().id,
            deploymentId: runtime.getCurrentScript().deploymentId,
            parameters: { complete: 'T', count: result.count }
        });
    }
}
```

## Pattern: Custom Report

```javascript
/**
 * Dynamic report with filters
 */
function handleGet(context) {
    const form = serverWidget.createForm({
        title: 'Custom Sales Report'
    });

    // Filter fields
    const dateFrom = form.addField({
        id: 'custpage_datefrom',
        type: serverWidget.FieldType.DATE,
        label: 'From Date'
    });

    const dateTo = form.addField({
        id: 'custpage_dateto',
        type: serverWidget.FieldType.DATE,
        label: 'To Date'
    });

    const subsidiary = form.addField({
        id: 'custpage_subsidiary',
        type: serverWidget.FieldType.SELECT,
        label: 'Subsidiary',
        source: 'subsidiary'
    });

    form.addSubmitButton({ label: 'Run Report' });
    form.addButton({
        id: 'custpage_export',
        label: 'Export CSV',
        functionName: 'exportCSV'
    });

    // Show results if filters provided
    const params = context.request.parameters;
    if (params.custpage_datefrom && params.custpage_dateto) {
        // Set filter values
        dateFrom.defaultValue = params.custpage_datefrom;
        dateTo.defaultValue = params.custpage_dateto;
        subsidiary.defaultValue = params.custpage_subsidiary;

        // Run report and display
        displayResults(form, params);
    }

    form.clientScriptModulePath = './report_client.js';

    context.response.writePage(form);
}

function displayResults(form, params) {
    const sublist = form.addSublist({
        id: 'custpage_results',
        type: serverWidget.SublistType.LIST,
        label: 'Results'
    });

    sublist.addField({ id: 'custpage_order', type: serverWidget.FieldType.TEXT, label: 'Order #' });
    sublist.addField({ id: 'custpage_customer', type: serverWidget.FieldType.TEXT, label: 'Customer' });
    sublist.addField({ id: 'custpage_date', type: serverWidget.FieldType.DATE, label: 'Date' });
    sublist.addField({ id: 'custpage_amount', type: serverWidget.FieldType.CURRENCY, label: 'Amount' });

    // Run search with filters
    const results = runReportSearch(params);

    results.forEach(function(row, index) {
        sublist.setSublistValue({ id: 'custpage_order', line: index, value: row.order });
        sublist.setSublistValue({ id: 'custpage_customer', line: index, value: row.customer });
        sublist.setSublistValue({ id: 'custpage_date', line: index, value: row.date });
        sublist.setSublistValue({ id: 'custpage_amount', line: index, value: row.amount });
    });

    // Add totals
    form.addField({
        id: 'custpage_total',
        type: serverWidget.FieldType.CURRENCY,
        label: 'Total'
    }).updateDisplayType({
        displayType: serverWidget.FieldDisplayType.INLINE
    }).defaultValue = results.reduce(function(sum, row) { return sum + row.amount; }, 0);
}
```

## Field Types Reference

| Type | Use For |
|------|---------|
| `TEXT` | Single-line text |
| `TEXTAREA` | Multi-line text |
| `EMAIL` | Email addresses |
| `URL` | URLs |
| `PHONE` | Phone numbers |
| `INTEGER` | Whole numbers |
| `FLOAT` | Decimal numbers |
| `CURRENCY` | Money values |
| `PERCENT` | Percentages |
| `DATE` | Dates |
| `DATETIME` | Date and time |
| `CHECKBOX` | Boolean |
| `SELECT` | Dropdown |
| `MULTISELECT` | Multiple selection |
| `FILE` | File upload |
| `INLINEHTML` | Custom HTML |
| `PASSWORD` | Masked input |

## Best Practices

1. **Use field groups** - Organize related fields
2. **Set mandatory fields** - Enforce required input
3. **Default values** - Pre-populate when possible
4. **Inline display** - For read-only summary fields
5. **Client scripts** - For interactive behavior
6. **Error handling** - Show user-friendly messages

## See Also

- `client-script.md` - Client-side behavior
- `restlet.md` - For API-style interfaces
- `../snippets/search-patterns.md` - Populating sublists
