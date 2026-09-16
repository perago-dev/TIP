# Custom Record CSV Templates

Guidelines for importing custom records.

## Custom Record Import Basics

Custom records are created in Customization > Lists, Records & Fields > Record Types.

### Key Identifiers

| Field | Purpose |
|-------|---------|
| Internal ID | NetSuite auto-assigned |
| External ID | Your unique identifier |
| Name | Display name field |

## Template Structure

### Find Field IDs

1. Go to Customization > Lists, Records & Fields > Record Types
2. Click the custom record type
3. Note the script ID (e.g., `customrecord_project`)
4. Click "Fields" to see field script IDs (e.g., `custrecord_project_status`)

### Generic Template

```csv
External ID,Name,Custom Field 1,Custom Field 2,Reference Field
EXT-001,Record One,Value 1,Value 2,Parent Record Name
EXT-002,Record Two,Value 1,Value 2,Parent Record Name
```

## Example: Project Custom Record

### Custom Record Definition

- **Record Type**: `customrecord_project`
- **Fields**:
  - `name` - Project name
  - `custrecord_project_code` - Project code
  - `custrecord_project_status` - Status (list)
  - `custrecord_project_customer` - Customer (record reference)
  - `custrecord_project_start` - Start date
  - `custrecord_project_end` - End date
  - `custrecord_project_budget` - Budget (currency)

### CSV Template

```csv
External ID,Name,Project Code,Status,Customer,Start Date,End Date,Budget
PROJ-001,Website Redesign,WEB-2024-001,Active,Acme Corp,1/15/2024,3/31/2024,50000.00
PROJ-002,ERP Implementation,ERP-2024-001,Planning,Beta Industries,2/1/2024,6/30/2024,150000.00
PROJ-003,Inventory System,INV-2024-001,On Hold,Gamma LLC,3/1/2024,5/31/2024,75000.00
```

### Import Mapping

| CSV Column | NetSuite Field ID | Type |
|------------|-------------------|------|
| External ID | externalid | Text |
| Name | name | Text |
| Project Code | custrecord_project_code | Text |
| Status | custrecord_project_status | List |
| Customer | custrecord_project_customer | Record Reference |
| Start Date | custrecord_project_start | Date |
| End Date | custrecord_project_end | Date |
| Budget | custrecord_project_budget | Currency |

## Handling Field Types

### List/Record Fields

For list fields, use the list value text:
```csv
Status
Active
Planning
On Hold
```

For record references, use External ID or name:
```csv
Customer
Acme Corp
```

### Checkbox Fields

```csv
Is Active
T
F
```

### Multi-Select Fields

Use pipe delimiter:
```csv
Tags
Tag1|Tag2|Tag3
```

### Date Fields

Use M/D/YYYY format:
```csv
Start Date
1/15/2024
```

### Currency Fields

Numeric, no currency symbol:
```csv
Budget
50000.00
```

## Hierarchical Custom Records

For parent-child relationships:

### Parent Records First

```csv
External ID,Name,Parent
PARENT-001,Parent Record A,
PARENT-002,Parent Record B,
```

### Then Child Records

```csv
External ID,Name,Parent
CHILD-001,Child Record 1,PARENT-001
CHILD-002,Child Record 2,PARENT-001
CHILD-003,Child Record 3,PARENT-002
```

## Custom Record with Sublists

Some custom records have sublists (custom fields of type "Sublist").

### Main Record CSV

```csv
External ID,Name,Description
REC-001,Main Record 1,Description here
REC-002,Main Record 2,Another description
```

### Sublist CSV (separate import)

```csv
Parent External ID,Line Field 1,Line Field 2,Line Amount
REC-001,Value A,Value B,100.00
REC-001,Value C,Value D,200.00
REC-002,Value E,Value F,150.00
```

## Import Configuration

```
Record Type: Custom Record - [Your Record Type]
Import Type: Add (or Add/Update for external ID matching)
Character Encoding: Unicode (UTF-8)
CSV Column Delimiter: Comma
Handle Duplicates: Update using External ID
```

## Validation Script

```javascript
/**
 * Validate custom record data before import
 */
function validateCustomRecord(row, recordDef) {
    const errors = [];

    // Check required fields
    recordDef.requiredFields.forEach(function(field) {
        if (!row[field] || row[field].trim() === '') {
            errors.push('Required field missing: ' + field);
        }
    });

    // Validate field types
    recordDef.fields.forEach(function(fieldDef) {
        const value = row[fieldDef.csvColumn];
        if (!value) return;

        switch (fieldDef.type) {
            case 'date':
                if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
                    errors.push(fieldDef.csvColumn + ': Invalid date format');
                }
                break;

            case 'number':
                if (isNaN(parseFloat(value))) {
                    errors.push(fieldDef.csvColumn + ': Must be numeric');
                }
                break;

            case 'list':
                if (fieldDef.validValues && fieldDef.validValues.indexOf(value) === -1) {
                    errors.push(fieldDef.csvColumn + ': Invalid value');
                }
                break;
        }
    });

    return errors;
}
```

## Post-Import Verification

```javascript
/**
 * Verify custom record import
 */
function verifyImport(recordType, expectedCount) {
    const results = search.create({
        type: recordType,
        filters: [['datecreated', 'within', 'today']]
    }).run().getRange({ start: 0, end: 1000 });

    log.audit({
        title: 'Import Verification',
        details: 'Expected: ' + expectedCount + ', Actual: ' + results.length
    });

    return results.length === expectedCount;
}
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid value" | List value doesn't match | Check exact list value text |
| "Record not found" | Reference field invalid | Import referenced records first |
| "Field not on form" | Field hidden/removed | Add field to default form |
| "Permission denied" | Role can't access record | Use admin or adjust permissions |
| Import skips rows | Data validation failure | Check import job log for errors |

## Best Practices

1. **Document custom records** - Field IDs, types, valid values
2. **Import dependencies first** - Parent records, referenced records
3. **Use External IDs** - For update capability
4. **Test with small batch** - 10-20 records first
5. **Verify list values** - Exact match required
6. **Check permissions** - Ensure import role has access

## See Also

- `../INDEX.md` - Migration methodology
- `../validation.md` - Data validation patterns
- `customers.md` - Standard record import example
