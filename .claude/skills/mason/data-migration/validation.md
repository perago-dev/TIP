# Data Validation Patterns

Validate data before import to prevent errors.

## Validation Stages

```
1. SOURCE VALIDATION
   └── Before extraction
       ├── Data completeness
       ├── Duplicate detection
       └── Basic format checks

2. TRANSFORM VALIDATION
   └── During transformation
       ├── Type conversions
       ├── Lookup validations
       └── Business rules

3. PRE-IMPORT VALIDATION
   └── Before NetSuite import
       ├── Reference verification
       ├── NetSuite-specific rules
       └── Final data review

4. POST-IMPORT VALIDATION
   └── After import
       ├── Record counts
       ├── Data integrity
       └── Business process tests
```

## Source Validation

### Data Quality Checks

```javascript
/**
 * Validate source data quality
 */
function validateSourceData(data, rules) {
    const report = {
        totalRows: data.length,
        validRows: 0,
        invalidRows: 0,
        errors: [],
        warnings: []
    };

    data.forEach(function(row, index) {
        const rowNum = index + 2;  // Account for header row
        const rowErrors = [];

        // Required fields
        rules.required.forEach(function(field) {
            if (!row[field] || String(row[field]).trim() === '') {
                rowErrors.push('Missing required field: ' + field);
            }
        });

        // Data types
        Object.keys(rules.types || {}).forEach(function(field) {
            if (!row[field]) return;

            const type = rules.types[field];
            if (!validateType(row[field], type)) {
                rowErrors.push(field + ' is not a valid ' + type);
            }
        });

        // Custom validations
        (rules.custom || []).forEach(function(validator) {
            const result = validator(row);
            if (result) {
                rowErrors.push(result);
            }
        });

        if (rowErrors.length > 0) {
            report.invalidRows++;
            report.errors.push({
                row: rowNum,
                errors: rowErrors
            });
        } else {
            report.validRows++;
        }
    });

    return report;
}

function validateType(value, type) {
    switch (type) {
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case 'phone':
            return /^[\d\s\-\(\)\+]+$/.test(value);
        case 'date':
            return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value);
        case 'number':
            return !isNaN(parseFloat(value));
        case 'boolean':
            return ['T', 'F', 'true', 'false', '1', '0', 'yes', 'no'].indexOf(String(value).toLowerCase()) !== -1;
        default:
            return true;
    }
}
```

### Duplicate Detection

```javascript
/**
 * Find duplicate records
 */
function findDuplicates(data, keyFields) {
    const seen = {};
    const duplicates = [];

    data.forEach(function(row, index) {
        // Build composite key
        const key = keyFields.map(function(field) {
            return String(row[field] || '').toLowerCase().trim();
        }).join('|');

        if (seen[key]) {
            duplicates.push({
                row: index + 2,
                key: key,
                duplicateOf: seen[key]
            });
        } else {
            seen[key] = index + 2;
        }
    });

    return duplicates;
}

// Usage
const dupes = findDuplicates(customerData, ['Company Name', 'Email']);
```

## Reference Validation

### Verify Foreign Keys

```javascript
/**
 * Verify all references exist in NetSuite
 */
function validateReferences(data, referenceFields) {
    const missing = [];

    referenceFields.forEach(function(ref) {
        // Get unique values to look up
        const values = new Set();
        data.forEach(function(row) {
            if (row[ref.csvField]) {
                values.add(row[ref.csvField]);
            }
        });

        // Search for each value
        values.forEach(function(value) {
            const found = findReference(ref.recordType, ref.matchField, value);
            if (!found) {
                missing.push({
                    field: ref.csvField,
                    value: value,
                    recordType: ref.recordType
                });
            }
        });
    });

    return missing;
}

function findReference(recordType, field, value) {
    const results = search.create({
        type: recordType,
        filters: [[field, 'is', value]]
    }).run().getRange({ start: 0, end: 1 });

    return results.length > 0;
}

// Usage
const refs = [
    { csvField: 'Customer', recordType: 'customer', matchField: 'companyname' },
    { csvField: 'Item', recordType: 'item', matchField: 'itemid' },
    { csvField: 'Vendor', recordType: 'vendor', matchField: 'companyname' }
];

const missingRefs = validateReferences(transactionData, refs);
```

## Business Rule Validation

```javascript
/**
 * Validate business rules
 */
const businessRules = [
    // Credit limit can't be negative
    function(row) {
        if (row['Credit Limit'] && parseFloat(row['Credit Limit']) < 0) {
            return 'Credit Limit cannot be negative';
        }
    },

    // Start date before end date
    function(row) {
        if (row['Start Date'] && row['End Date']) {
            const start = new Date(row['Start Date']);
            const end = new Date(row['End Date']);
            if (start > end) {
                return 'Start Date must be before End Date';
            }
        }
    },

    // Cost less than price (warning)
    function(row) {
        const cost = parseFloat(row['Cost']) || 0;
        const price = parseFloat(row['Price']) || 0;
        if (cost > 0 && price > 0 && cost > price) {
            return 'WARNING: Cost exceeds Price';
        }
    },

    // Valid country code
    function(row) {
        const validCountries = ['US', 'CA', 'MX', 'GB', 'DE', 'FR'];
        if (row['Country'] && validCountries.indexOf(row['Country']) === -1) {
            return 'Invalid country code: ' + row['Country'];
        }
    }
];
```

