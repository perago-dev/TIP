# Constants & Configuration

## The Three-Tier Rule — No Hardcoded Values, Ever

Every value in a SuiteScript file must come from one of these three tiers. Choosing the right tier depends on the nature of the value:

| Tier | Use For | Examples |
|------|---------|---------|
| **`[client]_constants.js`** | Static values that never change across environments or clients | Field IDs, sublist IDs, record type strings, UI delay timers, performance thresholds |
| **Script Parameters (`custscript_...`)** | Values that may differ per deployment or that admins need to change without a code release | Saved search IDs, email recipients, feature flags, dry-run toggle, batch size limits |
| **Custom Config Records** | Values that change between environments — Production, Sandbox, Release Preview | External API endpoints/URLs, third-party credentials, environment-specific account IDs, integration toggle flags |

Hardcoded constants in individual files make maintenance, multi-client deployment, and environment promotion fragile and error-prone. If a value exists in a script file that is not sourced from one of the three tiers above, it must be refactored before release.

**Quick rule:** field ID → constants file. Batch size an admin might tune → Script Parameter. API endpoint that differs in Sandbox vs. Production → custom config record.

## Tier 1: Constants File (`[client]_constants.js`)

All field IDs, script IDs, deployment IDs, template IDs, status codes, and numeric thresholds must be defined here. Never define the same constant in multiple script files — import from the shared constants file instead.

Values that belong here:

```javascript
// Field IDs
const FIELD_CREATED_FROM = 'createdfrom';
const FIELD_ENTITY = 'entity';
const FIELD_CUSTOMER_SO = 'custbody_st_customer_sales_order';

// UI delay timers (milliseconds)
const UI_RETRY_DELAY_SHORT_MS = 100;
const UI_RETRY_DELAY_MEDIUM_MS = 500;
const UI_RETRY_DELAY_LONG_MS = 1200;

// Performance thresholds
const PERFORMANCE_LOG_THRESHOLD_MS = 1000;

// Template IDs — never inline
const TEMPLATE_ID_SO_PRINT = 415;

// Status codes — never use bare '1' or '2'
const STATUS_PENDING = '1';
const STATUS_APPROVED = '2';

// Record type strings — or use record.Type enum where available
const RECORD_TYPE_PO = 'purchaseorder';
const RECORD_TYPE_ASSEMBLY = 'assemblybuild';
```

Use `N/url` to generate URLs dynamically — never hardcode URLs in script logic.

## Tier 2: Script Parameters (`custscript_...`)

Use Script Parameters for values that may need to change per deployment without a code release, or that administrators should be able to configure.

**Common uses:** saved search IDs, email recipient lists, feature on/off flags, batch size limits, dry-run mode toggle (`custscript_dryrun`).

```javascript
const scriptObj = runtime.getCurrentScript();

// Read parameters
const savedSearchId = scriptObj.getParameter({ name: 'custscript_search_id' });
const dryRun = scriptObj.getParameter({ name: 'custscript_dryrun' });
const batchSize = scriptObj.getParameter({ name: 'custscript_batch_size' }) || 50;

// Never hardcode the parameter value as a fallback in logic
// BAD: const recipientEmail = scriptObj.getParameter(...) || 'admin@company.com';
// GOOD: if (!recipientEmail) { throw new Error('custscript_recipient_email is required'); }
```

Always read Script Parameters via `runtime.getCurrentScript().getParameter()`. Document every Script Parameter in the script header `@Description` or in the deployment record notes.

**Never** store credentials or tokens as Script Parameters — they are visible to admins in the UI.

## Tier 3: Custom Config Records (Environment-Aware Values)

For values that differ between Production, Sandbox, and Release Preview — use a custom configuration record (e.g., a custom record type acting as an environment config table).

This is the correct pattern for:
- External API base URLs
- Third-party integration credentials or tokens
- Environment-specific account/subsidiary IDs
- Integration enable/disable flags that differ per environment

The script reads the config record at runtime, so the same deployed code automatically picks up the correct values in each environment without any code changes.

```javascript
/**
 * Load active environment config record
 * @returns {Object} Config values
 */
function loadEnvConfig() {
    const result = search.create({
        type: 'customrecord_st_env_config',
        filters: [['custrecord_config_active', 'is', 'T']],
        columns: [
            'custrecord_config_api_url',
            'custrecord_config_env_name'
        ]
    }).run().getRange({ start: 0, end: 1 });

    if (!result || result.length === 0) {
        throw error.create({
            name: 'CONFIG_NOT_FOUND',
            message: 'No active environment config record found'
        });
    }

    return {
        apiUrl: result[0].getValue('custrecord_config_api_url'),
        envName: result[0].getValue('custrecord_config_env_name')
    };
}
```

Structure the config record with a field to identify the environment or use a single active record per account — the script should always load the active config row.

Use a custom record with restricted access or NetSuite's credential field type for sensitive values — never store credentials in Script Parameters (visible in the UI to admins) or in script files.

## See Also

- `script-header.md` - Header documentation for script parameters
- `naming-conventions.md` - File and ID naming patterns
- `../review/pre-release-checklist.md` - Constants checklist items
