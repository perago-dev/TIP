# Naming Conventions

Standard naming patterns for NetSuite customizations at Softype.

## Script File Naming

### Pattern

```
Softype_<ScriptType>_<RecordOrDomain>_<Purpose>.js
```

- All segments joined with underscores — no spaces, hyphens, or camelCase in filenames
- All filenames start with the `Softype_` prefix — no exceptions
- Script type abbreviation must match the actual `@NScriptType` of the file

### Script Type Abbreviations

| Abbreviation | Script Type | Example |
|-------------|-------------|---------|
| `UE` | User Event Script | `Softype_UE_SO_Core.js` |
| `CS` | Client Script | `Softype_CS_SO_AdminAndMainFields.js` |
| `SL` | Suitelet | `Softype_SL_PO_PrintPDF.js` |
| `MR` | Map/Reduce Script | `Softype_MR_ItemFulfillment_IC.js` |
| `SS` | Scheduled Script | `Softype_SS_Invoice_Aging.js` |
| `RL` | RESTlet | `Softype_RL_SO_StatusUpdate.js` |
| `WFA` | Workflow Action Script | `Softype_WFA_SO_ApprovalNotify.js` |
| `UTIL` | Utility / Library | `Softype_UTIL_OtherConfig.js` |

### Record / Domain Segment Examples

| Segment | Record or Domain |
|---------|-----------------|
| `SO` | Sales Order |
| `PO` | Purchase Order |
| `IF` | Item Fulfillment |
| `IR` | Item Receipt |
| `VB` | Vendor Bill |
| `IT` | Inventory Transfer |
| `WO` | Work Order |
| `ITEM` | Item record |
| `Cust` | Customer record |
| `UTIL` | Shared utility / library (no specific record) |

### Additional Rules

- Helper files follow the same pattern: `Softype_UTIL_OtherConfig.js`, `Softype_UTIL_Logger.js`
- Config files use the `CONFIG` segment: `Softype_CONFIG_QC.js` (not `ITEM_QC_Config.js`)
- Helper files for a specific domain use `HELPER`: `Softype_UTIL_QC_Helper.js` (not `ITEM_QC_Helper.js`)
- Never use all-caps filenames without the `Softype_` prefix — `ITEM_QC_Config.js` is a violation

### Script IDs (Script Record)

Script IDs in NetSuite (`customscript_...`) must mirror the filename in snake_case:

```
Softype_UE_SO_Core.js        →  customscript_softype_ue_so_core
Softype_MR_IF_IC.js          →  customscript_softype_mr_if_ic
Softype_UTIL_Logger.js       →  customscript_softype_util_logger
```

### Deployment IDs

Deployment IDs follow the same pattern with the record type appended if multiple deployments exist:

```
customdeploy_softype_ue_so_core
customdeploy_softype_ue_so_core_salesorder   # Multiple deployments
customdeploy_softype_ss_invoice_aging_daily
```

## Custom Fields

### Format

```
cust[scope]_[prefix]_[fieldname]
```

**Scopes:**
- `custbody_` - Transaction body field
- `custcol_` - Transaction line field
- `custentity_` - Entity field (customer, vendor, employee)
- `custitem_` - Item field
- `custrecord_` - Custom record field
- `custevent_` - Event field

**Examples:**
```
custbody_st_approval_status
custcol_st_commission_rate
custentity_st_external_id
custitem_st_lead_time
custrecord_st_project_code
```

## Custom Records

### Record Type ID

```
customrecord_[prefix]_[recordname]
```

**Examples:**
```
customrecord_st_project
customrecord_st_integration_log
customrecord_st_approval_matrix
```

### Record Fields

```
custrecord_[recordname]_[fieldname]
```

**Examples:**
```
custrecord_project_code
custrecord_project_status
custrecord_project_manager
```

## Custom Lists

### List ID

```
customlist_[prefix]_[listname]
```

**Examples:**
```
customlist_st_order_status
customlist_st_priority_level
customlist_st_region
```

## Saved Searches

### Search ID

```
customsearch_[prefix]_[purpose]
```

**Examples:**
```
customsearch_st_open_orders
customsearch_st_aging_report
customsearch_st_inventory_low
```

## Workflows

### Workflow ID

```
customworkflow_[prefix]_[process]
```