## Pre-Import Checklist

```javascript
/**
 * Complete pre-import validation
 */
function preImportValidation(data, recordType) {
    const checks = {
        dataQuality: null,
        duplicates: null,
        references: null,
        businessRules: null,
        ready: false
    };

    // 1. Data quality
    checks.dataQuality = validateSourceData(data, getValidationRules(recordType));

    // 2. Duplicates
    checks.duplicates = findDuplicates(data, getDuplicateKeys(recordType));

    // 3. References
    checks.references = validateReferences(data, getReferenceFields(recordType));

    // 4. Business rules
    checks.businessRules = data.map(function(row, index) {
        const errors = [];
        businessRules.forEach(function(rule) {
            const result = rule(row);
            if (result) errors.push(result);
        });
        return errors.length > 0 ? { row: index + 2, errors: errors } : null;
    }).filter(function(r) { return r !== null; });

    // Determine readiness
    checks.ready = (
        checks.dataQuality.invalidRows === 0 &&
        checks.duplicates.length === 0 &&
        checks.references.length === 0 &&
        checks.businessRules.length === 0
    );

    return checks;
}
```

## Post-Import Validation

### Record Count Verification

```javascript
/**
 * Verify import counts
 */
function verifyImportCounts(recordType, expectedCount, importDate) {
    const results = search.create({
        type: recordType,
        filters: [
            ['datecreated', 'on', importDate]
        ]
    }).run().getRange({ start: 0, end: 1 });

    // Get actual count
    const countSearch = search.create({
        type: recordType,
        filters: [
            ['datecreated', 'on', importDate]
        ],
        columns: [
            search.createColumn({ name: 'internalid', summary: search.Summary.COUNT })
        ]
    }).run().getRange({ start: 0, end: 1 });

    const actualCount = parseInt(countSearch[0].getValue({
        name: 'internalid',
        summary: search.Summary.COUNT
    }));

    return {
        expected: expectedCount,
        actual: actualCount,
        match: expectedCount === actualCount
    };
}
```

### Sample Verification

```javascript
/**
 * Verify sample records
 */
function verifySampleRecords(recordType, sampleExternalIds) {
    const results = [];

    sampleExternalIds.forEach(function(extId) {
        const searchResults = search.create({
            type: recordType,
            filters: [['externalid', 'is', extId]],
            columns: ['internalid', 'name']  // Add relevant fields
        }).run().getRange({ start: 0, end: 1 });

        results.push({
            externalId: extId,
            found: searchResults.length > 0,
            netsuiteId: searchResults.length > 0 ? searchResults[0].id : null
        });
    });

    return results;
}
```

### Data Integrity Checks

```javascript
/**
 * Verify data integrity after import
 */
function verifyDataIntegrity(checks) {
    const results = [];

    checks.forEach(function(check) {
        const searchResults = search.create({
            type: check.recordType,
            filters: check.filters,
            columns: [
                search.createColumn({ name: 'internalid', summary: search.Summary.COUNT })
            ]
        }).run().getRange({ start: 0, end: 1 });

        const count = parseInt(searchResults[0].getValue({
            name: 'internalid',
            summary: search.Summary.COUNT
        }));

        results.push({
            check: check.name,
            count: count,
            expected: check.expectedCount,
            pass: check.operator === '=' ? count === check.expectedCount :
                  check.operator === '>' ? count > check.expectedCount :
                  check.operator === '<' ? count < check.expectedCount : false
        });
    });

    return results;
}

// Usage
const integrityChecks = [
    {
        name: 'Customers without email',
        recordType: 'customer',
        filters: [['email', 'isempty', '']],
        operator: '=',
        expectedCount: 0
    },
    {
        name: 'Items without cost',
        recordType: 'inventoryitem',
        filters: [['cost', 'isempty', '']],
        operator: '=',
        expectedCount: 0
    }
];
```

## Validation Report Template

```markdown
# Data Migration Validation Report

**Date**: [Date]
**Record Type**: [Record Type]
**Source File**: [Filename]

## Summary

| Metric | Value |
|--------|-------|
| Total Rows | [N] |
| Valid Rows | [N] |
| Invalid Rows | [N] |
| Duplicates | [N] |
| Missing References | [N] |

## Data Quality Issues

| Row | Field | Issue |
|-----|-------|-------|
| 5 | Email | Invalid format |
| 12 | Amount | Not numeric |

## Duplicate Records

| Row | Key | Duplicate Of |
|-----|-----|--------------|
| 15 | ACME|acme@test.com | Row 3 |

## Missing References

| Field | Value | Record Type |
|-------|-------|-------------|
| Customer | Unknown Corp | customer |

## Recommendation

[Ready for import / Requires fixes]

## Sign-off

- [ ] Data Owner
- [ ] Technical Lead
```

## See Also

- `INDEX.md` - Migration methodology
- `csv-templates/` - Import templates
- `rollback.md` - Rollback procedures
- `../suitescript/snippets/search-patterns.md` - Search patterns for reference lookups
- `../standards/testing.md` - Testing validation scripts