**Examples:**
```
customworkflow_st_order_approval
customworkflow_st_expense_routing
```

### Workflow States

```
[Action]ing / [Status]
```

**Examples:**
```
Pending Approval
Manager Review
Finance Approval
Approved
Rejected
```

## Roles

### Role Name Format

```
[Company] [Function] [Level]
```

**Examples:**
```
Softype Sales Manager
Softype Sales Representative
Softype Finance Admin
Softype Integration User
```

## Bundle/SDF Project

### Bundle ID

```
com.[company].[module]
```

**Examples:**
```
com.softype.integration
com.softype.ordermanagement
```

### Object Folder Structure

```
Objects/
├── CustomFields/
│   ├── Body/
│   ├── Column/
│   └── Entity/
├── CustomRecords/
├── CustomLists/
├── Scripts/
├── Workflows/
└── SavedSearches/
```

## JavaScript Conventions

### Variables

```javascript
// camelCase for variables and functions
const customerName = 'Acme';
const totalAmount = 100.00;

function calculateTotal() { }
function processOrder() { }

// UPPER_SNAKE_CASE for constants
const MAX_RETRY_COUNT = 3;
const API_ENDPOINT = 'https://api.example.com';

// Prefix booleans with is/has/should
const isActive = true;
const hasPermission = false;
const shouldProcess = true;
```

### Functions

```javascript
// Verb + noun
function getCustomer() { }
function setFieldValue() { }
function calculateDiscount() { }
function validateRecord() { }
function processOrder() { }
function createInvoice() { }
function updateStatus() { }
function deleteRecord() { }
```

### Entry Points

```javascript
// Match NetSuite conventions
function beforeLoad(context) { }
function beforeSubmit(context) { }
function afterSubmit(context) { }
function pageInit(context) { }
function fieldChanged(context) { }
function saveRecord(context) { }
function execute(context) { }
function getInputData() { }
function map(context) { }
function reduce(context) { }
function summarize(summary) { }
```

## File Organization

### Script File Header

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * @description Brief description of what this script does
 *
 * @module company/module/script_name
 * @author Developer Name
 * @date 2024-01-15
 * @version 1.0.0
 *
 * @requires N/record
 * @requires N/search
 */
```

### Module Structure

```
SuiteScripts/
├── [company]/
│   ├── [module]/
│   │   ├── [type]_[record]_[function].js
│   │   └── lib/
│   │       └── [module]_helper.js
│   └── common/
│       ├── constants.js
│       └── utils.js
└── README.md
```

## Prefix Standards

### Company Prefix

Use a 2-4 character prefix for all customizations:
- `ST_` or `st_` for Softype internal/demo projects
- For **client projects**, use the client's chosen prefix (e.g., `ABC_` for ABC Corp)
- Prevents conflicts with future NetSuite updates
- Makes customizations easily identifiable

> **Important**: The `st_` prefix in examples throughout Mason documentation is for illustration. Always confirm the project-specific prefix during kickoff.

### Reserved Prefixes

| Prefix | Reserved For |
|--------|--------------|
| `cust` | NetSuite system prefix |
| `ns_` | NetSuite internal |
| `_` | NetSuite internal |

## Quick Reference

| Type | Format | Example |
|------|--------|---------|
| Script File | `[type]_[record]_[function].js` | `userevent_salesorder_validation.js` |
| Script ID | `customscript_[prefix]_[function]` | `customscript_st_so_validation` |
| Deployment | `customdeploy_[script_id]` | `customdeploy_st_so_validation` |
| Body Field | `custbody_[prefix]_[name]` | `custbody_st_approval_status` |
| Line Field | `custcol_[prefix]_[name]` | `custcol_st_discount_pct` |
| Entity Field | `custentity_[prefix]_[name]` | `custentity_st_external_id` |
| Custom Record | `customrecord_[prefix]_[name]` | `customrecord_st_project` |
| Custom List | `customlist_[prefix]_[name]` | `customlist_st_status` |
| Saved Search | `customsearch_[prefix]_[name]` | `customsearch_st_open_orders` |
| Workflow | `customworkflow_[prefix]_[name]` | `customworkflow_st_approval` |

## See Also

- `code-style.md` - Code formatting standards
- `documentation.md` - Documentation requirements
- `../review/checklist.md` - Review criteria
